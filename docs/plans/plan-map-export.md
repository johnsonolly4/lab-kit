# Plan: plan map export that shows the current status (view-only)

**PLAN WAITING FOR OWNER (2026-10-20).** Nothing is built. The open choices are in BACKLOG "Questions for the owner", item "Plan map export", and the looks are on `my_work/mockups/plan-map-export-options.html`. The phases below follow the **recommended** answers. If the owner picks otherwise, a planning session updates this file before Phase 1 starts. Research: `docs/plans/plan-map-export-research.md`. Earlier plan for the picture: `docs/plans/plan-map-zoom-export.md` (done).

_Written with `/phase-plan` on 2026-10-20 (Opus). Not agreed yet. Each phase = one Sonnet session._

## Goal
The plan picture shows where a project stands today (done, can start, waits for an earlier step, late, waiting on someone, subtasks, links, an "as of" date and progress). It can be shown as a view-only block in any note that is always current, and it can still be copied as a PNG for a slide.

## Decision taken
None yet. The recommendation (Q1 b, Q2 A, Q3 a, Q4 a, Q5 a, Q6 a) is: one pure engine (`plan-slide.ts`) for both the window and a new `show: plan-picture` block, with today's compact layout plus status lines, a key and a header.
The rejected options and their reasons are in the research file: a Gantt / timeline (to-dos have no start or length), an "on track" verdict (not computed from data), and saving PNGs in the vault (the 2026-10-13 decision says nothing is saved).

## How it works today (read before building)
- `src/planning/plan.ts:6-31` `PlanRow`; `:142` builds `blocked` and reads `waitingOf(t.fm)` (`src/planning/todo.ts:167`) but does not keep it.
- `src/planning/plan-slide.ts` (191 lines, pure): `slideModel` (`:22`), `cardSvg` (`:106`), `tilesSvg` (`:129`), `slideSvg` (`:143`). Its constants are at `:56-63`. `minText` / `MIN_READABLE` (22) is the readability check.
- `src/planning/plan-slide-ui.ts` (90 lines): the window, preview `<img>` with a blob URL, `copyPng` (`:22`, not exported).
- `src/planning/blocks.ts:378-420` is the `project-map` case and the picture button (`hasNode()`). Blocks redraw on `metadataCache` "changed" (`:43-44`, debounced 500 ms). Unknown `show:` names are listed at `:481`.
- Late: `overdue` in `src/planning/lists.ts:23` (due before today by `ymd`); the waiting badge text is `waiting: <text>` (`lists.ts:28`).
- Freeze: `src/planning/freeze.ts:13` `BLOCKS` names the blocks a meeting freeze turns into lists.
- Plugin rules: `.claude/rules/obsidian-plugin.md` (no `innerHTML`, no inline styles, `--lk-radius-*` for corners, desktop-only APIs behind `hasNode()`).

## Out of scope
- A Gantt / timeline layout, an "on track" health value, dark pictures, saving the picture as a file, remembering choices in settings (BACKLOG "Customise the slide picture export" stays open for those).
- Changing the on-screen plan map.
- Adding the block to the kit templates (hub, meeting). That is a kit change, to be asked once the block is seen.

## Phases

### Phase 1: status on every card (pure)
- Files: `src/planning/plan.ts` (add `waiting: string` to `PlanRow`, filled from `waitingOf`), `src/planning/plan-slide.ts` (`SlideOptions.today: string` as YYYY-MM-DD; `statusOf(row, today)` → `done | late | waiting | ready | blocked`; `statusLines(row, plan, today)`: `late: due 15 Oct`, `waiting: <text>`, `after <open to-dos it comes after>`, `due 23 Oct (in 3 d)` when 3 days or less; red / amber border colours as constants; the card's lines after the title take the free room, and status comes before priority / subtasks / result), `src/planning/plan-slide-ui.ts` (passes `ymd(new Date())`), `tests/plan-slide.test.ts`, the `PlanRow` fixtures in other tests if the type needs it.
- Done when: tests below pass; `python3 scripts/check.py` passes; one SVG of the example project (as in `my_work/mockups/plan-map-export-src/gen.ts`) turned into a PNG with `qlmanage` and looked at.
- Tests: a to-do with `due` before `today` and open is late (red, "late: due …"); done with a past due is not late; `waiting` set and not done shows "waiting: …" (late and waiting both show); a blocked card lists only the open to-dos it comes after; due in 2 days is amber, in 10 days muted; `today` missing gives today's behaviour (no late marks); escapes still hold for the new text.
- New dependencies: none.

### Phase 2: header, progress and key
- Depends on: Phase 1.
- Files: `src/planning/plan-slide.ts` (top right "as of Tue 20 Oct 2026"; "N of M done" counts top-level to-dos only, with a bar; a one-line key at the bottom (done, can start, waits for an earlier step, late, waiting on someone), shown only for marks that appear in the picture; Later / Not linked tiles get "late" / "waiting" tags and "2/4"; the room for the key is taken off the middle area so `minText` stays right), `tests/plan-slide.test.ts`.
- Done when: tests pass (header text present; N of M counts parents only; the key lists only the marks used; `minText` still falls as columns grow; nothing overlaps the key, checked by y positions); PNG looked at, compact and whole.

### Phase 3: the view-only block `show: plan-picture`
- Depends on: Phase 2. Only if the owner picks Q1 (b) or (c).
- Files: `src/planning/blocks.ts` (new case: the project is the note's own hub, or `project: [[Hub]]` on a line of the block; it reads the plan as `project-map` does, draws an `<img>` from a blob URL of `slideSvg`, and revokes the URL on redraw and unload; the title row has "Plan: <project>", the "as of" time and, behind `hasNode()`, Copy picture and the picture-window button; phone: picture only; add the name to the `:481` list), `src/planning/plan-slide-ui.ts` (export `copyPng`), `styles.css` (`.lab-kit-plan-picture` from `.lab-kit-slide-preview`, corners with `--lk-radius-control`), `src/planning/freeze.ts` + `tests/planning-freeze.test.ts` (Q5 a: a frozen meeting note gets a plain list `- [[To-do]] · late: due 15 Oct` … instead of the block), `tests/planning-hub-blocks.test.ts` (or a pure helper test for the `project:` line).
- Done when: `python3 scripts/check.py --build` passes; `obsidian-check` shows the block in a hub and a meeting note, it redraws after a to-do is ticked, there are no console errors, and the phone emulation shows no Copy button; it stays "not seen by the owner" in BACKLOG.

### Phase 4: docs and checklist
- Depends on: Phase 3 (or Phase 2 if there is no block).
- Files: `docs/changelog.md`, `docs/tutorial.md` 8.4, `docs/architecture.md`, `docs/obsidian-test-checklist.md` (rows: status marks, block, frozen note, copy), `Vault spec.md` / `How my vault works.md` card list if the block is added, README Mobile line (picture on phone, copy desktop only), BACKLOG item.
- Done when: `docs/maintenance.md` steps done; check passes.

Order check: 1 → 2 → 3 → 4. Phase 3 needs the finished picture from 2. Phase 1 changes `PlanRow`, which the on-screen map also uses (it only adds a field, so the map does not change).
If the owner picks **Q2 B (columns)** or **C (both)**: one more phase between 2 and 3, a `{ kind: "columns" }` layout in `slideModel` / `slideSvg` with "+N more" per column and a third entry in the window's Layout list.

## Large projects (research 2026-10-20; not planned yet)
For a big project (the 59 to-do test on `my_work/mockups/plan-map-export-mature.html`) the compact picture shrinks to 12.3 px text (limit 22 px), and fewer steps do not fix it. Research: `docs/plans/plan-map-large-graph-research.md`; looks: `my_work/mockups/plan-map-large-options.html`. Recommended there (nothing decided): (1) an "open work only" picture (Late / Waiting / Can start / Next, the rest as one count line) used when option A would be too small, no new data; (2) a workstream rollup (needs a workstream on each to-do); (3) a rollup plus one slide per workstream. Question: BACKLOG "Questions for the owner", item "Plan map, large projects". If the owner picks one, a planning session adds its phase after Phase 2 here.

## Verification
- Known answer: the example project in `my_work/mockups/plan-map-export-src/gen.ts` with today = 2026-10-20 must give Book GPC time = late + waiting, Run RAFT screen = can start, due in 3 d, 2/4 subtasks, GPC analysis = after Run RAFT screen, Book GPC time, and 4 of 12 done. Make it a test fixture in Phase 1.
- By eye without Obsidian: SVG → PNG with `qlmanage` each phase.
- Only the owner can check: the picture pasted in a real slide, and the block in their meeting notes. These stay "not seen by the owner" until reported.
