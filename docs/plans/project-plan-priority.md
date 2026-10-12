# Plan: Project plan, Priority and project tile for to-dos

_Agreed: 2026-10-12 (survey answers; project-tile placement chosen from the user's board screenshot). Written by `/phase-plan`. Each phase = one session._

## Goal
To-dos get a Priority, a project tile on the board card, and (for to-dos in a project) `after` / `result` / `order`, so the project hub shows an overall plan: a Plan tile and a card map (cards joined by arrows; re-planned 2026-10-12, was a Mermaid `plan` block).

## Decision taken
- **Priority:** number 1, 2, 3 (1 = highest), empty = none (user, 2026-10-12, after the Bases sort test; text sorted alphabetically). New to-do asks it with one pick, "(none)" first.
- **Priority in the project lists (user, 2026-10-12, plan check):** overdue → day → priority → name. Today's order is kept (`src/planning/lists.ts:160-166`: overdue, then Mon → Fri → Backlog, then path); priority only breaks ties within a day, empty last. The due date itself is not a sort key (only "overdue" is), so the earlier wording "due date first, priority breaks ties" is replaced by this.
- **Project tile on cards:** plain text under the title, truncated; must not clash with the countdown (`::after` on the card, `vault-theme.css:341`). Screenshot seen 2026-10-12: put it on its own line under the title, left, clear of the bottom-right badge; with a 2-line title it must not run under the badge (truncate to one line).
- **Plan properties:** optional `after` (links, several), `result` (one line), `order` (number). NOT asked at capture. Order is changed by editing, no drag.
- **Blocked:** shown only in the Plan tile and the `plan` block (a row whose `after` to-dos are not all done). The board and `day` are never changed automatically. Supersedes the BACKLOG idea of blocked = Backlog.
- Rejected: Priority before due date; number priority; a third card badge for blocked; auto-moving cards.

## Re-plan 2026-10-12 (Opus, with the user in chat; replaces Phases 3 and 4 below)
- **Plan tile (Phase 3a):** next steps first: open to-dos that are ready (nothing before them left open), then blocked ones marked "after X"; finished rows with their `result` behind Show all. At the top of the hub, under the hub bar; nothing is drawn when the project has no plan.
- **Capture (Phase 3b):** a to-do made for a project asks **Comes after?**: one pick of that project's open to-dos, "(nothing)" first, skipped when the project has none. One choice only (Templater's suggester is single-pick; no multi-pick box exists in `src/` or `kits/`); a second parent is typed by hand. `order` is not asked; `result` waits for Phase 5. This reverses "NOT asked at capture" above for `after` only.
- **Diagram (Phase 4): our own card map, not Mermaid and not Canvas.** Cards in the board's look (title, due, priority, result, done / blocked) joined by arrows, steps left to right, drawn inside the hub. Click opens the to-do. A link is made by dragging from one card to another (writes `after`), removed by clicking the arrow; loops are refused. No new library.
- **Card positions are not saved** (user: "works for me, as proof of concept"): the layout is always automatic by step; dragging only makes links. Saved positions are out of scope until the map has been used.
- **Scroll (user):** the map scrolls sideways and opens at the next to-do; finished steps are off to the left, steps still to do on the right. The user wrote "unfinished to the left"; read as "finished to the left" (said back in chat, not yet confirmed).
- **Looked at and dropped** (plugin pages only, 2026-10-12; none installed or seen in Obsidian):
  - Canvas: plain Obsidian shows only the shapes of an embedded canvas, not card text (Obsidian help); nothing found shows a note's properties on a file card, so to-do cards would be near-empty; needs our own layout and a rewrite on every change.
  - Base Graph: reads links from a chosen property and embeds as a Bases view, but the user looked at it and it draws a dot graph, not cards with details.
  - Advanced Canvas (edges from a property, no auto layout), Tasks Map (cards + arrows, but needs Dataview and Tasks, `tags: [task]` and its own `blockedBy` / `dependsOn` keys).
  - Swapping the planning core for Tasks or TaskNotes: no. Tasks is checkbox lines, with no board and no dependency picture. TaskNotes has the same one-note-per-task model on Bases, but a swap costs a second plugin for every user and a migration, and it has no dependency picture either. Trying TaskNotes alongside (calendar, agenda) is a BACKLOG item.

## Additions 2026-10-12 (Opus, with the user, survey; nothing built)
- **`after` stays** as it is (a link or a list of links, written in the later to-do only). A link is never written into both notes: two copies can disagree.
- **Subtasks:** a new property `sub` on the child to-do, naming its parent (`sub: [[Parent to-do]]`). The parent's subtasks are worked out, never written. Phase 4e.
- **No inferred dates.** The plan only reports when two dates the user typed disagree: an open to-do whose `due` is earlier than the `due` of a to-do it comes after (Phase 4a).
- **Card map extras:** to-dos with no links stay off the map, in a list beside it (4a, 4b); hovering a card marks everything before and after it (4a, 4b); a right-click menu on a map card: Open, Open in new tab, Mark done (4b; this replaces "tick done on a card: later, only if asked").
- **Linking (4c):** the new arrow shows at once and is removed with a notice if the write fails; the notice after a link or an unlink has Undo.
- **List to sequence:** a command that writes `after` down a list of to-dos. Phase 4d.
- **Print layout of the map:** not planned; after 4b is seen, together with the rig PDF question (BACKLOG "NEXT TASK").
- **Rules for all plan output:**
  1. Report what cannot be worked out; invent nothing. Every to-do is still listed when a link is missing or loops (as `readPlan` does with `problems`).
  2. Every view reads the same notes. The Plan tile, the card map and the lists all come from the to-dos' properties through `readPlan`; no view keeps data of its own.
- To BACKLOG ("Project plan from to-dos"): pass links on when a to-do is deleted, longest open chain, milestones, other link types, `show: project-map` in any note, print layout, keyboard movement on the map. To BACKLOG ("To-dos: ideas"): one-phrase capture, own statuses and priorities, repeating to-dos.
- Dropped: a group box per project (the map is one project); column limits and swimlanes (the board is Obsidian's Bases kanban, not ours); passing links on when a to-do is finished (a finished to-do already unblocks what comes after it and keeps its `result` in the plan); saved filter presets (Bases views and `vault-card` blocks already do this).

## Out of scope
- Saved card positions, free rearranging of cards, a Mermaid `plan` block, a Canvas file.
- Inferred or suggested dates, durations, a true critical path.
- Priority colours on the board (revisit after Phase 1 is seen).
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

### Phase 3a — Plan tile on the project hub
- Depends on: Phase 2. Model: Sonnet (fully specified).
- `src/planning/plan.ts`: `hasPlan(plan)` (true when any of the project's to-dos has `after` or `order` set) and `planLines(plan)` giving `ListLine[]` (`src/planning/lists.ts:10`) in tile order: ready open rows in plan order, then blocked rows with a muted "after X" badge, then finished rows with "→ result". Also the count of finished rows, so the block can hide them until Show all.
- `src/planning/blocks.ts`: `case "project-plan"` next to `project-todos` (`:244`). Draws nothing at all when `hasPlan` is false (today every card leaves at least a muted line, `:119`, so this is new behaviour: an empty box with no heading). Otherwise its own heading "Plan", the lines through `list()` (`:118`), the Show all toggle (`toggle()`, `:86`) for finished rows and anything over `PROJECT_TILE_ROWS`, and `plan.problems` as muted lines under the list. Add `project-plan` to the "Unknown card" text (`:308`).
- `kits/planning/Extras/Templates/Project hub.md`: a `vault-card` block with `show: project-plan` after the hub bar (`:21-23`), above Goal (`:25`). Bare, not in a callout (a callout title would show on a project without a plan).
- `kits/planning/.obsidian/snippets/vault-theme.css:261`: the toggle is placed by a `.callout` parent; add the same placing for the bare Plan tile.
- Existing hubs: the opt-in Tidy rule `hub-body` (`src/kit/tidy.ts:359-378`) rewrites a hub from the template, so it should offer the new block with no new rule. Check with a test in `tests/tidy-hubs.test.ts`; if it does not, say so and stop (do not write a new rule unasked).
- Tests: `tests/planning-plan.test.ts` (`hasPlan`; line order ready → blocked → finished; badges; a project with no `after` / `order` gives no plan), `tests/planning-hub-blocks.test.ts` (template carries `show: project-plan` between the bar and Goal). The block's DOM has no test (none of `blocks.ts` has).
- Docs: changelog, checklist 6i row, Vault spec / How my vault works (the hub's parts), `npm run kit:manifest`.
- Done when: tests and lint pass; tests only until the user opens a hub with and without a plan.

- **Phase 3a result (2026-10-12, tests only, not seen in Obsidian):** as specified. `hasPlan` also counts `plan.problems` (a to-do whose only `after` is a missing link gives `after: []`, so without it the message would never show). The tile is a bare `vault-card` given the class `vt-plan` (CSS in `vault-theme.css` copies the `.vt-card` look; the Show all button reuses `.vt-tile-toggle`). Show all ("Hide finished" when open) reveals finished rows and rows over `PROJECT_TILE_ROWS`. The `hub-body` Tidy rule picks the block up with no change (test in `tests/tidy-hubs.test.ts`). Known gaps are in BACKLOG "Project plan from to-dos".

### Phase 3b — New to-do asks "Comes after?"
- Depends on: none (best after 3a, so the answer shows in the tile). Model: Sonnet.
- `kits/planning/Extras/Templates/To-do.md`: after the project is known (`:11-27`) and only when it is set, list that project's open to-dos from the metadata cache (the way the hub list is built, `:22-27`) and ask with `tp.system.suggester`, "(nothing)" first; skip the prompt when there are none. Esc = nothing. Write `after:` with one link in the properties only when one was picked; no `after` key otherwise, and never for a to-do without a project.
- Applies however the project was set (hub button via `window.vtPresetProject`, the active hub, or the project pick): confirm with the user at the start of the phase, the survey answer was about the hub button.
- Tests: template text tests next to the priority ones (`tests/due-words.test.ts`, `tests/kit-install.test.ts`); `readPlan` already reads the written form (`tests/planning-plan.test.ts:61`, link with path).
- Docs: changelog, checklist 6i row, Hotkeys / tutorial only if they describe the New to-do prompts; `npm run kit:manifest`.
- Done when: tests and lint pass; tests only until the user makes one to-do from a hub.

### Phase 3 (superseded draft, kept for the record)
- **PAUSED 2026-10-12 (user): to be re-planned on Opus; nothing built.** Re-planned the same day: see "Re-plan 2026-10-12" and Phases 3a / 3b. Decided with the user: the tile goes at the top, under the hub bar, and shows only when the project has a plan. A draft Sonnet plan exists (not approved): `planLines` / `hasPlan` in `plan.ts` reusing `ListLine` and the `list()` renderer, `case "project-plan"` in `src/planning/blocks.ts` next to `project-todos`, a `show: project-plan` block in `Project hub.md`, small CSS (the Show all toggle CSS at `vault-theme.css:261` expects a callout parent), the "Unknown card" valid-names text (`blocks.ts:308`) to extend, existing hubs via the opt-in Tidy rule `hub-body`. Open for Opus: Canvas instead of Mermaid for Phase 4 (user question 2026-10-12; options: keep the Mermaid block, a generated read-only Canvas, an editable Canvas that writes `after`), and whether the hub's New to-do asks `after` (user unsure; BACKLOG).
- User addition 2026-10-12 (chat): the Plan tile (the workflow: next to-do steps) goes at the TOP of the Project hub template, shown only when the project has to-dos with a plan (`after` / `order` set); otherwise nothing appears. My reading: "workflow" = this Plan tile, "next steps" = its unblocked open rows first. Confirm in Phase 3.
- Depends on: Phase 2
- Plan check 2026-10-12: the other hub tiles sit inside callouts in the template (`Project hub.md:28-42`), and a callout's title would still show when the block is empty. So the Plan tile is a bare `vault-card` block that draws its own heading and leaves nothing behind when there is no plan, like `show: hub-bar` (`Project hub.md:21-23`). Placement to confirm with the user: under the hub bar and above Goal, or above both.
- Files: `src/planning/blocks.ts:244-255` (new `show: project-plan`), `kits/planning/Extras/Templates/Project hub.md:31-41`, Tidy rule for hub bodies (hub body is rewritten from the template with a preview, 2026-10-10 decision), tests, docs.
- Done when: tests for the rows (status, result, "← after X", blocked mark); hub template test; kit manifest.

- **Phase 3b result (2026-10-12, tests only, not seen in Obsidian):** as specified, in `To-do.md` only; asked however the project was set (hub button, active hub, or the project pick; not yet confirmed with the user for the non-hub-button ways). Prompt text is "Comes after? (optional: pick (nothing) to skip)" because `tests/esc-cancel.test.ts` forbids "Esc = " in box text; Esc behaves as nothing, unlike the other pickers.

### Phase 4a — Card map layout (pure code)
- Depends on: Phase 2. Model: Sonnet.
- New `src/planning/plan-map.ts`: from `readPlan`'s rows give each to-do a step (0 for no parents, else 1 + the largest step of its parents; a to-do in a cycle keeps the plan engine's order and is flagged, never dropped), a place inside its step (near its parents, then `order`, then path), the list of arrows (from, to), and the start step: the step of the first ready open to-do (the last step when everything is finished).
- No DOM, no Obsidian imports: positions are step and row numbers, the drawing phase turns them into pixels.
- Added 2026-10-12:
  - **Unlinked to-dos:** a to-do with no parents and no children is not placed on the map; the layout returns these as a separate list (plan order). A project where nothing is linked gives an empty map and the full list.
  - **Chain lookup:** `chainOf(path)` gives every to-do before it and after it (through any number of links), for the hover highlight in 4b. A to-do in a cycle gives the cycle's members once, no endless loop.
  - **Date warning** (in `readPlan`, `src/planning/plan.ts`, so the Plan tile shows it too): a problem line when an open to-do's `due` is earlier than the `due` of an open to-do it comes after. Only dates written in the notes are compared; a missing or unreadable `due`, equal dates and finished parents give no line. `hasPlan` needs no change (a warning needs an `after`).
- Tests (new `tests/planning-plan-map.test.ts`): chain, two-parent join, two separate chains, cycle, all finished, start step with finished steps before it; unlinked to-dos off the map; `chainOf` on a chain, a join and a cycle. In `tests/planning-plan.test.ts`: the date warning (earlier, equal, no date, finished parent).
- Done when: tests and lint pass. The date warning can be seen in the Plan tile; nothing else to see in Obsidian.

- **Phase 4a result (2026-10-12, tests only, not seen in Obsidian):** `src/planning/plan-map.ts` (`layoutPlan`, `chainOf`); `PlanRow` gained `afterPaths` and `due`; the date warning is a line in `readPlan` problems, so the Plan tile prints it. Places: mean place of the parents, then plan order. A cycle's members are in `cyclic`; to-dos behind a cycle are not flagged. `startStep` counts only linked to-dos.

### Phase 4b — Draw the card map in the hub
- Depends on: 4a. Model: Sonnet, after one question to the user (where it sits: under the Plan tile is the default).
- A `show: project-map` card in `src/planning/blocks.ts` (it already redraws on metadata changes, `:27-29`), with the drawing in a new `src/planning/plan-map-render.ts`: cards as HTML in the vault theme (title, due, priority, `result`, done and blocked looks), arrows as SVG curves behind them, the box scrolls sideways.
- Scroll: on first draw the box is scrolled so the start step is at the left edge (finished steps off to the left). A redraw keeps the scroll position the user left.
- Click a card opens the to-do (`app.workspace.openLinkText`; Ctrl / Cmd-click = new tab). Nothing is drawn when the project has no plan.
- `Project hub.md` gets the block; CSS in `vault-theme.css`; `hub-body` Tidy rule as in 3a.
- Added 2026-10-12:
  - **Unlinked list:** the to-dos 4a keeps off the map are drawn as a plain list beside the map (under it when the note is narrow), each opening its to-do; no list when there are none.
  - **Hover highlight:** hovering a card gives it and its `chainOf` cards and arrows a class; the rest are dimmed in CSS. Hover does not exist on a phone: desktop only unless the user asks for a tap gesture (click is taken by "open").
  - **Right-click menu** on a map card (Obsidian `Menu`): Open, Open in new tab, Mark done (writes `done: true` with `app.fileManager.processFrontMatter`; not shown on a finished card). Not verified: that the to-do engine then stamps `done_on` as it does for a tick on the board (`src/planning/todo.ts:58-62`), and a long press on a phone.
  - If the session runs long, the right-click menu moves to the start of 4c; say so in the phase result.
- Unknown until seen: arrows crossing on a big plan, a wide plan, Live Preview vs Reading view, a phone.
- Done when: tests for anything pure (pixel maths, scroll target); the user sees one real project drawn.

- **Phase 4b result (2026-10-12, tests only, not seen in Obsidian):** `show: project-map` (`src/planning/plan-map-render.ts`, `mapGeometry` in `plan-map.ts`), template + theme CSS, `PlanRow.priority`. User decision: the map replaces the Plan list by default; setting `planView` (`map` | `both`) keeps both. The list hides only when the hub note itself holds the map block (so an old hub keeps its list). Mark done writes `done: true`; the engine's metadata handler then stamps `done_on` (read in `changePatch`, `src/planning/todo.ts:58`; not run). Redraws keep the scroll position; first draw scrolls the start step to the left.

### Phase 4c — Link by dragging
- Depends on: 4b seen by the user. Model: Opus for the spike, then Sonnet.
- Drag from a card's handle to another card: the second to-do gets the first in `after` (`app.fileManager.processFrontMatter`, appending a link; an existing single value becomes a list). Click an arrow, then confirm, removes that link. A link that would make a loop is refused with a notice (the check is pure code, tested). No card moves: positions are not saved.
- Spike first (none verified): pointer events inside a rendered block in Live Preview (the editor may take the drag), touch dragging on a phone inside a scrolling note, and that the block's own redraw after the write does not fight the drag. If the phone cannot do it, linking is desktop only and says so.
- Tests: the patch to `after` (add to empty, add to one, add to a list, remove, loop refused, already linked).
- Added 2026-10-12:
  - **Draw first:** the new arrow is drawn as soon as the card is dropped, before the write; if the write fails the arrow is removed and a notice says so. Same for removing an arrow. Part of the spike (the redraw after the write must not fight this).
  - **Undo:** the notice after a link or an unlink has an Undo that writes the opposite patch. It undoes that one change only; there is no undo shared with the editor or the board.
- Tests: also the opposite patch (link then undo, unlink then undo give the first value back, a single value stays a single value).
- Done when: tests; the user links and unlinks two to-dos in Obsidian and the Plan tile follows.
- Later, only if asked: saved positions.

- **Phase 4c result (2026-10-12, tests for the pure parts only, NOT seen in Obsidian; the spike is the user's try):** `src/planning/plan-link.ts` (`addAfter`, `removeAfter`, `canLink`), the dot, the drag line, arrow click menu and Undo notices in `src/planning/plan-map-render.ts`, `.vt-map-handle` etc. in `vault-theme.css`. Decided with the user: dot on hover at the right edge, click an arrow then Remove link (no confirm box). Rows in Not linked are drag sources and targets too, so an unlinked to-do can join the map. The temporary line stays as the drawn arrow until the map redraws after the write; a failed write removes it. Undo undoes that one change only; item order in `after` may change.

- **Phase 4c user try (2026-10-12/13, in Obsidian):** Remove link works; Live Preview and Reading view both work; phone not tried. Found and fixed 2026-10-13 (tests / CSS only, not seen): the drag dot sat inside the card (now on the edge, `overflow: visible`); the map could not be scrolled mid-drag (it now scrolls itself near the left / right edge, `dragLink`); a card was not blocked when the to-do directly before it was ticked out of order (blocked is now transitive, `readPlan`, user decision: ticking out of order stays allowed, blocked rules still apply).

### Phase 4d — List to sequence
- Depends on: 4c (its `after` patch). Model: Sonnet, after one question to the user.
- A command that links to-dos in order by writing `after`: the second comes after the first, the third after the second. Ask at the start which list it reads: the to-do links selected in a note (default), or a project's open to-dos in Plan tile order.
- Only to-dos of one project; an existing `after` is kept and added to; a link that would make a loop is refused (4c's check); a preview of what will be written, then one confirm.
- Tests: the list of patches for three to-dos, one already linked, a loop, a link that is not a to-do, two projects.
- Done when: tests and lint pass; the user runs it on one list in Obsidian.

- **Phase 4d result (2026-10-13, pure parts tested, the command NOT seen in Obsidian):** `src/planning/sequence.ts` (`linksIn`, `sequencePatches`, `linkInOrder`), `sequence-ui.ts` (preview modal), shared writers in `src/planning/after-write.ts` (moved out of `plan-map-render.ts`). User decisions: the list is the selected links in a note; palette command only. Not built: Plan tile order as a source, a hub button, markdown-style links.

### Phase 4e — Subtasks (`sub`)
- Depends on: 4b seen by the user (so the questions can be answered from a real map). Model: Opus for the questions, then Sonnet.
- A subtask is a to-do with `sub: [[Parent to-do]]` (one link, on the child). `readPlan` reads it; the parent's subtasks are worked out. Typed by hand at first.
- Ask at the start (not decided): do subtasks show as their own cards on the map or as a count on the parent's card; do they show on the board; is the parent finished or only marked when all its subtasks are done (default: marked, never ticked automatically); does New to-do ask it; can a subtask have its own `after`.
- Problems reported, nothing invented: `sub` naming a note that is not a to-do of the project, itself, or a loop.
- Tests: fixture with a parent and two subtasks, a missing parent, a loop.
- Done when: tests and lint pass; the user gives one to-do two subtasks and sees them in the hub.

- **Phase 4e result (2026-10-13, tests only, not seen in Obsidian):** decided with the user: the parent card shows a count that expands to the subtasks; the parent is only marked "all done", never ticked; a subtask is an ordinary to-do (board, own `after`); typed by hand; one level only. `PlanRow.parent` / `subs` and the problem lines in `src/planning/plan.ts`; subtasks left off the map in `layoutPlan`; the toggle and list in `src/planning/plan-map-render.ts`; open lists kept in the block (`expanded` in `blocks.ts`).

### Phase 4 (superseded: `plan` block, Mermaid)
- Replaced 2026-10-12 by Phases 4a-4c (card map). Kept for the record.
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

## Order (checked 2026-10-12)
3a → 3b → 4a → 4b → 4c → 4d → 4e → 5 → 6 (4d and 4e added 2026-10-12). 3a, 3b, 4a and 5 need only Phase 2 (done); 4b needs 4a; 4c needs 4b seen by the user; 4d needs 4c's patch; 4e needs 4b seen; 6 is independent and still starts with its own spike. Each is one session.

## Verification
Tests per phase; each phase is tests-only until the user tries it in Obsidian (say so in STATUS). Known engine answers are untouched, none of this changes `calc`.
