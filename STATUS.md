# Status

_Updated: 2026-10-08 by Sonnet 5.5 (New meeting series, Phase 0). Cap 40 lines. History lives in git and `docs/changelog.md`, not here._

**Version:** 0.5.2 (plugin + kit; moves only at `/release`; TypeScript in `src/`)

## Now
New meeting series Phase 0 done (cadence → interval in code, kit notes, tests, docs; parser falls back to `cadence`, Tidy renames it in `src/kit/tidy.ts`; not seen in Obsidian; BACKLOG "Not yet tested"). Phase 8b docs written (README Folder contract / kits / commands, GETTING-STARTED Mac + starter steps; Mac steps not run). Phase 8a built, not seen in Obsidian: `npm run starter` writes `dist/starter/` (`src/kit/starter.ts`, `scripts/make-starter.mjs`, `tests/starter.test.ts`; BACKLOG "Phase 8a"). Tests 412 pass. Feedback round 2026-10-08 built, not seen in Obsidian (checklist 6i, BACKLOG "Not yet tested"): action chips in both kit windows, Go to icons, `lab` button, Tidy contract-folder fix, `Hotkeys.md` note (Alt + first letter; no Check setup hotkey rows). Open from it: Weekly meetings buttons at install, Dataview JS message (BACKLOG "Feedback 2026-10-07"). Earlier: phases 0–4, 5a, 5b, 6, 7a, 7b, 7c-1 and 7c-2 (7c-2: Templater paths + Meta Bind buttons in `tidy.ts`, `obsidian-private.ts`, `tests/tidy-settings.test.ts`, not seen in Obsidian; 7c-1: meetings series + missing hub notes in `tidy.ts` `scan`, `tests/tidy-meetings.test.ts`, checklist 6h, not seen in Obsidian; 7a/7b: `src/kit/tidy.ts`, `tidy-apply.ts`, `tidy-ui.ts`, command Tidy up notes with Change notes…, checklist 6h, not seen in Obsidian; 7b still lacks the script-move and help-sheet rules, BACKLOG; 5a: planning folder settings + homepage blocks, checklist 6f; 5b: meeting series, `src/planning/meetings.ts`, checklist 6g, neither seen in Obsidian; whole-vault Check setup rows beyond meetings are in BACKLOG "Left out of Phase 5b"; 6a–6e: planning kit switch, Check setup with Fixes, layout folders, Templater-trigger fix, initials naming) built and committed, not pushed. User retest 2026-10-07: New to-do and New lab entry work; Meta Bind buttons work after a restart. `fix/34-user-scripts-folder` (PR #37) → `feat/multi-kit` (1a–4b, stacked on it; no PR yet). Seen in Obsidian 2026-10-07: Phase 1b, issue #34, most of Phase 2 (feedback note: `test-vault/Lab Kit feedback.md`, local only).

## Next (ordered: top item is the next session; plan: `docs/plans/planning-suite-kit.md`)
1. New meeting series command + button (user, 2026-10-08; BACKLOG "No way to make a new meeting series"): asks name, interval, day, first date, deck path; makes folder + hub note; button on each series hub. Plan agreed: `docs/plans/new-meeting-series.md`; Phase 0 (rename) is done, so next is Phase 1 command + template, then Phase 2 button + docs
2. 7b script-move / help-sheet rules: wait for the owner's old paths (BACKLOG "Phase 7c leftovers"); the vault-copy run is the owner's. Not blocking
3. To-do box Esc text: DECIDED Esc = Untitled to-do; change only that box's footer to say so (`kits/planning/Extras/Templates/To-do.md:7`, `vtAsk.js:38`, `src/planning/ask.ts:12`)
4. New concept template + knowledge hub pages: Claude drafts from the plan's fields (kind: concept, summary, sources, checked), user reviews in test-vault before they ship. Plan first
5. Tutorial with screenshots (user, 2026-10-07): rewrite `docs/tutorial.md` from a fresh demo vault; Claude drives the screen if computer use is on, else a shot list for the user. Screenshots must show no real names or paths (public repo). Plan first (`/phase-plan`) Waits until the planning kit is out of preview (user, 2026-10-07)
6. Multi-kit round fixes (BACKLOG "Multi-kit round bugs" / "quick changes"; "Decisions needed": minimum Obsidian version, Status board colours)
7. "Make my own copy" snippet and per-snippet script files (BACKLOG "v0.4 quick changes") — plan first (`/phase-plan`)
8. Sample creation workflow: its own session, with a real example (BACKLOG "Decisions needed")

## Running
None.

## Waiting on owner (needs a human)
- [ ] Tell Claude where `excel_to_calc.py`, `lab-config.json` and the Templater help sheet are in your vault now (paths only, no notes) so 7c can move them — by 2026-10-09
- [ ] Try Phase 7a/7b in test-vault: checklist 6h (copy of notes only, incl. Change notes… and the backups), split window in light, dark and phone width — by 2026-10-09
- [ ] Try Phase 5b in test-vault: checklist 6g (Restore kit original on 00 Home, To-do, Weekly meeting and Weekly meetings first) — by 2026-10-09
- [ ] Try Phase 5a in test-vault: checklist 6f (`docs/obsidian-test-checklist.md`; run `npm run dev`, Restore kit original on 00 Home + Projects overview) — by 2026-10-09
- [ ] Try the last Phase 6 bits in test-vault: feedback note sections 8d–8e (Restore kit original on the Lab Book Template first) (`test-vault/Lab Kit feedback.md`), then paste it — by 2026-10-09
- [ ] Try the starter: `npm run starter`, copy `dist/starter/` to a new empty vault, run `install-plugins.sh`, then Check setup (BACKLOG "Phase 8a") — by 2026-10-12
- [ ] Try checklist 6i in test-vault (feedback round: chips, Go to icons, buttons, Tidy count, Hotkeys note) — by 2026-10-10
- [ ] Merge PR #37 (`fix/34`), then review `feat/multi-kit` and say "push" for its PR — by 2026-10-09
- [ ] Check the decisions taken while you were away: `docs/decisions.md` (2026-10-07, "Claude, unattended"), BACKLOG "Leftovers" (Phase 2, Phase 3) — by 2026-10-09
- [ ] Copy the personal preferences file from the adoption session to `~/.claude/CLAUDE.md` — by 2026-10-08
- [ ] Try 0.5.1 in Obsidian: checklist 6b, sections 1 and 2; Solution prep (6b) with one real stock solution; Analysis methods (6c)
- [ ] Local `dist/` and `legacy/main.js` (gitignored, this machine only): keep or delete

## Known issues
- `npm run lint`: 0 errors, 2 sentence-case warnings left on purpose (BACKLOG "Repo / release")
- Many features are tests-only, not seen in Obsidian: BACKLOG "Not yet tested by the user"
- Git identity: commits use the global `~/.gitconfig` noreply address (set 2026-10-04 after a push was refused for the private email)
