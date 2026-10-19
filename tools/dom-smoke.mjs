// Optional DOM smoke test (requires jsdom): drives START.html the way a
// person would — write silently, ask the oracle, roll a check, switch threads.
//   npm install --no-save --ignore-scripts jsdom@26.1.0
//   node tools/dom-smoke.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let JSDOM;
try {
  ({ JSDOM } = await import(process.env.QUIET_DM_JSDOM || "jsdom"));
} catch {
  console.log("jsdom not installed; skipping DOM smoke (see header).");
  process.exit(0);
}

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = fs.readFileSync(path.join(root, "START.html"), "utf8")
  .replace(/<link[^>]*>/, "")
  .replace(/<script src="engine.js"><\/script>/, () => "<script>" + fs.readFileSync(path.join(root, "engine.js"), "utf8") + "</script>")
  .replace(/<script src="app.js"><\/script>/, () => "<script>" + fs.readFileSync(path.join(root, "app.js"), "utf8") + "</script>");

let randomWord = 3865470566; // deterministic test-only entropy, never a player's save
const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://localhost/", pretendToBeVisual: true,
  beforeParse(window) { Object.defineProperty(window.crypto, "getRandomValues", {value: a => {a.fill(randomWord); return a;}}); }
});
const { window } = dom;
const doc = window.document;
const assert = (cond, msg) => { if (!cond) { console.error("FAIL:", msg); process.exit(1); } };
const msgs = () => [...doc.querySelectorAll("#messages .msg")];

await new Promise((r) => setTimeout(r, 60));

assert(doc.querySelector("#thread-title").textContent === "My first story", "welcome thread title");
assert(msgs().some((m) => m.className.includes("note")), "welcome note explains the bot");

// 1. Journaling is silent
const before = msgs().length;
doc.querySelector("#input").value = "The harbor bells are drowned. I wade in anyway.";
doc.querySelector("#post-btn").click();
assert(msgs().length === before + 1, "post adds exactly one message");
assert(msgs().at(-1).className.includes("journal"), "the new message is a journal entry, not a reply");

// 2. Asking gets an oracle answer
doc.querySelector("#input").value = "I haul on the bell rope.";
doc.querySelector("#ask-btn").click();
const after = msgs();
assert(after.at(-2).className.includes("question"), "question is shown");
assert(after.at(-1).className.includes("dm"), "oracle answered");
assert(/Yes|No|Roll for it/.test(after.at(-1).textContent), "oracle answer is an oracle answer");

// 3. Rolling a check appends a request and a verdict
doc.querySelector("#ck-skill").value = "Strength";
doc.querySelector("#ck-bonus").value = "2";
doc.querySelector("#ck-roll").click();
const tail = msgs().slice(-2);
assert(tail[0].className.includes("question"), "check request shown");
assert(/Rolled \d+ \+ 2 = \d+ against target \d+\. (Success|Failure)\./.test(tail[1].textContent), "verdict format");

// 4. A second thread is isolated
window.prompt = () => "Second Story";
doc.querySelector("#new-thread").click();
assert(doc.querySelector("#thread-title").textContent === "Second Story", "new thread opens");
assert(!msgs().some((m) => m.textContent.includes("harbor bells")), "threads do not leak into each other");

// 5. Save survives a reload (localStorage round trip)
const saved = window.localStorage.getItem("quiet-dm-save-v1");
assert(saved && saved.includes("Second Story"), "autosave persisted");

// 6. Log/thread export buttons work and thread import round-trips
for (const id of ["#logall-btn", "#export-thread-btn", "#import-thread-file"]) {
  assert(doc.querySelector(id), "missing control " + id);
}
let downloads = 0;
window.URL.createObjectURL = () => "blob:smoke";
window.URL.revokeObjectURL = () => {};
const origClick = window.HTMLAnchorElement.prototype.click;
window.HTMLAnchorElement.prototype.click = function () { downloads++; };
doc.querySelector("#logall-btn").click();
doc.querySelector("#export-thread-btn").click();
assert(downloads === 2, "export buttons trigger downloads");
window.HTMLAnchorElement.prototype.click = origClick;

const view = JSON.parse(saved); // shape check only; real content checked via engine tests
const QD = window.QuietDM;
const st = QD.importSave(saved);
const threadFile = QD.exportThread(st);
const input = doc.querySelector("#import-thread-file");
// jsdom's File lacks .text(); the app only calls f.text(), so simulate the
// exact browser File surface the app uses.
Object.defineProperty(input, "files", { value: [{ name: "t.thread.json", text: async () => threadFile }], configurable: true });
input.dispatchEvent(new window.Event("change", { bubbles: true }));
await new Promise((r) => setTimeout(r, 80));
const titles = [...doc.querySelectorAll("#thread-list .thread-open")].map((b) => b.textContent);
assert(titles.length === 3, "imported thread appears in the list (got " + titles.length + ")");

// 7. New question kinds: yes/no via composer, inspiration, how-many
const dmCount = () => msgs().filter((m) => m.className.includes("dm")).length;
let n = dmCount();
doc.querySelector("#input").value = "Is the far bank haunted?";
doc.querySelector("#yn-btn").click();
assert(dmCount() === n + 1, "yes/no question gets a DM answer");
assert(/^(Yes|No)/.test(msgs().at(-1).textContent.replace(/^Dungeon Master/, "").trim()), "yes/no answer shape");
n = dmCount();
doc.querySelector('[data-table="quest"]').click();
assert(dmCount() === n + 1 && msgs().at(-1).textContent.includes("Quest:"), "inspiration answers");
doc.querySelector("#hm-thing").value = "goblins in the cave";
doc.querySelector("#hm-btn").click();
assert(msgs().at(-1).textContent.includes("Rolled on a d6"), "how-many answers");

// 8. Character sheet through the UI: define, roll from the sheet, bonuses off
doc.querySelector("#char-toggle").click();
doc.querySelector("#char-name").value = "Wren";
doc.querySelector("#char-save-name").click();
doc.querySelector("#char-skill-name").value = "Rivercraft";
doc.querySelector("#char-skill-bonus").value = "2";
doc.querySelector("#char-add-skill").click();
assert(doc.querySelector("#char-summary").textContent.includes("Rivercraft +2"), "sheet shows in summary");
assert(doc.querySelector("#ck-skill-select").hidden === false, "skill picker replaces free text");
doc.querySelector("#ck-roll").click();
assert(/Check: Rivercraft \(\+2\)/.test(msgs().at(-2).textContent), "roll uses the sheet bonus");
doc.querySelector("#opt-bonus").click(); // toggles off and fires change
doc.querySelector("#ck-roll").click();
assert(msgs().at(-2).textContent.includes("bonuses off"), "toggle removes bonuses");
doc.querySelector("#opt-bonus").click(); // back on

// 9. Deterministic successful check enables blessing, then consumes the request
n = dmCount();
assert(!doc.querySelector("#boon-btn").disabled, "successful check enables boon");
doc.querySelector("#boon-btn").click();
assert(dmCount() === n + 1, "boon request is answered");
assert(doc.querySelector("#boon-btn").disabled, "consumed boon request is disabled");

// 10. Lean selector: state is exposed, and every exit returns it to None
const leanBtn = (v) => doc.querySelector(`.lean-opt[data-lean="${v}"]`);
const pressed = (v) => leanBtn(v).getAttribute("aria-pressed");
const group = doc.querySelector(".lean-seg");
assert(group.getAttribute("role") === "group" && /Lean/.test(group.getAttribute("aria-label") || ""), "lean selector is a labelled group");
assert(pressed("") === "true" && pressed("likely") === "false" && pressed("unlikely") === "false", "selector starts on None, pressed states exposed");
leanBtn("likely").click();
assert(pressed("likely") === "true" && pressed("") === "false", "clicking Likely presses it and releases None");
// an empty yes/no attempt still clears the lean
doc.querySelector("#input").value = "";
doc.querySelector("#yn-btn").click();
assert(pressed("") === "true" && pressed("likely") === "false", "empty yes/no attempt resets the selector");
// a leaned question dispatches with the lean on the record, then resets
leanBtn("unlikely").click();
doc.querySelector("#input").value = "Is the ford rising?";
doc.querySelector("#yn-btn").click();
assert(msgs().at(-2).textContent.includes("(asked as unlikely)"), "lean shows beside the question");
assert(/\(Asked as unlikely; the bare die said/.test(msgs().at(-1).textContent), "answer states the lean");
assert(pressed("") === "true" && pressed("unlikely") === "false", "dispatch resets the selector");
// switching threads clears a standing lean too
leanBtn("likely").click();
doc.querySelector("#thread-list .thread-open").click();
assert(pressed("") === "true" && pressed("likely") === "false", "thread switch resets the selector");

// 11. A failed save is never silent: warning shows, writing continues,
// and the warning clears the first time a save succeeds again.
{
  let failSaves = true;
  const dom2 = new JSDOM(html, {
    runScripts: "dangerously", url: "https://localhost/", pretendToBeVisual: true,
    beforeParse(window) {
      const proto = window.Storage.prototype;
      const realSet = proto.setItem;
      proto.setItem = function (k, v) {
        if (failSaves) { const e = new Error("storage is full"); e.name = "QuotaExceededError"; throw e; }
        return realSet.call(this, k, v);
      };
    },
  });
  const doc2 = dom2.window.document;
  await new Promise((r) => setTimeout(r, 60));
  const warn = doc2.querySelector("#save-warning");
  assert(warn && warn.hidden === false, "save-failure warning shows when storage refuses the autosave");
  assert(/couldn't save/.test(warn.textContent), "warning says plainly that the story could not be saved");
  assert(doc2.querySelector("#save-warning-export"), "warning carries an Export save action");
  doc2.querySelector("#input").value = "Written while the browser refuses to keep it.";
  doc2.querySelector("#post-btn").click();
  assert([...doc2.querySelectorAll("#messages .msg")].some((m) => m.textContent.includes("refuses to keep")), "writing continues during a save failure");
  assert(warn.hidden === false, "warning persists while saves keep failing");
  failSaves = false;
  doc2.querySelector("#input").value = "And now it can be kept.";
  doc2.querySelector("#post-btn").click();
  assert(warn.hidden === true, "warning clears once a save succeeds again");
  dom2.window.close();
}

// 12. An unreadable stored save is set aside under a backup key, the
// player is told, a fresh story starts — and the notice's Download
// backup button hands back the raw copy without developer tools.
{
  const RAW = "this is not a save {{{";
  const dom3 = new JSDOM(html, {
    runScripts: "dangerously", url: "https://localhost/", pretendToBeVisual: true,
    beforeParse(window) {
      window.localStorage.setItem("quiet-dm-save-v1", RAW);
    },
  });
  const doc3 = dom3.window.document;
  await new Promise((r) => setTimeout(r, 60));
  const ls = dom3.window.localStorage;
  const keys = [];
  for (let i = 0; i < ls.length; i++) keys.push(ls.key(i));
  const backupKey = keys.find((k) => k.startsWith("quiet-dm-backup-"));
  assert(backupKey, "unreadable save is preserved under a backup key (keys: " + keys.join(", ") + ")");
  assert(ls.getItem(backupKey) === RAW, "backup holds the raw unreadable copy, untouched");
  const notice = doc3.querySelector("#backup-notice");
  assert(notice && notice.hidden === false, "the set-aside notice shows");
  assert(/could not be read/.test(notice.textContent) && /has been set aside untouched/.test(notice.textContent), "notice says the save could not be read and was set aside");
  const dlBtn = doc3.querySelector("#backup-notice-download");
  assert(dlBtn && dlBtn.textContent === "Download backup", "notice carries a Download backup button");
  let blob = null, clicks = 0;
  dom3.window.URL.createObjectURL = (b) => { blob = b; return "blob:smoke"; };
  dom3.window.URL.revokeObjectURL = () => {};
  const origClick3 = dom3.window.HTMLAnchorElement.prototype.click;
  dom3.window.HTMLAnchorElement.prototype.click = function () { clicks++; };
  dlBtn.click();
  assert(clicks === 1 && blob, "Download backup triggers a download");
  const got = typeof blob.text === "function" ? await blob.text() : null;
  assert(got !== null ? got === RAW : blob.size === RAW.length, "the download delivers the raw backup copy");
  dom3.window.HTMLAnchorElement.prototype.click = origClick3;
  assert(doc3.querySelector("#thread-title").textContent === "My first story", "a fresh story starts after the set-aside");
  assert((ls.getItem("quiet-dm-save-v1") || "").includes("My first story"), "the fresh autosave overwrites only the main key");
  dom3.window.close();
}

// 13. If the backup write itself fails (storage full or blocked), the
// notice must never claim the copy was stored: the wording branches,
// and the raw copy — held in memory for the page — downloads instead.
{
  const RAW = "this is not a save either {{{";
  const dom4 = new JSDOM(html, {
    runScripts: "dangerously", url: "https://localhost/", pretendToBeVisual: true,
    beforeParse(window) {
      window.localStorage.setItem("quiet-dm-save-v1", RAW);
      const proto = window.Storage.prototype;
      const realSet = proto.setItem;
      proto.setItem = function (k, v) {
        if (String(k).startsWith("quiet-dm-backup-")) { const e = new Error("storage is full"); e.name = "QuotaExceededError"; throw e; }
        return realSet.call(this, k, v);
      };
    },
  });
  const doc4 = dom4.window.document;
  await new Promise((r) => setTimeout(r, 60));
  const ls4 = dom4.window.localStorage;
  const keys4 = [];
  for (let i = 0; i < ls4.length; i++) keys4.push(ls4.key(i));
  assert(!keys4.some((k) => k.startsWith("quiet-dm-backup-")), "no backup key exists when the backup write fails");
  const notice4 = doc4.querySelector("#backup-notice");
  assert(notice4 && notice4.hidden === false, "the failed-backup notice shows");
  assert(/could not be read/.test(notice4.textContent) && /could not be set aside/.test(notice4.textContent), "notice says the save could not be read or set aside");
  assert(!/has been set aside/.test(notice4.textContent), "notice never claims the copy was stored");
  assert(/will be lost when the page is closed/.test(notice4.textContent), "notice says the copy is held only until the page closes");
  const dlBtn4 = doc4.querySelector("#backup-notice-download");
  assert(dlBtn4 && dlBtn4.textContent === "Download the unreadable save now", "notice offers the unreadable-save download");
  let blob4 = null, clicks4 = 0;
  dom4.window.URL.createObjectURL = (b) => { blob4 = b; return "blob:smoke"; };
  dom4.window.URL.revokeObjectURL = () => {};
  const origClick4 = dom4.window.HTMLAnchorElement.prototype.click;
  dom4.window.HTMLAnchorElement.prototype.click = function () { clicks4++; };
  dlBtn4.click();
  assert(clicks4 === 1 && blob4, "the failure-branch download triggers");
  const got4 = typeof blob4.text === "function" ? await blob4.text() : null;
  assert(got4 !== null ? got4 === RAW : blob4.size === RAW.length, "the failure-branch download delivers the raw copy held in memory");
  dom4.window.HTMLAnchorElement.prototype.click = origClick4;
  assert(doc4.querySelector("#thread-title").textContent === "My first story", "a fresh story starts even when the backup cannot be stored");
  dom4.window.close();
}

console.log("DOM smoke passed: startup, silent journaling, oracle ask, check roll, thread isolation, autosave, log/thread export-import, yes-no, inspiration, how-many, character sheet, bonus toggle, blessing, lean selector, save-failure warning, corrupt-save backup + download, failed-backup wording + in-memory download.");

// Failed checks must never enable the blessing control.
const low = new JSDOM(html, {runScripts: "dangerously", url: "https://localhost/", pretendToBeVisual: true,
 beforeParse(w) {Object.defineProperty(w.crypto, "getRandomValues", {value:a=>{a.fill(0);return a;}});}});
await new Promise(r=>setTimeout(r,60));
low.window.document.querySelector("#ck-skill").value="Strength";
low.window.document.querySelector("#ck-roll").click();
assert(low.window.document.querySelector("#boon-btn").disabled,"failed check disables boon");
low.window.close(); dom.window.close();
console.log("Deterministic boon success/failure states passed.");
