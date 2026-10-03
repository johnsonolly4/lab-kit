# Status

**Version:** kit v0.3.0 (plugin Lab Kit 1.2.0 behaviour, now TypeScript in `src/`)
**Now:** duplicate-name warning **built, tested, not committed** (see Last session). Commits from `22ac9c6` on are still unpushed. `test-vault/` hand-copied kit files stay untracked on purpose.
**Next:** user's call. Candidates: the changelog popup, the next v0.4 bug (tutorial renders as Dataview errors), or fixing `npm run lint`. Commit + push when ready.
**Blockers / open questions:**
- **The updater must be pointed at `dist/`, not `kit/`**: run `npm run package`, then set Settings → Lab Kit → Update folder to the repo's `dist` folder (test vault only). Pointing it at `kit/` still fails with ENOENT (release-only files). Confirmed working from `dist/`
- `legacy/main.js` was never committed (`.gitignore` hides every `main.js`), so the v0.3 plain-JS source exists only as an ignored file on this machine. Keep a copy somewhere safe or delete it when sure; it is not in git history
- Solution prep vs Recipe by equivalents: merge or keep? (to discuss)
- Analysis methods + machines in settings: design to agree
- Sample creation workflow: to discuss
- Author is "Lab Kit contributors" (LICENSE, manifest, package.json): swap in the GitHub username before store submission if wanted
- `npm run lint` fails: eslint is not in devDependencies and has no config (store review uses `eslint-plugin-obsidianmd`)

## Last session (duplicate table names)
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
