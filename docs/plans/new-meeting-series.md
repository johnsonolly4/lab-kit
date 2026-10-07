# Plan: New meeting series command + button

_Agreed: 2026-10-08. Written by `/phase-plan`. Each phase = one session._

## Goal
A **New meeting series** command (and a button on each series hub) asks name, interval, day and first date, then makes the series folder and its hub note, so nobody has to copy the Weekly meetings note by hand.

## Decision taken
- Ask **one box at a time**, reusing `ask` / `pick` (`src/planning/ask.ts`): name, interval, day, first date (prefilled with the next matching day, `YYYY-MM-DD`), deck path last (empty = skip). Rejected: one form window (new UI to build and test).
- Hub note text comes from a **new kit template** `Meeting series.md` run by Templater, like the other note-making commands (decision 2026-10-07, 4b). Rejected: copying the Weekly meetings hub.
- Button `new-meeting-series` on each series hub next to `new-meeting`, plus the palette command. 00 Home's top row is unchanged.
- Wording: **interval replaces cadence everywhere** (user, 2026-10-08): the frontmatter key, code, prompts, kit notes, tests, current docs. Existing hubs keep working: the parser reads `interval` and falls back to `cadence`; a Tidy migration (`replace-property` in the planning manifest) renames the key in old hubs. Old plans, the changelog and past decisions keep the word (history).
- Deck paths (user confirmed 2026-10-08): the last prompt asks for the deck path of this series (one path for the current OS, saved in `deck_windows` or `deck_mac`; empty = fields left empty on the hub, fill in later).

## Out of scope
- Changing the behaviour of the Tidy meetings rule beyond the key name.
- A date-picker window; editing a series after creation (edit the hub's properties).
- Button on 00 Home.

## Phases

### Phase 0 — Rename cadence to interval
- Files: `src/planning/meetings.ts` (13 hits; `Series.cadence` → `interval`, `CADENCES` → `INTERVALS`, parser fallback to `cadence`), `src/planning/commands.ts`, `src/kit/tidy.ts`, `src/kit/tidy-ui.ts`, `src/kit/setup-check.ts`, `kits/planning/08 Meetings/Weekly meetings/Weekly meetings.md`, `kits/planning/Extras/Templates/Weekly meeting.md`, `kits/planning/kit-manifest.json` (`replace-property` migration cadence → interval), `npm run kit:manifest`, tests (`planning-meetings`, `tidy-meetings`, `setup-check`, `kit-planning`), `docs/obsidian-test-checklist.md`, BACKLOG wording. User-facing text changes: Tidy window labels and Check setup rows say interval.
- Done when: `grep -ri cadence src kits tests` finds only the deliberate fallback and the migration; tests prove an old hub with `cadence` still parses and that Tidy renames it; `npm test` and `npm run lint` pass. More than 2 files: its own session, own commit.
- New dependencies: none

### Phase 1 — Command and template
- Depends on: Phase 0 (template and tests use `interval`)
- Files: `src/planning/meetings.ts` (pure: `firstDefaultDate(day, today)`, name/folder-safe check, input validation), `src/planning/commands.ts` (`newSeries()` next to `newMeeting()` at :105; register `new-meeting-series` near :57; stops with a notice if a series of that name or folder exists), `kits/planning/Extras/Templates/Meeting series.md` (new; hub frontmatter `kind: meeting-series`, `interval`, `day`, `start`, deck fields; buttons; Dataview "All meetings" as in the Weekly hub), `kits/planning/kit-manifest.json` (template entry), run `npm run kit:manifest`, `tests/planning-meetings.test.ts` (+ default date, validation), `tests/planning-commands.test.ts` (command registered, handoff passed to the template).
- Done when: `npm test` and `npm run lint` pass; a test creates a series with a fixture, and `parseSeries` reads the result back with the same name, interval, day, start; `nextDate` of the new series matches the chosen first date; not seen in Obsidian is stated.
- New dependencies: none

### Phase 2 — Button, docs, checklist
- Depends on: Phase 1
- Files: `docs/plans/kit-files/planning/settings/meta-bind-buttons.json` (template `new-meeting-series`, icon, command `lab-kit:new-meeting-series`), `kits/planning/08 Meetings/Weekly meetings/Weekly meetings.md:13` and `Meeting series.md` button rows, `tests/planning-buttons.test.ts` (already checks every `BUTTON[…]` id), `README.md` commands list, `docs/obsidian-test-checklist.md` (new item), BACKLOG (tick the item, date + source).
- Done when: tests and lint pass; the buttons test fails without the template entry; checklist item exists for the owner to try the command and button in test-vault (phone width too).

## Verification
Round trip in tests: command inputs → hub note → `parseSeries` → `nextDate`. Real check in test-vault by the owner (checklist), including a second series appearing in the "Which meeting?" list for New meeting and in Check setup's "Meeting series" row.
