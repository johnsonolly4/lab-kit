# Status

_Updated: 2026-10-07 by Opus 5.5 (feedback round sorted into BACKLOG; Phase 6 + 6c built, plus fixes from the fresh-vault test (kit install no longer runs its templates; planning commands start after install); earlier: Phases 2–4b). Cap 40 lines. History lives in git and `docs/changelog.md`, not here._

**Version:** 0.5.2 (plugin + kit; moves only at `/release`; TypeScript in `src/`)

## Now
Phases 0–4 and 6 built and committed, not pushed. The planning kit can now be switched on (Settings → Built-in kit, preview), so Phase 4 "roll-over seen in test-vault" can be tried. `fix/34-user-scripts-folder` (PR #37) → `feat/multi-kit` (1a–4b, stacked on it; no PR yet). Tests 318 pass. Seen in Obsidian 2026-10-07: Phase 1b, issue #34, most of Phase 2 (feedback note: `test-vault/Lab Kit feedback.md`, local only).

## Next (ordered: top item is the next session)
Plan: `docs/plans/planning-suite-kit.md` (phases 0–8; one per session)
1. User retest in a fresh vault (Templater trigger on): install both kits, New to-do, New lab entry; the double-note and auto-name bugs are probably the trigger (BACKLOG "Multi-kit round bugs")
2. Tutorial with screenshots (user, 2026-10-07): rewrite `docs/tutorial.md` from a fresh demo vault; Claude drives the screen if computer use is on, else a shot list for the user. Screenshots must show no real names or paths (public repo). Plan first (`/phase-plan`)
3. Phase 5 (homepage blocks, meeting series) + the whole-vault Check setup folded in (decided 2026-10-07), then 7–8
4. Multi-kit round fixes (BACKLOG "Multi-kit round bugs" / "quick changes", two "Decisions needed": Alt+S insert-only, minimum Obsidian version)
5. "Make my own copy" snippet and per-snippet script files (BACKLOG "v0.4 quick changes") — plan first (`/phase-plan`)
6. Sample creation workflow: its own session, with a real example (BACKLOG "Decisions needed")

## Running
None.

## Waiting on owner (needs a human)
- [ ] Try Phase 6 in test-vault: feedback note sections 7–8e (`test-vault/Lab Kit feedback.md`), then paste it — by 2026-10-09
- [ ] Merge PR #37 (`fix/34`), then review `feat/multi-kit` and say "push" for its PR — by 2026-10-09
- [ ] Check the decisions taken while you were away: `docs/decisions.md` (2026-10-07, "Claude, unattended"), BACKLOG "Leftovers" (Phase 2, Phase 3) — by 2026-10-09
- [ ] Supply the New concept template / knowledge rules, and check the font licence (BACKLOG "Decisions needed")
- [ ] Copy the personal preferences file from the adoption session to `~/.claude/CLAUDE.md` — by 2026-10-08
- [ ] Try 0.5.1 in Obsidian: checklist 6b, sections 1 and 2; Solution prep (6b) with one real stock solution; Analysis methods (6c)
- [ ] Local `dist/` and `legacy/main.js` (gitignored, this machine only): keep or delete

## Known issues
- `npm run lint`: 0 errors, 2 sentence-case warnings left on purpose (BACKLOG "Repo / release")
- Many features are tests-only, not seen in Obsidian: BACKLOG "Not yet tested by the user"
- Git identity: commits use the global `~/.gitconfig` noreply address (set 2026-10-04 after a push was refused for the private email)
