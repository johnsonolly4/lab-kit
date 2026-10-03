# Backlog

Source: Lab Kit Feedback page (v0.3 round, 2026-10-03). The user ticks items off by version.

## v0.4 bugs (do first)
- [ ] **Hazard header stutters**: the Dataview script re-runs on every vault change. Move header + hazards into the plugin (`src/header/`); re-render only when this note's Chemicals or a linked chemical note changes. Also make it more compact (proposal: one row per chemical, H-code chips).
- [ ] **Cross-table refs fail when the referenced table is the second in the note**: reproduce, add a test. Suspects: duplicate `name:`, `getSectionInfo` null on first render.
- [ ] **NMR/GPC/DLS don't pick up codes from `samples2`**: `codesFrom()` matches exact names; match `samples\d*` / `sampling\d*`.
- [ ] **Tutorial renders as Dataview errors**: inline code starting with `=` is a Dataview inline query. Write formulas without a leading `=` in inline code, or use code blocks.
- [ ] **Click-to-edit**: the cell widens while editing (keep the width fixed); moving from one cell to another takes two clicks (make it one).
- [ ] **RAFT mol fractions not summing to 1**: normalise by `SUM(fractions)`; remove the tip callout.

## v0.4 quick changes
- [ ] Section emoji: 🔬 Objectives · ⚙️ Apparatus · ⚗️ Procedure · 📈 Results / Analysis · 💡 Notes for next time
- [ ] **All paths and personal values in plugin settings** (user's rule: nothing personal in the repo): data folder root (replaces `lab-config.json` dataRoots), initials, kit update folder. Empty by default; a notice says where to set them when missing
- [ ] Data folder: created on button press only (remove creation from the template)
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
- [ ] Packaging script: assemble `dist/lab-kit-<v>/` (kit/ + built plugin + docs, as listed in kit-manifest.json) and zip it; used by `/release`
- [ ] Plugin id `lab-calc` → `lab-kit`: migrate the installed folder and data.json (updater record) without losing settings
- [ ] Port `legacy/main.js` → TypeScript in `src/` (no behaviour change; existing tests must pass)
- [ ] Split the updater from the calc/header code (Node APIs desktop-only)
- [ ] Remove private API use or isolate it (Templater settings, `app.plugins`, `app.customCss`)
- [ ] Updater: install from **GitHub releases** instead of a local folder (also works on the Mac)
- [ ] Tutorial lives in the repo (`docs/tutorial.md`) and in the README
- [ ] Community store submission checklist

## Not yet tested by the user
- Excel → calc converter (`kit/Extras/scripts/excel_to_calc.py`)
- Updater change preview
