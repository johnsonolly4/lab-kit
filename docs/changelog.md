# Lab notebook kit: changelog

## Unreleased (v0.4)
- **Hazard header is now part of the plugin** (```` ```lab-header ```` block, no Dataview needed):
  - redraws only when this note's Chemicals or a linked chemical note changes (fixes the stutter)
  - compact layout: one row per chemical with an H-code chip each; the old table is one setting away (Settings → Lab Kit → Hazards → Layout)
  - every option of the old script is a setting again, and can be set per note with lines inside the block (see the tutorial)
  - data folder roots are now plugin settings (empty by default); the folder is created when you press the button, not when the note is made
  - new note template uses the block; the old Dataview scripts stay for existing notes

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
