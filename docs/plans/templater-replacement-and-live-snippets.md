# Plan: Templater replacement and live snippets

> [!warning] PLAN WAITING FOR OWNER
> Written 2026-10-20 by `/phase-plan` (Opus, plan only, no code changed). Asked by the owner in chat on 2026-10-20: "All snippets need similar rebuilding and to get the Templater replacement." Questions Q1-Q10 are at the end and in BACKLOG "Templater replacement and live snippets". Phase 0 (measure) needs no answer and can start; every later phase says which answers it needs. Looks are never decided here: every new block look goes on a feedback page first (Phase 7). Each phase = one Sonnet session.

## Goal
Every Alt+S snippet and every kit note template runs in Lab Kit itself: what goes into a note is plain text (a live block with a format version, or an ordinary calc table), editable in place, readable without the plugin; Templater is no longer needed by any kit, while Lab Kit keeps working next to it.

## What the owner has already decided (not re-asked)
- Staged removal: (b) done = Alt+S without Templater (I23 Phase 6, built 2026-10-20); (a) full removal is the goal and gets this plan (`docs/decisions.md`, 2026-10-20).
- No Templater fallback is needed; every kit template stays editable by the user; Lab Kit must keep working alongside Templater and never change or block the user's own Templater use (`docs/decisions.md`, 2026-10-19 spike line).
- GENERAL RULE for live blocks: a format version in every block; the plugin always reads older versions; a format change ships with a reader and a test on a saved old note (`docs/decisions.md`, 2026-10-20).
- Data integrity is key: plain text, flat formats, recoverable without the plugin (owner board 2, Q11, 2026-10-20; restated for this plan in chat 2026-10-20).
- Calc-table snippets were said to stay plain calc blocks (BACKLOG "Live solution block", answer 2026-10-19). The new request ("similar rebuilding") may change that for Recipe and RAFT: asked as Q1, not assumed.
- An edited vault copy of `labSnippets.js` does not override the bundled one (2026-10-20).
- Solution prep is already planned as a live block: `docs/plans/solution-live-block.md` (N4, Phases 1-3 built). This plan does not repeat it; it reuses its block rules.
- Rig is planned in `docs/plans/rig-block-no-mermaid.md` (another agent). This plan only asks that the Rig snippet keep fitting the common snippet header.

## Inventory (measured 2026-10-20 on `overnight/2026-10-19`; commands in the Appendix, re-runnable)
Labels: **measured** = counted by the Appendix commands this session; **est.** = an estimate (interpretation), scaled from the To-do spike.

### A. Alt+S snippets (11 kit files + built-in methods)
| Snippet | Kind today | Where the code is (file:line) | What lands in the note | Frozen at insert? |
|---|---|---|---|---|
| 01 Solution prep | `run: solution` | `labSnippets.js:227-272` | 2 calc tables by volume; `Made on:` date | set-up yes (rows fixed); values live (calc) |
| 02 Recipe by equivalents | `run: recipe` | `labSnippets.js:274-308` | 1 calc table (Eq., Relative to, MW, Set mmol, mass, wt%) | reagent list and solvent row fixed; values live |
| 03 RAFT recipe generator | `run: raft` | `labSnippets.js:310-342` | 2 calc tables (Targets, Reagents) | monomer list, CTA, initiator, co-solvent fixed; values live |
| 10 Combined results | `run: results` | `labSnippets.js:355-370`, `resultsTable` :203-224 | 1 calc table of XLOOKUPs into nmr / gpc / dls tables | codes and the linked tables fixed at insert (a table added later is not linked) |
| NMR, GPC, DLS (built-in), Methods-folder notes | `method` | `labSnippets.js:163-201` (`methodTable`, `methodForm`, `runMethod`), `labMethods.js:100` (`builtins`), :126 (`loadMethods`) | 1 calc fill-in table + dataset line + checklist; adds the method tag to `tags` | codes fixed; the typed data IS the record |
| 04 Variant naming matrix, 05 Sample list, 06 Sampling timetable, 11 Flow column prep, 12 Residence times, 13 Blank calc table | token template | `kits/lab/Templates/Snippets/04-06, 11-13`; engine `src/kit/snippet-template.ts` (489 lines) | calc tables | text only |
| 14 Rig | token template (`set:`, `{{#append}}`, `rig-diagram`) | `14 Rig.md`; `snippet-template.ts:274-276` | link, rig diagram, summary, appended set-up | owned by the rig plan |
- **Templater in snippets (measured):** 0 `<%` lines in the 11 Snippets files; Alt+S runs the bundled `labSnippets.js` / `labMethods.js` through its own `tp` (`src/kit/snippet-insert.ts`, 106 lines; `ui.ts:16-17` imports). Templater is used only for a user's own plain snippet with `<% %>` (`snippet-insert.ts:101`, `templaterInsert`).
- **User scripts (measured):** `labSnippets.js` 380 lines, `labMethods.js` 199, `labForm.js` 170, `labPick.js` 45 (`kits/lab/Extras/scripts/templater/`), `vtAsk.js` 96 (`kits/planning/Extras/scripts/templater/vault/`): 890 lines. `labForm.js` and `labPick.js` are unused by Alt+S since Phase 6 (BACKLOG "I23 Phase 6 leftovers" (3)). `Insert snippet.md` is 15 lines, one `<%*` block that calls the command.

### B. Note templates with Templater code (measured)
| Template | Lines | Lines with `<%` | Asks (`tp.user.vtAsk` / `tp.system.suggester` / `prompt`) | `tp.date` / `tp.file` lines | Made by (file:line) |
|---|---|---|---|---|---|
| `kits/planning/Extras/Templates/To-do.md` | 129 | 10 | 7 | 2 | New to-do, quick capture, board day `+` (`src/planning/commands.ts:71-72,142`); board New / folder template via `vtEntryTodo` (:65) |
| `Meeting series.md` | 51 | 8 | 0 | 1 | New meeting series (`commands.ts:263,297`) |
| `One-off meeting.md` | 50 | 6 | 0 | 2 | New one-off meeting |
| `Meeting.md` | 69 | 5 | 0 | 2 | New meeting, extra meeting; a series' own `template:` (`commands.ts:234,275,361`) |
| `kits/lab/Templates/Lab Book Template.md` | 97 | 5 | 1 | 3 | New lab entry (`src/kit/ui.ts:461-481`), folder template |
| `New project note.md` | 33 | 3 | 2 | 1 | New project note (`commands.ts:339`) |
| `New topic hub.md` | 25 | 2 | 0 | 2 | New topic hub (`commands.ts:325`) |
| `Project hub.md` | 79 | 1 | 1 | 1 | New project (`commands.ts:83`) |
| `New concept.md` | 44 | 1 | 3 | 1 | New concept (`commands.ts:346`) |
| `kits/planning/07 How-tos/Obsidian/Vault spec.md` | 430 | 1 (line 311, example text) | 1 | 1 | none (guide note) |
| **Total** | | **42 tag lines in 10 files** (plus `Insert snippet.md`: 1) | **15** | | 8 template ids in `commands.ts:30-37` (`TPL`) |
- Templates with **no** Templater code that Templater still runs as folder templates: `Daily note.md`, `Chemical database template.md` (New chemical: `ui.ts:510-522` through `templaterCreateNote`). `Rig template.md` is copied by the plugin already (`ui.ts:527`).
- The spike's count was 52 tag lines in 18 files (2026-10-19); the drop is the snippet stubs that became headers (I23 Phase 3) and To-do lines removed in I2 Phase 4.
- Already ported, not switched on: `src/planning/todo-note.ts` (92 lines, `todoNoteText` :74), 13 tests (`tests/todo-note.test.ts`); the hand-offs `window.vtTodo` / `vtMeeting` / `vtSeries` / … (`commands.ts:39-44`).

### C. Folder templates (measured)
`src/kit/setup-check.ts:11-22`: Daily notes → `Daily note.md`, To-dos → `To-do.md` (+ rows on 13-14), Lab notes → `Lab Book Template.md`, Chemical folder → `Chemical database template.md`. Needs Templater's matching mode and "Trigger on new file creation" (per device, not readable: `setup-check.ts:306-307`). The board's New makes an empty note in To-dos and relies on it.

### D. Lab Kit's own Templater code (measured: 257 lines in `src/` match `templater|tp.user|\btp\.`)
| File | Lines | What |
|---|---|---|
| `src/kit/obsidian-private.ts` | 68 | the private calls: `templaterCreateNote` :62, `templaterInsert` :70, `setTemplaterUserScripts` :78, `setTemplaterTemplatesFolder` :87, `hasTemplaterHotkey` :96 / `addTemplaterHotkey` :103 (unused since 2026-10-20), `addTemplaterFolderTemplate` :141, `withoutTemplaterTrigger` :198, `setTemplaterFolderMode` :213, `removeTemplaterStartup` :222, `templaterPaths` :232, `setTemplaterPath` :254 |
| `src/kit/managed-ui.ts` | 28 | first-install user-scripts folder (:137-144), Set up Templater (:366-403), kit writes under `withoutTemplaterTrigger` (:72-75) |
| `src/kit/setup-check.ts` / `setup-check-ui.ts` | 22 / 15 | Templater rows (:272-310), fixes (:196-231) |
| `src/kit/managed.ts` | 20 | `templaterScriptsAction` etc. (:535-586), `userScripts` role (:242) |
| `src/kit/ui.ts` | 19 | New lab entry / New chemical through Templater, settings text |
| `src/kit/paths.ts` | 18 | folders follow Templater's template / script folders (:184-233), `newLabEntryTarget` / `newChemicalTarget` refuse without Templater (:287-298) |
| `src/kit/tidy.ts` / `tidy-ui.ts` | 15 / 3 | Tidy rule "Templater: paths into renamed folders" (:627-661) |
| `src/kit/snippet-insert.ts` / `snippet-run.ts` | 10 / 8 | own `tp`, `<% %>` plain snippets |
| `src/planning/*` | 17 | `fromTemplateFile` (`commands.ts:368-381`), template hand-offs, `engine.ts:15,37,156` (`vtTodoEngine`) |
| others (10 files) | 14 | `snippet-copy-ui.ts` 3, `snippet-copy.ts` 2, `hotkey-check.ts` 2, one each in `main.ts`, `tidy-hubs.ts`, `starter.ts` (:41 writes Templater's data.json), `snippet-template.ts`, `snippet-form.ts`, `merge.ts`, `clone.ts` |

## Target design

### 1. One engine, three kinds of snippet output
Every Alt+S entry is a header file (as today) whose header names what it makes:
| Header | Makes | Who does the work | In the note |
|---|---|---|---|
| `fields:` (token template) | text from `{{tokens}}` | `snippet-template.ts` (unchanged engine) | plain Markdown / calc tables |
| `block: <lang>` (new; replaces `run:` for live calculators) | a live block | a block module in `src/blocks/<lang>/` with a set-up window | ```` ```<lang> ```` with `format: 1` first, set-up and actual values as `key: value` lines |
| `method:` / built-in method | a fill-in table | a TypeScript port of `methodTable` (same bytes) | a calc table (the typed data is the record) |
`run: <key>` stays readable forever (old copies, edited kit files) and maps to the same TypeScript code, so `labSnippets.js` is no longer loaded once every key is ported (Phase 12).

### 2. How each snippet maps (recommendations; Q1-Q3 decide)
| Snippet | Target | Why |
|---|---|---|
| Solution prep | live ```` ```solution ```` block (N4 plan) | decided |
| RAFT recipe generator | live ```` ```raft ```` block: set-up (monomers with fractions, CTA, initiator, solvent, co-solvent %, mass, DP, CTA : initiator, solids) + `used:` per reagent; Mn, moles and masses worked out by the plugin; Edit set-up adds a monomer without rewriting the table by hand | Q1; known answer 0005 Mn = 19990.14 must come out of the new block too |
| Recipe by equivalents | live ```` ```recipe ```` block: reagents with Eq. and Relative to, one fixed amount, solvent rest, `added:` per reagent | Q1 |
| Combined results | live ```` ```results ```` block: lists only the sample codes source and the columns; values are looked up from the note's method tables every time it draws, so a table added later is included (BACKLOG "Combined results auto-refresh") | Q2; nothing copied, so nothing goes stale; the closed-experiment PDF prints the values |
| NMR / GPC / DLS / Methods-folder | stay calc fill-in tables; only the generator moves to TypeScript | Q3; the typed results are the data, and a Markdown table is the most recoverable form |
| The six token templates | stay token templates (calc tables) | already plain text |
| Rig | per the rig plan | not this plan |
Live blocks share one core (`src/blocks/core.ts`, extracted from `src/solution/block.ts` once N4 Phase 5 is in): tolerant `key: value` parser with two-space nesting and units, one-line writer, `format:` line and newer-version refusal, Actual-cell editing with `vault.process` and scroll hold, own scoped `div` rows (no `<table>`), a print form for the closed-experiment PDF. Each block's maths is a pure module with known-answer tests.

**Recoverable without the plugin:** a live block's text holds every input and every typed value; the computed targets are not stored (they are recomputed). Each block module's docs section gives the formulas in words, so a reader without Lab Kit can redo them (as `docs/snippet-syntax.md` does for calc). Q4 asks whether the block should also write a one-line plain summary of the targets under itself when the experiment is closed.

### 3. Note templates without Templater
- **Format:** a kit note template is a token template with `make: note` in its header (Q5 picks where the header sits). The body is the note text exactly as written today, front matter included, with `{{tokens}}` where Templater had `<% %>`. The user edits it like any snippet; Review update… merges it like any kit file.
- **Answers:** the existing plugin windows ask (the entry window for To-do, the series window, the lab-entry window…) and pass their answers as token values (they already build `window.vtTodo` etc.: `commands.ts:39-44`); templates that ask inside today (New concept 3, New project note 2, Project hub 1, Lab Book Template 1) list those questions as header `fields:` and ask through the plugin form.
- **Engine additions** (gaps measured in the spike, `docs/plans/templater-spike.md` "Result"): `{{today}}` and `{{date:<answer or today>±Nd|YYYY-MM-DD}}` (the meeting templates' date maths), `{{json:key}}`, `{{#if key != ""}}`, `{{note-name}}`, `{{folder}}`. No general code: anything that needs logic is a named computed token in `snippet-env.ts`, tested.
- **Creating the note:** `makeNote(templateFile, answers)` = parse, fill, `vault.create` under the name rule the command already uses (`todoFileName`, `labNoteName`, …), never over an existing file. Commands switch one template at a time (Phases 3-6).
- **Folder templates and the board's New (self-filling note):** a note made empty in a mapped folder, or a note that arrives holding a Lab Kit template header (because Templater, Obsidian's core Templates or a copy put the raw template there), is filled by Lab Kit **only when it is open in the active editor on this device** (so Sync never fills a note on two devices). Lab Kit's own folder → template list lives in plugin settings (default = today's four rows). While Templater has a folder template row for the same folder, Lab Kit leaves that folder alone and Check setup offers (asked, backup first) to move the row to Lab Kit. This is what keeps Templater working until the last phase: a Templater folder template that runs a token-format kit template gives a raw header, which Lab Kit then fills (Q6).
- **Edited kit templates that still hold `<% %>`:** see Q7. Your own non-kit templates are never touched or run by Lab Kit.

### 4. Living next to Templater
- Lab Kit never changes Templater's settings without the confirmation window, never removes Templater, and keeps `withoutTemplaterTrigger` while Templater is installed (kit files must land as text).
- A user's own `<% %>` snippets keep going through Templater when it is there (decided wording, `docs/decisions.md` 2026-10-20).
- The Tidy rule "Templater: paths into renamed folders" stays (it helps users who keep Templater).

### 5. Migration for existing vaults (never rewriting the owner's notes)
- **Notes already written** (lab notes with old Solution / Recipe / RAFT / Results calc tables, to-dos, meetings, hubs): never changed. Old calc tables keep working; the calc engine is not touched.
- **Kit template files:** an unedited one updates as usual (Update all safe files). An edited one shows in Review update… with the three-way merge (old `<%` kit text, your edit, new token text); nothing is merged automatically.
- **Tidy rules (opt-in, backup first, listed before / after):** (1) "Templater folder templates for kit folders → Lab Kit" (moves the rows, backs up Templater's setting as JSON as the 7c-2 rules do); (2) "Old kit scripts" (`labForm.js`, `labPick.js`, `labSnippets.js`, `labMethods.js`, `vtAsk.js`, `Insert snippet.md`) to Obsidian's trash once nothing in the vault calls them (Q8); (3) a report only: "Your templates with Templater code" (left as they are, listed so you know which ones Lab Kit will not run).
- **Manifest:** retired files go to `removed` (`planRetired`, `src/kit/managed.ts:444`); kit updates never delete them.
- **data.json:** nothing removed in the release that switches; old keys read for one more release.

### 6. Phone
Everything runs on the Vault API and the plugin's own windows; no Node (`hasNode()` false path tested per phase), no user-script folder to sync (the vt.ask error of 2026-10-14 goes away). Windows are centred on a phone (as today). The self-filling note needs the note open in the active editor, which also holds on a phone. Phase 0 measures the create event on a phone build (`obsidian-check --mobile`) and with a synced-in file.

## What to measure first (Phase 0, before any build)
1. **Properties view and `{{tokens}}`:** does Obsidian's property editor show, keep or rewrite a template file whose front matter holds `project: {{project}}` (invalid YAML) when the template is opened and a property is clicked? (Decides Q5.) Same for Templater's `<% %>` today, for comparison.
2. **File-create event:** order and content of `vault.on("create")` / `modify` / `file-open` for: File explorer New note in a folder, Bases' New in the To-do board, Obsidian core Templates insert, Templater folder template with trigger on, a file written by another process (Sync stand-in), and `--mobile`. Is a synced-in file ever empty at `create`?
3. **Templater + Lab Kit on one folder:** with Templater's folder template still set and the kit template already token-format, does the raw header arrive, and does Lab Kit's fill race Templater's write?
4. **Token gaps per template:** run each of the 9 templates' `<% %>` lines through the engine plan (by hand, a table): which need a new computed token. The spike measured To-do only.
5. **Size per port:** lines and tests per template (the spike measured To-do: 157 lines added, 13 tests).
Results go in a "Phase 0 result" section of this plan, labelled measured / not measured.

## Phase 0 result (measured 2026-10-21, throwaway Obsidian 1.14.4 on macOS, desktop and `--mobile`; nothing in `src/` changed)
Labels: **measured** = run by `scripts/phase0-templater-measure.js` (re-run: the three commands in its header; port 9337 so it does not clash with another check); **not measured** = said why; **est.** = estimate (interpretation).

**1. Properties view and `{{tokens}}` (measured; identical on desktop and `--mobile`).** Four template files opened in reading view, a property input focused and left, then an API property edit (`processFrontMatter`, what the Properties view writes through):
| File shape | Properties shown | Obsidian's frontmatter cache | Open / focus rewrote the file? | Property edit |
|---|---|---|---|---|
| Q5 (a): header (`make`, `name`, `fields`) first, the note's own `---` block below as text | the 3 header keys | the 3 header keys | no / no | works (only the header is touched) |
| Q5 (b): note properties first with `project: {{project}}` | none (panel empty) | none (`null`) | no / no (nothing to focus) | **refused**: "Comments must be separated from other tokens by white space characters at line 2" |
| Q5 (b'), not in the plan: properties first, tokens in quotes (`project: "{{project}}"`) | 2 properties | both keys | no / no | works |
| Templater today (`project: <% tp.file.title %>`) | 2 properties | both keys | no / no | works |
- An unquoted `{{token}}` as a property value is invalid YAML: Obsidian shows no Properties for that template and refuses edits through it. Nothing is rewritten by merely opening or clicking it.
- Not measured: whether Obsidian re-serialises (re-quotes or re-orders) the header after a real typed edit in the Properties panel; the API edit above only adds one key.

**2. File-create events (measured, same order on desktop and `--mobile`; stand-ins for the real sources).**
| Source | Events (ms after the action) | Empty at `create`? | Open in the active editor? |
|---|---|---|---|
| File explorer New note (`createNewMarkdownFile`, then `openFile` as the explorer does) | `create` len 0 at 4, `file-open` at 16 | yes | yes, from `file-open` on |
| Bases-style `vault.create` with front matter, not opened | `create` len 19 at 8; no `file-open` | no (stand-in had text) | **no** (the active file stayed the earlier note) |
| Another process writes a whole file (Sync stand-in) | `create` len 24 at 14 | no | no |
| Another process writes an empty file, then the text 600 ms later | `create` len 0 at 21, `modify` len 24 at 616 | **yes** | no |
| Obsidian core Templates insert into an empty note | not measured: the insert call left the note at 0 bytes (call not resolved; needs the real command window) | | |
- Answers: a synced-in file **can** be empty at `create` (when the writer writes empty first; real Sync not measured). A note made in the explorer is empty at `create` and open only from `file-open` (12 ms later here), so the fill rule must act on `file-open` (or the next `modify`), never on `create`. Real Bases' New button: **not measured** (its create path is not callable from the shell; stand-in only).

**3. Templater and Lab Kit on one folder (measured 2026-10-21, desktop only; Templater 2.26.0 official release, `main.js` 454294 bytes, `manifest.json` 756, `styles.css` 4201, downloaded with the owner's OK into its own folder and copied into the throwaway vault only; re-run: `scripts/phase0-templater-coexist.js`, header has the commands).** Setup: Templater's folder-template row for `T Todos` → a token-format template (`make: note` header, then the note's own `---` block), "Trigger on new file creation" on (this is per device, in Obsidian's local storage under `templater-local-settings`, not in Templater's `data.json`: setting only `data.json` does nothing). The Lab Kit fill does not exist yet, so a stand-in listener logged where the planned rule would fire and, in two runs, really wrote the filled text.
| What was made | Templater's fill | What arrived |
|---|---|---|
| Explorer New note in the mapped folder (create + open) | yes, **446-455 ms after create** (about 400 ms after `file-open`) | the **raw header** exactly as in the template file (114 bytes, `{{project}}` unfilled) |
| `vault.create` empty, not opened | yes, 310 ms | the raw header |
| `vault.create` with only front matter (`kind: todo`), not opened (Bases-style stand-in) | yes, 311-343 ms: Templater reads "no text below the front matter" as empty | **a mixed note**: `kind: todo` + `make: note` + `fields:` in one front matter, then the template's own `---` block (125 bytes); the clean header is gone |
| Another process writes a whole file | no (file has text); a no-change `modify` at about 310 ms | as written |
| Explorer New note in an unmapped folder | no | empty |
| Same, template with `<% tp.date.now("YYYY") %>` (control) | yes, about 420 ms | `year: 2026`, i.e. Templater really ran |
- **Order:** `create` (empty) → `file-open` (10-160 ms) → Templater's `modify` (300-455 ms). Templater waits 300 ms, re-reads the file, and fills only when nothing is below the front matter; otherwise it only re-runs `<% %>` on the text (a no-change `modify`).
- **Race (stand-in that wrote):** (a) Lab Kit fills at `file-open` (47 ms): Templater's 300 ms pass finds text and rewrites the same bytes; final = one fill. (b) Lab Kit waits for the raw header (432 ms): fills over it; final = one fill. No double fill in either order; both end with the filled text only. Not measured: a fill that takes longer than 300 ms to write, and mobile.
- **Real Bases New button: not measured.** Bases and its toolbar New item exist in the throwaway vault, but clicking it by script (click and the full pointer sequence) made no note and no menu; it needs a real pointer click. Only the stand-in above exists.
- **Does the Q6 "Templater-row guard" hold? Not as worded.** "While Templater has a row for the folder, Lab Kit leaves it alone" would leave every new note as a raw header (Templater's token-format fill is the raw template). Changed rule: **Lab Kit fills a note that holds a raw `make: note` header whether or not Templater has a row; it fills an empty note only when Templater has no row for that folder** (with a row, Templater writes the header within about 0.5 s and Lab Kit then fills it: one fill, measured). A note whose front matter already carries the header keys mixed with its own (the front-matter-only form above) is not a clean raw header: Lab Kit must not guess; list it in Check setup. Templater's row is still moved by the confirmed Fix in Phase 2.

**4. Token gaps per template (hand read of each `<%*` header and each `<%` line; 9 templates).**
| Template | Gaps beyond today's engine | In the plan's token list? |
|---|---|---|
| To-do | `JSON.stringify(waiting)` → `{{json:waiting}}`; `x != ""` for the optional lines | yes |
| Meeting series | `JSON.stringify` on `deck_*` and `template` → `{{json:…}}`; `tp.file.move` → result `name` / `folder` (`{{folder}}` for the `FROM` line) | yes |
| One-off meeting | `moment(date).format("YYYY-MM-DD")` → `{{date:date\|YYYY-MM-DD}}`; `first` (is this series first by name) = a value the caller works out; project line has a newline inside an inline `{{#if}}…{{else}}…{{/if}}`; unused-name loop (`tp.file.exists`) = the creator (`makeNote`), not a token | yes (+ creator) |
| Meeting | as One-off meeting, without `first` | yes |
| Lab Book Template | `tp.date.now` → `{{today}}`; `Exp. Class` → `{{#if expClass != ""}}{{json:expClass}}{{/if}}`; **`Status:` = plain text when it matches `^[\w .-]+$`, else JSON** (a safe-scalar rule: **not in the list**); initials, next number, existing-`Status` read from the raw note = the creator's work | **one gap: a `{{yaml:key}}` token (plain when safe, else JSON)**, est. 8 lines + 3 tests, add at Phase 5 |
| New project note | `hasHub` ternaries → `{{#if hubName != ""}}`; a fenced block inside `{{#if}}`; text right after the block on the same line (`…{{/if}}cssclasses:`) | yes |
| New topic hub | `tp.file.folder(true)` → `{{folder}}` | yes |
| Project hub | no `<%` tag in the body; `vtEnsureType` and `createFolder` = side effects of the creator | none |
| New concept | no `<%` tag in the body; folder / topic questions, `createFolder`, "already exists" refusal = the creator | none |
- Result: the plan's six tokens cover 8 of 9; one more (`yaml`) for Lab Book. Nothing needs general code. Side effects (create folder, set a property type, unused name, refuse an existing note) belong to `makeNote`, which is not Phase 1.

**5. Size per port (counted from the files; the port sizes are est.).** Template lines / lines with `<%` (measured, Inventory B): To-do 129 / 10, Meeting series 51 / 8, One-off meeting 50 / 6, Meeting 69 / 5, Lab Book Template 97 / 5, New project note 33 / 3, New topic hub 25 / 2, Project hub 79 / 1, New concept 44 / 1. Measured for To-do (spike): 75 lines of module (28 of them the template text) and 82 lines / 13 tests. **est.** with the shared `noteFromTemplate` from Phase 1: each later template needs its token-format file (template lines minus the code block, about 70-80 % of today's) plus 20-40 lines of creator glue and 8-13 tests; the spike's 100-150 lines per template falls to about 60-110. Not measured: any port other than To-do.

**Q5 / Q6 recommendations from these numbers (owner board Q27 / Q28, still open, to be re-asked with a picture).**
- **Q5: the recommendation (a) holds; it is the owner's provisional answer (b, "which is easier to edit?") that the numbers argue against.** (b) fails the plain test the owner cares about ("which is easier to edit"): a template whose properties hold `{{project}}` shows an empty Properties panel and refuses edits, whereas (a) shows the header as normal properties and keeps the note's own properties as readable text below. The new option (b'), tokens in quotes, is valid YAML, but then the note's own properties and its questions share one block, and a typed `"` in an answer would break the line (the `{{json:}}` token is for that). Recommendation unchanged: **(a)**.
- **Q6 stays (a), with changes of wording.** (1) The fill must act on `file-open` of the active note (or the next `modify`), never on `create` (an explorer note is empty at `create` and open 12 ms later; a synced-in file is never open). (2) The Templater-row guard is reworded (item 3): a raw `make: note` header is always filled; an empty note is filled only when Templater has no row for the folder. (3) The real Bases New button is **not measured** (needs a real click). No reason found to prefer (b) or (c); Templater writes the raw header about 0.3-0.5 s after create, so (c) "keep Templater's folder templates" would need the Lab Kit fill anyway.
- **Picture for re-asking both:** one image with two panels. Left, "what you see when you open a template in Obsidian": (a) the Properties panel listing `make`, `name`, `fields`, then the note's own text with its `---` block below; (b) the same template with an empty Properties panel and a red "can't edit" note. Right, "what happens when you press New on the To-do board": a three-step strip (empty note appears → the note opens → Lab Kit fills it, once; a note that only arrives by Sync stays as it is) beside the Templater row switch ("while Templater has a row here, Lab Kit does nothing"). Looks go through `render_check.py feedback` first, per the design rules.

## Phases (each = one Sonnet session; Templater keeps working until Phase 13)
Order check: 0 measures; 1-2 build the engine and the self-filling path that every template port needs, so a template can change format without breaking Templater's folder rows; 3-6 port templates one family at a time (each ships alone, the others still run through Templater); 7 is the look page that 9-11 wait for, placed so the owner can answer while 3-6 are built; 8 waits for N4 Phase 5 (the solution block's writer) to finish; 12 needs 9-11 (every `run:` key ported); 13 is last because it removes the setup help that the not-yet-switched parts still need.

### Phase 0 — Measure (no user-facing change) — MEASURED 2026-10-21 (see "Phase 0 result"; item 3 not measured)
- Files: this plan ("Phase 0 result"); scratch vault through `node scripts/obsidian-check.mjs`; no `src/` change.
- Done when: items 1-5 above answered with measured / not measured; Q5 and Q6 recommendations confirmed or changed from the numbers.
- New dependencies: none.

### Phase 1 — Engine: note templates and the missing tokens — BUILT 2026-10-21 (engine only, nothing wired; tests 2016 → 2067 (+51 in `tests/note-template.test.ts`), lint 0 errors, 5 warnings as before; the 28 scenarios of `tests/snippet-template.test.ts` and the 0005 / 0011 guards pass unchanged; leftovers in BACKLOG "Templater replacement Phases 0-1 leftovers")
- Depends on: Phase 0, Q5.
- Files: `src/kit/snippet-template.ts` (`make: note` header, `{{today}}`, `{{date:…}}`, `{{json:…}}`, `{{#if x != ""}}`, `{{note-name}}`, `{{folder}}`), `src/kit/snippet-env.ts`, new `src/kit/note-template.ts` (pure `noteFromTemplate(text, answers, env)` → `{ name, folder, text }`), tests `tests/note-template.test.ts`; `docs/snippet-syntax.md` (new tokens).
- Done when: every new token has tests (edge cases: empty answer, bad date, a JSON string with quotes and newlines); the spike's 13 To-do cases pass through `noteFromTemplate` on a token-format `To-do.md` fixture byte for byte; the six token snippets' 28 scenarios unchanged; 0005 / 0011 guards; check PASS. Nothing wired.

### Phase 2 — Self-filling note and Lab Kit's folder templates — BUILT 2026-10-21 (tests 2067 → 2100, lint 0 errors, 5 warnings as before, `check.py --build` ok; new `tests/note-fill.test.ts` (17), `tests/folder-templates.test.ts` (7), +2 in `tests/tidy-settings.test.ts`. Throwaway Obsidian 1.14.4, desktop and phone emulation, Templater 2.25.1 (the copy in `test-vault`, not 2.26.0): explorer New note without a Templater row filled once at 118 ms (phone 53 ms) and not again on reopening; a whole file and an empty-then-text file written by another process, and a synced-in empty file, untouched; with Templater's row and a token template the raw header arrives at 456 ms and is filled at 480 ms, one fill; with a row and a Templater-code template Templater alone fills (`year: 2026`); a front-matter-only note Templater made mixed stays untouched and is listed in Check setup; the Fix removed one of two Templater rows and saved the 2-row list as JSON; console errors []. Leftovers in BACKLOG "Templater Phase 2 leftovers")
- Depends on: Phase 1, Q6.
- Files: new `src/kit/note-fill.ts` (pure: should this note be filled? empty or raw header, in a mapped folder, open in the active editor, no Templater row for that folder), `src/kit/note-fill-ui.ts` (events), `src/kit/paths.ts` (`kit.folderTemplates`, default = today's rows), `src/kit/setup-check.ts` (row "Folder templates run by Lab Kit" with a Fix that moves Templater's rows, confirmation + JSON backup), `src/kit/tidy.ts` (rule (1) above), tests with a fake vault event stream (empty file, synced file not open, Templater row present, raw header arriving, the same note opened twice).
- Done when: tests above; obsidian-check desktop and `--mobile`: File explorer New note in To-dos is filled once, a file written by another process is not; with Templater's row still set Lab Kit does nothing; check PASS. No kit template changes format yet (so this phase changes nothing visible until a template opts in).
- **Notebook Navigator (read 2026-10-21, public README and docs on GitHub only; nothing downloaded; web fetch, not run).** Sources: README 10.6 Templates (and 10.2, 10.4) at <https://github.com/johansan/notebook-navigator>; `docs/storage-architecture.md` in the same repo. Result: **no change to the approved design.**
  - *Copy:* one folder → template list, shown as its own list in the plugin's settings (README: configured folder templates are listed under File operations & templates > Templates, each removable). That is the owner's "folders in Lab Kit's settings". The mapping lives with the plugin's other settings in `data.json`, which syncs with the vault (storage doc: `data.json` is the synced file, local storage is UI state only); the same holds for `kit.folderTemplates`. The README does not say where the folder-template mapping itself is saved: **not confirmed**.
  - *Copy:* the plugin shows its status next to Templater (storage-free: "Folder notes settings show Templater plugin status", release notes 3.1.x via newreleases.io), the idea behind Check setup's folder row.
  - *Copy, optional (not built unless the owner asks):* a folder's template also applies to its subfolders, nearest folder wins (README 10.6). Lab Kit's four rows stay exact folders.
  - *Do not copy:* Notebook Navigator fills only notes it creates itself (README 10.6: notes made by Obsidian or other plugins are not filled). Lab Kit must also fill the explorer's New note and the board's New, so it fills on `file-open` of the active note (Phase 0 items 2-3), not at its own create.
  - *Do not copy:* the README's advice to switch Templater's "Trigger on new file creation" off or exclude folders. Lab Kit never changes Templater's settings without the confirmation window (section 4); it fills a raw header whether or not Templater has a row.
  - *Do not copy:* setting a template by right-clicking a folder. The owner chose the settings list.

### Phase 3 — To-do without Templater — BUILT 2026-10-21 (tests 2150 → 2164 (+11 in `tests/note-fill.test.ts`, +1 in `tests/setup-check.test.ts`, todo-note tests reworked, 5 test files re-pointed to `tests/fixtures/templates/old/To-do.md`), lint 0 errors, 5 warnings as before, `check.py --build` ok. Throwaway Obsidian 1.14.4, desktop and phone emulation, Templater off: New to-do, selection quick capture (`Untitled to-do`, due and priority kept), day `+` (scheduled 2026-10-23) and a board-New stand-in (stub `scheduled: 2026-10-23`, `done:`, opened) each made one correct note, the stub renamed to its title, Esc removed the blank stub, an explorer empty note was filled; Templater 2.25.1 on with its row on the token To-do.md: the board-New stand-in gave one filled note (window at 451 ms, phone 453 ms), console errors []; Templater with the OLD `<%` To-do.md: Lab Kit's New to-do made the note from its own text, and Templater's board-New run reached `vtEntryTodo` and gave one note. Not measured: the real Bases New button. Leftovers in BACKLOG "Templater Phase 3 leftovers")
- Depends on: Phase 2.
- Files: `kits/planning/Extras/Templates/To-do.md` (token format), `src/planning/todo-note.ts` (reads the vault template, falls back to the bundled text only per Q7), `src/planning/commands.ts` (`newTodo`, quick capture, board `+`, board New via the self-filling path; `vtEntryTodo` kept for an old template run by Templater), `src/planning/engine.ts` (`vtTodoEngine` check), `npm run kit:manifest`, tests (the spike's cases + board New + an old `<%` To-do.md fixture kept in `tests/fixtures/templates/old/`).
- Done when: the same note byte for byte as the Templater template for the spike's cases (expected text from the old template, written out by hand as the spike did); with Templater off, New to-do, quick capture, day `+` and the board New all make the note (obsidian-check desktop + `--mobile`); with Templater on and its folder row still set, the board New still gives a filled note; check PASS.

### Phase 4 — Meetings (Meeting, One-off meeting, Meeting series, a series' own template) — BUILT 2026-10-21 (tests 2168 → 2190: +5 `tests/meeting-old-templates.test.ts` (hand-written texts checked against the old files), +11 `tests/meeting-note.test.ts` (kit file and bundled text byte for byte: weekly, every 2 weeks, extra meeting, one-off with / without project and first / not first, series hub), planning-commands tests reworked; I19 freeze tests unchanged and green; lint 0 errors, 5 warnings as before, `check.py --build` ok. Throwaway Obsidian 1.14.4, desktop and phone emulation, each with Templater off and Templater 2.25.1 on (4 runs): hub, weekly meeting, every-2-weeks meeting, extra meeting, one-off (+ its hub) all PASS byte for byte; own token template PASS; own `<%` template ran through Templater when on (`OLD 2026-11-05.md`) and fell back to the kit text when off; console errors [] in all 4. Not measured: the entry windows and buttons by clicks. Leftovers in BACKLOG "Templater Phase 4 leftovers")
- Depends on: Phase 3.
- Files: the three templates (token format), `src/planning/commands.ts` (`makeMeeting`, `makeOneOff`, `newSeries`, `seriesTemplate`), `src/planning/meetings.ts`, tests (date maths from `tp.date` cases; a series with its own `template:` in token format and one still in `<%` format, per Q7).
- Done when: byte-for-byte cases for each template (weekly, every 2 weeks, one-off, extra meeting); the I19 freeze tests still pass; check PASS; obsidian-check.

### Phase 5 — Lab Book Template, New chemical, Daily note
- Depends on: Phase 2 (not on 3-4).
- Files: `kits/lab/Templates/Lab Book Template.md` (token format; its one suggester becomes a field), `src/kit/ui.ts` (New lab entry, New chemical via `makeNote`; Clone unchanged), `src/kit/paths.ts` (`newLabEntryTarget` / `newChemicalTarget` stop refusing without Templater), `src/kit/clone.ts` test that the numbering rule still agrees, `Daily note.md` / `Chemical database template.md` through Lab Kit's folder list, tests.
- Done when: byte-for-byte lab note for a numbered entry, a clone and a chemical (class written); the lab-folder folder template works through Lab Kit with Templater off; check PASS; obsidian-check.

### Phase 6 — Project hub, New project note, New concept, New topic hub
- Depends on: Phase 3 (the hand-off pattern).
- Files: the four templates, `src/planning/commands.ts`, `src/kit/tidy-hubs.ts` (the hub body rule reads the token-format templates), tests (the 3 concept questions and 2 project-note questions through the plugin form).
- Done when: byte-for-byte cases; Tidy's hub body rule gives the same hub page from the new template as from the old (`tests/fixtures/tidy-vault-planning`); check PASS. After this phase no kit command calls `templaterCreateNote`.

### Phase 7 — Feedback page for the new block looks (no plugin code)
- Depends on: Q1, Q2 answered. Can run any time after that, in parallel with 3-6.
- Files: `my_work/mockups/` page made with `my_work/agent_kit/render_check.py feedback`: 2-3 looks each for the ```` ```raft ````, ```` ```recipe ```` and ```` ```results ```` blocks, built from the approved `solution-live-block.png` look and real numbers (0005 for RAFT); BACKLOG question with the picks.
- Done when: the owner has picked (or changed) a look per block; picks saved to `my_work/reference_visual/` with README rows.

### Phase 8 — Shared live-block core
- **BUILT 2026-10-21** (branch `claude/templater-p8-core-2ee149`): `src/blocks/core.ts` holds the parser (`parseBlock`), `setLine` / `writeInNote`, `blockRange`, quantities, `actualText` / `nextCell` / `NOT_A_MASS`, `processNote` (`vault.process`) and `holdScroll`; `src/solution/block.ts`, `edit.ts` (re-exports) and `render.ts` point at it. No solution test changed; new `tests/blocks-core.test.ts` round-trips every saved fixture note (5 notes, byte for byte); 2072 tests pass (2068 before + 4 new), lint 0 errors / 5 warnings (none in these files); obsidian-check of `acid-ph4-half.md` before and after: visible text and the `.lk-sol` crop are identical (PNG 125129 bytes, `cmp` same). Not moved (stays in `render.ts`, it is bound to the solution view): the Actual input element itself (`SolutionView.edit`).
- Depends on: N4 Phase 5 built (another agent owns `src/solution/`; coordinate, never edit it while that work runs).
- Files: new `src/blocks/core.ts` (parser, one-line writer, format version and newer refusal, Actual-cell editor, scroll hold), `src/solution/block.ts` / `render.ts` re-pointed to it, tests: every saved solution fixture (`tests/fixtures/solution/`) reads and writes byte for byte as before.
- Done when: no solution test changed except imports; check PASS; obsidian-check of the solution block unchanged (crop compared).

### Phase 9 — RAFT live block
- **BUILT 2026-10-21** (branch `claude/templater-p9-raft-17c0be`; owner picks R-C (the owner's page comment, 2026-10-21; first built as R-A, view reworked: one 3-column list, chip `N of M weighed`, no steps) + collapsed fold, Q36 a, Q23 A): `src/blocks/raft/` (`maths.ts`, `format.ts`, `text.ts`, `view.ts`, `render.ts`, `setup.ts`), the `block:` header key (alias of `run:`; `snippet-template.ts`, `snippet-copy.ts`), `03 RAFT recipe generator.md` = `block: raft` (`run: raft` also gives the block; the old calc tables are `run: raft-table`), fixtures `tests/fixtures/raft/` (`raft-0005.md` saved with `format: 1` and a hand comment, `raft-0005-fresh.md`, chemical notes), script `docs/plans/raft-known-answers.py` written before the code. Numbers: 0005 gives Mn 19990.14, CTA 0.3125 g (0.31248), water 11.259 g (11.25901) from the block's maths; from weighed 2.5012 / 0.3131 / 11.2630 g: DP 104.84, Mn 19963, solids 20.00 %; three monomers sum to 2.5 g; typing `used:` changes exactly one line (byte test); Edit set-up DP 105 → 120 changes `DP:` and the `#` lines only. Tests 2082 → 2116, lint 0 errors / 5 warnings (as before), `check.py --build` ok. Checked in a throwaway Obsidian 1.14.4 (see BACKLOG "Templater replacement Phase 9 leftovers" for the differences from the mock-up); NOT seen by the owner.
- Depends on: Phases 7 (look), 8; Q1 = live.
- Files: `src/blocks/raft/` (maths, block text, view, set-up window), `kits/lab/Templates/Snippets/03 RAFT recipe generator.md` (`block: raft`; `run: raft` stays readable), fixture `tests/fixtures/raft/` with `format: 1`, tests.
- Done when: the 0005 known answer (Mn = 19990.14) comes out of the block's maths from the same inputs; typing `used:` writes one line only; an old RAFT calc table in a note still draws unchanged; check PASS; obsidian-check light / dark / 390 px.

### Phase 10 — Recipe by equivalents live block
- Depends on: Phase 9 (same pattern).
- Files: `src/blocks/recipe/`, `02 Recipe by equivalents.md`, fixtures, tests (known answers from a saved script written before coding, as N4's Appendix).
- Done when: as Phase 9 with the recipe's known answers.

### Phase 11 — Combined results live block and methods in TypeScript
- Depends on: Phase 8; Q2, Q3.
- Files: `src/blocks/results/` (looks up the note's method tables on each draw), new `src/snippets/methods.ts` (port of `methodTable` / `methodForm` / `runMethod` and `labMethods.js` `loadMethods` / `builtins` / `planColumns` / `buildRows`), `10 Combined results.md`, tests: the method tables byte for byte against the current `labSnippets.js` output (recorded before the port, as the token-template Phase 4 did with `expected.json`); the results block picks up an nmr2 table added after insert.
- Done when: those tests; the form audit (`tests/snippet-form-audit.test.ts`) still passes for NMR / GPC / DLS / Mass spec; check PASS; obsidian-check.

### Phase 12 — Last scripts out of Alt+S
- Depends on: Phases 9-11 (and N4 Phase 5 for `solution`).
- Files: `src/kit/snippet-insert.ts` / `snippet-run.ts` (`run:` keys dispatch to TypeScript; the old volume Solution prep becomes `src/snippets/solution-volume.ts` for kept copies), `src/kit/snippet-copy-ui.ts` (Make my own copy without the bundled scripts), `src/kit/ui.ts:16-17` (imports removed), tests: every `run:` key byte for byte against the recorded output.
- Done when: `grep -c labSnippets main.js` after `npm run build` is 0; all snippet tests pass; check PASS.
- Note (2026-10-21, kit layout clean-up): the bundled scripts (`labSnippets.js`, `labMethods.js`, `labForm.js`) now live in `src/kit/bundled/`, no longer in `kits/lab/Extras/scripts/templater/`.

### Phase 13 — Lab Kit without Templater code
- Depends on: Phases 3-6 and 12.
- Files: `src/kit/obsidian-private.ts` (remove the creating / inserting / settings-writing calls; keep `withoutTemplaterTrigger`, `templaterPaths` / `setTemplaterPath` for the Tidy rule, and `templaterInsert` for own `<% %>` snippets), `setup-check.ts` / `setup-check-ui.ts` (Templater rows go; Templater moves from "needed" to an optional plugin), `managed.ts` / `managed-ui.ts` (no user-scripts role, no Set up Templater, no first-install folder offer), `paths.ts` (folders no longer follow Templater's folders unless already set: Q9), `starter.ts`, manifests (`removed`), Tidy rule (2), docs (tutorial, troubleshooting, architecture, snippet-syntax, changelog, checklist 6i), tests.
- Done when: a fresh vault with Templater never installed: Set up, every New … command, Alt+S, folder notes, board New all work (obsidian-check desktop + `--mobile`); a vault with Templater on and the user's own templates: their templates, hotkeys and folder rows are unchanged after Set up and an update (byte check of Templater's `data.json` before / after, except rows the user moved through the confirmation); check PASS.

## Tests (across phases)
- Byte-for-byte per template and per snippet against text written out from the old Templater template or recorded from the old script before it is removed (never regenerated from the new code).
- Saved old notes: `tests/fixtures/<block>/` with `format: 1` per block, kept forever; an old `<%` template fixture per ported template (`tests/fixtures/templates/old/`).
- Known answers every phase: 0005 RAFT Mn = 19990.14, 0011 reactor volume = 1.7591 mL, and N4's acid answers.
- Coexistence: Templater on / off / on with folder rows, fake event streams for the self-filling note.
- `hasNode()` false path for every new command.

## Risks
- **Double filling or a half-made note through Sync** (self-filling note): guarded by "open in the active editor on this device"; Phase 0 measures; Phase 2 tests.
- **Edited templates silently ignored** (Q7): a Check setup row lists each kit template still in `<%` form until Review update… merges it.
- **Properties view mangling `{{tokens}}`** in front matter (Phase 0 item 1; Q5).
- **Two writers in `src/solution/`** (N4 and Phase 8): Phase 8 waits for N4 Phase 5.
- **Live blocks hide values from a reader without the plugin** (targets are recomputed, not stored): mitigated by docs with formulas and Q4.
- **Long tail of wording** in docs and Check setup about Templater (est. 20+ places, from the spike): Phase 13 lists them with `grep` before editing.
- **Size:** est. 14 sessions (interpretation from the spike: about 100-150 added lines per template with tests, plus four block modules).

## Out of scope
- The calc engine (unchanged; old calc tables keep working).
- Converting blocks already in notes (Q10).
- The I2 slim to-do model (N2) and the plan-map work.
- Rig snippet and rig block (rig plan); Solution prep block (N4 plan).
- Any look: Phase 7 page first; new wording is listed per phase and asked before it ships.

## Open questions (BACKLOG "Templater replacement and live snippets"; rec. = recommended)
- **Q1 Recipe by equivalents and RAFT:** (a, rec) live blocks like Solution prep (set-up and used amounts as text, the plugin works out the rest, Edit set-up adds a reagent) / (b) stay calc tables, with an Edit set-up that rewrites the table from set-up lines kept above it / (c) stay as they are (only the code moves to TypeScript). Why (a): it is "the same treatment" you asked for and one block core serves all three.
- **Q2 Combined results:** (a, rec) a live block that looks up the method tables each time it draws (a table added later is included; nothing copied) / (b) the calc table as now plus a Refresh command / (c) as now.
- **Q3 NMR / GPC / DLS / Methods-folder tables:** (a, rec) stay calc fill-in tables (your typed results are the record, a Markdown table is the most recoverable form); only the code moves into the plugin / (b) a live ```` ```samples ```` block.
- **Q4 Closed experiments and recovery:** (a, rec) nothing extra in the note; the closed-experiment PDF prints every block's values, and the docs give each block's formulas / (b) when a note is closed, also write a plain-text table of the computed targets under each live block (changes the note at close).
- **Q5 Where the questions sit in a note template file:** (a, rec, to be confirmed by Phase 0 item 1) the header (questions, `make: note`, name, folder) between the first `---` lines as in snippets, then the note's own text with its `---` properties as plain text below / (b) the note's properties first, the questions in a ```` ```lab-template ```` block that is removed when the note is made / (c) questions in the plugin code, the file holds only the note text.
- **Q6 Folder templates and the board's New:** (a, rec) the self-filling note (filled only when open in the active editor on this device) plus Lab Kit's own folder → template list, Templater rows moved by a confirmed Fix / (b) only Lab Kit commands make notes; the board New becomes a Lab Kit button; folder templates stop / (c) keep Templater's folder templates for these four folders.
- **Q7 A kit template you edited that still holds Templater code, after its family is switched:** (a, rec) Lab Kit uses the kit's new text, and a Check setup row names your template until Review update… merges your edit / (b) refuse with a notice until merged / (c) keep running your edited template through Templater while it is installed.
- **Q8 Old scripts in the vault (`labForm.js`, `labPick.js`, `labSnippets.js`, `labMethods.js`, `vtAsk.js`, `Insert snippet.md`):** (a, rec) an opt-in Tidy rule moves them to Obsidian's trash (backup first) once nothing calls them / (b) leave them; only the manifest retires them.
- **Q9 Kit folders that follow Templater's template / script folders today:** (a, rec) keep the folders you have; new vaults use `Extras/Templates` and `Extras/scripts` without asking Templater / (b) keep following Templater's folders while it is installed.
- **Q10 Old Recipe / RAFT / Solution / Results calc tables already in your notes:** (a, rec) never converted; they keep working as calc tables / (b) also offer a "Convert to live block" per table later (opt-in, backup, BACKLOG item).

## Appendix: inventory commands (derived; re-run from the repo root)
```bash
grep -rniE 'templater|tp\.user|\btp\.' src | wc -l                       # 257
grep -rniEc 'templater|tp\.user|\btp\.' src | grep -v ':0$' | sort -t: -k2 -nr
wc -l kits/lab/Extras/scripts/templater/*.js kits/planning/Extras/scripts/templater/vault/*.js   # 890
python3 - <<'EOF'
import os, re
for root, _, fs in os.walk('kits'):
    for f in sorted(fs):
        p = os.path.join(root, f)
        if not f.endswith('.md'): continue
        s = open(p, encoding='utf-8').read().splitlines()
        tags = sum('<%' in l for l in s)
        if not tags: continue
        asks = sum(bool(re.search(r'tp\.user\.vtAsk|tp\.system\.(suggester|prompt)', l)) for l in s)
        dates = sum(bool(re.search(r'tp\.(date|file)\.', l)) for l in s)
        print(p, len(s), tags, asks, dates)
EOF
```
