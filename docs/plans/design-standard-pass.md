# Plan: move the older screens onto the shape standard

_Agreed: 2026-10-14 (user: write the standard, then one planned pass). Standard: `docs/design-standard.md`. Each phase = one session, Sonnet. Visual changes are small (see the zoomed renders in the 2026-10-14 chat); each phase ends with a "not seen in Obsidian" checklist row._

## Goal
Every plugin-drawn shape uses the four sizes, so home, the plan map, windows and new features look like one product.

## Out of scope
Colours, spacing, fonts; Obsidian's own windows and other plugins' screens (they follow the theme).

## Phases

### Phase 1: `styles.css` literals
- Files: `styles.css` (the `.vt-map*` pop-up menu `.vt-map-pop` 8 to `control`, its rows to `row`; `.lab-kit-*` windows' boxes; the 12 `3px` and the `9px 0 0 9px` / `7px 0 0 7px` grip corners: find what each belongs to first and decide: a 3 px inline mark may stay as a `row`), `tests/plan-map-styles.test.ts` (add: no bare `border-radius: Npx` outside a short list of allowed exceptions, with the reason in the list).
- Done when: the new test passes; list of exceptions each with a reason; checklist row; not seen.

### Phase 2: windows at 14 px
- Files: `styles.css` (a class on the lab-kit windows: Check setup, Tidy, Manage files, Review update; set `--modal-radius: var(--lk-radius-card)` on them), the window classes in `src/kit/*-ui.ts` that make them (find with the `lab-kit-win` class).
- Done when: tests; checklist row; not seen on a light and a dark theme.

### Phase 3: theme snippet literals
- Files: `kits/planning/.obsidian/snippets/vault-theme.css` (the `10px` / `8px` literals and `--vt-card-radius: 14px` in `vault-colours.css` stay; map them to the same four numbers, with a comment pointing to the standard; the snippet is a vault file, so `npm run kit:manifest` and a Review update… note in the changelog).
- Done when: tests; manifest; not seen.

### Phase 4: audit what was not looked at
- Files: read-only first: Alt+S snippet forms (`kits/lab/Extras/scripts/templater/labForm.js`), calc tables (`styles.css` calc rules), the rig diagram renderer (`src/rig/`). Report sizes against the standard; changes only after the user agrees (they change what users see in the lab notebook).
- Done when: a short report in BACKLOG; the user decides.

## Verification
Beyond tests: side by side screenshots of home, a project hub with the plan map, the entry window with a dropdown open, and Check setup, before and after; the user looks (Claude cannot see Obsidian).
