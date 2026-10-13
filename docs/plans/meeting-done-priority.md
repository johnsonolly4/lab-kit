# Plan: Meeting notes list only the prioritised finished to-dos

_Written and built 2026-10-13 (Sonnet). One phase; every decision was the user's (chat 2026-10-13) except the "not listed" line._

## Goal
The **Done this week** list on a meeting note shows only finished to-dos that have a priority, so the many small to-dos do not clutter the meeting.

## Decision taken
User, 2026-10-13: a finished to-do is listed only when its `priority` is 1, 2 or 3; always on (no setting); ticked subtasks (a to-do with `sub`) are not listed; to-dos flagged for the meeting always show (they are a different list: open to-dos, `Flagged for this meeting` in the template, untouched).
- Where it applies, by the explorer's search 2026-10-13: only `show: meeting-done` (`kits/planning/Extras/Templates/Meeting.md:48-51`, `src/planning/lists.ts` `meetingDone`, `src/planning/blocks.ts`). The weekly review note lists no finished to-dos, "This week" lists open ones, the daily note lists the day's ticked ones (a daily log), the project hub's collapsed "Done to-dos" is a project view: none of those change.
- Claude's choice (the user did not answer): under the list one muted line says how many finished to-dos without a priority are not listed and how to get one listed ("Give a to-do a priority (1 to 3) to list it here."), so nothing disappears silently. It adds one line only when something is left out.

## Out of scope
- The project hub's "Done to-dos", the daily note's ticked list, the flagged list.
- A setting to turn the filter off.

## Phase 1 — The filter (done 2026-10-13)
- Files: `src/planning/lists.ts` (`hasPriority`, `meetingDone` returns the lines and how many were left out), `src/planning/blocks.ts` (the empty-list text, the muted line), `tests/planning-lists.test.ts`, docs (changelog, Vault spec, checklist).
- Done when: tests cover priority 1, 2, 3 shown, none / 0 / 4 / text left out and counted, a ticked subtask not shown and not counted, the date window unchanged; lint and build clean; NOT seen in Obsidian until the user opens a meeting note.
