# Plan: Lab notes board and completed view

_**PLAN WAITING FOR OWNER.** Written 2026-10-20 (side session, `/phase-plan`, plan and mock-ups only, no plugin code). Built on the owner board 5 answers (2026-10-20). Owner answers of 2026-10-20 are in "Owner answers 2026-10-20" below (Q1, Q2, Q5, Q6 answered; Q3 answered (Exp. Class plus an in-silico class), Q7 answered (`closed_on` replaces `Exp. End`; migration risk open), Q4, Q8-Q10 open). Open questions: BACKLOG "Lab notes board and completed view" and the end of this file; looks: `my_work/mockups/lab-board-options.html` (private, made-up data). Nothing here is decided by Claude; recommendations are marked "rec."._

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
  - **RISK to resolve before building (not silent): `closed_on` is the Close mark.** `isClosed` is true when `closed_on` holds a value (`src/close/mark.ts:37-40`; used at `src/close/commands.ts:65` and `src/close/scan.ts:25`). Moving an old `Exp. End` into `closed_on` would therefore, unless the code changes:
    1. make Close experiment refuse the note ("already closed", `commands.ts:65`) although it has no hash and no PDF;
    2. drop the note from the Check / Tidy row "Lab notes marked Closed but not closed" (`scan.ts:26-27`, `src/kit/setup-check.ts:387`) when Status is Closed: the row is hidden by a date that is not a Close;
    3. make Reopen experiment offer to reopen it and then DELETE `closed_on` (`commands.ts:120`), i.e. lose the end date;
    4. `closed_hash` / `closed_pdf` are empty: "edited after closing" needs a stored hash (`scan.ts:30`, so no false row); "without a PDF" needs `closed_pdf: pending` (`scan.ts:28`, so no false row). These two are safe.
    Also: Reopen deletes `closed_on` even for a real Close, so a reopened-then-running note has no end date (correct) but a note that ended and was never formally closed keeps it only if nothing reopens it.
  - **Safest migration proposed (question in BACKLOG, owner to pick):** fill `closed_on` ONLY, and change the meaning of "closed": a note is formally closed when `closed_on` AND (`closed_hash` or `closed_pdf`) are present; `closed_on` alone means "ended, not formally closed" and gets no row, Close experiment still works on it (it sets hash and PDF and keeps the date, unless the owner wants today's date), Reopen on it only clears Status. The Check row "marked Closed but not closed" then still fires for a Status Closed note without hash or PDF (the owner may want that: they are not closed formally). Tests: `tests/close-*.test.ts` (find by name) get a case for each of the four points.
  - Ended column and the board: `closed_on` (all formally closed and merely ended notes); the 30-day clock (Q5) also uses `closed_on`.
- **Q8 new saved filters: not answered.** Explained in chat: A Lab Kit ships ready-made named views and you add your own with Obsidian's Bases toolbar (rec.) / B a Lab Kit `Save as view…` button that writes your chips into the `.base`.
- **Q9 where the completed view lives: not answered.** Explanation asked: A a new file `Completed experiments.base` (rec.; arrives by Review update… without touching an edited `Lab book base.base`) / B more views in `Lab book base.base`. Phase 1 assumes A until answered.
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

### Phase 1 — Completed experiments base (Bases only)
- Depends on: Phase 0, Q8, Q9.
- Files: `kits/lab/03 Lab Book/Completed experiments.base` (new), `kits/lab/kit-manifest.json` (`npm run kit:manifest`), `.gitignore` not needed (inside `kits/`), `tests/lab-bases.test.ts` (new: parses the `.base` YAML; filters, views, sort, folder string follows `patchFolders`).
- Built-in `table` views `All completed`, `This year` (and `Failed runs` after Phase 2); formula `ended`; columns per the owner's pick.
- Done when: tests; obsidian-check on 40 made-up lab notes: row counts per view match the seed; Review update… lists the new file in a vault with the kit installed.

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
- Obsidian re-saves `.base` files on toolbar use, so most vaults count as "edited" and keep the old `Lab book base.base`: the new views reach them only through Compare / merge. Mitigation: the completed view is a new file (Q9 A).
- The own view type is unknown with the plugin off: every `.base` keeps a built-in fallback view.
- Body search on hundreds of notes on a phone may be slow: the body part runs only on Enter / the toggle.
- Old notes keep a hand-typed `Exp. End` until Tidy moves it; `closed_on` is empty on running and never-closed notes, so Ended is blank there. The migration risk in Q7 (the Close mark) is open.
- Bases is undocumented in places (toolbar search, duplicate view); anything not measured in Phase 0 is not promised in UI text.

## Open questions (multiple choice, rec. first; BACKLOG "Lab notes board and completed view")
1. **By project**: A (rec.) a new `Project` link to the project hub, asked in New lab entry, empty on old notes, optional Tidy rule filling it from to-dos' `experiment` links · B no property, derived from to-dos' `experiment` links (planning kit only, linked notes only, own view only) · C drop by project.
2. **By outcome or result**: A (rec.) a new `Result` property, values `Worked` / `Partly` / `Failed` / `Unclear`, asked as a chip row in the Close experiment window; Outcome stays free text · B search Outcome text only · C a convention: Outcome starts with the result word.
3. **"Type" in the summary split**: A (rec.) Exp. Class · B the `Type` property (empty in the template today) · C both.
4. **Which parts get Lab Kit's own look**: A (rec.) the completed table now; summary board and running board after the table's look is approved · B all three in this plan (adds Phase 6) · C built-in Bases views only, styled with CSS.
5. **The 30-day clock for Closed cards**: A (rec.) 30 days from `closed_on` (from the last edit when there is none) · B from the last edit, as now (an edit brings a card back).
6. **Chemical "Used in" list in chemical notes**: A (rec.) yes, an embedded base in the Chemical database template + an Alt+S snippet for old chemical notes · B no, the completed table's Chemicals filter is enough.
7. **Ended**: ANSWERED, `closed_on` replaces `Exp. End`. Open follow-up: how old notes migrate without breaking the Close mark, see Q7 and BACKLOG.
8. **Making a new saved filter**: A (rec.) Lab Kit ships named views; your own come from Bases' toolbar (new / duplicate view) and the own view remembers its chips per view · B a `Save as view…` button that writes a new view into the `.base` file.
9. **Where the completed view lives**: A (rec.) a new `Completed experiments.base` next to the Lab book base · B more views inside `Lab book base.base`.
10. **The look** (mock-up page, section 4): A rows in a card (rec.) · B compact lines · C row cards; and the summary tiles and running cards as drawn, or comments on the page.
