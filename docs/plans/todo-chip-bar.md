# Plan: to-do chip bar and quick capture

_Agreed: 2026-10-14 (user, chat + survey). Written by `/phase-plan`. Each phase = one session, Sonnet (fully specified)._

## Goal
Making a to-do takes one box (the title). Project, comes after, meeting, due, priority and countdown are set afterwards by clicking chips in a bar at the top of the to-do note, instead of typing frontmatter or answering seven prompts. Highlighted text plus the New to-do hotkey makes a to-do from the selection, reading `@project`, `%date` and `!priority` marks in it.

## Decision taken
- A plugin-drawn `vault-card` block, `show: todo-bar` (like `hub-bar`, `src/planning/blocks.ts:442`), not Meta Bind inputs: the lists of projects, meetings and open to-dos are live, it works on phone, and no new dependency. Rejected: Meta Bind inputs in the template (option lists go stale), and "Just the title / Set details" skip (no way to set things afterwards).
- Quick capture is part of this plan (user): it reuses the same setters and parser.
- Marks (to confirm in Phase 1, from the user's own examples): `@` project, `%` date, `!` priority 1-3. Dates use the due words (`fri`, `next mon`, `2026-11-03`). Anything unparsed stays in the title.

## Out of scope
- Subtasks (`sub`), `experiment`, `result`: stay on the plan map.
- A chip bar on non-to-do notes. Changing the board, or Alt+S forms.
- A default hotkey (Lab Kit sets none; the Hotkeys note gets a suggested row only).

## Phases

### Phase 1: quick-capture parser and due words in TypeScript (pure, tests only)
- Files: new `src/planning/quick-todo.ts` (parse `text` + known project names + `now` → `{ title, project?, due?, priority?, rest }`), a TS port of `parseDue` (new `src/planning/due-words.ts`; `vtAsk.js:43-72` stays for the template), `tests/quick-todo.test.ts`.
- Done when: tests cover marks anywhere in the text, project names with spaces (match a known name, longest first, case-insensitive; `@"Long name"`), unknown project left in the title, bad date left in the title, and a test that the TS due words give the same answers as `tests/due-words.test.ts` cases for the JS (same table, both run).
- New dependencies: none.

### Phase 2: the chip bar block
- Depends on: Phase 1 (due words).
- Files: `src/planning/blocks.ts` (new `case "todo-bar"` + the valid-names list at :437), new `src/planning/todo-bar.ts` (setters: `setProject`, `setAfter`, `setMeeting`, `setDue`, `setPriority`, `setCountdown` via `app.fileManager.processFrontMatter`, formats from `todo.ts:9`: links as `"[[X]]"`, meeting `false` when none, due as `YYYY-MM-DD`, priority a number), `styles.css` (`.vt-todo-bar*`), tests (setters against a fake file manager; the bar draws six chips on a to-do, countdown chip only when `due` is set, nothing on a non-to-do).
- Chips: Project (pick from live hubs, plus none), Comes after (open to-dos of the same project, plus none; only when a project is set), Meeting (live meeting series, plus none), Due (date box that also accepts due words), Priority (none / 1 / 2 / 3), Countdown (toggle). A chip shows its value or a muted "+ Project" etc. when empty. Reuse `pick` / `ask` (`src/planning/ask.ts:43,90`) for the lists and the text box.
- Done when: tests pass; `npm run build`; NOT seen in Obsidian (checklist row, BACKLOG item).

### Phase 3: title-only creation and the bar in every to-do
- Depends on: Phase 2.
- Files: `kits/planning/Extras/Templates/To-do.md` (keep the title box and the automatic project from where you are; drop the project, comes after, meeting, due, countdown and priority prompts; add the `todo-bar` block to the body; keep the `due` / `priority` property types being set), `src/planning/todo-picker.ts` `newTodoText` (must match the template: `tests/todo-picker.test.ts:54`), `src/kit/tidy.ts` (add the block to existing to-dos: a new opt-in rule like `back-to-project` at `tidy.ts:349`, never touching a to-do that already has it), `npm run kit:manifest`, tests (`tests/due-words.test.ts`, `tests/todo-engine.test.ts`, `tests/esc-cancel.test.ts`, `tests/planning-commands.test.ts:84` need updating for the removed prompts; Tidy fixture test).
- User-facing change (decided by the user): fewer prompts. The project picker still asks when you are not inside a project? To confirm in this phase: default = it asks nothing and the Project chip shows "+ Project" (fastest); alternative = keep the one project pick.
- Done when: tests pass; `npm run tidy-fixture` shows the bar rule; NOT seen in Obsidian.

### Phase 4: quick capture from selected text
- Depends on: Phases 1 and 3.
- Files: `src/planning/commands.ts` (`newTodo` reads `app.workspace.activeEditor?.editor?.getSelection()`, pattern at `sequence.ts:49`; with a selection: parse, make the note without asking, set the fields with the Phase 2 setters, show a Notice naming the to-do; no selection: today's flow), `kits/planning/07 How-tos/Obsidian/Hotkeys.md` and `src/kit/hotkey-check.ts` (suggested key row, none set), tests, docs.
- Question for the phase: does the selection in the note get replaced by a `[[link]]` to the new to-do? Default: no, the note is left alone (user can say).
- Done when: tests; NOT seen in Obsidian.

## Docs (every phase, per `docs/maintenance.md`)
`docs/changelog.md` Unreleased, `docs/tutorial.md` (to-do section), Vault spec in `kits/planning/07 How-tos/Obsidian/` (then `npm run kit:manifest`), `docs/obsidian-test-checklist.md` row, BACKLOG "Not yet tested".

## Verification
Beyond tests: in `test-vault`, make a to-do from the board, the New to-do command, a project card, and from highlighted text; set every chip; check the frontmatter by eye; check the board and plan map read the same values; phone width. None of this can be seen by Claude.
