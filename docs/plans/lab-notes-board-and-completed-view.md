# Plan: Lab notes board and completed view

_**PLAN WAITING FOR OWNER.** Written 2026-10-20 (side session, `/phase-plan`, plan and mock-ups only, no plugin code). Built on the owner board 5 answers (2026-10-20). Owner answers of 2026-10-20 are in "Owner answers 2026-10-20" below (Q1, Q2, Q5, Q6 answered; Q3 answered (Exp. Class plus an in-silico class), Q7 answered (`closed_on` replaces `Exp. End`; migration risk open), Q8 answered A for now, Q9 proposed B waiting for the owner's yes, Q4, Q10 open). Open questions: BACKLOG "Lab notes board and completed view" and the end of this file; looks: `my_work/mockups/lab-board-options.html` (private, made-up data). Nothing here is decided by Claude; recommendations are marked "rec."._

## Phase 0 result (measured 2026-10-20, throwaway Obsidian 1.14.4, 22 made-up lab notes; details in "Phase 0 — Measure Bases" below)
**One file can hold the views: PARTLY.**
- **YES, one `.base` holds all of them.** A kanban, a list and any number of table views (up to 11 tried, also a view of an unknown type) live in one file, each with its own `filters`, `order`, `sort`, `groupBy`; they open and work independently. So option B (the completed views inside `Lab book base.base`) is possible and has no technical blocker; the fallback A is not needed for that reason.
- **NO, it is not one click, and there are no toolbar tabs.** Obsidian shows ONE button at the top left (the current view's name with a chevron). A click opens a list of the views (a search box, each name, `Add view`); a second click on the name switches. That is **two clicks, same pane, same file**, no navigation. The phone shows the same as a bottom sheet "Views" (also two taps). Which view opens first: the first one in the file (a new tab); inside one tab Obsidian remembers the last one chosen.
- Therefore **B holds** (rec. unchanged), with the owner's "one click apart" restated as "two clicks in the same file". Fallback A (a separate `Completed experiments.base` with a link row) would be one click to a different file (navigation), and two clicks plus a file open from the board. Owner: Q9 stays open until they accept "two clicks" (BACKLOG).
- Built from it (Phase 1 minimum, built-in table look only): the kit's `Lab book base.base` has the views `Completed experiments`, `RAFT experiments`, `Closed this year`; the running board counts its 30 days from `closed_on`.
- Not measured: the real Compare / merge on an edited base (Review update…), a real phone, `this` / `file.hasLink(this.file)` inside a base embedded in a chemical note (not tried), the Bases toolbar Filter dialog by hand (only the file syntax).

## Quick swap between views (measured 2026-10-20, throwaway Obsidian 1.14.4 desktop and `--mobile` emulation, 22 made-up notes; crops `my_work/analyses/bases-p0/20-29*.png`; owner asked "does the Bases board have the same limitation? I'm sure that had quick swap views", then "test this, and look at bases board code")
**Short answer: Obsidian itself has no one-click swap anywhere (file, embed or phone), but it does have a command, and a Lab Kit view CAN switch the base's view in one click. That needs an undocumented controller call, so it is a decision for the owner.**

### What is native (measured)
- **Embedded base, three ways** (`![[Multi-test.base]]`, `![[Multi-test.base#RAFT experiments]]`, a `base` code block with inline views): ALL show the same single view-switcher button (view name + chevron) as the standalone file. No tabs, no chips. A click opens the same list (search box, every view, Add view); one more click switches: **two clicks, as in the file**. Reading view, live preview (icon-only toolbar plus a `</>` button for the code block) and the phone (bottom sheet "Views", 2 taps) all look like this.
- **`#View name` works**: the embed opens on that view. The button is still there and still lists ALL views of the file, so the reader can switch away. There is no way to hide the switcher.
- **The embed switch is not saved**: `Multi-test.base` and the inline note were byte-identical after switching (md5 before/after); re-opening the note shows the pinned/first view again (the switch lives only in the open embed).
- **Commands (palette, `app.commands`, 6 `bases:` entries):** `Bases: Change view` (opens a search list of the views; works only while a `.base` FILE tab is active, NOT inside an embed; shown only when the base has 2+ views), `Add view`, `Add item`, `Copy table to clipboard`, `Insert new base`, `Create new base`. **No default hotkeys.** A hotkey can be assigned to `Change view` (Settings > Hotkeys) but it opens the list, it cannot name a view; there is no "go to view X" command and no next/previous-view command.
- Therefore the native fastest swap is: hotkey on `Change view`, type a few letters, Enter (three keystrokes), or two clicks.

### What the public API allows (`node_modules/obsidian/obsidian.d.ts`, read-only)
- Public Bases API (since 1.10.0): `Plugin.registerBasesView(id, {name, icon, factory, options})`, abstract `BasesView` (`type`, `app`, `config`, `allProperties`, `data`, `onDataUpdated()`, `createFileForView`), `BasesViewConfig` (`name`, `get/set`, `getOrder`, `getSort`, `getDisplayName`), `BasesQueryResult`, `BasesEntry`, `BasesConfigFile` / `BasesConfigFileView` (the file format), the option types.
- **`QueryController` is declared EMPTY** (`obsidian.d.ts:7643`, only `extends Component`). Nothing public lists the views of the base, reads or sets the active view, or switches it. `BasesViewConfig.name` gives only the CURRENT view's name. `BasesView` has no reference to its sibling views.
- **Undocumented, measured at runtime:** the `controller` handed to our factory is the real controller; it has `getQueryViewNames()` (all view names, in file order), `viewName` (current), `selectView(name)` (switches, in memory, does not write the file; `Bases: Change view` calls `getQueryViewNames`) and `setQueryAndView`. Probe: a registered own-type view drew chips `Running | Summary | Completed` from `getQueryViewNames()`, a click called `selectView(name)`, the toolbar button and the body switched to the built-in table view and back, the `.base` file stayed byte-identical. (The probe was a stand-in view class registered through the Lab Kit plugin in the throwaway vault; the real `board-view.ts` was not used, see not verified.)
- So: **a plugin cannot do it with the documented API only.** With the untyped members it works today on 1.14.4, but they can change without notice, TypeScript needs a cast, and the community-store review may question undocumented access (not checked; own item if chosen). Everything must fail soft (no chips) if a member is missing.

### Lab Kit's own Bases view (`src/planning/board-view.ts`, registered `lab-kit-board`)
- It draws ONLY into the container below Obsidian's toolbar (`factory(controller, el)`; `draw()` does `this.el.empty()` then builds `div.lk-board`): week row first (`drawWeekRow`, `board-week-nav.ts`: `‹ ›`, title, `This week`, right end `N carried over`, `Close the week…`), then day tabs, columns, backlog tray. `board-head.ts` is only the `+` in a day header. Obsidian's own toolbar (view button, Sort, Group, Filter, Properties, Search, New) stays above it and cannot be changed by the view.
- The constructor already receives `controller` (typed `QueryController`) and only passes it to `super`. A chip row would be one more block at the top of `draw()`: names from `controller.getQueryViewNames()`, current from `controller.viewName`, click calls `controller.selectView(name)`. Existing look pieces that could be reused: `lk-board-chips` / `lk-board-chip` (+ `is-on`; the backlog filter, `board-view.ts:162`), the week row's `lk-board-weekbtn`, the day tabs `lk-board-tabs` (role tablist). **Look decision (not decided here):** chips like the backlog filter, buttons like the week row, or tabs like the day tabs; where (above or inside the week row); phone layout.
- **Limit that decides the design:** a chip row can only appear inside OUR view types. The running board and a Summary are ours (own type), but the built-in table views (`Completed experiments`, `RAFT experiments`, `Closed this year`) are Obsidian's: no chip row there, so the way back to the board would be the two-click toolbar button again. A full chip row on every view means the Completed view is also an own type (the own-look Phases 3-6, held for Q4) or a duplicated row injected into Obsidian's header by DOM (fragile, not recommended).
- Embeds: an own-type view inside an embed would show its chips too (the same factory); not tried.

### Options and effort (no code written)
1. **Do nothing; accept two clicks (Q9 as already proposed).** Zero effort. Add the tip "Bases: Change view gets a hotkey" to the docs. Cost: not one click.
2. **Commands only, public API.** Commands `Lab Kit: Show running board / Summary / Completed` would still need to switch the view, so they need `selectView` too: not possible with documented API alone. What IS public: commands that OPEN a given note or a second `.base` file (fallback A, navigation, not a swap).
3. **Chip row in our own views (undocumented `selectView`), 'Running | Summary | Completed' above the board.** Effort small to medium: ~40 lines in `board-view.ts` plus a small drawing file like `board-week-nav.ts` (own file, per the convention), CSS reuse of the chip class, a unit test of the pure part (which chips, which is on), a fail-soft check, an obsidian-check on desktop and `--mobile`. About half a session once the look is chosen. Works from the Running/Summary views only until the Completed view is also own-type.
4. **Plus commands "Lab Kit: switch to Running / Completed"** (hotkey-assignable, named): same `selectView`, active `.base` leaf only: ~20 lines more, no look decision, works from the built-in table views too (the missing way back from chips). Small.
5. **Own Completed view (Phases 3-6)**: chips on every view, native look. Large; waits for Q4.

### Recommendation
Do **option 4 first plus option 3 for the running board**: named commands (each can have a hotkey; they work from the built-in Completed table as well) and a chip row `Running | Summary | Completed` in the Lab Kit board, both through one tiny wrapper that reads `getQueryViewNames()` / `selectView()` and quietly does nothing when they are missing. Document the native fallback (two clicks; hotkey on `Bases: Change view`) so nothing depends on the undocumented call. Owner decisions needed: (a) accept an undocumented controller call (fail-soft) for a one-click swap, or stay with two clicks; (b) the chip look (backlog-filter chip, week-row button or day-tab look; question for the feedback page, do not decide alone). Until answered: Q9 stays "two clicks".

### Not verified / not checked
- The real `board-view.ts` was not run: the planning kit is off in the throwaway vault, so `lab-kit-board` was "unknown view type" there; the chip probe used a stand-in view class (a real `BasesView` has the `getEphemeralState`/`setEphemeralState`/`focus` methods the controller calls; the stand-in lacked them and failed until stubbed).
- Chips inside an own-type embed, a real phone and real touch, `selectView` on other Obsidian versions, the store-review stance on the untyped members, a hotkey actually assigned and pressed (only the command's callback was read).
- Other plugins' quick view swaps (e.g. Notebook Navigator): no such plugin or README is in the repo or `node_modules`, and the web was not browsed, so nothing is claimed about them.

## Spike: one own view with internal tabs (measured 2026-10-20, throwaway Obsidian 1.14.4 desktop and `--mobile` emulation; owner asked "is there no way we can have our own full page that opens custom but still uses a .base file to store all the data?")
**Short answer: YES. One own view type (`lab-kit-lab-board`, documented `registerBasesView`) receives all notes the base selects and draws its own `Running | Summary | Completed` tabs with documented members only. Nothing undocumented is needed.** The `.base` file keeps the data (filters, formulas, order); our view only draws.

Test setup: a stand-in plugin (not Lab Kit code, kept in private `my_work/analyses/bases-p0/spike-own-view/`) in a throwaway vault with 20 made-up lab notes (bases-p0 seed) plus `Spike board.base` (two `lab-kit-lab-board` views, one with a view-level `filters`, and one built-in `table` view). Crops `my_work/analyses/bases-p0/30-34*.png`.

### Results
1. **Data reaches the view: YES.**
   - `this.data.data` held all 20 notes of the base-level filter (`file.inFolder(...)`); the view-level `filters` view held 8 (the RAFT ones); a 21st note created in the folder arrived as 21. `groupedData` without `groupBy` is one group with a null key (20). `data.properties` = the properties the user shows (the `order` list); `this.allProperties` = 27 ids (`file.*`, `formula.Age`, every frontmatter key as `note.<key>`).
   - `entry.getValue("note.Exp. Class")`, `note.Status`, `note.closed_on`, `note.Chemicals` (a list: `.length()`, `.get(0)`, text `[[DCM]], [[AIBN]]`), `note.Outcome` all work, also for properties that are NOT in `order` (so search can cover hidden properties). Bare `closed_on` also works. `file.name`, `file.path`, `file.mtime`, `file.ctime`, `file.folder` work; `formula.Age` (a base formula) is available and evaluated (1.96 for a note closed 2026-10-19). A missing property gives a value whose `toString()` is `null` and `isTruthy()` is false: test with `isTruthy()`.
   - Split in code: closed = `Status == "Closed"` or `closed_on` set gave running 9 / closed 11 of 20, matching the seed.
2. **Three internal tabs: YES.** Chips `Running | Summary | Completed` (buttons, `role="tab"`) redraw our own container: Summary = count tiles (All, Running, Closed, per Exp. Class: 20 / 9 / 11 / 8 Flow / 4 in silico / 8 RAFT), Completed = HTML table plus a search box, Running = four status columns with cards. Switching is our own state (`this.tab`), one click. Crops 30-*.
   - **Search** over file name plus every property in `allProperties` plus the note body (`app.vault.cachedRead`): `mn 20000` 2 rows, `Styrene` 5 rows, `flow` 5 rows of the 11-12 closed. Over `data.properties` only (the visible ones) Outcome and Chemicals were NOT found (0 rows), so search must read `allProperties` or named `note.*` ids.
   - **Data refresh: YES, tab kept.** Editing a note's frontmatter (`processFrontMatter`: Started to Closed + `closed_on`) called `onDataUpdated()` once on the SAME view instance; closed count 11 to 12, active tab and the search text were kept (they live on the instance). It also fires (once each) for a body-only edit, an edit of a note OUTSIDE the filter, and a new note: expect redraws on any vault change, so `draw()` must be cheap and must not steal the typing focus (the simple `el.empty()` redraw rebuilt the search input; the text was kept, focus was not checked by a real key press).
   - **Tab state is lost when the user switches to a built-in view and back** (toolbar view list, two clicks): Obsidian builds a NEW view instance (back on `Running`). Fix measured: `this.config.set("tab", name)` (documented `BasesViewConfig.set`) writes `tab: completed` into that view's entry in the `.base` file at once, and `this.config.get("tab")` read it back after the round trip. Cost: the file changes on every tab click (an edit-conflict/sync noise question); alternative: per-device `app.saveLocalStorage`, as the board view already does for the tray fold.
   - **Gotcha (embeds): the view must put something into its container in the constructor** (e.g. a "Loading" line). With an empty container an EMBED (`![[x.base]]`, reading view) never got `onDataUpdated` at all (toolbar showed "Results" without a count, 4 views constructed, 0 updates); a standalone tab worked either way. With a placeholder line both embeds drew and counted (21 and 9 results).
3. **Open straight onto the view: YES.**
   - `app.workspace.openLinkText('Spike board.base#Lab board RAFT only', '', 'tab')` opened the file on that view (toolbar `Lab board RAFT only`, 8 results); without `#` it opens the FIRST view in the file. With `false` (reuse the current tab) it switched that tab's view to the named one (`#Plain table`). A real link `[[Spike board.base#Lab board RAFT only|RAFT link]]` in a note, clicked in reading view, did the same. Same on the phone emulation. So a Lab Kit command "Open lab book on Completed" is `openLinkText(path + "#" + name)`, documented API, and a `.base` link row in any note works too.
   - **Embeds `![[x.base]]` and `![[x.base#View]]`: YES** (after the constructor gotcha above): the own view drew inside the note at the note's width (616 px, same as the page), each embed with its own tab state (clicking Summary in one left the other on Running); the Bases toolbar (view button, results, Sort, Group, Filter, Properties, Search, New) is still shown above our chips, as for built-in views.
   - **Plugin off:** the own-type view shows the toolbar and the line "Base configured with an unknown view type: lab-kit-lab-board" (crop 32); the built-in views of the SAME file still work (`Plain table`: 21 results, rows, crop 33); the file keeps the `type:` line (only the property-prefix change in item 5).
4. **Full page: YES, desktop and phone.** On desktop the view's container (`.bases-view` in `.view-content`) was as wide as the tab (680 of 680 px in a tab next to a sidebar), the table 656 px, the Running board columns flex to the width. `--mobile` emulation (390 x 844): container 390 px, table 366 px, no horizontal scroll (`scrollWidth` 390), chips, search and the table readable (crop 34); `openLinkText('...#View')` works. Not a real phone. The Bases toolbar above the view cannot be removed by the view (on the phone it is the icon row under the title).
5. **File syntax and rewrite: YES, with one side effect.** An own type sits beside built-in views, nothing special:
   ```yaml
   views:
     - type: lab-kit-lab-board
       name: Lab board
       order: [file.name, note.Exp. Class, note.Status, note.closed_on, formula.Age]
     - type: lab-kit-lab-board
       name: Lab board RAFT only
       filters: {and: ['note["Exp. Class"] == "RAFT"']}
     - type: table
       name: Plain table
   ```
   Own views take `filters`, `order`, `sort`, `groupBy`, `formulas` like built-in ones. **Obsidian rewrites the file when the base tab is closed** (md5 changed after open + close, with no edit, in 3 of 3 clean trials (restored original, open, close), also with a built-in view open): the only change was that `note.Exp. Class` became `Exp. Class` (the `note.` prefix is dropped from property ids in `order`); the `type`, names, filters and formulas stayed. Opening, tab clicks, switching views and note edits alone did not change the bytes. Write ids without the `note.` prefix in the kit's `.base` to avoid a changed file (Review update / merge noise) after the first use. Own options are stored in the view's entry (`tab: completed` after `config.set`).

### API members the spike used
- **Documented (in `obsidian.d.ts`):** `Plugin.registerBasesView(id, {name, icon, factory})`, the factory's `containerEl`, `BasesView` (`constructor(controller)` via `super`, `type`, `onDataUpdated()`, `data`, `config`, `allProperties`, `app`), `BasesQueryResult.data` / `.groupedData` / `.properties`, `BasesEntry.file` / `.getValue(id)`, `Value.toString()` / `.isTruthy()` (and `ListValue.length()` / `.get(i)`, read once in a probe), `BasesViewConfig.name` / `.get(key)` / `.set(key, value)`, `Component.onunload`, `Vault.cachedRead`, `FileManager.processFrontMatter` (test edits), `Workspace.openLinkText`, `createEl` / `createDiv` / `empty()`.
- **Undocumented: none in the view.** Only the test harness (not plugin code) used internals: `app.plugins` (enable the stand-in), DOM class names of the toolbar (`.bases-toolbar-views-menu`, `.bases-toolbar-menu-item`) to click the view list, and a read of the factory's `controller` fields for diagnosis only. `selectView`, `getQueryViewNames` and `viewName` were NOT used (the point of this spike).

### What it means for the plan (recommendation, owner decides)
- **Rec.: one own view type holding Running, Summary and Completed as internal tabs** (one click between tabs, our own look everywhere, documented API only), registered once like `lab-kit-board`; the kit's `.base` keeps a built-in `table` view as a fallback (plugin off or Bases-only readers) and the saved filters live in the file (`filters` per view). It answers the one-click wish without the undocumented controller call of "Quick swap" option 3, and it removes the "chips only in our views" limit because all three tabs are ours. The Completed tab is then the own-look table (Phases 3-6, held for Q4), the other two are already board-like.
- Costs and open points: (a) the Completed tab replaces the built-in table, so the saved-filter feel (Bases Filter dialog, sort by column, grouping, summaries) must be rebuilt or the toolbar's own Sort/Filter must keep driving `this.data` (they do: `data` already reflects the toolbar's filters and sort; not tested by hand); (b) where the active tab is remembered (instance only, `config.set` writes the file on each click, or local storage); (c) the placeholder line in the constructor for embeds; (d) a redraw on every vault change needs a cheap `draw()` and care for the search focus; (e) a hash-link and a command (`openLinkText`) open the base on a named view, tabs inside are ours.

### Not verified
- The real `board-view.ts` and the Lab Kit kit base were not used (stand-in plugin, plain HTML cards); drag, own look, `docs/design-standard.md` shapes and the approved visuals were not applied or compared.
- Real phone and touch, typing focus kept during a redraw with a real key press, the toolbar Sort / Filter / Search / Group dialogs driving `this.data` by hand, `createFileForView` / New button, grouped and sorted data with `groupBy` set, other Obsidian versions (only 1.14.4), the community-store review of an own view type (documented API, so not expected to be a problem; not checked), Live Preview embeds (the hidden live-preview copies rendered empty, but a window hidden by the harness may be the cause; reading view embeds worked), the Compare / merge flow on a rewritten `.base`.
- The seed makes 20 lab notes plus 5 chemical notes (the earlier sections say 22; not reconciled); counts above are from this run (20, 21 after one created note).

## Goal
Running experiments stay on a card board; finished ones are found again in a table with saved filters and search (by number or date, Exp. Class, project, chemical, outcome or result, free text), drawn in Lab Kit's own look.

## Owner answers this plan is built on (board 5, 2026-10-20; decisions)
- Look experiments up by: number or date, Exp. Class, project, chemical, outcome or result, free-text search (all six ticked).
- The list shows "Ended" (owner board 5 said `Exp. End`; replaced by `closed_on`, Q7 of 2026-10-20 chat).
- "Depends where the view is: the SUMMARY board should be a status / projects / type split, the list / detail view needs more columns."
- A closed experiment STAYS on the board for 30 days (as now) AND is also in the completed view (option B).
- Completed work: a TABLE WITH SAVED FILTERS; running work stays as cards (option A).
- "A Bases table but let's make it look visually appealing like the rest of the plugin": our own Bases view (like the to-do board, `docs/plans/board-own-view.md`), the shape standard (`docs/design-standard.md`), the entry-window look.

## Owner answers 2026-10-20 (chat, source "owner chat")
- **Q1 by project: answered (A or B accepted).** Default: A, a `Project` link set in New lab entry, with the to-dos' `experiment` links as the fallback for notes without one.
- **Q2 by result: A.** New `Result` property (`Worked` / `Partly` / `Failed` / `Unclear`), chosen in the Close experiment window.
- **Q3 "Type" in the summary: Exp. Class, AND an in-silico class (owner chat, 2026-10-20).** The summary's type split uses `Exp. Class`. The owner needs an IN-SILICO class (computational experiments, not a wet-lab run): `Exp. Class` must include `in silico`. Not built; own BACKLOG item "In-silico experiments in the lab notebook" (questions there). Note for the summary and filters: the class text is the user's own, so `in silico` and the hazard setting's `in-silico` (below) must be one spelling (see that item).
- **Q4 which parts get the own look: not decided.** The owner must SEE the built-in Bases table in Obsidian first. Build Phase 0 and Phase 1 (built-in table, `Completed experiments.base`) first; the own-look views (Phases 3-6) only after the owner has seen it and approved.
- **Q5 clock: A.** The 30-day clock for Closed cards counts from `closed_on` (last edit when there is none).
- **Q6 chemical notes: filter first.** Maybe a "Used in" list, but better a chemical filter in the experiments view. Recommended: the filter first, "Used in" later (not built now).
- **Q7 Ended: ANSWERED by the owner (chat, 2026-10-20): "Exp. End was meant to be a closed_on thing really, so we can replace it".** So `Exp. End` is RETIRED and replaced by `closed_on` (written by Close experiment) as the experiment's end / completed date. The Ended column shows `closed_on`. The earlier proposal below (Close fills `Exp. End`; Ended = `Exp. End` else `closed_on`; Tidy fills `Exp. End` from `closed_on`) is SUPERSEDED.
  - New notes: the Lab Book Template drops `Exp. End` (`kits/lab/Templates/Lab Book Template.md:64`), and the kit's property list (`kits/lab/kit-manifest.json:57`, op `add-property`) drops it; Clone stops resetting it (`src/kit/clone.ts:59`); fixtures and tests follow.
  - Old notes: a Tidy rule moves a hand-typed `Exp. End` value into `closed_on` (when `closed_on` is empty) and removes `Exp. End`.
  - **Every use of `Exp. End` found by grep (2026-10-20; `src/`, `kits/`, `tests/`, `scripts/`, `docs/`; nothing in `src/` reads it, only Clone writes it empty):**
    - `src/kit/clone.ts:59` (Clone resets it to empty)
    - `kits/lab/kit-manifest.json:57` (property list, `add-property`)
    - `kits/lab/Templates/Lab Book Template.md:64` (front matter)
    - `tests/tidy.test.ts:48`, `:49`, `:54` (expected property order in the Tidy tests)
    - `tests/fixtures/tidy-vault/03 Lab Book/Notes/ABC0005-A.md:7`
    - `tests/fixtures/lab-notes/clone-source.md:7` (value `2026-09-03`, the Clone test)
    - `scripts/smoke.mjs:34`, `scripts/make-stress-vault.mjs:49` (generated notes)
    - docs: `docs/backlog-archive.md:179` (history, leave), `docs/decisions.md:244` and `:304` (the owner's earlier lines; leave, a new decision line supersedes), this plan.
  - **BUILT 2026-10-20 (Exp. End retired; owner chat 2026-10-20, Q7b a; unit tests on made-up notes, NOT seen in Obsidian):** template, kit property list and Clone drop `Exp. End`; `isClosed` = `closed_on` AND (`closed_hash` OR `closed_pdf`, `pending` included), new `hasEnded` = `closed_on` set (`src/close/mark.ts`); Close accepts a `closed_on`-only note and keeps its date; Reopen finds such a note "not closed" and keeps `closed_on`; the scan gives no row for `closed_on` alone (a note with Status Closed and only `closed_on` still has the "marked Closed but not closed" row); Tidy rule `exp-end` (`src/kit/tidy.ts`, `src/kit/exp-end.ts`, opt-in). The board and completed view, which read `closed_on`, are unaffected. The risk below is resolved this way.
  - **RISK (resolved by the build above): `closed_on` is the Close mark.** `isClosed` is true when `closed_on` holds a value (`src/close/mark.ts:37-40`; used at `src/close/commands.ts:65` and `src/close/scan.ts:25`). Moving an old `Exp. End` into `closed_on` would therefore, unless the code changes:
    1. make Close experiment refuse the note ("already closed", `commands.ts:65`) although it has no hash and no PDF;
    2. drop the note from the Check / Tidy row "Lab notes marked Closed but not closed" (`scan.ts:26-27`, `src/kit/setup-check.ts:387`) when Status is Closed: the row is hidden by a date that is not a Close;
    3. make Reopen experiment offer to reopen it and then DELETE `closed_on` (`commands.ts:120`), i.e. lose the end date;
    4. `closed_hash` / `closed_pdf` are empty: "edited after closing" needs a stored hash (`scan.ts:30`, so no false row); "without a PDF" needs `closed_pdf: pending` (`scan.ts:28`, so no false row). These two are safe.
    Also: Reopen deletes `closed_on` even for a real Close, so a reopened-then-running note has no end date (correct) but a note that ended and was never formally closed keeps it only if nothing reopens it.
  - **Safest migration proposed (question in BACKLOG, owner to pick):** fill `closed_on` ONLY, and change the meaning of "closed": a note is formally closed when `closed_on` AND (`closed_hash` or `closed_pdf`) are present; `closed_on` alone means "ended, not formally closed" and gets no row, Close experiment still works on it (it sets hash and PDF and keeps the date, unless the owner wants today's date), Reopen on it only clears Status. The Check row "marked Closed but not closed" then still fires for a Status Closed note without hash or PDF (the owner may want that: they are not closed formally). Tests: `tests/close-*.test.ts` (find by name) get a case for each of the four points.
  - Ended column and the board: `closed_on` (all formally closed and merely ended notes); the 30-day clock (Q5) also uses `closed_on`.
- **Q8 new saved filters: A for now (owner chat, 2026-10-20).** Lab Kit ships ready-made named views; the owner adds their own with Obsidian's own Bases toolbar. No `Save as view…` button yet (option B can come later).
- **Q9 where the completed view lives: PROPOSED B, waiting for the owner's yes.** The owner said: "Getting between the two needs to be seamless": the running board and the completed view must be one click apart, with no navigation between files.
  - **Analysis.** Obsidian Bases switches between the views of ONE base file with the view tabs in the toolbar: one click, same pane, same file. Two files (A, a separate `Completed experiments.base`) need a link or an extra step (open the other file, or click a link chip); that is navigation, which the owner ruled out. Only B (more views inside `Lab book base.base`) gives the one-click switch with nothing extra to build. (Whether the view switcher behaves this way for our views is measured in Phase 0, not yet seen.)
  - **Proposed answer: B.** `Lab book base.base` holds the running board, `Summary` and the built-in `Completed table` (`All completed`, `This year`, later `Failed runs`) as views; the toolbar tabs are the switch.
  - **Cost of B.** A `Lab book base.base` the owner edited (`policy: keep`) gets the new views only through Compare / merge in Review update… (Obsidian re-saves `.base` files on toolbar use, so most vaults count as edited). Only the owner has used it, so they can restore the kit original instead. The two files are not independent any more: one bad edit of the file affects the running board and the completed views together.
  - **Alternative, A kept.** A separate `Completed experiments.base` arrives as a new file by Review update… without touching an edited `Lab book base.base` (safer migration), with a link-chip row at the top of each file to jump to the other. Not one click inside one toolbar, so it does not fully meet "seamless".
  - **Fallback if Bases cannot do B** (P0 measures: several views in one base, the first view that opens, view tabs on desktop and phone, a base with mixed built-in and own view types): go back to A with the link-chip row, and ask the owner again.
- **Q10 table look: not answered.**

Phase order after these answers: Phase 0, then Phase 1 first, so the owner can see the built-in table in Obsidian. Phase 2 then adds `Project` (New lab entry) and `Result` (Close window) as answered, and the 30-day clock moves to `closed_on`. Phases 3-6 (own look) wait for the owner's look at Phase 1 (Q4) and Q10.

## Current state (measured from the files, 2026-10-20)

### What a lab note records
From `kits/lab/Templates/Lab Book Template.md:58-75` (front matter written for every new note) and the code that adds more later:

| Property | Written by | Value | Searchable today |
|---|---|---|---|
| file name `ABC0014 - Title` | template (`:55`) | number + title | yes (Bases `file.name`) |
| `Type` | template, empty | free text (one test note has `Experiment`) | — |
| `Status` | template (`Planned`, or the board column), Close (`Closed`, `src/close/commands.ts:88`), Reopen (`Started`) | Planned / Started / Processing results / Closed | board groups by it |
| `Exp. Class` | New lab entry window (`:61`) | quoted text, the user's classes (RAFT, Flow, in-silico ...) | — |
| `Plan date` | template, today | date | — |
| `Exp. Start`, `Exp. End` | by hand only (nothing in `src/` writes them; Clone empties them, `src/kit/clone.ts:58-59`); `Exp. End` is RETIRED, replaced by `closed_on` (Q7) | date or empty | — |
| `Chemicals` | by hand with the `[[` chemical suggest (`src/chem/index.ts:50`, `chemicalLink`) | list of `[[chemical note]]` links (or plain names with no note); read by the hazard header (`src/header/hazards.ts:54`) | — |
| `CoSHH`, `RA` | by hand | text | — |
| `Objective`, `Outcome` | by hand | free text | — |
| `Rig` | Alt+S Rig snippet (`kits/lab/Templates/Snippets/14 Rig.md:8`) | `[[rig note]]` link | — |
| `progress` | only with the Checklist progress setting on (off by default, `src/kit/paths.ts:55`) | `3/7` | board card bar (`src/kit/board-colours.ts:66-75`) |
| `closed_on`, `closed_hash`, `closed_pdf`, `closed_pdf_old` | Close / Reopen experiment (`src/close/commands.ts:84-125`) | date, hash, file names or `pending` | — |
| body text | the user | headings Objectives, Apparatus, Procedure, Results / Analysis, Notes for next time | Obsidian Search only |

Not recorded on a lab note: a **project** (dropped 2026-10-12; `docs/plans/experiments-in-plan.md` "Lab notes have no `kind` and no `project`"), a **result class** (worked / failed): `Outcome` is free text. The link the other way exists: a to-do may carry `experiment: "[[ABC0014-A]]"` and a `project` (`docs/plans/experiments-in-plan.md`, `src/planning/plan.ts:31-32`), planning kit only.

### What each base shows
- `kits/lab/03 Lab Book/Lab book base.base` (kit file `note-lab-book-base-base`, `policy: keep`, optional, `kits/lab/kit-manifest.json:127-137`): base filter `file.inFolder("03 Lab Book/Notes")` (folder rewritten from settings, `docs/plans/base-filters-follow-folders.md`).
  - View 1 `Experiments`, `type: kanban`, grouped by `Status`, `groupOrder` Planned / Started / Processing results / Closed, view filter `Status != "Closed" || file.mtime > now() - "30d"` (a Closed note leaves 30 days after its **last edit**, so an edit brings it back), sorted by file name newest first, cards show `file.name` and `progress`. Column colours and the progress bar come from tagging Bases' markup (`src/kit/board-colours.ts`, `styles.css:264-279`).
  - View 2 `All experiments`, `type: list`: file name, Status, progress. No filters, no search beyond the toolbar.
- `kits/lab/05 Chemicals/Chemical database.base`: `file.inFolder("05 Chemicals/Chemicals")`; a `Table` view and a `By class` kanban by `Chemical class`. Nothing links back to the experiments that used a chemical.
- The lab header's back link opens the `.base` in the folder above the note (`src/header/render.ts:58-63`, `src/header/settings.ts:70-77`, prefers `Lab book base.base`).

## Target

| Part | Where | Shows |
|---|---|---|
| **Running board** | `Lab book base.base`, view `Experiments` | cards by Status (Planned, Started, Processing results, Closed for 30 days, as now); a card: number + title, Exp. Class pill, started / ended date, progress bar; a link line `Completed (26)` that opens the completed view |
| **Summary board** | `Lab book base.base`, a second view `Summary` | three groups of count tiles: by Status, by project, by type (Exp. Class, rec.); a tile opens the completed table (or the running board) filtered to it |
| **Completed view** | new `Completed experiments.base` (rec.) | a table of Closed notes with search, filter chips, sortable headers and saved filters (named views): `All completed`, `This year`, `Failed runs` (needs Q2), one per Exp. Class is a chip, not a view |
| **List / detail columns** | the completed table, all columns on a wide pane; a row opens a detail strip | default columns: Note (number + title), Exp. Class, Ended, Outcome; more on demand: Project, Chemicals, Result, Objective, Exp. Start, CoSHH, RA, PDF (from `closed_pdf`) |

"Ended" = `closed_on` (Q7 answered 2026-10-20; `Exp. End` is retired).

## Bases only vs a Lab Kit own view

| Need | Bases only (a `.base` in the kit, no code) | Lab Kit own view (`registerBasesView`, as the to-do board) |
|---|---|---|
| Completed table, filters, sort | built-in `table` view, named views with their own `filters` / `sort` | needed for the owner's "visually appealing" look, chips and the detail strip |
| Saved filters | each named view in the `.base` is a saved filter set (see next section) | chip state saved in the view's config (`config.set`, written into the `.base`) |
| Free-text search in names / properties | toolbar search (listed in `board-own-view.md` §2; what it matches is **not confirmed**, Phase 0) | our own box: name + all shown properties, instant |
| Free-text search in the note body | no (Bases has no body property as far as read; **not confirmed**, Phase 0) | our own box reads the filtered notes with `vault.cachedRead` |
| By chemical | a filter on `Chemicals` (link list; exact expression **not confirmed**, Phase 0) | a chip per chemical in the shown rows |
| Summary split | three `kanban` / `table` views grouped by Status / project / Exp. Class, picked from the view switcher | one view, three tile groups with counts |
| Running board | today's built-in kanban (+ the existing tagging) | cards in Lab Kit's look, drag writes `Status`; removes the tagging for this board (as I8 did for the to-dos) |
| Without the plugin | works | the view type is unknown: each `.base` keeps a built-in fallback view (as Board-B Phase 4) |

What the own view gets from the API is the same as for the to-do board (`docs/plans/board-own-view.md` §1): `data.data` already filtered and sorted, `groupedData`, `config.get / set`, `Value.renderTo`, `onDataUpdated()` on every change; minAppVersion 1.10.0 (the plugin says 1.14.0).

## Saved filters: how Bases does it, what Lab Kit can ship
- A `.base` file has base-wide `filters` and a list of `views`; each view has a `name`, its own `filters` (and / or / not of expressions), `sort`, `order` (columns), `groupBy`. The view switcher in the toolbar lists them: a named view **is** a saved filter set. Changing a filter in the toolbar writes it into that view in the `.base` (measured 2026-10-09: Obsidian re-saves the file, `docs/plans/base-filters-follow-folders.md` Phase 1 cause).
- Lab Kit can ship: the named views above with fixed filters (`Status == "Closed"`, `This year`: ended in the current year as a formula on `now()`), sort by Ended newest first, the default columns, and (own view) a default chip set. It cannot ship per-class views (the classes are the user's), so classes are chips or a `groupBy`.
- Adding the user's own saved filter: in Bases through the toolbar (new / duplicate view: **not confirmed** that duplicate exists, Phase 0); in the own view a `Save as view…` button would have to write a new view into the `.base` YAML itself (`vault.process`), which Obsidian also writes: rec. not to (Q8).

## By chemical, by outcome, by project: from what exists
- **By chemical: answerable now.** `Chemicals` is a list of links to chemical notes. (a) In the completed table: a filter `Chemicals` contains the chemical (expression to measure in Phase 0: `Chemicals.contains(link("Styrene"))` or the filter menu's "contains"). (b) In a chemical note: an embedded base "Used in" with `file.hasLink(this.file)` or `Chemicals.contains(this.file)` lists every lab note that uses it (`this` = the note the base is embedded in; **not confirmed**, Phase 0). (b) changes the Chemical database template: owner's call (Q6 part).
- **By outcome or result: partly.** `Outcome` is free text: search finds words in it ("failed", "Mn 12"), but "every failed run" is only as good as the wording. To answer it reliably add a property with fixed values. Rec.: `Result` with `Worked` / `Partly` / `Failed` / `Unclear` (names for the owner), asked as one chip row in the Close experiment window (it is the moment the result is known), editable in the properties; old notes show `not set` and can be set from the table's detail strip. Outcome stays free text. (Q2)
- **By project: not answerable without a change.** Options: a new `Project` link property (to the project hub) asked in the New lab entry window like the to-dos' project chip, empty for old notes, with a Tidy up notes rule that offers the project from a to-do whose `experiment` links the note; or no property and derive it from those to-do links (planning kit only, only linked notes; Bases formulas cannot follow a backlink to another note's property as far as read, **not confirmed**, so own view only). (Q1)
- **By number or date**: file name (number) and `closed_on` already exist; a sort on Ended and a `Year` chip. **By Exp. Class**: exists.

## Free-text search options
1. Own view box (rec.): instant over the name and every property of the rows in the view; Enter (or a `Search note text` toggle) also reads each note's body with `vault.cachedRead` and keeps rows whose text matches; matches are shown as a short line under the row. Works on the phone; cost measured in Phase 4 (target: 300 notes under 300 ms on desktop).
2. Bases toolbar search: no code; scope not confirmed (Phase 0).
3. Obsidian Search: a `Search all lab notes` button that opens core Search with `path:"03 Lab Book/Notes" ` + the words. Opening Search with a query needs a private API (`app.internalPlugins`, would go in `src/kit/obsidian-private.ts`): rec. not to; an embedded ```` ```query ```` block in a note is public but cannot read the table's filters.
Omnisearch is not required for any of these.

## Migration for existing vaults
- `Completed experiments.base` (rec. a new kit file, Q9): Review update… lists it as a new file; nothing of the user's is touched. Its folder role is `labBase` (next to `Lab book base.base`); its filter folder follows the Lab notes folder like the other bases (`planFolderReapply`, `patchFolders`).
- `Lab book base.base` changes (the `Summary` view, the 30-day clock from `closed_on` if Q5 = A, later the own running-board view with the kanban kept as fallback): `policy: keep`. Unedited → updated by Update all safe files. Edited (any toolbar change re-saves it, so most vaults) → kept, and Review update… offers Compare / merge (`src/kit/merge.ts`); nothing is overwritten. The phase that changes it says so in the changelog.
- New properties (`Result`, `Project`) are only written when set: old notes simply lack them; the table shows `not set`. No bulk rewrite. A Tidy up notes rule for `Project` from to-do links is optional (Q1).
- The chemical "Used in" block (if wanted) changes `Chemical database template.md` (policy of templates: updated like templates); existing chemical notes get it only through an Alt+S snippet or a Tidy rule (Q6).

## Phone
- Bases and plugin Bases views run on the phone (the to-do board's own view does, Board-B Phase 2; a real phone not tried there either).
- Completed table under 600 px (same `is-narrow` switch as `.lk-board`): rows become two-line items (number + title, then Ended · Exp. Class pill · Result pill), extra columns go to the detail strip; chips scroll sideways in one row; the search box stays on top.
- Summary board: tile groups stack. Running board: day-tab pattern of the to-do board (Status tabs with counts) if it becomes our own view.
- Body search on a phone reads notes from the device: measured in Phase 4 under phone emulation; a real phone is an owner checklist row.

## Out of scope
- Changing what Close experiment writes (beyond the optional `Result` chip, Q2), the PDF, the hash.
- A project property on to-dos or hubs (exists), Omnisearch, Dataview.
- The Chemical database board look.
- Bulk-filling `closed_on` from `Exp. End` on old notes (only the Tidy rule, owner chooses per run).

## Phases (one Sonnet session each, after the answers; Phase 0 may need Opus if Bases behaves unexpectedly)

### Phase 0 — Measure Bases (spike, no shipped code)
- Files: `docs/plans/lab-notes-board-and-completed-view.md` (results table), a throwaway vault via `node scripts/obsidian-check.mjs`.
- Measure: toolbar search scope (name / properties / body); `note["Exp. Class"]` in a filter and a formula; `Chemicals` contains a link; `this` + `file.hasLink(this.file)` in a base embedded in a chemical note; table `groupBy` and column summaries (count); `if()` formula for Ended; duplicate / new view in the toolbar; which view opens first; what a `.base` with an unknown view type shows with the plugin off.
- Done when: each row PASS / FAIL with the Obsidian version; the "Bases only" column above is corrected.

**BUILT 2026-10-20 (Phase 0; measured in a throwaway Obsidian 1.14.4 with `scripts/obsidian-check.mjs`, 22 made-up notes (ABC0001-ABC0022: Status, Exp. Class RAFT / Flow / in silico, Chemicals links, Outcome, `closed_on` 3 to 300 days old, one note with a retired `Exp. End`, one with an empty class, one with no properties), desktop 1700 x 900 and `--mobile` 390 x 844; seed and test bases in `my_work/analyses/bases-p0/` (private); NOT seen by the owner, no real phone, no Windows / Linux).** Crops of the toolbar and view lists: `my_work/analyses/bases-p0/*.png`.

| # | Question | Result | Exact syntax / what happened |
|---|---|---|---|
| 1 | Several views in one `.base` | PASS | `views:` list; entries `- type: kanban` / `list` / `table`, each with `name`, `filters` (`and:` / `or:` list of expression strings), `order` (columns), `sort` (`- property:` + `direction: ASC\|DESC`), `groupBy` (`property`, `direction`), `groupOrder`; a kanban + list + 3 tables, and 11 views in a test file, all worked |
| 1b | Toolbar tabs, one click | FAIL | no tabs at any width (1700 px, 11 or 2 views): one view button (name + chevron) opens a list (search box, each view with a `>` that opens "Configure view", `+ Add view`); click the name to switch = **two clicks**. Phone: bottom sheet "Views", same two taps |
| 1c | Which view opens first | PASS | the first in the file when the file is opened in a new tab; in the same tab Obsidian remembers the last chosen view. The view's `...` menu (Configure view) has **Default view** (moves that view to the top of `views:`), **Duplicate view**, **Delete view** |
| 2 | What the toolbar Search matches | PASS | case-insensitive substring words (several words each had to be found somewhere in the row's file name or shown cells; `C-12` also matched rows with no `C-12` text, so the splitting of a word at a dash is probably not literal: not pinned down) in the file name and in the **shown columns** only: `experiment 14`, `failed gel` (Outcome shown), `AIBN` (link text of Chemicals shown), `2026-10-17` (shown date) found rows; a hidden property (`objective 14`, `2026-06-12` of Exp. Start), the note body (`quokkatoken`) and the folder path (`Lab Book`) found nothing. The result count under the button did not update while searching |
| 3a | Property names with space and dot | PASS in `note["…"]`, FAIL bare | filter `note["Exp. Class"] == "RAFT"` works (8 of 8); bare `Exp. Class == "RAFT"` and `note.Exp. Class == "RAFT"` give an empty table (no error shown). In `order:` (columns) the bare `Exp. Class` and `note.Exp. Class` work and `note["Exp. Class"]` does NOT (shows a literal column of that name). Retired `Exp. End`: `note["Exp. End"]` as a filter finds the one note that has it |
| 3b | Equality | PASS | `Status == "Closed"` works; `Status = "Closed"` (single `=`) gives an empty table |
| 3c | Link-list property contains a link | PASS | all gave the same 8 notes: `Chemicals.contains(link("Styrene"))`, `Chemicals.contains("[[Styrene]]")`, `Chemicals.contains(file("Styrene.md"))`, `Chemicals.contains(link("Styrene.md"))`, `file.hasLink(link("Styrene"))`, `file.links.contains(link("Styrene"))`; `Chemicals.containsAny(link("Styrene"), link("AIBN"))` gave 16 (correct). FAIL: `list(Chemicals).map(value.toString()).contains("Styrene")` (empty). Not tried: `this.file` in an embedded base |
| 3d | Dates | PASS | `closed_on` is read as a date from `YYYY-MM-DD`. `closed_on` alone is true when set (`or:` with `Status == "Closed"` gave 11 = 10 Closed + 1 ended note); `closed_on.isEmpty()`; `closed_on.year == 2026`; `closed_on.year == now().year`; `closed_on >= "2026-10-01"` and `closed_on >= date("2026-10-01")` (3 each); `closed_on > now() - "30d"` (4); `file.mtime > now() - "30d"` follows the real modified time |
| 3e | 30-day rule from `closed_on` | PASS | `Status != "Closed" \|\| if(closed_on, closed_on > now() - "30d", file.mtime > now() - "30d")` gave 13 of 20 notes (10 not closed + Closed with `closed_on` inside 30 days); a Closed note with no `closed_on` and an old edit left the board; the old rule `Status != "Closed" \|\| file.mtime > now() - "30d"` kept 16 on the same notes |
| 4a | Formulas | PASS | `formulas:` key; `Age: if(closed_on, (now() - closed_on).days, "")` shows as a column `formula.Age` with a fractional number (90.76) |
| 4b | Grouping in a table | PASS | `groupBy: property: Status` makes a header row `Status Closed` per group, rows below |
| 4c | Count summaries | PARTLY | the table's summary row offers Empty / Filled / Unique (plus number ones); `summaries:\n  Exp. Class: Filled` is what Obsidian wrote after a click and shows `Filled 10` per group. `file.name: Count` is accepted but shows `Count Empty`: no "Count" exists, use Filled |
| 4d | Sort by clicking a header | PASS | a click prepends that column to the view's `sort:` (earlier sorts stay as tie-breakers) and Obsidian saves it into the file within a few seconds |
| 4e | Duplicate view, per-view filters | PASS (file syntax) | Duplicate view (in the `...` menu of Configure view) adds `<name> 2` at the end with the same filters and switches to it; each view keeps its own `filters`. The toolbar Filter dialog was not clicked (plan 2026-10-09: it writes into the open view) |
| 4f | Column title | PASS | base-wide `properties:\n  note.closed_on:\n    displayName: Ended` renames the column (a bare `closed_on:` key does nothing); `file.name:` can be renamed the same way (not used) |
| 4g | Obsidian re-saves the file | measured | after toolbar use the file is rewritten (keys reordered, `sort` added, duplicates appended); the plugin's folder patch and Compare / merge have to cope with that (an edited base) |
| 5 | Unknown view type (own type, plugin off) | PASS | the file opens; the view shows `Base configured with an unknown view type: lab-kit-board` under the toolbar; the other views of the same file work normally. The same with the plugin on but the type not registered (no planning kit in the throwaway vault). The result count in the toolbar showed a stale number |
| 6 | Phone emulation (390 px) | PASS | the multi-view base opens on its first view; the view button shows name + count; tapping it opens the "Views" sheet; Completed experiments opened as a table (11 rows; only the first columns fit, scroll sideways); the unknown-type message shows. No real touch |

Corrections to the "Bases only vs own view" table: toolbar search = file name + shown columns, NOT the body and NOT hidden properties (body search needs the own view or Obsidian Search); "By chemical" filter: `Chemicals.contains(link("Name"))`; saved filters = named views (Duplicate view exists); a Bases Summary view works as a grouped table (`Filled` counts) but a tile summary needs the own view; view switcher = a button and a list, not tabs. And in Q9 above, "toolbar tabs … one click" should read "the view button and a list: two clicks, same pane".

### Phase 1 — Completed views in the Lab book base (Bases only)
- Depends on: Phase 0, Q8 (answered: A), Q9 (proposed B, owner's yes needed; with A this phase builds the separate file plus link chips instead).
- Files: the kit's `Lab book base.base` (edited: the built-in `table` views `All completed`, `This year` (and `Failed runs` after Phase 2) added next to the running board; with Q9 = A instead `kits/lab/03 Lab Book/Completed experiments.base` (new)), `kits/lab/kit-manifest.json` (`npm run kit:manifest`), `tests/lab-bases.test.ts` (new: parses the `.base` YAML; filters, views, sort, folder string follows `patchFolders`; the running board's filter is unchanged).
- Formula `ended`; columns per the owner's pick. The toolbar view tabs are the one-click switch between running board and completed views.
- If Phase 0 shows Bases cannot hold these views in one file: fall back to the separate file with a link-chip row and ask the owner again.

**BUILT 2026-10-20 (Phase 1 minimum, option B; Phase 0 said PARTLY: one file holds the views, switching is two clicks; checked in a throwaway Obsidian 1.14.4 on 22 made-up notes: row counts per view match the seed (board 15 = Planned 5 + Started 4 + Processing 3 + Closed 3, Completed 11, RAFT 8, Closed this year 9); `tests/lab-bases.test.ts`; NOT seen by the owner, Review update… / Compare for an edited base NOT run).** The kit's `Lab book base.base` has a base-wide `properties:` (`note.closed_on` shown as **Ended**) and the views Experiments (kanban; its Closed cards now count the 30 days from `closed_on`, from the last edit when there is none), All experiments (list, unchanged), **Completed experiments** (table; `or:` Status == "Closed" / `closed_on` set; sort `closed_on` DESC; columns file name, Exp. Class, Chemicals, Outcome, Status, `closed_on`), **RAFT experiments** (`note["Exp. Class"].lower().contains("raft")`) and **Closed this year** (`closed_on.year == now().year`). Built-in table look only. **Not matched / left for the owner:** the Summary view (Phase 5), `Failed runs` (needs Result, Phase 2), no project column (no `Project` yet), the table's look (mock-up options A-C: only Obsidian's own table here), search in the note text and a single-click switch (Obsidian has neither for built-in views). `RAFT experiments` names the owner's own class word; other groups of users can edit or delete the view. Migration: `policy: keep`; edited vaults get it through Compare / merge.
- Done when: tests; obsidian-check on 40 made-up lab notes: row counts per view match the seed, one click on a toolbar tab switches running board to completed table; Review update… on a vault with an edited `Lab book base.base` offers the new views through Compare / merge (measured, with the kit installed).

### Phase 2 — New properties (as answered 2026-10-20: `Project` from Q1, `Result` from Q2; 30-day clock from `closed_on`, Q5)
- Depends on: Q1, Q2 (and a feedback page for the chip row, which is a visual change).
- Files: `kits/lab/Templates/Lab Book Template.md` (none if properties are written only when set), `src/planning/entry-window.ts` or the lab entry flow (`window.vtEntryLab`) for `Project`, `src/close/commands.ts` + its window for `Result`, `tests/close-commands.test.ts`, the lab entry tests.
- Done when: tests (written only when set; Close / Reopen round trip keeps `Result`); obsidian-check: New lab entry with a project, Close with `Failed`; Phase 1's `Failed runs` view added.

### Phase 3 — Own completed-table view (model + drawing)
- Depends on: Phase 1, the owner's look pick (Q10).
- Files: `src/lab/lab-table.ts` (new, pure: rows from entries, Ended fallback, chips from the values present, sort, search over name + properties), `src/lab/lab-table-view.ts` (new: `registerBasesView("lab-kit-lab-table")`), `src/main.ts`, `styles.css` (`.lk-labt-*`, variables only), `tests/lab-table.test.ts`, `Completed experiments.base` (own view first, built-in table kept as fallback).
- Done when: tests; `plan-map-styles.test.ts` passes (no bare radius); obsidian-check: 40 notes, chips filter, header click sorts, chip state survives a reload (saved in the view config), errors `[]`, cropped screenshots light and dark compared with the approved look.

### Phase 4 — Search note text, detail strip, phone layout
- Depends on: Phase 3.
- Files: `src/lab/lab-table.ts` (body match, pure on given texts), `src/lab/lab-table-view.ts`, `styles.css`, tests.
- Done when: tests; body search time on 300 made-up notes reported (desktop and phone emulation); the 390 px layout as in the approved look.

### Phase 5 — Summary board view
- Depends on: Phase 3 (shares the model), Q3.
- Files: `src/lab/lab-summary.ts` (pure counts), `src/lab/lab-summary-view.ts`, `kits/lab/03 Lab Book/Lab book base.base` (view `Summary`, with a built-in fallback), `styles.css`, tests.
- Done when: tests (counts on a fixture); obsidian-check: counts match the seed, a tile opens the completed view filtered.

### Phase 6 — Running board in our own look (only if Q4 = B)
- Depends on: Phase 3; the to-do board's drag code (`src/planning/board-drag.ts`) reused.
- Files: `src/lab/lab-board-view.ts`, `Lab book base.base` (own view first, kanban fallback), `src/kit/board-colours.ts` (lab board rules dropped once unused), `styles.css`, tests.
- Done when: drag between Status columns writes `Status`; a drop on Closed does NOT close the experiment (as now: Check setup lists it); Closed column keeps the 30-day rule; obsidian-check light / dark / 390 px.

### Phase 7 — Docs and the owner's try
- Files: `docs/changelog.md`, `docs/architecture.md` (`src/lab/`), `docs/obsidian-test-checklist.md` (rows: completed view, saved views, search, phone), `kits/lab/...` how-to if any, `docs/decisions.md` line for the answers.
- Done when: the owner tries the views on desktop and phone (checklist rows).

Order checked: Phase 0 first because it decides how much is Bases only; 1 before 3 (the own view lives in that file and needs the fallback); 2 can run any time after the answers but before `Failed runs`; 5 and 6 reuse 3's model; 7 last.

## Tests
- Pure: `tests/lab-table.test.ts` (chips, sort, search, Ended fallback, `not set`), `tests/lab-summary.test.ts`, `tests/lab-bases.test.ts` (kit `.base` files parse; filters; the 30-day rule; folder patching).
- Style: the existing radius test covers new `.lk-labt-*` rules.
- Obsidian: obsidian-check per view phase on a seeded vault of made-up notes; known answers (0005, 0011) are unaffected (no engine change).
- Not verifiable by Claude: a real phone, Windows / Linux, the owner's eyes on the look.

## Risks
- Bases' filter language for property names with spaces and dots (`Exp. Class`) and for link lists: wrong syntax shows an empty table, not an error (Phase 0).
- Obsidian re-saves `.base` files on toolbar use, so most vaults count as "edited" and keep the old `Lab book base.base`: the new views reach them only through Compare / merge. Mitigation with Q9 A: the completed view is a new file. With the proposed Q9 B this is the accepted cost (owner restores the kit original, or uses Compare / merge).
- The own view type is unknown with the plugin off: every `.base` keeps a built-in fallback view.
- Body search on hundreds of notes on a phone may be slow: the body part runs only on Enter / the toggle.
- Old notes keep a hand-typed `Exp. End` until Tidy moves it; `closed_on` is empty on running and never-closed notes, so Ended is blank there. The migration risk in Q7 (the Close mark) is resolved (Q7b a, built 2026-10-20: `closed_on` alone = ended, not closed).
- Bases is undocumented in places (toolbar search, duplicate view); anything not measured in Phase 0 is not promised in UI text.

## Open questions (multiple choice, rec. first; BACKLOG "Lab notes board and completed view")
1. **By project**: A (rec.) a new `Project` link to the project hub, asked in New lab entry, empty on old notes, optional Tidy rule filling it from to-dos' `experiment` links · B no property, derived from to-dos' `experiment` links (planning kit only, linked notes only, own view only) · C drop by project.
2. **By outcome or result**: A (rec.) a new `Result` property, values `Worked` / `Partly` / `Failed` / `Unclear`, asked as a chip row in the Close experiment window; Outcome stays free text · B search Outcome text only · C a convention: Outcome starts with the result word.
3. **"Type" in the summary split**: A (rec.) Exp. Class · B the `Type` property (empty in the template today) · C both.
4. **Which parts get Lab Kit's own look**: A (rec.) the completed table now; summary board and running board after the table's look is approved · B all three in this plan (adds Phase 6) · C built-in Bases views only, styled with CSS.
5. **The 30-day clock for Closed cards**: A (rec.) 30 days from `closed_on` (from the last edit when there is none) · B from the last edit, as now (an edit brings a card back).
6. **Chemical "Used in" list in chemical notes**: A (rec.) yes, an embedded base in the Chemical database template + an Alt+S snippet for old chemical notes · B no, the completed table's Chemicals filter is enough.
7. **Ended**: ANSWERED, `closed_on` replaces `Exp. End`. Follow-up Q7b ANSWERED a and BUILT 2026-10-20 (owner chat): old notes migrate with the Tidy rule `exp-end`; `closed_on` alone is "ended, not closed".
8. **Making a new saved filter**: ANSWERED A for now (2026-10-20): Lab Kit ships named views; your own come from Bases' toolbar. B (a `Save as view…` button) not now.
9. **Where the completed view lives**: PROPOSED B, waiting for the owner's yes (owner: running board and completed view must be one click apart, "seamless"): more views inside `Lab book base.base`, toolbar tabs as the switch; cost and alternative A (separate `Completed experiments.base` plus link chips) in "Owner answers 2026-10-20", Q9.
10. **The look** (mock-up page, section 4): A rows in a card (rec.) · B compact lines · C row cards; and the summary tiles and running cards as drawn, or comments on the page.

## Who else calls the Bases controller (researched 2026-10-20; GitHub code search via the `gh` API, raw source read, web search)
Question (owner): do many other plugins call `selectView`, `getQueryViewNames`, `viewName` on the controller Obsidian hands to a registered Bases view? **Short answer: a few do, none is a big name, and the official API does not offer a switch.** Searches are GitHub code search, which is capped and indexes only part of GitHub: counts are "found", not "all".

### Counts (found 2026-10-20)
- **`registerBasesView` in real source** (mocks, tests, docs and vendored copies left out): 194 repos; **86 of them are in the official directory** (`community-plugins.json`, 9231 entries). Code search reported 462 files in total.
- **`getQueryViewNames`**: 8 files in all of GitHub. Only **1 plugin calls it** (padasch/obsidian-my-hotfixes, not in the directory). The rest: a reimplementation of Bases (obsenmd/notes), a typings file (fronglemog/obsidian-base-source-editor-plugin `src/obsidian-types.d.ts`), a test-mock list, and notes.
- **`selectView` on a Bases controller**: **4 plugins call it**; 1 more only declares it (see table). **1 of the 4 is in the official directory** (bases-cms).
- **`controller.viewName` read** (the active view's name, no call): 4 more plugins, 2 in the directory.
- Nothing found in the official docs or `obsidian.d.ts` for any of the three: `QueryController` is still an empty class (`@since 1.10.0`, current `obsidian-api` master, package version 1.14.4). No Bases type was added after 1.10.0 (checked `@since 1.11` to `1.14` tags).

### Who uses what (source read, file:line on the default branch the day of the check)
| Plugin | Directory? | Uses | Where |
|---|---|---|---|
| davidvkimball/obsidian-bases-cms (`bases-cms`, 0.5.15, 2026-10-09) | yes | `controller.selectView(name)` to open on a default view, feature-checked with `typeof`, with `setView` / `switchView` guesses as fallbacks | [`src/views/cms-view.ts:724-736`](https://github.com/davidvkimball/obsidian-bases-cms/blob/master/src/views/cms-view.ts#L724-L736) |
| padasch/obsidian-my-hotfixes (1.0.30, 2026-07-06) | no | its own view-switcher row: `controller.selectView`, `getQueryViewNames()`, `controller.viewName`; feature-checked | [`main.ts:312-313`](https://github.com/padasch/obsidian-my-hotfixes/blob/main/main.ts#L312-L313), `1344`, `1477-1478`, `1595-1596` |
| Maws7140/Views ("More views for Bases") | no | embedded bases: `controller.viewName` + `controller.selectView`; file tabs: `leaf.setViewState({state:{viewName}})` | [`src/base-tabs/BaseViewTabsHost.ts:23-59`](https://github.com/Maws7140/Views/blob/master/src/base-tabs/BaseViewTabsHost.ts#L23-L59) |
| obsenmd/notes | no | its own `BasesController extends QueryController`, implements `selectView`, `getQueryViewNames`, `viewName` (an app that re-implements Bases; shows the shape of the members) | [`src/renderer/bases/controller.ts:1196-1245`](https://github.com/obsenmd/notes/blob/main/src/renderer/bases/controller.ts#L1196-L1245) |
| KulySocc/obsidian-folder-base-view (`folder-base-view`, 0.1.2) | yes | declares `selectView?` and other internals (`updateCurrentFile`, `setQuery`); the ADR says "undocumented internal Bases APIs", feature-detected, "tolerated but scrutinised in community-plugin review". I did not find the `selectView` call itself | [`src/bases/basesInternals.ts:20`](https://github.com/KulySocc/obsidian-folder-base-view/blob/main/src/bases/basesInternals.ts#L20), [ADR 0001](https://github.com/KulySocc/obsidian-folder-base-view/blob/main/docs/adr/0001-in-memory-scope-injection.md) |
| callumalpass/canvas-bases (`canvas-bases`, 0.1.5) | yes | reads `controller.viewName` and `controller.query.views` | [`src/bases/CanvasBasesView.ts:212-214, 498-499`](https://github.com/callumalpass/canvas-bases/blob/main/src/bases/CanvasBasesView.ts#L498-L499) |
| flowing-abyss/obsidian-micropatches (`micropatches`, 1.11.1) | yes | reads `controller.viewName`; patches toolbar and pagination of core Bases | [`src/patches/bases-column-search.ts:152`](https://github.com/flowing-abyss/obsidian-micropatches/blob/main/src/patches/bases-column-search.ts#L152) |
| iiz00/obsidian-base-views (0.1.0) | no (forum: BRAT) | reads `controller.viewName`, `controller.query.views` | [`src/bases/TaskListViewCustom.ts:196-215, 697`](https://github.com/iiz00/obsidian-base-views/blob/main/src/bases/TaskListViewCustom.ts#L196-L215) |
| mdelobelle/link-suggester (0.0.1, 2023) | no | builds its own controller and sets `ctrl.viewName` | [`src/engine/basesAdapter.ts:313`](https://github.com/mdelobelle/link-suggester/blob/master/src/engine/basesAdapter.ts#L313) |

Also: typed declarations of the whole internal controller (`getQueryViewNames`, `selectView`, `setEphemeralState`, ...) exist in the community `obsidian-typings` style file in fronglemog/obsidian-base-source-editor-plugin (`base-source-editor`, 0.6.2, directory) [`src/obsidian-types.d.ts:409, 493`](https://github.com/fronglemog/obsidian-base-source-editor-plugin/blob/main/src/obsidian-types.d.ts#L409). Counting the bases-cms copies that vaults vendor (dozens of `.obsidian/plugins/bases-cms/main.js` files) would inflate the numbers; I left them out.

### A way that does not touch the controller
Two plugins switch a **file tab** with the ordinary View API and the undocumented state key `viewName`: hornatx/base-view-switcher (`base-view-switcher`, 1.0.4, directory; `main.js:191-197`: `view.getState()`, set `viewName`, `view.setState(state)`) and Maws7140/Views (above). This works on a `.base` tab, but I did not test it on an embed (Maws7140 uses the controller for embeds, which suggests it does not work there). The key `viewName` is also not in the docs. Untested by me in Obsidian.

### Official word
- The only official pages on Bases views are the [Build a Bases view guide](https://docs.obsidian.md/plugins/guides/bases-view) and [`registerBasesView`](https://docs.obsidian.md/Reference/TypeScript+API/Plugin/registerBasesView); both only hand a `QueryController` to the factory. No page mentions switching views. Searching the developer docs repo for `selectView` and `getQueryViewNames`: 0 hits.
- Changelog: Bases API arrived in [1.10.0](https://obsidian.md/changelog/2025-10-01-desktop-v1.10.0/) ("initial version"); no later entry about Bases API changes turned up (I did not read every 1.11 to 1.14 entry).
- Forum: feature requests exist ([API access to results of a Bases view](https://forum.obsidian.md/t/provide-api-access-to-the-results-of-bases-view/110660), [action menu item](https://forum.obsidian.md/t/obsidian-bases-api-support-for-adding-an-action-menu-item/109283)); the plugin thread [Base Views](https://forum.obsidian.md/t/plugin-base-views-quick-view-switching-for-base-files-custom-bases-views/111918) does not name the mechanism. None says Obsidian plans a switch API. Not found: any staff statement on the three members.

### Review and rules
- [Plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines) do not mention undocumented or internal APIs (the closest: "Avoid using global app instance", which "might be removed in the future"). The reviewer lint (`obsidianmd/eslint-plugin`) has no rule for them; `no-unsupported-api` only checks the minimum app version. `obsidian-releases` search for "internal API", "undocumented", "private API" on issues and PRs: 0 hits.
- Obsidian's [blog](https://obsidian.md/blog/future-of-plugins/): new versions are scanned automatically and a failing version is dropped from search within a day; humans look at popular, featured and flagged plugins.
- Evidence of tolerance: bases-cms (calls `selectView`) and folder-base-view (declares and relies on other internals) are in the directory, so at least those two passed review. I found **no** case of a rejection for it. That is absence of evidence, not a promise.

### Other quick switchers and full pages
- hornatx/base-view-switcher: buttons in the `.base` title bar (state key method above). iiz00/obsidian-base-views: a view list for `.base` files, mechanism not read. padasch/obsidian-my-hotfixes: a switcher row, controller method. Maws7140/Views: tabs for file and embeds. theluckystrike/bases-filter-switches (directory): chips for saved filters, not for views (no `selectView` or `viewName` in its source).
- A custom full page over Bases data: KulySocc/folder-base-view opens a pinned Bases leaf and drives it through the controller (no own ItemView); callumalpass/canvas-bases and others register their own Bases view type and draw inside it. I did not find a plugin that wraps Bases data in its own `ItemView`.

### What I could not confirm
- GitHub code search is capped (1000 results per query), skips some files and large bundles, and treats `selectView` as a common word, so the real number of callers may be higher, especially in minified `main.js`.
- I did not run any of these plugins; "uses X" means the source contains it, not that it works on 1.14.4.
- The Obsidian Discord was not searched (not reachable). Forum search was by web search only, not the forum's own search.
- The review bot's comments on `obsidian-releases` PRs are mostly closed or not indexed; I cannot rule out a rejection.

### Answer
**Not many.** Of 194 repos that register a Bases view, 4 call `selectView` (1 in the directory), 1 calls `getQueryViewNames`, and about 4 more read `viewName`. All feature-detect and degrade. No official API, no announced change, no review rule against it found. The risk is a silent break in a future Obsidian version, so Lab Kit would feature-detect (`typeof controller.selectView === 'function'`) and keep the two-click native switch as the fallback.

### Searches the owner can run by hand (github.com/search, type "Code")
- `getQueryViewNames language:TypeScript`
- `"controller.selectView" language:TypeScript`
- `selectView path:src BasesView NOT path:docs`
- `"controller.viewName" language:TypeScript`
- `registerBasesView language:TypeScript NOT path:mocks NOT path:docs`
- Obsidian Forum (Developers: API): search `bases view switch`, `QueryController`
- obsidian-releases PRs: `is:pr "internal" in:comments repo:obsidianmd/obsidian-releases`, and `repo:obsidianmd/obsidian-releases undocumented`

## Prototype vault for the owner

Prototype vault for the owner: test-vault-labboard/ (ignored), sources in my_work/prototypes/lab-board-proto. Options A to E, made-up notes; delete the folder when done.

## Owner feedback on the prototypes and the decision (2026-10-20)

Feedback (from `test-vault-labboard/START HERE.md`):
- **A (native):** likes the dragging (a button bar at the top of the lab note template that changes state would also be fine). Cards too big, locked to two sizes, no multi-row card with the extra information.
- **B (own view with tabs):** likes the easy switch to Summary and Completed. Dislikes that the Bases filter / toolbar row is still visible. Asks for own card height and a way to hide the toolbar.
- **C (closed tray):** OK only if custom tile heights are easy.
- **D (block in a note):** not a favourite (no dragging).
- **E (quick switch):** avoid.

**Decision (owner, 2026-10-20):** direction **B**: one own view inside the `.base` with **Running | Summary | Completed** tabs. **No closed tray for now.** Own cards. Dragging between status columns. Hide the Bases toolbar if possible. E is out of the recommendation.

**Card content (owner):** code and name; Exp. Class; Status = the column; start date (`Exp. Start`); the main chemicals (first 2 to 3 of `Chemicals`, "+N"); progress. On how to-dos are assigned: "I don't know how we assign to-dos; there might be checkboxes inside, but an overall progress of these is fine." So progress is a bar and "n/m" counted from the note's own check boxes (the idea of Checklist progress, `src/planning/progress.ts`), optionally the number of open to-dos that link to the experiment through `experiment`. For closed ones: Result and closed date.

**Prototype B3** (`proto-lab-board-3`, same folder, `Option B3 (Lab Kit look).base`; 2026-10-21): B2's behaviour in the Lab Kit board look (`.lk-board-*` classes, view tabs as chips, `Hide toolbar` and `+ New lab entry` in the header row), adaptive cards (code + name always; Exp. Class pill, `Started <date>`, open to-dos, up to 3 chemicals +N, progress bar only when the note has them; two-line clamp), a round `+` in each running column header, Summary tiles, Completed table with the Alt+S search box, Exp. Class / Result filter chips and Result badges; at narrow widths one column with status tabs and the table drops Chemicals and Outcome. Screenshots `my_work/mockups/lab-board-b3-design.html`.

**Verdict on B3 (owner chat, 2026-10-21): "B3 looks good for now, build it, I will critique once released."** Built as the plugin view below; the owner's critique comes after the release.

### Build phases from B3 (2026-10-21)
- **L1 model** (pure, `src/lab/lab-board.ts`, `tests/lab-board.test.ts` on made-up fixture notes in `tests/fixtures/lab-board/`): a row per note (code / name split, Status, Exp. Class, Exp. Start, Chemicals, Outcome, Result, `closed_on`, check-box counts, open to-dos linked by `experiment`); completed = Status Closed or `closed_on` set (as the Completed experiments view); running columns Planned / Started / Processing results (+ Other when present); summary counts; completed filter (chips, search over shown fields and note text), sort.
- **L2 view** (`src/lab/lab-board-view.ts`, registered `lab-kit-lab-board` in `src/main.ts` whatever kits are on; CSS `.lk-lab-*` in `styles.css` on top of `.lk-board-*`): B3 as built in the prototype; drag writes `Status` with `processFrontMatter` (no Closed target); `+` per column and `+ New lab entry` call the real New lab entry with the column's Status (`newLabEntry({ status })` writes it into the new note after it is made, Planned is the template's own); Hide toolbar and the last tab kept per device (local storage, one setting for all lab boards); placeholder line in the constructor (embeds).
- **L3 kit base**: the own view first in `kits/lab/03 Lab Book/Lab book base.base` (as the to-do board's), the built-in views stay as the plugin-off fallback; property ids without `note.`; `tests/lab-bases.test.ts`; `npm run kit:manifest`.
- **L4 check and docs**: throwaway Obsidian (light, dark, 400 px, drag, `+`, console errors), architecture, changelog, checklist row.
- Claude's choices (follow the prototype, not asked separately): the view is called **Lab board**; Hide toolbar is one per-device switch for every lab board (the prototype kept one per base file).

**Prototype B2** (`proto-lab-board-2`, in `my_work/prototypes/lab-board-proto/`, `Option B2 (cards, drag).base`): own cards in three sizes (Compact / Normal / Tall), drag between Planned / Started / Processing results writing `Status` with `processFrontMatter`, a Closed drop target that sets `Status: Closed` only (does not run Close experiment), a per-base "Hide toolbar" switch kept in local storage. Hide toolbar adds a class to the nearest `.workspace-leaf-content` and a scoped rule hides Obsidian's `.bases-header` and `.bases-search-row` under it; no `:has`. If those class names change, the toolbar just shows. Open to-dos are counted from the metadata cache (`experiment`, `done` not true). Checked in a throwaway Obsidian (desktop and phone emulation, synthetic pointer events, not a real mouse); the owner has not tried B2 yet.
