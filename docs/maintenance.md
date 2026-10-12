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
| The version | Nothing by hand: only `/release` moves it |
| A user test result (chat, screenshot, feedback note) | `BACKLOG.md`: tick what it confirms (date + source), add what is broken; STATUS → Now alone is not enough |
| A decision (method, scope, rule) | One line in `docs/decisions.md` |

Never copy code into docs. Link to the file instead: copies drift.
