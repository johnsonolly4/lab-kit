# Plan: list and confirmation windows in the Check setup look

_Agreed: 2026-10-13 (approved by the user 2026-10-13, "Continue here"). Written by `/phase-plan` (Sonnet). Each phase = one session, on Sonnet; the user looks in Obsidian after each before the next starts._

## Goal
Lab Kit's list and confirmation windows look like Check setup (itself drawn after the Literature Feed plugin): intro sentence, a larger summary line, rows with a round tinted mark, a larger title with a muted description, and a footer with the buttons.

## Decision taken
User, 2026-10-13 (survey, two mockups, chat):
- **Scope:** lists and confirmations. Review update…, Manage kit files…, Kit report, Kit install, Kit merge, the two plain confirm windows, Clear old backups…, Find moved folders, Tidy up notes, and finishing Check hotkeys / Set the suggested keys. NOT: pickers and the Alt+S forms (they should look like Obsidian's suggesters), What's new, Picture for a slide, Link to-dos in order, tick-subtasks (left as they are; can be added later).
- **Classes:** rename `lab-kit-setup-*` to a generic `lab-kit-win-*` (intro, summary, row, mark, text, title, group, foot); Check setup is the first user. One set to maintain. CSS stays in `styles.css` (rule 1 of "Where CSS goes", `docs/architecture.md`).
- **Review update… / Manage kit files… marks show the state of the file:** green ✓ up to date, amber ! has an update or needs a decision, red ✗ conflict or missing, grey i kept or optional; summary line on top ("3 files to update."). The per-kit sections and the sticky footer stay.
- **Tidy up notes: option C (the in-between mockup, seen 2026-10-13):** the boxed rule blocks keep their frame so the diff stays framed; each rule header gets the round mark (amber changes it will make, red removes lines of the user's, grey reported only), the larger title and a muted description under it; the window gets a summary line ("3 things will change, 1 needs a look.") and the Check setup footer. No group label. The diff, folds and batches are untouched (the user liked them: "Much better").
- Rejected: keeping the `lab-kit-setup-*` names (windows would carry "setup" in their class); Tidy chrome only (A) and Tidy full flat rows (B).

## Out of scope
- Any change to what a window does, its wording beyond the summary line, or its buttons.
- The pickers, Alt+S forms (`kits/lab/Extras/scripts/templater/labForm.js`, `labPick.js`), What's new, Picture for a slide, Link to-dos in order, tick-subtasks.
- Moving other CSS (that is Phase 3 of `docs/plans/plan-map-styles-in-plugin.md`).

## Phases

### Phase 1 — Shared look and the hotkey windows — BUILT 2026-10-13, not seen in Obsidian
- Result: `src/kit/window-look.ts` (`winIntro`, `winSummary`, `winRow`, `winFoot`, `WIN_MARK`), classes renamed to `lab-kit-win-*`, `hotkeyRowState` / `hotkeySummary` in `hotkey-check.ts`, `tests/window-look.test.ts`; tests 996, lint 0 errors. `SETUP_MARK` is now `WIN_MARK`. Check hotkeys' optional mark changed from "–" to "i" (same as Check setup).
- Files: `styles.css` (rename `.lab-kit-setup-*` to `.lab-kit-win-*`, same rules), `src/kit/setup-check-ui.ts` (`:142-163`), `src/kit/hotkey-check-ui.ts` (`:7` Check hotkeys: add title / group classes; `:51` Set the suggested keys: add the mark), `src/kit/setup-check.ts` (`SETUP_MARK`, `setupSummary`: move to or re-export from a small shared pure file if the other windows need them), a test (class names present, summary strings), docs per `docs/maintenance.md`.
- Done when: tests, lint, build clean; a test fails if a `.lab-kit-setup-` class is left in `src/` or `styles.css`; Check setup looks the same as before (the user's screenshot of 2026-10-13 is the reference); Check hotkeys and Set the suggested keys use the same rows; NOT seen in Obsidian until the user looks (checklist row).
- New dependencies: none

### Phase 2 — Review update…, Manage kit files…, Kit report
- Depends on: Phase 1
- Files: `src/kit/managed-ui.ts` (`:569`, `:732`, `:764`; rows at `:525-539`, `:673-676`, `:720`), a pure helper that maps a file's state to a mark and builds the summary line (tested), `styles.css` (remove `.lab-kit-review-row` / `.lab-kit-manage-row` rules that the shared rows replace), `src/kit/kit-set-ui.ts` if the two-kit sections need it.
- Done when: tests cover every file state → mark and the summary for 0, 1 and many; the per-kit sections, sticky footer and Apply behaviour are unchanged (existing tests pass untouched); phone width checked by the user.

### Phase 3 — Install, Merge, confirmations, Clear backups, Find moved folders
- Depends on: Phase 1
- Files: `src/kit/managed-ui.ts` (`:804` Kit install, `:851` ConfirmModal), `src/kit/merge-ui.ts:31`, `src/kit/tidy-ui.ts:335` (TidyConfirmModal), `src/kit/backups-ui.ts:7`, `src/kit/moved-folders-ui.ts:27`.
- Done when: each window has the intro / summary line / row / footer pieces that fit it (a confirmation is the intro, a summary line and the footer only; no invented marks); buttons and behaviour unchanged; tests, lint, build clean.

### Phase 4 — Tidy up notes (option C) and the docs sweep
- Depends on: Phases 1 and 3 (shared pieces)
- Files: `src/kit/tidy-ui.ts` (`:92` window; rule header `:137-174`; reported `:206-214`; foot `:218-231`), `styles.css` (`.lab-kit-tidy-*` rule header only; diff rules untouched), docs: `docs/changelog.md`, `docs/tutorial.md`, `README.md` if they describe a window, `docs/obsidian-test-checklist.md` (one row per phase), `docs/architecture.md`, `BACKLOG.md`.
- Done when: tests (the Tidy tests pass untouched; a new one for the mark per rule kind and the summary line); the diff, fold rows and batches look the same (the user checks); docs list every window's look.

## Order check
1 first (the rename touches every later phase). 2 and 3 are independent of each other. 4 last because it reuses the pieces proven on the smaller windows and is the window the user already approved.

## Verification
The look is the user's to judge in Obsidian: Check setup (screenshot 2026-10-13) is the reference; each phase adds a checklist row. Light and dark theme, and phone width, per phase.
