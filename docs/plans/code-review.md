# Plan: whole-plugin code review before release

_Agreed: 2026-10-21. Written by `/phase-plan`. Each phase = one session._

**Status (2026-10-21):** planned, not started. Waits for the Templater replacement (`docs/plans/templater-replacement-and-live-snippets.md`, P0-P13) to be built: the owner put that rewrite before the release, so the review runs once on the code as it will ship.

## Goal
Before the next release, a read-only review of all plugin code finds the bugs that cost data, give wrong numbers, break on a platform or fail the store review, ranked so the fix sessions can start from the top.

## Decision taken
- Fable 5.1 where a missed bug is expensive (numbers, writes to the owner's notes, platform and store rules) and for the final cross-area pass; Opus 5.5 for the large UI areas; Sonnet for the mechanical start and the test-gap pass (owner, 2026-10-21).
- Findings go to one report, `docs/reviews/code-review-<date>.md`; BACKLOG gets one section "Code review <date>" with an unticked item per finding that needs a fix, pointing at the report (owner, 2026-10-21).
- Read only: review phases never change code, tests, kit files or styles. Fixes are planned afterwards from the ranked list, one task per session (owner, 2026-10-21).
- Snapshot: `overnight/2026-10-19` (or the branch it becomes) after Templater P13, before the release trial (owner, 2026-10-21: "Templater before release").
- Rejected: Fable on every phase (about 2.5 times the tokens on the UI half for little gain); Opus with Fable only on the engine (misses data safety); BACKLOG only (too long to rank in); fixing small bugs during the review (mixes review and change); reviewing `main` (382 commits behind).

## Out of scope
- Fixing anything (the fix plan comes from the report).
- `docs/` prose (a later Haiku pass checks docs against the code).
- `my_work/`, `test-vault/`, the owner's real vault.
- Look and wording choices (BACKLOG "Questions for the owner" as usual); new features.
- A coverage tool (`@vitest/coverage-v8` would be a new dependency, not agreed).

## How every review phase works
- Model and effort: as named in the phase. Fable phases at `xhigh` effort.
- Start: `git rev-parse HEAD` written into the report section (every phase reviews the same commit as R0). Read only the phase's files; big files through `python3 scripts/codemap.py FILE` and offset reads (CLAUDE.md).
- The only file written is the phase's section of the report (plus the R8 BACKLOG section). Scratch scripts and throwaway tests go in the session's scratchpad, never in the repo. `python3 scripts/check.py` may be run, never edited around.
- One finding per entry:
  `CR-<phase>-<n> · severity · path:line · what goes wrong · when (input or steps) · evidence: reproduced (scratch test / script, saved path) | read only (why believed) · rule broken, if any`
- Severity: **S1** data loss or a wrong number in a note · **S2** crash, a write that half-happens, or a store-review rejection · **S3** wrong on one platform (Windows, Linux, phone) or slow on a big vault · **S4** smaller faults, dead code, a missing test for risky code. No style comments.
- A clean area is reported as "none found", with what was checked.
- End: commit the report section (`git add docs/reviews/...`; message "Code review R<n>: <area>"); LOG entry; no STATUS edit except the phase line.

## Phases

### Phase R0 — Baseline and file map (Sonnet)
- Depends on: Templater P13 built and merged into the review branch.
- Files: new `docs/reviews/code-review-<date>.md` (skeleton: commit, test count, lint, build, one section per phase with its file list).
- Work: `python3 scripts/check.py --build`; run `node scripts/smoke.mjs` if the owner agrees (it starts Obsidian); measure characters per phase file list (as in this plan's table, refreshed for the new `src/blocks/` and `src/snippets/` folders from the Templater rewrite); every file in `src/` and `kits/` is in exactly one phase list.
- Done when: check PASS recorded; a script in the scratchpad confirms that the phase lists cover `git ls-files src kits styles.css` once each (count printed in the report); the skeleton is committed.

### Phase R1 — Engine and numbers (Fable 5.1)
- Depends on: R0.
- Files: `src/calc/`, `src/chem/`, `src/solution/`, the Templater rewrite's `src/blocks/` (live-block core, RAFT, recipe, results) and `src/snippets/methods.ts`; date maths in `src/planning/todo.ts`, `due-words.ts`, `quick-todo.ts`, `board-week-nav.ts`; `src/planning/plan-open.ts` (counts and layout numbers); the matching tests and fixtures.
- Look for: wrong formulas, units, rounding and significant figures, empty / zero / negative / huge inputs, parse cases (commas, units, unicode), time zones and week boundaries (Sunday, year end, daylight saving), anything that rounds before it sums.
- Done when: known answers re-run and recorded (0005 RAFT Mn = 19990.14; 0011 reactor volume = 1.7591 mL; the solution and RAFT fixtures of the rewrite); every exported calculation function is listed with "checked" or a finding; each S1 / S2 finding has a scratch test that shows it, or says why one cannot be written.

### Phase R2 — Data safety: everything that writes to the vault (Fable 5.1)
- Depends on: R0.
- Files: `src/kit/managed.ts`, `managed-ui.ts` (write paths only), `merge.ts`, `backups.ts`, `moved-folders.ts`, `kit-set.ts`, `starter.ts`, `tidy.ts`, `tidy-apply.ts`, `tidy-hubs.ts`, `style-all-notes.ts`, `snippet-copy.ts`, `snippet-insert.ts`; `src/close/`; freeze of meeting notes; planning writers (`dropPatch`, `tickPatch`, the Undo notice, Close the week, todo-note writes); rig snapshot and layout writers (`src/rig/snapshot.ts`, `layout.ts`); the Templater rewrite's migration Tidy rules and data.json reading.
- Look for: a write without a backup where the plan promised one; partial writes on error; two writes racing (two windows, Sync, a second device); a rule run twice changing more the second time; trash vs delete; front matter rewritten beyond the changed key; paths typed by the user without `normalizePath()`; old data.json keys.
- Done when: every function that calls `vault.modify` / `process` / `create` / `delete` / `trash` / `rename`, `processFrontMatter` or the adapter (listed by grep, count in the report) is marked "checked" or has a finding.

### Phase R3 — Platform and store rules (Fable 5.1)
- Depends on: R0.
- Files: all of `src/` for the rules only (grep-led), and in full: `src/node.ts`, `src/platform.ts`, `src/kit/obsidian-private.ts`, `src/main.ts`, `manifest.json`, `styles.css` (rules, not looks).
- Look for: every rule in `.claude/rules/obsidian-plugin.md` and `docs/reference/plugin-guidelines.md` (innerHTML, inline styles, global `app`, lookbehind, `require` outside `node.ts`, private APIs not isolated, unregistered listeners / timers / blob URLs, default hotkeys, settings headings); desktop-only code reachable on a phone; Windows paths and line endings; work on every file of a big vault (compare `docs/plans/stress-test-result.md`).
- Done when: one grep per rule with its count in the report; each hit is "allowed (why)" or a finding; unload checked for every `register*` / `setInterval` / `addEventListener` outside `register*`.

### Phase R4 — Kit windows and settings (Opus 5.5)
- Depends on: R0.
- Files: the rest of `src/kit/` (UI files, snippet menu / form / run / settings / icons, setup check, hotkey check, clone, lab entry, data folder, zotlit, window look, settings box), `src/header/`, `src/main.ts` command wiring, `kits/` snippet and template files (logic, not wording).
- Look for: wrong state after cancel / Esc, windows that leak or open twice, settings saved before they load (the 1.13.7 freeze rule), commands without a guard on the wrong note type, snippet headers parsed wrongly.
- Done when: every command id in `main.ts` is traced to its handler and marked; findings recorded.

### Phase R5 — Planning (Opus 5.5)
- Depends on: R0.
- Files: `src/planning/` except the date and layout maths reviewed in R1 (board, plan map drawing, slide, button bar, project bar, chip bar, entry window, engine, commands).
- Look for: list / board / map disagreeing on the same to-do; cards lost on drag; stale views after a rename or a tick; SVG and blob URL clean-up; behaviour with 0, 1 and 500 to-dos.
- Done when: the views that show to-dos (board, Home, hub tiles, plan rows, map, slide, picture block) are listed with the function each reads through, and any that reads differently is a finding.

### Phase R6 — Rig, lab board, close UI and the rest (Opus 5.5)
- Depends on: R0.
- Files: `src/rig/` (except the writers in R2), `src/lab/`, `src/close/ui.ts`, `src/` top-level files not covered above, `styles.css` selectors that code relies on (class names used in `src/` that have no rule, rules no code uses).
- Done when: every file in the R6 list is marked; findings recorded.

### Phase R7 — Tests (Sonnet)
- Depends on: R1-R6 (uses their lists of risky functions).
- Files: `tests/` (read), the report.
- Look for: risky functions from R1-R6 with no test; tests that assert nothing or only that no error was thrown; `skip` / `only` / `todo`; fixtures that no test reads; tests that hit real time without a fixed clock.
- Done when: a table "risky function → test file or none" in the report.

### Phase R8 — Synthesis and fix list (Fable 5.1)
- Depends on: R1-R7.
- Files: the report; code only to re-check findings; `BACKLOG.md` (one new section); `STATUS.md` → Next.
- Work: merge duplicates; look for faults that cross areas (a writer in R2 fed a number from R1, a view in R5 hiding a write fault); re-read the code for every S1 and S2 and mark each "confirmed" or "not confirmed"; rank; group the fixes into one-session tasks with a model each.
- Done when: every finding has a final severity and a confirmed / not-confirmed mark; BACKLOG section "Code review <date>" lists every S1-S3 as an unticked item with its CR id and file:line; S4 stay in the report only; STATUS Next lists the fix sessions in order, ahead of the release trial.

## Size (measured 2026-10-21 on `overnight/2026-10-19`, characters; refresh in R0)
| Area | Characters |
|---|---|
| `src/kit/` | 548 487 |
| `src/planning/` | 464 281 |
| `src/rig/` | 92 692 |
| `src/solution/` | 70 832 |
| `src/calc/` | 68 364 |
| `src/close/` | 30 294 |
| `src/header/` | 27 557 |
| `src/lab/` | 25 447 |
| `src/` top level | 16 226 |
| `src/chem/` | 5 813 |
| `kits/` | 240 652 |
| `styles.css` | 76 132 |
| `tests/` | 1 354 769 |

Every phase fits one context: the largest file list (R4 or R5) is about 0.5 M characters, roughly 150 k tokens (estimate, not measured with the token counter).

## Order
R0 first. R1-R6 depend only on R0 and touch different report sections, so they can run in parallel sessions (one writer per report section; each commits only its section). R7 needs R1-R6; R8 needs R7. The fix sessions R8 lists come before the release trial.

## Verification
- Known answers (0005, 0011, the rewrite's fixtures) re-run in R1.
- Every S1 / S2 finding is either reproduced by a scratch test or re-read and confirmed by a second model in R8; "not confirmed" stays visible in the report.
- Coverage of the review itself: R0's script shows every source file belongs to one phase; R2 and R3 report their grep counts, so a missed writer or rule hit shows as a count mismatch.
- Not covered: behaviour only seen in Obsidian (the fix sessions use obsidian-check), Windows and Linux machines (read only), the owner's eye.
