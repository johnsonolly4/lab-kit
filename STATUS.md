# Status

**Version:** 0.4.9 (plugin + kit; moves only at `/release`; TypeScript in `src/`)
**Now:** 0.4.9 is released (tag pushed once you confirm; check GitHub Actions). It ships the kit picker, sample letters, hidden backups and the **removed folder updater** ([lab-kit#20](https://github.com/johnsonolly4/lab-kit/pull/20), [#21](https://github.com/johnsonolly4/lab-kit/pull/21)): 152 tests pass, lint 0 errors / 2 warnings, build OK, not seen in Obsidian. Click-to-edit (second click) is abandoned for now (known issue). **The feedback page needs a new round.**
**Next:** try `docs/obsidian-test-checklist.md` sections 1-3 in Obsidian (`npm run dev`). Then step 3 (**Chemical database + autocomplete**, own plan pass; needs your chemical note template first), then Analysis methods (BACKLOG, "Decided"). Also open: re-run the store scan, then a feedback round (`/feedback`).
**Blockers / open questions:**
- Local `dist/` still holds old kit packages (0.3.0, 0.4.6, zips) from the removed `npm run package`; still gitignored. Safe to delete when you like
- `legacy/main.js` was never committed (`.gitignore` hides every `main.js`): the v0.3 plain-JS source exists only on this machine. User keeps a copy or deletes it
- Still to discuss: Solution prep vs Recipe (walk through a real experiment) and the sample creation workflow (BACKLOG, "Decisions needed")
- `npm run lint`: 0 errors, 2 sentence-case warnings left on purpose (BACKLOG, "Repo / release")
- Git identity: commits now use the global `~/.gitconfig` noreply address (set 2026-10-04 after a push was refused for the private email)

## Last session (merge PR 20 + remove the folder updater, 2026-10-04)
- PR 20 (Kit picker + step 1) pushed and merged; two commits had the private email as author (git had no identity), rewritten before the push
- `feat/remove-folder-updater`: `src/kit/updater.ts` → `src/kit/paths.ts` (only what the built-in kit uses); `KitUpdateModal`, `check()`, "Check for updates" and the "Kit updates" group removed from `src/kit/ui.ts`; first-install switches for the CSS snippet and an empty Templater scripts folder (`firstInstallOptions`, `managed-ui.ts`); startup notice + "Tell me when a kit update is ready"; old install record still read (SHA-1 via `crypto.subtle`, no Node); `src/node.ts` without `crypto` / `readdirSync`; `package-kit.mjs`, `install-updater.*`, `fflate`, release zip removed (`dist/` stays gitignored for old local output); versions check is now `tests/versions.test.ts`
- Docs: tutorial section 7 + troubleshooting, README (features, install, privacy, mobile), CLAUDE.md map and version rule, checklist, changelog "Unreleased", release skill. Untested in Obsidian: BACKLOG "Not yet tested"

## Earlier session (step 2, Kit picker, 2026-10-04)
- Kit picker + new-vault layout built and tested (`tests/kit-picker.test.ts`), merged in PR 20
