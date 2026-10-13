# Lab Kit

Live calculation tables, lab snippet forms and a hazard header for a chemistry lab notebook in Obsidian.

Lab Kit turns a plain note into an experiment page: a hazard table built from your chemical notes, tables that calculate like a spreadsheet, and pop-up forms that write the tables you use every day (solutions, recipes, RAFT, sampling timetables, NMR / GPC / DLS sample tables). It started as a PhD lab notebook; the vocabulary is a chemistry lab's, but nothing stops you using it for anything that needs small calculations in a note.

> [!note] Beta
> Version 1.0.1 is a beta: the planning kit and the multi-kit system are new and not yet tested by many people. Report problems on GitHub.

## Contents
- [Features](#features)
- [Install](#install)
- [Quick start](#quick-start)
- [Calc tables](#calc-tables)
- [Chemical database](#chemical-database)
- [Snippet forms (Alt+S)](#snippet-forms-alts)
- [Analysis methods](#analysis-methods)
- [Experiment header](#experiment-header)
- [Built-in kit](#built-in-kit)
- [Folder contract](#folder-contract)
- [Settings](#settings)
- [Commands](#commands)
- [Privacy & permissions](#privacy--permissions)
- [Mobile](#mobile)
- [Troubleshooting](#troubleshooting)
- [Support and contributing](#support-and-contributing)
- [Development](#development)
- [Licence](#licence)

## Features
- **Calc tables**: ```` ```calc ```` blocks with Excel-style formulas (`SUM`, `XLOOKUP`, `IF`, …), references between tables, and `MW()` read from your chemical notes. Click a cell to edit; everything that depends on it updates. While you type a formula each reference gets its own colour, the cell it points at is outlined in that colour, and the column letters and row numbers show.
- **Chemical database**: point Lab Kit at your folder of chemical notes; typing `[[` in a calc cell and the reagent/solvent fields of the forms suggest them, by note name or by the names in a note's `Names` property. **New chemical** makes a chemical note with a name and a class.
- **Snippet forms** (Alt+S, needs Templater): solution prep (targets by concentration or ratio, added in g or mL), recipe by equivalents, RAFT recipe, sample lists, sampling timetables, NMR / GPC / DLS sample tables, combined results, flow column prep, residence times.
- **Your own analysis methods**: one note per method (and per machine) in a Methods folder defines the sample table; each shows up in the Alt+S menu and feeds the combined results.
- **Rig notes**: one note per flow rig, with small parts tables (pumps, reactor line, analysis); a ```` ```rig ```` block draws the flow diagram from their `ID` and `Feeds` columns and redraws when they change. **New rig** makes one from the Rig template in your Rigs folder. A batch setup (a stirred vessel, no pumps) is a Reactor row with a Heater and a Stirrer row feeding it.
- **Experiment header**: hazard table built from the note's Chemicals property, and a button that opens the experiment's data folder.
- **Built-in kit** (desktop and mobile): the templates, scripts and CSS snippet that go with the plugin are bundled in it, so a plugin update brings the new kit. Choose which snippets you want, review every change before it's made, update only the files you never edited, merge or resolve the ones you changed, and get a backup of anything replaced.
- **Planning kit** (preview, off until you switch it on): a homepage, a to-do board whose unfinished cards roll over to today, project hubs with a plan map (to-dos as cards joined by arrows: what comes after what, what is blocked, each one's result), meeting series with notes that fill themselves, knowledge notes, an inbox you sort one note at a time, and **Tidy up notes** for a vault that already has notes. See [tutorial section 8](docs/tutorial.md#8-planning-kit).

## Install
Needs Obsidian 1.14 or newer. For the snippet forms, also install [Templater](https://github.com/SilentVoid13/Templater). **Check setup…** (step 3) lists every plugin the kits use, which are needed and which are optional, and what each is for; Lab Kit never installs a plugin for you.

1. Settings → Community plugins → Browse → search **Lab Kit** → Install → Enable.
2. Settings → Lab Kit → Built-in kit → **Review update…** installs the templates and scripts. The first install can also turn on the CSS snippet and, if Templater has no user scripts folder yet, set one.
3. For Alt+S: Settings → Lab Kit → Kit folders and setup → **Check setup…** → Fix the Templater rows, then Obsidian → Hotkeys → search *Insert snippet* → set **Alt+S**.
4. Settings → Lab Kit → **Initials**: your initials go into sample codes (`ABC0016-A`). Until then the snippets use `XX`.

The full walk-through, with every feature explained, is the [tutorial](docs/tutorial.md). What changed in each version: [changelog](docs/changelog.md).

## Quick start
1. Create a new note in your **Notes** folder and type the title in the box that pops up. You get a numbered note (`0016 - Batch esterification`) with a hazard table, a data-folder button and five sections: Objectives, Apparatus, Procedure, Results / Analysis, Notes for next time.
2. Put your chemicals in the **Chemicals** property as links (`[[DCM]]`). The hazard table fills in from each chemical note's `H_Phrase` list.
3. Press **Alt+S**, type a few letters (`raft`, `sol`, `nmr`), press Enter, fill in the form, press Enter. The table appears in your note.
4. Click any blue (calculated) cell to see or change its formula; type a value in any cell, and the tables that use it update.

## Calc tables
A ```` ```calc ```` block holds a Markdown table that behaves like a small spreadsheet.

````
```calc
name: sol1
title: Stock solution
| Item | MW | mass (mg) | mmol |
|---|---|---|---|
| [[DCM]] | =MW(A2) | 250 | =C2/B2 |
```
````

- **Formulas** start with an equals sign and use Excel syntax. Row 1 is the header, so the first data row is row 2. Other tables in the note are reached by name (`sol1!D2`, `SUM(sol1!D2:D4)`).
- **Functions:** `SUM AVERAGE MIN MAX COUNT COUNTA PRODUCT SUMPRODUCT ROUND ROUNDUP ROUNDDOWN INT ABS SQRT POWER EXP LN LOG LOG10 MOD PI IF IFERROR AND OR NOT CONCAT MATCH INDEX XLOOKUP CLOCK MW PROP`. `MW("DCM")` reads the molecular weight from a chemical note, `PROP("PABTC", "Density")` any property, `CLOCK("10:30", 90)` gives a clock time 90 minutes later.
- **Editing:** click a cell, type, **Enter** or **Tab** to save, **Esc** to throw it away. **+ Row** adds a row and copies the formulas down; right-click a row to insert or delete one. References update like Excel, including those in other tables.
- **Colours:** plain = typed, blue = calculated, amber = "needs …" (an input is missing, it tells you which), red = a real problem (hover for the reason).
- **Copy** puts the table on the clipboard for Excel or Origin; **A1** shows cell addresses.
- **Block options** (lines above the table): `name`, `title`, `icon`, `decimals`, `sig`, `grid`, `copy`, `codes`. See the [tutorial](docs/tutorial.md#3-calc-tables).
- **From Excel:** the optional `excel_to_calc.py` script turns the sheets of an `.xlsx` into calc blocks, formulas included (tutorial section 5).

## Chemical database
Set **Chemical folder** to the folder that holds your chemical notes (one note per chemical). Lab Kit then uses them in three places:
- `MW()` and `PROP()` read the note's properties (MW from the property you choose in **Molecular weight property**, or `MW`, `Mr`, `Molecular weight` and similar).
- Typing `[[` in a calc cell, or in a reagent, solvent, monomer, CTA or initiator field of a form, suggests your notes by file name or by their **Names** property (a list or a single value). A name found through **Names** inserts `[[Note|name]]`.
- The hazard table lists each chemical from its `H_Phrase` property.

The command **New chemical** asks for the chemical's name, then its class (a list of the classes your notes already use; type a new one, or pick no class), and makes the note from the Chemical database template (needs Templater).

Give a chemical a `Chemical class` (a list property: `solvent`, `monomer`, `initiator`, `CTA`, or a class of your own; plain text works too). Form fields that ask for a class (Solvent, Monomer, CTA, Initiator) then suggest those chemicals first; switch on **Only suggest chemicals of the asked class** to hide the others. Reagents and solutes stay unfiltered.

A chemical note is an ordinary note with properties, for example:

```yaml
---
Names:
  - dichloromethane
  - methylene chloride
MW: 84.93
Density: 1.33
H_Phrase:
  - H315
  - H336
---
```

## Snippet forms (Alt+S)
Put the cursor where you want the table, press **Alt+S**, pick a snippet, fill in **one form**, press **Enter**. Forms start empty (grey placeholders show what to type), and submitting an untouched form inserts nothing.

| Snippet | Use it for |
|---|---|
| **Solution prep** | Making up a stock solution: a target per solute (M, mg/mL or g) or one total concentration split by a ratio, added in g or mL (mL uses the chemical note's Density), mmol and the concentration reached |
| **Recipe by equivalents** | Planning amounts from equivalents relative to any reagent; the first amount in mmol, g or M; solvent "rest" row; total mass and wt% |
| **RAFT recipe generator** | RAFT / PISA: monomer mass, DP, CTA:I, solids → every mass, solvent (and optional co-solvent), theoretical Mn |
| **Variant naming matrix** | A grid of conditions, with sample codes `ABC0016-A`, `-B`… |
| **Sample list** · **Sampling timetable** | Sample codes, with target clock times for kinetics (add the analysis tables below afterwards) |
| **NMR / GPC / DLS samples** · your own methods | Sample tables with machine, checklist and result columns. The sample codes come from every table in the note that holds codes; with more than one, **Codes from** picks which |
| **Combined results** | One row per sample with the results of every method |
| **Flow column prep** · **Residence times** | Packing a column, reactor volume, flow rates. Pick a solvent and leave the density empty, and the density is read from that chemical's note |
| **Rig** | Links the rig note, puts a fixed copy of its diagram at the cursor (with the rig note's `Summary` table under it, if it has one), sets the `Rig` property and copies the parts tables under `Flow platform setup` at the bottom of the note (a `Setup heading` property on the rig note changes the heading, e.g. for a batch rig) |
| **Blank calc table** | Your own columns |

Choose which snippets you want in **Manage files…** (each has a **Use** toggle). Icons for the Alt+S menu are a setting. Seven snippets (Variant naming matrix, Sample list, Sampling timetable, Flow column prep, Residence times, Blank calc table, Rig) are plain notes with a header of questions and `{{tokens}}` in the text, so you can read and edit them: syntax in [docs/snippet-syntax.md](docs/snippet-syntax.md).

## Analysis methods
One note per method in your **Methods folder**, with a `Columns` property, gives you a sample table of your own (mass spec, XRD, TGA, …), a **Results** property chooses what goes into Combined results, and one note per machine fills in defaults. Each method appears in the Alt+S menu by itself. NMR, GPC and DLS are built in. Details and an example: [tutorial section 6.1](docs/tutorial.md#61-analysis-methods-and-machines).

## Experiment header
A ```` ```lab-header ```` block shows, for the note it is in:
- a **hazard table** with every chemical in **Chemicals**, worst first, each H-code coloured by severity, as one row per chemical with chips (default) or as the two-column table;
- a **← Lab book** link to the Lab book board in the folder above the note's folder (when there is one; `back: false` in the block hides it);
- an **Open data folder** button that creates `<data folder root>/<note name>` and opens it (desktop only; set the root in Settings → Lab Kit → Lab header).

It only redraws when this note's Chemicals or a linked chemical note changes. The command **Insert lab header block** adds one; the Lab Book template already has it. Every option is in Settings → Lab Kit → Hazards and can be overridden for one note with lines inside the block (`layout: table`, `collapsed: false`, …): see [tutorial section 4](docs/tutorial.md#4-hazards).

## Built-in kit
The templates (Lab Book, Alt+S menu, one file per snippet), the Templater scripts and a CSS snippet are bundled inside the plugin. Updating the plugin brings the new kit, but your files only change when you say so:
- **Review update…** previews every file (new, updated, changed by you, missing) and writes nothing until you press **Apply**. Each file has a tick box, so you can leave single files out.
- **Update all safe files** adds new files and updates the ones you never edited.
- **Manage files…** lists every kit file with a status and buttons to update, restore the original, detach, or open it; files that need action come first. Each snippet row has **Make my own copy**: it asks for a name and saves a plain, editable note in the Snippets folder.
- A file you edited is never overwritten. If your changes and the kit's touch different lines you can **merge**; if they touch the same lines you **resolve** them change by change.
- A file you are meant to edit (the homepage, a board, a hub note) is **kept**: the kit never updates it. When the kit has a newer text for one, a notice at start-up and a line in the settings say so, and its row in Manage files has **Compare…**, **Use kit version…** and **Keep mine**.
- When the kit renames a file, Review update… moves your copy to the new name.
- Every replaced file is copied to a backup folder first. **Clear old backups…** moves backups older than 30 days, older than 7 days, or all of them, to the trash.

The kit is split into two **kits**, each with its own files, state and switch: the **lab kit** (Lab Book template, snippets, scripts; on by default) and the **planning kit** (homepage, to-do board, projects, meetings, knowledge notes; preview, off until you switch it on). Review, Manage and Update work per kit.

## Folder contract
The kits expect these folders. Each is a setting; empty means the default below, and a folder you rename inside Obsidian is followed by its setting.

| Folder (default) | Used by | Setting |
|---|---|---|
| `03 Lab Book/Notes` | lab kit: experiment notes | Lab notes folder |
| `05 Chemicals/Chemicals` | lab kit: chemical notes | Chemical folder |
| Methods folder (empty until set) | lab kit: analysis methods | Methods folder |
| Rigs folder (`03 Lab Book/Rigs` unless you set another; Check setup's Fix creates it) | lab kit: rig notes | Rigs folder |
| `00 Inbox` · `01 Daily Notes` | planning kit | Planning folders |
| `00 Planning` (to-dos in `00 Planning/To-dos`) | planning kit | Planning folders |
| `02 Projects` · `04 Literature` · `06 Knowledge` · `07 How-tos` · `08 Meetings` | planning kit | Planning folders |
| `99 Archive` (made when first needed) | planning kit | Planning folders |
| `Extras/` (templates, scripts, fonts) | both kits | Kit folders and setup |

A new vault can get this layout, the plugin list and the Templater settings from the generated starter (see Development).

## Settings
Settings → Lab Kit is searchable and grouped:

| Group | What is in it |
|---|---|
| **Built-in kit** | Update available, Kept files with a newer kit version, Kit version (Manage files, Review update, Update all safe files), Planning kit (preview) switch and its files, What's new, update notice, Old backups (**Clear old backups…**), Backup folder |
| **Kit folders and setup** | **Check setup…** (its Fix sets up Templater), **Check hotkeys…**, Templates folder, Scripts folder, Snippets folder, **Colour board columns** (kanban columns coloured by status: Planned, Started, Processing results, Closed) with a colour for each status, console log |
| **Lab notebook** | Initials, Chemical folder, Only suggest chemicals of the asked class, Lab notes folder, Molecular weight property, Methods folder, Rigs folder |
| **Planning folders** (planning kit on) | Inbox, Daily notes, Planning, Projects, Literature, Knowledge, How-tos, Meetings, Archive (empty = the default, e.g. `02 Projects`), **Find moved folders…**, **Due-date countdown** (Off / only to-dos with `countdown: true` / every to-do with a due date: days left on the board card), **Project plan view** (a project hub shows the card map only, or the map with the plan list above it), **Project plan map direction** (left to right, or top to bottom), **Checklist progress** (writes `progress`, for example 3/7 ticked check boxes, into the properties of lab notes and the Shopping list so a board card can show it; off by default) |
| **Snippet menu → Snippet icons** | A page with one row per snippet: the icon shown beside the box, a **Choose…** button with a searchable grid of Obsidian's icons, or type a Lucide name. Empty keeps the snippet's own icon |
| **Lab header** | Data folder root (one for Windows, one for macOS / Linux) |
| **Hazards** | Layout, property names, collapsed / legend / sorting options |

Folder settings left empty are detected; the data folder roots are empty until you set them. Rename or move folders **inside Obsidian** and the folder settings follow; a folder moved outside Obsidian (Finder, File Explorer, a sync tool) is found again with **Find moved folders**. Settings changed on another device (Obsidian Sync, iCloud, Dropbox, Syncthing, Git) are read again when they arrive.

## Commands
Open the command palette and type *Lab Kit*. There are no default hotkeys.

| Command | Does |
|---|---|
| Insert empty calc block | Adds a small example calc table at the cursor |
| Insert lab header block | Adds the hazard / data-folder header at the cursor |
| New lab entry | A new experiment note from the Lab Book Template in your Lab notes folder (needs Templater) |
| New chemical | Asks the chemical's name, then its Chemical class; makes the note from the Chemical database template in your Chemical folder (needs Templater) |
| New rig | Asks the rig's name; makes the note from the Rig template in your Rigs folder and opens it |
| Review kit files | Opens the update preview |
| Manage kit files | Opens the list of kit files |
| Show what's new | Opens the What's new popup for this version |
| Find moved folders | For each folder in the settings that no longer exists (moved outside Obsidian), suggests where it went; Apply changes only the settings |
| Check hotkeys | Reports the keys the Hotkeys note recommends for the kit's functions and what Obsidian has now (also a button in Settings → Lab Kit); sets nothing |
| Check setup | Lists what the kits need (plugins, Templater and its scripts, Meta Bind buttons, the homepage and its read-only mode, ZotLit's frontmatter fields and folders, meeting series, CSS snippets, folders) with a Fix for each missing item; nothing changes until you confirm |
| Tidy up notes | Shows the notes of an existing vault that don't match the kit layout, before and after; every rule and every note has a tick box, and **Change notes…** rewrites only what you tick, after a backup and a second confirmation. Unchanged lines are folded and a change that is the same in several notes is shown once, with one tick box. One rule, **Hubs: bring the page up to the current template**, rewrites the page of project, topic and meeting series hubs from the kit's templates (keeping a project's goal and Related text and a topic's intro) and is never ticked by default |

With the **planning kit** on (Settings → Lab Kit → Built-in kit), these are added. Open meeting deck is desktop only.

| Command | Does |
|---|---|
| New to-do | A to-do note in the Planning folder's `To-dos` |
| Quick capture | An empty note in the Inbox, opened |
| Add to shopping list | Adds comma-separated items to `Shopping list.md` in the Planning folder |
| Sort inbox | Opens each Inbox note in turn and asks where it goes (to-do, a project, Knowledge, How-tos, Meetings, archive, delete, skip); in a folder list you can type a new folder name. Esc or Stop ends it |
| Add result | Sets the one-line `result` of the to-do you have open (shown on its plan map card) |
| Link to-dos in order | Select a list of `[[to-do]]` links in a note; each to-do then comes after the one before it (a preview first, Undo afterwards) |
| Archive old to-dos | Moves to-dos finished more than 30 days ago into the Archive folder, except those of a project that is not Done |
| New meeting series | Asks name, how often, day, date of the first meeting, the deck path and (optional) the name of your own meeting note template; makes the series folder under Meetings and its hub note. Also a button on the Meetings hub |
| New meeting · New one-off meeting · New extra meeting now | A note for a meeting series (asks which when there are several); a one-off meeting uses the smaller kit template **One-off meeting**; **New extra meeting now** (the **Extra meeting now** button on each series hub) adds a meeting on a date you give without moving the schedule. A series hub's `template` property names your own meeting note template |
| Open meeting deck | Opens the deck location of this computer: set in the series' note (`deck_windows` / `deck_mac`) as a folder with all the decks in, or the path to one deck file. On a series hub or a meeting note it opens that series' deck; from any other note it asks which series |
| New project · New project note | A project hub (its top row has New to-do, New note, a Status drop-down, a Deadline date and the countdown), or a note inside a project, linked to its hub |
| New concept | A knowledge note: asks title and topic, files it in the Knowledge folder under the topic. The **New concept** button on a topic hub skips the topic question |
| New topic hub | The index note of a topic folder under Knowledge (`kind: hub`, named like the folder): pick a topic without one, or type the name of a new topic; a text area for what the topic is about, then a list of its notes. Project, topic and series hubs start with a back link to the hub one folder up, which follows folder renames |
| Roll over to-dos now | Carries unfinished to-dos over to today |
| Open to-do board | Opens the to-do board in the Planning folder |

## Privacy & permissions
- **No network use.** Lab Kit never connects to the internet, has no account, no ads, no telemetry and no paid features. The "full changelog" button only opens a link in your browser when you press it.
- **Files in your vault**: the built-in kit reads and writes only the folders you set in Settings → Lab Kit, and copies a replaced file to a backup folder first. To find where your templates and scripts are, it lists the files in your vault.
- **Other plugins' settings**: never changed without asking. Before the first kit install (and before a Check setup Fix) a confirmation lists every file, folder and setting it will touch, each setting with a switch: the kit's CSS snippet, Templater's user scripts folder when Templater has none (a folder you set is never changed; the lab scripts go into a `lab-kit` folder inside it), Templater's template folder when it is empty (Set up only), and the Alt+S template in Templater's hotkeys. A **Check setup** Fix changes one thing, after its own confirmation: Templater's folder templates, its template matching mode (only from None) and the old roll-over entry in its startup templates; Obsidian's *Properties in document* (to Hidden); with the planning kit, Meta Bind's button templates (adds the missing ones; a second Fix puts the kit's action back on a kit button that does something else), Notebook Navigator's homepage (only when none is set) and ZotLit's settings (adds the frontmatter fields that are missing, sets its two folders when they are empty, then turns ZotLit off and on so it reads them). **Tidy up notes** can change Templater paths and Meta Bind buttons that point at a renamed folder or an old template, only the ones you tick, after a backup.
- **Clipboard**: the **Copy** button on a table writes to the clipboard, only when you click it.
- **Files outside your vault** (optional, desktop only): the **data-folder button** in the experiment header creates `<data folder root>/<note name>` on your computer and opens it in your file manager, only when you press it. The root is empty until you set it in Settings → Lab Kit → Lab header. Nothing else reads or writes outside your vault.

## Mobile
Calc tables, the hazard header and the built-in kit work on mobile. The data-folder button is desktop only: on mobile the header shows "Data folder: desktop only". Snippet forms need Templater. The planning kit's **Open meeting deck** is desktop only.

## Troubleshooting
| Problem | Fix |
|---|---|
| Alt+S does nothing, or the forms ask one question at a time | Install Templater, run **Check setup…** and Fix the Templater rows (Settings → Lab Kit → Kit folders and setup), and set the Alt+S hotkey |
| `#NOTE?` in an MW cell | No chemical note with that name: check the spelling, or type the MW over the formula |
| `#PROP?` in an MW cell | The note has no molecular weight property (set **Molecular weight property**) |
| `#REF!` | The formula points at a deleted row, or a table name that doesn't exist or is used twice |
| A calc table looks like plain code | Lab Kit isn't enabled |
| Hazard table empty | Chemicals property empty, or the chemical notes have no `H_Phrase` list |
| A homepage or hub button does nothing, or shows "Button ID not found" | **Check setup…** → Fix on the Meta Bind buttons row, then restart Obsidian (Meta Bind loads its buttons at start-up) |
| "Folder … not found", or homepage lists empty after moving folders outside Obsidian | Command **Find moved folders** (or Check setup → Find): pick where each folder went |

More in the [tutorial](docs/tutorial.md#9-troubleshooting).

## Support and contributing
Found a bug or want a feature? [Open an issue](https://github.com/johnsonolly4/lab-kit/issues) and say what you did, what you expected and what happened (a screenshot of the table helps). Pull requests are welcome; run `npm test` and `npm run lint` first.

## Development
```bash
npm install
npm run dev          # builds into test-vault/.obsidian/plugins/lab-kit/ and watches
npm test             # vitest
npm run lint
npm run build
npm run starter     # new-vault settings + plugin list, from the kits, into dist/starter/
```
`npm run tidy-fixture` writes `test-vault-tidy/`, a small vault of old-style notes (from `tests/fixtures/`) to try **Tidy up notes** on; open it as its own vault, never your real one.

`npm run starter` writes `dist/starter/`: empty contract folders, Obsidian settings (plugin list, CSS snippets, Alt+S, Templater folders) and `install-plugins.sh` / `.ps1`, generated from the kits so they can't drift. Copy it into an empty folder, run the install script with Obsidian open, then **Check setup**. Steps in [GETTING-STARTED](GETTING-STARTED.md#new-vault-from-the-starter).

Open `test-vault/` as a vault in Obsidian to try changes. Never develop in your real vault. The kit files live in `kits/` and are embedded in `main.js` at build.

## Licence
MIT, see [LICENSE](LICENSE).
