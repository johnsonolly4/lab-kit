# Architecture: where things are

Moved from `CLAUDE.md` (Map) on 2026-10-07. Update this when a folder or entry file is added, moved or removed.

- `src/main.ts`: plugin entry, registers features
- `src/calc/`: formula engine (parse, evaluate, rewrite refs) + table renderer
- `src/chem/`: chemical database (notes in the user's folder, matching, `[[` suggest popup for calc cells; `src/frontmatter.ts` = shared property readers)
- `src/header/`: hazard table + data-folder button (replaces the Dataview scripts)
- `src/kit/`: built-in kits (managed files, merge, merge window, settings tab and the New lab entry command in `ui.ts`; `paths.ts` = folders + saved state: `kit.kits.<id>` per kit, `kitLoad` migrates a v0.5.2 single-kit `data.json`)
- `src/planning/`: planning kit engine. `todo.ts` = to-do board rules (pure: stamps on drag / tick, roll-over); `engine.ts` = `TodoEngine` (events, timers, board tagging), started from `main.ts` only when the planning kit is on and installed; `actions.ts` = planning commands' rules (pure: shopping list text, archive cut-off, unique names, deck path); `ask.ts` = the text box (port of `vtAsk.js`) and the picker; `commands.ts` = `PlanningCommands` (fixed command IDs, plan `docs/plans/phase-4b-planning-commands.md`), registered under the same gate and kept as `plugin.planning`
- `src/node.ts`: the only `require()` (Node/Electron modules, null on mobile) · `src/platform.ts`: `hasNode()` · `src/whatsnew.ts`: What's new popup
- `kits/<id>/`: one folder per built-in kit, each with its own `kit-manifest.json` (schema 2: `id`, version, files); every kit is embedded in `main.js` at build
  - `kits/lab/`: the lab kit: vault files it installs (`Templates/`, `Extras/scripts/`, `.obsidian/snippets/`, and `03 Lab Book/`, `05 Chemicals/` for the .base files, which go in the folder above the Lab notes / Chemical folder settings: roles `labBase`, `chemicalBase`, from `kitFolderRoles` in `src/kit/paths.ts`; a file with `needs` in the manifest is off while that setting is empty, `offIds` in `src/kit/managed.ts`)
  - `kits/planning/`: the planning kit (Phase 3: files only, not offered in the UI yet): homepage and planning notes (roles named after their top-level folder, `policy: keep`), `Extras/Templates/` (+ `ZotLit/`; the button actions are plugin commands since Phase 4b, the ZotLit files only with the ZotLit plugin: `needs: "plugin:zotlit"`), `vtAsk.js` in `<user scripts>/vault/`, two CSS snippets; folders from `planningRoles` in `src/kit/paths.ts`. Source and what is held back: `docs/plans/phase-3-planning-files.md`
  - `kits/lab/Extras/scripts/templater/`: Templater scripts: `labSnippets.js` (every snippet), `labMethods.js` (analysis methods + machines from the Methods folder; NMR/GPC/DLS built in), `labForm.js` (pop-up forms), `labPick.js` (Alt+S menu)
- `docs/`: `tutorial.md`, `changelog.md`, `obsidian-test-checklist.md`, `reference/` (saved Obsidian docs: read these, don't fetch)
- `tests/`: vitest; `tests/fixtures/` holds real experiment tables
- `scripts/`: `kit-manifest.mjs` regenerates every `kits/<id>/kit-manifest.json` (per-kit folder → role table in `CONFIG`) · `embed-kit.mjs` embeds all kits in `main.js`
- `.github/workflows/release.yml`: builds, attests and publishes a release on a pushed tag
- `test-vault/`: dev vault (only `Welcome.md` tracked; notes, kit copies and plugin build are gitignored)
- `dist/`, `legacy/`: gitignored (old kit package output, no longer built; old v0.3 `main.js`, never committed)
- `README.md`, `GETTING-STARTED.md` (user setup guide), `LICENSE` (MIT)
- `STATUS.md`: now / next / blockers · `BACKLOG.md`: feedback by version
