# Plan: Experiments in the project plan

_Agreed: 2026-10-12 (user, chat). Written by `/phase-plan`. Each phase = one session. Part of `docs/plans/project-plan-priority.md` (comes before its Phase 4c)._

## Goal
A to-do in a project plan can name its experiment, and the plan map card (and the Plan list tile) shows that experiment's status, so the plan reads "run RAFT screen: Started".

## Decision taken
Option B (user, 2026-10-12): everything stays a to-do; a new optional property `experiment` on the to-do links to the lab note. The board, tick circle, Archive, date warning, dragging (4c) and List to sequence (4d) are unchanged. Rejected: experiments as their own cards (A): not on the to-do board, a second status vocabulary, the plan engine would read two kinds.
- Property: `experiment: "[[ABC0014-A]]"` (one link; user, 2026-10-12).
- Attaching: typed by hand only; the To-do template is not changed (user, 2026-10-12). A Lab Kit button that creates a to-do from a lab note is a possible later phase (below), not planned in detail.
- Card shows the experiment's `Status` as a badge, nothing else. Display only: the to-do's own tick, `blocked` and `after` do not read it; a Closed experiment does not tick the to-do.
- The Plan list tile shows the same badge.

## Facts from the code (2026-10-12)
- Lab note status is the property `Status`, values Planned, Started, Processing results, Closed (`kits/lab/03 Lab Book/Lab book base.base:13-17`; template default `Planned`, `kits/lab/Templates/Lab Book Template.md:39`). Lab notes have no `kind` and no `project`.
- Lab notes live in `kit.labFolder` (`src/kit/paths.ts:101`, default `03 Lab Book/Notes`); the blocks already list them with `this.owner.notesIn(lab)` (`src/planning/blocks.ts:163`).
- `readPlan` (`src/planning/plan.ts`) takes only the to-do notes and the hub; `PlanRow` and `planLines` carry the row to the map card and the Plan tile.

## Out of scope
- Syncing status to the to-do (Closed ticks it), blocking a to-do on an experiment, experiments as cards, several experiments per to-do.
- A New to-do "Experiment?" pick (not wanted now).
- Changing the lab note template or the Lab book board.

## Phases

### Phase 1 — Read the experiment in the plan engine (pure code)
- Model: Sonnet.
- `readPlan(todos, hub, labNotes?)`: a new optional third argument, the lab notes. `PlanRow.experiment: { name: string; path: string; status: string } | null`. The link is resolved like `after` (path or name) against the lab notes; `status` is the note's `Status` as written (trimmed; "" when empty).
- A link to a note that is not in the lab folder: `experiment` is `{ name, path: "", status: "" }` and a problem line: `"B" names experiment "X", which is not a lab note.` With no lab notes given (lab folder not set, or the argument left out) nothing is resolved and no problem lines are written, so existing callers and tests do not change.
- `hasPlan`: unchanged (an `experiment` alone is not a plan, as `due` alone is not).
- `planLines`: a badge with the status on a row whose experiment has one (`{ text: status, cls: "vt-badge vt-planned" }`), after the existing badges.
- Files: `src/planning/plan.ts`, `tests/planning-plan.test.ts`.
- Done when: tests for: status read; link by path and by name; empty status; unresolved link gives the problem line and no badge; no lab notes given gives no lookup; `planLines` badge; existing plan tests unchanged. `npm test`, `npm run lint`.

### Phase 2 — Draw it (map card, Plan tile) and document
- Depends on: Phase 1. Model: Sonnet.
- `src/planning/blocks.ts`: pass `this.owner.notesIn(lab)` (only when the lab folder exists and is set) to `readPlan` in `project-plan` and `project-map`.
- `src/planning/plan-map-render.ts`: a status badge on the card (next to priority / due); clicking the badge opens the experiment (`open()`, stops the card click); a card with an unresolved link shows no badge (the problem line under the map says why).
- Colour by status in `vault-theme.css` (`.vt-map-exp`, per status where the vocabulary matches Planned / Started / Processing results / Closed; anything else neutral). Card height may need one more row: check `CARD_H` in `src/planning/plan-map.ts` against the screenshot (cards were judged cramped once).
- Docs: changelog, Vault spec (To-do properties: `experiment`), checklist 6i row, `docs/architecture.md` unchanged, the example project in `test-vault` (give one to-do an `experiment` link to a test lab note).
- Done when: tests (the card badge is DOM: tests as far as cheap; the pure parts are in Phase 1); `npm run kit:manifest`; the user sees the badge on one real to-do.

### Later (not planned in detail; needs the user's go-ahead)
- A Lab Kit button on a lab note that creates a to-do for it with `experiment` filled (user idea, 2026-10-12). Open: which project (lab notes have none: ask, or the lab note's own project link if one is added); the lab kit works without the planning kit, so the button would show only when the planning kit is on.

## Verification
Real-machine check in `test-vault`: one to-do per Status value, a broken link, and the lab folder unset (no badge, no error).
