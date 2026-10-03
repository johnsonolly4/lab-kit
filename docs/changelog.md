# Lab notebook kit: changelog

## Unreleased (v0.4)
- **Plugin folder is now `lab-kit`** (was `lab-calc`): `install-updater.ps1` / `.sh` install there. If you have the old plugin, turn **Lab Calc** off, delete `.obsidian/plugins/lab-calc`, turn **Lab Kit** on and set the Update folder again (old settings are not carried over)
- **"What's new" popup** replaces the changelog note: it opens once after an update and any time from Settings → Lab Kit → What's new (or the command "Show what's new"). The tutorial is on GitHub: [Lab Kit tutorial](https://github.com/johnsonolly4/lab-kit/blob/main/docs/tutorial.md). The kit no longer installs the "Lab notebook kit - tutorial" and "- changelog" notes (existing copies are left alone, you can delete them)
- **Hazard header is now part of the plugin** (```` ```lab-header ```` block, no Dataview needed):
  - redraws only when this note's Chemicals or a linked chemical note changes (fixes the stutter)
  - compact layout: one row per chemical with an H-code chip each; the old table is one setting away (Settings → Lab Kit → Hazards → Layout)
  - every option of the old script is a setting again, and can be set per note with lines inside the block (see the tutorial)
  - data folder roots are now plugin settings (empty by default); the folder is created when you press the button, not when the note is made
  - new note template uses the block; the old Dataview scripts stay for existing notes
- **Snippets find numbered tables**: the NMR / GPC / DLS / combined-results snippets now take sample codes from `samples`, `samples2`, `samples3`… (also `sample`, `sampling2`) and combine them, and the results table links every `nmr`, `nmr2`… table (falls through to the next table when a code isn't in the first). Before, a deleted or second sample table was missed

- **Duplicate table names are flagged**: if two `calc` tables in a note have the same `name:`, both show a red "⚠ name used twice" next to their name, and any reference to that name (`a!B2`, `SUM(a!A2:A5)`) shows `#REF!` instead of silently using the first table. Rename one to fix it
- **Click-to-edit is steadier**: a cell keeps its width while you edit it, and clicking another cell while one is open goes straight to it (before it took a second click)

## v0.3 (2026-10-02)
- **Kit updater** built into the plugin (now called **Lab Kit**, plugin 1.2):
  - checks your update folder (set in Settings → Lab Kit) when Obsidian starts and offers new versions
  - finds where everything lives (Templater settings, existing kit files) and shows the map before installing
  - previews every change, keeps `lab-config.json`, asks before overwriting files you edited
  - optional backups of replaced files (off by default; Settings → Lab Kit)
  - sets Templater's user script folder and turns on new CSS snippets for you
  - remembers install locations and follows files you move or rename
- `install-updater.ps1` / `install-updater.sh` for the one-time plugin install
- Everything from v0.2 is included (v0.2 never needs installing separately)

## v0.2 (2026-10-02)
Built from the v0.1 feedback.

**Calc tables (Lab Calc 1.1)**
- Toolbar (**+ Row · A1 · Copy**) moved left, so it no longer sits under Obsidian's `</>` button
- **+ Row** and right-click **insert / delete row**; formulas fill down; ranges and other tables' references update (like Excel)
- **Every cell is click-to-edit**, formulas included
- Missing inputs: results say **"needs …"** (amber) and the empty cells are outlined, instead of `#DIV/0!`
- New functions: `MW()` (from chemical notes), `PROP()`, `XLOOKUP`, `MATCH`, `INDEX`, `CONCAT`, `CLOCK`
- `icon:` and `copy: list` / `copy: column A` options
- Lucide icons instead of emoji

**Template**
- Type property starts blank
- cssclasses add `wide` and `scrolling_mermaid`
- Sections: Objectives · Apparatus · Procedure · Results / Analysis · Notes for next time
- Cursor tag removed; hazards start expanded
- 📁 Open data folder brings Explorer to the front (Windows)

**Snippets**: one form each, icon menu, 13 snippets
- Solution prep: MW from chemical notes, mmol, defaults to the Chemicals property, appearance lines removed
- Recipe by equivalents: rebuilt with *Relative to*, *Set mmol*, solvent "(rest)" row, total mass, wt%
- RAFT recipe generator: renamed, new icon, MW from notes, "needs" prompts
- Variant naming matrix (renamed): Copy gives one column
- **New:** Sample list, DLS samples, Combined results
- Sampling timetable: start time → target clock times; can generate NMR/GPC/DLS + results
- NMR / GPC / DLS: tag the note, per-row solvent/method, dataset note at the bottom, new checklist (submitted / processed / saved), rows can be added
- Flow: column prep and **Residence times** are separate; density not prefilled

**Other**
- `scrolling-mermaid.css` replaces `tabs-mermaid-scroll.css` (works with the `scrolling_mermaid` class)
- Tutorial document (including how the Python script works)
- Excel converter knows the new functions

## v0.1 (2026-10-02)
First version: template, snippet menu, Lab Calc 1.0, hazard view, header, Excel converter.
