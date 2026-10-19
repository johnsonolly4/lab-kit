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

### Phase 1 — View and card at parity
- Files: `src/planning/board-view.ts` (new), `src/planning/board-card.ts` (pure card model, new), `src/main.ts`, `styles.css`, `tests/board-card.test.ts`
- Columns from the base's `groupOrder`, empty columns added; card pieces from `todo.ts`; done circle; click opens (Mod = new tab); today class
- Done when: tests for the card model; obsidian-check shows the 50-card seed as in section 3
- Size: M

### Phase 2 — Drag on desktop and touch
- Depends on: Phase 1
- Files: `src/planning/board-view.ts`, `styles.css`
- Pointer-event drag (one code path for mouse and touch, long-press start on touch), drop marker, auto-scroll at the edges; writes `day` only
- Done when: obsidian-check drop writes `day` and `planned` follows; the user drags on a phone (checklist row)
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

Waiting for the owner's choice.
