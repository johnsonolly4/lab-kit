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

## Privacy, network and files
- **No network use.** Lab Kit never connects to the internet, has no account, no ads, no telemetry and no paid features. The "full changelog" button only opens a link in your browser when you press it.
- **Files in your vault**: the kit updater and the built-in kit read and write only the folders you set in Settings → Lab Kit, and copy a replaced file to a backup folder first.
- **Files outside your vault** (both optional, desktop only):
  - The **folder updater** reads the update folder you point it at (a kit version you downloaded). It does nothing until you set that folder; once set, it also checks that folder when Obsidian starts (switch off with **Check when Obsidian starts** in Settings → Lab Kit).
  - The **data-folder button** in the experiment header creates `<data folder root>/<note name>` on your computer and opens it in your file manager, only when you press it. The root is empty until you set it in Settings → Lab Kit.

## Mobile
Calc tables, the hazard header and the built-in kit update work on mobile. The folder updater and the data-folder button are desktop only: on mobile the header shows "Data folder: desktop only" and the folder updater shows a notice. Snippet forms need Templater.

## Development
```bash
npm install
npm run dev          # builds into test-vault/.obsidian/plugins/lab-kit/ and watches
npm test             # vitest
```
Open `test-vault/` as a vault in Obsidian to try changes. Never develop in your real vault.

## Licence
MIT, see [LICENSE](LICENSE).
