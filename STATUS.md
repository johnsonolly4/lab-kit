# Status

**Version:** 0.4.8 (plugin + kit; moves only at `/release`; TypeScript in `src/`)
**Now:** 0.4.8 released (tag `0.4.8`; GitHub Actions builds, attests and publishes it). Ships the last store-scan fixes: the data folder button opens through Obsidian on every platform (`lab-header/view.js`, kit file version 0.4.8). Repo cleanup [lab-kit#18](https://github.com/johnsonolly4/lab-kit/pull/18) is in. Click-to-edit (second click) is abandoned for now (known issue). **The feedback page needs a new round.**
**Next:** re-run the scan at community.obsidian.md on 0.4.8. Checks after: BACKLOG, "Repo / release" (re-scan, attestation verify, Windows Explorer test, CSS checklist). Then **a new feedback round** (`/feedback`). After the store submission: Kit picker → Chemical database → Analysis methods (BACKLOG, "Decided").
**Blockers / open questions:**
- **The updater must be pointed at `dist/`, not `kit/`**: run `npm run package`, then set Settings → Lab Kit → Update folder to the repo's `dist` folder (test vault only). Pointing it at `kit/` fails with ENOENT (release-only files)
- `legacy/main.js` was never committed (`.gitignore` hides every `main.js`): the v0.3 plain-JS source exists only on this machine. User keeps a copy or deletes it
- Still to discuss: Solution prep vs Recipe (walk through a real experiment) and the sample creation workflow (BACKLOG, "Decisions needed"). Everything else was decided 2026-10-04 (BACKLOG, "Decided")
- `npm run lint`: 0 errors, 4 sentence-case warnings left on purpose (BACKLOG, "Repo / release")
- **Uncommitted on `main`**: `README.md`, `docs/tutorial.md`, `BACKLOG.md`, `STATUS.md`. Commit them on a branch (PR) when you decide

## Last session (tutorial + README update, 2026-10-04)
- `docs/tutorial.md` and `README.md` brought in line with 0.4.8: Alt+S one-time setup, Tab/Escape in cells, duplicate table names, numbered sample tables, built-in kit (review, merge, resolve, retired), What's new popup, folder updater marked desktop-only/optional, Obsidian 1.13 requirement, leftover "Lab Calc" wording and the dead "[[Lab notebook kit - …]]" links removed
- Docs only: no code, no version change. Nothing committed (uncommitted: `README.md`, `docs/tutorial.md`, `BACKLOG.md`, `STATUS.md`). Unverified bits are in BACKLOG ("Repo / release")

## Earlier session (release 0.4.8, 2026-10-04)
- Released 0.4.8 (`578ed7f`, tag `0.4.8`); [workflow](https://github.com/johnsonolly4/lab-kit/actions/runs/37206494399) succeeded, [GitHub release 0.4.8](https://github.com/johnsonolly4/lab-kit/releases/tag/0.4.8) has `main.js`, `manifest.json`, `styles.css`, `lab-kit-0.4.8.zip`. `lab-header/view.js` relabelled 0.4.8 in the kit manifest (0.4.7 shipped the old file)
