# Plan: Kit files / update report window polish

_Planned: 2026-10-14 (user: 5 screenshots + chat after the boxed folds; recorded in BACKLOG "USER RESULT 2026-10-14 (5 screenshots"). Each phase = one session, Sonnet, started with `Read STATUS.md and continue`. Every phase: read `docs/design-standard.md` and `docs/reference/visual/README.md` first (the Tidy up notes window is the look to match; the one approved image is the entry window), end with a checklist 6i row, "not seen in Obsidian" until the user tries it._

## Goal
The Review update… ("Kit files") window and the Kit update report look like one finished screen: right words, no clipped or overlapping parts, one list of what needs updating, even spacing.

## Out of scope
Colours and corner sizes (`design-standard-pass.md`), the other `<details>` (install confirmation, merge preview, Tidy "Notes"; that plan's Phase 6), the to-do cursor (separate BACKLOG item), releasing, pushing.

## Questions for the user before Phase 1 (ask once, multiple choice)
1. "Apply" → "Update": only in the Kit files window (button, intro line, confirmation)? The merge window (`src/kit/merge-ui.ts:75,90`) and the moved-folders window (`moved-folders-ui.ts:74`) also say "Apply". Recommended: change the Kit files window and its confirmation only; leave the other two (they do not update kit files).
2. Phase 3 shape: recommended **A**: one box "To update (N)" at the top of the window listing every file that needs an update, each row tagged with its kit name; the per-kit folds below hold only the rest (up to date, kept). Alternative B: keep per-kit folds but always open and sorted first. Mock up A in one render before building.

## Phases

### Phase 1: wording (small)
- Files: `src/kit/managed-ui.ts` (`drawFoot` ~569-579: `Apply (N files)` → `Update (N files)`, `Apply` → `Update`; intro line ~475 "press Apply" → "press Update"; `applyReviewed` ~366-372 title "Apply these changes?" and `yes: "Apply"`), `src/kit/kit-set-ui.ts:21` (same title / yes), tests that quote the strings (grep `Apply`).
- Done when: tests, lint, checklist row, changelog line; nothing else renamed.

### Phase 2: clipping and overlap (needs diagnosis first)
- Seen: (a) a fold header's grey band meets the white body with no gap and the chevron looks cut at the header's edge (screenshots 1, 2, 5); (b) the "Kept: files you are meant to edit (your settings); the kit never update…" header: title runs under the count "1" and is cut off; (c) a header divider line under "Updated" sits inside the box.
- Cause not known. Start by reading `winFold` (`src/kit/window-look.ts:36`) and `.lab-kit-fold*` (`styles.css:456-465`); likely: `.lab-kit-fold { overflow: hidden }` with the header's own background, title with `overflow-wrap: anywhere` but no `min-width: 0` / wrap on the text column when `sub` / `count` are long, nested folds taking the parent's body padding. Ask the user for one more screenshot at a narrower window if it cannot be reproduced from the CSS.
- Fix: header text column wraps (or ellipsis with the full text in a `title` tooltip), count never overlaps; chevron box with explicit padding; body padding top so the first line does not touch the header. A test in `tests/managed-look.test.ts` for what is testable (class names, long title keeps the count in its own element).
- Done when: tests, lint, row; screenshots from the user at two widths.

### Phase 3: updates out of their kit (design choice, then build)
- After the user's answer to question 2. Files: `src/kit/managed-ui.ts` (`KitReviewSection` ~455-540: split drawing into "needs update" rows and "the rest"; `KitReviewModal` ~542-590: draw one top box from all sections, then the kit folds), `window-look.ts` if a tag chip is needed, `styles.css`, tests (`tests/managed-look.test.ts`, `kit-set.test.ts`: ticks still reach each kit's `select`; the foot's count still adds up across kits; the one-kit case looks right too).
- Rule: ticking a row in the top box writes through the same `sec.select` as before (no change to what Apply / Update writes).
- Done when: tests; the Apply/Update confirmation lists the same files as before; row.

### Phase 4: the Kit update report in the new look
- Files: `KitReportModal` (`src/kit/managed-ui.ts` ~760-785: the `details` / `summary` groups at 775 and 807 become `winFold`; counts line like the Kit files window; the left-alone rows keep their `i` mark), `styles.css`, tests.
- Done when: no `<details>` left in that modal; tests; row.

### Phase 5: spacing audit
- Seen: more space above the "CSS snippet" row than elsewhere (Planning kit box, `managed-ui.ts` ~741+). Audit every `.lab-kit-*` block in the Kit files window, the report, Manage kit files and Check setup for the vertical gaps between a fold body, a setting row and a heading; pick one block gap (`var(--size-4-3)`) and apply it in one place (CSS) instead of per-element margins.
- List what was checked and what was changed in the checklist row; screenshots from the user before / after go in `docs/reference/visual/` only when they say the screen is right.
- Done when: tests; row; user's check.

## After the phases
Ask the user whether to save the finished Kit files window and report as references in `docs/reference/visual/README.md`.
