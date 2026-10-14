# Design standard (shapes)

_Agreed 2026-10-14 (user: "the update is fine"; renders compared now / standard). Only corner shapes are written down so far; colours live in `kits/planning/.obsidian/snippets/vault-colours.css`, where CSS goes is in `docs/architecture.md`. Not audited yet: Alt+S snippet forms, calc tables, the rig diagram (`docs/plans/design-standard-pass.md`, Phase 4)._

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

## Where it applies today (checked 2026-10-14, read from the CSS, not measured on screen)
- Already on the standard: home / hub cards (14), hub buttons (10), badges (pill), plan map cards, tiles and the new-to-do box (10), the entry window, its chips and its dropdown (built on it 2026-10-14).
- Moves in the pass: plan map pop-up menu 8 to 10 and its rows 4 to 6; the 12 places with 3 px and other odd corners in `styles.css`; windows 12 to 14 (Check setup, Tidy, Manage files); the theme snippet's 10 px / 8 px literals. See `docs/plans/design-standard-pass.md`.
