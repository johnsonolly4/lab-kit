# Status

_Updated: 2026-10-07 by Opus 5.5. Cap 40 lines. History lives in git and `docs/changelog.md`, not here._

**Version:** 0.5.2 (plugin + kit; moves only at `/release`; TypeScript in `src/`)

## Now
Starter-kit adoption on branch `adopt/starter-kit` (docs and config only; not pushed).

## Next (ordered: top item is the next session)
1. Feedback round: user fills the feedback page, then `/feedback` — done when: items sorted into `BACKLOG.md`
2. Issue #34 "Overwrites user scripts on setup" (no details yet: ask for steps; may be BACKLOG "v0.4 quick changes", old scripts item) — done when: reproduced and fixed with a test, or closed
3. Issue #32 Lab note template: Status is a list, should be text (`kit/Templates/`) — done when: template changed, manifest regenerated, tests pass
4. Issue #33 Missing chemical database template (no details yet: ask what it should hold) — done when: template in `kit/Templates/`, tutorial updated
5. "Make my own copy" snippet and per-snippet script files (BACKLOG "v0.4 quick changes") — plan first (`/phase-plan`)
6. Sample creation workflow: its own session, with a real example (BACKLOG "Decisions needed")

## Running
None.

## Waiting on owner (needs a human)
- [ ] Review branch `adopt/starter-kit`, push it and open the PR
- [ ] Copy the personal preferences file from the adoption session to `~/.claude/CLAUDE.md`; add `/opt/homebrew/opt/node@20/bin` to your PATH (Node 20 installed 2026-10-07)
- [ ] Confirm the Next order above (seeded from the old STATUS and open issues)
- [ ] Try 0.5.1 in Obsidian: checklist 6b, sections 1 and 2 (settings groups, sort, Recipe g / M, RAFT co-solvent, live highlight)
- [ ] Try Solution prep (checklist 6b) and give one real stock solution with a known answer for the test (BACKLOG "Decisions needed")
- [ ] Try Analysis methods (checklist 6c, BACKLOG "Not yet tested")
- [ ] Local `dist/` (old kit packages, gitignored): delete when you like
- [ ] `legacy/main.js` (v0.3 source, never committed, only on this machine): keep a copy or delete

## Known issues
- `npm run lint`: 0 errors, 2 sentence-case warnings left on purpose (BACKLOG "Repo / release")
- Many features are tests-only, not seen in Obsidian: BACKLOG "Not yet tested by the user"
- Git identity: commits use the global `~/.gitconfig` noreply address (set 2026-10-04 after a push was refused for the private email)
