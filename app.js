// Quiet DM — browser UI. All mechanics live in engine.js (window.QuietDM).
(function () {
  "use strict";
  const Q = window.QuietDM;
  const KEY = "quiet-dm-save-v1";
  const BACKUP_PREFIX = "quiet-dm-backup-";
  let state;
  // When the stored save cannot be read: { text, buttonLabel, fileName,
  // raw, backupKey }. `raw` is always held in memory for the life of the
  // page; `backupKey` is set only when the copy truly reached storage.
  let loadNotice = null;

  // A failed save is never silent. The story keeps living in memory
  // and Export still works, but the warning stays up until a save
  // succeeds again.
  function showSaveWarning() {
    const el = document.getElementById("save-warning");
    if (el) el.hidden = false;
  }
  function hideSaveWarning() {
    const el = document.getElementById("save-warning");
    if (el) el.hidden = true;
  }
  function save() {
    try {
      localStorage.setItem(KEY, Q.exportSave(state));
      hideSaveWarning();
    } catch (e) {
      showSaveWarning();
    }
  }
  function load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { /* storage unreadable: start fresh; save() will raise the warning */ }
    if (raw) {
      try { return Q.importSave(raw); }
      catch (e) {
        // The stored save cannot be read. Try to set the raw copy
        // aside under a backup key, untouched, so the fresh autosave
        // that follows never destroys the only copy of a story. The
        // notice says only what actually happened: if the backup
        // write itself fails, nothing may claim the copy was stored
        // — it is held in memory for this page only, and the wording
        // says so.
        let backupKey = null;
        try {
          backupKey = BACKUP_PREFIX + Date.now();
          localStorage.setItem(backupKey, raw);
        } catch (e2) { backupKey = null; }
        if (backupKey) {
          loadNotice = {
            text: "Your previous save could not be read. It has been set aside untouched in this browser as a backup copy, and a fresh story has been started.",
            buttonLabel: "Download backup",
            fileName: "quiet-dm-backup-save.json",
            raw, backupKey,
          };
        } else {
          loadNotice = {
            text: "Your previous save could not be read, and it could not be set aside either, because this browser's storage is full or blocked. The unreadable save is held on this page only: download it now, because it will be lost when the page is closed. A fresh story has been started.",
            buttonLabel: "Download the unreadable save now",
            fileName: "quiet-dm-unreadable-save.json",
            raw, backupKey: null,
          };
        }
        return Q.newState();
      }
    }
    return Q.newState();
  }

  state = load();
  save();

  const $ = (id) => document.getElementById(id);
  const els = {
    list: $("thread-list"), title: $("thread-title"), pending: $("pending-note"),
    messages: $("messages"), input: $("input"),
    skill: $("ck-skill"), skillSelect: $("ck-skill-select"), bonus: $("ck-bonus"),
    die: $("ck-die"), diff: $("ck-diff"),
    target: $("ck-target"), optBonus: $("opt-bonus"),
    charSummary: $("char-summary"), charSkills: $("char-skills"), charName: $("char-name"),
    boonNote: $("boon-note"), hmThing: $("hm-thing"), hmDie: $("hm-die"),
    lifeToggle: $("life-toggle"), dayBtn: $("day-btn"), dayLabel: $("day-label"),
    boonBtn: $("boon-btn"), errorNote: $("error-note"),
  };

  for (const d of Q.DICE) {
    const o = document.createElement("option");
    o.value = d; o.textContent = "d" + d;
    if (d === 20) o.selected = true;
    els.die.appendChild(o);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function render() {
    const view = Q.observe(state);
    // sidebar
    els.list.innerHTML = "";
    for (const t of view.threads) {
      const li = document.createElement("li");
      li.className = t.active ? "active" : "";
      li.innerHTML = `<button class="thread-open">${esc(t.title)}</button>` +
        (t.pendingCheck ? `<span class="dot" title="The oracle is waiting on a roll">●</span>` : "") +
        `<span class="count">${t.messages}</span>`;
      li.querySelector(".thread-open").addEventListener("click", () => {
        resetLean();
        Q.dispatch(state, { type: "thread.open", threadId: t.id });
        save(); render();
      });
      els.list.appendChild(li);
    }
    // settings
    els.optBonus.checked = view.settings.useBonuses !== false;
    // main thread
    const thread = view.thread;
    els.title.textContent = thread.title + (thread.mode === "life" ? " — a life" : "");
    els.lifeToggle.textContent = thread.mode === "life" ? "Life mode: on" : "Life mode: off";
    els.dayBtn.hidden = thread.mode !== "life";
    els.dayLabel.textContent = thread.day ? `Day ${thread.day}` : "";
    // character
    const ch = thread.character;
    if (ch) {
      const parts = Object.entries(ch.skills).map(([k, v]) => `${k} ${v >= 0 ? "+" : ""}${v}`);
      els.charSummary.textContent = parts.length ? `${ch.name} — ${parts.join(", ")}` : `${ch.name} — no skills yet`;
      els.charName.value = ch.name;
      els.charSkills.innerHTML = "";
      for (const [k, v] of Object.entries(ch.skills)) {
        const li = document.createElement("li");
        li.innerHTML = `<span>${esc(k)} ${v >= 0 ? "+" : ""}${v}</span> `;
        const rm = document.createElement("button");
        rm.textContent = "remove";
        rm.addEventListener("click", () => {
          Q.dispatch(state, { type: "character.remove-skill", skill: k });
          save(); render();
        });
        li.appendChild(rm);
        els.charSkills.appendChild(li);
      }
      // checks pick from the sheet
      els.skill.hidden = true;
      els.skillSelect.hidden = false;
      const prev = els.skillSelect.value;
      els.skillSelect.innerHTML = "";
      for (const k of Object.keys(ch.skills)) {
        const o = document.createElement("option");
        o.value = k; o.textContent = k;
        els.skillSelect.appendChild(o);
      }
      if (Object.keys(ch.skills).includes(prev)) els.skillSelect.value = prev;
      syncSheetBonus();
      els.bonus.disabled = true;
    } else {
      els.charSummary.textContent = "none defined — checks use the bonus you type";
      els.charSkills.innerHTML = "";
      els.skill.hidden = false;
      els.skillSelect.hidden = true;
      els.bonus.disabled = false;
    }
    // pending blessings
    const boons = Object.entries(thread.pendingBoons || {});
    els.boonNote.textContent = boons.length
      ? "Blessings waiting: " + boons.map(([k, v]) => `${k} +${v}`).join(", ")
      : "";
    // the blessing button reflects whether the DM will hear a request
    const lo = thread.lastOutcome;
    // A success expires at the next dawn; an unstamped success (recorded
    // before day stamps existed) counts as passed in a counted life.
    const boonExpired = !!(lo && lo.success && (
      (lo.day != null && thread.day != null && lo.day !== thread.day) ||
      (lo.day == null && thread.mode === "life" && thread.day != null)));
    const canBoon = !!(lo && lo.success && !boonExpired);
    // A spent blessing is spent for the day it was asked on; past that
    // dawn, the truer word is the one the DM itself uses.
    const boonSpentPastDawn = !!(lo && lo.kind === "boon" &&
      lo.day != null && thread.day != null && lo.day !== thread.day);
    els.boonBtn.disabled = !canBoon;
    els.boonBtn.title = thread.pendingCheck
      ? "A roll is waiting."
      : canBoon
        ? "Ask for a blessing on your last success"
        : boonExpired || boonSpentPastDawn
          ? "The moment has passed."
          : lo && lo.kind === "boon"
            ? "The blessing is spent."
            : lo
              ? "Blessings follow a success; the last outcome was not one."
              : "Blessings open after a success";
    if (thread.pendingCheck) {
      const p = thread.pendingCheck;
      els.pending.hidden = false;
      els.pending.textContent = `The oracle is waiting: roll a d${p.die} (${p.difficulty}, target ${p.target}). Yes/no and how-many questions stay open while it waits.`;
      els.die.value = String(p.die);
      els.diff.value = p.difficulty;
    } else {
      els.pending.hidden = true;
    }
    updateTarget();
    els.messages.innerHTML = "";
    for (const m of thread.messages) {
      const div = document.createElement("div");
      if (m.role === "you" && m.kind === "journal") {
        div.className = "msg journal";
        div.innerHTML = `<div class="body">${esc(m.text)}</div>`;
      } else if (m.role === "you" && m.kind === "question") {
        div.className = "msg question";
        div.innerHTML = `<div class="who">You ask</div><div class="body">${esc(m.text)}${m.weigh ? ` (asked as ${esc(m.weigh)})` : ""}</div>`;
      } else if (m.role === "you" && m.kind === "check-request") {
        div.className = "msg question";
        div.innerHTML = `<div class="who">You roll</div><div class="body">${esc(m.text)}</div>`;
      } else if (m.kind === "day") {
        div.className = "msg day";
        div.innerHTML = `<div class="body">—— ${esc(m.text)} ——</div>`;
      } else if (m.kind === "note") {
        div.className = "msg note";
        div.innerHTML = `<div class="body">${esc(m.text)}</div>`;
      } else {
        div.className = "msg dm " + (m.kind || "");
        div.innerHTML = `<div class="who">Dungeon Master</div><div class="body">${esc(m.text)}</div>`;
      }
      els.messages.appendChild(div);
    }
    els.messages.scrollTop = els.messages.scrollHeight;
  }

  function updateTarget() {
    const die = +els.die.value;
    const diff = els.diff.value;
    els.target.textContent = "Target " + Q.TARGETS[die][diff];
  }
  els.die.addEventListener("change", updateTarget);
  els.diff.addEventListener("change", updateTarget);

  function syncSheetBonus() {
    const view = Q.observe(state);
    const ch = view.thread.character;
    if (ch && els.skillSelect.value in ch.skills) {
      els.bonus.value = ch.skills[els.skillSelect.value];
    }
  }
  els.skillSelect.addEventListener("change", syncSheetBonus);
  els.optBonus.addEventListener("change", () => {
    Q.dispatch(state, { type: "settings", useBonuses: els.optBonus.checked });
    save(); render();
  });

  // Every engine refusal must be visible; a silent no is a broken DM.
  function showError(e) {
    els.errorNote.textContent = e.message;
    els.errorNote.hidden = false;
  }
  function act(fn) {
    try { els.errorNote.hidden = true; fn(); save(); render(); }
    catch (e) { showError(e); }
  }

  function post() {
    const text = els.input.value;
    if (!text.trim()) return;
    act(() => { Q.dispatch(state, { type: "post", text }); els.input.value = ""; });
  }
  function ask() {
    const text = els.input.value;
    if (!text.trim()) return;
    act(() => { Q.dispatch(state, { type: "ask", action: text }); els.input.value = ""; });
  }
  function roll() {
    const view = Q.observe(state);
    const hasChar = !!view.thread.character;
    act(() => {
      Q.dispatch(state, {
        type: "check",
        skill: hasChar ? els.skillSelect.value : els.skill.value,
        bonus: +els.bonus.value || 0,
        die: +els.die.value,
        difficulty: els.diff.value,
      });
    });
  }
  // The yes/no lean lives in the selector beside the button, not in a
  // prompt: the common case (no lean) costs no dialog at all. A
  // forgotten lean would be a silent thumb on the scale, so EVERY exit
  // passes through resetLean(): a dispatched question, an empty or
  // refused attempt, switching threads, and loading or importing a
  // save. No route leaves a lean standing.
  let leanChoice = "";
  const leanBtns = document.querySelectorAll(".lean-opt");
  function syncLean() {
    leanBtns.forEach((b) => {
      const on = b.dataset.lean === leanChoice;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", String(on));
    });
  }
  function resetLean() {
    leanChoice = "";
    syncLean();
  }
  leanBtns.forEach((b) => b.addEventListener("click", () => {
    leanChoice = b.dataset.lean;
    syncLean();
  }));
  syncLean();

  function askYn() {
    // Starting the yes/no flow clears any earlier error, so a stale
    // refusal never lingers over a fresh question.
    els.errorNote.textContent = "";
    els.errorNote.hidden = true;
    const text = els.input.value;
    if (!text.trim()) { resetLean(); return; }
    // The lean is declared before the roll, or not at all; the engine
    // still validates it as a backstop.
    const weigh = leanChoice;
    act(() => {
      Q.dispatch(state, { type: "yn", question: text, ...(weigh ? { weigh } : {}) });
      els.input.value = "";
    });
    resetLean();
  }

  $("post-btn").addEventListener("click", post);
  $("ask-btn").addEventListener("click", ask);
  $("yn-btn").addEventListener("click", askYn);
  $("ck-roll").addEventListener("click", roll);
  document.querySelectorAll(".inspire-btn").forEach((b) => {
    b.addEventListener("click", () => {
      act(() => Q.dispatch(state, { type: "inspire", table: b.dataset.table }));
    });
  });
  $("hm-btn").addEventListener("click", () => {
    const thing = els.hmThing.value.trim();
    if (!thing) return;
    act(() => { Q.dispatch(state, { type: "howmany", thing, die: +els.hmDie.value }); els.hmThing.value = ""; });
  });
  $("boon-btn").addEventListener("click", () => {
    act(() => Q.dispatch(state, { type: "boon" }));
  });
  $("life-toggle").addEventListener("click", () => {
    const thread = Q.observe(state).thread;
    act(() => Q.dispatch(state, { type: "thread.mode", mode: thread.mode === "life" ? "story" : "life" }));
  });
  $("day-btn").addEventListener("click", () => {
    act(() => Q.dispatch(state, { type: "day" }));
  });
  els.dayLabel.title = "Click to set the day counter";
  els.dayLabel.addEventListener("click", () => {
    const thread = Q.observe(state).thread;
    const answer = prompt("Set the day counter to:", thread.day || 1);
    if (answer == null) return;
    const n = parseInt(answer, 10);
    if (!Number.isInteger(n) || n < 1) return;
    act(() => Q.dispatch(state, { type: "day", day: n }));
  });
  $("char-toggle").addEventListener("click", () => {
    const ed = $("char-editor");
    ed.hidden = !ed.hidden;
  });
  $("char-save-name").addEventListener("click", () => {
    const view = Q.observe(state);
    const ch = view.thread.character;
    act(() => Q.dispatch(state, {
      type: "character.define",
      name: els.charName.value,
      skills: ch ? ch.skills : {},
    }));
  });
  $("char-add-skill").addEventListener("click", () => {
    const name = $("char-skill-name").value.trim();
    if (!name) return;
    act(() => {
      Q.dispatch(state, { type: "character.skill", skill: name, bonus: +$("char-skill-bonus").value || 0 });
      $("char-skill-name").value = "";
    });
  });
  els.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); post(); }
  });

  $("new-thread").addEventListener("click", () => {
    const title = prompt("Name the new thread:", "Untitled story");
    if (title === null) return;
    resetLean();
    Q.dispatch(state, { type: "thread.create", title });
    save(); render();
  });
  $("rename-thread").addEventListener("click", () => {
    const view = Q.observe(state);
    const title = prompt("Rename thread:", view.thread.title);
    if (title === null) return;
    Q.dispatch(state, { type: "thread.rename", title });
    save(); render();
  });
  $("delete-thread").addEventListener("click", () => {
    const view = Q.observe(state);
    if (view.threads.length <= 1) { alert("Keep at least one thread."); return; }
    if (!confirm("Delete this thread and its whole story?")) return;
    resetLean();
    Q.dispatch(state, { type: "thread.delete" });
    save(); render();
  });

  function download(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: type || "application/json" }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const slug = (s) => s.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "story";
  $("export-btn").addEventListener("click", () => download("quiet-dm-save.json", Q.exportSave(state)));
  $("save-warning-export").addEventListener("click", () => download("quiet-dm-save.json", Q.exportSave(state)));
  // Imports are real buttons opening the file picker, so the keyboard
  // can reach them; the inputs themselves stay hidden.
  function clearError() {
    els.errorNote.textContent = "";
    els.errorNote.hidden = true;
  }
  $("import-btn").addEventListener("click", () => { clearError(); $("import-file").click(); });
  $("import-thread-btn").addEventListener("click", () => { clearError(); $("import-thread-file").click(); });
  $("log-btn").addEventListener("click", () => {
    const view = Q.observe(state);
    download(slug(view.thread.title) + ".txt", Q.exportLog(state), "text/plain");
  });
  $("logall-btn").addEventListener("click", () => download("quiet-dm-all-logs.txt", Q.exportAllLogs(state), "text/plain"));
  $("export-thread-btn").addEventListener("click", () => {
    const view = Q.observe(state);
    download(slug(view.thread.title) + ".thread.json", Q.exportThread(state));
  });
  $("import-thread-file").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (!f) return;
    clearError();
    f.text().then((text) => {
      try {
        const out = Q.importThread(state, text);
        resetLean();
        Q.dispatch(state, { type: "thread.open", threadId: out.threadId });
        save(); render();
      } catch (err) {
        showError(new Error("That file is not a valid Quiet DM thread."));
      }
      e.target.value = "";
    });
  });
  $("import-file").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (!f) return;
    clearError();
    f.text().then((text) => {
      try {
        state = Q.importSave(text);
        resetLean();
        save(); render();
      } catch (err) {
        showError(new Error("That file is not a valid Quiet DM save."));
      }
      e.target.value = "";
    });
  });

  render();
  if (loadNotice) {
    // The set-aside notice carries its own download: the backup copy
    // must be reachable without developer tools, whether it reached
    // storage (read it back from its key) or only lives in memory
    // for this page (download the held copy).
    $("backup-notice-text").textContent = loadNotice.text;
    const btn = $("backup-notice-download");
    btn.textContent = loadNotice.buttonLabel;
    btn.addEventListener("click", () => {
      let text = loadNotice.raw;
      if (loadNotice.backupKey) {
        try { text = localStorage.getItem(loadNotice.backupKey) || loadNotice.raw; } catch (e) { /* keep the in-memory copy */ }
      }
      download(loadNotice.fileName, text);
    });
    $("backup-notice").hidden = false;
  }
})();
