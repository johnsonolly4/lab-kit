# Lab Kit

Live calculation tables, lab snippet forms and a hazard header for a chemistry lab notebook in Obsidian.

## Features
- **Calc tables**: ```` ```calc ```` blocks with Excel-style formulas (`SUM`, `XLOOKUP`, `IF`, …), references between tables, and `MW()` read from your chemical notes. Click a cell to edit; everything that depends on it updates.
- **Snippet forms** (Alt+S, needs Templater): solution prep, recipe by equivalents, RAFT recipe, sample lists, sampling timetables, NMR / GPC / DLS sample tables, combined results, flow column prep, residence times.
- **Experiment header**: hazard table built from the note's Chemicals property, and a button that opens the experiment's data folder.
- **Kit updater** (desktop only, optional): installs and updates the templates and scripts that go with the plugin, showing every change before it's made.

## Install
Not in the community store yet. Until then:
1. Download `main.js`, `manifest.json` and `styles.css` from the latest [release](../../releases).
2. Put them in `<your vault>/.obsidian/plugins/lab-kit/`.
3. Settings → Community plugins → enable **Lab Kit**.

For the snippet forms, also install [Templater](https://github.com/SilentVoid13/Templater) and the kit files (`kit/` in the release zip). The tutorial explains each feature: [docs/tutorial.md](docs/tutorial.md).

## Development
```bash
npm install
npm run dev          # builds into test-vault/.obsidian/plugins/lab-kit/ and watches
npm test             # vitest
```
Open `test-vault/` as a vault in Obsidian to try changes. Never develop in your real vault.

## Licence
MIT, see [LICENSE](LICENSE).
