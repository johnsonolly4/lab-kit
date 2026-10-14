# Design standard (shapes)

_Agreed 2026-10-14 (user: "the update is fine"; renders compared now / standard). Only corner shapes are written down so far; colours live in `kits/planning/.obsidian/snippets/vault-colours.css`, where CSS goes is in `docs/architecture.md`. Not audited yet: Alt+S snippet forms, calc tables, the rig diagram (`docs/plans/design-standard-pass.md`, Phase 4)._

Screenshots of looks the user approved are in `docs/reference/visual/` (read its README before changing a window or a chip).

## The four sizes
Defined once in `styles.css` (`body { --lk-radius-card … }`). New rules use the variable, never a number.

| Variable | Size | Use it for |
|---|---|---|
| `--lk-radius-card` | 14 px | Cards and tiles that hold other things (home / hub cards, the Plan tile), plugin windows (the entry window; Check setup and the other lab-kit windows once moved) |
| `--lk-radius-control` | 10 px | Buttons, text boxes, menus and dropdowns, plan map cards / tiles / boxes, pop-up boxes |
| `--lk-radius-row` | 6 px | A hover or selected row inside a menu or list |
| `--lk-radius-pill` | 999 px | Chips, badges, status marks (a round mark is a pill) |

Rules
- A box inside a box has a radius no bigger than its parent's. A row inside a menu is `row`, the menu is `control`, the window it opens from is `card`.
- Single-sided borders (a left accent bar) get no radius.
- Integrated plugins' own windows follow the user's theme; do not restyle them. Anything Lab Kit draws follows this table.
- Before adding a size, ask: a fifth size needs the user's OK and a line here.

## Groups that fold
A group that opens and closes is a box with a header row: chevron, title, a count at the right (and a muted line under the title when it helps), as in the Tidy up notes window. Use `winFold` in `src/kit/window-look.ts`, not the browser's `<details>` triangles. Chosen by the user 2026-10-14 (option B of three renders). Done so far: Review update, Manage kit files and the Kit update report. Still `<details>`: the install confirmation, the merge preview, Tidy up notes' "Notes" and "New page" lines (`docs/plans/design-standard-pass.md`).

## The window rule (dimming and place)
A window the plugin opens either has something on screen to point at, or it does not.
- Opened from highlighted text: just under the highlighted line, the line underlined, no dimmed background.
- Opened by clicking a button (a plugin button, a Meta Bind button): just under that button, no dimmed background.
- Opened with nothing to point at (a hotkey, the command palette): in the middle, background dimmed.
Code: `buttonAnchor` and `selectionAnchor` in `src/planning/entry-window.ts`; `openEntry` applies the rule, so every window that uses it follows it.

## Where it applies today (checked 2026-10-14, read from the CSS, not measured on screen)
- Already on the standard: home / hub cards (14), hub buttons (10), badges (pill), plan map cards, tiles and the new-to-do box (10), the entry window, its chips and its dropdown (built on it 2026-10-14).
- Done in `styles.css` (Phase 1, 2026-10-14, not seen): every Lab Kit corner uses the variables, except inline marks in calc table cells (3 px), the hazard chips (3 px) and the sub-tile grip (4 px); `tests/plan-map-styles.test.ts` lists them with the reason and fails on a new bare number.
- Still to move in the pass: windows 12 to 14 (Check setup, Tidy, Manage files); the theme snippet's 10 px / 8 px literals. See `docs/plans/design-standard-pass.md`.
