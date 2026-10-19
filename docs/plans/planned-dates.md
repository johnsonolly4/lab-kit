# Plan: planned dates on to-dos (I2)

_Written 2026-10-19 (plan step I2-PLAN, side session, Opus). Rewritten 2026-10-19 (N2, Opus) to the **slim model** the owner decided (BACKLOG "Questions for the owner" → I2, rounds 1-3; `docs/decisions.md` 2026-10-19 I2 lines). Each phase = one session, Sonnet. Builds on Board B (`docs/plans/board-own-view.md`, Phases 1-2 on `overnight/2026-10-19`). Rows marked **(new Q)** follow from the decisions but change something the owner sees: they are asked in BACKLOG ("I2 slim model: follow-up questions") before the phase that needs them._

## Goal
A to-do knows the date it is planned for, so the board can show this week, next week and any other week, a card dragged to Monday on a Wednesday means next Monday (not this Monday, beside last Monday's finished cards), and the week can be closed. A to-do carries as few properties as it can (the owner wants a short property list in the split-pane view).

## Why
`day: Mon` cannot say which Monday. Today `cardDate()` (`src/planning/todo.ts:59`) guesses it from `planned`, and the board puts every `Mon` card in one Mon column (`buildBoard`, `src/planning/board-card.ts:127`): next Monday's card sits beside this Monday's finished ones, and ticked cards stay on the board until the roll-over clears them. Every task tool compared stores a date (Things: When + Deadline; Obsidian Tasks: scheduled + due; Todoist: date + deadline). A date also unblocks week arrows (F1), Close the week (F4), the week clean (I3) and "assign to next Tuesday".

## The slim model (decided 2026-10-19: Q9, Q10, Q14, Q16, Q19)
- **`scheduled: YYYY-MM-DD` is the one planned-day property.** It replaces `day` and `planned`. No `scheduled` = the Backlog.
- **`rolled` and `countdown` are dropped.** Carried over is worked out, never stored: open and `scheduled` before today.
- **Done** is `done: true` plus `done_on: YYYY-MM-DD`, stamped on tick and removed on untick. `scheduled` is kept on tick and untick, so an unticked card goes back to its day (Q19).
- **Write only set values.** No empty `project` / `due` / `waiting` / `priority`, no `meeting: false`. A new to-do has `kind: todo`, `done: false`, `cssclasses`, plus `scheduled` only when planned and `priority` only when set.
- **Due and scheduled stay separate** (Q11): setting Due never fills the day.
- **The board writes nothing when it draws.** Only a user action writes (drag, tick, a window button), and every write is one `processFrontMatter` call per card.
- **Old notes are read, not rewritten** (Q9: the Tidy rule that dates old cards is off by default). A note with a weekday `day` and no `scheduled` is read through the old rule for ever (see "Reading old notes"), so an old vault draws right before anything is written.
- **Notes arriving in the To-dos folder are normalised** (Q14): created there, moved in (an Inbox capture) or renamed into it, from any source (a template error, the file explorer, a kept old template). See "Normalise on arrival".
- **No compatibility copy for older plugins** (Q16 b): the changelog says to update Lab Kit on every device first.
- Rejected: keeping `day` as a mirror (the earlier draft): two keys to keep in step, a repair rule in the engine, and 11 properties on a note; the owner chose the slim model after seeing that list.

## What follows from the slim model (not asked separately)
- **The roll-over stops writing.** With `rolled` gone, carried over is drawn from the date; if the roll-over still moved `scheduled` to today, the card would stop looking carried over the moment it was moved. So the daily roll-over has nothing left to write on new-model cards, and none at the weekend either (Q15 a holds by construction). The old roll-over's other jobs: ticking pre-tick-box `day: Done` cards and clearing last week's finished cards (`day: Done`) are done by reading instead (see "Where a card shows"). **(new Q, I2-S1)** what happens to the `Moved N unfinished to-dos to Wed` notice, the `Roll over to-dos now` command and the per-device roll-over switch: recommended (a) all three go, the board draws carried cards on every device.
- **The base filter** `day != "Done"` (`To-do board.base`) no longer hides anything for new cards; the board itself hides finished cards of earlier weeks (Q2 a). The base keeps the filter for old notes and gets `kind == "todo"` (Phase 4).
- **The built-in kanban fallback view** groups by a weekday formula of `scheduled` (decided: view-only, unstyled, R4 a). A drag in it writes nothing useful (Bases can't write a formula); the base's description says so (Phase 4).
- **The countdown setting** (`Due-date countdown`: Off / Marked / All) loses "Marked" (it read `countdown: true`). **(new Q, I2-S2)** recommended (a) Off / All, a vault set to Marked reads as All; (b) as Off.
- **Unknown values are left alone.** A typo `day: Teusday` or lower case `mon` is never read as a date and never removed by normalising (no text the owner typed is lost); such a card sits in the tray, as today. An empty `day` is an empty value and is removed.

## Reading old notes (fallback, for ever)
`dateOf(fm, now)` gives the card's planned date:
1. `scheduled` a valid date → it. `scheduled` present but not a date (typo) → none (tray).
2. Else `day` one of `Mon` … `Sun` → the first such weekday on or after `planned`; with no valid `planned`, on or after this week's Monday (what the old roll-over read). This is `cardDate` widened to Sat / Sun (Q17 a).
3. Else none: Backlog.

`isFinished(fm)` = `done: true`, or `day: Done` (a card finished before the tick box existed; today's roll-over ticked those, now they are read as finished). Its finished day is `done_on`, else none (shown nowhere: it is an old card).

## Where a card shows (the shown week = Monday W … Sunday W+6; this week unless the week arrows moved it)
"Today's column" = today's weekday; at the weekend Sat / Sun when Show weekend is on, else Mon (`todayColumn`).

| Card | Shows |
|---|---|
| open, date in the shown week, today or later (or any day of a future week) | that date's column; Sat / Sun with Show weekend off → the tray with its date pill |
| open, date before today, shown week = this week | **carried over**: today's column, amber edge (on every device: nothing is written) |
| open, date before today, shown week ≠ this week | not shown (it is carried into this week) |
| open, no date | the tray (Backlog) |
| open, date after the shown week | the tray, with a small date pill `Tue 27 Oct` (Q3) |
| finished, `done_on` in the shown week | the `N done` list of `done_on`'s column (Q4); Sat / Sun with the weekend off → Mon (where the card sat when it was ticked). Stays all week, so it can be unticked there (Q19) |
| finished, `done_on` before the shown week | not shown: finished cards of earlier weeks leave the board on Monday by themselves (Q2) |
| finished, no `done_on` | its date's `N done` list when that date is in the shown week, else not shown |

## What writes what
| Action | Writes (one call; keys removed only when present) |
|---|---|
| Drag onto a column of the shown week, today or later | `scheduled: <that date>`; removes the old keys `day`, `planned`, `rolled` |
| Drag onto a past day of this week, or any day of a past week | nothing: past columns are not drop targets; a drop there shows `Mon 19 Oct has passed: drop on today or a later day.` (Q1 a) |
| Drag onto the tray | removes `scheduled`, `day`, `planned`, `rolled` |
| Drag to where the card already is | nothing |
| Tick (board circle, chip bar) | `done: true`, `done_on: today` (when none); removes `rolled`. `scheduled` kept. Notice `Ticked "<name>". Undo` for about 8 s (Q19); Undo writes the note back as it was |
| Untick | removes `done_on`; a card on the old `day: Done` also loses `day` (**the re-tick fix kept**: Done + not done must never be read as finished again). `scheduled` kept: the card goes back to its day |
| `+ New` in a day column | the entry window opens with that column's date (today or later only); the note gets `scheduled` |
| A note arrives in the To-dos folder | the normalising patch below (once; a second run writes nothing) |
| Roll-over | nothing (see "What follows") |
| Tidy rule `To-dos: give each card a date` (off by default, Q9) | the normalising patch on every old note, with preview and backup |

## Normalise on arrival (Q14)
`normalisePatch(fm, today)` → a patch or null; the same function is the Tidy rule's per-note step. Only notes whose `kind` is `todo` or missing (a note of another kind in the folder is left alone).
- `kind` missing → `kind: todo`; `done` missing or not true / false → `done: false`.
- Old `day`: a weekday (`Mon` … `Sun`) with no `scheduled` → `scheduled` from `dateOf`; `Backlog` → nothing to add. `Done` → `done: true` (with `done_on` kept; none added). In every one of these `day` is removed. Unknown `day` values stay (above).
- `planned`, `rolled`, `countdown` removed. `done_on` on an open card removed.
- Empty values removed: `day`, `scheduled`, `project`, `due`, `waiting`, `priority` that are empty (`""`, blank, null, `[]`), and `meeting: false`.
- Runs on the first metadata change after a create or a rename into the folder (so Templater has written the note first); a blank note the board just made (`isBlankBoardNote`) is skipped until something is typed.
- Q18 a: the first time a run gives old cards a date, a notice `Gave N to-dos a planned date` once (per vault, saved in settings), plus a What's new line `Update Lab Kit on every device first; wait for Sync to finish before running Tidy up notes on a second device.`

## Readers of `day` that change (from "Existing vaults" section 6)
In our code (Phase 3): `todo.ts` (`snapOf`, `changePatch`, `rollOverPatch`), `board-card.ts`, `board-view.ts`, `lists.ts` (`isOpenTodo`, `thisWeek`, badges), `actions.ts` (`isFinished`, new to-do `day: Backlog`), `plan.ts`, `todo-picker.ts`, `plan-map.ts` (untick), `after-write.ts` (undo snapshot holds `scheduled`), `meetings` flagged counts (`day !== "Done"`), `kit/tidy.ts` `todo-properties` (no `day: Backlog` any more). In the kit (Phase 4): the To-do template, `To-do board.base`, the Weekly review (`day = "Backlog"`), Daily note (`day = ccc(date)`), One-off meeting (`day != "Done"`) and Project hub (`day = "Done"`) queries: new versions through Review update…, and for kept copies a Tidy rule that shows the query before / after. The owner's own queries on `day`: the Tidy view lists the notes that hold one (it does not rewrite them).

## Date words ("next tue")
- One parser: `parseDue` (`src/planning/due-words.ts`, twin in `vtAsk.js`): the same words for Due and for the day (`tue`, `next tue`, `27 oct`, `in 3 days`, `next week` = that Monday). One word for the day only: `backlog` (clears).
- **Quick capture:** the day mark is `>` (Q8; tested 2026-10-19: no pop-up in the middle of a line, a leading `>` is stripped): `Book NMR time +Polymers >next tue !1` → title `Book NMR time`, `scheduled` next Tuesday. Same rules as `%` (words allowed up to the next mark).
- **Entry window and the in-note chip bar:** a `Day` chip after Due: empty `+ Day`, set `Tue 27 Oct`; placeholder `Which day? (tue, next tue, 27 oct; backlog clears)`; hint `Reads as …`. Writes `scheduled` only. A past date is refused with the Q1 notice.
- To-do template (`kits/planning/Extras/Templates/To-do.md`): writes `scheduled` from the handoff only when set, and no empty keys. Needs Review update… in existing vaults (until then normalising cleans what the kept template writes).

## Week arrows (F1) and Close the week (F4), on top
Top row of the board (free since Board B Phase 1, must not be cramped), left to right:
`‹` (aria-label `Previous week`) · `Week of 19 Oct` · `›` (aria-label `Next week`) · `This week` (only when another week is shown) · gap · `3 carried over` (chip, only when N > 0, this week only) · `Close the week…`.
- Day headers `Mon 19` (Q5); today's header blue only in this week. The board always opens on this week; the shown week is not saved (Q6). Past weeks can be viewed and take no drops (Q1); future weeks take drops on any day.
- `3 carried over` (Q12 a) opens `Late cards (3)`: per card its title and `planned Mon 12 Oct`, buttons `Today`, `Tomorrow`, `Next week` (that Monday), `Backlog`, `Done`; each writes as a drag (or a tick) would.
- `Close the week…` (Q7 a: always shown, default Next Monday) opens `Close the week of 19 Oct`: `4 open to-dos are left this week.`, choices `Move them to Mon 26 Oct` (default), `Move them to the Backlog`, `Leave them (they carry over)`, a list with a box per card (all ticked), `Finished cards leave the board on Monday.`, buttons `Move 4` / `Cancel`. Pressed before the week's end it lists only cards of days already past (Q7b a), as the late-cards window does. Notes are never moved or archived.

## Phone tabs (Board B Phase 2 layout)
- Tabs `Mon 19 3` (name, date, open count); the week row above them: `‹ Week of 19 Oct ›`, with `This week` and the F4 buttons in a second row only on a phone (`is-narrow`). A past day's tab takes no drop. Swiping past Fri (or Sun) does not change the week; the arrows do.
- Nothing needs the phone to write: carried-over cards and last week's finished cards come from the dates.

## Obsidian Sync with two devices
1. The board never writes on draw; only a user action writes. Two open boards cannot answer each other.
2. Nothing is written because the date changed (no roll-over writes, no `day` mirror), so devices on different dates (midnight, time zones, a laptop asleep since Friday) never write against each other.
3. Normalising is idempotent (a normalised note gives null) and only runs on arrival, so a synced change from the other device, already normal, writes nothing.
4. Two devices change the same card before syncing: the last write wins; every write is one call, so a note is never half old and half new.
5. An older plugin (1.4.x) on another device writes `day` / `planned` / `rolled` again: the new board still reads `scheduled` first; the old keys are removed on the next drag. Not covered, by decision (Q16 b): the changelog says update every device.

## Out of scope
- Card chip icons and their hover menu (Q13): a design feedback page comes first (BACKLOG); no card change in this plan beyond the date pill and the amber edge.
- Moving or archiving notes (Archive old to-dos is unchanged); time of day, durations, placing by dependencies (parked); F3 rolled-over count (undecided); a remembered last week (Q6 no); recurring to-dos.
- Dropping `cssclasses: vt` by styling notes by `kind` (owner: optional, later).

## Phases

### Phase 1: Date model (pure, tests only, no behaviour change)
- Files: `src/planning/todo.ts` (new, beside the old functions, which stay until Phase 2: `TodoFm.scheduled`, `WEEKDAYS` (7 names), `dateOf`, `isFinished`, `isCarried`, `dropPatch`, `tickPatch`, `normalisePatch`, `undoPatch`), `src/planning/board-card.ts` (new `buildWeek(cards, head, { …, week })` placing by date per the table; `WeekCard` with `date`, `carried`, `pill`; the old `buildBoard` stays until Phase 2), tests `tests/todo-dates.test.ts`, `tests/board-week.test.ts`, `tests/i2-slim.test.ts` (the fixture vault through `buildWeek` and `normalisePatch`).
- Not changed: the view, the engine, kits, styles, user-facing text.
- Checks: every row of "Where a card shows" and "What writes what"; the re-tick case (untick on `day: Done` removes `day`, `isFinished` is then false); a past drop refused (Wed 21 Oct: Mon 19 refused, Mon 26 → `2026-10-26`, today allowed); `dateOf` the same for two `now`s when `scheduled` is set; Sunday 23:59 / Monday 00:01; fallback `day: Thu` + `planned: 2026-10-14` → `2026-10-15`; Sat / Sun `day` dated (Q17); `normalisePatch` twice = null the second time; unknown `day` kept; fixture: on Wed, Sat and Mon the board matches the expected table (carried cards in Mon at the weekend with no write).
- Size: M
- **BUILT 2026-10-19 (N2).** `todo.ts`: `WEEKDAYS`, `weekdayOf`, `dateOf`, `isFinishedTodo`, `isCarried`, `dropPatch`, `tickPatch`, `normalisePatch`, `undoPatch`; `board-card.ts`: `WeekCard`, `weekCardOf`, `datePill`, `buildWeek`. Tests `todo-dates` (33), `board-week` (21), `i2-slim` (7); 1352 in all. Fixture result: on Wed, Sat and Mon every one of the 35 cards is where the earlier measured model put it, except the two Sat / Sun cards, which now get their date (Q17 a). Normalising all 35 on Wed leaves the board unchanged on Wed and Sat; on the next Monday exactly the 4 cards of "Existing vaults" section 2 differ (3 carried over, 1 finished card with no `done_on` hidden). Found while testing: an open card dated this week was drawn in next week's column when next week was shown (fixed, test added). Nothing in the view or engine uses the new functions yet.

### Phase 2: The board and engine on dates
- Depends on: Phase 1. I2-S1 answered 2026-10-19: (a) the roll-over notice, command and per-device switch go.
- Files: `src/planning/board-view.ts` (draw `buildWeek`, drops write `dropPatch`, past columns not drop zones + notice, `Mon 19` headers, tray pill, amber from `carried`), `src/planning/board-drag.ts` (zones keyed by date), `src/planning/engine.ts` (`tickPatch` on tick, normalise on arrival, roll-over per I2-S1, old `changePatch` / `rollOverPatch` / `buildBoard` removed), `styles.css` (`.lk-board-date`, `.lk-board-pill.is-later`, `.lk-board-col.is-past`), checklist row.
- Checks: tests; obsidian-check on the fixture vault (Wednesday clock): a card dragged to Mon writes `scheduled: 2026-10-26` and shows in the tray with `Mon 26 Oct`; a Tue card of last week shows amber in Wed; last week's finished cards gone; a note copied into the folder through the file system is normalised once; errors `[]`; cropped screenshots light and dark.
- Size: L (split 2a board / 2b engine if it runs long)

### Phase 3: The other readers of `day`
- Depends on: Phase 2. I2-S2 answered 2026-10-19: (a) the countdown setting is Off / All, Marked reads as All.
- Files: `lists.ts`, `actions.ts`, `plan.ts`, `todo-picker.ts`, `plan-map.ts`, `after-write.ts`, `meetings.ts`, `kit/tidy.ts` (`todo-properties`), `todo-bar.ts`, settings (countdown options), tests.
- Checks: Home "This week" and project tiles from `scheduled`; plan rows done from `isFinished`; undo snapshot restores `scheduled`; a new to-do from the board / actions has no `day`.
- Size: M

### Phase 4: The kit (template, base, kept queries, Tidy rules)
- Depends on: Phase 3.
- Files: `kits/planning/Extras/Templates/To-do.md`, `To-do board.base` (filter, weekday formula for the fallback kanban), Weekly review, Daily note, One-off meeting, Project hub queries; `src/kit/tidy.ts` (`todo-dates`: `To-dos: give each card a date`, off by default, using `normalisePatch`; a rule for kept kit queries with before / after; a list of own notes that query `day`); the one-off notice and What's new line (Q18); `npm run kit:manifest`; tests; `npm run tidy-fixture` data.
- Checks: the fixture lists N cards; after Apply each has its `dateOf` date and no old keys; a second scan lists 0; obsidian-check on `test-vault-tidy/` (Dataview results if Dataview can be installed there, else NOT seen).
- Size: M

### Phase 5: Date words (quick capture `>`, Day chip, board New)
- Depends on: Phase 2.
- Files: `quick-todo.ts` (`>`), `due-words.ts`, `todo-bar.ts` / `entry-fields.ts` (Day chip), `commands.ts` (board New passes a date), `vtAsk.js` only if the template's prompt path needs it, tests.
- Checks: `>next tue` on Mon 19 Oct → `2026-10-27`; `>tue` on Tue → today; `>backlog` → none; marks in any order with `+` `%` `!`; the Day chip writes `scheduled` only; a past day refused.
- Size: M

### Phase 6: Undo notice on ticks (Q19)
- Depends on: Phase 2.
- Files: `board-view.ts`, `todo-bar.ts` (chip bar tick), a small `undo-notice.ts` (Notice with a button, about 8 s, `undoPatch`), `styles.css` if the button needs it, tests.
- Checks: tick then Undo leaves the front matter byte-equal to before; a second tick replaces the first notice; obsidian-check screenshot of the notice.
- Size: S

### Phase 7: Week arrows (F1), desktop and phone
- Depends on: Phase 2.
- Files: `board-view.ts` (top row, shown-week offset, phone row), `board-card.ts` (`weekTitle`), `styles.css`, tests.
- Checks: `›` shows Week of 26 Oct with next week's cards; `This week` returns; a drop on Tue of next week writes `2026-10-27`; a past week shows `N done` and takes no drop; at 390 px the week row fits in one line; screenshots.
- Size: M

### Phase 8: Close the week (F4) and Late cards
- Depends on: Phase 7.
- Files: `src/planning/board-close.ts` (new: pure `closeWeekPlan(cards, today, choice)` → patches; windows), `board-view.ts`, `styles.css`, `tests/board-close.test.ts`.
- Checks: 4 open cards → `Move 4` writes `2026-10-26` to each ticked one; unticked rows untouched; Backlog choice; Leave writes nothing; pressed on a Wednesday it lists only Mon / Tue cards; late-cards buttons write as drags; obsidian-check of both windows (design standard corners); screenshots.
- Size: M

### Phase 9: Docs
- Files: `docs/architecture.md`, `kits/planning/07 How-tos/Obsidian/Vault spec.md` (`scheduled`; `day`, `planned`, `rolled`, `countdown` gone), `docs/changelog.md` (update every device first), `docs/obsidian-test-checklist.md` 6i rows, `docs/decisions.md`.
- Done when: the owner tries the board on two devices with Sync (checklist row).
- Size: S

## Where each decision lives (check for N2 step 1)
| Decision (BACKLOG I2 / decisions.md) | Section |
|---|---|
| Q1 a no drop on a past day, notice | What writes what; Phase 1, 2 |
| Q2 a finished cards of earlier weeks leave on Monday | Where a card shows |
| Q3 tray date pill | Where a card shows |
| Q4 a `N done` by `done_on` | Where a card shows |
| Q5 a `Mon 19` headers | Week arrows; Phase 2 |
| Q6 a opens on this week | Week arrows |
| Q7 a / Q7b a Close the week | Week arrows; Phase 8 |
| Q8 `>` mark | Date words; Phase 5 |
| Q9 Tidy rule off by default | Slim model; What writes what; Phase 4 |
| Q10 slim model (`scheduled`, no `rolled` / `countdown`, only set values, new to-do keys, `+ New` sets the date, `done_on` stamp / remove, readers of `day`, fallback kanban by formula) | Slim model; What follows; Readers of `day`; Phases 3-4 |
| Q11 a due and scheduled separate | Slim model |
| Q12 a late cards chip and window | Week arrows; Phase 8 |
| Q13 icons need a design page first | Out of scope |
| Q14 normalise any note arriving | Normalise on arrival; Phase 2 |
| Q15 a no weekend roll-over writes | What follows (no roll-over writes at all) |
| Q16 b no `planned` copy, changelog | Slim model; Sync 5; Phase 9 |
| Q17 a Sat / Sun cards dated | Reading old notes |
| Q18 a one-off notice + What's new | Normalise on arrival; Phase 4 |
| Q19 Undo notice on ticks, done list all week, untick keeps `scheduled` | What writes what; Where a card shows; Phase 6 |
| decisions.md 149: day-header markers, Backlog filter, busy count, Show weekend, F1 / F4 later | already built (Board B); Week arrows |
| Optional later: drop `cssclasses: vt` | Out of scope |

## Verification
Known answers in tests (Wed 21 Oct 2026 as today): a drop on Mon = `2026-10-26` (this Monday refused); `next tue` = `2026-10-27`; old `day: Thu` + `planned: 2026-10-14` = `2026-10-15`; old `day: Sat` + `planned: 2026-10-14` = `2026-10-17`. Sync rules are tested as patch tables (a normal note → no write; two `now`s → the same date). Real two-device Sync is the owner's (not checkable by Claude).

_The section below is the measured test of the earlier draft (with `day` kept as a mirror). Its numbers informed the decisions; where it names `rolled`, the `day` mirror, the mirror repair or a `planned` copy, the slim model above replaces it._

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
  - **Measured protection:** if a drag also writes `planned` = the card's `scheduled` date (the key an older plugin reads), the old roll-over **leaves all five** next-week cards alone (Mon to Fri 26-30 Oct). An old plugin's own drag sets `planned` to today, and its `cardDate` then reads the first such weekday on or after today, which is the right date for anything within the next 7 days. Not covered: a card dated more than a week ahead, which an old board draws at the nearest such weekday. Cost: `planned` stays a key to write (it is a compatibility copy of `scheduled`; the plan's "no longer written" changes). Question Q16.

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
