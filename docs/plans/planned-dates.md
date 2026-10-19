# Plan: planned dates on to-dos (I2)

_Written 2026-10-19 (plan step I2-PLAN, side session, Opus). Not agreed yet: every behaviour change is a question in BACKLOG "Questions for the owner" (I2 Q1-Q12); the recommended answers are written in below and marked **(Q n)**. Each phase = one session, Sonnet. Builds on Board B (`docs/plans/board-own-view.md`, Phases 1-2 on `overnight/2026-10-19`)._

## Goal
A to-do knows the date it is planned for, so the board can show this week, next week and any other week, a card dragged to Monday on a Wednesday means next Monday (not this Monday, beside last Monday's finished cards), and the week can be closed.

## Why
`day: Mon` cannot say which Monday. Today `cardDate()` (`src/planning/todo.ts:58`) guesses it from `planned` (the first such weekday on or after the day the card was moved), and the board puts every `Mon` card in one Mon column (`buildBoard`, `src/planning/board-card.ts:127`): next Monday's card sits beside this Monday's finished ones, and ticked cards stay on the board until the roll-over clears them the next week (BACKLOG "Ticked to-dos stay on the board"). Every task tool compared stores a date. A date also unblocks week arrows (F1), Close the week (F4), the week clean (I3) and "assign to next Tuesday" (BACKLOG "To-do day").

## Decision taken (to confirm, Q1-Q12)
- **`scheduled: YYYY-MM-DD` is the truth.** No value (absent or empty) = Backlog. The board places every card from `scheduled`, `done`, `done_on` and today; it writes nothing when it draws.
- **`day` stays, as a mirror** (Q10): the weekday name of `scheduled` (`Mon` … `Sun`), `Backlog` when there is none, `Done` when the roll-over clears a finished card (as now). It keeps the base's filter (`day != "Done"`), the built-in kanban fallback in `To-do board.base`, the To-do template and any Dataview query of the owner working. It is a pure function of `scheduled` (not of today), so two devices always agree on it (see Sync).
- **`planned` is no longer needed** for new writes: it only told `cardDate()` which week a weekday meant. Old values stay and are read once, by the fallback below and the Tidy rule.
- **Read fallback, for ever:** a to-do with a weekday `day` and no `scheduled` is placed at `cardDate(fm)` (today's rule, with `planned`, else this week's Monday as the roll-over does now). So an old vault draws right before any migration, and a note edited by hand or by an older plugin on another device still lands somewhere sensible.
- Rejected: a date-only model that drops `day` (the kanban fallback and the template would group nothing); a week number next to `day` (two fields to keep in step, no help for "next Tuesday"); writing a date into `day` itself (breaks the fallback kanban's columns and every `day === "Mon"` reader).

## Where a card shows (the shown week = Monday W … Sunday W+6; this week unless the week arrows moved it)
| Card | Shows |
|---|---|
| open, `scheduled` in the shown week, today or later (or any day of a future week) | that date's column |
| open, `scheduled` before today (this or an earlier week), shown week = this week | **carried over**: today's column (Mon at the weekend, as `todayColumn`), amber edge; the view does this from the date, so a phone that never rolls over still shows it right |
| open, `scheduled` before today, shown week ≠ this week | not shown (it is carried over into this week) |
| open, no `scheduled` | the tray (Backlog) |
| open, `scheduled` after the shown week | the tray, with a small date pill `Tue 27 Oct` (Q3) |
| open, `scheduled` on Sat / Sun with Show weekend off | the tray, with its date pill |
| done, `done_on` in the shown week | the `N done` line of the column of `done_on` (Q4) |
| done, `done_on` before the shown week | not shown: **finished cards of earlier weeks leave the board on Monday by themselves** (Q2) |
| done, no `done_on` | the column of `scheduled`, else not shown |

`rolled: true` keeps meaning "carried over" for the plan map and the fallback kanban; the board's amber edge is `rolled || (open && scheduled < today)`.

## What writes what
All writes go through `fileManager.processFrontMatter`, in one call per card, so `scheduled`, `day` and `rolled` never disagree in a synced file.

| Action | Writes |
|---|---|
| Drag onto a day column of the shown week (today or later) | `scheduled: <that date>`, `day: <its weekday>`, `rolled: false` |
| Drag onto a past day of this week, or any day of a past week | nothing: past columns are not drop targets (no dashed outline); a drop there shows the notice `Mon 19 Oct has passed: drop on today or a later day.` (Q1) |
| Drag onto the tray | `scheduled` removed, `day: Backlog`, `rolled: false` |
| Drag within the same column | nothing (as now, `dropDay`) |
| Tick the done circle | `done: true`, `done_on: today` (if none), `rolled: false` (as now). `scheduled` is kept (it says when it was planned) |
| Untick a card | as now: `done_on` removed; a card whose `day` is `Done` goes back to `day: Backlog`, and now also loses `scheduled` (**the re-tick fix kept**: the roll-over must never see `Done` + not done and tick it again; `tests/` case kept and extended) |
| `+ New` in a column (Board B Phase 3) | the entry window opens with that column's date; the note gets `scheduled` + `day` |
| `day` changed by hand or by the fallback kanban (no `scheduled` change) | the engine sets `scheduled` to the next such weekday on or after today (the old kanban drag meaning), `rolled: false`; `day: Backlog` removes `scheduled` |
| `scheduled` changed by hand | the engine sets `day` to its weekday (or `Backlog`) when it differs |
| Roll-over (computers only, `rollsOnDevice`, unchanged) | open card with `scheduled` before today: `scheduled: today`, `day: <today's weekday, Mon at the weekend>`, `rolled: true`. Notice unchanged: `Moved N unfinished to-dos to Wed`. Finished card with `done_on` before this Monday: `day: Done` (as now; keeps the base small). `planned` is no longer written |

## Roll-over, what it becomes
`rollOverPatch` (`src/planning/todo.ts:89`) keeps its four kinds; `"planned"` (stamping `planned` on cards from before the engine) becomes `"dated"`: a weekday card with no `scheduled` gets `scheduled: cardDate(fm)`, written only on a rolling device. The "ticked" (old `Done` with no tick) and "cleared" kinds stay. The board no longer depends on the roll-over to look right: it is the durable write for other readers (Home "This week" list, plan map, fallback kanban), not the drawing rule.

## Migration of old to-dos (Tidy rule)
- New Tidy group in `src/kit/tidy.ts`, next to `todo-bar`: id `todo-dates`, title `To-dos: give each card a date`, detail `Cards on a weekday get scheduled: the date they are planned for (read from day and planned), so the board can tell this Monday from next Monday. Backlog and Done cards get none. Each note is backed up first.` Opt-in like `todo-bar` (Q9): the board reads old cards through the fallback anyway.
- Per note (`kind: todo`, no `scheduled`, `day` a weekday): `scheduled: ymd(cardDate(fm))` with `planned` read as the roll-over reads it. Front matter only; `planned` is left in place (the user may delete it; not touched).
- A to-do that is open and lands before today is carried over by the board the moment it has a date, exactly as the roll-over would do today; the Tidy list says so in its detail line: no other change.

## Date words ("next tue")
- One parser: `parseDue` (`src/planning/due-words.ts`, twin in `vtAsk.js`): the same words for Due and for Day (`tue`, `next tue`, `27 oct`, `in 3 days`, `next week` = that Monday). A bare weekday is today or the next one (`parseDue` already does this). One new word for Day only: `backlog` (clears).
- **Quick capture:** new mark `@` (Q8): `Book NMR time +Polymers @next tue !1` → title `Book NMR time`, `scheduled` next Tuesday. Same rules as `%` (spaces and words allowed up to the next mark). `parseQuickTodo` (`src/planning/quick-todo.ts:24`) gets a `scheduled` field.
- **Entry window and the in-note chip bar:** a `Day` chip after Due (`todoFields`, `src/planning/todo-bar.ts:75`): empty `+ Day`, set `Tue 27 Oct`; box placeholder `Which day? (tue, next tue, 27 oct; backlog clears)`; the hint line reuses `Reads as …`. Writes `scheduled` + `day`.
- **Due does not fill Day** (Q11): they stay separate; a due date is a deadline, a day is a plan.
- To-do template (`kits/planning/Extras/Templates/To-do.md:102`): `scheduled: <% scheduled %>` from the handoff (`window.vtTodo` / `vtEntryTodo` preset), `day:` from it; the board column handoff passes a date. Needs Review update… for existing vaults.

## Week arrows (F1) and Close the week (F4), on top
Top row of the board (free since Board B Phase 1, must not be cramped), left to right:
`‹` (aria-label `Previous week`) · `Week of 19 Oct` · `›` (aria-label `Next week`) · `This week` (only when another week is shown) · gap · `3 carried over` (chip, only when N > 0, this week only) · `Close the week…`.
- The day headers get the date: `Mon 19` (Q5). Today's header blue only in this week.
- The board always opens on this week; the shown week is not saved (Q6). Past weeks can be viewed (finished cards and their `N done` lines) but take no drops (Q1); future weeks take drops onto any day.
- The tray is the same in every week: no date, or a date after the shown week (with its pill).
- `3 carried over` (Q12) opens **Review late cards** (window title `Late cards (3)`): one row per carried-over card, its title and `planned Mon 12 Oct`, and buttons `Today`, `Tomorrow`, `Next week` (that Monday), `Backlog`, `Done`. Each button writes as a drag would.
- `Close the week…` (Q7: always shown; the default choice is next Monday) opens window title `Close the week of 19 Oct`: line `4 open to-dos are left this week.`, three choices `Move them to Mon 26 Oct` (default), `Move them to the Backlog`, `Leave them (they carry over)`, a list of the cards with a box each (all ticked), line `Finished cards leave the board on Monday.`, buttons `Move 4` / `Cancel`. Notice `Moved 4 to-dos to Mon 26 Oct` or `Moved 4 to-dos to the Backlog`. Moving writes as a drag. Nothing else (notes are never moved or archived).

## Phone tabs (Board B Phase 2 layout)
- The day tabs read `Mon 19 3` (name, date, open count); the week row sits above the tabs in one line: `‹ Week of 19 Oct ›`, with `This week` and the F4 buttons in a second row only on a phone (`is-narrow`).
- A tab of a past day takes no drop (as columns). Swipe left past Fri (or Sun) does not change the week (no surprise jumps); the arrows do.
- Phones do not roll over (`rollsOnDevice`), and need not: the view draws carried-over cards from the date.

## Obsidian Sync with two devices
1. The board never writes on draw; only a user action writes (drag, tick, a window button). So two open boards cannot answer each other.
2. `day` is a pure function of `scheduled` (weekday name), never of today, so devices on different dates (midnight, time zones, a laptop asleep since Friday) compute the same `day` and never flip it back and forth. The rule that would need today (Backlog for later weeks) is drawn by the view, not written.
3. The engine's `onChanged` writes only to repair a mismatch: `scheduled` and `day` disagree (a hand edit, the fallback kanban, an old plugin on the other device). A change from the other device arrives consistent, so it is left alone (same guard idea as `changePatch` today: `src/planning/todo.ts:63-66`).
4. The roll-over runs only on computers (per-device switch unchanged) and 90 s after start (`START_DELAY`), so a phone's drag reaches the computer before it rolls. Its writes are idempotent: a card already `scheduled: today` + `rolled: true` is skipped.
5. Two devices drag the same card before syncing: the last write wins, all three keys come from one write, so the note is never half old and half new. Same as today.
6. An older plugin (1.4.x) on the other device: it ignores `scheduled`, stamps `planned` on a drag and writes `day` only. Rule 3 then sets `scheduled` from `day` on the next computer that sees the change (the next such weekday): right for a drag; noted as a known limit in the changelog.

## Out of scope
- Moving or archiving notes (Archive old to-dos is unchanged).
- Time of day, durations, placing by dependencies (parked, BACKLOG).
- F3 rolled-over count on a card (undecided, separate question).
- A per-device "remember the last week" (Q6 says no).
- Recurring to-dos.

## Phases

### Phase 1 — Date model (pure, tests only)
- Files: `src/planning/todo.ts` (`TodoFm.scheduled`, `dateOf(fm)` = `scheduled` else `cardDate(fm)`, `weekdayOf(date)`, `changePatch` and `rollOverPatch` on dates, `"dated"` kind), `src/planning/board-card.ts` (`buildBoard(cards, head, { …, week })` places by date per the table; `BoardCard.date`, `hint`), `src/planning/board-drag.ts` (`dropDay` → `dropPatch(card, target, today)`: a patch, or `{ refused: "past" }`), `tests/todo-engine.test.ts`, `tests/board-card.test.ts`, `tests/board-drag.test.ts`.
- Not changed: the view, the engine wiring, kits, styles.
- Checks: the placement table row by row; the re-tick test (`Done` + untick → `Backlog`, no `scheduled`, roll-over does not tick again); Sync table: a consistent synced change → `null` patch; `day` from `scheduled` independent of `now` (two `now`s, same result); Sunday 23:59 / Monday 00:01 boundary; a Wed drop on Mon of this week refused, on Mon of next week → `2026-10-26`; fallback: `day: Mon` + `planned: 2026-10-12`, no `scheduled` → `2026-10-12`.
- Size: M

### Phase 2 — The board on dates
- Depends on: Phase 1
- Files: `src/planning/board-view.ts` (drop writes `scheduled` / `day` / `rolled`; past columns not drop zones; tray pill; `Mon 19` headers; done by `done_on`), `src/planning/engine.ts` (`onChanged` mirror repair, roll-over on dates), `src/planning/lists.ts` (`thisWeek` from `scheduled`), `src/planning/after-write.ts` (undo snapshot includes `scheduled`), `styles.css` (`.lk-board-date`, `.lk-board-pill.is-later`, `.lk-board-col.is-past`), `docs/obsidian-test-checklist.md` row.
- Checks: unit tests as Phase 1 plus `thisWeek`; obsidian-check on a seeded vault (Wednesday clock): a card dragged to Mon writes `scheduled` = next Monday and appears in the tray with `Mon 26 Oct`; a Tue card from last week shows amber in Wed; last week's finished cards are gone; the fallback kanban still groups by `day`; errors `[]`; cropped screenshots light and dark.
- Size: M

### Phase 3 — Migration (Tidy rule)
- Depends on: Phase 1
- Files: `src/kit/tidy.ts` (group `todo-dates`), `tests/tidy.test.ts`, `tests/tidy-planning-fixture.test.ts` and the `npm run tidy-fixture` data (old weekday cards with and without `planned`).
- Checks: the fixture lists N cards; after Apply each has the `cardDate` date; Backlog / Done cards untouched; a second scan lists 0; obsidian-check on `test-vault-tidy/`.
- Size: S

### Phase 4 — Date words: quick capture, Day chip, template
- Depends on: Phase 1
- Files: `src/planning/quick-todo.ts` (`@`), `src/planning/due-words.ts` (`backlog` handled by the Day field, not `parseDue`), `src/planning/todo-bar.ts` / `entry-fields.ts` (Day chip), `src/planning/commands.ts` (board New passes a date), `kits/planning/Extras/Templates/To-do.md`, `kits/planning/Extras/scripts/templater/vault/vtAsk.js` (only if the template's prompt path needs it), `npm run kit:manifest`, tests `quick-todo`, `todo-bar`, `due-words`.
- Checks: `@next tue` on Mon 19 Oct → `2026-10-27`; `@tue` on Tue → today; `@backlog` → none; marks in any order with `+` `%` `!`; Day chip writes both keys; template writes `scheduled` from the handoff (obsidian-check with Templater if available, else NOT seen).
- Size: M

### Phase 5 — Week arrows (F1), desktop and phone
- Depends on: Phase 2
- Files: `src/planning/board-view.ts` (top row, shown-week offset, phone row), `src/planning/board-card.ts` (`weekTitle`), `styles.css`, tests.
- Checks: `›` shows Week of 26 Oct with next week's cards in their columns and this week's absent; `This week` returns; a drop on Tue of next week writes `2026-10-27`; past week shows `N done` and takes no drop; at 390 px the week row fits in one line with the tabs under it; screenshots.
- Size: M

### Phase 6 — Close the week (F4) and Review late cards
- Depends on: Phase 5
- Files: `src/planning/board-close.ts` (new: pure `closeWeekPlan(cards, today, choice)` → patches; window), `src/planning/board-view.ts` (two buttons), `styles.css`, `tests/board-close.test.ts`.
- Checks: 4 open this-week cards → `Move 4` writes `2026-10-26` to each ticked one; unticked rows untouched; Backlog choice; Leave = no writes; late-cards window buttons write as drags; obsidian-check of both windows (design standard corners); screenshots.
- Size: M

### Phase 7 — Docs
- Files: `docs/architecture.md`, `kits/planning/07 How-tos/Obsidian/Vault spec.md` (the `scheduled` key, `day` as a mirror), `docs/changelog.md` (the older-plugin limit, Sync rule 6), `docs/obsidian-test-checklist.md` 6i rows, `docs/decisions.md` (the owner's answers).
- Done when: the owner tries the board on two devices with Sync (checklist row).
- Size: S

## Verification
Known answers in tests (Wed 21 Oct 2026 as today): a drop on Mon = 2026-10-26 (this Monday is refused); `next tue` = 2026-10-27; old `day: Thu` + `planned: 2026-10-14` = 2026-10-15. The Sync rules are tested as patch tables (a consistent change → no write; two `now`s → the same `day`). Real two-device Sync is the owner's (not checkable by Claude).

## Existing vaults (I2-TEST, 2026-10-19: measured before any I2 code exists)
Questions answered: Q9 (does the Tidy rule default on?), Q10 (keep `day` as a mirror?). Nothing here is `src/` code: the I2 rules of this plan (the "Where a card shows" table, the Tidy rule, the roll-over, the mirror repair) are written once as a test helper (`tests/helpers/i2-model.ts`) and run on old-style notes.
- **Fixture** `tests/fixtures/i2-old-vaults/`: 35 old-style to-dos covering every state, two device copies of three notes, and the kept kit notes (Project hub, Daily note, Weekly review, `To-do board.base`) plus `Own queries.md` (a member's own Dataview on `day`).
- **Baseline** `tests/i2-baseline.test.ts` + `golden/baseline.json`: today's board, roll-over and lists on three days: Wed 21 Oct, Sat 24 Oct, Mon 26 Oct. The model's `placeNow` is checked against the real `buildBoard` on the same data.
- **Findings** `tests/i2-migration.test.ts` + `golden/findings.json` (`I2_PRINT=1 npx vitest run tests/i2-migration.test.ts` prints all rows).
- The old notes' last change is taken as Fri 16 Oct (matters only for finished cards with no `done_on`). `phone` = a device that never rolls over; `computer` = the board after that day's roll-over ran (old code for the baseline, the I2 roll-over for the new view).

### 1. Which cards change column (I2 view with no migration vs today's board; Q9 a)
Cards counted when the column (or the tray / "N done" line / hidden) differs. "Wed phone" = today's board with no roll-over vs I2.

| Case | Cards | Wed phone | Wed computer | Sat phone | Sat computer | Mon phone | Mon computer |
|---|---|---|---|---|---|---|---|
| Backlog | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| due only (Backlog) | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| Mon-Fri, with planned | 7 | 3 | 0 | 6 | **7** | 6 | 0 |
| Mon-Fri, no planned | 3 | 1 | 0 | 2 | **3** | 0 | 0 |
| rolled | 2 | 1 | 0 | 2 | **2** | 2 | 0 |
| subtask with after | 3 | 1 | 0 | 1 | **1** | 2 | 0 |
| meeting-flagged | 3 | 0 | 0 | 1 | **1** | 1 | 0 |
| done, with done_on | 3 | 1 | 0 | 1 | 0 | 2 | 0 |
| done, no done_on | 2 | 0 | 0 | 0 | 0 | 1 | 0 |
| day Done, ticked | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| day Done, not ticked | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| day typo / empty / lower case | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| weekend planned (Sat, Sun) | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| no kind | 1 | 1 | 1 | 0 | 0 | 0 | 0 |
| **Total** | **35** | **8** | **1** | **13** | **14** | **14** | **0** |

What the changes are:
- **Wed phone 8:** 7 open cards planned for a day before Wed (Mon, Tue, the Thu of last week, the rolled Tue card, the no-kind note) move from their own past column to **Wed, amber (carried over)**, which is what a computer's roll-over does today; 1 finished card from last week (Thu 15 Oct) leaves the board (Q2 a). A phone that never rolls over now shows the same as a computer.
- **Mon phone 14:** 11 open cards of last week move from this Monday's past columns to **Mon, amber**, and 3 finished cards of last week leave. This is the effect the plan wants: today a Monday-morning phone shows last week's cards in this week's columns.
- **Wed computer 1:** the only change after the roll-over has run is the **no-kind note** (`kind` missing): today's roll-over never touches it, so it stays in Mon; the I2 board reads its `day` and carries it to Wed. Nothing else moves for a computer that rolls over daily.
- **Sat computer 14: a defect in this plan (section 7, weekend roll-over).**
- Backlog, due-only, `Done`, typo and weekend cards never move. Typo / empty / lower-case `day` cards (3) stay in the tray as today and get no date from the Tidy rule (it only reads Mon to Fri, case exact).

### 2. Q9: Tidy rule off (a) or on (b), the same cards viewed after the rule ran on Wed
| View day | Cards that differ between a and b |
|---|---|
| Wed (the run day) | 0 |
| Sat | 0 |
| Mon 26 Oct | 4: the 3 open weekday cards with no `planned` (`Mon no planned`, `Wed no planned`, `Fri no planned`) and 1 finished card with no `done_on` (`Done no done_on old week`) |

- With the rule **off** and no computer rolling over, a card with no `planned` floats: the fallback reads it as "this week's Monday", so it never becomes late. With the rule **on** (or any computer's roll-over, which writes `scheduled` for such cards: the "dated" kind) its date is fixed to the Monday of the day it was migrated, so on the next Monday it is carried over, exactly as today's roll-over does after it stamps `planned`.
- So **a vault with one computer that rolls over has no real difference between a and b** after the first roll-over; the default only matters for phone-only vaults and for the first minutes before the roll-over (`START_DELAY` 90 s).
- Both leave `planned` in place; both draw the same on the day they run.

### 3. Which cards could flip done / not done
- **1 card:** `Day Done, not ticked` (a finished card from before the tick box: `day: Done`, `done: false`). Today it counts as finished everywhere (`isFinished`, `isOpenTodo`). A reader that stops reading `day` (Q10 b) sees it **open**. Under Q10 a nothing changes; the roll-over's "ticked" kind still ticks it on a computer.
- No card flips because of the migration itself (the Tidy rule writes only `scheduled`).
- Untick of a card on `day: Done` (the re-tick fix): unchanged in the plan; kept.

### 4. Two devices: copies of one note
| Note | Laptop copy | Phone copy | Migrated date, laptop / phone | Drawn by I2 (laptop / phone) |
|---|---|---|---|---|
| `Sync move report` | `day: Wed`, rolled (the roll-over moved it from Mon) | `day: Fri`, dragged on the phone | **2026-10-21 / 2026-10-23: they disagree** | Wed / Fri |
| `Sync tick samples` | open | ticked (`done_on` 21 Oct) | 2026-10-20 / 2026-10-20 (agree) | carried to Wed / `1 done` on Wed: **they disagree on done** |
| `Sync agree` | `day: Thu` | `day: Thu` | 2026-10-22 / 2026-10-22 | Thu / Thu |

- 2 of 3 pairs differ. The differences are not caused by I2: the two devices already disagree on the old data (today's baseline draws the first pair as Wed (amber) vs Fri). The migration copies each device's own disagreement into a new key.
- **If the Tidy rule runs on both devices before the sync is through,** both write a `scheduled:` line at the same place in the front matter with a different value. How Obsidian Sync merges that was **not tested** (Sync needs two real devices).

### 5. What a device still on the old plugin writes next (on notes migrated on Wed)
Old plugin = 1.4.x (`changePatch`, `rollOverPatch` as in `src/planning/todo.ts`), which knows nothing of `scheduled`.
| Old-plugin action | Cards it writes on | I2 draws it wrong (reads `scheduled` first) before the mirror repair | Wrong after the repair (Sync rule 3, simulated) |
|---|---|---|---|
| Drag to Fri (writes `day`, `planned`) | 22 | 11 (the card keeps its old date column) | 0 |
| Drag to Backlog (writes `day: Backlog`, `planned`) | 19 | 14 (the card keeps its date column, `day` says Backlog) | 0 |
| Roll-over (writes `day`, `planned`, `rolled`) | 8 | 0 | 0 |
| Tick (writes `done`, `done_on`, `rolled`) | all open | not an issue: `scheduled` is kept and done is the truth | n/a |
- The repair is only as good as a **new-plugin computer being open** after the old device's write. Until then, the phone / board on a new-plugin device shows the stale date.
- **Forward-dated cards: a card the I2 board puts in NEXT week meets an old-plugin computer's roll-over.** Old code knows only `day` and `planned` (the new plugin does not write `planned`, and an old note's `planned` is before today). Measured on Wed 21 Oct, `day` mirrored, `scheduled` next week:
  - Mon 26 Oct and Tue 27 Oct cards: the old roll-over **moves them to Wed (today)** and writes `rolled: true`; the repair then rewrites `scheduled` to today. The planned future date is lost.
  - Wed, Thu, Fri 28-30 Oct cards: the old roll-over leaves them, and the old board draws them in **this** week's column.
  - So while one device runs 1.4.x, every forward-dated card is exposed. Q10 b (no `day` written) does not help: the old plugin keeps the card's old `day`.

### 6. Readers of `day`, and what each shows if `day` is kept as a mirror (Q10 a) or dropped (Q10 b)
Mirror = `day` is the weekday name of `scheduled` (as in this plan); dropped = I2 writes only `scheduled`, an old `day` is left where it is, a new card has none.

| # | Reader | Mirror kept (Q10 a) | Dropped (Q10 b) |
|---|---|---|---|
| 1 | `todo.ts` `snapOf`, `changePatch`, `rollOverPatch`, `cardDate` (the roll-over and the old drag rule) | read `scheduled` first; `day` repair | switch to `scheduled`; same change as the rest of the code |
| 2 | `board-card.ts` `cardOf`, `buildBoard`, tray, `deadlineMarkers` (`c.day !== day`), `meetingMarkers` (`day !== "Done"`) | switched to the date (same change as 1) | same |
| 3 | `board-view.ts:159` drop writes `day` | writes `scheduled` + `day` in one call | writes `scheduled` only |
| 4 | `lists.ts` `isOpenTodo`, `thisWeek` (`DAYS.includes(day)`, badge `· Mon`), `openProjectTodos`, `projectTodos`, `waitingOn`, `projectCards` badges | switch to the date (Home "This week", project tiles) | same change; old `Done` cards need `done` |
| 5 | `actions.ts` `isFinished` (`day === "Done"`), new to-do `day: Backlog`; `plan.ts` (plan rows done), `todo-picker.ts`, `plan-map.ts:233` untick, `after-write.ts` (undo snapshot) | `Done` stays a value of `day` | `day: Done` no longer written: the one card `Day Done, not ticked` is open (section 3); undo snapshot must hold `scheduled` |
| 6 | `kit/tidy.ts` `todo-properties` (adds `day: Backlog`) | unchanged | must add `scheduled` instead (no value = Backlog) |
| 7 | Kit To-do template (`:12-17` reads `day`, `:55` `day != "Done"`, `:102` writes `day`) | works; also write `scheduled` (needs Review update…) | template must change; kept copies of the template in vaults still write `day` |
| 8 | `To-do board.base` filter `day != "Done"` and the built-in kanban `groupBy day` | works | the kanban groups nothing (no `day` on new cards); the filter keeps hiding only old `Done` cards |
| 9 | Kept Weekly review (`day = "Backlog"`), Daily note (`day = ccc(date)`), One-off meeting (`day != "Done"`), Project hub (`day = "Done"`), never overwritten in existing vaults | right for every card dragged with I2 (0 wrong in the test below); old limit stays (a weekday name cannot tell this Monday from next) | wrong, see below |
| 10 | `vault-theme.css` (kanban columns, amber `vt-rolled`) | works | the kanban columns are empty |
| 11 | A member's own Dataview on `day` (`Own queries.md`: group by day, `day = "Fri"`, TASK where `day = "Mon"`) | same as today | stale / missing, see below |
| 12 | Docs (Vault spec, How my vault works) | `day` column reads "the weekday of scheduled" | rewrite |

Test of the kept queries after a week of I2 use (Wed: drag Backlog card to Fri, drag a card to next Monday, drag a card to Backlog, tick a card, make 2 new cards; only the 6 touched cards are judged against the date):
| Query | Mirror kept | `day` dropped |
|---|---|---|
| Weekly review: Backlog list | 0 wrong | **2 wrong**: the card dragged out of Backlog stays listed; the card dragged to Backlog is missing |
| Daily note: Planned for today | 0 wrong | **2 wrong**: the card moved to Backlog stays listed; the new card for today is missing |
| Project hub: Done to-dos | 0 | 0 (it also reads `done`) |
| Own query 1: open, grouped by day | 0 | **4 wrong** |
| Own query 2: open on Fri | 0 | **1 wrong** (the card dragged to Fri is missing) |
| Own query 3: TASK where `day = "Mon"` | 0 | 0 |

### 7. Other findings
- **Weekend roll-over defect (found by the simulation, not yet in the plan):** on Sat or Sun the roll-over writes `scheduled: today` (a Saturday) and `day: Mon`. With Show weekend off the plan's table sends "open, `scheduled` on Sat / Sun" to the tray with a pill. So after a computer rolls on a Saturday, 14 of 35 cards leave the Mon column for the tray, while a phone that never rolled shows the same cards in Mon (carried over). Today they stay in Mon. Fix options: the roll-over writes the next Monday at the weekend; or the table treats a `rolled` card dated at the weekend as carried over; or keep it, and the tray holds them (a look change: ask).
- **Show weekend on:** `day: Sat` / `Sun` cards (2) have no weekday in `DAYS`, so the Tidy rule gives them no date; with the weekend shown they fall from their Sat / Sun column to the tray (today they are in the column). With the weekend off nothing changes (tray both ways). A Sat/Sun `day` needs a date from the rule (Saturday after `planned`).
- **No-kind note:** today's roll-over ignores it, the board draws it; under I2 the board carries it to today. Harmless but a change.
- **An unreadable `day`** (typo `Teusday`, lower case `mon`, empty): tray before and after; the Tidy rule skips them. The kept Weekly review's Backlog list does not list them either (a baseline limit).
- **Finished cards with no `done_on`:** today they stay in their `day` column until the roll-over clears them from the last-change time; the I2 view needs a date for them: `scheduled`, else the card is hidden (`done, no date`). One fixture card (`Done no done_on old week`) is shown on Mon in the fallback view and hidden once frozen (Q9 a vs b, Mon).

### 8. Seen in a throwaway Obsidian (obsidian-check, 2026-10-19; today's code, no I2 code)
Setup: a throwaway vault with the fixture's `vault/` folder as its notes (`--notes`), the built plugin 1.4.1 (`plugin: true`, `errors: []`). The planning kit was switched on by setting its slot in the plugin's data (no kit files installed, so the fixture's kept notes stayed as they were), the kit's own `To-do board.base` was added as `Kit board.base` (it holds the `lab-kit-board` view; the fixture's own `To-do board.base` has only the old kanban). The window's clock was set to the test days by replacing `Date` in the window; the notes' last-change time was set to Fri 16 Oct with `touch`.
| Check | Result |
|---|---|
| Board on Wed 21 Oct, before any roll-over: columns, cards, done lines, markers, tray (11 cards) | **PASS**, identical to the golden `boardBeforeRoll` (the cards of each column compared as sets; the on-screen order is by priority) |
| Same on Sat 24 Oct and Mon 26 Oct (fixture files put back each time) | **PASS** both |
| "Roll over to-dos now" on Wed, then the board | **PASS**: board equals the golden `boardAfterRoll`; the 29 properties the roll-over wrote on 13 notes equal the golden `rollOver` data |
| Today's roll-over also ran by itself once the clock moved to Sat (kanban fallback `Board` view of the old base shows Backlog 6, Mon 16, Tue 1) | seen: the old fallback groups by `day`, so everything rolled at the weekend sits under Mon (the same the I2 weekend defect changes) |
| Kept notes (Project hub, Daily note, Weekly review, Own queries) | open without errors; Dataview is **not installed** in the throwaway vault, so the queries show as code, **not seen as results**: the query results in section 6 come from the test model, not from Obsidian |
| Console errors after all of it | `[]` |
Not seen: Dataview results, Obsidian Sync with two devices, a Review update… over the kept notes (they were never overwritten because no kit files were installed), phone.
