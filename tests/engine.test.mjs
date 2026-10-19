import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {
  DICE, TARGETS, DIFFICULTIES, ORACLE_TABLE,
  newState, dispatch, applyCommand, observe,
  exportSave, importSave, exportLog, replayRandom,
  exportThread, importThread, exportAllLogs, INSPIRE_TABLES, YESNO_TABLE,
} from "../src/engine.mjs";

// A state whose upcoming tape values are fully controlled.
// draw() -> values[cursor]; rollDie(10) = 1 + floor(v*10).
function rigged(values) {
  const s = newState();
  s.random = replayRandom(values);
  return s;
}
// Pins the save-file checksum format: if this ever disagrees with the
// engine, old saves stop loading, which is exactly what we want to catch.
function checksumOf(body) {
  const canonical = (x) => {
    if (x === null || typeof x !== "object") return JSON.stringify(x);
    if (Array.isArray(x)) return "[" + x.map(canonical).join(",") + "]";
    return "{" + Object.keys(x).sort().map((k) => JSON.stringify(k) + ":" + canonical(x[k])).join(",") + "}";
  };
  const text = canonical(body);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return ("0000000" + h.toString(16)).slice(-8);
}

const tapeFor = (d10s) => {
  // plenty of filler, then the requested d10 draws in order
  const fill = Array(600).fill(0.42);
  const seq = d10s.map((d) => (d - 0.5) / 10);
  return [...seq, ...fill];
};

test("the welcome note names the shapes of the DM's answers", () => {
  // Documentation, not enforcement (1.18): the note states what each
  // question kind asks, and the engine still refuses nothing.
  const s = newState();
  const note = observe(s).thread.messages.find((m) => m.kind === "note");
  assert.ok(note, "a fresh state opens with the DM's note");
  assert.match(note.text, /ask, and I judge an attempt, whether you succeed/);
  assert.match(note.text, /ask yes or no, and I answer what is true, whether something is so/);
  assert.match(note.text, /ask for inspiration, and I offer what might be there/);
});

test("oracle table covers 1..10 exactly once", () => {
  const seen = new Set();
  for (const r of ORACLE_TABLE) for (let d = r.min; d <= r.max; d++) {
    assert.ok(!seen.has(d), "overlap at " + d);
    seen.add(d);
  }
  assert.equal(seen.size, 10);
});

test("every oracle outcome is reachable and says what it means", () => {
  const kinds = { 1: "yes_and", 2: "yes", 4: "yes_but", 6: "roll", 8: "no", 10: "no_and" };
  for (const [d10, kind] of Object.entries(kinds)) {
    const s = rigged(tapeFor([+d10]));
    // consume the two draws newState-free path: rigged() already made a state;
    // its tape cursor starts at 0, but thread creation consumed draws from the
    // fresh tape, not this one, because we replaced s.random afterwards.
    const out = dispatch(s, { type: "ask", action: "I leap the chasm." });
    assert.equal(out.outcome, kind, `d10=${d10}`);
  }
});

test("posting to the story is silent: no oracle reply is added", () => {
  const s = rigged(tapeFor([]));
  const before = observe(s).thread.messages.length;
  const out = dispatch(s, { type: "post", text: "Rain over the marsh. I walk on." });
  assert.equal(out.answered, false);
  const msgs = observe(s).thread.messages;
  assert.equal(msgs.length, before + 1);
  assert.equal(msgs[msgs.length - 1].kind, "journal");
});

test("a roll outcome sets a pending check, and any check settles it", () => {
  const s = rigged(tapeFor([6])); // d10 = 6 -> roll for it
  const out = dispatch(s, { type: "ask", action: "I pick the lock." });
  assert.equal(out.outcome, "roll");
  assert.ok(out.pendingCheck);
  assert.ok(DICE.includes(out.pendingCheck.die));
  assert.ok(DIFFICULTIES.includes(out.pendingCheck.difficulty));
  assert.equal(out.pendingCheck.target, TARGETS[out.pendingCheck.die][out.pendingCheck.difficulty]);
  const check = dispatch(s, { type: "check", skill: "Lockpicking", bonus: 2 });
  assert.equal(typeof check.success, "boolean");
  assert.equal(observe(s).thread.pendingCheck, null);
});

test("a prescribed roll is enforced: the oracle's die and difficulty cannot be swapped", () => {
  const s = rigged(tapeFor([6])); // d10 = 6 -> roll for it
  const out = dispatch(s, { type: "ask", action: "I pick the lock." });
  assert.equal(out.outcome, "roll");
  const p = out.pendingCheck;
  const otherDiff = p.difficulty === "easy" ? "hard" : "easy";
  const otherDie = p.die === 20 ? 6 : 20;
  assert.throws(
    () => dispatch(s, { type: "check", skill: "Lockpicking", bonus: 0, die: p.die, difficulty: otherDiff }),
    /prescribed/);
  assert.throws(
    () => dispatch(s, { type: "check", skill: "Lockpicking", bonus: 0, die: otherDie, difficulty: p.difficulty }),
    /prescribed/);
  // the rejected attempts did not consume or settle the pending roll
  assert.ok(observe(s).thread.pendingCheck);
  // restating the prescription exactly is fine, and so is omitting it
  const check = dispatch(s, { type: "check", skill: "Lockpicking", bonus: 0, die: p.die, difficulty: p.difficulty });
  assert.equal(typeof check.success, "boolean");
  assert.equal(observe(s).thread.pendingCheck, null);
});

test("a pending roll cannot be dodged by asking the question again", () => {
  const s = rigged(tapeFor([6, 2])); // ask -> roll for it; the next question would draw a fresh verdict
  const out = dispatch(s, { type: "ask", action: "I pick the lock." });
  assert.equal(out.outcome, "roll");
  assert.throws(
    () => dispatch(s, { type: "ask", action: "I pick the lock, but nicely this time." }),
    /waiting on your roll/);
  // the pending roll is untouched and still the only way forward
  assert.ok(observe(s).thread.pendingCheck);
  const check = dispatch(s, { type: "check", skill: "Lockpicking", bonus: 0 });
  assert.equal(typeof check.success, "boolean");
  assert.equal(observe(s).thread.pendingCheck, null);
  // and asking works again once the roll has landed
  const again = dispatch(s, { type: "ask", action: "I try the window." });
  assert.ok(again.outcome);
});

test("a new day cannot dismiss a pending roll either", () => {
  const s = rigged(tapeFor([6]));
  const out = dispatch(s, { type: "ask", action: "I pick the lock." });
  assert.equal(out.outcome, "roll");
  assert.throws(() => dispatch(s, { type: "day" }), /does not dismiss/);
  // placing the counter has its own refusal, not the new-day wording
  assert.throws(() => dispatch(s, { type: "day", day: 9 }), /counter cannot be moved while a roll waits/);
  dispatch(s, { type: "check", skill: "Lockpicking", bonus: 0 });
  const d = dispatch(s, { type: "day" });
  assert.equal(d.day, 1);
});

test("yes/no wording assumes nothing about which answer was hoped for", () => {
  for (const row of YESNO_TABLE) {
    assert.ok(!/hoped|feared/.test(row.text), "desire-laden wording: " + row.text);
  }
  const byKind = Object.fromEntries(YESNO_TABLE.map((r) => [r.kind, r.text]));
  assert.equal(byKind.yes_and, "Yes, and more besides.");
  assert.equal(byKind.no_and, "No, and worse besides.");
});

test("the day counter can be placed on the day the life has actually reached", () => {
  const s = rigged(tapeFor([]));
  dispatch(s, { type: "thread.mode", mode: "life" }); // starts at day 1
  const set = dispatch(s, { type: "day", day: 14 });
  assert.equal(set.day, 14);
  const next = dispatch(s, { type: "day" });
  assert.equal(next.day, 15);
  assert.ok(exportLog(s).includes("—— Day 14 ——"));
  assert.throws(() => dispatch(s, { type: "day", day: 0 }), /positive whole number/);
});

test("the day counter: a life starts on day 1, dawns advance it, the log marks it", () => {
  const s = rigged(tapeFor([]));
  assert.equal(observe(s).thread.day, null);
  const on = dispatch(s, { type: "thread.mode", mode: "life" });
  assert.equal(on.day, 1);
  const d2 = dispatch(s, { type: "day" });
  assert.equal(d2.day, 2);
  const d3 = dispatch(s, { type: "day" });
  assert.equal(d3.day, 3);
  const log = exportLog(s);
  assert.ok(log.includes("—— Day 2 ——"), "log marks the dawn of day 2");
  assert.ok(log.includes("—— Day 3 ——"), "log marks the dawn of day 3");
});

test("check math: total vs target decides, edges included", () => {
  // Force die rolls by choosing a big die and reading the verdict fields.
  const s = rigged(tapeFor([]));
  const out = dispatch(s, { type: "check", skill: "Climbing", bonus: 0, die: 20, difficulty: "moderate" });
  assert.equal(out.target, 11);
  assert.equal(out.total, out.roll);
  assert.equal(out.success, out.total >= 11);
  // Table sanity: moderate is the midpoint for every die.
  for (const d of DICE) {
    assert.equal(TARGETS[d].moderate, Math.floor(d / 2) + 1, "d" + d);
    assert.ok(TARGETS[d].easy < TARGETS[d].moderate && TARGETS[d].moderate < TARGETS[d].hard);
  }
});

test("threads are isolated and deletable, and the active thread falls back", () => {
  const s = rigged(tapeFor([]));
  const a = observe(s).thread.id;
  dispatch(s, { type: "post", text: "Story A entry." });
  const { threadId: b } = dispatch(s, { type: "thread.create", title: "Story B" });
  dispatch(s, { type: "post", text: "Story B entry." });
  const ta = observe(s, a).thread, tb = observe(s, b).thread;
  assert.ok(ta.messages.some((m) => m.text.includes("Story A")));
  assert.ok(!ta.messages.some((m) => m.text.includes("Story B")));
  assert.ok(tb.messages.some((m) => m.text.includes("Story B")));
  dispatch(s, { type: "thread.delete", threadId: b });
  assert.equal(observe(s).thread.id, a);
});

test("save/resume preserves the upcoming tape (no reroll on reload)", () => {
  const s1 = rigged(tapeFor([2, 9, 9, 9]));
  const saved = exportSave(s1);
  const s2 = importSave(saved);
  const r1 = dispatch(s1, { type: "ask", action: "First question." });
  const r2 = dispatch(s2, { type: "ask", action: "First question." });
  assert.equal(r1.outcome, r2.outcome);
  assert.equal(r1.message.d10, r2.message.d10);
});

test("corrupted saves reject", () => {
  const s = rigged(tapeFor([]));
  const good = exportSave(s);
  const bad = good.replace("My first story", "My first stori");
  assert.throws(() => importSave(bad), /corrupted/);
});

test("idempotent commands: repeat does not reapply, conflicts and stale revisions reject", () => {
  const s = rigged(tapeFor([]));
  const cmd = { id: "c1", expectedRevision: s.revision, type: "post", text: "Once only." };
  applyCommand(s, cmd);
  const n = observe(s).thread.messages.length;
  const dup = applyCommand(s, cmd);
  assert.equal(dup.duplicate, true);
  assert.equal(observe(s).thread.messages.length, n);
  assert.throws(() => applyCommand(s, { id: "c1", type: "post", text: "Different." }), /Conflicting/);
  assert.throws(() => applyCommand(s, { id: "c2", expectedRevision: 999, type: "post", text: "x" }), /Stale/);
});

test("invalid actions leave state untouched", () => {
  const s = rigged(tapeFor([]));
  const before = exportSave(s);
  assert.throws(() => dispatch(s, { type: "post", text: "   " }), /empty/);
  assert.throws(() => dispatch(s, { type: "check", skill: "X", bonus: 0, die: 7, difficulty: "easy" }), /die/);
  assert.throws(() => dispatch(s, { type: "check", skill: "X", bonus: 0, die: 20, difficulty: "deadly" }), /difficulty/);
  assert.equal(exportSave(s), before);
});

test("log renders the whole thread readably", () => {
  const s = rigged(tapeFor([3]));
  dispatch(s, { type: "post", text: "I enter the flooded chapel." });
  dispatch(s, { type: "ask", action: "I swim to the altar." });
  const log = exportLog(s);
  assert.match(log, /# My first story/);
  assert.match(log, /You: I enter the flooded chapel\./);
  assert.match(log, /DM: Yes, your character succeeds\./);
});

test("a thread exports and imports into another save intact, under a fresh id", () => {
  const s1 = rigged(tapeFor([6]));
  dispatch(s1, { type: "post", text: "A portable tale begins." });
  dispatch(s1, { type: "ask", action: "I test the door's lock." }); // roll outcome -> pending check
  const sourceId = observe(s1).thread.id;
  const file = exportThread(s1, sourceId);

  const s2 = rigged(tapeFor([]));
  const { threadId } = importThread(s2, file);
  assert.notEqual(threadId, sourceId);
  const imported = observe(s2, threadId).thread;
  const original = observe(s1, sourceId).thread;
  assert.equal(imported.title, original.title);
  assert.deepEqual(imported.messages, original.messages);
  assert.deepEqual(imported.pendingCheck, original.pendingCheck);
  assert.equal(observe(s2).threads.length, 2); // original thread + import coexist

  const tampered = file.replace("portable tale", "portable fale");
  assert.throws(() => importThread(s2, tampered), /corrupted/);
  assert.throws(() => importThread(s2, "{\"nope\":true}"), /corrupted/);
});

test("exportAllLogs covers every thread with verdicts and dice results", () => {
  const s = rigged(tapeFor([3]));
  dispatch(s, { type: "post", text: "Alpha thread entry." });
  dispatch(s, { type: "ask", action: "I knock twice." });
  dispatch(s, { type: "check", skill: "Nerve", bonus: 1, die: 20, difficulty: "easy" });
  const { threadId: b } = dispatch(s, { type: "thread.create", title: "Story B" });
  dispatch(s, { type: "post", text: "Beta thread entry." });
  const all = exportAllLogs(s);
  assert.match(all, /# My first story/);
  assert.match(all, /# Story B/);
  assert.match(all, /Alpha thread entry\./);
  assert.match(all, /Beta thread entry\./);
  assert.match(all, /DM: Yes, your character succeeds\./);
  assert.match(all, /DM: Rolled \d+ \+ 1 = \d+ against target 9\./);
});

test("bonuses toggle off: the die alone faces the target", () => {
  const s = rigged(tapeFor([]));
  dispatch(s, { type: "settings", useBonuses: false });
  const out = dispatch(s, { type: "check", skill: "Climbing", bonus: 5, die: 20, difficulty: "moderate" });
  assert.equal(out.total, out.roll);
  assert.match(out.message.text, /\(bonuses off\)/);
  dispatch(s, { type: "settings", useBonuses: true });
  const on = dispatch(s, { type: "check", skill: "Climbing", bonus: 5, die: 20, difficulty: "moderate" });
  assert.equal(on.total, on.roll + 5);
});

test("a defined character's sheet supplies the bonus and gates the skills", () => {
  const s = rigged(tapeFor([]));
  dispatch(s, { type: "character.define", name: "Wren", skills: { Rivercraft: 2, Nerve: -1 } });
  assert.throws(
    () => dispatch(s, { type: "check", skill: "Stealth", die: 20, difficulty: "easy" }),
    /Pick a skill from Wren's sheet: Rivercraft, Nerve/,
  );
  const out = dispatch(s, { type: "check", skill: "Rivercraft", bonus: 99, die: 20, difficulty: "moderate" });
  assert.equal(out.total, out.roll + 2); // caller bonus ignored; sheet wins
  const neg = dispatch(s, { type: "check", skill: "Nerve", die: 20, difficulty: "moderate" });
  assert.equal(neg.total, neg.roll - 1);
});

test("blessings: gated on success, granted by the DM, spent on the next roll of that skill", () => {
  const s = newState();
  s.random = replayRandom([0.25, 0.75, 0.1, 0.5, 0.5, ...Array(600).fill(0.42)]);
  dispatch(s, { type: "character.define", name: "Wren", skills: { Nerve: 1 } });
  // Gate: no success yet -> decline, and no die is consumed (next draw stays 0.25)
  const gated = dispatch(s, { type: "boon" });
  assert.equal(gated.granted, false);
  // Succeed at an ask (d10 draw 0.25 -> 3 -> yes)
  const ask = dispatch(s, { type: "ask", action: "I hold my nerve at the rail." });
  assert.equal(ask.outcome, "yes");
  // Boon roll d6 draw 0.75 -> 5 -> granted; single candidate, pick draw 0.1
  const boon = dispatch(s, { type: "boon" });
  assert.equal(boon.granted, true);
  assert.equal(boon.skill, "Nerve");
  assert.equal(observe(s).thread.pendingBoons.Nerve, 1);
  // Next Nerve check (draw 0.5 -> roll 11) carries sheet +1 and blessing +1
  const blessed = dispatch(s, { type: "check", skill: "Nerve", die: 20, difficulty: "moderate" });
  assert.equal(blessed.roll, 11);
  assert.equal(blessed.total, 13);
  assert.equal(observe(s).thread.pendingBoons.Nerve, undefined); // spent
  // The roll after that is back to the sheet alone
  const plain = dispatch(s, { type: "check", skill: "Nerve", die: 20, difficulty: "moderate" });
  assert.equal(plain.total, plain.roll + 1);
});

test("a blessing ask spends the success it followed: one ask per success", () => {
  const s = newState();
  // draws in order: ask d10 0.25 -> 3 (yes); boon d6 0.1 -> 1 (declined);
  // second ask d10 0.25 -> 3 (yes); boon d6 0.75 -> 5 (granted); pick 0.1
  s.random = replayRandom([0.25, 0.1, 0.25, 0.75, 0.1, ...Array(600).fill(0.42)]);
  dispatch(s, { type: "character.define", name: "Wren", skills: { Nerve: 1 } });
  const ask = dispatch(s, { type: "ask", action: "I hold my nerve at the rail." });
  assert.equal(ask.outcome, "yes");
  const declined = dispatch(s, { type: "boon" }); // d6 = 1: the moment passes
  assert.equal(declined.granted, false);
  // The success is spent even though nothing was granted: a second ask is gated.
  const begged = dispatch(s, { type: "boon" });
  assert.equal(begged.granted, false);
  assert.match(begged.message.text, /last outcome was not one/);
  // A fresh success earns a fresh ask.
  const ask2 = dispatch(s, { type: "ask", action: "I hold my nerve again." });
  assert.equal(ask2.outcome, "yes");
  const granted = dispatch(s, { type: "boon" }); // d6 draw 0.75 -> granted
  assert.equal(granted.granted, true);
  // And a grant spends it too.
  const begged2 = dispatch(s, { type: "boon" });
  assert.equal(begged2.granted, false);
});

test("a blessing belongs to the day of the deed: it expires at dawn", () => {
  const s = newState();
  // draws: ask d10 0.25 -> 3 (yes); second ask d10 0.25 -> 3 (yes);
  // boon d6 0.75 -> 5 (granted); candidate pick 0.1
  s.random = replayRandom([0.25, 0.25, 0.75, 0.1, ...Array(600).fill(0.42)]);
  dispatch(s, { type: "character.define", name: "Wren", skills: { Nerve: 1 } });
  dispatch(s, { type: "thread.mode", mode: "life" }); // day 1
  const ask = dispatch(s, { type: "ask", action: "I hold my nerve at the rail." });
  assert.equal(ask.outcome, "yes");
  dispatch(s, { type: "day" }); // dawn of day 2; no roll is pending
  const expired = dispatch(s, { type: "boon" });
  assert.equal(expired.granted, false);
  assert.match(expired.message.text, /moment has passed/);
  // A fresh success on day 2 can still be blessed the same day.
  const ask2 = dispatch(s, { type: "ask", action: "I hold my nerve again." });
  assert.equal(ask2.outcome, "yes");
  const granted = dispatch(s, { type: "boon" });
  assert.equal(granted.granted, true);
  assert.equal(granted.skill, "Nerve");
});

test("a spent blessing carries the day it was spent on", () => {
  const s = newState();
  // draws: ask d10 0.25 -> 3 (yes); boon d6 0.1 -> 1 (declined, but spent)
  s.random = replayRandom([0.25, 0.1, ...Array(600).fill(0.42)]);
  dispatch(s, { type: "character.define", name: "Wren", skills: { Nerve: 1 } });
  dispatch(s, { type: "thread.mode", mode: "life" }); // day 1
  const ask = dispatch(s, { type: "ask", action: "I hold my nerve at the rail." });
  assert.equal(ask.outcome, "yes");
  const spent = dispatch(s, { type: "boon" });
  assert.equal(spent.granted, false);
  // The outcome that replaced the success is stamped with day 1, so a
  // later dawn can tell "spent today" from "the moment has passed".
  const lo = observe(s).thread.lastOutcome;
  assert.equal(lo.kind, "boon");
  assert.equal(lo.success, false);
  assert.equal(lo.day, 1);
});

test("a blessing ask with nothing to bless does not spend the success", () => {
  const s = newState();
  // draws in order: ask d10 0.25 -> 3 (yes); boon d6 0.75 -> 5 (granted);
  // candidate pick 0.1. The nothing-to-bless decline between them draws none.
  s.random = replayRandom([0.25, 0.75, 0.1, ...Array(600).fill(0.42)]);
  const ask = dispatch(s, { type: "ask", action: "I hold my nerve at the rail." });
  assert.equal(ask.outcome, "yes");
  // No character defined and no skill ever rolled: nothing to bless.
  const declined = dispatch(s, { type: "boon" });
  assert.equal(declined.granted, false);
  assert.match(declined.message.text, /no skill to bless yet/);
  assert.equal(s.random.cursor, 1); // the decline drew nothing
  // The moment was inapplicable, not refused by fortune: the success stands.
  const lo = observe(s).thread.lastOutcome;
  assert.equal(lo.kind, "oracle");
  assert.equal(lo.success, true);
  // Define a character, and that same success can still carry a blessing.
  dispatch(s, { type: "character.define", name: "Wren", skills: { Nerve: 1 } });
  const granted = dispatch(s, { type: "boon" });
  assert.equal(granted.granted, true);
  assert.equal(granted.skill, "Nerve");
});

test("a natural 1 always fails, whatever stands behind the roll", () => {
  // the bonus alone would carry it: 1 + 5 = 6 against an easy target of 3
  const s = rigged([0.05, ...Array(600).fill(0.42)]);
  const out = dispatch(s, { type: "check", skill: "Climbing", bonus: 5, die: 6, difficulty: "easy" });
  assert.equal(out.roll, 1);
  assert.equal(out.total, 6);
  assert.equal(out.success, false);
  assert.match(out.message.text, /no skill carries that/);
  assert.match(out.message.text, /complication follows/);
  // a failure is not a success: the blessing gate stays shut
  assert.equal(dispatch(s, { type: "boon" }).granted, false);
});

test("a blessing is spent by the roll that touches it, even a natural 1", () => {
  const s = rigged([0.05, ...Array(600).fill(0.42)]);
  dispatch(s, { type: "character.define", name: "Wren", skills: { Climbing: 3 } });
  s.threads[s.activeThreadId].pendingBoons.Climbing = 1;
  const out = dispatch(s, { type: "check", skill: "Climbing", die: 6, difficulty: "easy" });
  // 1 + 3 (sheet) + 1 (blessing) = 5 >= 3, but the die came up 1
  assert.equal(out.roll, 1);
  assert.equal(out.total, 5);
  assert.equal(out.success, false);
  assert.equal(observe(s).thread.pendingBoons.Climbing, undefined);
});

test("a natural maximum succeeds extraordinarily even when the total falls short", () => {
  const s = rigged([0.9, ...Array(600).fill(0.42)]);
  const out = dispatch(s, { type: "check", skill: "Climbing", bonus: -2, die: 4, difficulty: "hard" });
  assert.equal(out.roll, 4);
  assert.equal(out.total, 2); // the hard target is 4
  assert.equal(out.success, true);
  assert.match(out.message.text, /extraordinary success/);
});

test("ordinary checks still turn on the total", () => {
  const pass = rigged([0.4, ...Array(600).fill(0.42)]); // d6 -> 3
  const p = dispatch(pass, { type: "check", skill: "Climbing", bonus: 1, die: 6, difficulty: "moderate" });
  assert.equal(p.total, 4); // the moderate target is 4
  assert.equal(p.success, true);
  const fail = rigged([0.2, ...Array(600).fill(0.42)]); // d6 -> 2
  const f = dispatch(fail, { type: "check", skill: "Climbing", bonus: 0, die: 6, difficulty: "moderate" });
  assert.equal(f.total, 2);
  assert.equal(f.success, false);
});

test("an unstamped success from before day stamps counts as passed in a counted life", () => {
  const s = rigged(tapeFor([]));
  dispatch(s, { type: "thread.mode", mode: "life" }); // day 1, counter running
  // a pre-1.12 outcome: a success carrying no day stamp at all
  s.threads[s.activeThreadId].lastOutcome = { kind: "oracle", outcome: "yes", success: true };
  const out = dispatch(s, { type: "boon" });
  assert.equal(out.granted, false);
  assert.match(out.message.text, /moment has passed/);
  // but in a story — no life, no counter — an unstamped success is just a success
  const s2 = newState();
  s2.random = replayRandom([0.75, 0.1, ...Array(600).fill(0.42)]);
  dispatch(s2, { type: "character.define", name: "Wren", skills: { Nerve: 1 } });
  s2.threads[s2.activeThreadId].lastOutcome = { kind: "oracle", outcome: "yes", success: true };
  const granted = dispatch(s2, { type: "boon" }); // d6 draw 0.75 -> granted
  assert.equal(granted.granted, true);
  assert.equal(granted.skill, "Nerve");
});

test("yes/no questions answer about the world on a d6, all six faces", () => {
  const kinds = ["no_and", "no", "no_but", "yes_but", "yes", "yes_and"];
  for (let r = 1; r <= 6; r++) {
    const s = newState();
    s.random = replayRandom([(r - 0.5) / 6, ...Array(50).fill(0.42)]);
    const out = dispatch(s, { type: "yn", question: "Is the bridge guarded?" });
    assert.equal(out.outcome, kinds[r - 1], "d6=" + r);
    // A world answer is not a character success: the blessing gate stays shut.
    assert.equal(dispatch(s, { type: "boon" }).granted, false);
  }
});

test("weighted yes/no questions shift one step, declared before the roll", () => {
  const kinds = ["no_and", "no", "no_but", "yes_but", "yes", "yes_and"];
  const bareSaid = {
    no_and: "No, and worse besides", no: "No", no_but: "No, though not completely",
    yes_but: "Yes, though not completely", yes: "Yes", yes_and: "Yes, and more besides",
  };
  for (let r = 1; r <= 6; r++) {
    for (const [weigh, idx] of [["likely", Math.min(5, r)], ["unlikely", Math.max(0, r - 2)]]) {
      const s = newState();
      s.random = replayRandom([(r - 0.5) / 6, ...Array(50).fill(0.42)]);
      const out = dispatch(s, { type: "yn", question: "Has her hand healed?", weigh });
      assert.equal(out.outcome, kinds[idx], `d6=${r} asked as ${weigh}`);
      assert.equal(out.bareOutcome, kinds[r - 1]);
      // The answer names the lean and what the bare die would have said.
      assert.ok(out.answer.includes(`(Asked as ${weigh};`), out.answer);
      assert.ok(out.answer.includes(`the bare die said ${bareSaid[kinds[r - 1]]}.)`), out.answer);
      assert.equal(out.message.weigh, weigh);
    }
    // Unweighted faces are exactly what they were before weighing existed.
    const s = newState();
    s.random = replayRandom([(r - 0.5) / 6, ...Array(50).fill(0.42)]);
    const plain = dispatch(s, { type: "yn", question: "Is the bridge guarded?" });
    assert.equal(plain.outcome, kinds[r - 1], "unweighted d6=" + r);
    assert.equal(plain.answer, YESNO_TABLE[r - 1].text);
    assert.ok(!("weigh" in plain.message));
  }
  // A lean that is neither likely nor unlikely is refused, not rolled.
  const s = rigged(tapeFor([]));
  assert.throws(() => dispatch(s, { type: "yn", question: "Is it so?", weigh: "maybe" }), /Weigh must be/);
});

test("a weighed question carries its lean on the question side of the record", () => {
  const s = rigged(tapeFor([]));
  dispatch(s, { type: "yn", question: "Has her hand healed?", weigh: "likely" });
  const asked = observe(s).thread.messages.find((m) => m.kind === "question" && m.mode === "yn");
  assert.equal(asked.weigh, "likely");
  // The lean is a meta field; the question's own words are untouched.
  assert.equal(asked.text, "Has her hand healed?");
  // The log shows how the question was asked, not only how it was answered.
  assert.match(exportLog(s), /You: Has her hand healed\? \(asked as likely\)/);
  // An unweighed question records nothing and logs plainly.
  dispatch(s, { type: "yn", question: "Is the bridge guarded?" });
  const plain = observe(s).thread.messages.filter((m) => m.kind === "question").pop();
  assert.ok(!("weigh" in plain));
  assert.match(exportLog(s), /You: Is the bridge guarded\?\n/);
});

test("a 1.14-era weighed question recovers its lean from its answer on load", () => {
  const s = rigged(tapeFor([]));
  dispatch(s, { type: "yn", question: "Has her hand healed?", weigh: "likely" });
  dispatch(s, { type: "yn", question: "Is the bridge guarded?" });
  // Strip the question-side lean back off, the way 1.14 wrote the record:
  // the shift lived only in the DM's answer text.
  const file = JSON.parse(exportSave(s));
  for (const t of Object.values(file.threads)) {
    for (const m of t.messages) {
      if (m.kind === "question") delete m.weigh;
    }
  }
  const { checksum: _drop, ...body } = file;
  const oldFile = JSON.stringify({ ...body, checksum: checksumOf(body) }, null, 2);
  const loaded = importSave(oldFile);
  const asked = observe(loaded).thread.messages.find((m) => m.kind === "question" && m.mode === "yn");
  assert.equal(asked.weigh, "likely");
  // The whole log now suffixes consistently, old questions included.
  assert.match(exportLog(loaded), /You: Has her hand healed\? \(asked as likely\)/);
  // The unweighed pair beside it is untouched.
  const plain = observe(loaded).thread.messages.filter((m) => m.kind === "question").pop();
  assert.ok(!("weigh" in plain));
});

test("inspiration tables answer simply, and how-many rolls the chosen die", () => {
  const s = rigged(tapeFor([]));
  for (const table of ["monster", "class", "species", "quest"]) {
    const out = dispatch(s, { type: "inspire", table });
    assert.ok(INSPIRE_TABLES[table].includes(out.entry), table);
    assert.ok(out.message.text.startsWith(table[0].toUpperCase() + table.slice(1) + ": "));
  }
  assert.throws(() => dispatch(s, { type: "inspire", table: "weather" }), /inspiration table/);
  const hm = dispatch(s, { type: "howmany", thing: "goblins in the cave", die: 6 });
  assert.ok(hm.roll >= 1 && hm.roll <= 6);
  assert.match(hm.message.text, /Rolled on a d6/);
});

test("a 1.1-era save (no settings/character fields) loads with defaults", () => {
  const s = rigged(tapeFor([]));
  dispatch(s, { type: "post", text: "An old entry." });
  const stripped = JSON.parse(exportSave(s));
  delete stripped.settings;
  for (const t of Object.values(stripped.threads)) {
    delete t.character; delete t.pendingBoons; delete t.lastOutcome; delete t.lastSkill;
  }
  // Re-checksum the stripped shape the way the old version would have written it
  const { checksum: _drop, ...body } = stripped;
  const oldFile = JSON.stringify({ ...body, checksum: checksumOf(body) }, null, 2);
  const loaded = importSave(oldFile);
  assert.equal(observe(loaded).settings.useBonuses, true);
  assert.equal(observe(loaded).thread.character, null);
  assert.ok(observe(loaded).thread.messages.some((m) => m.text.includes("An old entry.")));
});

test("life mode marks a thread, validates, and labels its log", () => {
  const s = rigged(tapeFor([]));
  assert.equal(observe(s).thread.mode, "story");
  const out = dispatch(s, { type: "thread.mode", mode: "life" });
  assert.equal(out.mode, "life");
  assert.equal(observe(s).thread.mode, "life");
  assert.match(exportLog(s), /A life, lived in Quiet DM/);
  assert.throws(() => dispatch(s, { type: "thread.mode", mode: "campaign" }), /Mode must be/);
  dispatch(s, { type: "thread.mode", mode: "story" });
  assert.doesNotMatch(exportLog(s), /A life, lived/);
});

test("classic browser bundle matches the headless core", () => {
  const bundle = fs.readFileSync(new URL("../engine.js", import.meta.url), "utf8");
  const sandbox = { window: {}, crypto: globalThis.crypto };
  vm.createContext(sandbox);
  vm.runInContext(bundle, sandbox);
  const B = sandbox.window.QuietDM;
  assert.ok(B && typeof B.newState === "function");
  for (const fn of ["exportThread", "importThread", "exportAllLogs", "exportSave", "importSave"]) {
    assert.equal(typeof B[fn], "function", "bundle exposes " + fn);
  }
  assert.ok(Array.isArray(B.YESNO_TABLE) && B.YESNO_TABLE.length === 6);
  assert.ok(Object.keys(B.INSPIRE_TABLES).length === 4);
  for (const d of DICE) assert.equal(B.canonical(B.TARGETS[d]), B.canonical(TARGETS[d]));
  const bs = B.newState();
  bs.random = B.replayRandom(tapeFor([10]));
  const out = B.dispatch(bs, { type: "ask", action: "I charge the gate." });
  assert.equal(out.outcome, "no_and");
});
