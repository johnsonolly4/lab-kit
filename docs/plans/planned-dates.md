# Plan: planned dates on to-dos (I2)

_Written 2026-10-19 (plan step I2-PLAN, side session, Opus). Not agreed yet: every behaviour change is a question in BACKLOG "Questions for the owner" (I2 Q1-Q11); the recommended answers are written in below and marked **(Q n)**. Each phase = one session, Sonnet. Builds on Board B (`docs/plans/board-own-view.md`, Phases 1-2 on `overnight/2026-10-19`)._

## Goal
A to-do knows the date it is planned for, so the board can show this week, next week and any other week, a card dragged to Monday on a Wednesday means next Monday (not this Monday, beside last Monday's finished cards), and the week can be closed.

## Why
`day: Mon` cannot say which Monday. Today `cardDate()` (`src/planning/todo.ts:58`) guesses it from `planned` (the first such weekday on or after the day the card was moved), and the board puts every `Mon` card in one Mon column (`buildBoard`, `src/planning/board-card.ts:127`): next Monday's card sits beside this Monday's finished ones, and ticked cards stay on the board until the roll-over clears them the next week (BACKLOG "Ticked to-dos stay on the board"). Every task tool compared stores a date. A date also unblocks week arrows (F1), Close the week (F4), the week clean (I3) and "assign to next Tuesday" (BACKLOG "To-do day").

## Decision taken (to confirm, Q1-Q11)
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
- `3 carried over` opens **Review late cards** (window title `Late cards (3)`): one row per carried-over card, its title and `planned Mon 12 Oct`, and buttons `Today`, `Tomorrow`, `Next week` (that Monday), `Backlog`, `Done`. Each button writes as a drag would.
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
