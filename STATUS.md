# Status

**Version:** 0.5.1 (plugin + kit; moves only at `/release`; TypeScript in `src/`)
**Now:** Solution prep is rebuilt and merged into `main` ([PR 27](https://github.com/johnsonolly4/lab-kit/pull/27), 2026-10-04; 206 tests pass, lint 0 errors, build ok, nothing seen in Obsidian): targets table + component table, per-solute target (M / mg/mL / g) or total concentration split by a ratio, added in g or mL with Density, one row per solvent. Changelog v0.5.0 has it. Before it: Analysis methods are merged into `main` ([PR 26](https://github.com/johnsonolly4/lab-kit/pull/26), 2026-10-04; 206 tests pass, lint 0 errors, nothing seen in Obsidian yet): Methods folder setting, method notes + machine notes, new Alt+S **Analysis table**, per-method toggles in Sample list / Timetable, Combined results over any methods. PR 23 and PR 25 are merged too. 0.5.0 (2026-10-04) ships all of it (Chemical database, Analysis methods, Solution prep rebuild, new default folders, Dataview-era files removed): see changelog v0.5.0. The feedback page needs a new round (`/feedback`).
**Next:** the feedback page needs a new round (`/feedback`). 0.5.1 (2026-10-05) ships the 2026-10-05 work (settings groups, sorted file lists, Recipe g / M, RAFT co-solvent, live highlight, `:has` fix: see changelog v0.5.1). The user tries it in Obsidian (merged: [PR 29](https://github.com/johnsonolly4/lab-kit/pull/29); also the `:has` fix, PR 28) (checklist 6b, section 1 and 2); the user tries Solution prep (checklist 6b) and gives one real stock solution for the test (BACKLOG "Decisions needed"). The user also tries Analysis methods in Obsidian (checklist 6c, BACKLOG "Not yet tested"). Then: release (`/release`; 0.5.0 or 0.4.10: only the user decides), the "Make my own copy" snippet idea and per-snippet script files (BACKLOG), Solution prep vs Recipe and the sample workflow (BACKLOG "Decisions needed"), a feedback round (`/feedback`).
**Blockers / open questions:**
- Local `dist/` still holds old kit packages (0.3.0, 0.4.6, zips) from the removed `npm run package`; still gitignored. Safe to delete when you like
- `legacy/main.js` was never committed (`.gitignore` hides every `main.js`): the v0.3 plain-JS source exists only on this machine. User keeps a copy or deletes it
- Still to discuss: Solution prep vs Recipe (walk through a real experiment) and the sample creation workflow (BACKLOG, "Decisions needed")
- `npm run lint`: 0 errors, 2 sentence-case warnings left on purpose (BACKLOG, "Repo / release")
- Git identity: commits now use the global `~/.gitconfig` noreply address (set 2026-10-04 after a push was refused for the private email)

## Latest (2026-10-04): Solution prep rebuild
- Plan agreed with the user: two tables like RAFT; one row per solvent, several share the final volume equally; hand-calculated test now
- `labSnippets.js` `solution()`: form (solutes, solvents, final volume, target mode, unit, total concentration + unit, ratio basis + numbers, mmol / mol); tables `<id>_in` (volume, total concentration) and `<id>` (Component, MW, Target / Ratio, Unit / Mol parts, Target (g · mL), Added, In, Density, Added (g), mmol, Conc. M, Conc. mg/mL, Total). Density from the note, blank = error (`1/0`), never 1.0
- Tests: new Solution block in `tests/snippets.test.ts` (own targets, mL + density, mol, two solvents, all four ratio-basis × unit combinations); `tests/snippets-defaults.test.ts` suggest keys `solutes` + `solvents`. Docs: tutorial snippet table, changelog, checklist. Manifest regenerated
- Left over: BACKLOG (real test case, not seen in Obsidian, small leftovers)

## Earlier (2026-10-04): Analysis methods as notes
- User chose: columns as a property list, machines prefill defaults, Combined results keeps fall-through over tables of one method
- New `kit/Extras/scripts/templater/labMethods.js` (`parseMethod`, `loadMethods`, `planColumns`, `buildRows`; built-in NMR/GPC/DLS descriptors), `labForm.js` `select` field, `labSnippets.js` `methodTable` / `runMethod` / `resultsTable` (columns found by header name) replace `nmrTable` / `gpcTable` / `dlsTable`; keys `nmr` / `gpc` / `dls` unchanged, new key `method` + file `Templates/Snippets/14 Analysis table.md`
- Settings: `methodsFolder` (`src/kit/paths.ts`, `src/kit/ui.ts`). Docs: tutorial 6.1, changelog, checklist 6c, CLAUDE.md map. Manifest regenerated
- Tests: new `tests/methods.test.ts`; the three old snippet tests pass with the same assertions (only `tp.user.labMethods` added to their mocks); `tests/kit-picker.test.ts` counts 13 → 14 snippets. 199 tests, lint 0 errors, build ok
- Methods folder is created when it is missing: `src/kit/ensure-folder.ts` (used on the box's `change` event in `src/kit/ui.ts`, test `tests/ensure-folder.test.ts`). Example notes in `test-vault/Methods/` (gitignored); data.json of the dev vault not touched: type `Methods` in the setting to try it
- Alt+S lists the Methods folder's notes by itself (user chose this over a refresh button that writes files): `Insert snippet.md` asks `labMethods().menuEntries(app)` and runs `labSnippets(tp, "method:<key>")`; test in `tests/methods.test.ts` runs the real template with mocks
- Left over and unseen in Obsidian: see BACKLOG "Not yet tested" (first item)

## Latest (2026-10-04, after PR 23): Dataview-era files removed
- **Dataview-era kit files deleted** (user asked: nothing uses them): `hazards/view.js`, `lab-header/view.js`, `lab-config.json` removed from `kit/` (ids retired in the manifest; copies in a vault show as Retired and are never deleted); `lab-config.json` initials fallback removed from `labSnippets.js`; scripts-folder detection now looks for `excel_to_calc.py`. `excel_to_calc.py` stays, optional (Use toggle). Branch `feat/optional-legacy-files`, PR 25. The user also asked: scripts may live in any non-hidden folder; Templater's template folder is left as is (Set up only fills an empty one)

- **New default folders** (the user's design): a vault with no kit files uses Templater's template folder else `Templates`, and Templater's scripts folder else `scripts` (both at the vault root, no subfolders; the Templater scripts and excel_to_calc.py share the scripts folder). Existing vaults follow the files they have (`kitDetectRoles`, `src/kit/paths.ts`). Not tried on a fresh vault in Obsidian: BACKLOG

## Last session (fixes on feat/chemical-database, 2026-10-04)
- Solution prep and Recipe no longer fill reagents / solvent from the note's Chemicals (`labSnippets.js`; tests pass the reagents explicitly)
- The user's vault runs OLD scripts (pre-2026-10-03 defaults): the RAFT / NMR dataset / matrix "autofill" they saw is not in the current kit. BACKLOG has the question why the update did not replace them
- Page jump: hold now lasts while redraws keep moving the page (8 s cap), every `render()` restores it, scrollbar grab ends it (`src/calc/render.ts`; test in `tests/render.test.ts`). Cause on the user's machine not reproduced
- Indent: defensive CSS reset only (cause not seen; Obsidian's own CSS does not indent tables, so probably the user's theme)
- Templater: Insert snippet.md is added to Template hotkeys when installed / updated (`addTemplaterHotkey`, `tests/templater-hotkey.test.ts`)
- **Set up** button (Settings → Lab Kit → Built-in kit, Templater row) does the Templater settings on demand; the Built-in kit group is now first in the settings
- I did not touch the user's real vault (Obsidian showed it; no UI testing was done)

## Earlier session (Chemical database + autocomplete, 2026-10-04)
- Plan agreed with the user: folder path setting (not the Type property); suggestions in calc cells and form fields; density from the solvent note via a new optional Solvent field on the Column form
- New `src/chem/index.ts` (entries from the folder incl. subfolders, `Names` as list / one value / empty, matching, `[[Note|alias]]` link, `[[` at the cursor) and `src/chem/suggest.ts` (`AbstractInputSuggest`); `prop` / `toList` moved to `src/frontmatter.ts` (hazards uses them)
- `CalcRenderer` takes a settings getter: the configured MW property wins over the built-in names (`env().prop`); the cell editor hands Enter / Esc to the popup while it shows suggestions, and a blur while it shows waits 200 ms for the focus to come back
- `labForm.js`: `suggest: [{name, aliases}]` on text fields (item after the last comma; Enter picks first); `labSnippets.js` reads `kit.chemicalFolder` from data.json. Matching is written twice (TS and JS); a test checks both give the same answer
- Docs: tutorial (sections 3.3 and 6), README, changelog "Unreleased", checklist 6b, CLAUDE.md map. `kit/kit-manifest.json` regenerated (file hashes and per-file versions only; the plugin version did not move)

## Earlier session (merge PR 20 + remove the folder updater, 2026-10-04)
- PR 20 (Kit picker) merged and the folder updater removed ([lab-kit#20](https://github.com/johnsonolly4/lab-kit/pull/20), [#21](https://github.com/johnsonolly4/lab-kit/pull/21)); details in the 0.4.9 changelog

## Last session (2026-10-05, docs): README and tutorial brought up to date with 0.5.1
- Tutorial: Chemicals tip no longer says snippets start from the property (forms start empty since 0.5.0; suggestions come from Chemical folder), live-highlight tip in 3.2, Flow column prep solvent density, Review update ordering + Tick all. README: live highlight, solution prep targets, analysis methods bullet. Docs only; no code, version or manifest touched. Later: README rewritten with contents, quick start, per-feature sections, settings groups, commands, troubleshooting and support (the "By hand" install section removed: Lab Kit is in the store). Not checked in Obsidian: the README's example calc block and chemical-note YAML were written from the tutorial, not run

## Earlier (2026-10-05): settings groups, sort, Recipe amount, RAFT co-solvent, live highlight
- Merged as PR 29 (215 tests pass, lint 0 errors, build ok, nothing seen in Obsidian). Changelog "Unreleased" has it; PR 28 replaced the `:has` selectors in `styles.css` with a `lab-kit-wide-row` class (`src/kit/settings-box.ts`), store lint warning, not seen in Obsidian (BACKLOG "Settings boxes")
- Settings: Built-in kit = update rows; new group Kit folders and setup (`src/kit/ui.ts` `builtInGroups`). Manage files / Review update: `attentionRank` / `sortByAttention` (`src/kit/managed.ts`)
- `labSnippets.js`: Recipe first amount in mmol / g / M (Set mmol cell gets a visible formula); RAFT optional co-solvent (Targets B8). The user's RAFT workbook already matched the snippet; Init eq, NMR standard and the lab-book table were left out on purpose (BACKLOG)
- Live highlight: `src/calc/refs.ts` (`formulaRefs`), `render.ts` (`markRefs`, `entry.cells`), `styles.css` `.is-ref`; tests `tests/refs.test.ts`, `tests/render.test.ts`
- Left over: BACKLOG (not seen in Obsidian; left-out RAFT items; the sheet's average-MW bug)


