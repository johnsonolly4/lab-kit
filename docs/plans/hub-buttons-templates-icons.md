# Plan: hub buttons, meeting templates, snippet icons, hub updates

_Agreed: 2026-10-10. Written by `/phase-plan`. Each phase = one session. Source: BACKLOG "Feature test 2026-10-10"._

## Goal
Nine open items from the feature test: hubs get the buttons the user asked for, one-off meetings get a small template (and a series can name its own), existing hubs can be brought up to the current template, Home / Shopping list lose the focus text, and the snippet icon settings show real icons.

## Decisions taken (user, 2026-10-10 survey)
- **Update existing hubs:** a Tidy up notes rule rewrites a hub's body from the template (preview first, keeps Status, deadline, goal). Rejected: tile blocks only; manual how-to.
- **One-off template:** the kit ships a small `One-off meeting.md` (To discuss, Flagged for this meeting, Notes); every series hub may carry an optional `template` property (empty = `Meeting.md`). Rejected: global setting only; property with no kit template.
- **Focus:** delete the three focus lines on Home (no Focus block). The Shopping list note has no focus text; the "lab orders" / lab-only wording is in the Vault spec and gets removed there.
- **Snippet icons:** a collapsible "Snippet icons" group in settings; the box shows the template's `icon:` as the default (not written into settings) and gets an icon picker showing the real icons (Obsidian's `getIconIds()` + `setIcon`; the set is Lucide, built into Obsidian, nothing to store).
- Claude's choices (the user can overrule): the three new hub buttons are code blocks like `project-actions` (no new Meta Bind ids, so no restart / Check setup step); back-to-hub finds the parent hub by folder at render time, so folder renames never break it; the stacked chips are CSS only.

## Out of scope
- A Focus block from ticked to-dos.
- Changing existing Home notes (Home is `policy: keep`; the user deletes the lines or uses Replace with new version…).
- The Sort inbox, calc caret and other retest items.

## Phases

### Phase 1 — Small text and CSS fixes
- Files: `kits/planning/00 Home.md` (focus lines and their `focus1…3` properties), `kits/planning/07 How-tos/Obsidian/Vault spec.md` (Shopping list wording), `kits/planning/.obsidian/snippets/vault-theme.css` (stacked `active` / `deadline` chips on project cards, `src/planning/blocks.ts:284-303` for the markup), `npm run kit:manifest`, tests for the Home text.
- Done when: tests + lint pass; no `focus` text left in Home; Vault spec has no "lab only" / lab orders wording; chips stack in a screenshot the user checks.
- New dependencies: none

### Phase 2 — Hub buttons as blocks
- Files: `src/planning/blocks.ts` (new `back-to-hub`, `topic-actions`, `series-actions` blocks; parent hub found by folder), `Project hub.md`, `New topic hub.md`, `Meeting series.md`, `src/planning/commands.ts` (New concept into the hub's folder without asking the topic; `new-extra-meeting` for the series of the open hub), tests (rename a folder, the button still finds its hub).
- Done when: tests cover the three blocks and a renamed folder; the unknown-block message lists them; new hubs from the templates carry the blocks.
- Depends on: none (Phase 5 carries them to old hubs)

### Phase 3 — One-off meeting template + per-series template
- Files: new kit template `kits/planning/Extras/Templates/One-off meeting.md`, `src/planning/commands.ts:116-182` (template choice), `src/planning/meetings.ts` (`template` in `parseSeries`), `Meeting series.md` (property), New meeting series (optional box), `docs/`, tests, `npm run kit:manifest`.
- Done when: tests for one-off, series with `template`, series with a missing template file (falls back to `Meeting.md` with a notice).
- Depends on: none

### Phase 4 — Snippet icons group and picker
- Files: `src/kit/ui.ts:29-62`, a new icon picker modal (grid from `getIconIds()`, search box), `styles.css`, tests for what can be tested headless (default icon from the `icon:` header, copies inherit).
- Done when: tests + lint pass; the user sees the group collapsed, empty boxes showing the default icon, and the picker in Obsidian.
- Depends on: none

### Phase 5 — Tidy rule: bring existing hubs up to the template
- Files: `src/kit/tidy.ts:302-342` (new group next to `project-hub-missing`), `src/kit/tidy-ui.ts:68`, tests in `tests/tidy-meetings.test.ts`.
- Rule: for project, series and topic hubs, replace the body below the frontmatter with the template body only where the note's body still matches an older kit body or the user accepts the preview; keep Status, deadline and goal text. Preview shows the diff.
- Done when: tests with an old-style hub (no new blocks) produce a preview and, applied, a hub with the Phase 2 blocks and the same Status / deadline / goal.
- Depends on: Phases 2 and 3 (the template text it applies)

## Verification
Tests per phase; each phase is "tests only, not seen in Obsidian" until the user tries it (checklist 6i, last row). Phase 2 and 4 UI need the user's eyes.
