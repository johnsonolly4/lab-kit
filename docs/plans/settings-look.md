# Plan: Check setup and settings in the Literature Feed look

_Written 2026-10-13 by `/phase-plan` (Sonnet). Each phase = one session, on Sonnet. Waits for the user's go-ahead on the order (after E)._

## Goal
Lab Kit's Check setup window and its single-button settings rows look like the user's other plugin, Literature Feed (screenshots 2026-10-13), drawn with Lab Kit's colours.

## Decision taken
Decided with the user 2026-10-13 (mockup, two screenshots and a survey):
- **Check setup**, all as drawn: a round tinted mark per row (red ✗ missing, amber ! to do, grey i optional, green ✓ fine), a larger semi-bold title with the muted description under it, one summary line ("2 things to do.", large) under a short intro sentence, rows sorted by what needs the user (missing, to do, optional, fine; group order and the current order inside each), the group name as a small label under each row's text, the Fix / Open / Find button at the right, **Check again** at the bottom. "Things to do" counts the missing and the to-do rows; with none the line says "Everything the kits need is in place."
- **Settings**: every row whose only control is one button becomes an **accent-coloured action row**: the name in the accent colour, the description under it, the whole row clickable and keyboard-operable, no button. Today those are Check setup…, Check hotkeys…, What's new, Clear old backups… and Find moved folders… (`src/kit/ui.ts:152-165`). Rows with a toggle, a box, a menu, or several buttons (Manage files… / Review update… / Update all safe files, which item E turns into one row) are left as they are.
- **Not done, on purpose**: the "+" on a section heading (Lab Kit has no list to add to yet) and the row spacing and type (the two pages already look the same in the screenshots).
- Colours: the Literature Feed stylesheet already reads Lab Kit's `--vt-*` variables with fallbacks. Lab Kit's window is plugin code, so its styles go in the plugin's `styles.css` (they arrive with the plugin, no Review update…), using `--vt-done`, `--vt-waiting`, `--vt-overdue`, `--vt-neutral` (and their `-text` forms) when the theme snippet has them, else Obsidian's `--text-success` / `--text-warning` / `--text-error` / `--text-muted`.
- Claude's choice, the user can overrule: **Check again** is at the bottom as drawn only; the list already rechecks after every Fix, as today.

## Out of scope
- Any change to what a check or a Fix does.
- The Literature Feed plugin itself (its code was not read: `main.js` is behind a deny rule; only its stylesheet and two screenshots were used).
- Item E's single "Kit files" row (own plan, `docs/plans/kit-files-one-row.md`); this plan leaves the three-button rows alone so the two do not collide.

## Phases

### Phase 1 — The Check setup window — BUILT 2026-10-13, not seen in Obsidian
- Files: `src/kit/setup-check.ts` or a new small pure file (`orderSetupItems(items)` → sorted by missing, warn, optional, ok then the original order; `summaryLine(items)`; the mark symbol and class per item), `src/kit/setup-check-ui.ts` (`render`, lines 142-160: the intro sentence, the summary line, the rows with the round mark, title, description and group label, Check again at the bottom), `styles.css` (replace the `.lab-kit-setup-*` block at lines 195-211), `tests/setup-check.test.ts` (or a new test file) for the order and the summary, a render test with the small DOM stand-in (marks, order, button labels Fix / Open / Find).
- Result 2026-10-13: `setupRowState`, `SETUP_MARK`, `orderSetupItems`, `setupSummary` in `setup-check.ts` (pure, tested), `render` in `setup-check-ui.ts` (intro sentence, summary, rows with mark / title / description / group label, Check again in the foot), the `.lab-kit-setup-*` block in `styles.css` (tint from `--vt-*` with fallbacks); the Check hotkeys window shares the row classes and keeps its states (`is-warn`, `is-optional` map to the amber and grey marks). No render test of the window itself (the test Modal stand-in is empty). Tests 983.
- Done when: tests, lint and build clean; the order test covers all four states and a stable order inside a state; the summary covers 0, 1 and many; NOT seen in Obsidian until the user opens Check setup (checklist row): round marks tinted, title larger, summary, sorted, group label under each row, buttons still work and the list rechecks after a Fix.
- New dependencies: none

### Phase 2 — Accent-coloured action rows in the settings
- Depends on: nothing (independent of Phase 1); do after item E's Phase 4 so both edit `builtInGroups` once.
- Spike first (by reading): what `render: b => …` receives in `SettingGroupItem` (is `b` a `Setting`, is `b.settingEl` reachable) in `src/kit/ui.ts` (`getSettingDefinitions`, `builtInGroups`) and `src/header/settings.ts`.
- Files: `src/kit/ui.ts` (a small helper `actionRow(b, run)` that adds a class, `role="button"`, `tabindex="0"`, click and Enter / Space handlers on the row and removes the control; the five rows use it; the button texts go away because the name says it), `styles.css` (`.lab-kit-action` name in `--interactive-accent`, a hover background, a focus ring, a pointer cursor), tests for the helper with the small DOM stand-in, docs per `docs/maintenance.md` (README Settings, tutorial wording that says "press the button", changelog, checklist row).
- Done when: tests, lint and build clean; each of the five rows runs its old action from a click and from the keyboard; nothing else in the tab changes; NOT seen in Obsidian until the user has looked (checklist row), including a phone width.
- New dependencies: none

## Order check
1 and 2 are independent. Do them after item E (E's Phase 4 rewrites the Updates rows in the same function), before F and G.

## Verification
- The ordering and the summary by tests; the rows' click and key handling by the small DOM stand-in.
- The look is the part only the user can judge: the mockup of 2026-10-13 is the reference, the Literature Feed screenshots are the target.
