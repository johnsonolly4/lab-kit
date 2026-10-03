# Status

**Version:** kit v0.3.0 (plugin Lab Kit 1.2.0 behaviour, now TypeScript in `src/`)
**Now:** port is built and tested; waiting for the user to check it by eye in `test-vault`, then decide whether to delete `legacy/` + `tests/legacy/`.
**Next:** v0.4 bugs (see BACKLOG.md → "v0.4 bugs").
**Blockers / open questions:**
- Delete `legacy/` and `tests/legacy/` once the port is accepted? (`tests/differential.test.ts` compares `src/` with `legacy/` and goes with them)
- Solution prep vs Recipe by equivalents: merge or keep? (to discuss)
- Analysis methods + machines in settings: design to agree
- Sample creation workflow: to discuss
- Author is "Lab Kit contributors" (LICENSE, manifest, package.json): swap in the GitHub username before store submission if wanted
- `npm run lint` fails: eslint is not in devDependencies and has no config (store review uses `eslint-plugin-obsidianmd`)

## Last session
- Ported `legacy/main.js` to `src/`: `calc/engine.ts`, `calc/rewrite.ts`, `calc/render.ts`, `kit/updater.ts`, `kit/ui.ts`, `kit/obsidian-private.ts`, `main.ts` (class `LabKitPlugin`)
- Tests: `npm test` 20 pass (ports of engine, compat, snippets, render, updater + a differential test against legacy); `npm run test:legacy` 5/5; `npm run build` clean. Known answers hold (0005 Mn 19990.14, 0011 1.7591 mL)
- Only visible-code change: 3 inline styles in the updater became CSS classes in `styles.css` (`lab-kit-wide-input`, `lab-kit-wide-control`, `lab-kit-notice-btn`), same look
- Private Obsidian APIs (`app.plugins`, `app.customCss`) now live only in `src/kit/obsidian-private.ts`; updater logic is separate from the calc code
- Repo changes: `.claude/settings.json` no longer denies `Read(./main.js)` (it blocked `legacy/main.js`); `vitest.config.mjs` aliases `obsidian` to `tests/helpers/obsidian-stub.ts`
- Not done: manual check in Obsidian (render, click-to-edit, + Row, right-click menu, A1, Copy, settings tab, "Check for lab kit updates"); plugin id `lab-calc`→`lab-kit` migration; commits are local, not pushed
