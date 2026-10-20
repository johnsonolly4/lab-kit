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
**BUILT 2026-10-20 (Phase 1, Sonnet 5.5; unit tests, PNG of the made-up RAFT project looked at; not seen in Obsidian, not by the owner).** `PlanRow.waiting`, `statusOf` / `statusLines` / `openBefore` / `daysUntil`, `SlideOptions.today`, `SlideModel.all`; the window passes today. Colours: late `#b3124f`, waiting `#c77700` (the research session's pair; owner still to confirm by eye). Fixtures `tests/fixtures/plan-raft.ts` (16 to-dos) and `tests/fixtures/plan-big.ts` (the made-up 59 to-dos; known answers hold: 35 done, 2 late, 2 waiting, 5 can start, 15 wait). Tests `tests/plan-slide-status.test.ts`.
- Files: `src/planning/plan.ts` (add `waiting: string` to `PlanRow`, filled from `waitingOf`), `src/planning/plan-slide.ts` (`SlideOptions.today: string` as YYYY-MM-DD; `statusOf(row, today)` → `done | late | waiting | ready | blocked`; `statusLines(row, plan, today)`: `late: due 15 Oct`, `waiting: <text>`, `after <open to-dos it comes after>`, `due 23 Oct (in 3 d)` when 3 days or less; red / amber border colours as constants; the card's lines after the title take the free room, and status comes before priority / subtasks / result), `src/planning/plan-slide-ui.ts` (passes `ymd(new Date())`), `tests/plan-slide.test.ts`, the `PlanRow` fixtures in other tests if the type needs it.
- Done when: tests below pass; `python3 scripts/check.py` passes; one SVG of the example project (as in `my_work/mockups/plan-map-export-src/gen.ts`) turned into a PNG with `qlmanage` and looked at.
- Tests: a to-do with `due` before `today` and open is late (red, "late: due …"); done with a past due is not late; `waiting` set and not done shows "waiting: …" (late and waiting both show); a blocked card lists only the open to-dos it comes after; due in 2 days is amber, in 10 days muted; `today` missing gives today's behaviour (no late marks); escapes still hold for the new text.
- New dependencies: none.

### Phase 2: header, progress and key
**BUILT 2026-10-20 (Phase 2, Sonnet 5.5; unit tests, PNG looked at; not seen in Obsidian, not by the owner).** Top right "as of Tue 20 Oct 2026" and "N of M done" with a bar (top-level to-dos only); key at the bottom (22 px text, only the marks that appear; the middle area shrinks by its height); Later / Not linked tiles get "late" / "waiting" / "2/4" and a red outline when late. `minText` stays at 22 or more for the compact picture of the RAFT project.
- Depends on: Phase 1.
- Files: `src/planning/plan-slide.ts` (top right "as of Tue 20 Oct 2026"; "N of M done" counts top-level to-dos only, with a bar; a one-line key at the bottom (done, can start, waits for an earlier step, late, waiting on someone), shown only for marks that appear in the picture; Later / Not linked tiles get "late" / "waiting" tags and "2/4"; the room for the key is taken off the middle area so `minText` stays right), `tests/plan-slide.test.ts`.
- Done when: tests pass (header text present; N of M counts parents only; the key lists only the marks used; `minText` still falls as columns grow; nothing overlaps the key, checked by y positions); PNG looked at, compact and whole.

## Big projects: the open-work picture ("M1", Phases M1-1 to M1-5)
_Planned 2026-10-20 (Sonnet 5.5 session; the fold rule in M1-2 is the one design step: see "Model" at the end of this section). Research: `docs/plans/plan-map-big-project-examples.md`; looks: `my_work/mockups/plan-map-big-project-mockups.html` section M1 (prototype, `gen-big.ts`)._

**In plain words.** A small project keeps today's picture (option A). When option A would have to print its smallest text under 22 px (`tooSmall`), the picture switches by itself to M1: only the **open** to-dos, each a name chip, steps top to bottom, real arrows between them. Finished work is only the header ("35 of 59 done" bar). Parked, not planned here: streams, hub print, Home block, dashboards (M2/M3/M4).

**Decided by the owner (2026-10-20; do not re-ask).** Option A for small projects; M1 for a big one; open to-dos only; status computed from the **whole** plan, then filtered (a finished blocker never makes a chip look blocked); late wins over waiting; colours late `#b3124f`, waiting `#c77700` (owner still confirms by eye); no corner dot; header with as-of date, "N of M done" bar and a one-line key; loose (not linked) to-dos in one row, most urgent first, then a "+N more not linked (late, waiting counts)" chip; a second line (experiment name · Status) only on late / waiting / can-start chips; subtasks in full under OPEN chips only, at most 4 lines then "+N more", 22 px, done ones ticked and struck; every text 22 px or more; on a phone the picture stays readable size and scrolls; the block is view-only; the notes stay the source of truth.

**Known answers** (made-up 59 to-do project, today 2026-10-20; reported by the research page `plan-map-big-project-examples.md` point 11, to be confirmed by the fixture test in M1-1): 24 open parents; 21 linked in 9 steps by 6 places, 3 loose; by displayed status late 2, waiting 2, can start 5, later 15 (sum 24; "Book GPC time for diblocks" is late and waiting, shows as late); 35 of 59 done. With 30 extra loose to-dos the loose row shows 5 chips and "+28 more not linked" (prototype figure, may change with the real cap rule). The known answers for the folded picture (how many steps are drawn) are **not known yet**: M1-2 measures them and writes them here.

**Why the fold rule is needed (derived, not yet measured).** Subtask strips (up to 4 lines of 22 px) and the second line make a step row taller than the prototype's 64 px chip, so the 9 steps of the test project very likely no longer fit in 1080 px, and 6 places already give chips 259 px wide (about 17 characters a line). Two limits, both from the 22 px rule: **width** (most places across) and **height** (steps down).

**Order check.** M1-1 needs Phase 1 (`PlanRow.waiting`, `statusOf`); M1-4 needs Phase 2 (header, key); M1-5 comes before old Phase 3 (the block uses the same picture function). M1-1 → M1-2 → M1-3 → M1-4 → M1-5; none can run before the one above it.

### Phase M1-1: the open-work model (pure, no drawing)
- Depends on: Phase 1.
- Files: new `src/planning/plan-open.ts`; new fixture `tests/fixtures/plan-big.ts` (the 59 made-up to-dos from `my_work/mockups/plan-map-export-src/gen-large.ts` as `PlanRow` data, made-up names only); new `tests/plan-open.test.ts`.
- What: `openModel(plan, today)` → `{ chips, arrows, loose, counts }`. Steps: `statusOf` on **every** row of the whole plan; then keep open parents only (subtasks hang under their parent; not chips); then `layoutPlan` on the open rows only so steps count open work (the prototype's way). Status of a chip: late > waiting > can start > waits for an earlier step. Loose list sorted by urgency (late, waiting, can start, then name). Second-line text per chip (only late / waiting / can start): `experiment.name · Status`, cut with "…". `counts`: open, drawn, late, waiting, canStart, later, done, total.
- Done when: `python3 scripts/check.py` passes; tests assert the known answers above (24 open, 21 linked, 9 steps, 6 places, 3 loose, 2/2/5/15, 35 of 59); a to-do whose only blocker is finished shows "can start", not "later"; a late and waiting to-do is late; totals add up (drawn + counted = open); a subtask never becomes a chip; no real names in the fixture.
- New dependencies: none.

### Phase M1-2: sizes, cap and fold rules (pure; the design step)
- Depends on: M1-1.
- Files: `src/planning/plan-open.ts` (add `chipSize`, `foldOpen`, `chooseLayout`), `tests/plan-open.test.ts`.
- What: chip width from the number of places (cap **6**, at least 17 characters a line), chip height from its content (name up to 2 lines, the second line, subtask lines up to 4 then "+N more", all 22 px; the row is as tall as its tallest chip). `foldOpen(model, budget)` where the budget is the picture height minus header, key and loose row. Rule (owner answered all five as recommended, 2026-10-20: Q1 a, Q2 a, Q3 a fixed 1920 × 1080, Q4 a automatic only, Q5 a second line unchanged; recorded in `docs/decisions.md` as owner board 5, 18-22): steps are drawn from the top while they fit; the rest become **one count row** "+N more steps: k late, w waiting" (the first step, the can-start ones, is always drawn); a step with more than 6 places keeps the 5 most urgent and ends with a "+N more in this step" chip. Arrows from a drawn chip into folded work end at the count row (one per chip). The loose row: chips as many as fit in one line, then the count chip. `chooseLayout(map, ahead = DEFAULT_AHEAD)` returns `"full-map"` while `slideSvg(...compact).tooSmall` is false, else `"open-work"`; a small project that is all open stays on option A.
- Done when: check passes; tests: every number the rule returns still adds up (drawn + counted = open, for the loose row and the folded steps); no chip is under 17 characters wide; no drawn text size under 22 (`MIN_READABLE`); the fixture gives `"open-work"` and a 6-card project gives `"full-map"`; subtasks make rows taller so a project with subtasks folds earlier than the same project without them; the measured number of drawn steps for the fixture (with and without subtasks) is written into "Known answers" above.
- New dependencies: none.

### Phase M1-3: geometry and the arrow router for chips
- Depends on: M1-2.
- Files: `src/planning/plan-map.ts` (`mapGeometry` gets an optional sizes argument: chip width, each chip's own height, gaps; the default stays `CARD_W` × `CARD_H`, so the on-screen map and option A do not change; `hitsCard` and `lane` use the given sizes; read with `python3 scripts/codemap.py src/planning/plan-map.ts` first), `tests/planning-plan-map.test.ts`.
- What: steps run top to bottom (`direction: "down"`, already there), places across; a row is as tall as its tallest chip (the `room` mechanism for the strip under a card is the model). The router sends a skipping arrow through a lane between places, never across a chip; an arrow into the count row ends at its top edge.
- Done when: check passes; the on-screen map tests are unchanged and still pass (byte-equal geometry for the old sizes); on the fixture no sampled point of any arrow lies inside a chip it does not start or end at, including "GPC of diblocks" → "Scale up diblock to 5 g"; two routed arrows do not share a lane line.
- New dependencies: none.

### Phase M1-4: draw the open-work picture
- Depends on: M1-3 and Phase 2.
- Files: `src/planning/plan-slide.ts` (`openSvg(model, opts)` → `SlidePicture` with `minText` always ≥ 22 by construction; header and key shared with option A from Phase 2; chip drawing: border colour by status, dashed for "waits for an earlier step", no corner dot, status word on the second line where it fits; subtask strip with ✓ struck / ○; loose row; count row), `tests/plan-slide.test.ts`.
- Done when: check passes; tests: `minText` is 22 or more for the fixture, the fixture with 30 extra loose to-dos, one chip with 12 subtasks and one with a 120-character name; texts are escaped; the key lists only the marks used and shows the words "late" and "waiting" (colour is not the only carrier); nothing overlaps (y positions); a late-and-waiting chip is drawn late. By eye: a PNG of the fixture (`qlmanage`) shown on a feedback page (`my_work/agent_kit/render_check.py feedback`) with the two colour pairs side by side so the owner can confirm late `#b3124f` / waiting `#c77700`.
- New dependencies: none.

### Phase M1-5: switch-over and the window
- Depends on: M1-4.
- Files: `src/planning/plan-slide.ts` (one function `pictureFor(map, choice, today, opts)` that picks option A or M1 through `chooseLayout`; the block in old Phase 3 calls the same function), `src/planning/plan-slide-ui.ts` (the window uses it; a one-line note under the preview "Open work only: 21 of 59 to-dos (project too big for the full map)"; `readableNote` stays for option A), `tests/plan-slide-ui.test.ts`.
- Done when: check passes; tests: small project → option A, big → M1, the note text for each, copying a PNG works for both (the PNG path is the existing `copyPng`); window opened by hand in `obsidian-check` on the fixture vault: preview shows M1, no console errors. No manual switch to force either picture (Q4 a).
- New dependencies: none.

**Phone (belongs to old Phase 3, the block).** The block shows the picture at its natural size (22 px text = 22 CSS px) in a box that scrolls sideways and down, no list fallback (owner). Not seen on a phone until the owner tries it.

**Model.** M1-1, M1-3, M1-4, M1-5 are fully specified: Sonnet. **M1-2 is a design step** (the fold and cap rule, how rows grow with subtasks): the rule above is now decided by the owner, but getting the numbers right is easy to get subtly wrong. Recommend running M1-2 on **Opus**; Sonnet is enough once the rule is fixed by tests written first.

### Phase 3: the view-only block `show: plan-picture`
- Depends on: Phase 2 and M1-5 (the block draws whatever `pictureFor` returns, so a big project shows M1 in the block too). Owner answered Q1 "both" (board 2): the window and the block.
- Files: `src/planning/blocks.ts` (new case: the project is the note's own hub, or `project: [[Hub]]` on a line of the block; it reads the plan as `project-map` does, draws an `<img>` from a blob URL of `slideSvg`, and revokes the URL on redraw and unload; the title row has "Plan: <project>", the "as of" time and, behind `hasNode()`, Copy picture and the picture-window button; phone: picture only, at readable size in a box that scrolls (M1 section); add the name to the `:481` list), `src/planning/plan-slide-ui.ts` (export `copyPng`), `styles.css` (`.lab-kit-plan-picture` from `.lab-kit-slide-preview`, corners with `--lk-radius-control`), `src/planning/freeze.ts` + `tests/planning-freeze.test.ts` (Q5 a: a frozen meeting note gets a plain list `- [[To-do]] · late: due 15 Oct` … instead of the block), `tests/planning-hub-blocks.test.ts` (or a pure helper test for the `project:` line).
- Done when: `python3 scripts/check.py --build` passes; `obsidian-check` shows the block in a hub and a meeting note, it redraws after a to-do is ticked, there are no console errors, and the phone emulation shows no Copy button; it stays "not seen by the owner" in BACKLOG.

### Phase 4: docs and checklist
- Depends on: Phase 3 (or Phase 2 if there is no block).
- Files: `docs/changelog.md`, `docs/tutorial.md` 8.4, `docs/architecture.md`, `docs/obsidian-test-checklist.md` (rows: status marks, block, frozen note, copy), `Vault spec.md` / `How my vault works.md` card list if the block is added, README Mobile line (picture on phone, copy desktop only), BACKLOG item.
- Done when: `docs/maintenance.md` steps done; check passes.

Order check: 1 → 2 → 3 → 4. Phase 3 needs the finished picture from 2. Phase 1 changes `PlanRow`, which the on-screen map also uses (it only adds a field, so the map does not change).
If the owner picks **Q2 B (columns)** or **C (both)**: one more phase between 2 and 3, a `{ kind: "columns" }` layout in `slideModel` / `slideSvg` with "+N more" per column and a third entry in the window's Layout list.

## Large projects (research 2026-10-20; not planned yet)
For a big project (the 59 to-do test on `my_work/mockups/plan-map-export-mature.html`) the compact picture shrinks to 12.3 px text (limit 22 px), and fewer steps do not fix it. Research: `docs/plans/plan-map-large-graph-research.md`; looks: `my_work/mockups/plan-map-large-options.html`. Recommended there (nothing decided): (1) an "open work only" picture (Late / Waiting / Can start / Next, the rest as one count line) used when option A would be too small, no new data; (2) a workstream rollup (needs a workstream on each to-do); (3) a rollup plus one slide per workstream. Question: BACKLOG "Questions for the owner", item "Plan map, large projects". **Chosen 2026-10-20: the open-work picture M1 (not the Late / Waiting columns of that research); its phases M1-1 to M1-5 are above, after Phase 2.**

## Verification
- Known answer: the example project in `my_work/mockups/plan-map-export-src/gen.ts` with today = 2026-10-20 must give Book GPC time = late + waiting, Run RAFT screen = can start, due in 3 d, 2/4 subtasks, GPC analysis = after Run RAFT screen, Book GPC time, and 4 of 12 done. Make it a test fixture in Phase 1.
- By eye without Obsidian: SVG → PNG with `qlmanage` each phase.
- Only the owner can check: the picture pasted in a real slide, and the block in their meeting notes. These stay "not seen by the owner" until reported.
