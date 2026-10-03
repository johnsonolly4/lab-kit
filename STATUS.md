# Status

**Version:** kit v0.3.0 (plugin Lab Kit 1.2.0 behaviour, now TypeScript in `src/`)
**Now:** cross-table refs / `samples2` bug fixed in `labSnippets.js`, tests pass, not yet tried in Obsidian. Hazard header pushed earlier, user is checking it.
**Next:** user tries both in `test-vault/` (the kit file must be installed there: updater or copy `kit/Extras/scripts/templater/labSnippets.js`). Then the next v0.4 bug (tutorial renders as Dataview errors), or the duplicate-name warning.
**Blockers / open questions:**
- `legacy/main.js` was never committed (`.gitignore` hides every `main.js`), so the v0.3 plain-JS source exists only as an ignored file on this machine. Keep a copy somewhere safe or delete it when sure; it is not in git history
- Solution prep vs Recipe by equivalents: merge or keep? (to discuss)
- Analysis methods + machines in settings: design to agree
- Sample creation workflow: to discuss
- Author is "Lab Kit contributors" (LICENSE, manifest, package.json): swap in the GitHub username before store submission if wanted
- `npm run lint` fails: eslint is not in devDependencies and has no config (store review uses `eslint-plugin-obsidianmd`)
- Plugin id `lab-calc` → `lab-kit` migration (installed vaults still have the old folder)

## Last session
- User's actual bug: snippets pulled codes only from a table named exactly `samples`; with it deleted (`samples2`) or split (`samples` + `samples2`) nothing was found, and the results snippet only linked an exact `nmr` / `gpc` / `dls` table. Fixed in `kit/Extras/scripts/templater/labSnippets.js`: `calcTables()` / `tablesNamed()` / `codesFrom()` (union over numbered copies, `samples` also matches `sample`) and `techTables()` (results nests `XLOOKUP(..., nextTable)` across nmr, nmr2…)
- Calc engine + renderer checked first and are fine for refs to a later table (real / null section info, case, quoted names, mutual refs, whole demo note): `tests/crossref.test.ts`. Do not look there again
- New `tests/snippets-multi.test.ts` fails on the old script (4/4), passes now. `npm test`: 37 pass
- Small user-facing text change: the results form hint says "linked to the nmr, nmr2 tables" when several exist
- Duplicate-name warning (+ `#REF!` on ambiguous refs) agreed with the user but not built: separate task in BACKLOG

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
