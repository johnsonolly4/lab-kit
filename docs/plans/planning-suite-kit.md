# Plan: Planning suite as a second kit

_Agreed: 2026-10-07. Written outside `/phase-plan` (claude.ai session) from the design doc "Vault kit: install, overwrite risks and model layout"; checked with `/phase-plan` 2026-10-07 (Phase 0 rules settled, Phase 1 split into 1a / 1b). Each phase = one session._

## Goal
Lab Kit installs two kits that can be switched on separately: the existing **lab kit** and a new **planning suite** (homepage, to-do board, planning notes, templates, buttons, theme), never overwriting existing files, and can bring an existing vault's notes in line with the kit layout after a confirmed preview.

## Decision taken
One plugin, two kits, one shared install engine (the existing managed-files engine: plan → review → backup → write → three-way merge on update). Every install, folder creation or note correction shows a **confirmation dialog listing every file, folder and setting it will touch** before anything is written (Templater-style "are you sure"), with backups.
Rejected: two plugins (both would write Templater's settings and undo each other); a zip starter as the main route (drifts, overwrites whole settings files); Style Settings (extra plugin, user declined).

## Out of scope
- A second plugin, or a separate store listing
- Installing other plugins (store policy: a plugin must not install its dependencies; it may detect and link to them)
- Default hotkeys (guideline); the plugin offers them, the user sets them
- Rewriting the body text of the user's notes (headings, links inside text): reported, never changed automatically
- Zotero Integration (literature is ZotLit only); Iridium or any theme (the kit uses Obsidian's default theme)
- Real names, initials or personal folder names anywhere in the repo (CLAUDE.md hard rule)

## Folder contract (target layout, kit defaults)
Every role is a setting; these are the defaults on a vault with nothing detected. Each folder has exactly one owner.

| Folder | Owner | Holds |
|---|---|---|
| `00 Home.md`, `00 Inbox/`, `00 Planning/` (To-dos/, To-do board.base, Weekly review, Shopping list) | Planning | Homepage (installed once, `policy: keep`), planning notes |
| `01 Daily Notes/YYYY/` | Planning | Daily notes (folder template) |
| `02 Projects/<Project>/<Project>.md`, `Projects overview.md` | Planning | Project hubs |
| `03 Lab Book/Notes/`, `Lab book base.base` | Lab | Lab entries |
| `04 Literature/ZotLit Imports/`, `Literature.md` | Planning (only if ZotLit is present) | Literature notes |
| `05 Chemicals/Chemicals/`, `Chemical database.base` | Lab | Chemical notes |
| `06 Knowledge/<topic>/`, `07 How-tos/<topic>/` + index hubs | Planning | Concept / how-to notes, topic hubs |
| `08 Meetings/<Series>/` | Planning | Meeting series hubs + meeting notes |
| `99 Archive/` | User | Never written by either kit |
| `Extras/attachments/`, `Extras/fonts/` | User / Planning | Attachments; optional font files |
| `Extras/methods/` | Lab (setting `methodsFolder`, user's notes) | Analysis method notes (stays here, user's choice) |
| `Extras/Templates/` | Planning | Templates picked from a menu |
| `Extras/Templates/Actions/` | Planning | Button-run Templater scripts (renamed from `Templates/Scripts`) |
| `Extras/Templates/Lab Kit/` | Lab | Lab Book Template, Insert snippet, Snippets/ |
| `Extras/Templates/ZotLit/` | Planning | ZotLit Liquid templates (must sit directly here) |
| `Extras/scripts/templater/` | Templater's user scripts folder | `vault/` (planning: vtAsk.js), `lab-kit/` (lab: lab*.js) |
| `Extras/scripts/lab-kit/` | Lab | excel_to_calc.py, lab-config.json |
| `.obsidian/snippets/` | Both | `vault-colours.css`, `vault-theme.css` (planning), `scrolling-mermaid.css` (lab) |

## Phases

### Phase 0 — Prerequisites
- Owner: merge `adopt/starter-kit` (STATUS → Waiting on owner). Phase 0 code goes on a new branch from `main` after that.
- Fix issue #34 "Overwrites user scripts on setup". Cause inferred from the code (the issue has no steps; confirm with the reporter): `setupTemplater` replaces a set `user_scripts_folder` whenever the lab scripts aren't under it (`src/kit/managed-ui.ts:231-233`), so the user's own scripts stop loading; with no kit yet, `kitDetectRoles` puts `lab*.js` flat into the user's folder (`src/kit/paths.ts:79`).
- Rule: a non-empty Templater user scripts folder is never changed. Lab scripts (`lab*.js`) go into `<folder>/lab-kit/` (Templater loads subfolders: the user's vault relies on it).
  - Folder set, no kit yet: install into `<folder>/lab-kit/`.
  - No folder set (fresh vault): first install offers to set Templater's folder to the parent (default `scripts`) and installs into `<parent>/lab-kit/`.
  - Folder set, kit scripts tracked somewhere outside it (older install): Set up offers, in a confirm dialog, to install fresh copies into `<folder>/lab-kit/` and track them there. The old copies are left in place (never deleted) and listed in the dialog for the user to remove.
  - Kit scripts already under the set folder (flat or in a subfolder): left as they are; nothing moves.
- Files: `src/kit/managed-ui.ts` (`setupTemplater`, first-install dialog), `src/kit/managed.ts` (`firstInstallOptions`, `templaterScriptsNeedChange`), `src/kit/paths.ts` (`kitDetectRoles`), `tests/kit-install.test.ts`, `tests/kit-picker.test.ts`
- Done when: tests show (a) a preset `user_scripts_folder` unchanged after first install and after Set up; (b) lab scripts land in `<folder>/lab-kit/`; (c) fresh vault: Templater set to the parent, scripts in `<parent>/lab-kit/`; (d) older install outside the folder: new copies in `<folder>/lab-kit/`, old files' hashes unchanged, cancel writes nothing; (e) existing installs under the folder: no file moves
- Not covered by tests: the Templater settings write itself (private API) → check in test-vault
- New dependencies: none

### Phase 1a — Multi-kit manifest (no behaviour change)
- Depends on: Phase 0
- `kit/` → `kits/lab/`; manifest schema 2: several kits, each with id, version, roles, files, `rewrite`, on/off, its own managed state in `data.json` (existing single-kit state migrated on load).
- Defaults unchanged in this phase.
- Files: `src/kit/managed.ts`, `paths.ts`, `managed-ui.ts`, `scripts/embed-kit.mjs`, `scripts/kit-manifest.mjs`, `package.json` scripts (`kit:manifest` path), `tests/managed.test.ts`, `tests/kit-install.test.ts`, docs that name `kit/` (`CLAUDE.md` "After editing anything in `kit/`", `docs/architecture.md`, `docs/maintenance.md`)
- Done when: all existing tests pass unchanged against `kits/lab/`; new test: a 0.5.2 `data.json` loads into schema 2 with the same managed state (hashes, roles)

### Phase 1b — Confirmation dialog, folder-contract defaults, `policy: keep`
- Depends on: Phase 1a
- Defaults follow the folder contract (under `Extras/`, not vault-root `Templates/` and `scripts/`) for vaults with no kit files yet; tracked roles keep existing installs where they are.
- `policy: keep` honoured for user-owned notes (installed once, never updated).
- Confirmation dialog before first install of a kit, before creating any folder, and before any settings change: grouped list (files to create, files left alone because they exist, folders, Templater/Obsidian settings), counts, and a confirm button; nothing is written on cancel. Replaces the Phase 0 confirm dialogs.
- Files: `src/kit/managed.ts`, `paths.ts`, `managed-ui.ts`, `ui.ts`, `tests/managed.test.ts`, `tests/kit-install.test.ts`
- Done when: new tests: (a) empty vault → only planned files created; (b) vault with same-named files → none overwritten (hash unchanged), listed as "left alone"; (c) cancel writes nothing; (d) lab kit alone and planning kit alone (a two-file test kit until Phase 3) both install cleanly; (e) an existing install keeps its folders

### Phase 2 — Lab kit completion
- Depends on: Phase 1b (independent of Phase 3: either order)
- Issue #33: Chemical database template + `Chemical database.base`; default chemical folder `05 Chemicals/Chemicals`. Source files: `docs/plans/kit-files/lab/`.
- Issue #32: Lab note Status as text.
- Lab Book Template title box via `vtAsk`, falling back to Templater's prompt (diff in `docs/plans/kit-files/CHANGES.md`); the fallback keeps it working without the planning kit.
- Command `new-lab-entry` (creates from the Lab Book Template in the lab folder) so buttons don't need a template path.
- Settings tab: button rows wrap / stack at narrow and phone widths (Update button runs off screen on a phone today).
- Files: `kits/lab/…`, `src/main.ts`, `src/kit/ui.ts`, `styles.css`, tests
- Done when: manifest regenerated, tests pass, settings checked at phone width (`app.emulateMobile(true)` in test-vault)

### Phase 3 — Planning kit: files
- Depends on: Phase 1b
- Source: `docs/plans/kit-files/planning/` (supplied and scrubbed 2026-10-07, see its `CHANGES.md`; `vault-fonts.css` is kept out of git until its font licence is checked). Files: `00 Home.md`, `To-do board.base`, `Weekly review.md`, `Shopping list.md`, `Projects overview.md`, `Literature.md`, Knowledge / How-tos index, templates (To-do, Daily note, Project hub, New project note, Meeting, New concept), Actions (Sort inbox, Add to shopping list, Archive old to-dos), `vtAsk.js`, `vault-colours.css`, `vault-theme.css` (2026-10-07 versions: colours by column name, contrast dials).
- Folder names inside files go through `rewrite`; ZotLit files only when ZotLit is installed.
- Knowledge rules (concept / comparison / topic hub, `summary`, `sources`, `checked`) go into the New concept template and the indexes.
- Optional `vault-fonts.css`: font embedded as WOFF2 (static regular + bold; check the font's licence file allows bundling, expected SIL OFL) instead of Custom Font Loader, which breaks spacing on phones.
- Files: `kits/planning/…`, `kits/planning/kit-manifest.json`, tests
- Done when: planning kit installs into an empty test-vault and into a vault that already has the old suite files without overwriting any of them

### Phase 4 — Planning engine in the plugin
- Depends on: Phase 3
- Move the To-do roll-over startup template into plugin code (no startup template to forget per computer). Keep the 2026-10-07 behaviour: sync-safe change handling (only write a missing or wrong stamp; never answer changes that arrive through Obsidian Sync), roll-over only on devices set to do it (per-device, local storage; computers yes, phones no by default), 90 s start delay, column tagging (`data-vt-group`) on every redraw, tick-circle click, `vt-rolled` cards, today's column.
- Commands with fixed IDs (never renamed): `new-todo`, `quick-capture`, `add-to-shopping`, `sort-inbox`, `archive-todos`, `new-meeting`, `open-deck`, `new-project`, `new-project-note`, plus a per-project variant for project cards.
- Test: every command a kit note or button calls exists; every file a button, hotkey or folder template points at is shipped by a kit.
- Files: `src/planning/*.ts` (new), `src/main.ts`, tests (port the 2026-10-07 sync scenarios: synced roll-over / drag / tick left alone; local drag, tick, untick, drag of carried-over card written)
- Done when: scenario tests pass; roll-over seen in test-vault

### Phase 5 — Homepage, hub blocks, meeting series
- Depends on: Phase 4
- Code blocks: `vault-card` (this-week, experiments, projects, recently-read, next-meetings; options inside the block, e.g. `limit: 8`), `vault-goto` (every top-level folder with a hub note named like the folder, in number order; `hide:` / `extra:`), `vault-projects` (replaces the DataviewJS project cards).
- Meeting series: hub notes with `kind: meeting-series`, `cadence` (weekly / fortnightly / monthly), `day`, `start`, optional `deck_windows` / `deck_mac`. New meeting note asks which series and fills "since the last meeting of this series". To-dos flag `meeting: [[Series]]`.
- Settings: folders, working days, start of week. Layout lives in the note, not in settings.
- Files: `src/planning/blocks.ts`, `src/planning/meetings.ts`, `kits/planning/00 Home.md`, tests
- Done when: homepage renders in test-vault with folders renamed in settings; three example series show correct next dates

### Phase 6 — Setup check, Templater autofill, hotkeys
- Depends on: Phase 4 (independent of Phase 5: either order)
- Command `check-setup`: green / red list (required plugins present: Templater, Meta Bind, Dataview; ZotLit optional; Templater settings; snippets on; folders; hotkeys), each with a Fix button that goes through the confirmation dialog.
- Templater autofill: templates folder, user scripts folder (subfolder rule from Phase 0), folder templates, template hotkey entries: adds only, never replaces.
- Recommended hotkeys with Set buttons and clash warnings. Two-key rule: one modifier + one key; a third key only for a variant of a two-key action. Insert snippet = Alt+S.
- Files: `src/kit/setup-check.ts` (new), `src/kit/obsidian-private.ts`, `src/kit/ui.ts`, tests
- Done when: on a fresh test-vault, every red item can be fixed from the list; existing Templater values unchanged

### Phase 7 — Note correction (check / fix)
- Depends on: Phases 3–6
- Commands `check-notes` (writes a report note, changes nothing) and `fix-notes` (confirmation dialog → backup each file → apply). Callable from the Obsidian CLI: `obsidian command id=lab-kit:check-notes`, then `obsidian command id=lab-kit:fix-notes`.
- Rules are data in the kit manifest (`migrations`), generic; anything personal is asked in the dialog, never stored in the repo. See "Note correction rules" below.
- Moves use Obsidian's rename so links update; properties via `processFrontMatter`; never deletes; anything it can't map is listed, not guessed.
- Done when: run on a **copy** of the owner's vault (never the real one first): report reviewed by the owner, fix applied, links checked (no new unresolved links), backups restorable

### Phase 8 — Starter, docs
- Depends on: Phase 7
- Build script generates a new-vault starter (`.obsidian` settings + plugin list only) from the kits, so it can't drift; plugins installed with the Obsidian CLI (`obsidian plugin:install id=… enable`).
- README: folder contract, kits, commands; tutorial; GETTING-STARTED: Mac steps beside Windows.
- Done when: a new vault from the starter + both kits passes `check-setup`

## Note correction rules (Phase 7)
| Rule | Change | Automatic after confirm? |
|---|---|---|
| Folder rename | `Extras/Templates/Scripts/` → `Extras/Templates/Actions/`, and every path that points into it (Meta Bind buttons, Templater startup / folder templates / template hotkeys, Obsidian hotkeys) | Yes |
| Folder move | Vault-root `fonts/` → `Extras/fonts/` | Yes |
| Script folders | `excel_to_calc.py`, `lab-config.json` → `Extras/scripts/lab-kit/` (lab kit tracks the new path) | Yes |
| Knowledge notes | `Type: Wiki` → `kind: concept`; add empty `summary`, `sources`, `checked: false` | Yes |
| Hubs | Add `kind: hub` to index / hub notes missing it; create a hub note for top-level folders without one | Yes (create only) |
| Meetings | Old weekly-meeting hub → a meeting series hub (name, cadence, day asked in the dialog); meeting notes get `series: [[…]]`; to-dos `meeting: true` → `meeting: [[Series]]` | Yes, after the dialog's answers |
| Helper notes in Templates | e.g. a Templater help sheet → `07 How-tos/Obsidian/` (so it isn't offered as a template) | Yes |
| Buttons | Path-based button templates whose action now has a command → command action | Yes |
| Leftovers | Untitled notes, double extensions (`. md.md`), old one-off scripts, legacy `view.js` scripts no note uses, canvases in the inbox, notes outside the folder contract | Report only |
| Note bodies | `###` section headings in knowledge notes, missing links, missing summaries / sources | Report only |

## Verification
- Install: three fixture vaults (empty; Templater + Meta Bind preconfigured; old suite files present) → every pre-existing file hash unchanged, every settings value unchanged unless listed and confirmed.
- Sync: two devices on Obsidian Sync, one set to roll over: carried-over cards keep amber on both, no write-back loop (watch file history).
- Phone: homepage and settings at phone width; fonts from `vault-fonts.css` render with normal spacing.
- Correction: owner reviews the `check-notes` report on a vault copy before `fix-notes`; zero new unresolved links afterwards.
