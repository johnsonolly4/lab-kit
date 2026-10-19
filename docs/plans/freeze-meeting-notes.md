# Plan: freeze meeting notes (I19 + I20)

_Agreed: 2026-10-19, approved by the orchestrator on the owner's behalf (roadmap cards I19, I20); the owner can reject. Model: Sonnet._

## Goal
A meeting note becomes a record: when the next meeting of its series is made, the old note's generated lists turn into plain wikilink lists, and each flagged to-do is stamped with the meeting that first raised it.

## Decision taken
Follow ELN practice (LabArchives, Labfolder lock a signed page): freeze, do not keep live queries. Rejected: a date property on lab notes for the Experiments filter (changes every lab note); snapshots kept in a separate file (a second place to look).
- Freezing replaces only the generated blocks: `show: meeting-experiments`, `meeting-done`, `meeting-papers`, `waiting`, the new `meeting-flagged`, and the old Flagged Dataview query. Everything else, including "To discuss" and "Notes from the meeting", is copied byte for byte.
- The Flagged list becomes a block (`show: meeting-flagged`) so it can show "raised <d Mon>" and an Unflag button; Dataview cannot. Old notes keep their Dataview query until frozen (freeze handles both).
- Lists freeze as they render at freeze time (the same functions the blocks use), not capped. A note frozen late by Tidy shows the lists as of that day.
- `frozen: YYYY-MM-DD` (today) goes at the end of the front matter. A note with `frozen` is never touched again.
- Unflag also removes `raised_on` (otherwise a re-flag would show an old date).

## Out of scope
- Un-freezing; locking the "Notes from the meeting" text; freezing one-off meetings automatically (the command and Tidy can).
- The "Done this week" rename (BACKLOG).

## Pieces (one commit each)

### 1. Plan (this file)

### 2. Freeze, pure + write
- Files: `src/planning/freeze.ts` (new: `freezeMeeting`, `freezeLines`, `meetingFreezeLists`), `tests/planning-freeze.test.ts`, `tests/fixtures/meeting-before.md`, `tests/fixtures/meeting-after.md`.
- `freezeMeeting(text, lists, today)` → new text, or null when the note is not `kind: meeting` or already has `frozen`. A block whose list is missing from `lists` is left alone (e.g. papers when the literature folder is absent).
- Done when: unit tests on the fixture (before / after text, callout prefixes kept, second freeze null, Dataview and block forms, empty list text) pass.

### 3. When it runs
- Files: `src/planning/commands.ts` (`freezeNote`, `freezePrevious`, command, `makeMeeting`), `src/kit/tidy.ts` + `src/kit/tidy-ui.ts` (rule), tests.
- New meeting (regular series) freezes the series' latest earlier meeting note before making the new one. A failure to freeze never stops the new meeting (a notice says so).
- Command "Freeze this meeting note" (active note).
- Tidy rule, opt-in (not ticked until ticked; backed up first like the other opt-in rules), for meeting notes dated before the newest one in their series.
- Done when: tests for the command logic and the Tidy rows pass; obsidian-check: two meetings of one series, the first is frozen with readable lists.

### 4. Raised flags (I20)
- Files: `src/planning/freeze.ts` (`raisedStamp`), `src/planning/lists.ts` (`flaggedLines`), `src/planning/blocks.ts` (`meeting-flagged`), `kits/planning/Extras/Templates/Meeting.md`, `npm run kit:manifest`.
- On freeze each to-do in the Flagged list gets `raised_on: <meeting date>`; an existing earlier value is kept.
- `meeting-flagged` shows "raised 12 Oct" when `raised_on` is before the meeting's date; the button Unflag clears `meeting` and `raised_on`.
- Done when: tests for stamp, keep-earliest, badge; obsidian-check Unflag clears the property.

### 5. Docs
- `docs/changelog.md`, checklist 6i rows, `docs/architecture.md`, `docs/decisions.md` line, BACKLOG tick (past meetings only).

## New user-facing strings (exact)
- Command: `Freeze this meeting note`
- Notices: `Meeting note frozen.` · `This note was frozen on {date}.` · `This is not a meeting note.` · `Could not freeze {name}. See the developer console for details.`
- Tidy rule title: `Meetings: freeze old meeting notes`; detail: `Meeting notes dated before the newest one of their series get their generated lists (experiments, done, papers, waiting, flagged) written out as plain links, and the date frozen. What you wrote is kept. To-dos in the flagged list are stamped with raised_on. Not ticked until you tick it; each note is backed up first.`
- Flagged block: badge `raised {d Mon}`; button `Unflag`; empty text `Nothing is flagged for this meeting.`
- Property names: `frozen`, `raised_on`.

## Verification
Unit tests on fixtures (counts in the report); obsidian-check in a throwaway vault for pieces 3 and 4. Not verified: real Templater run of the changed Meeting template, phone, Tidy window look.
