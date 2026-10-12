# Plan: Combined results, Home tiles, deadline countdown and progress

_BUILT 2026-10-09 in one session at the user's request ("do them now"): phase 3 (spike) was folded into phase 4 because the `order` card-property key is the one the To-do board already uses; nothing seen in Obsidian. Agreed: 2026-10-09. Written by `/phase-plan`. Each phase = one session. Source: BACKLOG "Pre-release test 2026-10-09"._

## Goal
One Combined results snippet (no switch on Analysis table), Home tiles capped and linked to their hubs, and projects / lab notes show a deadline countdown and checklist progress on the built-in Bases kanban.

## Decision taken (user, 2026-10-09)
- Combined results: drop the "Also add a combined results table" switch from Analysis table; the Combined results snippet (`labSnippets.js:328`) stays the one place. It already reads `sampling` names (`:334`); a test proves it, since BACKLOG says otherwise.
- Home tiles: every tile defaults to 8 rows, `limit:` overrides (today only experiments, projects, recently-read honour it: `blocks.ts:118-127`).
- Tile headings: link written in the callout title in `kits/planning/00 Home.md:30-55`. Existing Homes keep their text (kit Home is `policy: keep`); no new block option.
- Deadline + progress: a new `deadline` date on the Project hub template (reuses the due-countdown logic), progress as text such as `3/7`, shown through the **built-in Bases kanban** (card properties), not a custom view.
- Rejected: reusing `due` for projects (means to-do deadline); a `hub:` block option.

## Out of scope
- Colouring day cards by choice, Status board colours (need the kanban DOM seen in Obsidian).
- Calc-table cell colouring (feature idea 3).
- Changing the Analysis table's method list.

## Phases

### Phase 1: Combined results (smallest, no layout)
- Files: `kits/lab/Extras/scripts/templater/labSnippets.js:313-326`, `kits/lab/Templates/Snippets/14 Analysis table.md`, `docs/`, `tests/`
- Done when: Analysis table has no switch; test with fixtures shows Combined results offers every built-in, Methods-folder and user-made method and uses `samples` plus `sampling` codes; `npm run kit:manifest`; tests and lint pass.

### Phase 2: Home tiles (layout: ask on wording)
- Files: `src/planning/blocks.ts:99-138`, `src/planning/lists.ts:157-168`, `kits/planning/00 Home.md:29-58`, `tests/`
- Done when: this-week, inbox and next-meetings default to 8 and obey `limit:`; the kit Home headings link to Projects, Meetings etc.; existing Homes unchanged (test); manifest regenerated.

### Phase 3: Progress spike (Opus, decide before building)
- Depends on: none
- Files: `kits/lab/03 Lab Book/Lab book base.base`, `src/planning/engine.ts`, `kits/planning/00 Planning/Shopping list.md`
- Done when: written answer to "what can a Bases kanban card show": a property the plugin writes (`progress: 3/7`) vs. a formula; user looks at one card in Obsidian. No build.

### Phase 4: Checklist progress
- Depends on: Phase 3
- Files: new `src/planning/progress.ts`, engine hook, lab note template header, Shopping list, `.base` card properties, `tests/`
- Done when: ticking a box updates `progress` in lab notes and the Shopping list; tests with fixtures; user-facing text agreed first.

### Phase 5: Project deadline
- Depends on: Phase 4 (shares the card-property work)
- Files: `kits/planning/Extras/Templates/Project hub.md:10-24`, `src/planning/todo.ts:105-121` (`dueCountdown`), `lists.ts` (projects tile), Projects overview, Vault spec, `vault-theme.css:348-364`
- Done when: a project with `deadline` shows the countdown on 00 Home, the hub and the overview; respects the Due-date countdown setting; tests only until the user sees it.

## Order check
1 and 2 are independent. 4 needs 3. 5 follows 4 so the card properties are set once. Recommend 1, 2, 3, 4, 5.

## Verification
Fixtures for Phase 1; unit tests for limits and heading links; countdown reuses the existing `dueCountdown` tests. Anything in Obsidian is marked "not seen" until the user checks it.
