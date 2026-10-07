# Status

_Updated: 2026-10-07 by Opus 5.5. Cap 40 lines. History lives in git and `docs/changelog.md`, not here._

**Version:** 0.5.2 (plugin + kit; moves only at `/release`; TypeScript in `src/`)

## Now
Nothing in progress. Planning-suite plan checked with `/phase-plan` (`docs/plans/planning-suite-kit.md`). Starter-kit adoption done on `adopt/starter-kit` (not pushed).

## Next (ordered: top item is the next session)
Plan: `docs/plans/planning-suite-kit.md` (phases 0–8; one per session)
1. Phase 0: issue #34, never change a set Templater user scripts folder; lab scripts in `<folder>/lab-kit/` (needs `adopt/starter-kit` merged; plan mode first: 5 files) — done when: plan's Phase 0 tests (a)–(e) pass
2. Feedback round: user fills the feedback page, then `/feedback` — done when: items sorted into `BACKLOG.md`
3. Phase 1a: multi-kit manifest, `kit/` → `kits/lab/`, no behaviour change — done when: per plan
4. Phase 1b: confirmation dialog, `Extras/` defaults, `policy: keep` — done when: per plan
5. Phase 2: lab kit completion (issues #32, #33, `new-lab-entry`, settings at phone width) — done when: per plan
6. Phases 3–8: per plan
7. "Make my own copy" snippet and per-snippet script files (BACKLOG "v0.4 quick changes") — plan first (`/phase-plan`)
8. Sample creation workflow: its own session, with a real example (BACKLOG "Decisions needed")

## Running
None.

## Waiting on owner (needs a human)
- [ ] Review branch `adopt/starter-kit`, push it and open the PR; check the new Tests workflow runs green on GitHub — by 2026-10-08
- [ ] Copy the personal preferences file from the adoption session to `~/.claude/CLAUDE.md`; add `/opt/homebrew/opt/node@20/bin` to your PATH (Node 20 installed 2026-10-07) — by 2026-10-08
- [ ] Confirm the Next order above (seeded from the old STATUS and open issues) — next session
- [ ] Try 0.5.1 in Obsidian: checklist 6b, sections 1 and 2 (settings groups, sort, Recipe g / M, RAFT co-solvent, live highlight)
- [ ] Try Solution prep (checklist 6b) and give one real stock solution with a known answer for the test (BACKLOG "Decisions needed")
- [ ] Try Analysis methods (checklist 6c, BACKLOG "Not yet tested")
- [ ] Local `dist/` (old kit packages, gitignored): delete when you like
- [ ] `legacy/main.js` (v0.3 source, never committed, only on this machine): keep a copy or delete

## Known issues
- `npm run lint`: 0 errors, 2 sentence-case warnings left on purpose (BACKLOG "Repo / release")
- Many features are tests-only, not seen in Obsidian: BACKLOG "Not yet tested by the user"
- Git identity: commits use the global `~/.gitconfig` noreply address (set 2026-10-04 after a push was refused for the private email)
