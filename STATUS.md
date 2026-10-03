# Status

**Version:** kit v0.3.0 (plugin Lab Kit 1.2.0, plain JS, built outside this repo)
**Now:** set up the repo: port `main.js` to TypeScript in the sample-plugin layout, with no behaviour changes.
**Next:** v0.4 bugs (see BACKLOG.md → "v0.4 bugs").
**Blockers / open questions:**
- Solution prep vs Recipe by equivalents: merge or keep? (to discuss)
- Analysis methods + machines in settings: design to agree
- Sample creation workflow: to discuss
- Author is "Lab Kit contributors" (LICENSE, manifest, package.json): swap in the GitHub username before store submission if wanted
- The real-vault edit block lives in `.claude/settings.local.json` (gitignored); check it exists

## Last session
- Pushed to a public GitHub repo (`lab-kit`, force-pushed over a stray LICENSE-only commit)
- Renamed `_claude` → `.claude`; `settings.local.json` already has Read/Edit denies for the real vault
- `npm install` OK, `npm run build` OK, `npm run test:legacy` passes, dev watch builds into `test-vault`
- `npm test` fails: vitest picks up `tests/legacy/*.test.js` (plain Node, no suites). Needs an `exclude` in a vitest config
- `CLAUDE.md` public-repo rule now allows the GitHub username (real names, initials, real paths still banned)
- esbuild postinstall is not approved by npm (warning only; build works)
