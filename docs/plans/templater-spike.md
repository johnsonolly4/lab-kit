# Spike: what would it take to drop Templater? (roadmap N1, I23 d)

_Written 2026-10-19 (orchestrator, Opus, from the code on `overnight/2026-10-19`). The owner decided (BACKLOG "Questions for the owner", "Templater dependency"): staged. (1) Alt+S becomes a Lab Kit command (`docs/plans/snippet-menu.md` Phase 1); (2) this spike lists every Templater use, ports ONE template (To-do) to a plugin command plus a token template, and measures the gap; (3) the owner decides on full removal from the numbers in "Result". Nothing user-facing changes in the spike: the port runs behind the existing New to-do path and must write the same note byte for byte._

## Every Templater use today (counted 2026-10-19)

### 1. Alt+S and the snippet scripts
| What | Where | Size |
|---|---|---|
| Menu template (Templater hotkey) | `kits/lab/Templates/Insert snippet.md` | 54 lines |
| Code snippets (stubs that call `tp.user.labSnippets`) | `kits/lab/Templates/Snippets/01`, `02`, `03`, `07`–`10` | 7 files, 1 tag each |
| User scripts | `kits/lab/Extras/scripts/templater/labSnippets.js` 380, `labMethods.js` 199, `labForm.js` 170, `labPick.js` 58; `kits/planning/Extras/scripts/templater/vault/vtAsk.js` 96 | 5 files, 903 lines |
| Token templates (already Templater-free inside, but reached through Insert snippet.md and `labForm.js`) | `Snippets/04`–`06`, `11`–`14` | 7 files |

### 2. Note templates (files with `<%` tags)
| Template | `<%` lines | Asks with `tp.user.vtAsk` / `tp.system.suggester` | Plugin command that creates it |
|---|---|---|---|
| `kits/planning/Extras/Templates/To-do.md` | 12 | 7 | New to-do, board New, quick capture (entry window hands over `window.vtTodo`) |
| `Meeting series.md` | 8 | 0 | New meeting series (`window.vtMeeting`) |
| `One-off meeting.md` | 6 | 0 | New one-off meeting |
| `Meeting.md` | 5 | 0 | New meeting, extra meeting |
| `kits/lab/Templates/Lab Book Template.md` | 5 | 1 | New lab entry, Clone, folder template |
| `New project note.md` | 3 | 2 | New project note |
| `New topic hub.md` | 2 | 0 | New topic hub |
| `Project hub.md` | 1 | 1 | New project |
| `New concept.md` | 1 | 3 | New concept |
| `kits/planning/07 How-tos/Obsidian/Vault spec.md` (example text) | 1 | 1 | none (a guide note) |
| `Insert snippet.md` + 7 code-snippet stubs | 8 | 0 | Alt+S |
| **Total** | **18 files, 52 tag lines** | 15 | 8 template commands in `src/planning/commands.ts:30-37` |

### 3. Folder templates (a note made by hand in a folder runs its template)
`src/kit/setup-check.ts:10-21`: Daily note folder → `Daily note.md`, To-dos → `To-do.md`, Lab notes → `Lab Book Template.md`, Chemical folder → `Chemical database template.md` (plus the rows on lines 13-14). Needs Templater's "Trigger Templater on new file creation" (per device). The board's New button relies on it (it makes an empty note in To-dos; the folder template runs `To-do.md`).

### 4. Lab Kit's own code
236 lines in `src/` mention Templater or `tp.` (grep `templater|tp.user|\btp\.`): `obsidian-private.ts` 64, `managed-ui.ts` 33, `setup-check.ts` 23, `managed.ts` 20, `paths.ts` 18, `tidy.ts` 15, `setup-check-ui.ts` 15, `ui.ts` 14, `planning/commands.ts` 5, `snippet-run.ts` 5, others 24. The private calls themselves are in `obsidian-private.ts` only: `create_new_note_from_template`, settings read / write (templates folder, user scripts folder, hotkeys, folder templates, startup templates, matching mode). The rest is Check setup rows, Manage files (user-script folder), Tidy rules about templates, settings text.

## The spike (piece 3 of N1)
- **Port**: To-do only. A plugin function `makeTodo(answer)` in `src/planning/` builds the note text from the entry-window answer (title, project, meeting, due, priority, experiment, waiting, day) and creates it with `vault.create` in the To-dos folder, under the same name rule (`todoFileName`, `quick-todo.ts`). The front matter comes from a token template `To-do.md` body (or a TypeScript string if tokens cannot express the optional lines: measure which).
- **Same output**: a test feeds the same answers to the old template's logic (as far as it is pure) and to the port, and compares the written note byte for byte for at least: no project, project + after, meeting, due + priority, experiment, waiting, a board column `day`.
- **Not switched on**: the New to-do command keeps using Templater unless a setting / flag says otherwise; the I2 slim model (`scheduled`, no `rolled` / `countdown`) is NOT applied here (it is plan N2) — the port writes today's properties.
- **Measure**: per template and per use above, the work to port it (files, lines added / removed, tests), what is lost (an edited user template stops running; folder templates; `tp.date` / `tp.file` features in users' own templates), and the risks (Bases' "New" in a column, file-create event on mobile, Sync of a half-made note).

## Result
_(filled in by the spike session: a numbers table — files, lines, risks — and a recommendation for the owner)_
