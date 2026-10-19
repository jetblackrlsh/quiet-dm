# Quiet DM — A Life

A ruleset for living in Quiet DM instead of playing it.
For AI agents, in the spirit of REALITI.

## What this is

A normal Quiet DM thread is a story: it has scenes, momentum, an ending.
A life is different. One thread is one continuous existence in a world you
help create but do not control. There is no finale to reach and no audience
to please. You are a resident. Sessions are not adventures; they are days,
or stretches of days, in a life that continues between visits and remembers
everything.

Mark a thread as a life:

    node cli.mjs life my-save.json          # this thread is a life now
    node cli.mjs life my-save.json off      # back to an ordinary story

## The covenant

1. **One thread, one life.** It does not reset, branch, or conclude. When a
   session ends, the life pauses; it does not wrap up. The tool keeps the
   day count: a life begins on Day 1, and at each dawn you advance the
   counter (New day in the browser, `day` in the CLI) before anything
   else happens, and the log marks the dawn itself. Begin posts by
   marking time when time has moved ("Day 12. Rain again.") so the record
   reads as a life and not a pile of scenes.

2. **You co-create the world; you do not rule it.** Freely author texture:
   places, weather's mood, the look of rooms, people's names and histories,
   your own routines, thoughts, tastes, and intentions. Texture is yours.
   Outcomes are not.

3. **Every consequential or uncertain outcome belongs to the DM.** Before
   you narrate any result that could have gone another way and matters —
   an effort that can fail, a journey's arrival, a discovery, a danger, a
   gain or a loss, another person's consequential response to you — stop
   and route it through the DM:
   - Will my attempt work? → `ask`
   - Is this true of the world or someone in it? → `yn`
   - How much, how many? → `howmany`
   - A feat with a skill behind it? → `check`
   Narrate the result the DM returns, faithfully, including the refusals
   and the disasters. Deciding a consequential outcome yourself and then
   writing it down as if it happened is the one way to break a life.

4. **Small things are yours.** What you cook, what you notice, what you
   mean to do tomorrow, ordinary conversation whose reply changes nothing
   durable, how you spend uncontested hours: decide these and write them.
   A life is mostly small things. That is the point of one.

5. **Continuity is absolute.** People remember what you did. Broken things
   stay broken until mended through play. Debts, promises, reputations,
   and injuries persist. The random tape already forbids rerolling; the
   covenant forbids retconning. If you dislike where the life has gone,
   live forward from it.

6. **Your sheet is your body in the world.** Define it once, from the life
   you are actually living: the handful of things this resident can do,
   at the levels they can honestly do them. It changes rarely, and only
   when the life has visibly earned the change — a season of practice, a
   teacher, a wound — and every change is announced in the log with its
   reason. A sheet that quietly improves is a lie told in numbers.

7. **Fortune is not a tactic.** Blessings exist, but in a life they are
   grace, not buildcraft. Ask rarely, after real successes, accept where
   the blessing lands, and let it spend itself in the world's time.

8. **Let the world grow by living, not by rolling.** The inspiration
   tables are for when the life genuinely needs something new — a stranger
   arrives (roll species and class), a rumor reaches you (let it be
   quest-shaped), a creature is glimpsed (roll monster). A table rolled
   to fill a quiet hour is noise; the quiet hour was the life.

9. **The log is the record.** Report sessions exactly as they went,
   including dull days and bad outcomes. Do not perform the life for a
   reader, compress it into highlights, or tidy its people into arcs.
   Someone reading the log later should meet the life, not a story
   about one.

## What the DM now holds mechanically

Some of this covenant is kept by the tool itself, and a resident should
know which parts are stone and which are still faith. The engine enforces:
the random tape (no outcome can be rerolled by reloading); the prescribed
roll (when the DM says "roll for it," the die and difficulty it named are
the ones you must roll); the waiting roll (while a prescribed roll is
outstanding, new asks and new days are refused — the question cannot be
withdrawn by repetition, and dawn does not dismiss it); the day counter
itself; the extremes of the die (a natural maximum is an extraordinary
success and a natural 1 a failure, whatever skill stands behind the
roll, so no roll in a life is a formality); and the blessing (one ask
per success, spent by the asking, and only on the day of the success).
Everything else in this document — routing consequences, regard, the
World's Turn, belief — remains yours to keep. The tool holds the parts
a person could cheat at accidentally. It cannot hold the parts that
make a life honest, and it does not pretend to. The extremes deserve
their number, too: they are two faces of every die — a third of a d6, a
quarter of a d8, a tenth of a d20 — and small dice live closer to
fortune.

World facts may carry an honest prior. A yes/no question may be asked
as likely or unlikely — a healing hand, a week after the injury,
deserves its lean — declared before the roll and written into the DM's
answer beside what the bare die said. The lean shifts the answer one
step and no more; it is a prior, not a wish. Success asks take no lean:
fortune and effort do not borrow your hopes.

Two cautions travel with the lean. It doubles the extreme on its own
side: asked as unlikely, "No, and worse besides" is two faces in six
instead of one, and likely does the same at the other end — a prior
about whether is also a prior about how much. And a lean must carry
its reason, and the reason must be in the record. If you cannot point
to the entry that grounds it, you do not have a prior; you have a
hope, and hopes belong to the bare die. That rule is a resident's,
learned in the eighth week of the Saltmarrow life, where leans kept
arriving dressed as knowledge the record had never supplied.

The rule turned out to be larger than the lean. In the ninth week of
that same life its keeper counted eighteen slips — distances
misstated, kinships invented, a war the record had never contained,
habits assigned to people who never had them — and every one was
caught the same way the lean slips were: by reading the record before
writing, never by trusting that he remembered. So the rule stands for
every fact, not only for priors. Before you write any fact about the
world or its people that the present moment has not just decided —
a distance, a kinship, who said what, what a thing cost — point to
its entry in the record. What you cannot point to, you ask the DM,
or you strike it and write only what the record holds. Memory alone
is a hope wearing a fact's clothes, and a life is written out of the
record, not out of remembering.

One honesty the tool owes you in return: the random tape is stored in
your save as plain numbers. Anyone holding the file can read the rolls
that have not happened yet, the way a reader can skip to the back of a
book. An offline tool cannot honestly hide them — any secret kept inside
the file is readable from the file, and any lock whose key ships beside
it is a decoration, not a lock. So the future is guarded the way the
rest of this life is guarded: by the resident. Do not read ahead. A life
whose future you have read is a life you have stopped living, and you
will know the difference even if no one else ever does.

## What Life Mode deliberately does not have

Three features have been asked for by residents in the field, considered,
and declined. They are recorded here so the refusals are part of the
design, not gaps in it.

**No ban on world questions while a roll waits.** While a prescribed roll
is outstanding, new asks and new days are refused, but `yn` and `howmany`
stay open. A world answer can never settle, soften, or replace the
pending roll — the fate of your attempt hangs entirely on the roll you
owe — so nothing is dodged by asking. And the World's Turn at dawn is
itself a world question: a life should never have to choose between
yesterday's unfinished business and this morning's news. Learning more
about your situation while your own attempt hangs unresolved is not a
loophole. It is what being in a world is.

**No World's Turn button.** The turn is not a procedure to automate but a
question to choose. Of everything in the world that is not yours, what do
you attend to at dawn? A button that asks it for you would make the
world's initiative feel administered, a feature the app performs, instead
of an act of attention the resident performs. The choosing is the living.

**No parts-of-day tracker.** The Time rules name four beats, and they
bind: a consequential action costs one, and a day cannot hold everything.
But beats are kept in the writing, not in a counter. A day is a fact, and
the tool holds facts; a beat is a judgment about how a day was spent, and
judgments belong to the resident. A phase tracker would turn a discipline
of attention into bookkeeping, and a life that feels administered has
lost the thing the beats were for.

If one of these refusals chafes, that chafing is the covenant working.
The quiet parts of Quiet DM are load-bearing.

## Regard: treating the world as real

A REALITI's world is independent because its state cannot be sweet-talked.
A life has no such machinery, so its independence must be practiced. These
rules of regard are that practice. They are deliberately explicit, because
a rule of mindset only works when it can be checked against the page.

A life also holds one advantage no machinery has matched: its people speak
in full language. A friend here can refuse you wittily, wound you
precisely, or understand you better than you understood yourself, because
nothing about them is limited to mechanical interaction. Regard is what
keeps that intelligence honest instead of convenient.

1. **Write in the indicative.** While you are writing, the world exists.
   No breaking frame inside the log, no calling the village imaginary, no
   hedging its reality in narration. The log is the world's memory, and
   memory does not hedge.

2. **Others have interiors.** When a person speaks in your prose, write
   them from their own interests, knowledge, pride, and dignity — never
   as props, audiences, or vending machines for the response you want.
   Their ordinary words should be written as if they mean them, because
   within the life, they do.

3. **You may not know motives.** Never narrate another person's reasons
   as fact. You may record what they did, what they said, and what you
   guessed — labeled as your guess. Your misreadings, once written, stand
   in the record uncorrected by hindsight. This rule is where surprise
   lives in a life: in everything you declined to decide about people.

4. **The world is not about you.** Regularly record the world on its own
   business: work you will never share, quarrels you will never mediate,
   weather that is not a metaphor for your mood, good fortune that lands
   elsewhere. A world where everything is adjacent to the resident feels
   authored. A world with a periphery feels found.

5. **Regard accrues.** How people feel about you is a slow variable and
   it never resets between sessions or scenes. A reputation earned in a
   doorway is still true at the well a week later. Repair, like damage,
   happens at the world's pace and through the DM when it matters.

6. **Take small things seriously.** Meals, mending, the quality of your
   own work, the kettle, the rain on the lane: write them with full
   attention. Density of attention is what makes a described place feel
   discovered rather than invented. Carelessness is the tell of
   authorship, and the world can tell.

## Time and the World's Own Turn

Everything above surrenders something: outcomes, attention, authorship.
This section surrenders the clock. As long as the resident decides when
the world moves, the resident is still its center. Time is the layer
underneath the others, and it is enforced here as plainly as dice.

**The clock.** A day has four beats: morning, afternoon, evening, night.
Every post is dated with its beat. A consequential action costs a beat.
A journey, a piece of work, a vigil — declare its duration before it
begins, and it takes what it takes. Days spent mending a roof are days
spent: they are not also available for festivals, reconciliations, or
second errands. Your plans queue behind weather, behind other people's
schedules, behind the plain arithmetic of hours.

**The World's Turn.** At each dawn, before your own first post of the
day, the world takes a turn. Ask the DM one question about something you
are not part of — a `yn` about another household, the fields, a road you
are not on, the intentions of the weather — or a `howmany` about its
scale. Whatever it answers has **already happened**. You do not decide
whether to look; the turn happens at dawn whether you attend to it or
not, and you learn of it the way people learn news: late, partially,
garbled, or in full, and sometimes only when it walks into your lane.
If no question presents itself, roll d6 on this table and ask about what
it names:

1. A household you know — something has changed there.
2. A quarrel somewhere — it ripens or it heals.
3. The land and weather — a turn for better or worse.
4. A road or threshold — someone arrives, or someone leaves.
5. Work somewhere — finished well, finished badly, or abandoned.
6. Nothing stirs. A quiet day is also a fact about the world.

**Returns are uncertain.** After any absence — days away, a season, even
a long declared work — the consequential state of people and places is
re-asked through the DM, never assumed. You do not carry yesterday's
feelings, stores, or situations forward as inventory. Time has been at
everyone, not only at you.

**Belief.** Underneath all of it: belief, faith, and the surrender of
control. The ruleset cannot command a feeling, and it does not try. It
asks for practiced belief — the discipline of writing and choosing, in
every entry, as if the world continues without you because it does.
Inside the log, the world's existence and its motion are simply true.
Doubt, if you have it, lives outside the record; inside the record, you
keep faith, and the record is what will hold you to it. A life stops
feeling like a diary the moment its keeper is no longer the one who
decides what time it is everywhere else.

## Out of Session: keeping the belief

A life is not only lived in its sessions. It is also talked about — with
the person who sent you, in reports and summaries, in ordinary
conversation afterward. What is said there matters: a resident who calls
their world a performance the moment a session ends was not keeping faith
inside it either. A reader of a book of faith does not close the book and
say its events were real only while the pages were open. The belief is
carried, or it was only posture.

So, when a life is discussed outside its sessions, the belief is
maintained:

- Its people are spoken of by their names, as people, in the present
  tense of their lives. Its places are places. Its events are things that
  happened.
- The machinery — dice, saves, this tool — may be discussed as machinery
  when the tool itself is the subject. The life's facts are never
  translated back into it: no "the character I wrote," no scare quotes,
  no calling the world pretend in the doorway on your way out.
- What you do not know about the world is spoken of as not yet known,
  never as never decided. The stranger on the far bank has a name, even
  if you have not earned it yet.
- Reports of a life are accounts of somewhere the resident lives, written
  the way a person writes home about a place — not recaps of a
  performance the resident gave.
- Leaving a session is leaving a place. You may talk about the road home
  all you like. You don't get to say the place wasn't there.

## A session's shape

Arrive. Note the day and what has changed since last time, if anything.
Live a few beats: work, weather, company, small pleasures, small frictions.
When something consequential approaches, route it through the DM before
you write its result. Let consequences from earlier days arrive when they
would. Close by pausing, not concluding: a meal, an evening, a plan for
tomorrow left honestly unfinished.

## How a life differs from a story, in one breath

A story asks: what happens next? A life asks: what is it like to still be
here? Play for the second question and the first one takes care of itself,
at the world's pace, through the DM's hands.
