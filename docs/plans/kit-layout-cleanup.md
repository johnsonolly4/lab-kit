# Plan: kit layout clean-up (CI1-CI4) and kit file audit

Status: APPROVED by the owner 2026-10-21 (chat), with Q-A … Q-E answered (`docs/decisions.md` 2026-10-21 "kit layout clean-up plan"): Q-A drop the read-only CSS row, add a "Snippets folder" row for Alt+S snippets; Q-B, Q-C (a) also `labSnippets.js`, `labMethods.js` (vault copies) and `Insert snippet.md` stop shipping in phase 1 (the two scripts move to `src/kit/bundled/`, still bundled for Alt+S); Q-D (a); Q-E (a). Branch `claude/kit-layout-cleanup` (from `overnight/2026-10-19` 2c43a0f).
Decisions this builds: `docs/decisions.md` 2026-10-21 lines "clean-install CI questions" (CI1, CI2, CI3, CI5) and "CI4: Just kit install"; Q31 A (existing vaults keep their folders); Templater compatibility (Lab Kit keeps working with Templater installed).
Measured base: clean-install check 2026-10-21 (`scripts/clean-install-structure.mjs`, branch `claude/gifted-mcclintock-823e53`): 44 files, 25 folders, 8 empty.

## Rules for every phase
- Existing vaults keep working: a folder a kit file is already in wins (`trackedRoles`, `src/kit/managed.ts:121`); only a vault with no kit files gets the new layout. No user file is moved; a removal is an opt-in Tidy rule, backup first.
- Templater stays working: Lab Kit still sets Templater's folders only through the confirmation window (CI5 is Phase 13, not here).
- Not touched (Templater Phase 3 runs there): `src/planning/commands.ts`, `src/planning/todo-note.ts`, `src/planning/engine.ts`, `kits/planning/Extras/Templates/To-do.md`. The planning kit's templates are already flat in `Extras/Templates`, so CI1 needs nothing in planning code.
- One commit per phase, `python3 scripts/check.py` PASS first, `npm run kit:manifest` after `kits/` edits. Kit file ids never change (existing installs are tracked by id).

## Phases
1. **CI2, part 1: stop shipping `labPick.js`, `labForm.js` and `Extras/attachments/`.** Both scripts out of `kits/lab/Extras/scripts/templater/` into the manifest's `removed` (existing copies stay, untracked, as for the 7 files already retired). Evidence they are not needed: `labPick.js` has 0 references in `src/` (only the `labpick` test); Alt+S's bundled run gives `tp.user.labForm` from the plugin's own form (`src/kit/snippet-insert.ts:45`), so `labForm.js` in the vault is only reached by a user's own Templater template that calls the vault copy of `labSnippets.js`. New anchor for the user scripts folder: `labSnippets.js` (then `labMethods.js`, then the old `labForm.js`) at `paths.ts:224`. `Extras/attachments` out of `planningFolders()` (`paths.ts:276`; no setting points at it). Tests `labpick.test.ts`, `labform-submit.test.ts` go with their files; descriptions in `scripts/kit-manifest.mjs:25,27`. Vault spec row `Extras/` (Vault spec.md:39) drops "attachments".
2. **CI2, part 2: opt-in Tidy rule "Old kit files nothing uses".** Pattern of the `snippet-stubs` rule (`src/kit/tidy.ts:621`): `labPick.js` always; `labForm.js` only when no note or template outside the kit's scripts calls `tp.user.labSnippets` / `tp.user.labForm`; `Extras/attachments` only when it is empty. Backup first, Obsidian's trash, listed before / after. (Q8's wider rule for the other scripts stays Phase 13.)
3. **CI1: templates and snippets in separate folders.** New lab-kit role `snippets` (manifest: the 11 `Templates/Snippets/*` files get role `snippets`, path `01 Solution prep.md` …; ids unchanged). New vault: lab templates flat in `Extras/Templates` (no `Lab Kit` level; Templater's template folder when one is set, as the planning kit does), snippets in `Extras/Snippets`. Existing vault: tracked folders win; a vault with lab kit files but no tracked snippet gets `<templates>/Snippets` (where they were). Callers that build `<templates>/Snippets` move to the new role: `src/kit/ui.ts:542`, `src/kit/tidy-ui.ts:84,141`, `src/kit/managed-ui.ts:54,721`, `src/kit/paths.ts:210,229,290`, `src/kit/snippet-insert.ts:22`. Starter's Templater folder rows lose the `Lab Kit` level (`src/kit/starter.ts:26,45`). Settings → Kit folders gets a row for it only if the owner says so (Q-A below).
4. **CI3: Rigs and Methods under `03 Lab Book/`, made at install.** `labFolders()` (`paths.ts:282`) adds the Rigs folder (default `03 Lab Book/Rigs`, already) and the Methods folder. New vaults: Methods default `03 Lab Book/Methods` (today empty; the Check setup Fix uses `Extras/methods`, `setup-check.ts:172`). Existing vaults: a saved empty Methods folder stays empty (`kitLoad`, as `labFolder` at `paths.ts:142`); the folders are made only at a kit's first install (`managed-ui.ts:331`), so nothing new appears in an existing vault.
5. **CI4: the starter holds settings, plugin list and install scripts only.** `buildStarter` (`src/kit/starter.ts:57`) and `scripts/make-starter.mjs` drop the folders and the `.gitkeep` files (and so `04 Literature`); `tests/starter.test.ts` follows.
6. **Docs + measurement.** `docs/maintenance.md` routine (tutorial folder table, architecture, vault spec, changelog Unreleased, checklist); BACKLOG ticks; the clean-install measurement re-run (script copied into `scripts/`, `!/scripts/` is already allowed) with the new counts in this file.

## Result (BUILT 2026-10-21, branch `claude/kit-layout-cleanup`; measured, NOT seen by the owner)
Measured with `node scripts/clean-install-structure.mjs all` (throwaway Obsidian, both kits installed, then every Check setup Fix; counts outside `.obsidian`; reports in the shared notes folder `clean-install-structure/after/`):

| Scenario (end state) | Files | Folders | Empty folders | Deepest level |
|---|---|---|---|---|
| empty vault, before | 44 | 25 | 8 (incl. `Extras/attachments`, `Extras/methods`) | 5 |
| empty vault, after | 39 | 22 | 7 (all note folders: Inbox, Daily, To-dos, Notes, Rigs, Methods, Chemicals) | 5 |
| starter, before | 57 | 26 | 3 | 5 |
| starter, after | 41 (39 + the 2 install scripts) | 22 (the same folders as the empty vault) | 7 | 5 |

The Templater scenarios give the same counts as their non-Templater twins, before and after. The Check setup rows left not OK at the end are the same set before and after (empty and Templater scenarios). The first run of the measurement caught a bug (a new vault's snippets went to `Extras/Templates/Snippets`, because `KitManaged.roles()` always passes a record): fixed in 882eb85, then measured again (the table above). Not measured: an existing vault being updated in real Obsidian (unit tests only: `tests/kit-picker.test.ts` "a vault installed before…"), a phone.

Expected after phases 1-5 (written before building): 2 scripts fewer, 1 empty folder fewer (attachments) and 2 made on purpose (Rigs, Methods), one level less under `Extras/Templates`, starter with 0 folders.

## Audit: every kit file (2026-10-21, this branch)
Users found with `grep` over `src/`, `kits/`, `tests/` (commands in the Appendix). "New vaults" = after this plan.

### Lab kit (`kits/lab`, 23 files)
| File | Used by (file:line) | Still needed after Templater + refpane? | Verdict |
|---|---|---|---|
| `.obsidian/snippets/scrolling-mermaid.css` | `enableCss` (manifest); vault-theme.css:8 leaves it to the lab kit | yes (Mermaid in lab notes) | keep |
| `03 Lab Book/Lab book base.base` | Home and How my vault works link it | yes | keep |
| `05 Chemicals/Chemical database.base` | optional, needs Chemical folder | yes | keep |
| `Extras/scripts/excel_to_calc.py` | README.md:76, tutorial.md:183-200; scripts-folder anchor `paths.ts:220`; not run by the plugin | yes (desktop tool, optional) | keep (optional already) |
| `Extras/scripts/templater/labForm.js` | 0 in `src/` (bundled run brings its own, `snippet-insert.ts:45`); called by the vault copy of `labSnippets.js:19` | no | **remove (CI2)**, phase 1 |
| `Extras/scripts/templater/labPick.js` | 0 in `src/`; its own test only | no | **remove (CI2)**, phase 1 |
| `Extras/scripts/templater/labSnippets.js` | Alt+S runs the BUNDLED copy (`ui.ts:20,544`); the vault copy only for a user's own Templater template | not in new vaults; bundled copy until Phase 12 | **question Q-B** |
| `Extras/scripts/templater/labMethods.js` | as above (`ui.ts:20`, `snippet-copy-ui.ts:6`) | as above | **question Q-B** |
| `Templates/Insert snippet.md` | Templater-hotkey route to Alt+S (`hotkey-check.ts:16` `also`); Check setup "lab kit installed" test (`setup-check-ui.ts:32`, `setup-check.ts:290`); templates anchor `paths.ts:222`; `starter.ts:23` | not with the Lab Kit command on Alt+S | **question Q-C** |
| `Templates/Lab Book Template.md` | New lab entry (`ui.ts:499`) | yes | keep |
| `Templates/Chemical database template.md` | New chemical (`ui.ts:550`) | yes | keep |
| `Templates/Rig template.md` | New rig (`ui.ts:573`) | yes | keep |
| `Templates/Snippets/01 … 14` (11 files) | Alt+S menu (scans the Snippets folder) | yes | keep, move per CI1 (phase 3) |
| `kit-manifest.json` `rewrite` `"Extras/scripts"` | no lab kit file contains `Extras/scripts` (grep: 0) | no | **question Q-D** |
| `kit-manifest.json` `templater.userScripts: true` | first-install "Set Templater's user scripts folder" (`managed-ui.ts:139`) | yes while any user script ships (vtAsk.js) | keep until Q-B / Phase 13 |
| `kit-manifest.json` `disableCss` `tabs-mermaid-scroll.css` | turns off the old name in old vaults | yes (old vaults) | keep |

### Planning kit (`kits/planning`, 28 files)
| File | Used by | Still needed? | Verdict |
|---|---|---|---|
| `vault-colours.css`, `vault-theme.css` | `enableCss`; the planning notes | yes | keep |
| `00 Home.md`, `Shopping list.md`, `To-do board.base`, `Weekly review.md`, `Projects overview.md`, `Knowledge index.md`, `Meetings.md`, `How-tos index.md` | homepage, board, hubs (`policy: keep`) | yes | keep |
| `Hotkeys.md`, `How my vault works.md`, `Setting up a computer.md`, `Vault spec.md` | guide notes; `tests/hotkeys-note.test.ts` | yes; the text mentions `Insert snippet.md` (Hotkeys, How my vault works) | keep; wording follows Q-C |
| 9 templates in `Extras/Templates/` | `src/planning/commands.ts:30-37` (TPL), folder templates | yes (Phases 3-6 move them to tokens) | keep (not touched: P3 running) |
| `Extras/scripts/templater/vault/vtAsk.js` | `<% tp.user.vtAsk %>` in To-do, Project hub, New project note, New concept, Lab Book Template | yes until Phases 3-6 | keep |
| `04 Literature/Literature.md` | optional, needs ZotLit; queries old names `takeaway`, `Title`, `Zotero Tags`, `key-paper` (Literature.md:9-20) | against decisions 2026-10-21 (no `takeaway`, new names only, refpane owns literature) | **question Q-E** |
| `Extras/Templates/ZotLit/*.liquid.md` (3) | optional, needs ZotLit; Check setup ZotLit template folder (`setup-check-ui.ts:159`) | no: decided to go in the ZotLit switch-over release with refpane (decisions 2026-10-21, refpane row 87) | **not here**: still on this branch (the brief said they were gone); they go with the switch-over task, which also removes `zotlit.ts` and the Check setup lines |
| `kit-manifest.json` `rewrite` `"04 Literature"` | Home, Literature.md | follows Q-E | keep |

Duplicates found: none between the two kits (no file in both; the two `templates` roles share `Extras/Templates` in a new vault after CI1 without a name clash: lab 4 names, planning 9, all different). Two things share the word "snippets": Obsidian's CSS snippets folder (Settings → Kit folders → "Snippets folder", `ui.ts:171`) and Alt+S snippets: see Q-A.

## Questions for the owner (rec. = recommended)
- **Q-A Kit folders row for the new snippets folder:** (a, rec) a row "Alt+S snippets folder" (empty = where they are; new vault `Extras/Snippets`), and the CSS row renamed "CSS snippets folder" / (b) no row, the folder only follows the files / (c) a row, the CSS row unchanged.
- **Q-B Vault copies of `labSnippets.js` and `labMethods.js`:** (a, rec) new vaults no longer get them now (Alt+S never reads them; the bundled copy runs), existing copies stay; the Phase 13 Tidy rule clears them / (b) keep installing them until Phase 12.
- **Q-C `Insert snippet.md`:** (a, rec) new vaults no longer get it now (Alt+S is the Lab Kit command; the Templater hotkey on it is for old setups); the templates anchor becomes `Lab Book Template.md`, Check setup's "lab kit installed" test reads the kit's own record; Hotkeys / How my vault works lose the mention / (b) keep it until Phase 13.
- **Q-D Dead `"Extras/scripts"` rewrite in the lab manifest:** (a, rec) remove it (no kit file contains the text) / (b) keep.
- **Q-E `Literature.md`:** (a, rec) leave it for the ZotLit switch-over release (refpane's Literature build replaces it there) / (b) remove it from the kit now / (c) port its lists to the new names now.

## Appendix: audit commands (derived; re-run from the repo root)
```bash
for n in labPick labForm labMethods labSnippets vtAsk excel_to_calc "Insert snippet" scrolling-mermaid zotlit "Extras/attachments"; do echo "== $n"; grep -rn --include='*.ts' "$n" src | cut -c1-160; done
grep -rn "Extras/scripts" kits/lab --exclude=kit-manifest.json
python3 -c "import json;[print(k,f['id'],f['role'],f['path']) for k in ['lab','planning'] for f in json.load(open(f'kits/{k}/kit-manifest.json'))['files']]"
```
