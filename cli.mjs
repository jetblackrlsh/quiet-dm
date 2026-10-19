#!/usr/bin/env node
// Quiet DM — headless CLI. Same engine as the browser app.
// Usage:
//   node cli.mjs new <save.json> ["Thread title"]
//   node cli.mjs threads <save.json>
//   node cli.mjs look <save.json> [threadId]
//   node cli.mjs open <save.json> <threadId>
//   node cli.mjs create <save.json> "Thread title"
//   node cli.mjs rename <save.json> "New title"   (rename the active thread)
//   node cli.mjs post <save.json> "story text..."
//   node cli.mjs ask <save.json> "action you are attempting..."
//   node cli.mjs yn <save.json> [--likely|--unlikely] "yes-or-no question about the world..."
//        (flags are the unambiguous lean; the first word still works:
//         node cli.mjs yn <save.json> likely "Has her hand healed?")
//   node cli.mjs howmany <save.json> "thing you are counting..." [die]
//   node cli.mjs inspire <save.json> <monster|class|species|quest>
//   node cli.mjs boon <save.json>
//   node cli.mjs check <save.json> <skill> <bonus> [die] [difficulty]
//        (with a character defined, the bonus comes from the sheet:
//         node cli.mjs check <save.json> <skill> [die] [difficulty])
//   node cli.mjs life <save.json> [off]   (mark the active thread as a life; see LIFE.md)
//   node cli.mjs day <save.json> [n]      (begin the next in-world day; with n, place the counter on day n)
//   node cli.mjs character <save.json> show
//   node cli.mjs character <save.json> define <name> [Skill=bonus ...]
//   node cli.mjs character <save.json> set <skill> <bonus>
//   node cli.mjs character <save.json> remove <skill>
//   node cli.mjs bonus <save.json> on|off
//   node cli.mjs log <save.json> [threadId]
//   node cli.mjs logall <save.json>
//   node cli.mjs delete <save.json> <threadId>
//   node cli.mjs export-thread <save.json> <threadId> <out.json>
//   node cli.mjs import-thread <save.json> <thread.json>
//   node cli.mjs command <save.json> <command.json>   (idempotent, agent interface)
import fs from "node:fs";
import path from "node:path";
import { newState, dispatch, applyCommand, observe, exportSave, importSave, exportLog, exportAllLogs, exportThread, importThread } from "./src/engine.mjs";

const [, , cmd, savePath, ...rest] = process.argv;

// The usage text is this file's own header comment, read back from the
// source, so what a bare run prints can never drift from the header.
const USAGE = (() => {
  const lines = [];
  for (const line of fs.readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1)) {
    if (!line.startsWith("//")) break;
    lines.push(line.replace(/^\/\/ ?/, ""));
  }
  return lines.join("\n");
})();

function fail(msg) {
  console.log(JSON.stringify({ error: msg }));
  process.exit(1);
}

// A run with no command, or one the CLI does not know, also gets the
// usage text — on stderr, so the JSON error on stdout (the agent
// contract) stays exactly as it has always been.
function failWithUsage(msg) {
  console.error(USAGE);
  fail(msg);
}

function load(p) {
  try {
    return importSave(fs.readFileSync(p, "utf8"));
  } catch (e) {
    fail(e.message);
  }
}

// The lock covers the complete transaction, including the initial read and
// the new-save existence check. A contender fails explicitly and may retry.
let lockFd, lockPath;
function releaseLock() {
  if (lockFd == null) return;
  fs.closeSync(lockFd); lockFd = undefined;
  fs.rmSync(lockPath, { force: true });
}
process.on("exit", releaseLock);
function acquireLock(p) {
  lockPath = p + ".lock";
  try { lockFd = fs.openSync(lockPath, "wx"); }
  catch (e) { fail("Cannot acquire save lock (" + lockPath + "): " + e.message); }
}
function store(p, state) {
  if (lockFd == null) throw new Error("Save transaction has no lock");
  const tmp = p + ".pending";
  let fd;
  try {
    fd = fs.openSync(tmp, "w");
    fs.writeFileSync(fd, exportSave(state));
    fs.fsyncSync(fd);
    fs.closeSync(fd); fd = undefined;
    fs.renameSync(tmp, p);
  } finally {
    if (fd != null) fs.closeSync(fd);
    if (fs.existsSync(tmp)) fs.rmSync(tmp);
  }
}

if (!cmd) failWithUsage("No command given");
if (savePath) acquireLock(savePath);
if (cmd === "new") {
  if (!savePath) fail("Usage: new <save.json> [title]");
  if (fs.existsSync(savePath)) fail("Save already exists: " + savePath);
  const s = newState();
  if (rest[0]) {
    dispatch(s, { type: "thread.rename", title: rest.join(" ") });
  }
  store(savePath, s);
  console.log(JSON.stringify(observe(s), null, 2));
  process.exit(0);
}
if (!savePath) fail("Usage: " + cmd + " <save.json> ...");
const state = load(savePath);

try {
  switch (cmd) {
    case "threads":
      console.log(JSON.stringify(observe(state).threads, null, 2));
      break;
    case "look":
      console.log(JSON.stringify(observe(state, rest[0]), null, 2));
      break;
    case "open": {
      const out = dispatch(state, { type: "thread.open", threadId: rest[0] });
      store(savePath, state);
      console.log(JSON.stringify(out, null, 2));
      break;
    }
    case "create": {
      const out = dispatch(state, { type: "thread.create", title: rest.join(" ") });
      store(savePath, state);
      console.log(JSON.stringify(out, null, 2));
      break;
    }
    case "rename": {
      const out = dispatch(state, { type: "thread.rename", title: rest.join(" ") });
      store(savePath, state);
      console.log(JSON.stringify(out, null, 2));
      break;
    }
    case "post": {
      const out = dispatch(state, { type: "post", text: rest.join(" ") });
      store(savePath, state);
      console.log(JSON.stringify(out, null, 2));
      break;
    }
    case "ask": {
      const out = dispatch(state, { type: "ask", action: rest.join(" ") });
      store(savePath, state);
      console.log(JSON.stringify(out, null, 2));
      break;
    }
    case "yn": {
      let weigh;
      // --likely / --unlikely flags, anywhere in the call, are the
      // unambiguous way to lean: a question that honestly begins
      // with the word "likely" is prose, not a lean, unless flagged.
      // What counts as a flag is grammatical: "--" followed by
      // letters. A bare "--" in a question ("Is it -- really --
      // raining?") is prose punctuation and stays in the question.
      // A flag-shaped word the CLI does not know refuses — a mistyped
      // flag must never silently become part of the question — and a
      // single-dash "-likely" refuses with the spelling it meant.
      const FLAG_WORD = /^--[a-z][a-z-]*$/i;
      const kept = [];
      for (const word of rest) {
        const w = word.toLowerCase();
        if (w === "-likely" || w === "-unlikely") {
          throw new Error(`"${word}" has one dash; the lean flags are --likely and --unlikely. Nothing was rolled.`);
        }
        if (!FLAG_WORD.test(word)) {
          kept.push(word);
          continue;
        }
        if (w === "--likely" || w === "--unlikely") {
          const flag = w.slice(2);
          if (weigh && weigh !== flag) {
            throw new Error("Conflicting leans: --likely and --unlikely cannot both be declared. Nothing was rolled.");
          }
          weigh = flag;
        } else {
          throw new Error(`Unknown flag "${word}": the only flags are --likely and --unlikely. Nothing was rolled.`);
        }
      }
      // The first-word form still works, and no longer minds case.
      if (!weigh && kept.length) {
        const first = kept[0].toLowerCase();
        if (first === "likely" || first === "unlikely") weigh = kept.shift().toLowerCase();
      }
      const out = dispatch(state, {
        type: "yn", question: kept.join(" "),
        ...(weigh ? { weigh } : {}),
      });
      store(savePath, state);
      console.log(JSON.stringify(out, null, 2));
      break;
    }
    case "howmany": {
      let die;
      const words = [...rest];
      const last = words[words.length - 1];
      if (last != null && /^\d+$/.test(last)) die = +words.pop();
      const out = dispatch(state, { type: "howmany", thing: words.join(" "), die });
      store(savePath, state);
      console.log(JSON.stringify(out, null, 2));
      break;
    }
    case "inspire": {
      const out = dispatch(state, { type: "inspire", table: rest[0] });
      store(savePath, state);
      console.log(JSON.stringify(out, null, 2));
      break;
    }
    case "boon": {
      const out = dispatch(state, { type: "boon" });
      store(savePath, state);
      console.log(JSON.stringify(out, null, 2));
      break;
    }
    case "bonus": {
      if (rest[0] !== "on" && rest[0] !== "off") fail("Usage: bonus <save.json> on|off");
      const out = dispatch(state, { type: "settings", useBonuses: rest[0] === "on" });
      store(savePath, state);
      console.log(JSON.stringify(out, null, 2));
      break;
    }
    case "day": {
      const out = dispatch(state, { type: "day", ...(rest[0] != null ? { day: +rest[0] } : {}) });
      store(savePath, state);
      console.log(JSON.stringify(out, null, 2));
      break;
    }
    case "life": {
      const out = dispatch(state, { type: "thread.mode", mode: rest[0] === "off" ? "story" : "life" });
      store(savePath, state);
      console.log(JSON.stringify(out, null, 2));
      break;
    }
    case "character": {
      const [sub, ...args] = rest;
      let out;
      if (sub === "show") {
        console.log(JSON.stringify(observe(state).thread.character, null, 2));
        break;
      } else if (sub === "define") {
        const [name, ...pairs] = args;
        const skills = {};
        for (const p of pairs) {
          const eq = p.lastIndexOf("=");
          if (eq > 0) skills[p.slice(0, eq)] = +p.slice(eq + 1);
        }
        out = dispatch(state, { type: "character.define", name, skills });
      } else if (sub === "set") {
        out = dispatch(state, { type: "character.skill", skill: args[0], bonus: +args[1] });
      } else if (sub === "remove") {
        out = dispatch(state, { type: "character.remove-skill", skill: args.join(" ") });
      } else {
        fail("Usage: character <save.json> show|define|set|remove ...");
      }
      store(savePath, state);
      console.log(JSON.stringify(out, null, 2));
      break;
    }
    case "check": {
      const [skill, ...tail] = rest;
      const hasCharacter = !!observe(state).thread.character;
      let bonus = 0, die, difficulty;
      if (hasCharacter) {
        [die, difficulty] = tail;
      } else {
        [bonus, die, difficulty] = tail;
        bonus = bonus != null ? +bonus : 0;
      }
      const out = dispatch(state, {
        type: "check", skill, bonus,
        die: die != null ? +die : undefined, difficulty,
      });
      store(savePath, state);
      console.log(JSON.stringify(out, null, 2));
      break;
    }
    case "log":
      console.log(exportLog(state, rest[0]));
      break;
    case "logall":
      console.log(exportAllLogs(state));
      break;
    case "delete": {
      const out = dispatch(state, { type: "thread.delete", threadId: rest[0] });
      store(savePath, state);
      console.log(JSON.stringify(out, null, 2));
      break;
    }
    case "export-thread": {
      const [threadId, outPath] = rest;
      if (!threadId || !outPath) fail("Usage: export-thread <save.json> <threadId> <out.json>");
      fs.writeFileSync(outPath, exportThread(state, threadId));
      console.log(JSON.stringify({ exported: threadId, file: outPath }, null, 2));
      break;
    }
    case "import-thread": {
      const out = importThread(state, fs.readFileSync(rest[0], "utf8"));
      store(savePath, state);
      console.log(JSON.stringify(out, null, 2));
      break;
    }
    case "command": {
      const command = JSON.parse(fs.readFileSync(rest[0], "utf8"));
      const out = applyCommand(state, command);
      store(savePath, state);
      console.log(JSON.stringify(out, null, 2));
      break;
    }
    default:
      failWithUsage("Unknown command: " + cmd);
  }
} catch (e) {
  fail(e.message);
}
