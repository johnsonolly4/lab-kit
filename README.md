# Lab Kit

Live calculation tables, lab snippet forms and a hazard header for a chemistry lab notebook in Obsidian.

Lab Kit turns a plain note into an experiment page: a hazard table built from your chemical notes, tables that calculate like a spreadsheet, and pop-up forms that write the tables you use every day (solutions, recipes, RAFT, sampling timetables, NMR / GPC / DLS sample tables). It started as a PhD lab notebook; the vocabulary is a chemistry lab's, but nothing stops you using it for anything that needs small calculations in a note.

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
- [Settings](#settings)
- [Commands](#commands)
- [Privacy & permissions](#privacy--permissions)
- [Mobile](#mobile)
- [Troubleshooting](#troubleshooting)
- [Support and contributing](#support-and-contributing)
- [Development](#development)
- [Licence](#licence)

## Features
- **Calc tables**: ```` ```calc ```` blocks with Excel-style formulas (`SUM`, `XLOOKUP`, `IF`, …), references between tables, and `MW()` read from your chemical notes. Click a cell to edit; everything that depends on it updates, and the cells a formula points at are ringed while you type it.
- **Chemical database**: point Lab Kit at your folder of chemical notes; typing `[[` in a calc cell and the reagent/solvent fields of the forms suggest them, by note name or by the names in a note's `Names` property.
- **Snippet forms** (Alt+S, needs Templater): solution prep (targets by concentration or ratio, added in g or mL), recipe by equivalents, RAFT recipe, sample lists, sampling timetables, NMR / GPC / DLS sample tables, combined results, flow column prep, residence times.
- **Your own analysis methods**: one note per method (and per machine) in a Methods folder defines the sample table; each shows up in the Alt+S menu and feeds the combined results.
- **Experiment header**: hazard table built from the note's Chemicals property, and a button that opens the experiment's data folder.
- **Built-in kit** (desktop and mobile): the templates, scripts and CSS snippet that go with the plugin are bundled in it, so a plugin update brings the new kit. Choose which snippets you want, review every change before it's made, update only the files you never edited, merge or resolve the ones you changed, and get a backup of anything replaced.

## Install
Needs Obsidian 1.13 or newer. For the snippet forms, also install [Templater](https://github.com/SilentVoid13/Templater).

1. Settings → Community plugins → Browse → search **Lab Kit** → Install → Enable.
2. Settings → Lab Kit → Built-in kit → **Review update…** installs the templates and scripts. The first install can also turn on the CSS snippet and, if Templater has no user scripts folder yet, set one.
3. For Alt+S: Settings → Lab Kit → Kit folders and setup → Templater → **Set up**, then Obsidian → Hotkeys → search *Insert snippet* → set **Alt+S**.
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

- **Formulas** start with `=` and use Excel syntax. Row 1 is the header, so the first data row is row 2. Other tables in the note are reached by name (`sol1!D2`, `SUM(sol1!D2:D4)`).
- **Functions:** `SUM AVERAGE MIN MAX COUNT COUNTA PRODUCT SUMPRODUCT ROUND ROUNDUP ROUNDDOWN INT ABS SQRT POWER EXP LN LOG LOG10 MOD PI IF IFERROR AND OR NOT CONCAT MATCH INDEX XLOOKUP CLOCK MW PROP`. `MW("DCM")` reads the molecular weight from a chemical note, `PROP("PABTC", "Density")` any property, `CLOCK("10:30", 90)` gives a clock time 90 minutes later.
- **Editing:** click a cell, type, **Enter** or **Tab** to save, **Esc** to throw it away. **+ Row** adds a row and copies the formulas down; right-click a row to insert or delete one. References update like Excel, including those in other tables.
- **Colours:** plain = typed, blue = calculated, amber = "needs …" (an input is missing, it tells you which), red = a real problem (hover for the reason).
- **Copy** puts the table on the clipboard for Excel or Origin; **A1** shows cell addresses.
- **Block options** (lines above the table): `name`, `title`, `icon`, `decimals`, `sig`, `grid`, `copy`. See the [tutorial](docs/tutorial.md#3-calc-tables).
- **From Excel:** the optional `excel_to_calc.py` script turns the sheets of an `.xlsx` into calc blocks, formulas included (tutorial section 5).

## Chemical database
Set **Chemical folder** to the folder that holds your chemical notes (one note per chemical). Lab Kit then uses them in three places:
- `MW()` and `PROP()` read the note's properties (MW from the property you choose in **Molecular weight property**, or `MW`, `Mr`, `Molecular weight` and similar).
- Typing `[[` in a calc cell, or in a reagent, solvent, monomer, CTA or initiator field of a form, suggests your notes by file name or by their **Names** property (a list or a single value). A name found through **Names** inserts `[[Note|name]]`.
- The hazard table lists each chemical from its `H_Phrase` property.

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
| **Sample list** · **Sampling timetable** | Sample codes, with target clock times for kinetics; can add the analysis tables below |
| **NMR / GPC / DLS samples** · **Analysis table** | Sample tables with machine, checklist and result columns |
| **Combined results** | One row per sample with the results of every method |
| **Flow column prep** · **Residence times** | Packing a column, reactor volume, flow rates |
| **Blank calc table** | Your own columns |

Choose which snippets you want in **Manage files…** (each has a **Use** toggle). Icons for the Alt+S menu are a setting.

## Analysis methods
One note per method in your **Methods folder**, with a `Columns` property, gives you a sample table of your own (mass spec, XRD, TGA, …), a **Results** property chooses what goes into Combined results, and one note per machine fills in defaults. Each method appears in the Alt+S menu by itself. NMR, GPC and DLS are built in. Details and an example: [tutorial section 6.1](docs/tutorial.md#61-analysis-methods-and-machines).

## Experiment header
A ```` ```lab-header ```` block shows, for the note it is in:
- a **hazard table** with every chemical in **Chemicals**, worst first, each H-code coloured by severity, as one row per chemical with chips (default) or as the two-column table;
- an **Open data folder** button that creates `<data folder root>/<note name>` and opens it (desktop only; set the root in Settings → Lab Kit → Lab header).

It only redraws when this note's Chemicals or a linked chemical note changes. The command **Insert lab header block** adds one; the Lab Book template already has it. Every option is in Settings → Lab Kit → Hazards and can be overridden for one note with lines inside the block (`layout: table`, `collapsed: false`, …): see [tutorial section 4](docs/tutorial.md#4-hazards).

## Built-in kit
The templates (Lab Book, Alt+S menu, one file per snippet), the Templater scripts and a CSS snippet are bundled inside the plugin. Updating the plugin brings the new kit, but your files only change when you say so:
- **Review update…** previews every file (new, updated, changed by you, missing) and writes nothing until you press **Apply**.
- **Update all safe files** adds new files and updates the ones you never edited.
- **Manage files…** lists every kit file with a status and buttons to update, restore the original, detach, or open it; files that need action come first.
- A file you edited is never overwritten. If your changes and the kit's touch different lines you can **merge**; if they touch the same lines you **resolve** them change by change.
- Every replaced file is copied to a backup folder first.

## Settings
Settings → Lab Kit is searchable and grouped:

| Group | What is in it |
|---|---|
| **Built-in kit** | Update available, Kit version (Manage files, Review update, Update all safe files), What's new, update notice, Backup folder |
| **Kit folders and setup** | Templater **Set up**, Templates folder, Scripts folder, Snippets folder, console log |
| **Lab notebook** | Initials, Chemical folder, Molecular weight property, Methods folder |
| **Snippet menu** | A Lucide icon for each snippet |
| **Lab header** | Data folder root (one for Windows, one for macOS / Linux) |
| **Hazards** | Layout, property names, collapsed / legend / sorting options |

Folder settings left empty are detected; the data folder roots are empty until you set them.

## Commands
Open the command palette and type *Lab Kit*. There are no default hotkeys.

| Command | Does |
|---|---|
| Insert empty calc block | Adds a small example calc table at the cursor |
| Insert lab header block | Adds the hazard / data-folder header at the cursor |
| Review kit files | Opens the update preview |
| Manage kit files | Opens the list of kit files |
| Show what's new | Opens the What's new popup for this version |

## Privacy & permissions
- **No network use.** Lab Kit never connects to the internet, has no account, no ads, no telemetry and no paid features. The "full changelog" button only opens a link in your browser when you press it.
- **Files in your vault**: the built-in kit reads and writes only the folders you set in Settings → Lab Kit, and copies a replaced file to a backup folder first. To find where your templates and scripts are, it lists the files in your vault.
- **Other plugins' settings**: only on the first kit install, and only if you leave the switches on: it turns on the kit's CSS snippet, and sets Templater's user scripts folder when Templater has none (a folder you set is never changed; the lab scripts go into a `lab-kit` folder inside it). The **Set up** button also fills Templater's template folder when it is empty and adds the Alt+S template to its hotkeys, only when you press it.
- **Clipboard**: the **Copy** button on a table writes to the clipboard, only when you click it.
- **Files outside your vault** (optional, desktop only): the **data-folder button** in the experiment header creates `<data folder root>/<note name>` on your computer and opens it in your file manager, only when you press it. The root is empty until you set it in Settings → Lab Kit → Lab header. Nothing else reads or writes outside your vault.

## Mobile
Calc tables, the hazard header and the built-in kit work on mobile. The data-folder button is desktop only: on mobile the header shows "Data folder: desktop only". Snippet forms need Templater.

## Troubleshooting
| Problem | Fix |
|---|---|
| Alt+S does nothing, or the forms ask one question at a time | Install Templater, press **Set up** (Settings → Lab Kit → Kit folders and setup), and set the Alt+S hotkey |
| `#NOTE?` in an MW cell | No chemical note with that name: check the spelling, or type the MW over the formula |
| `#PROP?` in an MW cell | The note has no molecular weight property (set **Molecular weight property**) |
| `#REF!` | The formula points at a deleted row, or a table name that doesn't exist or is used twice |
| A calc table looks like plain code | Lab Kit isn't enabled |
| Hazard table empty | Chemicals property empty, or the chemical notes have no `H_Phrase` list |

More in the [tutorial](docs/tutorial.md#8-troubleshooting).

## Support and contributing
Found a bug or want a feature? [Open an issue](https://github.com/johnsonolly4/lab-kit/issues) and say what you did, what you expected and what happened (a screenshot of the table helps). Pull requests are welcome; run `npm test` and `npm run lint` first.

## Development
```bash
npm install
npm run dev          # builds into test-vault/.obsidian/plugins/lab-kit/ and watches
npm test             # vitest
npm run lint
npm run build
```
Open `test-vault/` as a vault in Obsidian to try changes. Never develop in your real vault. The kit files live in `kit/` and are embedded in `main.js` at build.

## Licence
MIT, see [LICENSE](LICENSE).
