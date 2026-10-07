# Status

_Updated: 2026-10-07 by Sonnet 5.5 (Phase 7a built: Tidy up notes scan + split window, read-only). Cap 40 lines. History lives in git and `docs/changelog.md`, not here._

**Version:** 0.5.2 (plugin + kit; moves only at `/release`; TypeScript in `src/`)

## Now
Phases 0–4, 5a, 5b, 6 and 7a (7a: `src/kit/tidy.ts` + `tidy-ui.ts`, command Tidy up notes, Change notes… disabled, checklist 6h, not seen in Obsidian; 5a: planning folder settings + homepage blocks, checklist 6f; 5b: meeting series, `src/planning/meetings.ts`, checklist 6g, neither seen in Obsidian; whole-vault Check setup rows beyond meetings are in BACKLOG "Left out of Phase 5b"; 6a–6e: planning kit switch, Check setup with Fixes, layout folders, Templater-trigger fix, initials naming) built and committed, not pushed. User retest 2026-10-07: New to-do and New lab entry work; Meta Bind buttons work after a restart. `fix/34-user-scripts-folder` (PR #37) → `feat/multi-kit` (1a–4b, stacked on it; no PR yet). Tests 370 pass. Seen in Obsidian 2026-10-07: Phase 1b, issue #34, most of Phase 2 (feedback note: `test-vault/Lab Kit feedback.md`, local only).

## Next (ordered: top item is the next session)
Plan: `docs/plans/planning-suite-kit.md` (phases 0–8; one per session)
1. Phase 7b, 7c (Tidy up notes): `docs/plans/phase-7-tidy-notes.md`, one per session (7b first); then Phase 8 (`planning-suite-kit.md`). The vault-copy run is the owner's (own copy outside the repo, pastes a summary)
2. To-do box Esc text: DECIDED Esc = Untitled to-do; change only that box's footer to say so (`kits/planning/Extras/Templates/To-do.md:7`, `vtAsk.js:38`, `src/planning/ask.ts:12`)
3. New concept template + knowledge hub pages: Claude drafts from the plan's fields (kind: concept, summary, sources, checked), user reviews in test-vault before they ship. Plan first
4. Tutorial with screenshots (user, 2026-10-07): rewrite `docs/tutorial.md` from a fresh demo vault; Claude drives the screen if computer use is on, else a shot list for the user. Screenshots must show no real names or paths (public repo). Plan first (`/phase-plan`) Waits until the planning kit is out of preview (user, 2026-10-07)
5. Multi-kit round fixes (BACKLOG "Multi-kit round bugs" / "quick changes"; "Decisions needed": minimum Obsidian version, Status board colours)
6. "Make my own copy" snippet and per-snippet script files (BACKLOG "v0.4 quick changes") — plan first (`/phase-plan`)
7. Sample creation workflow: its own session, with a real example (BACKLOG "Decisions needed")

## Running
None.

## Waiting on owner (needs a human)
- [ ] Try Phase 7a in test-vault: checklist 6h (copy of notes only), look at the split window in light, dark and phone width — by 2026-10-09
- [ ] Try Phase 5b in test-vault: checklist 6g (Restore kit original on 00 Home, To-do, Weekly meeting and Weekly meetings first) — by 2026-10-09
- [ ] Try Phase 5a in test-vault: checklist 6f (`docs/obsidian-test-checklist.md`; run `npm run dev`, Restore kit original on 00 Home + Projects overview) — by 2026-10-09
- [ ] Try the last Phase 6 bits in test-vault: feedback note sections 8d–8e (Restore kit original on the Lab Book Template first) (`test-vault/Lab Kit feedback.md`), then paste it — by 2026-10-09
- [ ] Merge PR #37 (`fix/34`), then review `feat/multi-kit` and say "push" for its PR — by 2026-10-09
- [ ] Check the decisions taken while you were away: `docs/decisions.md` (2026-10-07, "Claude, unattended"), BACKLOG "Leftovers" (Phase 2, Phase 3) — by 2026-10-09
- [ ] Copy the personal preferences file from the adoption session to `~/.claude/CLAUDE.md` — by 2026-10-08
- [ ] Try 0.5.1 in Obsidian: checklist 6b, sections 1 and 2; Solution prep (6b) with one real stock solution; Analysis methods (6c)
- [ ] Local `dist/` and `legacy/main.js` (gitignored, this machine only): keep or delete

## Known issues
- `npm run lint`: 0 errors, 2 sentence-case warnings left on purpose (BACKLOG "Repo / release")
- Many features are tests-only, not seen in Obsidian: BACKLOG "Not yet tested by the user"
- Git identity: commits use the global `~/.gitconfig` noreply address (set 2026-10-04 after a push was refused for the private email)
