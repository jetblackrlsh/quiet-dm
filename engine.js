// Generated from src/engine.mjs by tools/build.mjs. Do not edit by hand.
(function () {
"use strict";
// Quiet DM — core engine.
// A silent dungeon-master oracle for solo narrative play.
// Pure logic: no DOM, no network, no dependencies. Runs in Node and,
// via tools/build.mjs, as a classic script in the browser.

const DICE = [4, 6, 8, 10, 12, 20, 100];

// Target numbers by die and difficulty. Roll + bonus >= target succeeds,
// with two exceptions at the die's extremes: a natural maximum always
// succeeds extraordinarily, and a natural 1 always fails.
// Moderate is always a coin flip for an unbonused roll; easy ~60%, hard ~30%.
const TARGETS = {
  4:   { easy: 2,  moderate: 3,  hard: 4 },
  6:   { easy: 3,  moderate: 4,  hard: 5 },
  8:   { easy: 4,  moderate: 5,  hard: 7 },
  10:  { easy: 5,  moderate: 6,  hard: 8 },
  12:  { easy: 6,  moderate: 7,  hard: 9 },
  20:  { easy: 9,  moderate: 11, hard: 15 },
  100: { easy: 41, moderate: 51, hard: 71 },
};

const DIFFICULTIES = ["easy", "moderate", "hard"];

// The success oracle table, rolled on a d10 drawn from the random tape.
// Yes-family 50%, roll-for-it 20%, no-family 30%.
const ORACLE_TABLE = [
  { min: 1,  max: 1,  kind: "yes_and", text: "Yes, and something extraordinary happens." },
  { min: 2,  max: 3,  kind: "yes",     text: "Yes, your character succeeds." },
  { min: 4,  max: 5,  kind: "yes_but", text: "Yes, but there is a complication." },
  { min: 6,  max: 7,  kind: "roll",    text: "The oracle will not decide this one. Roll for it." },
  { min: 8,  max: 9,  kind: "no",      text: "No, your character fails." },
  { min: 10, max: 10, kind: "no_and",  text: "No, and something worse happens." },
];

// The yes/no table for questions about the world, not about success.
// Rolled on a d6. Symmetric: no-family / yes-family with softened middles.
const YESNO_TABLE = [
  { roll: 1, kind: "no_and",  text: "No, and worse besides." },
  { roll: 2, kind: "no",      text: "No." },
  { roll: 3, kind: "no_but",  text: "No, though not completely." },
  { roll: 4, kind: "yes_but", text: "Yes, though not completely." },
  { roll: 5, kind: "yes",     text: "Yes." },
  { roll: 6, kind: "yes_and", text: "Yes, and more besides." },
];

// Inspiration tables: deliberately simple, basic, fairy-tale fantasy.
const INSPIRE_TABLES = {
  monster: [
    "Goblin", "Orc", "Dragon", "Ancient dragon", "Skeleton", "Zombie",
    "Vampire", "Werewolf", "Ghost", "Troll", "Ogre", "Giant spider",
    "Slime", "Mimic", "Minotaur", "Harpy", "Basilisk", "Griffin",
    "Hydra", "Kraken", "Banshee", "Wraith", "Lich", "Dark knight",
    "Swamp hag", "Stone golem", "Chimera", "Manticore", "Wyvern",
    "Dire wolf", "Hellhound", "Imp", "Cultist", "Bandit chief",
    "Sea serpent", "Living statue", "Giant rat", "Cave bat swarm",
    "Iron golem", "Rat swarm",
  ],
  class: [
    "Fighter", "Wizard", "Rogue", "Cleric", "Ranger", "Bard",
    "Paladin", "Warlock", "Druid", "Barbarian", "Monk", "Sorcerer",
    "Knight", "Alchemist", "Beast hunter", "Sailor",
  ],
  species: [
    "Human", "Elf", "Dwarf", "Halfling", "Orc", "Goblin", "Gnome",
    "Tiefling", "Dragonborn", "Fairy", "Centaur", "Troll",
    "Lizardfolk", "Catfolk", "Merfolk", "Changeling",
  ],
  quest: [
    "Save the princess.", "Slay the dragon.", "Fetch the golden fleece.",
    "Break the witch's curse.", "Rescue the captured miller.",
    "Find the lost crown.", "Steal back the stolen harvest.",
    "Escort the pilgrim to the shrine.", "Light the beacon on the hill.",
    "Recover the sunken bell.", "Win the giant's riddle game.",
    "Carry the letter across the mountains.", "Free the village from the wolves.",
    "Open the door that has no key.", "Bring water to the dry well.",
    "Guard the bridge for one night.", "Find the child lost in the woods.",
    "Return the sword to the lake.", "Wake the sleeping king.",
    "Steal the giant's goose.", "Mend the broken dam before the rains.",
    "Fetch the herb that heals the queen.", "Ring the bell in the drowned tower.",
    "Trade the cow for something wonderful.",
  ],
};

const SUGGEST_DICE = [6, 8, 10, 12, 20];
const TABLE_LABELS = { monster: "Monster", class: "Class", species: "Species", quest: "Quest" };

function canonical(x) {
  if (x === null || typeof x !== "object") return JSON.stringify(x);
  if (Array.isArray(x)) return "[" + x.map(canonical).join(",") + "]";
  return "{" + Object.keys(x).sort().map((k) => JSON.stringify(k) + ":" + canonical(x[k])).join(",") + "}";
}

function checksum(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return ("0000000" + h.toString(16)).slice(-8);
}

const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const setOwn = (o, k, v) => Object.defineProperty(o, k, {value: v, writable: true, enumerable: true, configurable: true});

const clone = (x) => JSON.parse(JSON.stringify(x));
const asBonus = (v) => (Number.isFinite(+v) ? Math.trunc(+v) : 0);

// --- random tape -----------------------------------------------------------
// The tape lives inside the state, so saving and resuming preserves the
// upcoming results: reloading a save can never reroll your fate.

function freshRandom(count = 512) {
  const buf = new Uint32Array(count);
  globalThis.crypto.getRandomValues(buf);
  const values = Array.from(buf, (v) => (v >>> 0) / 4294967296);
  const seed = new Uint32Array(4);
  globalThis.crypto.getRandomValues(seed);
  if (seed.every(x => x === 0)) seed[0] = 1;
  return { kind: "tape", values, cursor: 0, continuation: Array.from(seed) };
}

function replayRandom(values) {
  return { kind: "tape", values: [...values], cursor: 0 };
}

// xoshiro128** continuation. Secure entropy seeds new tapes; legacy tapes
// derive their continuation from their existing bytes, never from fresh entropy.
// This is reproducible gameplay randomness, not a cryptographic secret.
function ensureContinuation(t) {
  if (!t.continuation) {
    const text = canonical(t.values);
    t.continuation = [0, 1, 2, 3].map(i => parseInt(checksum(i + ":" + text), 16));
    if (t.continuation.every(x => x === 0)) t.continuation[0] = 1;
  }
  return t.continuation;
}
function nextWord(s) {
  const rotl = (x, k) => ((x << k) | (x >>> (32 - k))) >>> 0;
  const result = Math.imul(rotl(Math.imul(s[1], 5), 7), 9) >>> 0;
  const t = s[1] << 9;
  s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3];
  s[2] ^= t; s[3] = rotl(s[3], 11);
  for (let i = 0; i < 4; i++) s[i] >>>= 0;
  return result;
}
function draw(state) {
  const t = state.random;
  const continuation = ensureContinuation(t);
  if (t.cursor >= t.values.length) {
    t.values = Array.from({length: 512}, () => nextWord(continuation) / 4294967296);
    t.cursor = 0;
  }
  return t.values[t.cursor++];
}

function rollDie(state, sides) {
  return 1 + Math.floor(draw(state) * sides);
}

function pick(state, arr) {
  return arr[Math.floor(draw(state) * arr.length)];
}

// --- state -----------------------------------------------------------------

function newState() {
  const s = {
    schema: "QuietDM",
    version: 1,
    revision: 0,
    settings: { useBonuses: true },
    threads: {},
    order: [],
    activeThreadId: null,
    random: freshRandom(),
    receipts: [],
  };
  const t = createThreadRaw(s, "My first story");
  s.activeThreadId = t.id;
  appendMessage(s, t, {
    role: "oracle", kind: "note",
    text: "I am a quiet dungeon master. Write your story here as long messages, and I will stay silent. " +
          "When you want an answer, ask whether your character succeeds and I will consult the oracle. " +
          "Sometimes the oracle refuses to decide, and then we roll for it. " +
          "You may also ask me plain yes-or-no questions, ask how many of a thing there are, " +
          "request inspiration, and, after a success, ask for a blessing. " +
          "Know my answers by their shapes: ask, and I judge an attempt, whether you succeed; " +
          "ask yes or no, and I answer what is true, whether something is so; " +
          "ask for inspiration, and I offer what might be there.",
  });
  return s;
}

function createThreadRaw(state, title) {
  let id = "thread-" + Math.floor(draw(state) * 1e9).toString(36) + "-" + state.order.length;
  while (own(state.threads, id)) id += "x";
  const t = {
    id, title: String(title || "Untitled story").slice(0, 120),
    messages: [], pendingCheck: null, seq: 0, mode: "story", day: null,
    character: null, pendingBoons: {}, lastOutcome: null, lastSkill: null,
  };
  state.threads[id] = t;
  state.order.push(id);
  return t;
}

function getThread(state, threadId) {
  const id = threadId || state.activeThreadId;
  if (!own(state.threads, id)) throw new Error("No such thread");
  const t = state.threads[id];
  if (!t || typeof t !== "object") throw new Error("No such thread");
  return t;
}

function appendMessage(state, thread, msg) {
  thread.seq += 1;
  const m = { seq: thread.seq, at: thread.seq, ...msg };
  thread.messages.push(m);
  return m;
}

function normalizeSkills(skills) {
  const out = {};
  for (const [k, v] of Object.entries(skills || {})) {
    const name = String(k).trim().slice(0, 60);
    if (name) setOwn(out, name, asBonus(v));
  }
  return out;
}

const ASKED_AS = /\(Asked as (likely|unlikely); the bare die said /;

// 1.14 wrote the lean only into the DM's answer text; the question-side
// meta field arrived in 1.15. Recover the lean for older records from
// the answer each question is paired with, so a whole log suffixes
// consistently instead of only from the version that happened to write it.
function backfillWeigh(t) {
  const msgs = t.messages;
  for (let i = 0; i + 1 < msgs.length; i++) {
    const q = msgs[i];
    if (q.role !== "you" || q.kind !== "question" || q.mode !== "yn" || q.weigh) continue;
    const a = msgs[i + 1];
    if (a.role !== "oracle" || a.kind !== "yn" || typeof a.text !== "string") continue;
    const m = a.text.match(ASKED_AS);
    if (m) q.weigh = m[1];
  }
}

// Fill in fields older saves predate, so a 1.0/1.1 save loads into 1.2.
function normalizeThread(t) {
  if (t.character === undefined) t.character = null;
  if (!t.pendingBoons) t.pendingBoons = {};
  if (t.lastOutcome === undefined) t.lastOutcome = null;
  if (t.lastSkill === undefined) t.lastSkill = null;
  if (t.pendingCheck === undefined) t.pendingCheck = null;
  if (t.mode !== "life" && t.mode !== "story") t.mode = "story";
  if (t.day === undefined) t.day = null;
  if (!Array.isArray(t.messages)) t.messages = [];
  backfillWeigh(t);
  return t;
}

function normalize(state) {
  ensureContinuation(state.random);
  state.receipts ??= [];
  state.settings = { useBonuses: true, ...(state.settings || {}) };
  for (const t of Object.values(state.threads || {})) normalizeThread(t);
  return state;
}

// --- commands --------------------------------------------------------------

function dispatch(state, command) {
  if (!command || typeof command.type !== "string") throw new Error("Command needs a type");
  const before = state.revision;
  let result;
  switch (command.type) {
    case "settings": {
      if (typeof command.useBonuses === "boolean") state.settings.useBonuses = command.useBonuses;
      result = { settings: clone(state.settings) };
      break;
    }
    case "thread.create": {
      const t = createThreadRaw(state, command.title);
      state.activeThreadId = t.id;
      result = { threadId: t.id };
      break;
    }
    case "thread.rename": {
      const t = getThread(state, command.threadId);
      t.title = String(command.title || t.title).slice(0, 120);
      result = { threadId: t.id };
      break;
    }
    case "thread.delete": {
      const t = getThread(state, command.threadId);
      delete state.threads[t.id];
      state.order = state.order.filter((id) => id !== t.id);
      if (state.activeThreadId === t.id) state.activeThreadId = state.order[0] ?? null;
      result = { deleted: t.id };
      break;
    }
    case "thread.open": {
      const t = getThread(state, command.threadId);
      state.activeThreadId = t.id;
      result = { threadId: t.id };
      break;
    }
    case "thread.mode": {
      const t = getThread(state, command.threadId);
      if (command.mode !== "life" && command.mode !== "story") {
        throw new Error("Mode must be \"life\" or \"story\"");
      }
      t.mode = command.mode;
      if (t.mode === "life" && t.day == null) t.day = 1; // a life begins on its first day
      result = { threadId: t.id, mode: t.mode, day: t.day };
      break;
    }
    case "day": {
      const t = getThread(state, command.threadId);
      if (t.pendingCheck) {
        const p = t.pendingCheck;
        if (command.day != null) {
          // Placing the counter is its own act, with its own refusal.
          throw new Error(`The oracle is still waiting on your roll: a d${p.die} (${p.difficulty}, target ${p.target}). The counter cannot be moved while a roll waits.`);
        }
        throw new Error(`The oracle is still waiting on your roll: a d${p.die} (${p.difficulty}, target ${p.target}). A new day does not dismiss it.`);
      }
      if (command.day != null) {
        // Place the counter where the life actually is (e.g. a life carried
        // over from before the counter existed).
        const n = +command.day;
        if (!Number.isInteger(n) || n < 1) throw new Error("Day must be a positive whole number");
        t.day = n;
      } else {
        t.day = (typeof t.day === "number" ? t.day : 0) + 1;
      }
      appendMessage(state, t, { role: "system", kind: "day", day: t.day, text: `Day ${t.day}` });
      result = { threadId: t.id, day: t.day };
      break;
    }
    case "character.define": {
      const t = getThread(state, command.threadId);
      t.character = {
        name: String(command.name || "Unnamed").slice(0, 60) || "Unnamed",
        skills: normalizeSkills(command.skills),
      };
      result = { character: clone(t.character) };
      break;
    }
    case "character.skill": {
      const t = getThread(state, command.threadId);
      const name = String(command.skill || "").trim().slice(0, 60);
      if (!name) throw new Error("A skill needs a name");
      if (!t.character) t.character = { name: "Unnamed", skills: {} };
      setOwn(t.character.skills, name, asBonus(command.bonus));
      result = { character: clone(t.character) };
      break;
    }
    case "character.remove-skill": {
      const t = getThread(state, command.threadId);
      if (t.character) delete t.character.skills[String(command.skill || "").trim()];
      result = { character: clone(t.character) };
      break;
    }
    case "post": {
      const text = String(command.text ?? "").trim();
      if (!text) throw new Error("A story message cannot be empty");
      const t = getThread(state, command.threadId);
      const m = appendMessage(state, t, { role: "you", kind: "journal", text });
      result = { message: clone(m), answered: false }; // the DM stays silent
      break;
    }
    case "ask": {
      const action = String(command.action ?? "").trim();
      if (!action) throw new Error("Describe the action you are asking about");
      const t = getThread(state, command.threadId);
      if (t.pendingCheck) {
        // A prescribed roll is outstanding; the question cannot be withdrawn
        // by asking it again.
        const p = t.pendingCheck;
        throw new Error(`The oracle is waiting on your roll: a d${p.die} (${p.difficulty}, target ${p.target}). Roll it before asking anything new; world questions stay open while it waits.`);
      }
      appendMessage(state, t, { role: "you", kind: "question", mode: "success", text: action });
      const d10 = rollDie(state, 10);
      const row = ORACLE_TABLE.find((r) => d10 >= r.min && d10 <= r.max);
      if (row.kind === "roll") {
        const die = pick(state, SUGGEST_DICE);
        const difficulty = pick(state, DIFFICULTIES);
        t.pendingCheck = { die, difficulty, target: TARGETS[die][difficulty], action };
        t.lastOutcome = { kind: "oracle", outcome: "roll", success: false, day: t.day ?? null };
        const m = appendMessage(state, t, {
          role: "oracle", kind: "oracle", outcome: row.kind, d10,
          text: row.text + ` Roll a d${die} (${difficulty}, target ${TARGETS[die][difficulty]}). Add your relevant skill bonus, then roll the check.`,
          suggestion: clone(t.pendingCheck),
        });
        result = { message: clone(m), outcome: row.kind, pendingCheck: clone(t.pendingCheck) };
      } else {
        const success = row.kind === "yes" || row.kind === "yes_but" || row.kind === "yes_and";
        t.lastOutcome = { kind: "oracle", outcome: row.kind, success, day: t.day ?? null };
        const m = appendMessage(state, t, {
          role: "oracle", kind: "oracle", outcome: row.kind, d10, text: row.text,
        });
        result = { message: clone(m), outcome: row.kind };
      }
      break;
    }
    case "yn": {
      const question = String(command.question ?? "").trim();
      if (!question) throw new Error("Ask a yes-or-no question");
      // An optional lean, declared in the call before the roll: the answer
      // shifts one step along the ladder, and the answer text states the
      // lean and what the bare die said, so the shift stays auditable.
      // There is no way to apply a lean after the roll.
      const weigh = command.weigh == null ? null : String(command.weigh).toLowerCase();
      if (weigh !== null && weigh !== "likely" && weigh !== "unlikely") {
        throw new Error('Weigh must be "likely" or "unlikely"');
      }
      const t = getThread(state, command.threadId);
      // The lean stands on the question side of the record too, as a meta
      // field beside the untouched words, so the log shows how the
      // question was asked and not only how it was answered.
      appendMessage(state, t, {
        role: "you", kind: "question", mode: "yn",
        ...(weigh ? { weigh } : {}), text: question,
      });
      const d6 = rollDie(state, 6);
      const bare = YESNO_TABLE.find((r) => r.roll === d6);
      let idx = d6 - 1;
      if (weigh === "likely") idx = Math.min(YESNO_TABLE.length - 1, idx + 1);
      else if (weigh === "unlikely") idx = Math.max(0, idx - 1);
      const row = YESNO_TABLE[idx];
      const text = weigh
        ? `${row.text} (Asked as ${weigh}; the bare die said ${bare.text.replace(/\.+$/, "")}.)`
        : row.text;
      const m = appendMessage(state, t, {
        role: "oracle", kind: "yn", outcome: row.kind, d6,
        ...(weigh ? { weigh } : {}), text,
      });
      result = {
        message: clone(m), outcome: row.kind, answer: text, d6,
        ...(weigh ? { weigh, bareOutcome: bare.kind } : {}),
      };
      break;
    }
    case "howmany": {
      const thing = String(command.thing ?? "").trim();
      if (!thing) throw new Error("Say how many of what you are counting");
      const die = command.die != null ? +command.die : 6;
      if (!DICE.includes(die)) throw new Error("Choose a die: " + DICE.join(", "));
      const t = getThread(state, command.threadId);
      appendMessage(state, t, { role: "you", kind: "question", mode: "howmany", text: `How many ${thing}?` });
      const roll = rollDie(state, die);
      const m = appendMessage(state, t, {
        role: "oracle", kind: "howmany", die, roll,
        text: `${roll}. (Rolled on a d${die}.)`,
      });
      result = { message: clone(m), roll, die };
      break;
    }
    case "inspire": {
      const table = String(command.table || "");
      if (!INSPIRE_TABLES[table]) {
        throw new Error("Choose an inspiration table: " + Object.keys(INSPIRE_TABLES).join(", "));
      }
      const t = getThread(state, command.threadId);
      appendMessage(state, t, { role: "you", kind: "question", mode: "inspire", text: `Inspiration: a ${table}, please.` });
      const entry = pick(state, INSPIRE_TABLES[table]);
      const m = appendMessage(state, t, {
        role: "oracle", kind: "inspire", table, entry,
        text: `${TABLE_LABELS[table]}: ${entry}`,
      });
      result = { message: clone(m), table, entry };
      break;
    }
    case "boon": {
      const t = getThread(state, command.threadId);
      appendMessage(state, t, { role: "you", kind: "question", mode: "boon", text: "May I have a blessing for what I just did?" });
      const decline = (text) => {
        const m = appendMessage(state, t, { role: "oracle", kind: "boon", granted: false, text });
        return { message: clone(m), granted: false };
      };
      if (!t.lastOutcome || !t.lastOutcome.success) {
        result = decline("The DM is unmoved. Blessings follow success, and your last outcome was not one.");
        break;
      }
      const lo = t.lastOutcome;
      const staleDay = lo.day != null && t.day != null && lo.day !== t.day;
      // Outcomes recorded before day stamps existed carry no stamp. In a
      // life with a running counter, an unstamped success is not today's.
      const unstamped = lo.day == null && t.mode === "life" && t.day != null;
      if (staleDay || unstamped) {
        // A blessing belongs to the day of the deed; yesterday's grace is spent.
        result = decline("The moment has passed. Blessings belong to the day of the deed; ask on the day of the success.");
        break;
      }
      let candidates = t.character ? Object.keys(t.character.skills) : [];
      if (candidates.length === 0 && t.lastSkill) candidates = [t.lastSkill];
      if (candidates.length === 0) {
        // Nothing to bless is inapplicable, not a refusal by fortune:
        // the moment never engaged, so the success it followed stands
        // unspent and can still carry a blessing once there is a skill.
        result = decline("The DM would grant one, but there is no skill to bless yet. Define a character, or roll a check first.");
        break;
      }
      // The ask itself spends the success it followed: one ask per success,
      // granted or declined. Begging is not a mechanic. The spent outcome
      // carries its day, so "spent" itself ages truthfully past the dawn.
      t.lastOutcome = { kind: "boon", success: false, day: t.day ?? null };
      const d6 = rollDie(state, 6);
      if (d6 <= 3) {
        result = decline("No. The moment passes.");
        break;
      }
      const skill = pick(state, candidates);
      if (own(t.pendingBoons, skill) && t.pendingBoons[skill]) {
        const m = appendMessage(state, t, {
          role: "oracle", kind: "boon", granted: true, skill, d6,
          text: `Yes, but ${skill} already carries a blessing. Blessings do not stack; it holds at +1.`,
        });
        result = { message: clone(m), granted: true, skill, already: true };
      } else {
        setOwn(t.pendingBoons, skill, 1);
        const m = appendMessage(state, t, {
          role: "oracle", kind: "boon", granted: true, skill, d6,
          text: `Yes. The next time you roll ${skill}, add +1.`,
        });
        result = { message: clone(m), granted: true, skill };
      }
      break;
    }
    case "check": {
      const t = getThread(state, command.threadId);
      let skill = String(command.skill ?? "").trim();
      const char = t.character;
      let baseBonus;
      if (char) {
        if (!skill || !own(char.skills, skill)) {
          const list = Object.keys(char.skills);
          throw new Error(list.length
            ? "Pick a skill from " + char.name + "'s sheet: " + list.join(", ")
            : char.name + " has no skills yet. Add one first.");
        }
        baseBonus = char.skills[skill];
      } else {
        if (!skill) skill = "Unnamed skill";
        baseBonus = asBonus(command.bonus);
      }
      const pending = t.pendingCheck;
      const die = command.die != null ? +command.die : pending?.die;
      const difficulty = command.difficulty != null ? String(command.difficulty) : pending?.difficulty;
      if (!DICE.includes(die)) throw new Error("Choose a die: " + DICE.join(", "));
      if (!DIFFICULTIES.includes(difficulty)) throw new Error("Choose a difficulty: " + DIFFICULTIES.join(", "));
      if (pending) {
        // The oracle prescribed this roll; it may not be quietly re-prescribed.
        if (command.die != null && die !== pending.die) {
          throw new Error(`The oracle prescribed a d${pending.die} (${pending.difficulty}, target ${pending.target}) for this roll. Roll what was prescribed.`);
        }
        if (command.difficulty != null && difficulty !== pending.difficulty) {
          throw new Error(`The oracle prescribed ${pending.difficulty} (d${pending.die}, target ${pending.target}) for this roll. Roll what was prescribed.`);
        }
      }
      const target = TARGETS[die][difficulty];
      const useBonuses = state.settings?.useBonuses !== false;
      const boon = useBonuses ? (own(t.pendingBoons, skill) ? t.pendingBoons[skill] : 0) : 0;
      const bonus = useBonuses ? baseBonus + boon : 0;
      const breakdown = useBonuses
        ? `${skill} (${bonus >= 0 ? "+" : ""}${bonus}${boon ? ", blessing included" : ""})`
        : `${skill} (bonuses off)`;
      appendMessage(state, t, {
        role: "you", kind: "check-request",
        text: `Check: ${breakdown} on a d${die}, ${difficulty}, target ${target}.`,
        skill, bonus, die, difficulty, target,
      });
      const roll = rollDie(state, die);
      const total = roll + bonus;
      // The die's extremes belong to fortune, not to skill: a natural
      // maximum always succeeds extraordinarily, and a natural 1 always
      // fails. A roll that cannot fail is not a roll.
      const success = roll === 1 ? false : roll === die ? true : total >= target;
      if (boon) delete t.pendingBoons[skill]; // a blessing is spent on the roll it touched
      t.lastSkill = skill;
      t.lastOutcome = { kind: "check", success, day: t.day ?? null };
      let flavor = "";
      if (roll === die) flavor = " A natural maximum: an extraordinary success.";
      else if (roll === 1) flavor = " A natural 1: a complication follows.";
      const resultWord = roll === 1 && total >= target
        ? "Failure. The die came up 1, and no skill carries that."
        : success ? "Success." : "Failure.";
      const verdict = useBonuses
        ? `Rolled ${roll} + ${bonus} = ${total} against target ${target}. ${resultWord}${flavor}`
        : `Rolled ${roll} (bonuses off) against target ${target}. ${resultWord}${flavor}`;
      const m = appendMessage(state, t, {
        role: "oracle", kind: "check", skill, bonus, die, difficulty, target, roll, total, success,
        text: verdict,
      });
      if (pending) t.pendingCheck = null; // any rolled check settles the oracle's request
      result = { message: clone(m), roll, total, target, success };
      break;
    }
    default:
      throw new Error("Unknown command type: " + command.type);
  }
  state.revision = before + 1;
  return { revision: state.revision, ...result };
}

// Idempotent command application for agents: exact repeated IDs do not
// reapply; conflicting IDs and stale revisions reject.
function applyCommand(state, command) {
  if (!command || typeof command !== "object" || Array.isArray(command)) throw new Error("Command needs an object");
  if (command.id != null && (typeof command.id !== "string" || !command.id.trim())) throw new Error("Command ID must be a nonempty string");
  if (command.expectedRevision != null && (!Number.isSafeInteger(command.expectedRevision) || command.expectedRevision < 0)) throw new Error("Invalid expected revision");
  if (command.id != null) {
    const prior = state.receipts.find((r) => r.id === command.id);
    if (prior) {
      if (prior.payload !== canonical(command)) throw new Error("Conflicting command ID");
      return { revision: state.revision, duplicate: true };
    }
  }
  if (command.expectedRevision != null && command.expectedRevision !== state.revision) {
    throw new Error("Stale revision; observe again");
  }
  const out = dispatch(state, command);
  if (command.id != null) {
    state.receipts.push({ id: command.id, payload: canonical(command), revision: state.revision });
    // Retain receipts for the lifetime of this save; retries must never expire.
  }
  return out;
}

// --- observation / serialization -------------------------------------------

function observe(state, threadId) {
  const t = getThread(state, threadId);
  return {
    revision: state.revision,
    settings: clone(state.settings || { useBonuses: true }),
    threads: state.order.map((id) => ({
      id, title: state.threads[id].title,
      messages: state.threads[id].messages.length,
      active: id === state.activeThreadId,
      pendingCheck: clone(state.threads[id].pendingCheck),
    })),
    thread: clone(t),
  };
}

function validateState(s) {
  if (!s || s.schema !== "QuietDM" || s.version !== 1) throw new Error("Unsupported or corrupted save");
  if (!s.threads || !Array.isArray(s.order) || !s.random || s.random.kind !== "tape") {
    throw new Error("Unsupported or corrupted save");
  }
  const t = s.random;
  if (!Array.isArray(t.values) || !t.values.every(v => Number.isFinite(v) && v >= 0 && v < 1) ||
      !Number.isSafeInteger(t.cursor) || t.cursor < 0 || t.cursor > t.values.length ||
      (t.continuation != null && (!Array.isArray(t.continuation) || t.continuation.length !== 4 ||
       !t.continuation.every(v => Number.isInteger(v) && v >= 0 && v <= 4294967295) || t.continuation.every(v => v === 0)))) {
    throw new Error("Invalid random continuation");
  }
  return s;
}

function exportSave(state) {
  const body = clone(state);
  const text = canonical(body);
  return JSON.stringify({ ...body, checksum: checksum(text) }, null, 2);
}

function importSave(text) {
  const data = JSON.parse(text);
  const { checksum: sum, ...body } = data;
  if (!sum || checksum(canonical(body)) !== sum) throw new Error("Unsupported or corrupted save");
  return normalize(validateState(body));
}

function exportLog(state, threadId) {
  const t = getThread(state, threadId);
  const lines = [`# ${t.title}`, ""];
  if (t.mode === "life") lines.push("A life, lived in Quiet DM. See LIFE.md.", "");
  if (t.character) {
    lines.push(`Character: ${t.character.name} — ` +
      Object.entries(t.character.skills).map(([k, v]) => `${k} ${v >= 0 ? "+" : ""}${v}`).join(", "), "");
  }
  for (const m of t.messages) {
    if (m.kind === "day") lines.push(`—— ${m.text} ——`);
    else if (m.role === "you") lines.push(`You: ${m.text}${m.weigh ? ` (asked as ${m.weigh})` : ""}`);
    else if (m.kind === "note") lines.push(`[DM] ${m.text}`);
    else lines.push(`DM: ${m.text}`);
    lines.push("");
  }
  return lines.join("\n");
}

function exportAllLogs(state) {
  return state.order.map((id) => exportLog(state, id)).join("\n---\n\n");
}

// A single thread as a portable file: share one story, move it between
// saves, or archive it, without moving the whole save.
function exportThread(state, threadId) {
  const t = getThread(state, threadId);
  const body = { schema: "QuietDMThread", version: 1, thread: clone(t) };
  return JSON.stringify({ ...body, checksum: checksum(canonical(body)) }, null, 2);
}

function importThread(state, text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Unsupported or corrupted thread file");
  }
  const { checksum: sum, ...body } = data ?? {};
  if (!sum || body.schema !== "QuietDMThread" || body.version !== 1 || !body.thread || !Array.isArray(body.thread.messages)) {
    throw new Error("Unsupported or corrupted thread file");
  }
  if (checksum(canonical(body)) !== sum) throw new Error("Unsupported or corrupted thread file");
  const t = normalizeThread(clone(body.thread));
  t.id = "thread-" + Math.floor(draw(state) * 1e9).toString(36) + "-" + state.order.length + "-imp";
  while (state.threads[t.id]) t.id += "x";
  state.threads[t.id] = t;
  state.order.push(t.id);
  state.revision += 1;
  return { threadId: t.id };
}

window.QuietDM = { DICE, TARGETS, DIFFICULTIES, ORACLE_TABLE, YESNO_TABLE, INSPIRE_TABLES, canonical, freshRandom, replayRandom, newState, dispatch, applyCommand, observe, validateState, exportSave, importSave, exportLog, exportAllLogs, exportThread, importThread };
})();
