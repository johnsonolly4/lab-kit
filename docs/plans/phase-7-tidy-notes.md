# Plan: Phase 7 — Tidy up notes

_Agreed: 2026-10-07. Written by `/phase-plan` (replaces the check-notes / fix-notes design of `docs/plans/planning-suite-kit.md` Phase 7; the rule table there still applies). Each phase = one session._

## Goal
One command, **Tidy up notes**, shows every note of an existing vault that doesn't match the kit layout as a before / after split view, and changes the ticked ones only after a backup reminder and two confirmations.

## Decision taken
One command (id `tidy-notes`, callable from the Obsidian CLI) opening one window, instead of a separate `check-notes` report note and `fix-notes` command: the list and the Fix button sit together; closing the window changes nothing (user, 2026-10-07).
Window: **left = before (old), right = after (new)** (user confirmed 2026-10-07), changes marked red = removed, green = added, amber = changed, moves as `old path → new path`; grouped by rule, one tick box per rule, all ticked; last group "Only reported" (no tick box); **Copy report** button (Markdown to the clipboard; the user pastes a summary from their vault copy).
Safety: banner "Back up your whole vault before changing anything" (Lab Kit's per-file backups don't replace it); step 1: **Change notes…** stays disabled until "I have backed up my vault" is ticked; step 2: a second window "Change N notes (M rules)? Confirm / Cancel". Nothing is written before Confirm. Then each file is backed up (existing backup folder) and changed.
Rejected: a report note in the vault (extra file that syncs); tick per note (list too long); all-or-nothing.

## Out of scope
- Rewriting note body text (headings, links inside text): "Only reported"
- Deleting anything; guessing a mapping it can't make (listed instead)
- Running on the owner's real vault: the owner runs it on their own copy outside the repo and pastes a summary (user, 2026-10-07); Claude never sees those notes
- Real names or paths in fixtures (public repo)

## Rules
From `docs/plans/planning-suite-kit.md` "Note correction rules", plus lab `Status` list → text (BACKLOG "Phase 2 not done"). Simple rules are data in each kit's manifest (`migrations`: rename folder, move file, set / rename property, property value list → text, add missing property); rules that ask or search (meetings, hubs, buttons, settings paths) are named code rules the manifest refers to by id.

## Phases

### Phase 7a — Scan and split window (changes nothing)
- Rule engine (pure): scan → list of proposed changes per rule, each with before / after text; report-only finds. Rules in 7a: knowledge notes (`Type: Wiki` → `kind: concept`, add empty `summary`, `sources`, `checked: false`), lab `Status` list → text, `kind: hub` on hub notes missing it, all "Only reported" items (untitled notes, `. md.md`, canvases in the inbox, notes outside the folder contract, unused `view.js`, `###` headings / missing summary or sources in knowledge notes)
- Window: split view, colours (light and dark), rule tick boxes, Only reported group, Copy report, the backup banner; Change notes… shown disabled ("comes in the next version")
- Files: `src/kit/tidy.ts` (new, pure), `src/kit/tidy-ui.ts` (new), `src/main.ts`, `styles.css`, `kits/lab/kit-manifest.json` + `kits/planning/kit-manifest.json` (`migrations`; check that `scripts/kit-manifest.mjs` keeps the key), `tests/tidy.test.ts`, `tests/fixtures/tidy-vault/` (made-up notes)
- Done when: tests give the expected rows for every 7a rule on the fixture vault, and the scan writes nothing (all hashes unchanged); window seen in test-vault (desktop + phone width, light + dark)
- New dependencies: none

### Phase 7b — Change notes (files and properties) — built 2026-10-07 (properties via `vault.process` of the shown block, not `processFrontMatter`; script-move and help-sheet rules wait for the old paths)
- Depends on: 7a
- Backup tick → step 1, second confirm window → step 2; per-file backup, then `processFrontMatter` for properties, `fileManager.renameFile` for moves (links update); only ticked rules
- Adds rule (user, 2026-10-07): **add the lab template's missing properties to lab notes**: a partial block gets only the missing keys (empty), a note with no block gets the whole template block; existing values and extra properties are never touched; shown in the same before / after window; data in the lab manifest `migrations` (an `add-property` per template key; `applyMigration` in `src/kit/tidy.ts` must also handle a note with no block). Test: fixture notes with no block, a partial block and a full block
- Adds rules: folder rename `Extras/Templates/Scripts/` → `Actions/`, `fonts/` → `Extras/fonts/`, `excel_to_calc.py` / `lab-config.json` → `Extras/scripts/lab-kit/` (lab kit tracks the new path), Templater help sheet → `07 How-tos/Obsidian/`
- Files: `src/kit/tidy.ts`, `src/kit/tidy-ui.ts`, `src/kit/managed.ts` (tracked path after the script move), tests
- Done when: tests: (a) Cancel at either step writes nothing; (b) unticked rule untouched; (c) every changed file has a backup equal to its old text; (d) no new unresolved links in the fixture vault after the moves; (e) a second scan finds nothing left for the applied rules
- New dependencies: none

### Phase 7c — Meetings, hubs, buttons, settings paths (split 2026-10-07: 7c-1 meetings + missing hubs built; 7c-2 buttons + settings paths built; script moves wait for old paths)
- Depends on: 7b
- Meetings: old weekly-meeting hub → series hub (name, cadence, day asked in the window), meeting notes get `series: [[…]]`, to-dos `meeting: true` → `meeting: [[Series]]`; create a hub note for top-level folders without one (create only); path-based Meta Bind buttons whose action has a command → command action; paths into the renamed `Actions/` folder in Templater (startup / folder templates / template hotkeys) and Obsidian hotkeys, shown as before / after in the window like notes
- Files: `src/kit/tidy.ts`, `src/kit/tidy-ui.ts`, `src/kit/obsidian-private.ts`, `src/planning/meetings.ts` (reuse the series parser), tests
- Done when: tests per rule as in 7b; settings values unchanged unless listed and confirmed; owner runs Tidy up notes on a copy of their vault and pastes the Copy report summary, then runs Change notes there: no new unresolved links (owner checks), backups restorable
- New dependencies: none

## Verification
- Fixture vault with every rule's "before" state: scan rows match a written list; after Change notes, a second scan is empty for the applied rules and Obsidian's unresolved-link count is unchanged.
- Owner's vault copy (7c): report summary reviewed by the owner before any change; after the change, links checked by the owner.
