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
