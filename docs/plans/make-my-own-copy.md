# Plan: Make my own copy (snippets)

_Agreed: 2026-10-08. Written by `/phase-plan`. Each phase = one session._

## Goal
A button on each kit snippet row in Manage files… saves a plain Markdown copy in the Snippets folder, so ordinary users can edit it freely and it shows in Alt+S.

## Decision taken
- Output: a plain Markdown file made by running the snippet once with empty answers (user, 2026-10-08). Rejected: a template that still calls the form (needs the script split first).
- Placement: Manage files…, snippet rows. The kit original stays managed and keeps updating; the copy gets a new name and is a user file, never touched by updates (user).
- Script split (`labSnippets.js` into one file per snippet): its own later phase, after the button (user). Rejected: split first; dropping it.

## Out of scope
- Form defaults (NMR solvent, RAFT ratio…) as plain settings (BACKLOG "v0.4 quick changes").
- Copying Methods-folder entries (they are already user notes).
- Changing any user-facing text beyond the new button's label and Notice (ask for wording).

## Phases

### Phase 1 — Spike: can a snippet run headless with empty answers?
- Files: `kits/lab/Extras/scripts/templater/labSnippets.js` (read), `labForm.js` (read), `src/kit/managed-ui.ts:577-585` (read); notes in this plan only.
- Done when: this plan says, per snippet (28 manifest entries, `kits/lab/kit-manifest.json`), whether `labSnippets(tp, name)` can run with a stub `tp` whose form returns empty/default values, and what it returns. Snippets that cannot (forms needing a live UI) are listed with the fallback (copy the stub text, or hide the button). Decision recorded in `docs/decisions.md`.
- New dependencies: none

### Phase 2 — Engine: build the copy
- Depends on: Phase 1
- Files: new `src/kit/snippet-copy.ts` (pure: name the copy `<name> (mine)`, avoid clashes, write only if absent), `tests/snippet-copy.test.ts`; Engine change → fixtures: copy output compared with the snippet run on the stub `tp`.
- Done when: tests pass for each snippet class from Phase 1, an existing file is never overwritten, the copy is not in `managed.files` (so Review update… ignores it), `npm test` and `npm run lint` clean.

### Phase 3 — Button in Manage files…
- Depends on: Phase 2
- Files: `src/kit/managed-ui.ts` (snippet row next to Detach, ~line 584), `docs/` per `docs/maintenance.md`, `docs/obsidian-test-checklist.md`, `STATUS.md`, `BACKLOG.md`.
- Done when: button on snippet rows only; Notice names the new file; copy appears in Alt+S (checked in test-vault, reported as seen / not seen); works on mobile (no `hasNode()` use).

### Phase 4 — Split `labSnippets.js` (later, own plan if it grows)
- Depends on: Phase 3; plan first again before building (touches the manifest, update logic, tests, `docs/architecture.md`).
- Done when: set at that session's `/phase-plan`.

## Verification
Run each kit snippet on the stub `tp` before and after; the copy equals the snippet's own output. Known answers 0005 and 0011 are unaffected (no engine change). Obsidian check in test-vault: not seen until the user does it.
