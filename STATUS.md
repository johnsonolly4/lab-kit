# Status

**Version:** 0.4.8 (plugin + kit; moves only at `/release`; TypeScript in `src/`)
**Now:** 0.4.8 is released. Two unpushed branches, stacked: `feat/sample-letters-backups-notes` (step 1: sample letters, hidden backups, "Kit notes" dropped) and `feat/kit-picker` on top (step 2: Kit picker + vault layout). Code + tests done (154 pass, lint 0 errors, build OK); neither is seen in Obsidian. Click-to-edit (second click) is abandoned for now (known issue). **The feedback page needs a new round.**
**Next:** your go-ahead for step 3 (**Chemical database + autocomplete**, own plan pass; needs your chemical note template first), then Analysis methods (BACKLOG, "Decided"). Also open: push + PR for the two branches, re-run the store scan on 0.4.8 and the "Repo / release" checks, then a feedback round (`/feedback`).
**Blockers / open questions:**
- **The updater must be pointed at `dist/`, not `kit/`**: run `npm run package`, then set Settings → Lab Kit → Update folder to the repo's `dist` folder (test vault only). Pointing it at `kit/` fails with ENOENT (release-only files)
- `legacy/main.js` was never committed (`.gitignore` hides every `main.js`): the v0.3 plain-JS source exists only on this machine. User keeps a copy or deletes it
- Still to discuss: Solution prep vs Recipe (walk through a real experiment) and the sample creation workflow (BACKLOG, "Decisions needed"). Everything else was decided 2026-10-04 (BACKLOG, "Decided")
- `npm run lint`: 0 errors, 4 sentence-case warnings left on purpose (BACKLOG, "Repo / release")
- Steps 1 and 2 are committed (two branches, stacked); not pushed, no PR yet

## Last session (step 2, Kit picker, 2026-10-04)
- Built on `feat/kit-picker`: manifest `desc` + `optional` per file (`scripts/kit-manifest.mjs` `DESC`, only the 13 snippets are optional); `off` action + `disableManaged` + `trackedRoles` in `src/kit/managed.ts`; `KitData.off`; Use toggle + description rows, "Switched off" group and the confirm-then-trash flow in `src/kit/managed-ui.ts`; Icons rows follow the managed templates folder; new-vault layout in `kitDetectRoles` (`tracked` param). Checked in Templater's source that it scans user scripts recursively
- 15 new tests in `tests/kit-picker.test.ts`; docs (tutorial, checklist, changelog "Unreleased", README) updated. No version change. Untested in Obsidian: BACKLOG "Not yet tested"

## Earlier session (release 0.4.8, 2026-10-04)
- Released 0.4.8 (`578ed7f`, tag `0.4.8`); [workflow](https://github.com/johnsonolly4/lab-kit/actions/runs/37206494399) succeeded, [GitHub release 0.4.8](https://github.com/johnsonolly4/lab-kit/releases/tag/0.4.8) has `main.js`, `manifest.json`, `styles.css`, `lab-kit-0.4.8.zip`. `lab-header/view.js` relabelled 0.4.8 in the kit manifest (0.4.7 shipped the old file)
