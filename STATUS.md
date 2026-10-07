# Status

_Updated: 2026-10-07 by Opus 5.5 (Phase 4b planned with the user, 4b-1 and 4b-2 built and reviewer-checked; earlier: Phases 2, 3, 4a unattended). Cap 40 lines. History lives in git and `docs/changelog.md`, not here._

**Version:** 0.5.2 (plugin + kit; moves only at `/release`; TypeScript in `src/`)

## Now
Phases 0–4 built and committed, not pushed (Phase 4 "roll-over seen in test-vault" still open: the planning kit cannot be installed from the UI yet). `fix/34-user-scripts-folder` (PR #37) → `feat/multi-kit` (1a–4b, stacked on it; no PR yet). Tests 289 pass; nothing seen in Obsidian (BACKLOG "Not yet tested").

## Next (ordered: top item is the next session)
Plan: `docs/plans/planning-suite-kit.md` (phases 0–8; one per session)
1. Feedback round: user fills the feedback page, then `/feedback` — done when: items sorted into `BACKLOG.md`
2. Phases 5–8: per plan (Phase 5 or 6 next; either order)
3. "Make my own copy" snippet and per-snippet script files (BACKLOG "v0.4 quick changes") — plan first (`/phase-plan`)
4. Sample creation workflow: its own session, with a real example (BACKLOG "Decisions needed")

## Running
None.

## Waiting on owner (needs a human)
- [ ] Merge PR #37 (`fix/34`), then review `feat/multi-kit` and say "push" for its PR — by 2026-10-09
- [ ] Check the decisions taken while you were away: `docs/decisions.md` (2026-10-07, "Claude, unattended"), BACKLOG "Leftovers" (Phase 2, Phase 3) — by 2026-10-09
- [ ] Supply the New concept template / knowledge rules, and check the font licence (BACKLOG "Decisions needed")
- [ ] Review the confirmation dialog's wording (written unattended; BACKLOG "Not yet tested", Phase 1b) — by 2026-10-09
- [ ] Try Phase 2 in test-vault: checklist 6d, and 9 (settings at phone width)
- [ ] Try issue #34 in test-vault (checklist section 2, "Your scripts folder is kept")
- [ ] Copy the personal preferences file from the adoption session to `~/.claude/CLAUDE.md`; add `/opt/homebrew/opt/node@20/bin` to your PATH (Node 20 installed 2026-10-07) — by 2026-10-08
- [ ] Try 0.5.1 in Obsidian: checklist 6b, sections 1 and 2; Solution prep (6b) with one real stock solution; Analysis methods (6c)
- [ ] Local `dist/` and `legacy/main.js` (gitignored, this machine only): keep or delete

## Known issues
- `npm run lint`: 0 errors, 2 sentence-case warnings left on purpose (BACKLOG "Repo / release")
- Many features are tests-only, not seen in Obsidian: BACKLOG "Not yet tested by the user"
- Git identity: commits use the global `~/.gitconfig` noreply address (set 2026-10-04 after a push was refused for the private email)
