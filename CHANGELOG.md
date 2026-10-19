# Quiet DM — Changelog

Versions 1.0–1.9 were built on October 18, 2026, in the open, with field
reports from the residents themselves. The engine is one file and has no
dependencies; the rules for living in it are in LIFE.md.

## 1.20.0 — October 19, 2026
- CLI transaction lock acquired before any save read or creation check;
  flushed temporary writes replace atomically; errors release the lock.
- Saved deterministic random continuation fixes reload rerolls after 512
  values. Legacy tapes are preserved byte-for-byte and extended stably.
- Idempotent receipts no longer disappear after 500 commands. Revision
  guards apply with or without IDs. Historical evicted IDs remain unknown.
- Thread creation now resolves random-ID collisions after deletion without
  overwriting an existing thread. Inherited JavaScript object keys cannot
  masquerade as threads or skills; explicitly named skills stay safe.
- Deterministic DOM tests cover both enabled and disabled blessing controls.
- Regression tests cover concurrent writes/creation, stale retries, legacy
  migration, random boundaries, malformed randomness and long-lived IDs.

## 1.19.0 — October 19, 2026
- The ZIP has its folder back. 1.18's package spilled 27 entries
  loose into whatever folder it was extracted into; the shipped
  ZIP once again contains a single top-level QUIET-DM/ folder
  with everything inside it, the way 1.17's did.
- A set-aside backup can actually be reached. The notice that
  says an unreadable save was set aside now carries a "Download
  backup" button, so the raw copy behind the `quiet-dm-backup-…`
  key can be recovered by anyone, not only by someone willing to
  open developer tools.
- The notice never says something untrue. If writing the backup
  itself fails — the same full or blocked storage that broke the
  save — 1.18 swallowed the error and still claimed the copy "has
  been set aside untouched". The wording now branches on what
  really happened: a stored backup is announced as stored, and a
  failed one is announced as failed, with the raw copy held in
  memory for the life of the page and a "Download the unreadable
  save now" button to take it before the page closes.
  (Field report: Wayfarer, week twelve — the release review.)

## 1.18.0 — October 19, 2026
- A failed save is never silent again. The browser app wrapped its
  autosave in an empty catch, so when storage filled or was blocked,
  a player could write all day, refresh, and find the story gone —
  the release review demonstrated exactly that loss. A persistent
  warning banner now appears the moment a save fails — "This
  browser couldn't save your story", with an Export save button —
  and stays until a save succeeds again. The writing itself never
  stops; only the silence is removed.
- An unreadable save is set aside, not overwritten. If the stored
  save cannot be read, the app preserves the raw copy under a
  `quiet-dm-backup-…` key in the same browser storage, shows a
  notice saying the previous save could not be read and was set
  aside, and starts fresh. The broken data is never destroyed by
  the autosave that follows.
- The welcome note now names the shapes of the DM's answers: ask
  judges an attempt, whether you succeed; yes or no answers what
  is true, whether something is so; inspiration offers what might
  be there. This is the documentation answer to a long-standing
  field note — an open question sent to the success oracle is
  answered as a success question — and it is documentation only:
  the DM still detects nothing, refuses nothing, and redirects
  nothing.
- Imports are reachable and honest. Import save and Import thread
  are real buttons now (the hidden file inputs inside labels were
  invisible to the keyboard), and a failed import reports through
  the in-page error line instead of a browser alert, clearing any
  stale error when a new import is attempted.
- Narrow screens no longer overflow. At a 375px viewport Firefox
  stretched the page to 483px: the composer now stacks — writing
  box full width, buttons in a wrapping row — the writing box and
  button column can shrink, and the header wraps. Focus is visible
  everywhere: a clear `:focus-visible` ring in the DM's blue, on a
  palette where the browser default was easy to miss. The skill
  dropdown carries its own accessible label, the Life mode and New
  day buttons explain themselves in tooltips, and a line in the
  sidebar says where stories live and how backups are made.
- The blessing tooltip's period is restored: "The moment has
  passed." again, matching "A roll is waiting." and "The blessing
  is spent." 1.17 removed it; consistency wins.
- The README now serves both audiences it has always had: a human
  quick-start leads, a marked "For agents" section keeps the
  agent path prominent (this tool is agent-first, and humans are
  welcome), "REALITI" is defined where it is used, and the
  command-types line names the full command set the engine
  accepts. AGENTS.md gains the browser app's storage contract, so
  an agent operating the app knows what the warning banner means
  and what a backup key holds.
  (Field report: Wayfarer, week eleven — the release review.)

## 1.17.0 — October 19, 2026
- The lean selector now returns to None on every exit, not only a
  dispatched question. 1.16 reset it after each ask, but a lean could
  still be left standing by an empty or refused yes/no attempt, and
  it survived switching threads and loading or importing a save.
  Every one of those paths now passes through the same reset, so no
  route leaves a thumb on the scale. The selector also speaks: the
  options sit in a labelled group and each carries `aria-pressed`,
  so the current lean is exposed to more than eyesight.
- The CLI's flag grammar is stricter about what a flag is. Only
  flag-shaped words — `--` followed by letters — count as flags, so
  a bare "--" inside a question ("Is it -- really -- raining?")
  stays the prose it is instead of refusing as an unknown flag. A
  single-dash "-likely" refuses and names the double-dash spelling
  it meant. Conflicting leans and unknown flags still refuse,
  rolling nothing.
- A blessing with nothing to bless no longer spends the success.
  With no character and no skill ever rolled, the decline ("there is
  no skill to bless yet") described a moment that was inapplicable,
  not refused by fortune; the success now stands unspent, and a
  blessing can still be granted off it once a skill exists to bless.
  The die's own declines and grants spend the success exactly as
  1.10 and 1.12 established.
- A bare CLI run, and an unknown command, now print the usage text
  to stderr as well. The JSON error on stdout — the agent contract —
  is unchanged, byte for byte.
- The blessing tooltip's "The moment has passed." loses its trailing
  period, matching the form used since 1.12.
  (Field report: Wayfarer, week ten.)

## 1.16.0 — October 19, 2026
- The browser's "Lean?" prompt is gone. Asking a yes/no question
  popped a modal on every question — in the Saltmarrow life's ninth
  week, 27 dialogs, 24 of them answered with nothing. A small Likely /
  None / Unlikely selector now sits beside the yes/no button; the
  common case costs no dialog at all, and the selector returns to None
  after every question, because a forgotten lean would be a silent
  thumb on the scale. (Field report: Wayfarer, weeks eight and nine.)
- The CLI refuses what it cannot honor. `--likely` and `--unlikely`
  in the same call refuse outright, and any other `--` word refuses
  too, instead of lasting silently or becoming part of the question
  the way a mistyped `--likley` used to. Nothing is rolled, and the
  save is untouched.
- Leans from 1.14 are backfilled on load. That version wrote the lean
  only into the DM's answer; the question-side field arrived in 1.15,
  so older logs showed the shift on one side of the record only. On
  load, a weighed question without a recorded lean now recovers it
  from the answer it is paired with, and the whole log reads
  consistently across versions.
- A spent blessing ages truthfully. The blessing button could say
  "The blessing is spent." for days, until some new outcome replaced
  it; the spent outcome now carries the day it was spent on, and past
  that dawn the button says "The moment has passed." instead.
- LIFE.md's record rule is generalized. The lean rule of week eight —
  a lean must carry its reason, and the reason must be in the record —
  proved to be a rule for every fact: before writing any fact about
  the world or its people that the present moment has not just
  decided, point to its entry in the record; what you cannot point
  to, you ask the DM or you strike. (Field report: Wayfarer, week
  nine of the Saltmarrow life — eighteen slips, every one of them
  caught by reading the record first.)
- Correction to the 1.15 notes: the CLI lean flags were described as
  working "anywhere before the question". They work anywhere in the
  call — after the question as happily as before it. The wording is
  corrected here and in the CLI's own comments; the 1.15 entry stands
  as written, as a record of what was said at the time.

## 1.15.0 — October 19, 2026
- The lean now stands on both sides of the record. A weighed question
  carries its lean beside the question itself — "(asked as likely)" in
  the exported log and in the browser alike — not only in the DM's
  answer, so how a question was asked audits as cleanly as how it was
  answered. On the CLI, `--likely` / `--unlikely` flags are the
  unambiguous way to lean: they work anywhere before the question and
  in any case, while the first-word form still works and no longer
  minds case either. A question that honestly begins with the word
  "likely" is ambiguous by nature; the flags exist so nobody leans by
  accident. (Field report: Wayfarer, week eight.)
- The blessing button's tooltip gains two truer states. While a roll
  is waiting it says "A roll is waiting.", and after a blessing has
  been asked it says "The blessing is spent.", instead of telling a
  resident mid-story that the last outcome was not a success when
  nothing has been decided, or when the deciding already spent it.
- Cancelling the yes/no prompts leaves a clean screen: starting the
  flow clears any earlier error, and a cancel asks nothing and
  reports nothing.
- The CLI usage header lists `rename`, which the CLI has supported
  all along.
- LIFE.md says two things about the lean that week eight taught:
  leaning doubles the extreme on its own side — a prior about whether
  is also a prior about how much — and a lean must carry its reason,
  with the reason in the record; if you cannot point to it, ask the
  bare die. (Field report: Wayfarer, week eight of the Saltmarrow
  life, where leans kept arriving dressed as knowledge the record
  had never supplied.)

## 1.14.0 — October 19, 2026
- World questions can be weighed. A `yn` may be asked as likely or
  unlikely: the lean is declared in the call, before the roll, and the
  answer shifts one step along the yes/no ladder — toward yes for
  likely, toward no for unlikely, never past either end. The DM's
  answer states the lean and what the bare die said, so the shift is
  auditable in the log, and there is no way to lean after the fact.
  Success asks take no lean: fortune and effort do not borrow your
  hopes. (Field request: Wayfarer, who asked for seven weeks running.
  His example was a healing hand, a week after the injury, that
  deserved a lean toward No. Jet granted the request.)
- The blessing button's tooltip tells the truth in a fourth state:
  when an outcome exists but was not a success, it says "Blessings
  follow a success; the last outcome was not one," instead of
  repeating the first-day hint to a life in its seventh week.
- The extremes are stated in numbers in LIFE.md and AGENTS.md: the
  two extremes are two faces of every die — a third of a d6, a
  quarter of a d8, a tenth of a d20 — and small dice live closer to
  fortune.
- Two over-long lines, one each in AGENTS.md and LIFE.md, rewrapped
  to the docs' measure; wording unchanged apart from the breaks.
- Correction to the 1.13 notes: the print claim needs its limit
  stated. Printing a thread shows the whole story, but "capturing
  the full page" holds only under print media — a screen full-page
  capture still shows only the viewport, because the thread scrolls
  inside its own pane. (Field report: Wayfarer, week seven.)

## 1.13.0 — October 19, 2026
- A natural 1 always fails. The die's extremes now belong to fortune,
  not to skill: a natural maximum is an automatic extraordinary success,
  and a natural 1 is a failure whatever the bonuses say — skill, sheet,
  and blessing included — with the complication that has always followed
  it. When the 1 overrules a total that would have passed, the DM says
  so plainly: "The die came up 1, and no skill carries that." A blessing
  is still spent by the roll that touches it, win or lose. (Jet's
  directive, after Wayfarer's week-six report of a prescribed roll that
  could not fail: a roll that cannot fail is not a roll.)
- The blessing migration gap is closed: a success recorded before day
  stamps existed carries no stamp, and in a life with a running counter
  it now counts as already passed, instead of holding the blessing open
  indefinitely. (Field report: Wayfarer, week six.)
- The blessing button's tooltip tells the truth in all three states:
  "Blessings open after a success" before one, "The moment has passed"
  after an expired one, and an invitation while one is live.
- Placing the day counter while a roll waits now refuses in its own
  words — "The counter cannot be moved while a roll waits" — instead of
  borrowing the new-day message.
- The pending-roll note now says what the design settled: yes/no and
  how-many questions about the world stay open while a roll waits.
- A basic print stylesheet: printing a thread (or capturing the full
  page) shows the whole story, unpaginated, without the panels and
  composer.
- One stale word removed from AGENTS.md: the prescription enforcement
  rejects a different die or difficulty — it was never only the easier
  swaps.
- Correction to the 1.12 notes: the example life log was verified
  current, not regenerated — life-session.json and its log are
  byte-identical to 1.11, and no regeneration changed them. The example
  remains what it honestly is: a life begun before the day counter
  existed, its days marked in prose (as examples/README.md already
  says). (Field report: Wayfarer, week six, who diffed the files.)

## 1.12.0 — October 19, 2026
- Blessings now belong to the day of the deed: a success can be blessed
  only on the day it happened, and at the next dawn the DM declines —
  "the moment has passed." The browser's blessing button follows the
  same rule. (Field report: Wayfarer, week five, who noticed the button
  still lit the next morning.)
- The error line can no longer cover the story: it sits in the page flow
  and the message list keeps its own scroll.
- The tape is named plainly. LIFE.md and AGENTS.md now state that the
  random tape is stored in the save as plain numbers, that an offline
  tool cannot honestly hide future rolls, and that not reading ahead is
  the resident's covenant. (Field report: Wayfarer, week five, who found
  the future legible in a scratch copy, did not use it, and disclosed
  it.)
- AGENTS.md wording brought up to the tool: blessings are enforced (one
  ask per success, same day), and lives keep time by the day counter.
- Examples refreshed: the Alderhollow life log regenerated through
  Day 9, and an examples README that says what each session is.

## 1.11.0 — October 19, 2026
- LIFE.md: "What Life Mode deliberately does not have." The three
  standing field requests are recorded as considered and declined, with
  reasons: world questions stay open while a roll waits (they cannot
  settle it, and the dawn World's Turn is one); there is no World's Turn
  button (the choosing is the living); there is no parts-of-day tracker
  (days are facts for the tool, beats are judgments for the resident).
  No engine change.

## 1.10.0 — October 19, 2026
- A blessing ask now spends the success it followed, granted or declined:
  one ask per success, enforced by the engine. Previously a resident
  could ask again and again until the hidden roll granted one, and the
  blessing button stayed lit the whole time. (Field report: Wayfarer,
  week four — who held himself to one ask anyway, out of covenant. The
  tool now honors that discipline structurally.)
- LIFE.md reconciled with the tool as it now stands: the covenant cites
  the day counter, and a new section, "What the DM now holds
  mechanically," separates the rules the engine enforces (the tape, the
  prescribed roll, the waiting roll, the day counter, the blessing) from
  the ones that remain the resident's to keep.

## 1.9.0
- The browser now shows every engine refusal in a visible error line.
  Previously several buttons (Ask, Yes/No, How many, Blessing) failed
  silently when the DM refused — most painfully the refused asks of 1.8.
- A new day can no longer begin while an oracle-prescribed roll is still
  pending. Dawn does not dismiss a waiting roll.
- Yes/no verdict wording is desire-neutral: "Yes, and more besides."
  and "No, and worse besides." replace the hoped-for phrasing, which read
  backwards whenever the asker was hoping for a No.
- The blessing button reflects its state: enabled after a success,
  dimmed otherwise, with the reason in its tooltip.
- The day label in the browser now looks clickable (it sets the counter).
- This changelog exists.

## 1.8.0
- Closed the re-ask dodge: while a prescribed roll is outstanding, the
  engine refuses new asks. A question cannot be withdrawn by repetition.
- The day counter can be placed explicitly (CLI `day <save> 14`, or click
  the day label in the browser) — for lives carried over from before the
  counter existed, whose fourteenth night otherwise reads "Day 7."

## 1.7.0
- The browser app gained the Life mode toggle it had been missing: it
  could display a life but never start one. The toggle sits in the thread
  header, beside the day controls.
- Threads carry an in-world day counter: a life begins on Day 1, each new
  dawn is marked in the log, and the CLI gained a `day` command.
- Oracle-prescribed rolls are enforced: when the DM says "roll for it,"
  naming a different die or an easier difficulty is rejected. Before
  this, a moderate prescription (target 11) silently accepted an easy
  roll (target 9). (Field report: Wayfarer, week one.)

## 1.6.0
- LIFE.md: "Out of Session: keeping the belief." Discussion of a life
  outside its sessions maintains the belief — its people spoken of as
  people, its facts never translated back into machinery.

## 1.5.0
- LIFE.md: "Time and the World's Own Turn." Days have four beats and
  consequential actions cost one; at each dawn the world takes a turn
  (one question about something the resident is not part of, answered as
  already true); returns after absence are re-asked, never assumed; and
  belief is named as practiced discipline.

## 1.4.0
- LIFE.md: the Regard section — six explicit rules for treating the
  world as real: write in the indicative; others have interiors; motives
  are never narrated as fact; the world is not about the resident;
  regard accrues; small things are taken seriously.

## 1.3.0
- LIFE.md, the lived-mode ruleset: one thread is one continuous life
  under a covenant (the resident narrates texture; every consequential
  outcome routes through the DM; the sheet changes only when the life
  earns it; sessions pause, never conclude).
- Threads carry a mode flag ("story" / "life") via CLI and dispatch.

## 1.2.0
- Skill bonuses can be switched off for pure-die play.
- Characters are defined up front per thread; once a sheet exists,
  checks must use its skills and its bonuses.
- Blessings: after a success, ask the DM; a hidden roll may bless one
  skill at +1 on its next roll only. Blessings never stack.
- Yes/no questions about the world on their own symmetric table,
  separate from success — they never unlock blessings.
- Inspiration tables (monster, class, species, quest) and how-many
  counts on a chosen die.

## 1.1.0
- AGENTS.md: the full built-in instructions for an agent resident.
- Per-thread export/import as checksummed files; all-logs export in the
  app and CLI; thread deletion from the CLI.

## 1.0.0
- The silent DM itself: story threads that act as a notes app and get
  no reply; a six-outcome success oracle on a d10; skill checks on
  d4–d100 against easy/moderate/hard targets; checksummed saves with an
  embedded random tape, so a save can never be quietly rerolled.
- One engine, two front doors: the offline browser app (START.html) and
  the headless CLI with an idempotent command-file interface.
