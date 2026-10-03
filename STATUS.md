# Status

**Version:** kit v0.3.0 (plugin Lab Kit 1.2.0 behaviour, now TypeScript in `src/`)
**Now:** PRs 1, 2 and 3 are merged into `main` ([lab-kit#3](https://github.com/johnsonolly4/lab-kit/pull/3) = settings definitions API + lint decisions). None of it is seen inside Obsidian yet (BACKLOG, Not yet tested). `test-vault/` hand-copied kit files stay untracked on purpose.
**Next:** merge [lab-kit#4](https://github.com/johnsonolly4/lab-kit/pull/4) (`174ea6f`, toggle label) into `main`; then v0.4 items (snippet icons, other open quick changes in BACKLOG); check the merged features and the new settings page in Obsidian 1.13+ (BACKLOG, Not yet tested).
**Blockers / open questions:**
- **The updater must be pointed at `dist/`, not `kit/`**: run `npm run package`, then set Settings → Lab Kit → Update folder to the repo's `dist` folder (test vault only). Pointing it at `kit/` still fails with ENOENT (release-only files). Confirmed working from `dist/`
- `legacy/main.js` was never committed (`.gitignore` hides every `main.js`), so the v0.3 plain-JS source exists only as an ignored file on this machine. Keep a copy somewhere safe or delete it when sure; it is not in git history
- Solution prep vs Recipe by equivalents: merge or keep? (to discuss)
- Analysis methods + machines in settings: design to agree
- Sample creation workflow: to discuss
- Author is "Lab Kit contributors" (LICENSE, manifest, package.json): swap in the GitHub username before store submission if wanted
- `npm run lint`: 0 errors, 4 warnings (sentence case, left on purpose): BACKLOG.md (Repo / release)

## Last session (open PR 4)
- Opened [lab-kit#4](https://github.com/johnsonolly4/lab-kit/pull/4) (`whats-new-popup` into `main`, only `174ea6f`). Not merged. No code changes, tests not rerun. `test-vault/` hand copies left untracked on purpose

## Earlier session (commit + push toggle label)
- Committed `174ea6f` (toggle label, its test, changelog, STATUS/BACKLOG) and pushed to `whats-new-popup`. PR 3 was already merged, so this commit is **not in `main` yet** (needs a new PR or merge). `test-vault/` hand copies left untracked on purpose. No code changes, tests not rerun

## Earlier session (sample-list toggle label)
- Toggle heading in `kit/Extras/scripts/templater/labSnippets.js:152` (`techToggles`) is now "Also add (appended below)"; it shows in the sample list and timetable forms. New test in `tests/snippets-defaults.test.ts`; changelog line added; `kit-manifest.json` unchanged on regeneration
- `npm test`: 60 pass. Not committed. Not seen in Obsidian, `test-vault/` copy of the script is stale (BACKLOG, v0.4 quick changes)

## Earlier session (merge PR 3)
- Merged PR 3 into `main` (plain merge commit, branch not deleted). No code changes, tests not rerun. Local `main` not pulled; local branch is still `whats-new-popup`

## Earlier session (push + PR 3)
- Pushed `whats-new-popup` (`4e48915`, `56a6646`) and opened PR 3 against `main`. No code changes, tests not rerun. Local `main` still not pulled

## Earlier session (commit settings API + lint decisions)
- Committed `4e48915` on `whats-new-popup` (settings definitions API, lint decisions, `minAppVersion` 1.13.0, reference doc). Not pushed. `test-vault/` hand copies left untracked on purpose. `npm test`: 59 pass; `npm run lint`: 0 errors, 4 warnings. No code changes

## Earlier session (settings definitions API)
- Settings page now uses `getSettingDefinitions()`: `KitSettingTab` (`src/kit/ui.ts`) + `HeaderStore.definitions()` (`src/header/settings.ts`), all rows as `render` callbacks (same saves as before), groups for the headings. `setWarning` → `setDestructive`, refresh via `this.update()`. `manifest.json` `minAppVersion` 1.5.0 → 1.13.0 (`versions.json` gets `0.4.0: 1.13.0` at release)
- Two small look changes (user to confirm): the hazards "per-note options" sentence is its own row "Per-note options"; "Install locations" shows a "Show" summary under its name
- API facts saved in `docs/reference/settings-definitions.md` (typings from `node_modules/obsidian` were readable only when the user pasted them; `render` must return void; groups hold rows, not groups)
- `npm run build` clean; `npm test`: 59 pass; `npm run lint`: 0 errors, 4 warnings. Not committed. Not seen in Obsidian. Possible later cleanup (`control` rows) in BACKLOG

## Earlier session (lint decisions)
- Decisions: Node modules → eslint override; sentence case → leave as warnings; command renamed; settings definitions API → next session
- `eslint.config.mjs`: `src/kit/**` override (Node globals, `no-require-imports` and `no-nodejs-modules` off). Command "Check for lab kit updates" → "Check for updates" (`src/kit/ui.ts:200`, `docs/tutorial.md:212`, changelog line under Unreleased)
- Lint: 44 → 10 (0 errors). `npm test`: 59 pass; `npm run build` clean. Not committed. Not seen in Obsidian. `test-vault/` tutorial copy still has the old command name (hand copy, left alone)

## Earlier session (merge PRs)
- Merged PR 1 into `main`, retargeted PR 2 to `main`, merged it (both plain merge commits, branches not deleted). No code changes, tests not rerun. Local `main` not pulled; local branch is still `whats-new-popup`

## Earlier session (commit + push lint fixes)
- Committed the lint fixes below (15 tracked files, incl. STATUS/BACKLOG) on `whats-new-popup` and pushed, so PR 2 includes them. `test-vault/` hand copies left untracked on purpose. No code changes, tests not rerun

## Earlier session (lint fixes)
- Fixed the behaviour-neutral lint groups: 81 → 44 problems. `text()` helper (`src/calc/engine.ts`) for `no-base-to-string`; `instanceof TFile` instead of casts; `window.setTimeout`; `MarkdownRenderChild` / own `Component` for `MarkdownRenderer`; unused catch variables, redundant assertions, async click handler
- `hazards.ts` uses `getAbstractFileByPath` + `instanceof TFile` (was `getFileByPath`), so `minAppVersion` stays 1.5.0. `WhatsNewModal` constructor lost its `plugin` argument
- Tests: stub got `TFile(init)`, `MarkdownRenderChild`, `Component.load/unload`, `window`; mocks now return real `TFile`s. `npm test`: 59 pass; `npm run build` clean. Not committed. Not seen in Obsidian (the changed code: calc refresh/render/copy, hazard header, What's new popup)
- Left on purpose: user-facing text (sentence case ×7, command name), Node modules / `require` in `src/kit/`, deprecated `setWarning` / `display()`, settings definitions

## Earlier session (push lint commit)
- Pushed `a502df9` (eslint setup) to `whats-new-popup`, so PR 2 includes it. No code changes, tests not rerun

## Earlier session (commit lint setup)
- Committed `eslint.config.mjs`, `package.json`, `package-lock.json`, STATUS and BACKLOG on `whats-new-popup`. Not pushed. No code changes, tests not rerun

## Earlier session (lint setup)
- Added devDependencies `eslint@9`, `eslint-plugin-obsidianmd`, `@eslint/js`, `@eslint/json`, `typescript-eslint`, and `eslint.config.mjs` (store plugin's `recommended` config, type-checked via `projectService`). `npm run lint` now runs on `src/`
- Result: 81 problems (34 errors, 47 warnings). **Nothing fixed on purpose**: several change user-facing text (sentence case, command name) or need a decision (Node APIs in `src/kit/`, `minAppVersion`). Grouped list with file:line pointers is in BACKLOG.md
- `npm test`: 59 pass; `npm run build` clean. Not committed
- Note: `npm install` warns of 8 vulnerabilities (dev dependencies, not checked) and the plugin's peer `obsidian@1.8.7` while the repo uses `obsidian@latest` (1.13.1); lint still works

## Earlier session (commit + push v0.4 batch)
- Committed the batch below (tracked changes + `tests/snippets-defaults.test.ts`) and pushed to `whats-new-popup`. `test-vault/` hand copies left untracked on purpose. `npm test`: 59 pass. No code changes

## Earlier session (quick changes batch 1 + initials)
- New emoji in the template headings; `is-blank` class + `.lab-kit td.is-blank { height: 2em }` for empty body cells (all tables)
- Forms: reagents, RAFT names, matrix items and the NMR dataset start empty with placeholders (`labSnippets.js`). Solvents, eluent, ratios, dead volume left as they were (user's choice)
- Initials: `kit.initials` (`KitData`, `src/kit/updater.ts`), Settings → Lab Kit → Initials (`src/kit/ui.ts`). `labSnippets.js` reads `.obsidian/plugins/lab-kit/data.json`, falls back to `lab-config.json`, then `XX` with a notice (samples / timetable / matrix only)
- Tests: new `tests/snippets-defaults.test.ts` (5), render test for `is-blank`, matrix test now passes its items. `npm test`: 59 pass; `npm run build` clean; `kit-manifest.json` unchanged on regeneration. Changelog + tutorial line updated
- Not seen in Obsidian, test-vault copies stale, leftover items (sample-list toggle label, other defaults): all in BACKLOG.md

## Earlier session (commit RAFT fix)
- Committed and pushed the RAFT fix below, plus STATUS/BACKLOG/changelog. `npm test`: 53 pass. No code changes

## Earlier session (RAFT mol fractions)
- `raft()` in `kit/Extras/scripts/templater/labSnippets.js`: monomer mol = total mol × fraction / `SUM(fractions)`; "Total monomer (mol)" and "Theoretical Mn" use the fraction-weighted mean MW divided by `SUM(fractions)`. Tip callout removed
- Test: 3-monomer case in `tests/snippets.test.ts` (monomer masses sum to 2.5 g, Mn exact; old script fails it). `npm test`: 53 pass; 0005 Mn 19990.14 still holds; `npm run build` clean. Changelog line added; `kit-manifest.json` unchanged on regeneration
- Not seen in Obsidian, test-vault copy of the script is stale: both in BACKLOG (Not yet tested)

## Earlier session (commit click-to-edit)
- Committed and pushed the click-to-edit fix below to `whats-new-popup` (PR 2). `npm test`: 53 pass. No code changes

## Earlier session (click-to-edit)
- Cell width: `editCell` sets `--lab-kit-cell-w` (the cell's width before editing) via `setCssProps`; `styles.css` `.is-editing` fixes the cell to it (floor 4em), input has `min-width: 0`
- One click: pressing another cell while editing now records it (`pending`); the blur saves/redraws, then `openPending()` opens it. `writeCell` returns the new note text and the save redraws at once (`refreshFile(path, text)`); the delayed modify redraw skips a table being edited
- Test: new case in `tests/render.test.ts`; `tests/helpers/minidom.cjs` got `setCssProps`, `offsetWidth`, event extras. `npm test`: 53 pass; `npm run build` clean
- Not seen in Obsidian: BACKLOG (Not yet tested). Changelog line added

## Earlier session (commit tutorial fix)
- Committed and pushed the tutorial fix below, plus STATUS/BACKLOG. No code changes, tests not rerun

## Earlier session (tutorial Dataview errors)
- `docs/tutorial.md` (lines 92, 95-102, 157): inline code no longer starts with `=` (Dataview treats it as an inline query). Section 3.3 says formulas start with an equals sign and that the examples leave it off. Docs only, no code or tests touched
- Not seen in Obsidian with Dataview on: BACKLOG (Not yet tested). Changelog not changed (docs-only)

## Earlier session (push + PR)
- Pushed `whats-new-popup` and opened PR 2 against `duplicate-table-names` (so the diff shows only the popup). No code changes, tests not rerun

## Earlier session (What's new popup)
- New `src/whatsnew.ts`: `latestSection()` (newest `## ` section of `docs/changelog.md`), `sectionHeading()`, `WhatsNewModal` (renders the section, link to the full changelog on GitHub). Changelog is bundled into `main.js` (`loader: { ".md": "text" }` in `esbuild.config.mjs`, `src/md.d.ts`)
- `src/kit/ui.ts`: shown once on the first start after the heading changes (`kit.seenChangelog` in data.json, new `KitData` field), command "Show what's new", "What's new" button in Settings → Lab Kit. The *reloaded* plugin shows it, because the running one still has the old changelog
- `openAfter` removed (`updater.ts`, `ui.ts`, `package-kit.mjs`, `kit-manifest.json`); the tutorial and changelog note copies are no longer packaged or installed (`kit-manifest.mjs`, manifest regenerated, 26 files). Existing copies in vaults are left alone
- Tests: new `tests/whatsnew.test.ts` (3); `package-kit` and `updater` tests adjusted. `npm test`: 52 pass; `npm run build` and `npm run package` clean, zip has no `Lab notebook kit - *.md`
- Changelog line reworded (under Unreleased). Open points are in BACKLOG.md (Not yet tested)

## Earlier session (duplicate table names)
- Two `calc` tables with the same `name:` now both show a red "⚠ name used twice" in the caption; name-qualified refs to that name give `#REF!` ("table name "x" is used by more than one table"). Own unqualified refs still work
- `src/calc/engine.ts`: `Workbook.dupNames`, `isDuplicate()`, `badTable()`; `blockIndex` returns -1 for duplicates. `src/calc/render.ts`: no longer drops same-named blocks from the workbook (old filter hid duplicates); with `getSectionInfo` null only the first block equal to this one's source is dropped. `styles.css`: `.lab-kit-warn`
- Side effect: XLOOKUP now returns an error in its lookup range (was a silent `#N/A`), so a missing / duplicate table there shows `#REF!`
- Tests in a new file `tests/duplicate-names.test.ts` (not `crossref.test.ts` as planned; that file has CRLF endings and was awkward to append to) plus 4 in `tests/engine.test.ts`. `npm test`: 50 pass; `npm run build` clean. Known answers hold
- Not verified inside Obsidian; snippet scripts untouched: both in BACKLOG.md (Not yet tested). Changelog line added under Unreleased

## Earlier session (commit only)
- Committed the id migration and the CLAUDE.md change as two commits. No code changes, tests not rerun. Nothing pushed

## Earlier session (id migration)
- User chose **start fresh**: no `data.json` copy (it lives inside the plugin folder, so the old folder's settings and updater record are not carried over; delete the old folder, re-enter the Update folder) and **rename CSS classes**
- `install-updater.ps1` / `.sh` now install into `.obsidian/plugins/lab-kit` (`.sh` backup path too); final instructions say turn on Lab Kit, and if a `lab-calc` folder exists they tell the user to turn Lab Calc off and delete it (scripts never delete)
- `lab-calc*` CSS classes → `lab-kit*` in `styles.css`, `src/calc/render.ts`, `tests/render.test.ts`; `tests/updater.test.ts` uses `.obsidian/plugins/lab-kit`; updater label "Lab Calc plugin" → "Lab Kit plugin" (`src/kit/ui.ts`)
- Changelog line under Unreleased; BACKLOG item ticked. `kit-manifest.json` unchanged on regeneration
- `npm test`: 43 pass; `npm run package` clean; `bash -n` on the installer OK. **Not run:** the installers against a throwaway vault (command was denied). Custom user CSS snippets targeting `.lab-calc` would stop matching (user accepted)
- Left alone on purpose (now in BACKLOG.md, Repo / release): "Lab Calc" wording in `docs/tutorial.md`, `excel_to_calc.py`, `styles.css` header comment, and the ignored `legacy/main.js`

## Earlier session (packaging script, verified)
- User ran Review + Update from `dist/` in the test vault: worked. No code changes this session (only `npm run package` rerun: clean)
- New BACKLOG item: show the changelog as a temporary popup (modal), also reachable from the settings page, instead of opening a whole note after update

## Earlier session (packaging script)
- New `scripts/package-kit.mjs` (`npm run package` = build, then package): checks `manifest.json` and `kit-manifest.json` versions match, copies `kit/` + built plugin (`.obsidian/plugins/lab-kit/`) + docs (as "Lab notebook kit - tutorial/changelog.md") into `dist/lab-kit-<v>/`, fails if the manifest lists a missing file or `openAfter` isn't shipped, then zips to `dist/lab-kit-<v>.zip` (`fflate` dev-dependency, zip keeps `lab-kit-<v>/` as top folder, so unzipping into the update folder gives one kit version folder)
- Plugin folder in the package is `lab-kit` (was `lab-calc`): `scripts/kit-manifest.mjs` and `kit/kit-manifest.json` regenerated
- `openAfter` was a note that exists nowhere ("update to v0.3.md"); now opens the changelog, which links to the tutorial on GitHub (new first line under Unreleased in `docs/changelog.md`)
- `tests/updater.test.ts` now builds its kit with `buildKitFolder`; new `tests/package-kit.test.ts` (6). `npm test`: 43 pass. `npm run package` output checked: 31 files in the zip
- Release skill step 9 runs `npm run package`; BACKLOG item ticked

## Earlier session (numbered tables)
- User's actual bug: snippets pulled codes only from a table named exactly `samples`; with it deleted (`samples2`) or split (`samples` + `samples2`) nothing was found, and the results snippet only linked an exact `nmr` / `gpc` / `dls` table. Fixed in `kit/Extras/scripts/templater/labSnippets.js`: `calcTables()` / `tablesNamed()` / `codesFrom()` (union over numbered copies, `samples` also matches `sample`) and `techTables()` (results nests `XLOOKUP(..., nextTable)` across nmr, nmr2…)
- Calc engine + renderer checked first and are fine for refs to a later table (real / null section info, case, quoted names, mutual refs, whole demo note): `tests/crossref.test.ts`. Do not look there again
- New `tests/snippets-multi.test.ts` fails on the old script (4/4), passes now. `npm test`: 37 pass
- Small user-facing text change: the results form hint says "linked to the nmr, nmr2 tables" when several exist
- Duplicate-name warning (+ `#REF!` on ambiguous refs) agreed with the user but not built: separate task in BACKLOG
- Updater error found when the user tried to install (see blockers). Copied `kit/Templates`, `kit/Extras`, the CSS snippet into `test-vault/` instead; user still sets Templater's template folder (`Templates`) and user script folder (`Extras/scripts/templater`), enables the `scrolling-mermaid` snippet and reloads Lab Kit
- Working-tree `CLAUDE.md` had been overwritten with the old v0.3 text (undid commits `7bc8337`, `bb33f69`); restored with `git checkout`. Cause unknown

## Earlier session (hazard header)
- Hazard header + data-folder button ported from the Dataview scripts to the plugin: `src/header/` (`ghs.ts`, `hazards.ts`, `render.ts`, `settings.ts`), `src/kit/datafolder.ts` (Node/Electron, desktop only), CSS in `styles.css`
- Block is ```` ```lab-header ````; command "Insert lab header block". Redraws only if the note's Chemicals / a linked chemical's `H_Phrase` changed (signature check), so no more stutter
- Settings → Lab Kit → "Lab header" (data folder roots for Windows and macOS/Linux, empty by default) and "Hazards" (layout chips/table plus every option of the old Dataview script: collapsed, startOpen, summary counts, legend, details, sort, highlight, category labels, shade/centre, show missing, property names, hidden classes). Each can be overridden per note with `key: value` lines inside the block; `dataFolder: false` / `hazards: false` drop the button / the hazards
- Template uses the block and no longer creates the data folder; tutorial + changelog (Unreleased v0.4) updated; `tests/header.test.ts` (+ `tests/fixtures/hazard-chemicals.json`) added; updater test adjusted (template has no script paths now)
- Old Dataview scripts (`kit/Extras/scripts/hazards`, `lab-header`) kept for existing notes: decide at release whether to delete. `lab-config.json` still holds initials
- Found by the user's first look: `npm run dev` copied `styles.css` into the test vault only once at start, so CSS added later never arrived (no colours, legend run together). `esbuild.config.mjs` now re-copies `styles.css`/`manifest.json` when they change; **reload the plugin in Obsidian** (or restart dev) to pick up new CSS
- Checked the real renderer + `styles.css` in the browser pane (chips and table layouts): colours, shading, legend spacing OK. Still not checked inside Obsidian itself
- `npm test`: 27 pass; `npm run build` clean

## Previous session
- Ported `legacy/main.js` to `src/` (`calc/engine.ts`, `rewrite.ts`, `render.ts`; `kit/updater.ts`, `ui.ts`, `obsidian-private.ts`; `main.ts` = `LabKitPlugin`). Checked by the user in the test vault; pushed
- Removed `legacy/manifest.json`, `legacy/styles.css`, `tests/legacy/`, the differential test and the `test:legacy` script; updated README and CLAUDE.md to match
- `npm test`: 15 pass (engine, compat, snippets, render, updater). Known answers hold (0005 Mn 19990.14, 0011 1.7591 mL). `npm run build` clean
- Only visible-code change in the port: 3 inline styles in the updater became CSS classes in `styles.css` (same look)
- Learned: the earlier claim that `legacy/main.js` was tracked was wrong; see blockers
