# Status

**Version:** 0.4.8 (plugin + kit; moves only at `/release`; TypeScript in `src/`)
**Now:** 0.4.8 released (tag `0.4.8`; GitHub Actions builds, attests and publishes it). Ships the last store-scan fixes: the data folder button opens through Obsidian on every platform (`lab-header/view.js`, kit file version 0.4.8). Repo cleanup [lab-kit#18](https://github.com/johnsonolly4/lab-kit/pull/18) is in. Click-to-edit (second click) is abandoned for now (known issue). **The feedback page needs a new round.**
**Next:** re-run the scan at community.obsidian.md on 0.4.8. Checks after: BACKLOG, "Repo / release" (re-scan, attestation verify, Windows Explorer test, CSS checklist). Then **a new feedback round** (`/feedback`).
**Blockers / open questions:**
- **The updater must be pointed at `dist/`, not `kit/`**: run `npm run package`, then set Settings → Lab Kit → Update folder to the repo's `dist` folder (test vault only). Pointing it at `kit/` fails with ENOENT (release-only files)
- `legacy/main.js` was never committed (`.gitignore` hides every `main.js`): the v0.3 plain-JS source exists only on this machine. User keeps a copy or deletes it
- To discuss: Solution prep vs Recipe by equivalents; analysis methods + machines in settings; sample creation workflow (BACKLOG, "Decisions needed")
- `npm run lint`: 0 errors, 4 sentence-case warnings left on purpose (BACKLOG, "Repo / release")

## Last session (release 0.4.8, 2026-10-04)
- User chose 0.4.8 and the summary "Store-scan fixes". `npm test` 131 pass, `npm run build` clean
- Versions set to 0.4.8 (`package.json` + lock, `manifest.json`, `versions.json`, `kit/kit-manifest.json`); kit notes and `docs/changelog.md` updated
- `lab-header/view.js` was labelled 0.4.7 in the kit manifest, but 0.4.7 shipped the old file (v0.3.0); relabelled 0.4.8
- Committed `Release 0.4.8` and tagged `0.4.8`. Pushed only after the user said yes; workflow result: see the reply of that session

## Earlier session (merge PR 18)
- Merged [lab-kit#18](https://github.com/johnsonolly4/lab-kit/pull/18) (`cc33f15`). Turned on the GitHub setting **Automatically delete head branches**: merged PR branches are deleted on GitHub; the local copy still needs `git branch -d` after pulling
