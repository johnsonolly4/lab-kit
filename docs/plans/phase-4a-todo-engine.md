# Phase 4a: to-do engine in the plugin (session plan)

_Written 2026-10-07 by Claude while the user was away. The `reviewer` agent checked it. Phase 4 is split: 4a is the engine (this file); 4b is the commands (`new-todo`, `quick-capture`, …), next session._

## Goal
The To-do roll-over startup template (`docs/plans/kit-files/planning/Extras/Templates/Actions/To-do roll-over.md`) becomes plugin code with the same behaviour, so there's no startup template to forget on each computer.

## Behaviour kept (from the template, 2026-10-07)
- **Change handling**, for a card that is dragged or ticked:
  - Ticking stamps `done_on` and clears `rolled`; unticking removes `done_on`.
  - A drag stamps `planned` = today and clears `rolled`.
  - It only writes when a stamp is missing or wrong, so changes arriving through Obsidian Sync are not answered.
  - Brand-new notes are left to the template.
- **Roll-over:**
  - An unfinished card whose day has passed moves to today's column (Mon at the weekend), with `rolled: true`.
  - Done cards from an earlier week get `day: Done`.
  - Old `day: Done` cards without `done` are ticked.
  - Cards without `planned` count as planned this week.
  - It runs only on devices set to roll over: the `vt-rollover` local storage key, else computers yes and phones no. It starts 90 s after start-up, then rechecks every 15 min when the date changes.
- **DOM:**
  - `body[data-vt-today]`.
  - `data-vt-group` on every kanban column, refreshed on every redraw.
  - `vt-rolled` on carried-over cards.
  - Clicking the tick circle on a Board card toggles `done`.

## Design
- `src/planning/todo.ts` (pure, no Obsidian runtime, testable):
  - `DAYS`, `ymd(date)`, `todayColumn(date)`, `cardDate(fm)`.
  - `changePatch(fm, before, now, today)` → frontmatter patch or null.
  - `rollOverPatch(fm, mtime, today)` → `{ patch, kind }` or null.
  - Dates are local calendar dates as `YYYY-MM-DD` strings plus `Date`; no moment.
- `src/planning/engine.ts` (`TodoEngine`):
  - Registers `metadataCache.on("changed")`, the interval, the start timeout, a capture-phase click listener (`registerDomEvent(window, …)`) and a MutationObserver. It disconnects on unload.
  - Writes through `fileManager.processFrontMatter`.
  - Folder: `<planning role>/To-dos` (default `00 Planning/To-dos`).
- **When it runs:** only when the planning kit is switched on and installed (`kit.kits.planning.enabled` and `managed` not null). Nothing offers that install yet, so today it never runs in a user's vault.
- **Old startup template:** if `window.vtTodoEngine` exists (the template ran), the plugin calls its `stop()` before starting. The template's own rule is "a second run replaces the first", so there are no double writes. Removing the template from Templater's settings is Phase 6/7.
- **Console handle:** `window.vtTodoEngine` is not set; the plugin offers no console handle. A "Roll over to-dos now" command comes with 4b.

## Tests (`tests/todo-engine.test.ts`)
The 2026-10-07 sync scenarios:
- Synced roll-over left alone.
- Synced drag left alone.
- Synced tick left alone.
- Local drag written.
- Local tick and untick written.
- Drag of a carried-over card off today's column written.
- Roll-over:
  - A Mon card on Wed is rolled to Wed.
  - Weekend → Mon.
  - A Backlog card stays.
  - Last week's done card → `day: Done`.
  - A legacy `Done` card without `done` → ticked, with `done_on` = mtime.
  - A card without `planned` → planned this week.
  - Done this week → stays.

## After review (reviewer, 2026-10-07): what changed
- **Old startup template:** the plugin does not stop it. While `window.vtTodoEngine` exists, the plugin **stands down**: it writes nothing and shows one notice saying to remove the template. This is checked at every change and every roll-over, so it works in both start orders.
- **Seen map:**
  - Seeded after the metadata cache is resolved, or after 15 s.
  - Updated before the brand-new check.
  - Moved on rename and dropped on delete.
  - Roll-over pre-seeds it before each write.
- **Cleanup:**
  - Every event, timer and the click listener (capture) are registered with the plugin.
  - The MutationObserver watches `workspace.containerEl`.
  - On unload, `data-vt-today`, `data-vt-group` and `vt-rolled` are removed.
- **Dates:** local calendar arithmetic (`new Date(y, m, d + n)`, safe across DST). Days are strict `YYYY-MM-DD`; anything else, numbers included, counts as missing. The pure functions take `today` as an argument.
- **The gate is read once, at load:** switching the planning kit on or off takes effect after a restart.
- **Not done:**
  - An engine-level test with a fake app (the pre-seed means a roll-over write gives no second write).
  - Popout windows: the board in a popout is not tagged.
  - A UI switch for the device setting.
  - A "Roll over now" command (4b).

## Not in 4a
- The commands.
- Device setting UI: still set via the console, as the template does. Phase 6 could add a toggle.
- Watching the planning roles change while the plugin runs.
