# Plan: Kit .base filters follow folder renames

_Agreed: 2026-10-09. Written by `/phase-plan`. Each phase = one session._

## Goal
After a planning, lab or chemical folder is renamed or changed in settings, the kit's `.base` boards (To-do board, Lab book, Chemical database) still show their notes, and the user is told about any board that could not be fixed.

## Decision taken
- Cause is NOT yet known. BACKLOG "Merge / folder renames leave the kit's .base filters on the old folder" (Pre-release test 2026-10-09, checklist 1): after renaming the planning folder the To-do board showed nothing. Read of the code (2026-10-09): `planFolderReapply` (`src/kit/managed.ts:176-187`) does rewrite unedited `.base` files (policy `keep` is not skipped there), and the test vault records all three bases as installed at the current version (0.5.2), so the "other kit version" skip does not explain it. The vault was back at default folders, so the failing state could not be inspected.
- So Phase 1 reproduces first (user, 2026-10-09: "Reproduce with tests first").
- Edited `.base` (or one with no saved original): report it, with an option to patch only the folder string in the filter line, backup first (user, 2026-10-09). Built in Phase 2.
- Rejected: patching silently; a per-file window for every case.

## Out of scope
- Before / after view for Update / Merge / Restore (BACKLOG "Update shows no before / after view"; own plan).
- "Check setup should list each kit template" (own item).
- Renaming back giving "Destination file already exists" (note in the BACKLOG item; look at it only if Phase 1 shows the template makes the new folder).

## Phases

### Phase 1 — Reproduce with tests
- Files: new `tests/base-folders.test.ts` (fixtures from `kits/`), maybe a small export from `src/kit/ui.ts:304-327` so the rename path can be called without Obsidian.
- Cases, for each of the three bases (planning `To-do board.base:3`, lab `Lab book base.base:3`, `Chemical database.base:3`): folder setting changed (`foldersChanged` / `reapplyFolders`); vault rename of the parent folder (`followRename` + `followFolderRename` + reapply, base lives inside the renamed folder); unedited, edited with and without a saved original, installed at an older version, and with the lab kit alone.
- Done when: the failing case is named in `docs/plans` ("Phase 1 result") and BACKLOG; or all pass, then ask the user for exact Obsidian steps. No fix in this phase unless it is a one-line change in the same file set.
- New dependencies: none

#### Phase 1 result (2026-10-09, `tests/base-folders.test.ts`, 19 tests, tests only, not seen in Obsidian)
- Works: all three bases, unedited and at the current version, are rewritten after a folder setting change and after a vault rename of the planning folder, the lab Notes folder, the Lab Book parent folder, the Chemicals folder and the Chemicals parent folder. Edited bases (with or without a saved original) are put in `kept`.
- Gap 1 (named failing case): a base whose recorded `installedVersion` differs from the kit's is skipped by `planFolderReapply` (`src/kit/managed.ts:182`) and is in neither `rewrite` nor `kept`, so nothing is rewritten and no notice names it. The filter stays on the old folder and the board is empty.
- Gap 2: renaming only the `To-dos` subfolder (`00 Planning/To-dos`) changes no setting (it is always `<planning>/To-dos`), so nothing follows it and nothing is reported.
- **CAUSE FOUND (user reproduced 2026-10-09: planning folder renamed to `00 Planning moved` in Obsidian, board empty; test-vault inspected)**: Obsidian re-saved `To-do board.base` with `columnWidth` and `order` swapped (same meaning, other bytes). Its hash no longer equals the installed hash, so `planFolderReapply` treats it as edited: not rewritten, at most named in the 12 s "Your edits were kept" notice. The settings and tracked path followed the rename; the other kit files (templates, Weekly review) were rewritten. Test: `tests/base-folders.test.ts` "Obsidian re-saves a .base". Phase 2 must handle a base Obsidian re-formatted: compare meaning (parse YAML, or patch only the folder string in the filter line, backup first), not bytes.
- (Earlier note, superseded) Not reproduced: the user's exact failure (planning folder renamed, board empty). It matches gap 1 only if the recorded version was older than the kit's; the test vault showed 0.5.2. Need the exact Obsidian steps (BACKLOG item).
- Phase 2 should: report gaps 1 and 2 in the notice, and flip the two "skipped AND not reported" tests.

### Phase 2 — Fix and report
- Depends on: Phase 1
- Files: `src/kit/managed.ts` (`planFolderReapply`), `src/kit/managed-ui.ts` (`reapplyFolders`), `src/kit/ui.ts` (Notices ~345-346), tests.
- Done when: the Phase 1 failing case passes; an edited `.base` is named in the notice with "patch folder only" (replace just the old folder string in the filter line, backup first, nothing else touched); tests for patch and for not-found string. Not seen in Obsidian is stated.

#### Phase 2 result (2026-10-09, tests only, not seen in Obsidian)
Built as planned: `patchFolders` (position-matched `file.inFolder` strings, null if nothing to change or counts differ), `patchManagedFolders` (backup, write, state and base copy untouched), `planFolderReapply` returns `skipped`, `reapplyFolders` returns `patchable` + `patch()`, `foldersChanged` shows a persistent notice with **Patch folder only**. A `.base` whose filters already match is no longer reported. Gap 2 (`To-dos` subfolder rename) left in BACKLOG "Board folder patch". Tests 548.

### Phase 3 — Check in Obsidian (user)
- Depends on: Phase 2
- Done when: the user renames each folder in `test-vault` and the three boards still list notes; result goes into BACKLOG.

## Verification
Tests per phase; Phase 3 in Obsidian by the user. Known answers are unaffected (no engine change).
