# Plan: the to-do board in our own view (I8 spike)

_Spike 2026-10-19 (Claude, side session). Findings only: no feature code is merged. The owner chooses A, B or C._

## Goal
Decide whether the to-do board stays Obsidian's built-in Bases kanban (tagged from outside by `src/planning/engine.ts`) or becomes a view the plugin draws itself.

## Why now
`src/planning/engine.ts` reaches into the kanban's undocumented markup:
- `.bases-kanban-column`, `.bases-group-value`, `.bases-kanban-card`, `.mod-title .bases-kanban-card-line`, `[data-property="note.done"]`, `.bases-view[data-view-name="Board"]` (`engine.ts:15`, `:180-190`, `:193-201`, `:209-230`);
- a `MutationObserver` on the whole workspace to re-tag after every redraw (`engine.ts:113-117`);
- a capture-phase window click to make the done circle tick (`engine.ts:110`, `:193-201`);
- a title fallback when a card has no path attribute (`engine.ts:186-188`).
Any Obsidian update can rename these. The planned-dates model (I2), week clean (I3), lanes by project (I9) and column colours (W1) all need more of the same.

## 1. What a plugin-registered Bases view gets

Source: public `obsidian.d.ts` (obsidianmd/obsidian-api, master, read 2026-10-19). Not read: `node_modules` (blocked).

| Piece | API | Since |
|---|---|---|
| Register | `plugin.registerBasesView(id, { name, icon, factory, options })`; returns `false` when Bases is off in the vault | 1.10.0 |
| View class | `abstract class BasesView extends Component`: `type`, `app`, `config`, `allProperties`, `data`; you implement `onDataUpdated()` | 1.10.0 |
| Factory | `(controller: QueryController, containerEl) => BasesView`; `containerEl` is the area under the Bases toolbar | 1.10.0 |
| Entries | `data.data: BasesEntry[]` (filters, sort and limit already applied); `BasesEntry.file: TFile`, `getValue("note.day" \| "file.name" \| "formula.x")` → `Value` | 1.10.0 |
| Grouping | `data.groupedData: BasesEntryGroup[]` = `{ key?: Value, entries, hasKey() }`, from the toolbar's Group by; no-value entries get a `NullValue` key | 1.10.0 |
| Group order | `.base` view key `groupOrder: [...]`: "only these groups appear, in this order" (`BasesConfigFileView.groupOrder`) | 1.14.3 |
| Sorting | `config.getSort()`; `data` is already sorted | 1.10.0 |
| Filters | applied by Bases before `data` reaches the view (base filters + view filters) | 1.10.0 |
| Shown properties | `data.properties` / `config.getOrder()` (the Properties menu), `config.getDisplayName(id)` | 1.10.0 |
| Config options | `options(config)` → dropdown, file, folder, formula, multitext, property, slider, text, toggle, or a group of these; read with `config.get(key)`, write with `config.set(key, v)` (saved in the `.base` file) | 1.10.0 (file/folder later) |
| Re-render | Bases calls `onDataUpdated()` with a fresh `data` after any vault or config change; entries are recreated, so keep no references | 1.10.0 |
| New note | `createFileForView(name?, fm => …)`: Obsidian's own new-note flow with front matter set | 1.10.2 |
| Value drawing | `Value.renderTo(el, ctx)` draws a property the way Bases does (links, tags, dates) | 1.10.0 |
| Writing | none: the view writes with our own `fileManager.processFrontMatter` | n/a |
| Drag, click, touch | none: the view draws its own DOM and handles its own events | n/a |

minAppVersion: the view API needs 1.10.0; `groupOrder` needs 1.14.3. The plugin's `manifest.json` says 1.14.0 now (`manifest.json:5`), so option B with `groupOrder` means raising it to 1.14.3 at the next `/release` (or ordering columns ourselves and staying at 1.14.0).

## 2. Needed / API gives / gap

| Board needs | API gives | Gap (our code in B) |
|---|---|---|
| One column per day, fixed order Backlog, Mon … Fri | `groupedData` from the base's `groupBy: day`; `groupOrder` sets order and the set of columns (1.14.3) | Empty days: does `groupedData` contain an empty group for a `groupOrder` value with no cards? → measured in the prototype (section 3). If not, we add empty columns from our own list |
| Filter: To-dos folder, not Done | base `filters` (unchanged `.base` file) | none |
| Sort in a column: open first, then priority | `data` / group entries come presorted by the base `sort` | none |
| Card title | `entry.file.basename` | none |
| Priority / project tag | `entry.getValue("note.priority")`, `"note.project"` | none: `cardTag()` (`src/planning/todo.ts:134`) takes the front matter; we pass `metadataCache` front matter of `entry.file` |
| Countdown | `entry.getValue("note.due")` | none: `dueCountdown()` (`todo.ts:145`) |
| Carried over | `note.rolled` | none |
| Waiting grey | `note.waiting` | none: `waitingOf()` (`todo.ts:128`) |
| Done circle that ticks | nothing (Bases cards are read-only today too) | our checkbox + `processFrontMatter` (same as `engine.ts:199`), no capture-phase window click |
| Drag between columns writes `day` | nothing | our drag: HTML5 drag events on desktop, pointer events for touch; on drop `processFrontMatter(f, x => x.day = col)`. The engine's `changePatch` (`todo.ts:72`) then stamps `planned` as for a kanban drag |
| Drag within a column (order) | nothing | not needed (order comes from sort) |
| Click to open | nothing | `workspace.getLeaf(Keymod.isModEvent(e)).openFile(f)` |
| Touch (phone) | nothing | pointer-event drag with a long-press start; the built-in kanban's touch drag is lost |
| Today's column blue | nothing | a class on our own column (no `body[data-vt-today]` + theme CSS needed) |
| New card in a column | `createFileForView(name, fm => fm.day = col)` | the entry window (`window.vtEntryTodo`) as now, with the column passed directly |
| Column width, toolbar, view switcher, filters menu, search | Bases toolbar stays (we are a view inside the `.base`) | column width: our own `slider` option |
| Re-tag after every redraw | `onDataUpdated()` is the redraw: we draw tags as we draw cards | the MutationObserver, `cardFile()` title fallback and `tag()` go away (`engine.ts:113-117`, `:180-230`) |

Check (1): table written. PASS.

## 3. Prototype (throwaway, not merged)

Branch `i8-board-proto` in this worktree, commits `7e41073` (view) and `5663a03` (render stats for the measurement). Not merged, not pushed.
What it is: `src/planning/board-view.ts` (~95 lines) registers view type `lab-kit-board`; columns Backlog … Fri; card = done circle, title, priority / project tag, countdown, waiting grey, carried-over edge; HTML5 drag; click opens the note. It reuses `cardTag`, `dueCountdown`, `waitingOf`, `todayColumn` from `src/planning/todo.ts` unchanged. A bare `TodoEngine` is started in `main.ts` because the throwaway vault has no planning kit.

Run with obsidian-check (Obsidian 1.14.4, macOS, 2026-10-19) on a seeded vault: 50 to-dos in `00 Planning/To-dos` (Wed left empty), a `.base` with the board's filters, `groupBy: day`, `groupOrder`, sort. Check script: `i8-drop-check.js` in the side-session notes folder.

| Check | Result |
|---|---|
| View loads from the `.base` (`type: lab-kit-board`) | PASS: 50 cards, 6 columns, `errors: []` |
| Card pieces | PASS: 25 tags, 9 countdowns, 6 waiting grey, 5 carried over, 5 done (matches the seed) |
| `groupedData` order follows `groupOrder` | PASS: Backlog, Mon, Tue, Thu, Fri |
| `groupedData` has a group for an empty `groupOrder` value | FAIL (as the API reads): no Wed group; the view adds empty columns from its own list |
| Render time, 50 cards, `onDataUpdated` | median 2 ms, max 3 ms (20 redraws) |
| Drop Task 01 (Mon) on Wed writes `day` | PASS: `day: Mon` → `Wed`, card in Wed column 192 ms after the drop (incl. Bases' own refresh) |
| Engine stamps follow the drop | PASS: `planned: 2026-10-12` → `2026-10-19` (today), by `changePatch` as for a kanban drag |
| Done circle ticks | PASS: Task 02 `done: true`, `done_on: 2026-10-19` stamped |
| Today's column blue without `body[data-vt-today]` | PASS (Mon, screenshot) |
| Screenshot | `i8-board-proto.png` in the side-session notes folder (cropped `.lk-board`, 0.5 scale; not committed: kept out of the public repo's history) |

Not checked: a real mouse drag (the drop was synthetic `DragEvent`s), touch / phone, the toolbar's own Group by changed by a user, light theme, the user's eyes on the look.

## 4. Options

| | A. Keep the built-in kanban | B. Our own Bases view | C. Our own ItemView |
|---|---|---|---|
| What it is | as now: Bases draws, `engine.ts` tags its markup | the `.base` file stays; `type: lab-kit-board`; Bases filters / sorts / groups, we draw | a plugin tab that reads the To-dos folder itself; no `.base` |
| Depends on undocumented markup | yes (`engine.ts`, `src/kit/board-colours.ts`, `vault-theme.css`) | no: public API since 1.10.0 | no |
| Filters, sort, toolbar, search | Bases | Bases | ours to build |
| Drag, touch | Bases (touch works today) | ours (desktop shown here; touch to build) | ours |
| Board without the plugin | works | the view type is unknown: needs a fallback `kanban` view in the same `.base` | gone |
| Cost now | 0 | 5 phases, about 600-800 lines incl. tests | 6-7 phases, about 1200+ lines (B plus query, filter UI, sort, toolbar, view state) |
| I2 planned dates | more tags on cards we don't draw; date columns need a `groupOrder` per week written into the `.base` | card shows the date; columns from our own list (weekday or date) | same as B |
| I3 week clean | engine only (writes notes): same in all three | same; the Done column and "this week" are our own columns | same |
| I9 lanes by project | not possible: Bases groups one level | ours: lanes inside the view (rows by `project`) | ours |
| W1 column colours | CSS on tagged columns (works while the markup holds) | a class on our columns, a colour option per column | same as B |

## Recommendation

**B, our own Bases view.** It removes every reach into Bases' markup on the board (MutationObserver, capture click, title fallback) while keeping the `.base` file, its filters, sort and toolbar, and the user's ability to switch back to the built-in kanban in one click. The prototype drew 50 cards in 2 ms, wrote `day` on drop and the engine stamped `planned` unchanged. C costs about twice as much for nothing the board needs that B lacks. A costs nothing now but makes I2 and W1 deeper hacks and I9 impossible.
Costs of B: touch drag becomes ours to write and test on a phone; `minAppVersion` 1.14.3 if we use `groupOrder` (or 1.14.0 with our own column list); a fallback `kanban` view in the kit's `.base` for a vault with the plugin off.

## Phases (option B)

### Phase 1 — Layout, features, view (Board-B Phase 1; rewritten 2026-10-19 after the owner's choice)
Decided by the owner 2026-10-19 (two feedback pages, `docs/decisions.md`): option B; days across the top, Backlog tray at the bottom; keep F2 meeting marker, F2b deadline marker, F5 Backlog filter, F6 busy-day warning; no weekend column unless the setting says so.
- Files: `src/planning/board-card.ts` (new, pure), `src/planning/board-view.ts` (new), `src/main.ts` (register), `src/kit/paths.ts` + `src/kit/ui.ts` (two settings), `styles.css` (`.lk-board-*`), `tests/board-card.test.ts`, `tests/board-view-styles.test.ts` is not needed (`plan-map-styles.test.ts` already checks bare radii)
- Not changed: `engine.ts` keeps its DOM tagging, so the built-in kanban still works.
- Columns: Mon-Fri (plus Sat, Sun with "Show weekend"), always visible, five equal columns at 1200 px. Today's header blue (the weekend: no column is today, as in `todayMark`). Cards: the done circle (round), title, pill (`cardTag`), countdown (`dueCountdown`), carried over = amber left edge (`rolled`), waiting = grey (`waitingOf`).
- Finished cards collapse to one line "N done" per day. Cards whose `day` is not a shown column (Backlog, or Sat / Sun with the weekend off) go to the tray, so none is hidden.
- Day header: name, open count (amber over the threshold), then marker lines: meeting `Group meeting · 3 flagged` (flagged count = open to-dos flagged for that series, `flaggedFor`; no count when 0: `Group meeting`), deadline `Polymers: deadline` (project hub `deadline`, hub not Done) and `Due: Book NMR time` (a to-do's `due` that day while it sits on another day or in the Backlog; more than 2 collapse to `3 due`).
- Tray: header `Backlog (9)`, chips `All`, `Ready`, each project, `No project`, then `Fold`; folded it is one bar `Backlog (9)` with `Unfold`; fold state is kept per device (local storage `lk-board-tray-folded`). Cards scroll sideways. `Ready` = to-do has a project, is open, not waiting, and `plan.ts` says `blocked` is false.
- Done circle ticks `done`; a click on a card opens the note (Mod = new tab); desktop HTML5 drag, day to day and tray to day, writes `day` through `processFrontMatter` (the engine stamps `planned` as for a kanban drag). A drop on the tray writes `Backlog`.
- Settings (Planning): `Show weekend` (toggle, off) and `Busy day from` (number, 6; the count is amber when open cards on a day are at least this).
- Exact new strings: view name `Lab Kit board`; `Backlog (N)`, `All`, `Ready`, `No project`, `Fold`, `Unfold`, `N done`, `Group meeting · N flagged`, `X: deadline`, `Due: X`, `N due`; settings `Show weekend` ("Adds Saturday and Sunday columns to the to-do board.") and `Busy day from` ("The board shows a day's count in amber from this many open to-dos.").
- Left out on purpose: touch drag and the phone layout (Phase 2); `+ New` per column (old Phase 3); week arrows F1 and close the week F4 (after planned dates I2; the top row stays free for them); rolled-over count F3 (undecided); placing to-dos by dependencies (parked, needs durations).
- Checks: `tests/board-card.test.ts` per piece; obsidian-check on a seeded vault (50 to-dos, a series meeting this week, a hub with a deadline): 5 columns and the tray at 1200 px, markers on the right days, a chip filters, a drop from the tray on Wed writes `day: Wed`, weekend on shows Sat / Sun, errors `[]`, cropped screenshots light and dark.
- Size: L (split into: model, view, kit file, docs)

### Phase 2 — Drag on desktop and touch, phone layout
- Depends on: Phase 1
- Files: `src/planning/board-drag.ts` (new: pure rules and the pointer-drag wiring), `src/planning/board-view.ts`, `styles.css` (`.lk-board-*`), `tests/board-drag.test.ts` (new), `docs/obsidian-test-checklist.md`, `docs/changelog.md`, `docs/architecture.md`
- Not changed: `board-card.ts`, settings, markers, what a drop writes (`day` only through `processFrontMatter`; the engine stamps `planned`).
- Piece A, one drag code path (replaces HTML5 `draggable` / `dragstart` / `dragover` / `drop`):
  - `pointerdown` on a card (not on the done circle, left button only). Mouse and pen: the drag starts after 5 px of movement. Touch: a long press of 350 ms starts it; moving more than 10 px before that is a scroll and the press is dropped, so the page, the tray row and a swipe still work.
  - While dragging: a ghost with the card title follows the pointer (`position: fixed`, set with `setCssProps`), the card is dimmed, the zone under the pointer gets the dashed outline and a drop marker (a dashed bar at the end of its list or tray row). Zones are the elements with `data-drop` (day columns, the tray, on a phone the day tabs); the target comes from their rectangles (`targetAt`). Over the card's own zone: no marker, no write.
  - Auto-scroll while dragging: the tray row sideways within 48 px of its left / right edge, the page up / down within 48 px of the view's top / bottom edge (14 px per 30 ms), so a long day and a long tray are reachable.
  - Escape (or `pointercancel`) cancels: nothing is written. The click that follows a drag does not open the note.
  - Listeners sit on `document` with an `AbortController`; a redraw that arrives mid-drag (Bases data update) waits until the drag ends. A non-passive `touchmove` listener on the card calls `preventDefault` only while a drag is on. CSS: cards `touch-action: pan-y` (a horizontal swipe reaches the script; vertical scroll stays), tray cards `pan-x pan-y`, `user-select: none` and `-webkit-touch-callout: none` on cards.
  - Pure parts (`board-drag.ts`, tested): `pressState(kind, ms, dist)` → `wait | drag | abandon`; `targetAt(zones, x, y)`; `edgeStep(rect, x, y)`; `dropDay(fromKey, toKey, cancelled)` → the day to write or `null`.
  - Check: `tests/board-drag.test.ts` (long-press threshold, slop, target from a point, edge steps, cancel, same zone); obsidian-check with synthetic `PointerEvent`s (`pointerType` mouse and touch): tray to Wed, Wed to Mon, Escape cancels (no write); `day` and `planned` as expected; errors `[]`.
- Piece B, phone layout at widths under 600 px of the board's own area, or `Platform.isPhone` (a `ResizeObserver` toggles the class `is-narrow` on `.lk-board`; no redraw):
  - Day tabs across the top (`Mon 3` ... `Fri 0`; with Show weekend also Sat, Sun): the day name and the open count; today first selected (else the first day); the tab strip is sticky so it stays reachable in a long day. Only the selected day's column shows, one column wide.
  - Swipe left / right on the day area (touch only, 60 px and clearly more sideways than down) moves to the next / previous day; no wrap-around.
  - The Backlog tray stays at the bottom and is folded by default when this device has never stored a choice (`Unfold` still works; the choice is kept as before).
  - A card dragged onto a tab drops on that day (the tab gets the dashed outline; no marker).
  - Check: `obsidian-check` with the window at 390 px: tabs show with counts, only one column visible, a synthetic swipe moves the day, a touch drag onto a tab writes `day`, tray folded; cropped screenshots light and dark. A real phone is not tried (owner row in checklist 6i).
- Exact new strings: none visible beyond day names and counts already used. Accessible names only: tab strip `aria-label` "Days", tabs `role="tab"` with `aria-selected`.
- Done when: both checks pass; the owner drags on a real phone (checklist row)
- Size: M

### Phase 3 — Column New and options
- Depends on: Phase 1
- Files: `src/planning/board-view.ts`
- `+` in each column opens the entry window with the column (`window.vtEntryTodo`); column width as a `slider` option
- Size: S

### Phase 4 — Switch the kit's board and remove the tagging
- Depends on: Phases 1-3
- Files: `kits/planning/00 Planning/To-do board.base` (`type: lab-kit-board` first, built-in `kanban` second as fallback), `src/planning/engine.ts` (drop `tag()`, `cardFile()`, `onCardClick`, the MutationObserver), `kits/planning/.obsidian/snippets/vault-theme.css` (kanban rules), `kit-manifest.json`, `manifest.json` `minAppVersion` at `/release` only
- Done when: tests; existing vaults get the new `.base` through Review update…; obsidian-check
- Size: S-M

### Phase 5 — Docs and the user's try
- Files: `docs/architecture.md`, `kits/planning/07 How-tos/Obsidian/Vault spec.md`, `docs/obsidian-test-checklist.md`, `docs/changelog.md`
- Done when: the user tries it on desktop and phone
- Size: S

Then I2, I3, I9, W1 build on this view.

Owner chose B on 2026-10-19. Phase 1 above is being built; Phases 2-5 are unchanged except where Phase 1 now covers them.
