# Plan: map from 2 to-dos, and insert a to-do between two on the map

## Context
User, 2026-10-13. (1) A project hub shows the plan map only once something is linked (`hasPlan`, `src/planning/plan.ts:163`); they want it from **2 to-dos**, with `after` set on the map itself (survey: all of the project's to-dos count; the Plan list tile keeps today's rule). (2) "A way to insert a to-do between two existing tasks": hover an arrow, a **+** appears; **dragging the + onto a to-do puts it between the two** (their idea, adopted). Both build on the Phase 1-8 work in `docs/plans/plan-map-drag-subtask.md`. One branch `feat/map-insert` from `main`; two phases, one per session (Sonnet).

## Phase 1: the map from 2 to-dos (small)
- `src/planning/plan.ts`: `hasMap(plan) = hasPlan(plan) || plan.rows.length >= 2` (rows = this project's to-dos, done included); comment why the list tile keeps `hasPlan`.
- `src/planning/blocks.ts:340` (`project-map`) uses `hasMap`; `project-plan` (`:325`) unchanged.
- The map already draws unlinked to-dos as **Not linked** tiles with the link handle and "+ add after this" (`plan-map.ts:54`, `plan-map-render.ts:460`), so `after` is set on the map already; nothing else to build.
- Tests (`tests/planning-plan.test.ts`): `hasMap` true for 2 unlinked, false for 0 / 1; `hasPlan` stays false for 2 unlinked (`:86`, `:208` untouched).
- Docs: `docs/tutorial.md:342`, `kits/planning/07 How-tos/Obsidian/Vault spec.md:116` ("same condition as the Plan list") then `npm run kit:manifest`, changelog Unreleased, checklist row, BACKLOG, STATUS.

## Phase 2: insert between two (depends on nothing in Phase 1)
Behaviour. On an arrow A → B (a link between two cards; not the dashed subtask `via` arrows):
- hovering it shows a small **+** at its middle (desktop). **Drag the +** onto a to-do (a card or a Not linked tile) N: N now sits between: `N.after` gets A; `B.after` loses A and gets N. A + dropped on the "+ add new here" box (same box as "+ add after this") or simply **clicked** opens the picker (search the vault, or type a name to make a new one) and does the same with that to-do. The arrow's existing click menu (`plan-map-render.ts:403-411`, "Remove link") gets **"Insert a to-do here…"** for phones, which have no hover.
- One Undo step (the two writes share a history `group`, as "+ add after this" does for a moved to-do, `add-after.ts:44`).
- Refused with a notice, like links today: N is A or B; a loop (use `canLink` both ways: `canLink(plan, A, N)` and `canLink(plan, N, B)`; "already" on either side is fine, that write is skipped); N is a subtask or has the project problems `nestAction` / `canLink` already catch. A to-do from another project asks "Move it here?" exactly as `addAfterFlow` does.

Code.
- `src/planning/plan-link.ts` (pure): `canInsert(plan, a, b, n)` → "ok" | "self" | "loop" | "not-linked" (A → B must exist), built on `canLink`; `insertWrites(...)` is not needed: the two edits are `addAfter(value, linkN)` on N and `removeAfter(value, namesOf(A))` then `addAfter(value, linkN)` on B (existing helpers).
- `src/planning/add-after.ts`: `addAfterFlow(env, from, before?)`: with `before` set, after writing N after `from` also rewires `before`; new to-do (`createAfter`) takes `before` too. Undo: both steps in one `group`.
- `src/planning/plan-map.ts:192` (`mapGeometry` curves): each `MapCurve` gets its midpoint `mid` (needed to place the +).
- `src/planning/plan-map-render.ts`: generalise `dragLink` (`:124-185`) so one handle routine serves both: a mode `{ from, onDrop(to), onBox() }` (link: `canLink` + `link`; insert: `canInsert` + `insert`); add the hover **+** next to each arrow's hit path (`:399-412`), and the menu item. No new DOM rules except `.vt-map-insert` (hidden until the arrow is hovered, in `styles.css` per "Where CSS goes"; no `:has`, `display: contents`, `text-indent`).
- Tests: `tests/planning-link.test.ts` for `canInsert` (A→B exists, N is A/B, loop through B's descendants, N already after A); a stub-vault test that the writes give `N.after = [A]`, `B.after = [N]` and that undo restores both (pattern of the existing `recordChange` tests).

## Not touched
Plan list tile rule, `readPlan`, the subtask drag (`dragNest`), tick rules, to-do template, Tidy, version fields.

## Verification
`npm test`, `npm run lint` (0 errors, the 3 known warnings), `npm run build`. Not seen in Obsidian until the user tries (checklist rows): 2 unlinked to-dos show the map with Not linked tiles; link them by dragging; hover an arrow, drag the + onto a to-do and onto the new box; click the + and the menu item; Undo restores both; phone: the menu item. The store check is re-run at release.
