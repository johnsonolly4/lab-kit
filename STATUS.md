# Status

**Version:** 0.4.7 (plugin + kit; moves only at `/release`; TypeScript in `src/`)
**Now:** `main` has everything up to [lab-kit#17](https://github.com/johnsonolly4/lab-kit/pull/17) (last 0.4.7 store-scan fixes), **not released yet**. 0.4.7 is released ([GitHub release](https://github.com/johnsonolly4/lab-kit/releases/tag/0.4.7)) with attestations from `.github/workflows/release.yml`. Repo cleaned up on branch `cleanup` (see Last session). Click-to-edit (second click) is abandoned for now (known issue).
**Next:** merge `cleanup`, then `/release 0.4.8` and re-run the scan at community.obsidian.md. Checks after: BACKLOG, "Repo / release" (re-scan, attestation verify, Windows Explorer test, CSS checklist). Then **a new feedback round** (`/feedback`).
**Blockers / open questions:**
- **The updater must be pointed at `dist/`, not `kit/`**: run `npm run package`, then set Settings → Lab Kit → Update folder to the repo's `dist` folder (test vault only). Pointing it at `kit/` fails with ENOENT (release-only files)
- `legacy/main.js` was never committed (`.gitignore` hides every `main.js`): the v0.3 plain-JS source exists only on this machine. User keeps a copy or deletes it
- To discuss: Solution prep vs Recipe by equivalents; analysis methods + machines in settings; sample creation workflow (BACKLOG, "Decisions needed")
- `npm run lint`: 0 errors, 4 sentence-case warnings left on purpose (BACKLOG, "Repo / release")

## Last session (repo cleanup, 2026-10-04)
- User chose: trim STATUS, drop ticked + fix stale BACKLOG items, delete all branches except `main`, ignore `test-vault/` copies, rewrite GETTING-STARTED, update the CLAUDE.md map
- **Branches**: deleted 14 local and 12 remote branches (all merged, plus `revert-github-action` from closed PR 16; its commits stay on the PR page). Only `main` left
- **STATUS.md**: ~90 old session logs removed (history is in git log and `docs/changelog.md`)
- **BACKLOG.md**: ticked items removed; ticked-but-unseen items moved to "Not yet tested"; stale items fixed (store-prep push, release 0.4.0, `versions.json`, npm audit numbers, re-scan wording, settings-freeze item)
- **`.gitignore`**: hand-copied `test-vault/` notes and kit folders ignored (only `Welcome.md` and `.obsidian/.gitkeep` stay tracked)
- **GETTING-STARTED.md**: rewritten for today's setup (clone, `npm install`, test vault, `settings.local.json`); old handoff steps gone
- **CLAUDE.md** map: added `.github/`, `src/node.ts` / `platform.ts` / `whatsnew.ts`, `docs/obsidian-test-checklist.md`, the other scripts, `dist/`, `legacy/`
- Health check: `npm test` 131 pass, `npm run lint` 0 errors / 4 warnings, `npm audit --omit=dev` 0. No code changed. Committed on `cleanup`; push / PR only after the user says so
