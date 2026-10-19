// Build the classic browser bundle (engine.js) from src/engine.mjs so the
// browser app and the headless CLI share exactly the same mechanics.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = fs.readFileSync(path.join(root, "src", "engine.mjs"), "utf8");

const names = [
  "DICE", "TARGETS", "DIFFICULTIES", "ORACLE_TABLE", "YESNO_TABLE", "INSPIRE_TABLES",
  "canonical",
  "freshRandom", "replayRandom", "newState", "dispatch", "applyCommand",
  "observe", "validateState", "exportSave", "importSave", "exportLog",
  "exportAllLogs", "exportThread", "importThread",
];

const body = src.replace(/^export\s+(?=(const|function|class)\s)/gm, "");
const out =
  "// Generated from src/engine.mjs by tools/build.mjs. Do not edit by hand.\n" +
  "(function () {\n\"use strict\";\n" +
  body +
  "\nwindow.QuietDM = { " + names.join(", ") + " };\n})();\n";

fs.writeFileSync(path.join(root, "engine.js"), out);
console.log("Built classic offline engine.");
