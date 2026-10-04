# Lab Kit

Live calculation tables, lab snippet forms and a hazard header for a chemistry lab notebook in Obsidian.

## Features
- **Calc tables**: ```` ```calc ```` blocks with Excel-style formulas (`SUM`, `XLOOKUP`, `IF`, …), references between tables, and `MW()` read from your chemical notes. Click a cell to edit; everything that depends on it updates.
- **Chemical database**: point Lab Kit at your folder of chemical notes; typing `[[` in a calc cell and the reagent/solvent fields of the forms suggest them, by note name or by the names in a note's `Names` property.
- **Snippet forms** (Alt+S, needs Templater): solution prep, recipe by equivalents, RAFT recipe, sample lists, sampling timetables, NMR / GPC / DLS sample tables, combined results, flow column prep, residence times.
- **Experiment header**: hazard table built from the note's Chemicals property, and a button that opens the experiment's data folder.
- **Built-in kit** (desktop and mobile): the templates, scripts and CSS snippet that go with the plugin are bundled in it, so a plugin update brings the new kit. Choose which snippets you want, review every change before it's made, update only the files you never edited, merge or resolve the ones you changed, and get a backup of anything replaced.

## Install
Needs Obsidian 1.13 or newer. Not in the community store yet. Until then:
1. Download `main.js`, `manifest.json` and `styles.css` from the latest [release](../../releases).
2. Put them in `<your vault>/.obsidian/plugins/lab-kit/`.
3. Settings → Community plugins → enable **Lab Kit**.
4. Settings → Lab Kit → Built-in kit → **Review update…** installs the templates and scripts. The first install can also turn on the CSS snippet and, if Templater has no user scripts folder yet, set one.

For the snippet forms, also install [Templater](https://github.com/SilentVoid13/Templater). The tutorial explains each feature, including the one-time Alt+S setup: [docs/tutorial.md](docs/tutorial.md). What changed in each version: [docs/changelog.md](docs/changelog.md).

## Privacy & permissions
- **No network use.** Lab Kit never connects to the internet, has no account, no ads, no telemetry and no paid features. The "full changelog" button only opens a link in your browser when you press it.
- **Files in your vault**: the built-in kit reads and writes only the folders you set in Settings → Lab Kit, and copies a replaced file to a backup folder first. To find where your templates and scripts are, it lists the files in your vault.
- **Other plugins' settings**: only on the first kit install, and only if you leave the switches on: it turns on the kit's CSS snippet, and sets Templater's user scripts folder when Templater has none (a folder you set is never changed).
- **Clipboard**: the **Copy** button on a table writes to the clipboard, only when you click it.
- **Files outside your vault** (optional, desktop only): the **data-folder button** in the experiment header creates `<data folder root>/<note name>` on your computer and opens it in your file manager, only when you press it. The root is empty until you set it in Settings → Lab Kit. Nothing else reads or writes outside your vault.

## Mobile
Calc tables, the hazard header and the built-in kit work on mobile. The data-folder button is desktop only: on mobile the header shows "Data folder: desktop only". Snippet forms need Templater.

## Development
```bash
npm install
npm run dev          # builds into test-vault/.obsidian/plugins/lab-kit/ and watches
npm test             # vitest
```
Open `test-vault/` as a vault in Obsidian to try changes. Never develop in your real vault.

## Licence
MIT, see [LICENSE](LICENSE).
