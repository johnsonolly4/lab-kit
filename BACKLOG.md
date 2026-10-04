# Backlog

Source: Lab Kit Feedback page (v0.3 round, 2026-10-03) plus later sessions. Open items only: done items are in `docs/changelog.md` and git history (cleaned 2026-10-04).

## v0.4 checklist bugs (Obsidian test, 2026-10-03)
- [ ] CSS snippet switch (`scrolling-mermaid`) "doesn't seem to do anything" (`src/kit/obsidian-private.ts` `isCssSnippetEnabled`; the snippet only affects Mermaid blocks, so test on a note with one and check `appearance.json`)
- [ ] **Click-to-edit still takes two clicks** to move to another cell (also across two tables). **Tried in Obsidian 0.4.5: still two clicks; user abandoned it for now (2026-10-03).** The `pending` / `pendingTarget` / `openPending` code from 0.4.4 stays in (`src/calc/render.ts`; harmless, test passes) but did not fix it. Unknown which view (Reading / Live Preview): ask if it is picked up again
- [ ] Mouse-drag selection over more rows than fit the screen scrolls slower in notes made from the template than in normal notes (not reproduced; check the `cssclasses` `wide` / `scrolling_mermaid` in `kit/Templates/Lab Book Template.md:38` and the calc redraw)
- [ ] Report only: two `calc` tables both named `calc1`: the second was renamed `calc12`. Find what does the renaming (snippet script or plugin) and whether it is wanted; the "used twice" warning didn't show because of it

## v0.4 quick changes
- [ ] All chemical fields in forms empty by default: reagents, RAFT names and the matrix items are empty now; the rest is left on purpose (user's choice): NMR solvent CDCl3 / method 1H, GPC eluent THF, DLS solvent Water / 25 °C, RAFT ratio 20 / solids 20, column dead volume 0.21 (`labSnippets.js` nmr/gpc/dls/raft/column)
- [ ] Live highlight of referenced cells while a formula is being typed (investigate)
- [ ] Recipe: first-reagent amount as mass / eq / concentration (+ w/v% with a density caveat); empty by default
- [ ] Settings → Lab Kit: group everything about updating (version row, Review update, Manage files, update folder, check on start) at the top (`getSettingDefinitions`, `src/kit/ui.ts`)
- [ ] Manage kit files: sort so files that need action come first (`KitFilesModal`, `src/kit/managed-ui.ts:196`)
- [ ] Calc cell: Enter saves and starts editing the cell below (`src/calc/render.ts`)
- [ ] Copy: review where "copied as one column" is used; the user more often wants the whole table (`src/calc/render.ts`)
- [ ] Checklist wording (`docs/obsidian-test-checklist.md`, and the `test-vault/` copy): step 0 Templater item is unclear (give exact steps); step 2 says "three folder boxes" (line 20), there are four (templates, scripts, backups, snippets); step 5 needs a first line on how to bind Alt+S (Templater → Template hotkeys → `Templates/Insert snippet.md`, then Hotkeys → Alt+S). Check `docs/tutorial.md` section 2 says it too

## Decisions needed (ask the user, multiple choice)
- [ ] **Duplicate sample codes**: a second sampling timetable / sample list in the same note starts again at the default letters, giving two sets of the same names. Scan the note's tables and continue the lettering? Warn? Option in settings? (`labSnippets.js` `codesFrom` / `calcTables`)
- [ ] **Kit-created folders clutter the file tree** (Backups, kit files; clashes with Notebook Navigator). Options: backups under `.obsidian/plugins/lab-kit/` (hidden from the vault), hide via a CSS snippet, or leave. Scripts folder can't be a dot folder (Templater)
- [ ] **Autocomplete**: `[[link]]` suggestions while typing in a calc cell; form fields (reagents, solvents) that suggest notes of the right type; pull a solvent's density from its note. Belongs with "Chemical database" below
- [ ] **Choose which kit items are used** (many by default, not all useful) and show a picture + description of each in the repo / Manage files. Belongs with "Streamline vault layout"
- [ ] **Retired files: "build kit file from related"?** (the user's question, meaning unclear: create a new kit file from an existing one?)
- [ ] "Kit notes" install location (role `docs`: setup / demo notes, `kit/kit-manifest.json`): still needed, or drop it? Empty body cells at 2em tall: user "not sure", keep for now
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
- [ ] Leftover "Lab Calc" wording after the id migration (decide per item): `docs/tutorial.md` (lines 191, 239), `kit/Extras/scripts/excel_to_calc.py` (lines 6, 40, 93, 145: the plugin is now "Lab Kit"), `styles.css` header comment (line 1). Keep: changelog history lines and the old-plugin check in `kit/install-updater.ps1:48` / `.sh:69`
- [ ] `legacy/main.js` (git-ignored, never committed, old `lab-calc` classes): the user keeps a safe copy or deletes it
- [ ] `ui/sentence-case` ×4 lint warnings, **user chose to leave them** (the rule misreads proper nouns: wants 'lab kit', 'templater'): `kit/datafolder.ts:11`, `kit/ui.ts:50,96`, `whatsnew.ts:27`. Revisit if the store review bot complains
- [ ] Optional later: move simple settings rows (toggles, dropdown, plain texts) to `control` entries with `getControlValue` / `setControlValue` overrides mapping onto `kit` / `header`. Not done: `control` rows can't take the `lab-kit-wide-input` class and `data.json` keys stay nested
- [ ] `npm audit`: 0 production vulnerabilities; 8 in dev dependencies (6 moderate, 1 high, 1 critical; esbuild / vitest / eslint chain, checked 2026-10-04). Check whether `npm audit fix` (without `--force`) is safe
- [ ] `npm run lint` only lints `src`. Decide whether `tests/` and `scripts/` should be linted too (store review looks at the plugin source only)
- [ ] Add a `npm run lint` step to `/release` (`.claude/skills/release/SKILL.md` has none): must end with 0 errors
- [ ] No CI on pull requests (`npm test` / `npm run lint` / `npm run build` only run locally); optional second workflow
- [ ] Updater: install from **GitHub releases** instead of a local folder (also works on the Mac). Must be optional and described in the README "Privacy & permissions" section (it is the first network use)
- [ ] Tutorial lives in the repo (`docs/tutorial.md`) and in the README
- [ ] **Community store submission checklist** (process in `docs/reference/plugin-guidelines.md`, "Store submission"):
  - Already fine: public repo, `LICENSE` (MIT), README, unique id `lab-kit`, description has no "Obsidian" / "This plugin", `npm run lint` 0 errors, no production vulnerabilities, release workflow with attestations (`.github/workflows/release.yml`, first run 0.4.7), `versions.json` maps 0.4.6 / 0.4.7 to `1.13.0`
  - [ ] **`/release 0.4.8`, then re-scan** at community.obsidian.md: PR 17 (merged) should clear the `child_process` warning (`grep -c child_process main.js` = 0), `no-unsafe-*` and "unnecessary assertion" (checked locally without `@types/node`). "Build output does not match" depends on an identical build (`npm ci`, pinned `obsidian@1.13.1`); if it still differs, compare the released `main.js` with a fresh `npm ci && npm run build`. If the scan flags anything, paste it
  - [ ] `gh attestation verify main.js --repo johnsonolly4/lab-kit` on a downloaded release file (not run yet)
  - [ ] Workflow warnings: Node 20 deprecation for `checkout@v4` / `setup-node@v4` / attest actions, and `ubuntu-latest` becomes Ubuntu 26 on 2026-10-19 (pin `ubuntu-24.04` if the build changes). Actions are pinned by major tag, not commit SHA: pin to SHAs if the scan or a policy asks (`.github/workflows/release.yml`)
  - [ ] Windows: does the Explorer window come to the front with `shell.openPath` (`src/kit/datafolder.ts:14`)? Not tested. If not, revert the commit "Open the data folder with Electron's shell.openPath on Windows too"
  - [ ] Windows: the Dataview header's **Open data folder** button (`kit/Extras/scripts/lab-header/view.js:39-41`) also uses `shell.openPath` now. Not tested in Obsidian (same check as above). That script still reads `process.platform` and calls `require("path"/"fs"/"electron")` directly: not scanned as plugin code, but it is inside `main.js` via the embedded kit
  - [ ] **Check the `!important` removal in real Obsidian** (`styles.css:24-55`, `:85-87`; no rule needed `!important`). Selectors are the shortest that beat Obsidian 1.13.7's own table rules, not yet seen in Obsidian. In `test-vault` (reload the plugin; `npm run dev` or copy `styles.css` + `main.js`), note `kit-demo`, Reading view **and** Live Preview, dark **and** light:
    1. Calculated cells are soft blue, also in the 2nd, 4th… column (Obsidian's alternate-column rule)
    2. An amber "needs …" cell and a red error cell (type `=1/0` in a cell) keep their colour and text style
    3. Click a cell: the input fills the cell with no extra padding; Enter / Tab / Escape still behave
    4. **A1** button: grid labels are small, grey, centred, no background, including the header row's 2nd, 4th… letters
    5. Settings → Lab Kit → Kit updates: the Update folder box and other folder boxes still fill their row
    6. Hover a row of a tinted table: the tint stays (rows only change their own background)
    7. If you use a theme or snippet with striped rows or columns, repeat 1 and 4 with it on. If a tint is lost, tell me the theme: that rule would need `!important` back
  - [ ] Check the "Not yet tested" list below inside Obsidian. Ordered walkthrough: `docs/obsidian-test-checklist.md`
  - [ ] Never run on a phone or tablet: open the plugin in Obsidian mobile once to confirm it loads, calc tables render and the header shows "Data folder: desktop only" (`src/header/render.ts:62`). Mobile emulation on desktop was checked; the README "Mobile" section is written from the code
  - [ ] Optional `authorUrl` / `fundingUrl` in `manifest.json` (not added; ask first)
  - [ ] README: replace "Not in the community store yet" install section after listing; add a screenshot or two. Reword `docs/tutorial.md` section 7 ("once in the store…") too
  - [ ] Plugin name `Lab Kit` / description: check they are unique in the directory
  - [ ] Submit at https://community.obsidian.md (Obsidian account, link GitHub, add plugin), then fix whatever the automated review reports with a new release
  - [ ] Store users get `main.js` / `manifest.json` / `styles.css` only; the kit files (Templates, scripts) still need the zip or the updater. Decide how store users get the kit (README + GETTING-STARTED wording)

## Kit update system (spec: kit-update-system-spec.md, kept outside the repo)
Phases 1-5 (core) are built. Left for later:
- [ ] Phase 2 left out on purpose: **view diff** per file (needs the `diff` package), badge "retired", optional "show my other snippets" in the switch, "Open" for snippet files (`.obsidian/snippets` isn't in the vault index, so `getFileByPath` finds nothing, `managed-ui.ts` `render`)
- [ ] Per-file Update / Restore leave `installedKitVersion` alone until no `create` / `fast-forward` file remains (`KitManaged.settleVersion`, `managed-ui.ts`); check the "Update available" banner behaves in Obsidian
- [ ] Phases 3-4 left out on purpose: `pendingConflict` is still always null (status is derived from the plan each time; persist it); no Notice after an update that leaves conflicts; "Update all safe files" never merges (spec); a merged file keeps the "Merged" badge until the next kit write (`ManagedFileState.merged`, `src/kit/managed.ts`); no unchanged context lines around a hunk; the Review window only lists conflicts, resolving is from Manage kit files
- [ ] Merge window (`src/kit/merge-ui.ts`) has no automated test and was **not seen in Obsidian** (check: hunk cards at phone width, Edit textarea, preview, Apply with a script file, Keep all mine then the row shows "Changed by you"). The phone-width fix (`styles.css` ~line 77, container query on `.lab-kit-hunk`) is a best guess
- [ ] Merge edge cases to look at: a user file with no base copy (untracked / base deleted) is always `needs-merge` (`planManaged`); line-based merge of Mermaid / callout blocks in templates can join edits that read badly; merged result equal to the kit text counts as a merge, not "up to date"
- [ ] Phase 5 left out on purpose / to check: no "move" action (a renamed kit file stays where the user has it); nested YAML maps are one block per top-level key; frontmatter after a Templater block is only recognised when the line before `---` is `-%>` (`splitFrontmatter`); a retired file that was never tracked is not listed; Review window's Retired group has no Forget button (Manage kit files does); `scripts/kit-manifest.mjs` `renames` and auto-`removed` **not run** (try on a temp copy of `kit/`); Retired UI and the frontmatter merge **not seen in Obsidian**
- [ ] Built-in install does **not** yet turn on the CSS snippet or set Templater's user scripts folder (the folder updater does, via `enableCss` / `templater` in `kit/kit-manifest.json`, `src/kit/ui.ts` `KitUpdateModal.install`). Decide where that goes (a button, or part of Apply)
- [ ] Backup retention setting (keep the last N update runs) and a Restore-from-backup list (spec section 6). Backups are always made today, folder `<backups>/<ISO timestamp with - for : and .>/<path>`
- [ ] "Forget" for a missing file (`userDeleted` in `ManagedFileState` exists but nothing sets it): `missing` files are listed on every review until recreated
- [ ] Remove the folder updater (`src/kit/updater.ts` `kitPlan` / `kitApply` / `kitScan`, `KitUpdateModal`, "Kit updates" settings group) once the built-in one has been seen working in Obsidian. Until then the built-in plan treats a file whose SHA-1 still matches the folder updater's record as unmodified (`LegacyRecord`)
- [ ] No startup notice for a built-in update yet (only the settings banner "Update available" and the command "Review kit files"); the startup check still looks at the update folder
- [ ] Per-file `version` in `kit/kit-manifest.json` = kit version where the content last changed (`scripts/kit-manifest.mjs`); a file edited under an unchanged kit version gets the current version. Always run `npm run kit:manifest` after editing a kit file: `tests/managed.test.ts` fails if the manifest sha256 is stale
- [ ] `rewrite` (`Extras/scripts` -> your scripts folder) makes the written text depend on the Scripts folder setting; if the user changes that folder later, every script reads as changed by the kit (fast-forward) on the next review. Check this is acceptable
- [ ] Review window and Manage files don't show **what a kit change contains** before you keep it (user's words: "revisit how this works, i.e. if someone doesn't update for a long time"). Per-file changelog or the diff view

## Not yet tested by the user
- [ ] Settings freeze fix (`src/kit/ui.ts` `refreshSnippets`, `snippetRows`; committed in 0.4.1): placeholders in the Snippet menu show the built-in icon name; snippets added after startup still only appear after a restart; the other rows of the settings page (values persist, search finds "legend", Forget refreshes)
- [ ] Rule for later settings code: no async DOM changes inside `render` callbacks (they froze Obsidian 1.13.7); load data first, then `update()`
- [ ] Mobile header button says "Data folder: desktop only" (`src/header/render.ts:57`, `hasNode()`; test in `tests/header.test.ts`)
- [ ] **Manage kit files window inside Obsidian** (only the engine has tests, `tests/managed.test.ts` "per-file actions"): Settings → Lab Kit → Built-in kit → Manage files… and the command; badges and colours (`styles.css` `.lab-kit-badge`); Install / Update / Recreate on one file; edit a template then Restore kit original (confirm, backup lands in the Backup folder); Detach then Re-attach; Open; the CSS snippet switch really turns the snippet on and off (private `app.customCss`, `obsidian-private.ts`), and the fallback text when it can't
- [ ] Snippet menu rows are built when the settings tab is registered and refreshed once at layout ready (`tab.update()` in `KitController.setup`); snippets added or moved later (e.g. after an update) only show after Obsidian restarts. Refresh after an install, or after files change in the folder, if that bothers
- [ ] Existing vaults: `lab-config.json` initials still work as a fallback, but a vault whose notes use them will show the XX notice only if both are empty
- [ ] Excel → calc converter (`kit/Extras/scripts/excel_to_calc.py`)
- [ ] Updater change preview
- [ ] Click-to-edit inside Obsidian: width stays fixed while editing (cells narrower than 4em widen to 4em, `styles.css` `.is-editing`), typing is not wiped by the delayed redraw (`src/calc/render.ts` `refreshFile`). One-click move: see the abandoned item above
- [ ] Escape discards a typed cell edit and the text is not lost otherwise (`src/calc/render.ts` `editCell`; Tab saves was confirmed in 0.4.5)
- [ ] Sample list toggles headed "Also add (appended below)", column prep packing material, residence time callout (`labSnippets.js`; tests in `tests/snippets*.test.ts`)
- [ ] Snippet scripts (`kit/Extras/scripts/templater/labSnippets.js`) still union tables by name and know nothing about duplicate names; check what a duplicated `samples` does there
- [ ] Old "Lab notebook kit - tutorial.md" / "- changelog.md" notes stay stale in vaults that already installed them (left alone on purpose). Could add `delete` entries in `kit/kit-manifest.json` (role `docs`) if wanted
- [ ] The "seen" key for the popup is the newest changelog heading (`sectionHeading` in `src/whatsnew.ts`): new bullets added under an unchanged "Unreleased" heading do not re-trigger the popup; renaming the heading to the release version does
