# Doc-sync table: after a change, update these

Claude: check this table at the end of every session (routine step 2).

| If you changed… | Also update |
|---|---|
| Any file in `kits/` | Run `npm run kit:manifest` (`tests/managed.test.ts` fails on a stale sha256) |
| The formula engine (`src/calc/`) | A test against `tests/fixtures/` (known answers in `CLAUDE.md`) |
| Anything user-visible (feature, setting, snippet, wording) | `docs/changelog.md` under "Unreleased" |
| Settings (`src/kit/ui.ts`, `src/kit/paths.ts`) | `README.md` → Settings, `docs/tutorial.md` |
| A snippet or form (`kits/lab/Extras/scripts/templater/`) | `docs/tutorial.md` snippet table, `docs/obsidian-test-checklist.md` |
| A feature that needs a look inside Obsidian | `docs/obsidian-test-checklist.md`, and `BACKLOG.md` → Not yet tested |
| A folder or entry file added, moved or removed | `docs/architecture.md` |
| A command in `package.json` | `CLAUDE.md` → Commands, `README.md` → Development |
| A kit manifest's `templater` / `enableCss`, or the plugin list in `src/kit/setup-check.ts` | Nothing by hand: `npm run starter` regenerates the new-vault starter; `tests/starter.test.ts` fails on drift |
| A folder default in `src/kit/paths.ts` | `README.md` → Folder contract |
| A new use of an Obsidian class (`.bases-*`, `.modal*`, `.prompt*`, `.setting-item*`), an `app.<member>` its typings lack, or a cast of `app` / `vault` / `metadataCache` | An entry in `scripts/obsidian-internals.json` (`tests/obsidian-internals.test.ts` fails until it is there) |
| The version | Nothing by hand: only `/release` moves it |
| A user test result (chat, screenshot, feedback note) | `BACKLOG.md`: tick what it confirms (date + source), add what is broken; STATUS → Now alone is not enough |
| A decision (method, scope, rule) | One line in `docs/decisions.md` |

Never copy code into docs. Link to the file instead: copies drift.

## When Obsidian releases a new version (S6 of `docs/plans/obsidian-update-robustness.md`)
Owner's choice (2026-10-19, R1/R2): public releases only, on each Obsidian release and before each Lab Kit release.

- [ ] Read the new release's changelog sections Plugins, API, Bases and mobile (Obsidian's release notes; the `obsidian-api` CHANGELOG). Add each finding to `BACKLOG.md` with its version.
- [ ] Update Obsidian, then `python3 scripts/check.py --build`, and look at what `scripts/obsidian-internals.json` lists for that release (every class and private member we use; the test keeps the list true).
- [ ] Run the throwaway Obsidian (`obsidian-check`, skill) on the new version: start, `errors` is `[]`, open Home, the To-do board, the Lab book board, a calc note (0011 = 1.7591 mL) and a project plan map; open one window of each kind (Check setup, Review update…, New to-do, Alt+S); repeat with `--mobile`. Until the smoke command (S1) exists this is by hand; write what was not looked at.
- [ ] Note in the changelog (and the README once S5 adds its "tested up to Obsidian x.y" line) which Obsidian version it was tested on (only measured versions). `minAppVersion` moves only at `/release`.
- [ ] Update `docs/plans/obsidian-update-robustness.md` if the release changes a row (a renamed class, a removed private member).
