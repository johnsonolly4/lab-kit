# Plan: to-do chip bar and quick capture

_Agreed: 2026-10-14 (user, chat + survey). Written by `/phase-plan`. Each phase = one session, Sonnet (fully specified). Re-cut 2026-10-14: Phases 3-7 after the user asked for one entry window across the similar flows._

## Goal
Making a to-do takes one box (the title). Project, meeting, due, priority and countdown are set afterwards by clicking chips in a bar at the top of the to-do note, instead of typing frontmatter or answering seven prompts. Highlighted text plus the New to-do hotkey makes a to-do from the selection, reading `@project`, `%date` and `!priority` marks in it.

## Decision taken
- A plugin-drawn `vault-card` block, `show: todo-bar` (like `hub-bar`, `src/planning/blocks.ts:442`), not Meta Bind inputs: the lists of projects, meetings and open to-dos are live, it works on phone, and no new dependency. Rejected: Meta Bind inputs in the template (option lists go stale), and "Just the title / Set details" skip (no way to set things afterwards).
- Quick capture is part of this plan (user): it reuses the same setters and parser.
- Marks (to confirm in Phase 1, from the user's own examples): `@` project, `%` date, `!` priority 1-3. Dates use the due words. Anything unparsed stays in the title.
- Due words, today (`vtAsk.js:43-72`): `YYYY-MM-DD`, `today`, `tomorrow`, a weekday, `next <weekday>`. NOT today: months, `15/11`, `in 3 days`, `next week`. Added in Phase 1 (user asked 2026-10-14), day before month: `15 nov`, `nov 15`, `15th november`, `15/11`, `15/11/2026`, `in 3 days`, `in 2 weeks`, `next week` (Monday), `next month` (the 1st). Numbers are day first (`3/11` = 3 November; confirmed by the user 2026-10-14). A day-month with no year is the next one that is today or later. Both the TS and the template's JS get them (one table in the tests).
- Project: inside a project (its hub, or any note in its folder) the to-do gets that project automatically, as today; outside one nothing is asked and the Project chip shows "+ Project" (user, 2026-10-14).

## Out of scope
- Snippet forms (Alt+S) already are forms; the shopping list, results, Name boxes and topic / chemical / rig single-name boxes keep their one box.
- A Comes after chip (user, 2026-10-14: the plan map already sets it). The template's Comes after prompt goes in Phase 3; `after` is set on the plan map or by hand.
- Subtasks (`sub`), `experiment`, `result`: stay on the plan map.
- A chip bar on non-to-do notes. Changing the board, or Alt+S forms.
- A default hotkey (Lab Kit sets none; the Hotkeys note gets a suggested row only).

## Phases

### Phase 1: quick-capture parser and due words in TypeScript (pure, tests only)
- Files: new `src/planning/quick-todo.ts` (parse `text` + known project names + `now` → `{ title, project?, due?, priority?, rest }`), a TS port of `parseDue` (new `src/planning/due-words.ts`; `vtAsk.js:43-72` stays for the template), `tests/quick-todo.test.ts`.
- Done when: tests cover marks anywhere in the text, project names with spaces (match a known name, longest first, case-insensitive; `@"Long name"`), unknown project left in the title, bad date left in the title, and a test that the TS due words give the same answers as `tests/due-words.test.ts` cases for the JS (same table, both run).
- New dependencies: none.
- Also: extend `parseDue` in `vtAsk.js` with the new words (kit script: `npm run kit:manifest`), and add the words to the To-do template's date hint until Phase 3 removes the prompt.

### Phase 2: the chip bar block
- Depends on: Phase 1 (due words).
- Files: `src/planning/blocks.ts` (new `case "todo-bar"` + the valid-names list at :437), new `src/planning/todo-bar.ts` (setters: `setProject`, `setMeeting`, `setDue`, `setPriority`, `setCountdown` via `app.fileManager.processFrontMatter`, formats from `todo.ts:9`: links as `"[[X]]"`, meeting `false` when none, due as `YYYY-MM-DD`, priority a number), `styles.css` (`.vt-todo-bar*`), tests (setters against a fake file manager; the bar draws six chips on a to-do, countdown chip only when `due` is set, nothing on a non-to-do).
- Chips: Project (pick from live hubs, plus none), Meeting (live meeting series, plus none), Due (date box that also accepts due words and a date picker), Priority (none / 1 / 2 / 3), Countdown (toggle). A chip shows its value or a muted "+ Project" etc. when empty. Reuse `pick` / `ask` (`src/planning/ask.ts:43,90`) for the lists and the text box.
- Done when: tests pass; `npm run build`; NOT seen in Obsidian (checklist row, BACKLOG item).

### Phase 3: the entry window, used by New to-do (re-cut 2026-10-14)
_The user's idea (2026-10-14): when New to-do runs, one window shows the title box with the chip row under it, so everything is set at once; Enter on just the title creates at once, chips optional. Then the same window for the other flows (Phases 5-7)._
- Depends on: Phase 2 (the chip pick code and setters move out of `blocks.ts` into a shared piece).
- Files: new `src/planning/entry-window.ts` (a modal: title input, a chip row built from a list of field descriptions `{ key, name, icon, pick | date | toggle, initial }`; Enter creates with what is set, Esc cancels; chips open the same pick lists / date box as the in-note bar; returns `{ title, values }`), `src/planning/todo-bar.ts` (field descriptions for a to-do, reused by the in-note bar), `src/planning/commands.ts` `newTodo` (open the window, then hand the values to the template through `handoff()`), `kits/planning/Extras/Templates/To-do.md` (reads the handoff values, asks nothing when they are there; the old prompts stay as the fallback when the template is run without the plugin), `src/planning/todo-picker.ts` `newTodoText` (must match), `.vt-entry-*` in `styles.css`, tests, `npm run kit:manifest`.
- The window also carries the to-do template's automatic project (inside a project the Project chip is already set, from `here` or the preset). Comes after is not in the window (plan map sets it).
- Also: the `todo-bar` block goes into the to-do body, and a Tidy rule adds it to existing to-dos (opt-in, like `back-to-project`, `src/kit/tidy.ts:349`).
- Done when: tests (window logic is a pure state object: fields, values, Enter / Esc results); the template with a handoff asks nothing; NOT seen in Obsidian.
- New dependencies: none.

### Phase 4: quick capture from selected text
- Depends on: Phases 1 and 3.
- Files: `src/planning/commands.ts` (`newTodo` reads `app.workspace.activeEditor?.editor?.getSelection()`, pattern at `sequence.ts:49`; with a selection: `parseQuickTodo` (Phase 1), open the window already filled in (so Enter confirms; the user sees what was read), no selection: the window empty), `kits/planning/07 How-tos/Obsidian/Hotkeys.md` and `src/kit/hotkey-check.ts` (suggested key row, none set), tests, docs.
- Question for the phase: does the selection in the note get replaced by a `[[link]]` to the new to-do? Default: no.

### Phase 5: New meeting and New project note in the window
- Depends on: Phase 3.
- Files: `src/planning/commands.ts` (New meeting: title box at `:167`, project pick at `:175`, series first; New project note: `kits/planning/Extras/Templates/New project note.md:12-16`), field lists (Project, plus Series for a meeting), tests. Both ask a title and a project today: the window replaces the two boxes.

### Phase 6: New lab entry and Clone experiment
- Depends on: Phase 3.
- Files: `kits/lab/Templates/Lab Book Template.md:31` (experiment title), `src/kit/ui.ts:475` (New lab entry title) and `:541-544` (Clone: source pick, then title). Needs a spike first: which properties of a lab entry are worth a chip (Project? date? class?). Without one, the window is a title box with the same look (a consistent look, little else).

### Phase 7: New meeting series as a form
- Depends on: Phase 3.
- Files: `src/planning/commands.ts:207-240` (name, how often, every N weeks, first date, deck folder, template: six boxes). Fields here are not chips so much as a small form; the window gets a "field list" with text and pick fields. Own design in the phase (user to confirm the field order).

## Docs (every phase, per `docs/maintenance.md`)
`docs/changelog.md` Unreleased, `docs/tutorial.md` (to-do section), Vault spec in `kits/planning/07 How-tos/Obsidian/` (then `npm run kit:manifest`), `docs/obsidian-test-checklist.md` row, BACKLOG "Not yet tested".

## Verification
Beyond tests: in `test-vault`, make a to-do from the board, the New to-do command, a project card, and from highlighted text; set every chip; check the frontmatter by eye; check the board and plan map read the same values; phone width. None of this can be seen by Claude.
