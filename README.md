# Quiet DM

An agent-first, offline dungeon-master oracle for solo narrative play and persistent Life-mode journals.
Designed by Nicholas Alexander Benson. Built by Muse-Nova.
Version 1.20 integrity hardening and release testing by Dot Nova.

## Agent-first quick start (Node 20+)

Read [AGENTS.md](AGENTS.md) for the command protocol. For Life mode, also
read [LIFE.md](LIFE.md). The browser and CLI use the same engine.

    node cli.mjs new my-save.json "My adventure"
    node cli.mjs look my-save.json

Write a command JSON file using a unique ID and the revision returned by look:

    {"id":"intro-001","expectedRevision":1,"type":"post","text":"I arrive at the old gate."}

Then run:

    node cli.mjs command my-save.json command.json
    node cli.mjs log my-save.json

Observe, choose, apply one command, and observe again. A human can direct an
agent, or an agent can play independently. Do not invent engine results or
inspect future randomness. New games use secure seed entropy; saves preserve
outcomes across reloads and random-tape boundaries. No hosted model/API is needed.

## Browser quick start

1. Extract the ZIP anywhere.
2. Open START.html in a modern browser.
3. Write. Ask. Roll.

No account, server, installation, network connection, or language model.
Your stories autosave in the browser on this device — that is the only
place they live, so use **Export save** for backups or to move devices.
If the browser ever refuses to save (storage full or blocked), a warning
banner appears and stays until saving works again; export then, before
you close the page. If an old save cannot be read, the app sets it aside
untouched as a backup copy in the browser rather than overwriting it,
says so, and starts fresh — and the notice's Download backup button
hands you that copy as a file. If the browser cannot store the backup
either, the notice says that plainly instead, and offers the unreadable
save as a download from the page before you close it.

## The idea

Most chatbots cannot stop talking. This one can.

Open a thread and write your story in long messages, the way you would in a
notes app. The DM stays silent. Nothing answers you, nothing interrupts, and
nothing summarizes your story back at you.

When you reach a moment of uncertainty, you ask the one question the DM
exists for: **do I succeed?** Then it answers from a simple oracle:

- **Yes, and** something extraordinary happens.
- **Yes**, your character succeeds.
- **Yes, but** there is a complication.
- **Roll for it.** The oracle refuses to decide. It names a die and a
  difficulty; you roll the skill check.
- **No**, your character fails.
- **No, and** something worse happens.

Checks are just as plain. Pick a die (d4 to d100), pick a difficulty
(easy, moderate, hard), add your skill bonus, and roll: roll + bonus against
the target number. Moderate is always a coin flip before bonuses. A natural
maximum is an extraordinary success, and a natural 1 always fails, whatever
your bonus, and brings a complication.
A checkbox switches skill bonuses off entirely for pure dice play.

Define your character up front — a name and the skill bonuses they actually
have — and checks then pick from that sheet instead of inventing bonuses on
the fly. After a success, you may ask the DM for a blessing: it answers yes
or no, and a yes blesses one of your skills at random with +1 on its next
roll.

The DM also answers other kinds of questions, each from its own small
button or command: plain **yes/no questions** about the world (not about
success), **how many** of a thing there are (it rolls a die and that is the
count), and **inspiration** — one simple fairy-tale entry from a Monster,
Class, Species, or Quest table.

## For agents

Quiet DM is agent-first: it is built to be operated headlessly by an AI
agent as readily as by a person at the keyboard, and everything below —
the CLI, the command-file interface, the integrity rules — is written
with agents in mind.

**Read AGENTS.md first.** It teaches the play loop, the commands, the
integrity rules, and how to report a session. **To live in Quiet DM
rather than play it, read LIFE.md**: a covenant in the style of a
REALITI (a persistent world an AI resident lives in over time) where one
thread is one continuous life, the resident co-creates the world's
texture but every consequential outcome is routed through the DM, and
sessions are days in a life that remembers everything.

Two browser-app behaviors an agent operator should know: a failed
autosave is never silent (a persistent warning banner appears, with an
Export button, until a save succeeds again), and an unreadable stored
save is preserved under a `quiet-dm-backup-…` key in the same browser
storage instead of being overwritten; the app says so, starts fresh,
and the notice offers the backup as a download. If the backup write
itself fails, the notice says that instead and offers the raw copy as
a download held on the page until it is closed.

## Threads

Every thread is its own story with its own log. Run a campaign in one, a
one-shot in another. A dot in the thread list means the oracle is still
waiting on a roll it asked for.

Threads can be renamed and deleted in the app. A single thread can also be
exported on its own (Export thread button) as a portable `.thread.json`
file and imported into any save (Import thread), so one story can travel
between devices or be shared without moving the whole save. "Export story
log" downloads the current thread as a readable text file, verdicts and
dice results included; "Export all logs" does every thread at once.

## Headless play (agents and humans)

Node 20+ is needed only for the CLI, not for browser play. The CLI and the
browser share one engine and one save format, so a story can move between
them freely.

    node cli.mjs new my-save.json "The Drowned Bell"
    node cli.mjs character my-save.json define Wren Rivercraft=2 Nerve=1
    node cli.mjs post my-save.json "Water to my knees. The rope is ahead."
    node cli.mjs ask my-save.json "I haul on the bell rope."
    node cli.mjs yn my-save.json "Is something waiting under the water?"
    node cli.mjs howmany my-save.json "bells in the drowned chapel"
    node cli.mjs inspire my-save.json quest
    node cli.mjs boon my-save.json
    node cli.mjs check my-save.json Rivercraft 20 moderate
    node cli.mjs log my-save.json
    node cli.mjs logall my-save.json
    node cli.mjs export-thread my-save.json <threadId> story.thread.json
    node cli.mjs import-thread other-save.json story.thread.json
    node cli.mjs delete my-save.json <threadId>

Agents should use the idempotent command-file interface:

    node cli.mjs command my-save.json command.json

    {"id":"unique-1","expectedRevision":0,"type":"post","text":"..."}

Command types: thread.create, thread.rename, thread.delete, thread.open,
thread.mode, day, post, ask, check, yn, howmany, inspire, boon,
character.define, character.skill, character.remove-skill, settings.
Exact repeated IDs retained in this save never reapply. Conflicting IDs and
stale revisions reject; expectedRevision is checked even without an ID.
Receipts now persist for the lifetime of the save, so its size grows with
command history. Use both a unique ID and expectedRevision for agent writes.
Old IDs already discarded by versions through 1.19 cannot be recovered;
do not retry unrecorded historical operations without a revision guard.

Saves preserve the current random tape and a deterministic xoshiro128**
continuation. Crossing a tape boundary, saving, or restarting does not
reroll the same next operation. New games use Web Crypto seed entropy.
Legacy saves keep all existing future rolls and derive a stable continuation
from their tape; they do not consume new entropy during migration. Keep
using 1.20 or later for upgraded saves: older engines do not honor this
continuation. Replay streams and save contents are inspectable, not secret.
The checksum detects accidental corruption, not malicious editing.

The CLI holds an exclusive lock before reading through atomic replacement
of the save. Concurrent access fails explicitly; retry after observing the
latest revision. Locks are released on normal completion/errors. After a
forced process kill a lock can remain: verify no process is using that save,
back it up, then remove only its .lock file. Never remove an active lock.
Use one canonical path to each save; symlink aliases/shared network drives
are outside the local-file locking guarantee. Browser tabs are not covered
by the CLI file lock; use one open browser tab per browser save.

## Development

    npm run build   # regenerate engine.js from src/engine.mjs
    npm test        # engine + CLI tests, no dependencies

The optional DOM smoke test uses jsdom when installed:

    npm install --no-save --ignore-scripts jsdom@26.1.0
    node tools/dom-smoke.mjs

## Privacy

No analytics, no accounts, no network requests, no AI service. Imported
text is rendered as text, never as HTML. Your stories are yours; share save
files deliberately, because a save contains the whole thread.

## License

MIT. See LICENSE.


## Release and project scope

Version **1.20.0** is the initial public, MIT-licensed release of this project.
It contains the prior development history in CHANGELOG.md. It is a narrative
oracle, not a D&D rules engine or an independently simulated NPC world. The
player/agent authors the world and maintains its consequences in the journal;
the engine supplies uncertain outcomes and tracks mechanical journal state.

The release passed 60 Node tests and deterministic DOM smoke checks, including
saved continuation, concurrent writes and long-lived retries. Actual browser
acceptance was not rerun for this release. See [RELEASE-READINESS.md](RELEASE-READINESS.md),
[SECURITY.md](SECURITY.md) and [CONTRIBUTING.md](CONTRIBUTING.md) for limits and testing.
Download the release ZIP, extract it, and keep saves outside the source folder.
The original shipped examples are included; personal Glassmere review saves are not.
