# Plan: Project plan, Priority and project tile for to-dos

_Agreed: 2026-10-12 (survey answers; project-tile placement chosen from the user's board screenshot). Written by `/phase-plan`. Each phase = one session._

## Goal
To-dos get a Priority, a project tile on the board card, and (for to-dos in a project) `after` / `result` / `order`, so the project hub shows an overall plan: a Plan tile and a `plan` diagram block.

## Decision taken
- **Priority:** number 1, 2, 3 (1 = highest), empty = none (user, 2026-10-12, after the Bases sort test; text sorted alphabetically). New to-do asks it with one pick, "(none)" first.
- **Priority in the project lists (user, 2026-10-12, plan check):** overdue → day → priority → name. Today's order is kept (`src/planning/lists.ts:160-166`: overdue, then Mon → Fri → Backlog, then path); priority only breaks ties within a day, empty last. The due date itself is not a sort key (only "overdue" is), so the earlier wording "due date first, priority breaks ties" is replaced by this.
- **Project tile on cards:** plain text under the title, truncated; must not clash with the countdown (`::after` on the card, `vault-theme.css:341`). Screenshot seen 2026-10-12: put it on its own line under the title, left, clear of the bottom-right badge; with a 2-line title it must not run under the badge (truncate to one line).
- **Plan properties:** optional `after` (links, several), `result` (one line), `order` (number). NOT asked at capture. Order is changed by editing, no drag.
- **Blocked:** shown only in the Plan tile and the `plan` block (a row whose `after` to-dos are not all done). The board and `day` are never changed automatically. Supersedes the BACKLOG idea of blocked = Backlog.
- Rejected: Priority before due date; number priority; a third card badge for blocked; auto-moving cards.

## Out of scope
- Drag-to-reorder, editing the plan inside the diagram, Priority colours on the board (revisit after Phase 1 is seen).
- `result` for to-dos without a project (open: default no).

## Phases

### Phase 1 — Priority property
- Files: `kits/planning/Extras/Templates/To-do.md` (pick after countdown), `src/planning/lists.ts:160-166` (tie-break: overdue, day, then priority, then path), `src/kit/tidy.ts:382-391` (add `priority` to the todo-properties rule only if the user wants old to-dos filled: default empty, so likely no rule), `To-do board.base` (sort / show), docs (Vault spec, How my vault works), tests in `tests/planning-lists.test.ts`, `tests/due-words.test.ts`.
- Spike first: whether Bases can sort High/Medium/Low in order inside a group (text sorts alphabetically). If not, the board order stays by Bases default and only project lists use priority; say so in the plan result.
- Plan check 2026-10-12: `To-do board.base` has no `sort:` at all today (only `groupBy` and `order`: file.name, done), so the spike is two steps: (1) does a `sort:` inside a kanban group work and keep the user's own card order / drag behaviour, (2) can it rank High / Medium / Low (a formula, or alphabetical only). Showing priority on the card is NOT part of this phase: anything added to `order` changes the card (see Phase 6).
- Done when: tests for the sort (overdue, day, then priority, empty last); template text test; `npm run kit:manifest`; not seen in Obsidian unless the user tries it.
- **Phase 1 result (2026-10-12, tests only, not seen in Obsidian):** `priorityRank` in `src/planning/lists.ts` (1, 2, 3 as number or text; empty or other last, so old `High` text counts as none) sits between the day rank and the path compare in `openProjectTodos`; `thisWeek` unchanged. To-do template has a `priority:` key after `countdown`; New to-do asks it with a pick with text hints (user, 2026-10-12, built after the numeric decision). User tried the board Sort on the number: order correct (1, 2, 3; where empty ones land not reported). No Tidy rule (default empty). Kit manifest regenerated. **Bases sort spike: half answered by a user screenshot (2026-10-12, chat).** The board's kanban view has a Sort control ("Sort by", a Property picker and A → Z / Z → A, "Add sort"), so sorting exists in that view. User reply (2026-10-12, chat): "Sort stays across groups, after it has been dragged" (read as: the sort applies in every column and still holds after a card is dragged; not seen by me). **Screenshot 2 (2026-10-12, user):** Backlog column with `priority` shown on the cards (added to the view's `order` by the user) reads high, low, med: alphabetical, so the text sort does NOT rank High / Medium / Low (it gives High, Low, Medium); a rank formula or numeric key is needed for the board. Also seen: with a 3-line title the `priority` label runs into the title text (the card-height problem predicted for Phase 6); the user typed `med`, which `priorityRank` does not know (ranks as none). Nothing in the repo uses `sort:` in a `.base` or documents it, so whether a kanban group can sort and rank High / Medium / Low is unknown; the board file is unchanged. To try: in test-vault add `sort:` with `property: priority` to the Board view of `To-do board.base` and see if cards keep drag behaviour and the order is alphabetical (High, Low, Medium) rather than High, Medium, Low.
- New dependencies: none

### Phase 2 — Plan engine (pure code)
- Depends on: none (can follow Phase 1 or precede it)
- Files: new `src/planning/plan.ts` (read `after` / `result` / `order`; order rows; mark blocked; ignore missing links and cycles with a message), `src/planning/lists.ts` (reuse `projectTodos`, `:169`), To-do template gets empty `after`, `result`, `order` keys only if the user agrees (else the keys are added by hand; ask in the phase), docs.
- Done when: tests with a fixture project: chain, two-parent join, cycle, missing link, done parent unblocks.

- **Phase 2 result (2026-10-12, tests only, not seen in Obsidian):** `readPlan(todos, hub)` in `src/planning/plan.ts` gives `{ rows, problems }` (row: path, name, done, after names, result, order, blocked). Parents before children; ties by `order` (empty last) then path (NOT by the project-list day / priority order: simpler, say if wanted). Missing / self links and cycles are plain-sentence problems; every row is still listed. User decision with it: project to-dos are not archived while their hub is not Done (`isArchivable(..., projectActive)`, `projectIsActive` in `src/planning/commands.ts`; for a to-do with several projects only the first is checked). The To-do template got no `after` / `result` / `order` keys (typed by hand).

### Phase 3 — Plan tile on the project hub
- User addition 2026-10-12 (chat): the Plan tile (the workflow: next to-do steps) goes at the TOP of the Project hub template, shown only when the project has to-dos with a plan (`after` / `order` set); otherwise nothing appears. My reading: "workflow" = this Plan tile, "next steps" = its unblocked open rows first. Confirm in Phase 3.
- Depends on: Phase 2
- Plan check 2026-10-12: the other hub tiles sit inside callouts in the template (`Project hub.md:28-42`), and a callout's title would still show when the block is empty. So the Plan tile is a bare `vault-card` block that draws its own heading and leaves nothing behind when there is no plan, like `show: hub-bar` (`Project hub.md:21-23`). Placement to confirm with the user: under the hub bar and above Goal, or above both.
- Files: `src/planning/blocks.ts:244-255` (new `show: project-plan`), `kits/planning/Extras/Templates/Project hub.md:31-41`, Tidy rule for hub bodies (hub body is rewritten from the template with a preview, 2026-10-10 decision), tests, docs.
- Done when: tests for the rows (status, result, "← after X", blocked mark); hub template test; kit manifest.

### Phase 4 — `plan` block (Mermaid)
- User addition 2026-10-12 (chat): clicking a to-do in the diagram opens its note. Approach (not tried): after the block renders, add a click handler to each node in the SVG that calls `app.workspace.openLinkText(path, "")` (ctrl/cmd-click = new tab); node ids map to note paths in `plan.ts`. Do not rely on Mermaid's own `click` (Obsidian's strict security level may block it: unverified). Pointer cursor on nodes. The same could be added to the `rig` block (`src/rig/render.ts:57`) for parts that are notes: ask the user, rig parts are table rows, not notes.
- Depends on: Phase 2
- Files: new `src/planning/plan-render.ts` modelled on `src/rig/render.ts:14-57`, registered in `src/main.ts`; done nodes coloured, `result` on each node; redraw on edit; tests like `tests/rig-render.test.ts`.
- Done when: tests; the user sees one project drawn (including a wide one, a phone).

### Phase 5 — Prompt on done
- Depends on: Phase 2
- Files: `src/planning/engine.ts:103-110` / `todo.ts:58-62` (done branch), a prompt for `result` and "what does this lead to?" (pick, new, none) only for to-dos with a `project`; Esc skips, never blocks ticking done.
- Done when: tests for the patch; the user ticks a to-do in Obsidian (unknown: a prompt from a metadata change handler has not been done before, spike first).
- Plan check 2026-10-12: `onChanged` (`engine.ts:103`) runs for every metadata change of a to-do, not only a tick made by the user on this device. The spike must also answer (none verified): does a `done` change arriving by sync from another device fire it; what happens when several to-dos are ticked quickly or changed in bulk (roll-over, Tidy up notes, Clear old to-dos); does it fire on a phone. The prompt must open only for a tick made here by the user, at most one at a time; if that cannot be told apart, fall back to a command / button ("Add result") and no automatic prompt.

### Phase 6 — Project tile on board cards
- Depends on: the user's screenshot (received 2026-10-12: card = title left, round tick top right, countdown badge bottom right; a 2-line title already runs down beside the badge; free space is a line under the title on the left); best after Phase 1 so both card additions are seen together
- Files: `To-do board.base` (`project` in `order`, simplest) or `vault-theme.css` + `engine.ts:173-193` data attribute; tests; the 3-line title overlap and phone width checked.
- Plan check 2026-10-12: the `order` route is not known to be the simplest. Obsidian works the card height out from what the card shows (title + done = 88px) and the theme re-places the title and tick inside that fixed height with `!important` rules (`vault-theme.css:357-363`). A third property in `order` will change the height and may break that layout. Spike in Obsidian first: add `project` to `order` in test-vault, look at the card height and the title / tick / countdown. If it breaks, use the data attribute + `::before` route (no height change, like the countdown).
- Done when: the user sees it next to a countdown and a priority on one card.

## Verification
Tests per phase; each phase is tests-only until the user tries it in Obsidian (say so in STATUS). Known engine answers are untouched, none of this changes `calc`.
