# Plan: Phase 4b, planning commands

_Agreed: 2026-10-07. Written by `/phase-plan`. Each phase = one session. Parent plan: `docs/plans/planning-suite-kit.md` Phase 4._

## Goal
The planning kit's actions (new to-do, capture, shopping, sort inbox, archive, meeting, deck, project, project note, roll over now) become Lab Kit commands with fixed IDs, and the kit's Meta Bind buttons call them.

## Decision taken
**Hybrid** (user): plain actions are plugin code; commands that make a note from a template ask Templater to run the kit's template (the note text stays in one editable file). Buttons switch to `lab-kit:<id>` in this phase, and the Action templates the commands replace leave the kit. The per-project case is a plugin method with an optional project, not extra commands. Commands are registered only when the planning kit is on and installed (same gate as the to-do engine, read at load).
Rejected: all plugin code (two copies of each template's script header); all through Templater (every command breaks without Templater); extra or per-project commands (palette clutter, renames).

## Command IDs (fixed, never renamed)
| ID | Name (palette) | How | Replaces |
|---|---|---|---|
| `new-todo` | New to-do | Templater: `To-do.md` | button `todo` |
| `quick-capture` | Quick capture | plugin | button `capture` |
| `add-to-shopping` | Add to shopping list | plugin | `Actions/Add to shopping list.md` |
| `sort-inbox` | Sort inbox | plugin (4b-2) | `Actions/Sort inbox.md` |
| `archive-todos` | Archive old to-dos | plugin | `Actions/Archive old to-dos.md` |
| `new-meeting` | New weekly meeting | Templater: `Weekly meeting.md` | button `new-meeting` |
| `open-deck` | Open meeting deck | plugin, desktop only (`nodeModule("electron")`; hidden on mobile via `checkCallback`) | `Open Thursday deck.md` (never shipped) |
| `new-project` | New project | Templater: `Project hub.md` | button `new-project` |
| `new-project-note` | New project note | Templater: `New project note.md` | button `project-note` |
| `roll-over-todos` | Roll over to-dos now | plugin (`TodoEngine`) | console only |

Names are proposals (sentence case); the IDs are the contract.

## Shared rules
- Folders: `PLANNING_LAYOUT` defaults (no folder settings until Phase 5; decision 2026-10-07). Template files: the path where the planning kit installed that file id (managed record), else `planningRoles().templates` + name.
- Text input: a plugin port of `vtAsk.js` (a `SuggestModal` with no list, Enter saves, Esc = null) with its own class in `styles.css`. Pickers: `SuggestModal`.
- Templater missing: a notice naming Templater, nothing written. Templater access only through `src/kit/obsidian-private.ts` (`templaterCreateNote`, extended with a file name if needed).
- Per-project: `newTodo(project?)` and `newProjectNote(folder?)` on the plugin set the existing `window.vtPresetProject` / `window.vtNewNoteFolder` hand-offs the templates already read, then run the template. The Projects overview cards keep their own code until Phase 5's `vault-projects` block calls these methods.
- Pure rules (no Obsidian runtime) in `src/planning/actions.ts`, tested; Obsidian side in `src/planning/commands.ts`; registration from `src/main.ts` inside the planning gate.

## Out of scope
- Folder settings, meeting series, `deck_windows`/`deck_mac` per series (Phase 5): `open-deck` reads the `Weekly meetings` hub only, as the old template did.
- Replacing the Projects overview DataviewJS cards (Phase 5).
- Shipping `settings/meta-bind-buttons.json` or writing Meta Bind's settings (Phase 6); this phase edits the source file only.
- Hotkeys (Phase 6; no default hotkeys).
- Changing the wording of kit notes (`Vault spec.md:129`, `:210` name the Action template paths): listed in `BACKLOG.md` for the user.

## Phases

### Phase 4b-1: commands except sort inbox
- `src/planning/actions.ts`: `uniqueName`, `cleanName` (the templates' character rule), `shoppingAppend(text, items)`, `archivable(files, today)` (done or `day: Done`; date `done_on` else mtime; > 30 days), `deckPath(fm, isMac)`. The meeting date stays in `Weekly meeting.md`.
- `src/planning/ask.ts`: text box modal and a picker.
- `src/planning/commands.ts`: all IDs above except `sort-inbox`; `roll-over-todos` calls a new public `TodoEngine.rollOverNow()`.
- `src/main.ts`: register inside the existing planning gate; keep the engine instance for `roll-over-todos`.
- `styles.css`: the text box class.
- Tests: `tests/planning-actions.test.ts` (pure rules, incl. archive cut-off at exactly 30 days, unique names, shopping append with and without a trailing newline, deck path quotes stripped).
- Done when: tests and lint pass; each command run once in `test-vault` with the planning kit files present (not possible from the UI yet: say so if only tests ran).
- New dependencies: none

### Phase 4b-2: sort inbox, buttons, Action templates out
- Depends on: 4b-1
- `sort-inbox` in plugin code, same steps as `Actions/Sort inbox.md` (to-do / project / knowledge / how-to / meetings / archive / delete / skip / stop; delete uses `fileManager.trashFile`, i.e. the user's trash setting, never a hard delete).
- `docs/plans/kit-files/planning/settings/meta-bind-buttons.json`: `todo`, `capture`, `shop-add`, `sort-inbox`, `archive-todos`, `new-meeting`, `go-deck`, `new-project`, `project-note` → `{"type": "command", "command": "lab-kit:<id>"}`.
- Remove `Actions/Add to shopping list.md`, `Archive old to-dos.md`, `Sort inbox.md` from `kits/planning/` and its manifest (`npm run kit:manifest`); safe because the planning kit is not offered in the UI yet, so no vault has them installed. The sources stay in `docs/plans/kit-files/` as reference.
- Tests: every `lab-kit:` command in the button file is a registered ID; every `templateFile` / `link` left in the button file points at a file a kit ships (or is on a known list of Phase 5 items); sort-inbox pure rules (target name, folder list).
- Done when: tests and lint pass; the `planning-suite-kit.md` Phase 4 test line is met.

## Verification
Reference: the Templater files in `docs/plans/kit-files/planning/Extras/Templates/Actions/` (same steps, same results). Real-machine check in `test-vault`: run each command once; archive with one to-do done 31 days ago and one 29; shopping list gets items at the end. Not seen in Obsidian until someone does this; say so in STATUS.
