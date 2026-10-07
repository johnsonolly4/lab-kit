# Architecture: where things are

Moved from `CLAUDE.md` (Map) on 2026-10-07. Update this when a folder or entry file is added, moved or removed.

- `src/main.ts`: plugin entry, registers features
- `src/calc/`: formula engine (parse, evaluate, rewrite refs) + table renderer
- `src/chem/`: chemical database (notes in the user's folder, matching, `[[` suggest popup for calc cells; `src/frontmatter.ts` = shared property readers)
- `src/header/`: hazard table + data-folder button (replaces the Dataview scripts)
- `src/kit/`: built-in kit (managed files, merge, merge window, settings tab; `paths.ts` = folders + saved state)
- `src/node.ts`: the only `require()` (Node/Electron modules, null on mobile) · `src/platform.ts`: `hasNode()` · `src/whatsnew.ts`: What's new popup
- `kit/`: vault files the built-in kit installs (`Templates/`, `Extras/scripts/`), embedded in `main.js` at build
  - `kit/Extras/scripts/templater/`: Templater scripts: `labSnippets.js` (every snippet), `labMethods.js` (analysis methods + machines from the Methods folder; NMR/GPC/DLS built in), `labForm.js` (pop-up forms), `labPick.js` (Alt+S menu)
- `docs/`: `tutorial.md`, `changelog.md`, `obsidian-test-checklist.md`, `reference/` (saved Obsidian docs: read these, don't fetch)
- `tests/`: vitest; `tests/fixtures/` holds real experiment tables
- `scripts/`: `kit-manifest.mjs` regenerates `kit/kit-manifest.json` · `embed-kit.mjs` embeds the kit in `main.js`
- `.github/workflows/release.yml`: builds, attests and publishes a release on a pushed tag
- `test-vault/`: dev vault (only `Welcome.md` tracked; notes, kit copies and plugin build are gitignored)
- `dist/`, `legacy/`: gitignored (old kit package output, no longer built; old v0.3 `main.js`, never committed)
- `README.md`, `GETTING-STARTED.md` (user setup guide), `LICENSE` (MIT)
- `STATUS.md`: now / next / blockers · `BACKLOG.md`: feedback by version
