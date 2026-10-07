# Plan: Phase 5 — planning folders, homepage blocks, meeting series

_Agreed: 2026-10-07. Written by `/phase-plan`. Parent plan: `docs/plans/planning-suite-kit.md` Phase 5. Two sessions (5a, 5b), user's choice._

## Goal
The planning kit works with folders the user names, and the homepage and Projects overview show live lists drawn by the plugin; the planning kit then leaves preview after 5b.

## Decision taken
Two parts (user, 2026-10-07): **5a** = every planning folder becomes a setting + plugin blocks on 00 Home and Projects overview; **5b** = meeting series + the whole-vault Check setup.
Blocks replace the four Dataview lists and the Go to buttons on 00 Home, and the DataviewJS cards on Projects overview. Project hub, meeting, daily note and review notes keep Dataview for now.
Monthly cadence = same weekday of the month as the start (2nd Thursday stays 2nd Thursday).
Rejected: four smaller sessions (user chose two); blocks before settings (blocks would be written twice); replacing every Dataview query (too big for one phase).

## Out of scope
- Moving the user's existing folders when a setting changes (Phase 7 note correction). A folder renamed **inside Obsidian** is followed by its setting (cheap, same as kit files)
- Redesigning the Meta Bind buttons (user: later). The top button row on 00 Home stays as it is
- The font, the To-do box Esc text, the knowledge pages, the tutorial (own items in STATUS → Next)
- Replacing Dataview in the project hub, meeting, daily note and weekly review notes

## Phases

### Phase 5a — Planning folder settings + homepage blocks
**Settings**
- `KitData.planningFolders` (`src/kit/paths.ts`): `inbox` `00 Inbox`, `daily` `01 Daily Notes`, `planning` `00 Planning`, `projects` `02 Projects`, `literature` `04 Literature`, `knowledge` `06 Knowledge`, `howtos` `07 How-tos`, `meetings` `08 Meetings`, `archive` `99 Archive`. Defaults = today's layout; `kitLoad` fills missing keys. Fixed subfolders stay fixed: `To-dos` under planning, `To-dos` / `Inbox` under archive.
- Settings → Lab Kit: a **Planning folders** group, shown only while the planning kit is switched on, one folder box per role (folder suggest, `wideBox`). Text: a change only affects where new notes go and what the lists read; existing notes are not moved.
- A folder renamed inside Obsidian: its setting follows (the existing `vault.on("rename")` handler in `src/kit/ui.ts`).
- `PLANNING_LAYOUT` note folders and every use of a fixed folder read the settings instead: `src/main.ts` (engine folder: a getter, so a changed setting needs no reload), `src/planning/commands.ts` (`INBOX`, `ARCHIVE*`, sort-inbox roots, shopping list, new project/meeting/to-do), `src/kit/setup-check-ui.ts` (`PLANNING_FOLDER_TEMPLATES`, folder rows), `planningFolders` / `planningRoles` (`src/kit/paths.ts`).
- Kit files: `kits/planning/kit-manifest.json` `rewrite` gets one literal per role (`00 Inbox` → inbox, `01 Daily Notes` → daily, `00 Planning` → planning, `02 Projects` → projects, `04 Literature` → literature, `06 Knowledge` → knowledge, `07 How-tos` → howtos, `08 Meetings` → meetings, `99 Archive` → archive, `03 Lab Book/Notes` → labNotes from the lab setting). Roles come from the settings, not from where kit files were tracked, for these note folders. Kept files (`policy: keep`) keep what they were installed with (as the lab .base files).
- Ends the reviewer note "a relocated planning folder shows a false ✗" (BACKLOG Phase 6 reviewer notes).
- Added at approval (user, 2026-10-07): **folders moved outside Obsidian** — commands never re-create a missing settings folder silently (notice: Find moved folders / Open settings / Create it), blocks and the settings box say so, Check setup offers **Find**; **Find moved folders** (command + window) ranks where each went (same name, notes of its `kind`, tracked kit files) and changes only settings and tracking. **Any sync tool**: `onExternalSettingsChange` reloads data.json so a stale save can't overwrite synced settings.

**Blocks** (`src/planning/blocks.ts` renders, `src/planning/lists.ts` pure rules, ported from the Dataview queries in `kits/planning/00 Home.md` and the DataviewJS in `Projects overview.md`)
- ```` ```vault-card ```` with `show: this-week | experiments | projects | recently-read` and options inside the block (`limit: 8`). Same filters, sort order and badges as the queries they replace (this week: open to-dos for Mon–Fri or overdue, overdue first, carried-over badge; inbox count + Sort inbox button; experiments: lab notes with Status ≠ Closed, Started → Processing results → other, limit 8; projects: kind project, Active → Paused → Done; recently read: kind literature, newest import first, processed / to-process badge, limit 5). Data from Obsidian's metadata cache (no Dataview). `next-meetings` comes in 5b.
- ```` ```vault-goto ```` — one link per top-level folder that has a hub, in name (number) order. The hub is the first of: a note with `kind: hub` directly in the folder; a note named like the folder without its number (`Literature`); a `.base` file in it. Options: `hide:` (folder names), `extra:` (one note, base or command per line, e.g. `lab-kit:open-deck`). Folders without a hub are left out.
- ```` ```vault-projects ```` — the project cards (title, status badge, goal, top 3 open to-dos with overdue / day, counts, New note / New to-do / Open buttons calling `plugin.planning.newProjectNote(folder)` / `newTodo(name)`).
- Redraw: on metadata `changed` / vault `rename` / `delete` in the folders a block reads, debounced (as `src/header/render.ts`).
- `kits/planning/00 Home.md` and `02 Projects/Projects overview.md` use the blocks; class names stay `vt-*` so `vault-theme.css` still styles them. Both are `policy: keep`: test-vault needs **Restore kit original** on them to see the change.
- Check setup: the "Dataview JavaScript queries" row goes (nothing in the kit needs it any more): `src/kit/setup-check.ts:177`.

- Files: `src/kit/paths.ts`, `src/kit/ui.ts`, `src/kit/managed-ui.ts`, `src/main.ts`, `src/planning/commands.ts`, `src/planning/blocks.ts` (new), `src/planning/lists.ts` (new), `src/kit/setup-check.ts`, `src/kit/setup-check-ui.ts`, `kits/planning/kit-manifest.json`, `kits/planning/00 Home.md`, `kits/planning/02 Projects/Projects overview.md`, `styles.css` only if a block needs a class the theme lacks; tests `tests/planning-lists.test.ts` (new), `tests/kit-planning.test.ts`, `tests/setup-check.test.ts`
- Done when: `npm test` + lint pass; tests cover each list's filter and sort against the Dataview query it replaces (fixture notes), the goto hub rule, the settings defaults / `kitLoad` fill, and `kitText` with renamed folders (no default literal left in any planning file); manual: in test-vault with **Planning** renamed to `10 Plan` and **Projects** to `20 Work`, Restore kit original on 00 Home + Projects overview, the homepage lists and cards fill in, New to-do lands in `10 Plan/To-dos`, Check setup shows no false ✗
- New dependencies: none

### Phase 5b — Meeting series + whole-vault Check setup
- Depends on: 5a (meetings folder setting, blocks)
- Series hub notes: `kind: meeting-series`, `cadence` (weekly / fortnightly / monthly = same weekday of the month), `day`, `start`, optional `deck_windows` / `deck_mac`. `Weekly meetings.md` becomes the kit's example series.
- New meeting asks which series (skipped with one), names and dates the note from the series, fills "since the last meeting of this series"; meeting notes get `series: [[…]]`. To-dos flag `meeting: [[Series]]`; `meeting: true` still counts for the only / first series. Open meeting deck asks which series when there are several.
- ```` ```vault-card show: next-meetings ```` (next date per series) on 00 Home.
- Whole-vault Check setup (decided 2026-10-07): which checks it adds is settled at the start of 5b (BACKLOG "Check setup for the whole vault").
- Files: `src/planning/meetings.ts` (new, pure), `src/planning/commands.ts`, `src/planning/blocks.ts`, `kits/planning/Extras/Templates/Weekly meeting.md`, `kits/planning/08 Meetings/Weekly meetings/Weekly meetings.md`, `src/kit/setup-check*.ts`, tests
- Done when: three example series (weekly, fortnightly, monthly 2nd Thursday) give the correct next dates in tests, across a month end and a year end; manual in test-vault: New meeting in each series, Flagged list shows only that series' to-dos

## Verification
- Lists: each block shows the same notes in the same order as the Dataview query it replaced, checked side by side in test-vault before the Dataview version is removed (keep a copy of the old 00 Home as `Home (Dataview).md` for the check, then delete it)
- Folders: the renamed-folder run in 5a's "done when"
- Dates: known answers for next meeting dates (5b), worked out by hand in the test file
- Not covered: phones (blocks are plain DOM, no Node; check once on mobile if possible)
