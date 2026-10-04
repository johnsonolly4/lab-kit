# Lab notebook kit: changelog

## v0.5.0 (2026-10-04)
- **Solution prep rebuilt**: two tables, **Targets** (final volume, and a total concentration when you split by a ratio) and the components. Each solute can have its own target in **M, mg/mL or g** (the Unit cell), or you give one **total concentration** (M or mg/mL) split between the solutes by a **molar or mass ratio**. **Added** can be in **g or mL** (type `g` or `mL` in the In column): mL is converted to g with the row's **Density** (filled from the chemical note's Density property; blank = the row shows an error, never an assumed 1.0). Each solvent gets its own row (several share the final volume equally; edit the formula to change the split). The table shows the mmol (or mol: your choice in the form) and the concentration actually reached (M and mg/mL). Update the kit (Review update…) to get it; tables made with the old Solution prep keep working
- **Analysis methods as notes**: set **Methods folder** in Settings → Lab Kit and put one note per analysis method in it (for example `Mass spec`). The note's properties give the table: **Columns** (`Name`, `Name: default`, `Name: =formula` with `{Other column}` for that row's cell, `Name: {n}` for a row number), **Results** (the columns that go into Combined results), **Machines** (links to machine notes) and **Default machine**; optional **Title**, **Icon**, **Tag**, **Checklist**, **Sample column** and **Dataset folder**. A machine note's property named like a column (Eluent, Solvent, Calibrant…) becomes that column's default for the machine. NMR, GPC and DLS stay built in (a note with the same name replaces one). Every method note also shows up in the **Alt+S menu by itself** (after the numbered snippets, with its Icon), no refresh needed: picking it opens that method's form. The snippet **Analysis table** asks for the method first, then shows the form: sample codes, a **Machine** dropdown when the method has machines, and a field for each column with a default. The Sample list and Sampling timetable forms get a toggle per method, and **Combined results** can mix any methods (a code missing in the first table of a method is still looked up in its next tables). Column positions in Combined results are found by header name. Type a folder that does not exist yet in the Methods folder box and it is created when you leave the box. Empty Methods folder: everything works as before. Update the kit (Review update…) to get the new scripts and snippet
- **New default folders**: in a vault that has no kit files yet, the templates go in Templater's template folder (or `Templates` at the vault root) and all the scripts in Templater's scripts folder (or `scripts` at the vault root): no `Lab Kit`, `lab-kit` or `Extras` folders. A vault that already has kit files keeps using the folders they are in; the Templates, Scripts and Backup folder settings still override
- **The Dataview-era files are gone from the kit**: `hazards/view.js`, `lab-header/view.js` and `lab-config.json` are no longer shipped (the plugin draws the header and hazards itself). Copies already in your vault are marked **Retired** in Manage files… and are never deleted: delete them by hand or press **Forget**. Initials now come only from Settings → Lab Kit → Initials (the old `lab-config.json` fallback is gone). `excel_to_calc.py` stays, with a **Use** toggle in Manage files…
- **Chemical database**: set **Chemical folder** in Settings → Lab Kit to the folder of your chemical notes. Typing `[[` in a calc cell then suggests them (by note name, or by the names in the note's **Names** property: picking one found by a name gives `[[Note|name]]`), and the reagent, solvent, monomer, CTA and initiator fields in the Alt+S forms suggest them for the item you are typing (after the last comma). Empty folder = no suggestions, everything as before
- **Molecular weight property**: tell `MW()` which property holds the molecular weight (Settings → Lab Kit). It is tried before the usual names (MW, Mr, Molecular weight…)
- **Column snippet: Solvent field**: an optional solvent; if its note has a **Density**, the density row is filled in. A density you type in the form wins
- **Solution prep and Recipe start empty**: the reagent and solvent fields no longer fill themselves from the note's Chemicals property (type them, or pick from the suggestions)
- **Page no longer jumps after a cell is saved, also in big notes**: the page is held in place for as long as the tables are still redrawing (up to 8 s), not only for the first 1.5 s; grabbing the scrollbar also lets go
- **Calc tables sit flush with the text**: padding and side margins that Obsidian or a theme put on tables are reset for calc tables
- **Fixed: the kit's scripts and templates listed from an old backup folder**: when an old backup (for example `Extras/kit-backups/<date>/…`) held a copy of `labForm.js` or `Insert snippet.md`, the kit could treat that copy as the real file. Backup copies are now ignored, and a path an earlier version recorded inside a backup is replaced by the real place
- **Review update…: Tick all / Untick all** for the files with a box (recreate, merge), and the Apply row stays in view while the list scrolls. A file an earlier version recorded inside a backup folder now shows as a new file to create, not as "deleted by you"
- **Folders inside a backup folder are ignored**: if Templater's user scripts or template folder (or a folder the kit remembered) points into a backup, the kit no longer uses it. **Set up** replaces such a folder with the real one
- **Lab Book template starts with an empty line** under the properties, so the cursor lands there and not in front of the lab header block (which then showed as source). Update the kit to get it
- **Manage files…**: the Open button is gone from the snippet rows (each is only a small stub that calls the snippet code, so opening it was no use)
- **Manage files…** keeps its scroll position after Install, Detach, Re-attach and the other buttons (it used to jump back to the top)
- **Settings boxes fill the row, and folder boxes suggest your folders**: every text box in Settings → Lab Kit is wide (the Chemical folder box was too narrow to read), and the Chemical, Templates, Scripts and Backup folder boxes show a list of your vault's folders as you type
- **Clicking another cell opens it with one click also after you changed the text**: the click is carried over the save. Obsidian rebuilds the table a moment after a save, which wiped a cell opened too early; the next cell now opens once the redraws have settled (about half a second after a changed cell). An unchanged cell still moves on at once
- **Built-in kit is the first group in Settings → Lab Kit**, with a new **Set up** button (Templater row): it points Templater's user scripts folder at the kit's scripts (only when Templater can't find them now), fills in Templater's template folder only when it is empty (never changes one you set), and adds Insert snippet to its Template hotkeys. Use it after installing the kit
- **Templater hotkey**: when the kit installs or updates the Alt+S menu template (Insert snippet.md), it is also added to Templater's **Template hotkeys**, if it isn't there yet. You only need to set Alt+S in Obsidian → Hotkeys. Nothing is ever removed from Templater's settings
- Update the kit (Review update…) to get the new forms
## v0.4.9 (2026-10-04)
- **The folder updater is gone**: the kit comes with the plugin, so a plugin update brings the new kit, and **Review update…** / **Update all safe files** install it. The "Kit updates" settings (update folder, check at start, install record) and the command **Check for updates** are removed, and releases no longer carry a kit zip. Files the folder updater installed are still recognised as unchanged
- **First install sets things up**: the question before the first kit install has two switches, both on: **Turn on the CSS snippet**, and **Set Templater's user scripts folder** (only when Templater has none yet; a folder you set is never changed)
- **Update notice**: when Obsidian starts after the plugin brought a newer kit, a notice says **Lab kit vX is ready → Review**. Switch it off in Settings → Lab Kit → **Tell me when a kit update is ready**. **What's new** moved to the Built-in kit group
- **Pick your snippets**: in Settings → Lab Kit → Manage files…, every snippet has a short description and a **Use** toggle. Off = not installed and not in the Alt+S menu. Turning off a snippet you already have asks first, backs it up and moves it to your trash. The menu, the scripts and the Lab Book template stay always on
- **Tidier folders for new vaults**: the first install puts the kit's templates in a **Lab Kit** folder inside Templater's templates folder, and its scripts in a `lab-kit` folder inside Templater's scripts folder. Vaults that already have the kit never move: new files go next to the ones you have
- **Sample letters carry on**: a second sample list, variant matrix or sampling timetable in the same note starts at the next free letter instead of repeating A, B, C. You can still edit the codes in the form. A timetable only looks at earlier timetables, so a sample list and its timetable both start at A
- **Backups are hidden**: replaced kit files are now copied to `.obsidian/plugins/lab-kit/backups` (out of your file list) unless you set your own Backup folder. Old backups in `kit-backups` stay where they are
- **"Kit notes" location removed** from the folder updater window: no kit file uses it any more

## v0.4.8 (2026-10-04)
- **Last fixes for the Obsidian community store scan**: the hazard header's data folder button opens the folder through Obsidian on every platform, so the kit no longer starts Explorer itself. Nothing changes in how you use it (update the kit to get the new `lab-header/view.js`)

## v0.4.7 (2026-10-04)
- **Fixes for the Obsidian community store scan**: the plugin and the kit no longer start other programs, and `!important` is gone, and all access to Node features goes through one guarded place, so it still loads on mobile
- **Windows opens the data folder through Obsidian** (like macOS and Linux), instead of starting Explorer separately
- **README: "Privacy & permissions"** lists what the plugin reads and writes (no network, no account, no telemetry)
- **Releases are built on GitHub** and signed with an attestation, so the files you install are the ones built from the tagged source. Nothing changes in how you use the plugin

## v0.4.6 (2026-10-04)
- **Tab and Escape in a cell**: Tab saves what you typed (like Enter), Escape throws it away. Obsidian no longer also acts on those keys while a cell is open
- **Page no longer jumps after editing a cell**: the note stays at the same scroll position when a cell is saved and the table redraws (it holds the position for about a second, and lets go as soon as you scroll yourself)
- **Kit updates and your frontmatter**: in the Lab Book template the properties (the block between the `---` lines) are now merged property by property. A property you added stays, a property only the kit changed is updated, and only a property you both changed differently counts as a conflict (it shows as one change in **Resolve…**). Your own wording and order are kept
- **Files the kit drops or moves**: if a later kit no longer ships a file you installed, **Manage files…** and **Review update…** list it as **Retired**. It stays in your vault and is never deleted; **Forget** stops listing it. If the kit moves a file, your copy stays where it is and keeps updating
- **Resolve a kit file conflict, one change at a time**: in **Manage files…** a file marked **Conflict** now has a **Resolve…** button. The window shows each place you and the kit changed the same lines (yours, the kit's, the original) and lets you **Keep mine**, **Take kit**, **Keep both** or **Edit** it, with a preview of the finished file. **Apply** backs up your copy, writes the file and marks it **Merged**. **Keep all mine** leaves your file as it is; **Take kit version** replaces it. **Later** changes nothing. Merged scripts come with a "please test" note
- **Kit files you and the kit both edited can be merged**: when your edits and the kit's touch different lines, **Review update…** lists the file under "merges cleanly" with a tick box (ticked by default), and **Manage files…** shows a **Merge** button. Your copy is backed up first; merged scripts come with a "please test" note. If you both changed the same lines the file shows **Conflict** and is left untouched (press **Resolve…** to settle it, see the point above; **Restore kit original** still works). **Update all safe files** never merges
- **Manage kit files** (Settings → Lab Kit → Built-in kit → **Manage files…**, or the command "Manage kit files"): every kit file with a status (up to date, update available, changed by you, missing, detached) and its own buttons: install / update / recreate, **Restore kit original** (your copy is backed up first), detach / re-attach, open. The window also has a switch for the kit's CSS snippet (on Obsidian versions that allow it; otherwise it says where to turn it on)
- **The kit is built into the plugin** (first part): Settings → Lab Kit → **Built-in kit** shows the bundled kit version, **Review update…** (a preview of every file: new, updated, changed by you, missing) and **Update all safe files** (new files and files you never edited; the first install asks first). Every file it replaces is copied to the Backup folder first, a file you changed is never overwritten, and a file you deleted is only recreated if you tick it. A file you *and* the kit both changed is listed and left alone (merging comes in a later version). Works on mobile. Templates folder, Scripts folder (not a hidden folder) and Backup folder are settings; empty means detected. The folder updater below still works
- **The kit updater no longer installs the plugin itself**: it only manages templates, scripts and the CSS snippet. The plugin is updated by Obsidian (community plugins) or by copying the three release files; the updater window no longer lists a "Lab Kit plugin" row and no longer reloads the plugin
- **Settings are searchable**: Lab Kit's settings page now uses Obsidian's new settings API, so its options show up in the global settings search. **Needs Obsidian 1.13 or newer.** Two small look changes: the hazards note about per-note options is its own row ("Per-note options"), and "Install locations" opens with a "Show" link
- **Flow column prep asks for the packing material** (empty by default, added as the last row of the "Column weighing" table, so `column!B10` is still the reactor volume)
- **Update command renamed** to "Check for updates" (Obsidian already shows "Lab Kit:" in front of it)
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
- **Click-to-edit keeps its width**: a cell keeps its width while you edit it. Known issue: clicking another cell while one is open still needs a second click
- **RAFT recipe: mol fractions always add up**: with several monomers the fractions (e.g. 0.333 × 3) are now divided by their sum, so moles, masses and theoretical Mn are exact. The tip callout under the table is gone

- **Initials are a plugin setting** (Settings → Lab Kit → Initials, empty by default). The snippets read it for sample codes; until it is set they use `XX` and show a notice. `lab-config.json` is only a fallback for older installs
- **Forms start empty**: chemical names (solution, recipe, RAFT, variant matrix) and the NMR dataset no longer have example values; grey placeholders show what to type. Reagents still default to the note's Chemicals
- **New note headings** have new emoji: 🔬 Objectives · ⚙️ Apparatus · ⚗️ Procedure · 📈 Results / Analysis · 💡 Notes for next time
- **Empty calc cells are taller**, so they are easier to click
- **Sample list and timetable forms**: the technique toggles are headed "Also add (appended below)", so it is clear the tables go under the sample table
- **Residence times snippet**: the formula (τ = V / Q) now sits in an info callout above the tables
- **Snippet menu icons are a setting** (Settings → Lab Kit → Snippet menu): type a [Lucide](https://lucide.dev) icon name for any snippet; empty keeps the built-in icon. The colour is always your Obsidian accent colour

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
