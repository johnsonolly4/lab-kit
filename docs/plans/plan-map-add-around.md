# Plan: add to-dos before / after / between on the plan map, no list option, subtasks in the slide picture

_Agreed: 2026-10-15 (user, survey after 1.4.0). Written by `/phase-plan`. Each phase = one session, Sonnet (fully specified). Code map from the explorer, 2026-10-15; pointers can drift: check before building._

## Goal
On a dense plan map you can add a to-do before, after or between cards from the card itself; the map is the only plan view; the slide picture shows subtasks.

## Decisions taken (user, 2026-10-15)
- **Insert between one and several followers:** new X between A and all of A's followers: A→X, X→each follower, A's old links to them removed. One undo step (the existing `group` of `recordChange`).
- **Add near:** two small + buttons on each card (left = add before, right = add after), appearing on hover (always shown on touch, like the handle: `@media (hover: none)`), opening the same entry window under the + (the button is focused first, as in the button bar). The drag-to-box "+ add after this" stays.
- **Plan list:** removed as an option. The user said "the list / map switch in the Plan header"; the explorer found no such button: the ⇄ in the header is the map direction flip (keep). The list option is the setting **Project plan view** (`map` / `both`, `src/kit/ui.ts:226-229`, `src/kit/paths.ts:40`, `:107`). So: the setting goes and the map is always the plan view. **Confirmed by the user 2026-10-15: "the list view is what I want to remove"; no need to ask again.**
- **Slide picture:** subtasks drawn as on the map (small strips under their parent card); text must fit; what does not fit goes at the bottom of the card ("+N more" style), never dropped silently (user: "if it doesn't, it goes at the bottom somehow").

- **Both ways stay (user, 2026-10-15, asked how the + after button differs from dragging the right-edge dot):** the **+ after** button on a card with followers inserts X between the card and all its followers (A→X, X→B, X→C); dragging the dot into "+ add after this" keeps making X a third branch (A→X, A→B and A→C stay). With no followers both give the same result.
- **Subtasks open by default on the map (user, 2026-10-15)**: Phase 5.

## Claude's choices (the user can overrule)
- **+ before** on B: X is inserted between all of B's predecessors and B (X after each of B's parents, B after X, the parents' links to B removed); a card with no parents gets X as its new first step.
- A subtask has no + buttons (it has no place of its own on the map).

## Out of scope
- Changing the drag-to-box, the arrow menu, hover dimming or card sizes; the To-do board; the project hub template's `show: project-plan` line (the block already draws nothing when the hub has a map; remove it later if the user wants).

## Phases

### Phase 1 — Remove the "Project plan view" setting (list option) — BUILT 2026-10-15 (tests 1168, lint 0 errors; NOT seen: checklist 6i "No plan list option"; also README, tutorial and the Vault spec note (a kit file: Review update…))
- Files: `src/kit/ui.ts:226-229`, `src/kit/paths.ts:40`, `:107` (default and loader), `src/planning/blocks.ts:334` (always treat as map), `docs/tutorial.md:351`, README if it names it, `tests/planning-hub-blocks.test.ts:120-135`, `tests/kit-*` that read `planView`.
- Do: remove it (confirmed by the user); a saved `planView` in data.json is ignored. The `project-plan` block code stays (an old hub with no map still gets nothing, as now).
- Done when: no `planView` left in `src/` (a test), settings tab has no such row, tests and lint pass, changelog line.

### Phase 2 — Insert between a card and all its followers; the + after button
- Files: `src/planning/plan-link.ts` (`planInsert` for several followers: check `canLink` for every new link), `src/planning/add-after.ts` (`insertBetween` loop, one history group; `createFrom` for the + after case), `src/planning/plan-map-render.ts` (the + after button next to the handle, `:479`), `src/planning/blocks.ts:389-391` (wiring), `styles.css` (`.vt-map-plus`, hover and `@media (hover: none)` like `:350-351`), tests `planning-plan-link.test.ts`, `planning-after-write.test.ts`, `plan-map-render.test.ts`, `plan-map-styles.test.ts`.
- Done when: tests on fixtures: A with followers B, C → X after A, B and C after X, A→B / A→C links gone, one Undo restores all, Redo repeats; refusal when a link would make a circle; a card with no followers gets a plain after-link. Not seen in Obsidian until the user tries (checklist 6i row).
- Depends on: nothing (Phase 1 independent).

### Phase 3 — The + before button
- Files: `src/planning/plan-link.ts` (`planInsertBefore`: predecessors of B), `src/planning/add-after.ts` (`insertBefore`, one history group, created note undoable like `recordCreate`), `plan-map-render.ts` (+ on the card's left), `blocks.ts`, `styles.css`, tests as Phase 2.
- Done when: fixtures: B with parents P1, P2 → X after P1 and P2, B after X, P→B links gone; B with no parents → B after X only; Undo / Redo as one step; circle refusal.
- Depends on: Phase 2 (shared button CSS and wiring).

### Phase 4 — Subtasks in the slide picture
- Files: `src/planning/plan-slide.ts` (`slideModel` carries each card's subtasks: `plan-map.ts:42` drops them today; `slideSvg` draws strips under the card, text measured with the existing char-count estimate `CHAR_W` / `wrap` / `cut`, the rest as a last line "+N more" at the bottom of the card), `tests/plan-slide.test.ts`, `tests/plan-slide-ui.test.ts` (readable-size note `MIN_READABLE` must still hold or warn).
- Done when: a fixture with a card of 2 and one of 8 subtasks gives strips for the first and strips + "+N more" for the second; done subtasks shown as done; the smallest text size reported still includes the strips; the picture itself is looked at by the user (not seen until then).
- Depends on: nothing.

### Phase 5 — Subtasks open by default on the map
- Files: `src/planning/blocks.ts` (the `expanded` set starts with every parent that has subtasks, instead of empty; the "▸ 2/3" toggle still closes one; remembered across redraws as now), `src/planning/plan-map-render.ts` (`subsList` `:497`, `:539`), the room the open lists need under cards (`SUB_LINE_H`, `:40`, `:527`), `styles.css` (`.vt-map-subs`), tests `plan-map-render.test.ts`, `planning-plan-map.test.ts`.
- Do: a parent with subtasks shows its list on first draw. Check the layout: the lists float under their card (z-index), so on a dense map an open list may cover the card below: reserve the room in the layout (rows level with parents are packed by `layoutPlan`) or document the limit; say what was measured.
- Done when: tests that all parents start open and a closed one stays closed after a redraw; layout test that no open list overlaps a card in a fixture with 3 parents of 4 subtasks each; the user tries it on a dense map (checklist 6i row; not seen until then).
- Depends on: nothing (touches the same files as Phases 2-3: do it after them).

## Order check
1 and 4 are independent; 2 before 3. Suggested order 1 → 2 → 3 → 5 → 4 (the user's biggest pains first would be 2, 3: say if they want those first).

## Verification
- Tests as listed; the user tries each on a dense map in `test-vault` (checklist 6i rows added per phase). Touch behaviour of the + buttons is not verifiable here (explorer: not verified on a phone).
