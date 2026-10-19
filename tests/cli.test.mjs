import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const cli = path.join(root, "cli.mjs");

function run(args, expectFail = false) {
  try {
    const out = execFileSync("node", [cli, ...args], { encoding: "utf8" });
    return { code: 0, out };
  } catch (e) {
    if (!expectFail) throw e;
    return { code: e.status, out: e.stdout?.toString() ?? "" };
  }
}

test("separate-process CLI can create, journal silently, ask, check and log", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "quiet-dm-"));
  const save = path.join(dir, "save.json");
  const created = JSON.parse(run(["new", save, "The Drowned Bell"]).out);
  assert.equal(created.thread.title, "The Drowned Bell");
  const noteCount = created.thread.messages.length;

  const posted = JSON.parse(run(["post", save, "Water to my knees. The bell rope is just ahead."]).out);
  assert.equal(posted.answered, false);

  const look = JSON.parse(run(["look", save]).out);
  assert.equal(look.thread.messages.length, noteCount + 1);

  const asked = JSON.parse(run(["ask", save, "I grab the bell rope and haul."]).out);
  assert.ok(["yes_and", "yes", "yes_but", "roll", "no", "no_and"].includes(asked.outcome));

  // If the oracle prescribed a roll, settle it exactly as prescribed first:
  // since 1.7 the engine refuses any other die or difficulty (and so it
  // should), so a fixed d20/moderate here would be a coin-flip failure.
  const pending = JSON.parse(run(["look", save]).out).thread.pendingCheck;
  if (pending) {
    const settled = JSON.parse(run(["check", save, "Strength", "2", String(pending.die), pending.difficulty]).out);
    assert.equal(settled.target, pending.target);
  }

  const checked = JSON.parse(run(["check", save, "Strength", "2", "20", "moderate"]).out);
  assert.equal(checked.target, 11);
  assert.equal(checked.success, checked.total >= 11);

  const log = run(["log", save]).out;
  assert.match(log, /# The Drowned Bell/);
  assert.match(log, /Water to my knees/);
  assert.match(log, /DM: Rolled \d+ \+ 2 = \d+ against target 11/);

  // idempotent command file through the CLI
  const cmdFile = path.join(dir, "cmd.json");
  const lookNow = JSON.parse(run(["look", save]).out);
  fs.writeFileSync(cmdFile, JSON.stringify({
    id: "cli-1", expectedRevision: lookNow.revision,
    type: "post", text: "The bell tolls under the water.",
  }));
  run(["command", save, cmdFile]);
  const again = JSON.parse(run(["command", save, cmdFile]).out);
  assert.equal(again.duplicate, true);
  const final = JSON.parse(run(["look", save]).out);
  const occurrences = final.thread.messages.filter((m) => m.text.includes("bell tolls")).length;
  assert.equal(occurrences, 1);
});

test("CLI moves threads between saves, exports all logs, and deletes threads", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "quiet-dm-"));
  const a = path.join(dir, "a.json");
  const b = path.join(dir, "b.json");
  const threadFile = path.join(dir, "moved.thread.json");
  run(["new", a, "Portable Story"]);
  run(["post", a, "This tale travels."]);
  const lookA = JSON.parse(run(["look", a]).out);
  const tid = lookA.thread.id;

  run(["export-thread", a, tid, threadFile]);
  run(["new", b, "Home Save"]);
  const imported = JSON.parse(run(["import-thread", b, threadFile]).out);
  assert.ok(imported.threadId);
  const lookB = JSON.parse(run(["look", b, imported.threadId]).out);
  assert.equal(lookB.thread.title, "Portable Story");
  assert.ok(lookB.thread.messages.some((m) => m.text.includes("This tale travels.")));

  const all = run(["logall", b]).out;
  assert.match(all, /# Home Save/);
  assert.match(all, /# Portable Story/);

  run(["delete", b, imported.threadId]);
  const after = JSON.parse(run(["threads", b]).out);
  assert.equal(after.length, 1);
  assert.equal(after[0].title, "Home Save");
});

test("CLI drives the new tables, yes/no, how-many, character sheet and the bonus toggle", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "quiet-dm-"));
  const save = path.join(dir, "save.json");
  run(["new", save, "Feature Walk"]);

  const yn = JSON.parse(run(["yn", save, "Is the pass snowed in?"]).out);
  assert.ok(["no_and", "no", "no_but", "yes_but", "yes", "yes_and"].includes(yn.outcome));
  const hm = JSON.parse(run(["howmany", save, "wolves on the ridge", "6"]).out);
  assert.ok(hm.roll >= 1 && hm.roll <= 6);
  for (const table of ["monster", "class", "species", "quest"]) {
    const ins = JSON.parse(run(["inspire", save, table]).out);
    assert.equal(ins.table, table);
    assert.ok(ins.entry.length > 0);
  }

  run(["character", save, "define", "Wren", "Rivercraft=2", "Nerve=1"]);
  const shown = JSON.parse(run(["character", save, "show"]).out);
  assert.equal(shown.name, "Wren");
  assert.equal(shown.skills.Rivercraft, 2);
  const sheetCheck = JSON.parse(run(["check", save, "Rivercraft", "20", "moderate"]).out);
  assert.equal(sheetCheck.total, sheetCheck.roll + 2);
  const bad = run(["check", save, "Stealth", "20", "easy"], true);
  assert.equal(bad.code, 1);
  assert.match(bad.out, /Pick a skill/);

  JSON.parse(run(["bonus", save, "off"]).out);
  const off = JSON.parse(run(["check", save, "Rivercraft", "20", "moderate"]).out);
  assert.equal(off.total, off.roll);
  run(["bonus", save, "on"]);

  const boon = JSON.parse(run(["boon", save]).out);
  assert.equal(typeof boon.granted, "boolean"); // gate depends on lastOutcome; shape is the contract here

  const life = JSON.parse(run(["life", save]).out);
  assert.equal(life.mode, "life");
  const log = run(["log", save]).out;
  assert.match(log, /A life, lived in Quiet DM/);
  const story = JSON.parse(run(["life", save, "off"]).out);
  assert.equal(story.mode, "story");
});

test("CLI takes a lean by flag or first word, case-insensitively, and logs it", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "quiet-dm-"));
  const save = path.join(dir, "save.json");
  run(["new", save, "Lean Walk"]);

  const flagged = JSON.parse(run(["yn", save, "--likely", "Has her hand healed?"]).out);
  assert.equal(flagged.weigh, "likely");
  const flaggedUpper = JSON.parse(run(["yn", save, "--UNLIKELY", "Is the ford rising?"]).out);
  assert.equal(flaggedUpper.weigh, "unlikely");
  const firstWord = JSON.parse(run(["yn", save, "Likely", "Is the bridge guarded?"]).out);
  assert.equal(firstWord.weigh, "likely");
  // A flag after the question still leans, and the word stays in the prose.
  const trailing = JSON.parse(run(["yn", save, "Is the well dry?", "--unlikely"]).out);
  assert.equal(trailing.weigh, "unlikely");

  const log = run(["log", save]).out;
  assert.match(log, /Has her hand healed\? \(asked as likely\)/);
  assert.match(log, /Is the ford rising\? \(asked as unlikely\)/);
  assert.match(log, /Is the bridge guarded\? \(asked as likely\)/);
  assert.match(log, /Is the well dry\? \(asked as unlikely\)/);
});

test("CLI refuses conflicting leans and unknown flags, rolling nothing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "quiet-dm-"));
  const save = path.join(dir, "save.json");
  run(["new", save, "Refusal Walk"]);
  const before = JSON.parse(run(["look", save]).out);
  const countBefore = before.thread.messages.length;

  const conflict = run(["yn", save, "--likely", "--unlikely", "Is the ford up?"], true);
  assert.equal(conflict.code, 1);
  assert.match(conflict.out, /Conflicting leans/);
  // Case does not rescue a conflict, and flag position does not either.
  const conflictCaps = run(["yn", save, "--LIKELY", "Is the ford up?", "--Unlikely"], true);
  assert.equal(conflictCaps.code, 1);
  assert.match(conflictCaps.out, /Conflicting leans/);

  // A mistyped flag refuses instead of becoming part of the question.
  const typo = run(["yn", save, "--likley", "Is the ford up?"], true);
  assert.equal(typo.code, 1);
  assert.match(JSON.parse(typo.out).error, /Unknown flag "--likley"/);

  // Nothing was rolled and nothing was recorded: the save is untouched.
  const after = JSON.parse(run(["look", save]).out);
  assert.equal(after.thread.messages.length, countBefore);
  assert.equal(after.revision, before.revision);
  const log = run(["log", save]).out;
  assert.doesNotMatch(log, /Is the ford up/);
});

test("CLI refuses to overwrite an existing save and rejects a corrupt one", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "quiet-dm-"));
  const save = path.join(dir, "save.json");
  run(["new", save]);
  const dup = run(["new", save], true);
  assert.equal(dup.code, 1);
  const raw = fs.readFileSync(save, "utf8").replace("My first story", "My first stori");
  fs.writeFileSync(save, raw);
  const bad = run(["look", save], true);
  assert.equal(bad.code, 1);
  assert.match(bad.out, /corrupted/);
});

test("CLI keeps prose dashes as prose and refuses a single-dash lean with a hint", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "quiet-dm-"));
  const save = path.join(dir, "save.json");
  run(["new", save, "Dash Walk"]);

  // A bare "--" is punctuation, not a flag: the question is asked as written.
  const prose = JSON.parse(run(["yn", save, "Is it -- really -- raining?"]).out);
  assert.ok(["no_and", "no", "no_but", "yes_but", "yes", "yes_and"].includes(prose.outcome));
  assert.equal(prose.weigh, undefined);
  const log = run(["log", save]).out;
  assert.match(log, /Is it -- really -- raining\?/);
  assert.doesNotMatch(log, /asked as/);

  // One dash is a near-miss the CLI names, with the spelling it meant,
  // and it rolls nothing.
  const before = JSON.parse(run(["look", save]).out);
  const single = run(["yn", save, "-likely", "Is the ford up?"], true);
  assert.equal(single.code, 1);
  assert.match(JSON.parse(single.out).error, /one dash; the lean flags are --likely and --unlikely/);
  const upper = run(["yn", save, "-UNLIKELY", "Is the ford up?"], true);
  assert.equal(upper.code, 1);
  const after = JSON.parse(run(["look", save]).out);
  assert.equal(after.revision, before.revision);
  assert.equal(after.thread.messages.length, before.thread.messages.length);
});

test("a bare or unknown CLI run prints usage to stderr, JSON error on stdout", () => {
  const bare = spawnSync("node", [cli], { encoding: "utf8" });
  assert.equal(bare.status, 1);
  assert.equal(JSON.parse(bare.stdout).error, "No command given");
  assert.match(bare.stderr, /Usage:/);
  assert.match(bare.stderr, /node cli\.mjs new <save\.json>/);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "quiet-dm-"));
  const save = path.join(dir, "save.json");
  run(["new", save, "Usage Walk"]);
  const unknown = spawnSync("node", [cli, "frobnicate", save], { encoding: "utf8" });
  assert.equal(unknown.status, 1);
  assert.equal(JSON.parse(unknown.stdout).error, "Unknown command: frobnicate");
  assert.match(unknown.stderr, /Usage:/);
});
