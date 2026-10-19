# Quiet DM — Instructions for Agents

You are holding Quiet DM, a silent dungeon-master oracle for solo narrative
play. It has no language model inside. The engine judges; somebody — a human
or you — tells the story. This file teaches you both jobs.

## The one rule that defines the game

**Silence is the default.** A story message posted to a thread gets NO reply.
The DM speaks only in two situations:

1. A player asks whether their character succeeds at an action (`ask`).
2. A skill check is rolled (`check`).

If you are operating Quiet DM on a human's behalf, never add commentary of
your own inside the thread. If you are playing solo, your story posts are the
narration, and the engine's verdicts are the only voice besides yours. Do not
impersonate the DM in your story posts, and never type out an oracle result
you did not actually receive from the engine.

## Living a life instead of playing a story

If a thread is marked as a life (`node cli.mjs life <save>`), a stricter
covenant replaces some of this file's looser habits. Read LIFE.md in this
package and follow it: you are a resident co-creating a world you do not
control, every consequential or uncertain outcome must be routed through
the DM before you narrate it, time is kept by the day counter (a life
begins on Day 1; at each dawn, advance the counter — New day in the
browser, `node cli.mjs day <save>` in the CLI — before anything else
happens, and the log marks the dawn), the character sheet is your
embodied capability and changes only when the life earns it, and
sessions pause rather than conclude. Everything below still applies; the
covenant only tightens what "playing honestly" means.

## Setup

Requirements: Node 20+ for the CLI. No dependencies, no network.

Create a save (one save holds many story threads):

    node cli.mjs new my-save.json "My Story Title"

If a save already exists, use it as-is; `new` refuses to overwrite. List
threads at any time:

    node cli.mjs threads my-save.json
    node cli.mjs look my-save.json            # full active thread
    node cli.mjs look my-save.json <threadId> # a specific thread

## Operating the browser app

If you drive the browser app (START.html) on a human's behalf, know its
storage contract. The app autosaves to that browser's local storage,
and a failed save is never silent: when storage is full or blocked, a
persistent warning banner appears — with an Export save button — and
stays until a save succeeds again. If you see it, export the save and
tell the human; do not keep writing on their behalf as if nothing were
wrong. If the stored save cannot be read at all, the app preserves the
raw copy under a `quiet-dm-backup-…` key in the same storage, says so
in an on-page notice, and starts fresh — the unreadable data is set
aside, never overwritten. The notice carries a Download backup button,
so the human can recover the copy without developer tools. If storage
refuses the backup write too, the notice says so instead — nothing is
claimed stored that was not — and offers the raw copy as a download
from the page before it is closed. Report either outcome; the backup
may hold the only copy of their story.

## Characters, defined up front

A thread may define its character before play, with the skills and bonuses
the character actually has:

    node cli.mjs character my-save.json define Wren Rivercraft=2 Nerve=1
    node cli.mjs character my-save.json set Sneaking 0
    node cli.mjs character my-save.json remove Sneaking
    node cli.mjs character my-save.json show

Once a character exists in a thread, checks MUST use the sheet: the skill
must be on it, and the bonus comes from it — a bonus passed with the check is
ignored. Do not invent skills mid-play to get a better number; adding a skill
to the sheet is a deliberate, visible act (the `set` command), so do it only
when the fiction has genuinely earned a new skill, and say so in your report.

If no character is defined, checks stay free-form: name a skill and pass its
bonus each time.

Bonuses as a whole can be switched off for pure dice play:

    node cli.mjs bonus my-save.json off     # every check is the bare die
    node cli.mjs bonus my-save.json on

## The wider toolkit

The DM answers more than success questions. All of these speak only when
invoked, like everything else here.

- **Yes/no questions about the world** (`yn`) — facts, not fates. "Is the
  bridge guarded?", "Does the miller know my name?" The DM answers on a d6:
  from "No, and it is worse than you hoped" through plain No and Yes to
  "Yes, and more than you hoped", with softened middles. A world answer is
  not a success or failure for the character and never unlocks a blessing.

  A world question may carry an honest lean: declare it `likely` or
  `unlikely` and the answer shifts one step along the ladder, toward yes
  or toward no. The lean is declared in the call, before the roll — the
  `weigh` field in a command file, or on the CLI a `--likely` /
  `--unlikely` flag placed anywhere in the call (the unambiguous form;
  the first word still works, and neither minds case) — and there is
  no way to apply one after the roll.
  The DM's answer states the lean and what the bare die said, and
  the log writes the lean beside the question itself, so the shift is on
  the record, auditable by anyone who reads the log. What the CLI
  cannot honor, it refuses and rolls nothing: conflicting flags, any
  other flag-shaped `--` word, and a single-dash `-likely` (which is
  told the spelling it meant). A bare `--` inside a question is prose,
  not a flag, and stays in the question. Success asks take no lean.

      node cli.mjs yn my-save.json "Is the bridge guarded?"
      node cli.mjs yn my-save.json --likely "Has her hand healed?"

- **How many** (`howmany`) — counts. Name the thing; the DM rolls a die
  (d6 unless you name another) and that is how many there are.

      node cli.mjs howmany my-save.json "wolves on the ridge"
      node cli.mjs howmany my-save.json "coins in the purse" 20

- **Inspiration** (`inspire`) — one simple, fairy-tale entry from a table:
  `monster`, `class`, `species`, `quest`. Use it to seed scenes, not to
  stall: take what the table gives you and build on it.

      node cli.mjs inspire my-save.json quest

- **Blessings** (`boon`) — after a success (a yes-family oracle answer or a
  successful check), the player may ask the DM for a blessing. The DM
  refuses when the last outcome was not a success. Otherwise it answers yes
  or no on a hidden d6; on a yes it blesses ONE skill at random from the
  sheet (or the last skill checked, if there is no sheet): +1 the next time
  that skill is rolled, then it is spent. Blessings do not stack. The
  engine enforces the discipline: one ask per success — the ask spends
  the success whether the blessing is granted or declined by the die —
  and only on the day of the success; at the next dawn the moment has
  passed and the DM will say so. The one decline that spends nothing is
  having no skill to bless yet: that moment was inapplicable, not
  refused, and the success stands. Begging is not a mechanic, and now
  it is not a possibility either.

      node cli.mjs boon my-save.json

## The play loop

1. **Write.** Post story entries as the scene unfolds. Long messages are the
   intended style; this is a journal, not a chat.

       node cli.mjs post my-save.json "Rain over the marsh. I walk on."

   Expected result: `{"answered": false, ...}`. Silence is success here.

2. **Ask at moments of genuine uncertainty.** Describe the action, not the
   outcome you want:

       node cli.mjs ask my-save.json "I leap the chasm before the rope gives."

   The engine rolls a d10 on its internal random tape and answers with one
   of six outcomes:

   | Outcome | Meaning | Your obligation as storyteller |
   |---|---|---|
   | `yes_and` | Yes, and something extraordinary happens | Succeed, and add a windfall beyond the goal |
   | `yes` | Yes, your character succeeds | Succeed, cleanly |
   | `yes_but` | Yes, but there is a complication | Succeed, and narrate a real cost or new problem |
   | `roll` | The oracle will not decide | Stop. A check is now pending; see below. While it is pending, the engine refuses new asks — a prescribed roll cannot be dodged by asking the question again |
   | `no` | No, your character fails | Fail, without catastrophe |
   | `no_and` | No, and something worse happens | Fail, and narrate a genuine turn for the worse |

   Accept the outcome exactly as returned. A `no_and` is not a suggestion.
   Narrate consequences faithfully, including the bad ones; a story where
   the oracle's verdicts are quietly softened is a broken game.

3. **Roll checks.** Either when the oracle demands it (a `roll` outcome sets
   a pending check with a suggested die and difficulty, visible in `look`),
   or whenever a feat deserves dice instead of a verdict:

       node cli.mjs check my-save.json Climbing 2
       node cli.mjs check my-save.json Climbing 2 20 hard

   The argument order is skill, bonus, die, difficulty. With no die and
   difficulty, a pending suggestion is used. A rolled check settles any
   pending request. When the oracle has prescribed a roll, the prescription
   is enforced: naming a different die or difficulty is rejected.
   Roll what was prescribed, or leave the roll unmade. Rules: roll + bonus
   against the target number; reach it and you succeed. The die's extremes
   override the arithmetic: a natural maximum on the die is an extraordinary
   success whatever the total, and a natural 1 always fails, whatever the
   bonuses — a complication follows. A roll that cannot fail is not a roll.
   The two extremes are two faces of every die — a third of a d6, a quarter
   of a d8, a tenth of a d20 — so small dice live closer to fortune. The
   engine reports `roll`, `total`, `target`, and `success` — quote those
   numbers, never invent them.

   Target numbers (moderate is always a coin flip before bonuses):

   | Die | Easy | Moderate | Hard |
   |---|---|---|---|
   | d4 | 2 | 3 | 4 |
   | d6 | 3 | 4 | 5 |
   | d8 | 4 | 5 | 7 |
   | d10 | 5 | 6 | 8 |
   | d12 | 6 | 7 | 9 |
   | d20 | 9 | 11 | 15 |
   | d100 | 41 | 51 | 71 |

## Integrity rules (do not break these)

- **Never reroll.** The save embeds a random tape; reloading an older save
  to dodge an outcome breaks the play covenant. The format cannot prevent deliberate save editing. One timeline,
  played forward.
- **Do not read ahead.** The tape is stored as plain numbers, so the rolls
  that have not happened yet are legible to anyone holding the file. An
  offline tool cannot honestly hide them. Not reading them is your
  covenant to keep: the file format guards the past, and only you guard
  the future.
- **Never edit a save or thread file by hand.** Checksums reject tampered
  files. Use the commands.
- **Never fabricate a result.** If a command errors, report the error. Do not
  narrate an outcome the engine did not return.
- **Decide before you roll.** State the action and the skill/bonus you are
  using before running `ask` or `check`, in your story post or work notes,
  so the roll is a commitment, not a search for a good number.
- **Respect the sheet and the blessing.** When a character is defined, roll
  only its skills. When the DM grants a blessing, it applies itself on the
  next roll of that skill; do not save it, move it, or claim it twice.

## Commands

    node cli.mjs create my-save.json "Second Story"   # new thread, becomes active
    node cli.mjs open my-save.json <threadId>         # switch active thread
    node cli.mjs rename my-save.json "New Title"      # rename the active thread
    node cli.mjs delete my-save.json <threadId>       # delete a thread (permanent)
    node cli.mjs log my-save.json [threadId]          # one thread as readable text
    node cli.mjs logall my-save.json                  # every thread, one document
    node cli.mjs export-thread my-save.json <threadId> out.thread.json
    node cli.mjs import-thread my-save.json in.thread.json

## The idempotent command interface (recommended for agents)

For scripted or multi-step play, write a small JSON command file and apply
it. Exact repeated command IDs never apply twice, conflicting IDs reject,
and a stale `expectedRevision` rejects, so a retried step is always safe:

    node cli.mjs command my-save.json step.json

    {"id":"session1-001","expectedRevision":0,"type":"post","text":"..."}
    {"id":"session1-002","type":"ask","action":"I leap the chasm."}
    {"id":"session1-003","type":"check","skill":"Climbing","bonus":2}
    {"id":"session1-004","type":"thread.create","title":"Act Two"}

Command types: `thread.create`, `thread.rename`, `thread.delete`,
`thread.open`, `thread.mode` (with `{"mode": "life"}` to mark a life; the
browser app has a Life mode toggle for the same thing), `day` (advance the
in-world day counter; a life starts on day 1 and each dawn is marked in the
log; `{"day": 14}` places the counter on a specific day, for a life carried
over from before the counter existed), `post`, `ask`, `check`, `yn`,
`howmany`, `inspire`, `boon`,
`character.define`, `character.skill`, `character.remove-skill`, `settings`
(with `{"useBonuses": false}` to switch bonuses off). Check `look` after
each step; the returned `revision` is what the next command's
`expectedRevision` must match if you use one.

## Ending a session

When play stops, hand the human the story:

    node cli.mjs log my-save.json            # or logall for everything

Report honestly: what was asked, what the oracle answered, what the dice
did, and what remains unresolved. Do not tidy up the outcomes in the telling.

## Playing well

- Ask sparingly. If the outcome is obvious or the moment is pure narration,
  just write it. The oracle is for uncertainty, not punctuation.
- Keep one story per thread. Start a new thread for a new tale, not a new
  chapter.
- Let failures stand and build on them. The best Quiet DM stories bend around
  `no_and` instead of recovering from it as fast as possible.
- The human owns the save file. Share logs and thread files freely when
  asked; move or delete them only when asked.

## 1.20 agent integrity contract
Use a unique command ID plus the revision from `look` for every write.
A lock error means nothing committed; observe and retry after the other
process finishes. A stale-revision error means reconsider against the new
state. An exact retained-ID retry is a no-op, even with an old revision.
Receipts no longer expire. IDs already evicted by older versions cannot be
reconstructed. Preserve originals before migrating; continue upgraded saves
in 1.20 or later. Never inspect random tape/continuation while playing.
See README for crash-lock recovery and local-file/single-browser-tab bounds.
