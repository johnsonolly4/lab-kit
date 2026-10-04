# Status

**Version:** 0.4.9 (plugin + kit; moves only at `/release`; TypeScript in `src/`)
**Now:** **Chemical database + autocomplete** is built, committed and pushed on `feat/chemical-database` (PR open, changelog "Unreleased"): 180 tests pass, lint 0 errors / 2 warnings, build OK, **not seen in Obsidian** (BACKLOG, "Not yet tested"). Settings: Chemical folder, Molecular weight property; `[[` suggestions in calc cells and in the Alt+S reagent/solvent/monomer/CTA/initiator fields; Column snippet got an optional Solvent field that fills the density from its note. 0.4.9 stays the released version. Click-to-edit now works with one click and Escape works (user-confirmed 2026-10-04). **The feedback page needs a new round.**
**Next:** (first the 2026-10-04 fixes on this branch, BACKLOG "Check in Obsidian") try `docs/obsidian-test-checklist.md` section 6b (new) and sections 1-3 in Obsidian (`npm run dev`, then Review update… for the new form scripts); fixes go on the same branch. Then merge the PR and decide when to release. After that Analysis methods (BACKLOG, "Decided"). **Lab Kit is now listed in the community store**, so a release reaches users through Obsidian's own update. Also open: a feedback round (`/feedback`).
**Blockers / open questions:**
- Local `dist/` still holds old kit packages (0.3.0, 0.4.6, zips) from the removed `npm run package`; still gitignored. Safe to delete when you like
- `legacy/main.js` was never committed (`.gitignore` hides every `main.js`): the v0.3 plain-JS source exists only on this machine. User keeps a copy or deletes it
- Still to discuss: Solution prep vs Recipe (walk through a real experiment) and the sample creation workflow (BACKLOG, "Decisions needed")
- `npm run lint`: 0 errors, 2 sentence-case warnings left on purpose (BACKLOG, "Repo / release")
- Git identity: commits now use the global `~/.gitconfig` noreply address (set 2026-10-04 after a push was refused for the private email)

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
