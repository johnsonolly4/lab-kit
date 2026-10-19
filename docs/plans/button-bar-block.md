# Plan: plugin-drawn button bars (replace Meta Bind BUTTON[...])

_Agreed: 2026-10-15. Written by `/phase-plan` (survey with the user). Each phase = one session, Sonnet (fully specified). Branch: cut a new one from `feat/map-empty-box` once that is merged, or continue on it if the user has not pushed yet._

## Goal
Every button bar in the planning kit is drawn by the plugin, so windows open under the clicked button, the look follows the chips and the shape standard, and a stale Meta Bind button template can never show an old window. The project page bar gets chips for Status and Deadline (BACKLOG item 13).

## Decisions taken (user, 2026-10-15, survey)
- **Scope:** all `BUTTON[...]` bars (Home, Meetings hub, Projects overview, Shopping list, Weekly review buttons, Daily note, ZotLit template, hub templates). `INPUT[...]` stays Meta Bind (Weekly review toggles, Meeting series deck-path text inputs), so Meta Bind stays a required plugin. The lab kit has no Meta Bind buttons (explorer, 2026-10-15): nothing to do there.
- **Block shape:** one `show: button-bar` inside the existing `vault-card` block, with an `ids` list (e.g. `ids: new-meeting, new-one-off-meeting, go-deck`). Label, icon and action come from one table in the plugin, so a note holds no action and cannot be stale. Unknown id → one plain muted line naming it.
- **Migration:** kit notes arrive through Review update…; notes the user edited get an opt-in Tidy up notes rule that swaps `BUTTON[...]` lines for the block (same pattern as the to-do bar rule, `src/kit/tidy.ts:231`, `:403`). Nothing is rewritten silently.
- **Project bar (item 13):** Status and Deadline become chips with a dropdown under the chip (like `todoBar` / `editChip`, `src/planning/blocks.ts:475-516`), in the shape standard (`docs/design-standard.md`).
- Rejected: one fixed block per note kind (more names to maintain); leaving Meta Bind and the plugin side by side with no Tidy rule.

## Out of scope
- `INPUT[...]` (toggles, text inputs); dropping Meta Bind as a dependency.
- Lab kit buttons (none exist), Templater `vtAsk.js` boxes, Alt+S forms.
- Changing button labels, icons or order (the table copies `src/planning/meta-bind-buttons.json`; any change asks first).

## What the buttons do (from `meta-bind-buttons.json`, 27 templates)
- 12 run a command (today, todo, capture, lab, search, update-litnote, go-deck, new-meeting, new-meeting-series, new-one-off-meeting, archive-todos, sort-inbox, shop-add, new-project, project-note): these map to `PlanningCommands` / plugin commands.
- 11 open a note (`go-*`, `help`): `[[names]]` that must follow the planning folder settings.
- 2 do their own edit and need new plugin code: `shop-clear` (regexp replace in the note) and `clear-review` (six `updateMetadata` actions).

## Phases

### Phase 1 — Button table and `button-bar` block (commands and open-note only) — BUILT 2026-10-15 (tests 1147, lint 0 errors; NOT seen: checklist 6i "Button bar block"; the block's own look is `.vt-bar-button` in `styles.css`, not `.vt-hub-bar`)
- Files: new `src/planning/button-bar.ts` (pure table: id → label, icon, kind, target; id-list parser), `src/planning/blocks.ts` (new `case "button-bar"`, add the name to the unknown-show list at `:442`, capture the clicked button so `captureAnchor` / `buttonAnchor` in `src/planning/entry-window.ts` and `commands.ts` sees it), `styles.css` (`.vt-button-bar`, shape-standard corners, reuse `.vt-hub-bar` look), new `tests/button-bar.test.ts`.
- Done when: a test checks every id in `meta-bind-buttons.json` is either in the table or listed as Phase 2's; ids parse (spaces, commas, bad id); open-note targets resolve with default and renamed planning folders; a click on a command button passes its element as the window anchor (test with a fake command). Tests + lint 0 errors; commit.
- Depends on: nothing. New dependencies: none.

### Phase 2 — The two buttons with their own edits — BUILT 2026-10-15 (tests 1150, lint 0 errors; NOT seen: checklist 6i "Button bar block"; no new file: `toEdit` / `applyReplace` in `button-bar.ts`, `editNote` in `blocks.ts`)
- Files: `src/planning/button-bar.ts`, new small `src/planning/review-reset.ts` (or inside the table), tests.
- Do: `shop-clear` (remove the ticked lines of the shopping list note, same result as the Meta Bind regexp; read it from the JSON) and `clear-review` (the six property updates in the JSON). Both on the note the block is in.
- Done when: tests against fixture notes give the same result as the JSON's actions (compare to the JSON's regexp / values); a failed write shows a notice and changes nothing; commit.
- Depends on: Phase 1.

### Phase 3 — Kit notes use the block — BUILT 2026-10-15 for Home, Meetings, Projects overview, Shopping list, Daily note (tests 1153, lint 0 errors; NOT seen: checklist 6i "Planning notes use the button bar"). LEFT OUT by the user: the Weekly review ("maybe we rethink how the weekly review works") and, with it, the ZotLit template; both keep Meta Bind buttons, BACKLOG "Weekly review rethink". Home's help button: own right-aligned block (`align: end`) under the date; the pull-up onto the date's line is not done (DOM unseen)
- Files: `kits/planning/00 Home.md:8-10`, `08 Meetings/Meetings.md:6`, `02 Projects/Projects overview.md:8`, `00 Planning/Shopping list.md:7`, `00 Planning/Weekly review.md:14-26` (buttons only), `Extras/Templates/Daily note.md:10`, `Extras/Templates/ZotLit/zotlit-note.liquid.md:11`; the `07 How-tos` pages that show a `BUTTON[id]` example (`Vault spec.md:416`); run `npm run kit:manifest`; update tests that read these notes (`tests/planning-buttons.test.ts`, `tests/planning-hub-blocks.test.ts`, `tests/kit-planning.test.ts:299-325`).
- Done when: no kit note under `kits/` holds `BUTTON[` (a test asserts it); every id used in a note exists in the table (the old "template ids vs notes" test, moved); `npm run kit:manifest`, tests, lint pass; commit. Checklist 6i row: the user tries each bar after Review update… (windows open under the clicked button, not dimmed, on desktop and phone).
- Depends on: Phases 1-2.

### Phase 4 — Project page bar chips (item 13) — BUILT 2026-10-15 (tests 1160, lint 0 errors; NOT seen: checklist 6i "Project hub bar chips"; `src/planning/project-bar.ts`, `projectChips` in `blocks.ts`; the hub's own New to-do / New note buttons stay context-specific (they pass the project) and only take the `vt-bar-button` look, not `button-bar` ids; the `.vt-hub-bar` rules stay in `vault-theme.css` because the meeting bar still uses them)
- Files: `src/planning/blocks.ts` (`hubBar` project branch `:457-463`, `statusSelect` `:518-529`, `deadlineInput` `:531-541`), `src/planning/todo-bar.ts` or a new `src/planning/project-bar.ts` for pure parts, `styles.css`, `kits/planning/.obsidian/snippets/vault-theme.css:274-286` (remove rules the plugin now owns, per the "where CSS goes" rule in `docs/architecture.md`), tests (none exist for the Status / Deadline DOM, add them).
- Do: chips Status (values `PROJECT_STATUSES`, `src/planning/lists.ts:56`) and Deadline (date picker like the Due chip, clear option); deadline countdown badge stays (`deadlineBadge`, hidden when Done); New to-do and New note buttons come from `button-bar` ids so the bar is one thing. Read `docs/design-standard.md` and `docs/reference/visual/README.md` first (or say it is missing).
- Done when: tests for chip text, writing `Status` / `deadline`, clearing, Done hides the badge; look matches the approved chip images; commit. Tell the user the look is not seen.
- Depends on: Phase 1 (shared button chips).

### Phase 5 — Tidy rule, Check setup row, docs — BUILT 2026-10-15 (tests 1165, lint 0 errors; NOT seen: checklist 6i "Tidy up notes: button bar rule"). Tidy rule `button-bar` in `src/kit/tidy.ts` (`buttonFolders` in `TidyContext`, set in `tidyContext`). Check setup rows LEFT AS THEY ARE: the Weekly review and the ZotLit template still use Meta Bind buttons, so the button templates stay needed; revisit with BACKLOG "Weekly review rethink"
- Files: `src/kit/tidy.ts` (opt-in rule: `BUTTON[a, b]` line → `vault-card` block with `show: button-bar` and `ids`; leave non-planning ids and `INPUT[` alone, report them), `src/kit/setup-check.ts:317-329` and `:389-397` (the "Meta Bind buttons" rows only matter for notes that still hold `BUTTON[`: show them only then, or reword; ask the user which if unclear), `docs/architecture.md`, `docs/changelog.md`, `docs/INDEX.md`, README / tutorial lines that mention Meta Bind buttons, checklist 6i.
- Done when: fixture notes (BUTTON line in a bar, mixed with INPUT, unknown id) give the expected output and a second run changes nothing (idempotent); Check setup test updated; docs match the code; commit.
- Depends on: Phase 3.

## Order check
1 → 2 → 3 is forced (table before the notes use it). 4 only needs 1 and can move before 3 if the user wants the project bar first. 5 last: the Tidy rule needs the final id list from 3.

## Verification
- Every Meta Bind template id has a table entry or an explicit "dropped" note (test).
- Not seen in Obsidian until the user tries: checklist 6i rows added in each phase. The old bug (11: the old window from a stale Meta Bind template) is gone by construction once Phase 3 is in; it is confirmed only when the user retries New one-off meeting from the Meetings hub after Review update….
