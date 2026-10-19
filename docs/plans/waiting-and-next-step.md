# Waiting status (I7) and projects with no next step (I13)

_Planned 2026-10-19. Roadmap cards I7 and I13 (task-plugin comparison of 2026-10-19); the plan is approved by the orchestrator on the owner's behalf, the owner can reject it. Model: Sonnet. Branch `i7-i13-waiting` from `overnight/2026-10-19`._

## Idea
- **I7** A to-do often waits on an instrument booking, samples or a person. A text property `waiting: <who or what>`; no property = not waiting. It is not `done` and not a Day column: the card stays where it was planned.
- **I13** An Active project (Status not Done and not Paused) with no open to-do shows "no next step" so it does not go stale.

## Pieces (one commit each, one `python3 scripts/check.py` per piece)

### 1. This plan (commit)

### 2. Waiting chip
- `src/planning/todo-bar.ts`: `ChipKey` + `NAMES` get `waiting`; `todoChips` returns it after Experiment; `todoFields` gets a `kind: "text"` field after Experiment (always present, not tied to the lab folder); `todoValues` reads it; `setWaiting(fm, text)` writes `fm.waiting = text`, empty deletes the property (as `setExperiment`); `applyTodoValue` routes `waiting`.
- `entry-fields.ts` needs no change (`text` kind exists). The entry window (`New to-do`, `+ after` windows) and the in-note bar both build their chips from `todoFields`, so both get it.
- Check: `tests/todo-bar.test.ts` writing (text kept trimmed, property written), clearing (property removed, not `null`), chip order, fields list.

### 3. Waiting on the board and in lists
- `src/planning/todo.ts` (pure): `waitingOf(fm)` = trimmed `waiting` text, "" when none (a number or list is not waiting).
- `src/planning/engine.ts` `tag()`: `data-vt-waiting="<text>"` on the card, removed when cleared; `cleanUp()` removes it.
- Board look is Obsidian's own Bases DOM, so it goes in the vault snippet (`docs/architecture.md` "Where CSS goes" rule 2), not `styles.css`: `kits/planning/.obsidian/snippets/vault-theme.css` next to `.vt-rolled`: a waiting card has muted text and a left bar in `--vt-waiting` (colours from `vault-colours.css`); a `vt-badge vt-waiting` badge class is added to the existing `--vt-waiting` badge rule. `npm run kit:manifest`.
- `lists.ts`: `thisWeek`, `projectTodos` (the hub To-dos tile) and the project card's to-dos show a badge `waiting: <text>` (`vt-badge vt-waiting`) after the day badge.
- `plan.ts`: `blocked` is false for a waiting to-do (`!done && !waiting && openBefore`).
- Check: tests for the badge (thisWeek, projectTodos) and blocked; `obsidian-check` sees the card marked (`data-vt-waiting`) and its computed grey text/left bar.

### 4. "Waiting on" list
- `lists.ts`: `waitingOn(todos, hub?)` = open to-dos with waiting set (optionally only those pointing at the hub), grouped by the waiting text (case-insensitive, first spelling shown, groups A→Z, lines by priority then name). Returns `{ who, lines }[]`.
- `blocks.ts`: `case "waiting"` draws each group as a muted heading line and a list; on a project hub the block is limited to that project (the note the block is in, as `project-todos` does). Unknown-card message lists `waiting`.
- Kit: Meeting template under "Flagged for this meeting" (all projects), Project hub template (that project only). `npm run kit:manifest`. Tidy: check `src/tidy` hub / meeting rules; a group is added only if the rules need one, otherwise a BACKLOG note.
- Check: tests for the grouping, the project filter, the empty text, the templates containing the block.

### 5. I13 "no next step"
- `lists.ts`: `noNextStep(hub, todos)` = Status not Done and not Paused (empty Status counts as Active) and no open to-do pointing at the hub. `projects()` takes an optional `todos` list: adds the badge to the Home Projects tile; the tile in `blocks.ts` passes the to-dos. The hub bar in `blocks.ts` `hubBar()` shows the same badge.
- Check: tests Active with none, Active with one, Paused with none (plus Done with none, empty Status).

### 6. Docs
`docs/changelog.md`, `docs/obsidian-test-checklist.md` 6i rows for pieces 2-5, `docs/architecture.md` only if a file was added. STATUS.md is the parent session's.

## Exact new user-facing strings
| Where | Text |
|---|---|
| Waiting chip, empty / tooltip | `+ Waiting` / `Waiting` |
| Waiting chip, set | the typed text |
| Waiting chip input placeholder | `Waiting on whom or what? (empty clears)` |
| Chip icon | `hourglass` |
| List / board badge | `waiting: <text>` |
| Waiting on block, group heading | the text typed (e.g. `instrument booking`) |
| Waiting on block, empty | `Nothing is waiting.` |
| Waiting on block on a project hub, empty | `Nothing in this project is waiting.` |
| Meeting / hub heading above the block | `Waiting on` |
| I13 badge | `no next step` |
| Unknown-card list | adds `waiting` |

## Decisions the plan makes (the owner can change)
- `--vt-waiting` is the amber the kit already uses for Paused / carried over. The card keeps the amber left bar and gets muted (grey) text; no new colour.
- "Waiting" is a plain property, no new column: it does not move the card.
- No change to the To-do template: a new to-do has no `waiting` line (as Experiment).
- Empty Status on a hub counts as Active for I13.
