# Plan: Project plan, Priority and project tile for to-dos

_Agreed: 2026-10-12 (survey answers; project-tile placement chosen from the user's board screenshot). Written by `/phase-plan`. Each phase = one session._

## Goal
To-dos get a Priority, a project tile on the board card, and (for to-dos in a project) `after` / `result` / `order`, so the project hub shows an overall plan: a Plan tile and a `plan` diagram block.

## Decision taken
- **Priority:** text pick list High / Medium / Low, empty = none. Ranks after the due date (due date first, priority breaks ties). New to-do asks it with one pick, "(none)" first.
- **Project tile on cards:** plain text under the title, truncated; must not clash with the countdown (`::after` on the card, `vault-theme.css:341`). Screenshot seen 2026-10-12: put it on its own line under the title, left, clear of the bottom-right badge; with a 2-line title it must not run under the badge (truncate to one line).
- **Plan properties:** optional `after` (links, several), `result` (one line), `order` (number). NOT asked at capture. Order is changed by editing, no drag.
- **Blocked:** shown only in the Plan tile and the `plan` block (a row whose `after` to-dos are not all done). The board and `day` are never changed automatically. Supersedes the BACKLOG idea of blocked = Backlog.
- Rejected: Priority before due date; number priority; a third card badge for blocked; auto-moving cards.

## Out of scope
- Drag-to-reorder, editing the plan inside the diagram, Priority colours on the board (revisit after Phase 1 is seen).
- `result` for to-dos without a project (open: default no).

## Phases

### Phase 1 — Priority property
- Files: `kits/planning/Extras/Templates/To-do.md` (pick after countdown), `src/planning/lists.ts:160-166` (tie-break: due, then priority), `src/kit/tidy.ts:382-391` (add `priority` to the todo-properties rule only if the user wants old to-dos filled: default empty, so likely no rule), `To-do board.base` (sort / show), docs (Vault spec, How my vault works), tests in `tests/planning-lists.test.ts`, `tests/due-words.test.ts`.
- Spike first: whether Bases can sort High/Medium/Low in order inside a group (text sorts alphabetically). If not, the board order stays by Bases default and only project lists use priority; say so in the plan result.
- Done when: tests for the sort (due, then priority, empty last); template text test; `npm run kit:manifest`; not seen in Obsidian unless the user tries it.
- New dependencies: none

### Phase 2 — Plan engine (pure code)
- Depends on: none (can follow Phase 1 or precede it)
- Files: new `src/planning/plan.ts` (read `after` / `result` / `order`; order rows; mark blocked; ignore missing links and cycles with a message), `src/planning/lists.ts` (reuse `projectTodos`, `:169`), To-do template gets empty `after`, `result`, `order` keys only if the user agrees (else the keys are added by hand; ask in the phase), docs.
- Done when: tests with a fixture project: chain, two-parent join, cycle, missing link, done parent unblocks.

### Phase 3 — Plan tile on the project hub
- User addition 2026-10-12 (chat): the Plan tile (the workflow: next to-do steps) goes at the TOP of the Project hub template, shown only when the project has to-dos with a plan (`after` / `order` set); otherwise nothing appears. My reading: "workflow" = this Plan tile, "next steps" = its unblocked open rows first. Confirm in Phase 3.
- Depends on: Phase 2
- Files: `src/planning/blocks.ts:244-255` (new `show: project-plan`), `kits/planning/Extras/Templates/Project hub.md:31-41`, Tidy rule for hub bodies (hub body is rewritten from the template with a preview, 2026-10-10 decision), tests, docs.
- Done when: tests for the rows (status, result, "← after X", blocked mark); hub template test; kit manifest.

### Phase 4 — `plan` block (Mermaid)
- Depends on: Phase 2
- Files: new `src/planning/plan-render.ts` modelled on `src/rig/render.ts:14-57`, registered in `src/main.ts`; done nodes coloured, `result` on each node; redraw on edit; tests like `tests/rig-render.test.ts`.
- Done when: tests; the user sees one project drawn (including a wide one, a phone).

### Phase 5 — Prompt on done
- Depends on: Phase 2
- Files: `src/planning/engine.ts:103-110` / `todo.ts:58-62` (done branch), a prompt for `result` and "what does this lead to?" (pick, new, none) only for to-dos with a `project`; Esc skips, never blocks ticking done.
- Done when: tests for the patch; the user ticks a to-do in Obsidian (unknown: a prompt from a metadata change handler has not been done before, spike first).

### Phase 6 — Project tile on board cards
- Depends on: the user's screenshot (received 2026-10-12: card = title left, round tick top right, countdown badge bottom right; a 2-line title already runs down beside the badge; free space is a line under the title on the left); best after Phase 1 so both card additions are seen together
- Files: `To-do board.base` (`project` in `order`, simplest) or `vault-theme.css` + `engine.ts:173-193` data attribute; tests; the 3-line title overlap and phone width checked.
- Done when: the user sees it next to a countdown and a priority on one card.

## Verification
Tests per phase; each phase is tests-only until the user tries it in Obsidian (say so in STATUS). Known engine answers are untouched, none of this changes `calc`.
