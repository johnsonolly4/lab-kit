# Plan map: zoom, and a picture of the plan for the weekly slides

Planned on Opus 2026-10-13 and approved by the user the same day; to be built on Sonnet, one phase per session (user: "Plan this then sonnet will complete"). Phase 1 DONE 2026-10-13 (Sonnet); the rest is not built. Tick each phase here when it is done.

## Context
User, 2026-10-13: "for the plan map, a zoom and an export button. The export is so I can add the tasks to my weekly slides, so the scripting will need to make sure it is visible on a slide. Completed tasks can be compacted to a list of tiles, then maybe anything more than 5 task blocks ahead also gets compacted?"

Decisions (user, 2026-10-13, asked as multiple choice):
- **Export**: a picture on the clipboard (PNG), pasted into the slides. Desktop only. Nothing saved in the vault.
- **Layout**: all three offered while it is tested: (a) compact with 5 steps ahead, (b) compact with the number asked, (c) the whole map restyled. So the export window has a layout choice and a number box.
- **Colours**: light, always (white background, dark text), whatever theme Obsidian is in.
- **Zoom**: three buttons (smaller, larger, fit) beside the flip button; for the open note, not remembered.

## How it works today (read before building)
- `src/planning/plan.ts`: `readPlan` → `Plan { rows: PlanRow[] }`; a `PlanRow` has `name`, `done`, `due`, `result`, `priority`, `blocked`, `afterPaths`, `subs`, `experiment`.
- `src/planning/plan-map.ts` (pure): `layoutPlan(plan)` → `PlanMap { cards (step, place), arrows, unlinked, startStep }`; `mapGeometry(map, extraHeight, direction)` → pixel positions and the arrows' SVG path text (`curves[].d`); sizes `CARD_W`, `CARD_H`, `GAP_X`, `GAP_Y`, `PAD` (`:87`).
- `src/planning/plan-map-render.ts`: `drawPlanMap` (`:153`) draws HTML cards and one SVG of arrows inside `.vt-map-scroll` > `.vt-map-canvas`; dragging a link measures with `getBoundingClientRect` (`:74-113`).
- `src/planning/blocks.ts:327-333`: the map's title row and the ⇄ / ⇅ flip button; the direction lives on the block (`this.direction`, `:57`), which is where zoom state goes too.
- Styles: `kits/planning/.obsidian/snippets/vault-theme.css:473-504` (`.vt-map*`). It is a kit file: `npm run kit:manifest` after editing, and users need Review update… for the theme.
- Plugin rules (`.claude/rules/obsidian-plugin.md`): no `innerHTML`, no inline styles (CSS variables through `setCssProps` are what the map already uses), desktop-only APIs behind `hasNode()` (`src/platform.ts`).

## Design

### The slide picture is built from the plan, not from the screen
A new pure module `src/planning/plan-slide.ts` (no DOM, no Obsidian) makes an **SVG as text** from the `Plan`. The window turns that SVG into a PNG. This keeps it testable, independent of the Obsidian theme, and avoids screenshotting the DOM (which the plugin rules make awkward).

1. `slideModel(plan, map, layout)` where `layout` is `{ kind: "compact"; ahead: number } | { kind: "whole" }`:
   - **compact**: `done` = finished to-dos (linked ones in step order, then unlinked) as tiles; `cards` = the open linked to-dos whose step is within `ahead` steps of the first open step (first open step = the smallest step that has an open card), re-numbered from step 0; `arrows` = only those between two shown cards; `later` = open linked to-dos beyond that, as tiles; `loose` = open to-dos with no links, as tiles.
   - **whole**: every linked to-do is a card (done ones marked done), no `later`; `loose` as tiles.
   - Subtasks are not drawn; a parent card shows its count (`subsLabel`, `plan-map.ts:20`).
2. `slideSvg(model, { title, width: 1920, height: 1080 })` → an SVG string, 16:9:
   - Fixed light palette (constants in the module): white background, near-black text, a muted grey for tiles, one accent for "next" cards, dashed border for blocked ones.
   - Top: the project's name. Then a "Done" row of ticked tiles, the cards with arrows in the middle, a "Later" row, a "Not linked" row. Empty rows are left out.
   - Cards are placed with the existing `mapGeometry` on the reduced map (direction `across`), then scaled as one group to fit the middle area. A card shows: title (wrapped to two lines by character count, then "…"), due date, priority arrow (↑ – ↓, as on the board), `→ result`, subtask count, experiment status.
   - Tiles wrap onto rows; when a row of tiles would not fit its area, the last tile is "+N more".
   - **Readable on a slide** is a number, not a look: the function also returns `minText`, the smallest text size in the picture in slide pixels. The window warns when it is under 22 (at 1920 wide; about 11 pt on a standard slide) and says "use fewer steps ahead".
   - All text goes through one XML-escape helper. No text measuring (no DOM): widths are estimated from character counts with a fixed per-character factor; keep generous margins.

### The export window — `src/planning/plan-slide-ui.ts`
- Opened by a new button in the map's title row (`blocks.ts:329`, icon button like the flip one, `aria-label` "Picture for a slide"). Shown only when `hasNode()`.
- A modal: **Layout** drop-down (Done and later as tiles / The whole map), **Full cards for the next N steps** number box (5; only for the first layout), a live **preview** (an `<img>` whose `src` is a blob URL of the SVG, made with `createEl`; revoke the URL on close), the readability warning line, and **Copy picture**.
- Copy picture: draw the SVG image onto a 1920 × 1080 `<canvas>`, `toBlob("image/png")`, `navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])`, then a Notice "Picture copied: paste it into your slide." On failure a Notice says so; nothing else happens.
- Layout and number are remembered for the session on the block (not a setting) while this is being tested.

### Zoom
- State on the block next to `direction` (`blocks.ts:57`): `zoom: number` (1 = today's size), not saved.
- Three buttons after the flip button: − (down 0.1, floor 0.4), + (up 0.1, ceiling 1.6), Fit (the scroller's width ÷ the map's width, capped at 1). Each redraws the map.
- `drawPlanMap` gets `zoom` in `MapOptions`, sets `--vt-map-zoom` on the canvas with `setCssProps`, and the theme applies `zoom: var(--vt-map-zoom, 1)` to `.vt-map-canvas`. The scroll-to-start positions (`g.scrollLeft` / `g.scrollTop`) are multiplied by the zoom.
- **Risk to check first** (spike, before anything else in this phase): link dragging measures screen positions (`plan-map-render.ts:74-113`) and draws the temporary arrow in map coordinates. With CSS zoom those differ by the zoom factor: divide the measured offsets by `zoom` in `at()`. If CSS `zoom` misbehaves in Obsidian's Chromium, fall back to multiplying the geometry constants (pass a scale into `mapGeometry`) and scaling fonts with a CSS variable.

## Phases (one session each; tests and lint pass before the next)
1. **Slide model and SVG (pure). DONE 2026-10-13** (`slideModel(map, layout)` takes the `PlanMap` only, not the `Plan`: nothing else was needed; `slideSvg` returns `{ svg, minText, tooSmall }`, `MIN_READABLE` = 22; 12 tests; the example's SVG was turned into a PNG and looked at, compact and whole). `src/planning/plan-slide.ts`, `tests/plan-slide.test.ts`. Done when: the tests below pass, and one generated SVG for the test-vault's "Plan map example" project has been turned into a PNG and looked at (see Verification).
2. **Export window and the button.** `plan-slide-ui.ts`, `blocks.ts`, theme CSS for the button, `npm run kit:manifest`. Done when: tests and lint pass; the copy path is "not seen in Obsidian" until the user pastes one into a slide.
3. **Zoom.** Spike first (the drag risk), then `blocks.ts`, `plan-map-render.ts`, theme CSS, a test for the fit and clamp arithmetic (put it in a pure helper in `plan-map.ts`).
4. **Docs.** `docs/changelog.md`, `docs/tutorial.md` 8.4, `How my vault works.md` (the project plan callout), `Vault spec.md` (Plan map row), `docs/architecture.md` (two new files), `docs/obsidian-test-checklist.md`, README Mobile ("the slide picture is desktop only") and Privacy (the clipboard: a picture, only when you press Copy picture).

## Tests (phase 1)
- compact, ahead 5: done to-dos are tiles and not cards; cards are exactly the open ones within five steps of the first open step; later ones are tiles; arrows only join shown cards.
- ahead 1 and ahead 99; a plan with nothing done; a plan with everything done (no cards: the picture is tiles only); a plan with no links at all.
- whole: every linked to-do is a card.
- the SVG: starts with `<svg`, has `viewBox="0 0 1920 1080"`, contains each shown title once, escapes `&`, `<`, `"` in a title, has no `<script` and no external reference (`href=` to http).
- `minText` falls as `ahead` grows on a wide plan, and the "too small" flag is set past the threshold.
- Use the plan fixtures the map tests already build (`tests/plan-map*.test.ts`); no new fixture format.

## Verification
- `npm test`, `npm run lint` (0 errors), `npm run build` each phase.
- Phase 1, by eye, without Obsidian: write one SVG to the session scratchpad, convert with `qlmanage -t -s 1920 -o <dir> file.svg` (macOS, present on this machine) and read the PNG. Check the text is readable at slide size and nothing overlaps.
- Only the user can check: the picture pasted into a real slide (PowerPoint or Google Slides), the button in the hub, zoom with a drag-link in Live Preview and Reading view. Each gets a checklist row and stays "not seen in Obsidian" in BACKLOG until reported.

## Out of scope
- Saving the picture as a file, SVG export, dark pictures, remembering zoom or the export choices in settings (all were options the user did not pick; easy to add later).
- Mobile export. Ctrl / Cmd + scroll zoom.
- Changing what the on-screen map shows.
