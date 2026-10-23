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
_Filled in 2026-10-19 by the spike session. **Measured** = counted or run; **est.** = my estimate, scaled from the To-do port and the `<%` counts above. Nothing was tried in Obsidian._

### The To-do port (measured)
- `src/planning/todo-note.ts`: 75 lines (about 28 are the token template itself); `tests/todo-note.test.ts`: 82 lines, 13 tests, all green first run. Seven of them are the plan's cases (no project, project + after, meeting, due + priority, experiment, waiting, board column day), plus everything-set and a no-token-injection case. Expected text is written out by hand from `To-do.md` lines 100-120 (not by running the old template).
- **Token engine: it could express the front matter byte for byte.** Optional lines are `{{#if after}}` blocks alone on their line (the engine removes the line and its break, as `-%>` does); empty values keep their trailing space (`project: `, `due: `); `meeting` uses `{{#if}}…{{else}}false{{/if}}`.
- **Gaps hit (3):**
  1. No JSON-escape token: `waiting: ${JSON.stringify(waiting)}` needed the caller to pass `waiting_json` (the format of that line is split between template and code). Fix would be a `{{json:waiting}}` token (est. 6 lines + 1 test).
  2. `{{#if x}}` is true only when `listOf(x)` is non-empty, so a value of only commas / newlines counts as empty (test "a note name of only commas"). Harmless for note names; a `{{#if x != ""}}` form would remove it (est. 10 lines).
  3. No date token: `today` is passed in. Folder templates, `tp.date.now(...)` in users' own templates and `tp.file.*` have no equivalent (est. a `{{today}}` token 5 lines; `tp.file` not worth copying).
- **Not ported (needs owner decisions, no code written):** the window-less path (board **New** button / folder template: the template opens the entry window itself, and on Esc trashes the empty note it was started in), the one-by-one boxes used when the plugin is absent, setting the `due` (date) and `priority` (number) property types, and the choice of "Comes after" (the entry window has no chip for it; `todoNoteText` takes it as a parameter). Today's properties (`rolled`, `countdown`) are kept; the I2 slim model is N2.

### Numbers by use (est. unless marked)
| Use | Files to change | Lines added / removed | New tests | Lost for users | Main risk |
|---|---|---|---|---|---|
| To-do (**measured**) | 2 new (+ wiring in `commands.ts`, `newTodo` 10 lines, not done) | 157 added (75 + 82) / 0 so far; the template's 124 lines go when switched | 13 (done) | edits to the user's own `To-do.md` stop running | window-less path (board New, folder template) still needs the template or a file-create hook |
| Meeting series, One-off meeting, Meeting | 3 templates → 1 module; `commands.ts` `makeMeeting` / `makeOneOff` / `newSeries` | +230 / −170 (template lines 51+50+69) | 12 | per-series custom meeting templates (`template:` on the hub, `seriesTemplate`) lose Templater syntax | users with edited meeting templates; date maths (`tp.date`) in them |
| Lab Book Template (+ Clone, folder template) | 1 template, `ui.ts` / `lab-entry` creators | +120 / −97 | 8 | the "folder template" route for Lab notes; users' own lab templates | it is the most used template; one ask inside (`tp.system.suggester`) |
| New project note, Project hub, New topic hub, New concept | 4 templates, 4 commands | +200 / −180 (33+79+25+44) | 12 | the same as above; concept asks 3 things | project hub is 79 lines with logic |
| Vault spec example text | 1 note | 2 lines | 0 | none (an example) | none |
| Alt+S menu + 7 code stubs + 4 user scripts (903 lines) | `kits/lab/…`, `labSnippets.js` etc. | covered by the snippet-menu plan (orchestrator), est. −1000 / +400 | in that plan | the Templater hotkey | none new here |
| Folder templates (4 rows, `setup-check.ts:10-21`) | `setup-check.ts` 410 lines, `obsidian-private.ts` 445, `paths.ts`, `managed-ui.ts` | −150 / +60 (a file-create hook that applies a plugin template to an empty new note in a folder) | 10 | exact Templater trigger behaviour; "Trigger on new file creation" is per device today | file-create fires on mobile and on Sync of half-made notes; Bases' New button |
| Lab Kit's own Templater code (236 lines in 20+ files) | Check setup rows, Manage files (user-script folder), Tidy template rules, settings text | −236 / +40 | 5 | the "Is Templater set up?" help | a long tail of wording in docs and the Check setup list |
| **Totals (est.)** | about 30 files | **about +1100 added, −1900 removed** (without the Alt+S plan: about +700 / −900) | about 60 | | |

To-do (157 lines for one template, 124 lines of template gone) suggests about 100-150 added lines per template with tests. Eight templates → 800-1200 added, which the table's total follows.

### Recommendation
- **(a) Full removal** is possible: the engine already handled the hardest template in this pass, with three small token additions. It costs about 8 template ports (est. 5-6 sessions), a file-create hook for folder templates, and the loss of "edit the template" for users. The window-less path (board New, folder template) is the real work, not the text.
- **(b) Keep Templater for note templates only, drop it for Alt+S** is cheapest and leaves users' edited templates working. The port here stays unused until the owner picks it.
- **(c) Stop after Alt+S** costs nothing more now; the To-do port is then dead code (remove it).
- **My pick: (b) now**, then revisit (a) once the Alt+S command has run for a while, since the only measured benefit of (a) is one dependency fewer and the biggest risks (file-create hook, edited user templates) are on the owner's side. This is a recommendation, not a measurement.

**Question for the owner:** if (a), should a user's own edited template keep running (a "use my template" fallback via Templater) or is it fine for the plugin's built-in text to replace it?
