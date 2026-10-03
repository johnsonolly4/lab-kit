# Backlog

Source: Lab Kit Feedback page (v0.3 round, 2026-10-03). The user ticks items off by version.

## v0.4 bugs (do first)
- [x] **Hazard header stutters** (done: `lab-header` block in `src/header/`, chips + table layouts via setting; untested in Obsidian yet): the Dataview script re-runs on every vault change. Move header + hazards into the plugin (`src/header/`); re-render only when this note's Chemicals or a linked chemical note changes. Also make it more compact (proposal: one row per chemical, H-code chips).
- [x] **Cross-table refs fail when the referenced table is the second in the note**: cause was in the snippets, not the engine. They looked up tables by exact name (`samples`, `nmr`), so `samples2` / `nmr2` were missed. Fixed in `labSnippets.js` (tests: `tests/snippets-multi.test.ts`). The calc engine and renderer were fine (`tests/crossref.test.ts`)
- [x] Duplicate table names: warn on both tables and make refs to the shared name `#REF!` instead of silently using the first (done: `Workbook.dupNames` in `src/calc/engine.ts`, warning in `src/calc/render.ts`, tests in `tests/duplicate-names.test.ts`; not checked inside Obsidian yet)
- [x] **NMR/GPC/DLS don't pick up codes from `samples2`**: fixed with the item above (codes now come from `samples`, `sample`, `samples2`… combined).
- [x] **Tutorial renders as Dataview errors** (done in `docs/tutorial.md` lines 92, 95-102, 157: formulas shown without the leading `=` in inline code; untested in Obsidian with Dataview on): inline code starting with `=` is a Dataview inline query.
- [x] **Click-to-edit**: cell keeps its width while editing, moving to another cell takes one click (done in `src/calc/render.ts` `editCell` / `openPending`, `styles.css` `.is-editing`; test in `tests/render.test.ts`; not seen in Obsidian yet)
- [x] **RAFT mol fractions not summing to 1**: formulas now divide by `SUM(fractions)`; tip callout removed (`kit/Extras/scripts/templater/labSnippets.js` `raft()`; test in `tests/snippets.test.ts`)

## v0.4 quick changes
- [x] Section emoji: 🔬 Objectives · ⚙️ Apparatus · ⚗️ Procedure · 📈 Results / Analysis · 💡 Notes for next time (`kit/Templates/Lab Book Template.md:43-55`)
- [x] **All paths and personal values in plugin settings** (data folder roots, kit update folder and initials are all settings now; initials: `src/kit/ui.ts` Initials box, `kit.initials` in data.json, read by `labSnippets.js:24-29`; `lab-config.json` stays as fallback for old installs and `dataRoots` for the old Dataview scripts) (user's rule: nothing personal in the repo): data folder root (replaces `lab-config.json` dataRoots), initials, kit update folder. Empty by default; a notice says where to set them when missing
- [x] Data folder: created on button press only (removed from the template)
- [ ] Snippet menu icons customisable in settings (icon colour = Obsidian accent, say so in the settings text)
- [x] Blank calc table: taller empty rows (easier to click) (`.lab-kit td.is-blank` in `styles.css`, class set in `src/calc/render.ts:175`; applies to every empty body cell, not only the blank snippet)
- [x] NMR: dataset empty by default, with a placeholder saying it can be filled in (`labSnippets.js` `nmrTable` + `nmr()`)
- [ ] Sample list: dataset is now empty (done with the NMR item); still to do: label the toggles "Also add (appended below)" (`labSnippets.js` `techToggles`)
- [ ] All chemical fields in forms empty by default: reagents, RAFT names and the matrix items are empty now; left on purpose (user's choice): NMR solvent CDCl3 / method 1H, GPC eluent THF, DLS solvent Water / 25 °C, RAFT ratio 20 / solids 20, column dead volume 0.21 (`labSnippets.js` nmr/gpc/dls/raft/column)
- [ ] Flow column prep: ask for and store the packing material
- [ ] Residence times: formula in a callout or maths block
- [ ] Live highlight of referenced cells while a formula is being typed (investigate)
- [ ] Recipe: first-reagent amount as mass / eq / concentration (+ w/v% with a density caveat); empty by default

## Decisions needed (ask the user, multiple choice)
- [ ] **Solution prep vs Recipe by equivalents**: merge into one reagent table with per-row target modes, or keep both? (User wants to discuss. Look at how ELNs do it first: eLabFTW, Chemotion, SciNote, Benchling stoichiometry tables.)
- [ ] **Solution prep details**: mmol/mol toggle (mmol default); target by mmol/mol, mass or concentration; added usually in g, sometimes mL; solvent row
- [ ] **Analysis methods in settings**: user-defined methods (NMR, GPC, DLS, …) each with columns, machines (with a default), calibrant (GPC); these drive the snippets and the combined results table
- [ ] **Combined results**: any combination of methods; more than one table per method (dropdown or tickboxes + free text)
- [ ] **Chemical database**: folder chosen in settings; forms autocomplete from it; MW property name set in settings (theirs is "Molecular weight"); default chemical note template (the user has one)
- [ ] **Faster chemical pages**: parse SDS PDFs (Python script or plugin) into chemical notes
- [ ] **Preview pane** beside the forms (toggle in settings)
- [ ] **Sample creation workflow**: to discuss
- [ ] **Streamline vault layout**: the user's files are scattered under `Extras/`; propose one kit folder

## Repo / release
- [x] Packaging script (`npm run package`): assemble `dist/lab-kit-<v>/` (kit/ + built plugin + docs, as listed in kit-manifest.json) and zip it; used by `/release`
- [x] Plugin id `lab-calc` → `lab-kit`: installers write to `lab-kit`, CSS classes renamed. Decision: start fresh, no data.json migration (delete the old folder, re-enter the Update folder)
- [x] Port `legacy/main.js` → TypeScript in `src/` (no behaviour change; existing tests must pass)
- [x] Split the updater from the calc/header code (Node APIs desktop-only)
- [x] Remove private API use or isolate it (Templater settings, `app.plugins`, `app.customCss`): isolated in `src/kit/obsidian-private.ts`, not removed
- [x] **Changelog as a popup, not a note**: `src/whatsnew.ts` (modal, latest changelog section bundled into the plugin, link to the full changelog on GitHub); shown once by the reloaded plugin after an update, plus Settings → Lab Kit → What's new and the command "Show what's new". `openAfter` and the tutorial/changelog note copies are gone from the package
- [ ] Leftover "Lab Calc" wording after the id migration (decide per item): `docs/tutorial.md` (lines 191, 234), `kit/Extras/scripts/excel_to_calc.py` (lines 6, 40, 93, 145: the plugin is now "Lab Kit"), `styles.css` header comment (line 1), changelog history lines (keep: they describe past versions)
- [ ] `legacy/main.js` (git-ignored, never committed) still has the old `lab-calc` classes; keep a safe copy or delete it
- [x] `npm run lint` runs: `eslint.config.mjs` (store plugin `eslint-plugin-obsidianmd` recommended config) + devDependencies. It reports 81 problems (34 errors, 47 warnings) in `src/`, none fixed yet
- [ ] **Fix lint findings** (`npm run lint`; group by rule, fix each group in its own commit, run `npm test` after):
  - [x] `no-base-to-string` (new `text()` helper in `calc/engine.ts`, used in `calc/render.ts`, `header/hazards.ts`; `kitVersionText` in `kit/updater.ts`)
  - [ ] `no-require-imports` ×9 errors + `no-nodejs-modules` ×8 + `no-undef` ×16 (`require`, `process`, `Buffer`): `kit/datafolder.ts:6-19`, `kit/updater.ts:36,65,72,99,112,119,176,189,190`. Desktop-only by design (`.claude/rules/obsidian-plugin.md`); probably an eslint override for `src/kit/` (node globals, `require` allowed) plus lazy loading, to agree before the store submission
  - [x] `no-unnecessary-type-assertion`
  - [x] `no-plugin-as-component` (`MarkdownRenderChild` in `calc/render.ts` `fillText`; `Component` owned by `WhatsNewModal`)
  - [x] `no-misused-promises`, `no-redundant-type-constituents`
  - [x] `no-unsupported-api` (`getAbstractFileByPath` + `instanceof TFile` in `header/hazards.ts`, so `minAppVersion` stays 1.5.0)
  - [x] `no-tfile-tfolder-cast`, `prefer-window-timers`, `no-unused-vars` (tests now give the renderer real `TFile` objects: `tests/helpers/obsidian-stub.ts`)
  - [ ] `ui/sentence-case` ×7: **changes user-facing text, ask first**: `header/settings.ts:131,136,138`, `kit/datafolder.ts:10`, `kit/ui.ts:46,92`, `whatsnew.ts:24`. Plugin name "Lab Kit" in text is flagged too
  - [ ] `no-plugin-name-in-command-name` `kit/ui.ts:200` (command text, ask first); `no-deprecated` `kit/ui.ts:174` (`setWarning`, and `display()` → `getSettingDefinitions()` is a 1.13-only API: check `minAppVersion` before adopting); `prefer-setting-definitions` `kit/ui.ts:142`
- [x] Commit the lint setup (`eslint.config.mjs`, `package.json`, `package-lock.json`): committed on `whats-new-popup`, not pushed
- [ ] `npm audit`: 8 vulnerabilities (6 moderate, 1 high, 1 critical) reported after installing eslint; not looked at. Check whether they are dev-only (esbuild, vitest, eslint chain) and whether `npm audit fix` is safe
- [ ] `eslint-plugin-obsidianmd` has peer `obsidian@1.8.7` and `@eslint/json@0.14.0` (pinned); repo uses `obsidian@latest` (1.13.1). Decide: pin `obsidian` to match the store's lint, or keep latest (affects which APIs `no-unsupported-api` and `minAppVersion` allow)
- [ ] `npm run lint` only lints `src`; `eslint.config.mjs` is the only other file covered. Decide whether `tests/` and `scripts/` should be linted too (store review looks at the plugin source only)
- [ ] `no-undef` warnings for Node globals (`require`, `process`, `Buffer`) are a config gap, not code: add a `src/kit/**` override with Node globals (see the `no-require-imports` item above)
- [ ] Re-run `npm run lint` before store submission and in `/release` (add a step to the release skill): must end with 0 errors
- [ ] Updater: install from **GitHub releases** instead of a local folder (also works on the Mac)
- [ ] Tutorial lives in the repo (`docs/tutorial.md`) and in the README
- [ ] Community store submission checklist

## Not yet tested by the user
- [ ] Lint-fix refactors not seen in Obsidian: calc tables still refresh/edit/copy, a cell with a `[[link]]` still renders (now via `MarkdownRenderChild`, `src/calc/render.ts` `fillText`), hazard header still draws (`src/header/hazards.ts` `collectHazards`), What's new popup renders (`src/whatsnew.ts`)
- [ ] Initials box in Settings → Lab Kit: set it, run Alt+S Sample list, codes use it; clear it and a notice appears with `XX` codes. `test-vault/Extras/scripts/templater/labSnippets.js` and `test-vault/Templates/` are hand copies and stale until recopied
- [ ] Empty forms inside Obsidian (placeholders show; an untouched solution / recipe / RAFT / matrix form inserts nothing), new emoji headings in a new note, taller empty cells (`styles.css` `.is-blank`)
- [ ] Existing vaults: `lab-config.json` initials still work as a fallback, but a vault whose notes use them will show the XX notice only if both are empty
- Excel → calc converter (`kit/Extras/scripts/excel_to_calc.py`)
- Updater change preview
- [ ] Click-to-edit inside Obsidian: width stays fixed while editing (cells narrower than 4em widen to 4em, `styles.css` `.is-editing`), one click moves to the next cell (also across two tables), Enter/Tab/Escape still work, typing is not wiped by the delayed redraw (`src/calc/render.ts` `refreshFile`)
- [ ] Duplicate table name warning inside Obsidian: two tables with the same `name:` show the red warning, refs give `#REF!` (`src/calc/render.ts` caption, `styles.css` `.lab-kit-warn`)
- [ ] Snippet scripts (`kit/Extras/scripts/templater/labSnippets.js`) still union tables by name and know nothing about duplicate names; check what a duplicated `samples` does there
- [ ] What's new popup not seen inside Obsidian yet: shows once after the plugin reloads with a new version, "What's new" button (`src/kit/ui.ts` settings tab), command, GitHub link, rendering (`src/whatsnew.ts`)
- [ ] Tutorial fix not seen in Obsidian with Dataview on: open `docs/tutorial.md` there and check no inline `=` errors remain (`docs/tutorial.md` lines 92, 95-102, 157). The repo copy only; vault copies of the old tutorial note stay stale
- [ ] Old "Lab notebook kit - tutorial.md" / "- changelog.md" notes stay stale in vaults that already installed them (left alone on purpose). Could add `delete` entries in `kit/kit-manifest.json` (role `docs`) if wanted
- [ ] The "seen" key for the popup is the newest changelog heading (`sectionHeading` in `src/whatsnew.ts`): new bullets added under an unchanged "Unreleased" heading do not re-trigger the popup; renaming the heading to the release version does
- [ ] RAFT fix not seen in Obsidian: run the RAFT snippet with 3 monomers and check the mol column sums right. `test-vault/Extras/scripts/templater/labSnippets.js` is a hand copy and still has the old formulas; `tests/fixtures/kit-demo.md` keeps the old one-monomer RAFT tables and tip (real-note fixture, left alone)
