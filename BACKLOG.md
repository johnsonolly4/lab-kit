# Backlog

Source: Lab Kit Feedback page (v0.3 round, 2026-10-03). The user ticks items off by version.

## v0.4 bugs (do first)
- [x] **Hazard header stutters** (done: `lab-header` block in `src/header/`, chips + table layouts via setting; untested in Obsidian yet): the Dataview script re-runs on every vault change. Move header + hazards into the plugin (`src/header/`); re-render only when this note's Chemicals or a linked chemical note changes. Also make it more compact (proposal: one row per chemical, H-code chips).
- [x] **Cross-table refs fail when the referenced table is the second in the note**: cause was in the snippets, not the engine. They looked up tables by exact name (`samples`, `nmr`), so `samples2` / `nmr2` were missed. Fixed in `labSnippets.js` (tests: `tests/snippets-multi.test.ts`). The calc engine and renderer were fine (`tests/crossref.test.ts`)
- [x] Duplicate table names: warn on both tables and make refs to the shared name `#REF!` instead of silently using the first (done: `Workbook.dupNames` in `src/calc/engine.ts`, warning in `src/calc/render.ts`, tests in `tests/duplicate-names.test.ts`; not checked inside Obsidian yet)
- [x] **NMR/GPC/DLS don't pick up codes from `samples2`**: fixed with the item above (codes now come from `samples`, `sample`, `samples2`… combined).
- [ ] **Tutorial renders as Dataview errors**: inline code starting with `=` is a Dataview inline query. Write formulas without a leading `=` in inline code, or use code blocks.
- [ ] **Click-to-edit**: the cell widens while editing (keep the width fixed); moving from one cell to another takes two clicks (make it one).
- [ ] **RAFT mol fractions not summing to 1**: normalise by `SUM(fractions)`; remove the tip callout.

## v0.4 quick changes
- [ ] Section emoji: 🔬 Objectives · ⚙️ Apparatus · ⚗️ Procedure · 📈 Results / Analysis · 💡 Notes for next time
- [ ] **All paths and personal values in plugin settings** (data folder roots done; initials and kit update folder: initials still in `lab-config.json`) (user's rule: nothing personal in the repo): data folder root (replaces `lab-config.json` dataRoots), initials, kit update folder. Empty by default; a notice says where to set them when missing
- [x] Data folder: created on button press only (removed from the template)
- [ ] Snippet menu icons customisable in settings (icon colour = Obsidian accent, say so in the settings text)
- [ ] Blank calc table: taller empty rows (easier to click)
- [ ] NMR: dataset empty by default, with a placeholder saying it can be filled in
- [ ] Sample list: dataset empty; label the toggles "Also add (appended below)"
- [ ] All chemical fields in forms empty by default
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
- [ ] Updater: install from **GitHub releases** instead of a local folder (also works on the Mac)
- [ ] Tutorial lives in the repo (`docs/tutorial.md`) and in the README
- [ ] Community store submission checklist

## Not yet tested by the user
- Excel → calc converter (`kit/Extras/scripts/excel_to_calc.py`)
- Updater change preview
- [ ] Duplicate table name warning inside Obsidian: two tables with the same `name:` show the red warning, refs give `#REF!` (`src/calc/render.ts` caption, `styles.css` `.lab-kit-warn`)
- [ ] Snippet scripts (`kit/Extras/scripts/templater/labSnippets.js`) still union tables by name and know nothing about duplicate names; check what a duplicated `samples` does there
- [ ] What's new popup not seen inside Obsidian yet: shows once after the plugin reloads with a new version, "What's new" button (`src/kit/ui.ts` settings tab), command, GitHub link, rendering (`src/whatsnew.ts`)
- [ ] Old "Lab notebook kit - tutorial.md" / "- changelog.md" notes stay stale in vaults that already installed them (left alone on purpose). Could add `delete` entries in `kit/kit-manifest.json` (role `docs`) if wanted
- [ ] The "seen" key for the popup is the newest changelog heading (`sectionHeading` in `src/whatsnew.ts`): new bullets added under an unchanged "Unreleased" heading do not re-trigger the popup; renaming the heading to the release version does
