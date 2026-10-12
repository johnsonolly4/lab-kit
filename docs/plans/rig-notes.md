# Plan: Rig notes

_Agreed: 2026-10-12. Written by `/phase-plan`. Each phase = one session._

## Goal
A flow rig is written once as a note with small parts tables; Lab Kit draws its diagram from them, and an Alt+S snippet links a lab note to the rig, sets a `Rig` property, puts the diagram at the cursor and copies the tables to the bottom of the note under `Flow platform setup`, as that experiment's record.

## Decision taken
The parts tables are the one source: in the rig note the diagram redraws from their `Feeds` columns whenever the note changes, nobody writes Mermaid (user). The lab note gets a fixed copy (Mermaid block at the cursor, tables at the bottom), not a live embed, so old experiments do not change with the rig note (user). The snippet is a token template; the engine learns to list a folder's notes, to set a property and to append a part under a heading (Claude's choice, the user can overrule).

Rejected: hand-written Mermaid in the rig note (two sources); a live embed of the rig's diagram; a plugin command instead of a snippet (not in the Alt+S list, text not editable); the Methods folder for rig notes; one big parts table (mostly empty cells); the copied tables in a folded callout (replaced by the bottom section).

## The rig note (agreed content)

Properties: `Tubing` (rig-wide material and inner diameter), `Control software` (name and version), `Analysis` (list, typed by hand, for filtering).

Parts tables, one row per part. `Part` is one of Pump, Mixer, Reactor, Heater, Regulator, Valve, Analysis, Outlet, Tubing.

**Several small tables, not one big one** (user, 2026-10-12): every table in the note with an `ID` and a `Feeds` column is a parts table; each may have its own other columns; the diagram is drawn from all of them together. A table without a `Part` column takes the kind from the heading above it (Pumps = Pump); under any other heading (Reactor line) it needs the column. The kit's Rig template ships three: Pumps (ID, Model, Carries, Tubing in, Tubing out, Pressure limit, Feeds), Reactor line (ID, Part, Type, Material, Size, Setting, Feeds), Analysis (ID, Instrument, Method, Feeds). The single table below shows the same content in one piece.

| ID | Part | Type / model | Carries | Tubing in | Tubing out | Material | Size | Setting | Feeds |
|---|---|---|---|---|---|---|---|---|---|
| P1 | Pump | make, model | monomer | PFA 1.6 mm | PFA 0.75 mm | | | pressure limit | M1 |
| M1 | Mixer | T-piece | | | | PEEK | | | R1 |
| R1 | Reactor | coil | | | | PFA | 2.0 mL | | BPR |
| H1 | Heater | heating cartridge | | | | | | | R1 |
| BPR | Regulator | cartridge | | | | | | 5 bar | NMR |
| NMR | Analysis | benchtop NMR | | | | | | method name | |

What each column holds (user, 2026-10-12):
- **Pump**: model; `Carries` (pre-set in the rig note or filled in the experiment); tubing material in / out and size; pressure limit in `Setting` (only some pumps, set in the experiment).
- **Regulator**: set pressure in `Setting`. **Analysis**: method in `Setting`.
- **Heater**: a part row (cartridge, hot plate, Peltier), drawn attached to the reactor it feeds. No temperature here: it varies per sample.
- **Not in the table**: pump flow rates and temperatures (they vary within an experiment; the reagent ratios at sampling times are what matters), valve positions.
- **Tubing**: the rig-wide property is the rule; a section that differs may get a `Tubing` row, drawn like any other connection (no special look).
- More than one reactor is more than one Reactor row (stages), each with its own `Size`; a second stage may be its own table.
- **Outlet** (collection or waste) is a part kind, so a sampling valve can feed both an analysis module and the outlet (user, 2026-10-12, after the mockup).
- An online analysis module is one row; its own eluent pump or dilution step is not drawn.

Confirmed by the user at the start of Phase 1 (2026-10-12, survey): the pump's tubing goes in two columns, `Tubing in` and `Tubing out` (empty = the rig-wide value), and a table without a `Part` column takes its kind from the heading above it. Still Claude's reading: `Material` is the wetted material of the part itself.

## Out of scope
- The optimisation record, Code and environment, Run log, sample codes for computed runs (their own BACKLOG items).
- A rig view or filter in `Lab book base.base` (the property makes it possible; not asked for).
- Reading a reactor's `Size` from Residence times / Flow column prep.
- Filling the `Analysis` property from the table.
- A `Rig` line in the Lab Book Template: the snippet sets the property, notes without a rig have none.
- Subgraphs per stage, dead-volume sums from tubing rows.

## Phases

### Phase 1 — Parts table to diagram (engine, no Obsidian) — DONE 2026-10-12
- Result: `readRig(text)` in `src/rig/parts.ts` gives `tables` (heading, header, raw lines: what Phase 4's `{{rig-tables}}` needs), `parts`, `links`, `problems`, `mermaid`. Claude's choices, not in the plan: every part is a plain box (`ID`, then the first filled of Type / model, Type, Model, Instrument, else the kind), flow left to right; IDs match without regard to case; a duplicate or ID-less row is left out of the drawing; tables inside a callout or a code block are not read. Tests only.
- Files: `src/rig/parts.ts` (new), `tests/rig-parts.test.ts` (new), `tests/fixtures/rigs/` (new)
- What: read every parts table in a note's text (any table with `ID` and `Feeds` columns; columns found by header name, any order, extra columns kept; kind from the `Part` column, else from the heading above the table); give parts, connections and Mermaid flowchart text. Problems are returned as messages, never thrown: unknown `Feeds` ID, duplicate ID (also across tables), missing ID, a kind that cannot be worked out, no table. `Feeds` takes several IDs separated by commas (branches). A Heater is drawn attached to its reactor (dashed line), not in the flow.
- Done when: fixtures pass for single tubular reactor; two pumps into a mixer; telescoped tubular + two-tank cascade; in-line analysis after the regulator; a sampling valve feeding an analysis module and an Outlet; the same rig as one table and as three tables giving the same diagram; each problem message. IDs and text with Mermaid special characters (quotes, brackets, `|`) come out escaped.
- New dependencies: none

### Phase 2 — The `rig` block draws the diagram in the rig note
- Depends on: Phase 1
- Files: `src/rig/render.ts` (new), `src/main.ts` (register), `styles.css` only if needed, `tests/rig-render.test.ts` (new), `docs/architecture.md`, `docs/obsidian-test-checklist.md`
- What: a ```` ```rig ```` code block reads the parts tables of its own note and renders the Phase 1 Mermaid text through Obsidian's Markdown renderer (so it works on mobile, no Node); problems show as a list under it; it redraws when the note changes (same way as the `calc` block, `src/calc/render.ts:69`).
- Done when: tests with the Obsidian stub show the block passes the generated text to the renderer and lists problems; a row in checklist 6i; BACKLOG "Not yet tested" entry (needs a look in Obsidian: reading view, live preview, phone).

### Phase 3 — Rigs folder, Rig template, New rig, Check setup
- Depends on: Phase 2
- Files: `src/kit/paths.ts` (`rigsFolder`, default empty), `src/kit/ui.ts` (setting row, command `new-rig`), `src/kit/setup-check.ts` (optional row, like the Methods folder at :127), `kits/lab/Templates/Rig template.md` (new: properties, a `rig` block, the three example tables Pumps / Reactor line / Analysis), `scripts/kit-manifest.mjs` (DESC, `needs: rigsFolder`), `kits/lab/kit-manifest.json` (generated), tests beside `tests/kit-install.test.ts`, `README.md` (Settings, Folder contract, commands), `docs/tutorial.md`, `docs/changelog.md`, `src/kit/hotkey-check.ts` (no-key list)
- What: precedent is New chemical (`src/kit/ui.ts:342`, `:430-449`; `src/kit/paths.ts:264-271`). New rig asks a name, makes the note in the Rigs folder from the template; stops with a notice when the folder is not set.
- Done when: tests for the target path, the unset-folder notice, the template being off while the folder is empty, the Check setup row; `npm run kit:manifest` and `npm run starter` clean; checklist row.

### Phase 4 — Token templates: pick a note, read its rig, set a property, append under a heading
- Depends on: Phase 1
- Files: `src/kit/snippet-template.ts` (header checks, :95-100), `src/kit/snippet-run.ts` (suggest list :42-59, note lookup :75-80, result :102), `src/kit/snippet-env.ts`, `tests/` beside the existing snippet-template tests, `docs/snippet-syntax.md`
- What: (a) `suggest: notes` with `folder: <setting key>` lists the notes of a settings folder; (b) a header list `set:` writes properties on the current note after the insert (`processFrontMatter`), a value may be a link to the picked note; nothing is written when the form is cancelled; (c) tokens `{{rig-tables:key}}` (the picked note's parts tables as text, each with its heading), `{{rig-diagram:key}}` (a Mermaid block from Phase 1) and `{{note-prop:key.Name}}` (a text property). (d) a second output: a marked part of the template is not inserted at the cursor but appended at the end of the note under a named heading, which is added when missing (same heading already there: appended below its content). Unknown folder key or a note without a parts table gives the usual message naming the snippet and inserts nothing.
- Done when: engine tests for each of (a) to (d) and their errors; the 28 parity scenarios still pass unchanged; the spec documents the four additions.

### Phase 5 — The Rig snippet and the docs
- Depends on: Phases 3 and 4
- Files: `kits/lab/Templates/Snippets/14 Rig.md` (new), `scripts/kit-manifest.mjs` (DESC), `kits/lab/kit-manifest.json` (generated), a snippet test, `docs/tutorial.md` (snippet table + rigs section), `README.md`, `docs/changelog.md`, `docs/obsidian-test-checklist.md`, `BACKLOG.md` (tick the rig items in "In-silico design: decide before release" and "NEXT TASK", add "Not yet tested")
- What: Alt+S → Rig: pick a rig; the note gets `Rig: [[name]]` as a property; at the cursor a link to the rig and the diagram as a fixed Mermaid block (the Lab Book Template's Apparatus section is the natural place); and the tubing line, the control software line and the parts tables as they are that day at the bottom of the note under the heading `Flow platform setup` (user, 2026-10-12: name and place), which the snippet adds when the note has none. The tables are plain, not in a folded callout (Claude's choice after the user moved them to the bottom: plain tables keep Obsidian's table editor for the per-run cells; the user can overrule). The Lab Book Template itself does not get the heading.
- Done when: a test runs the snippet on a fixture rig note and compares the text at the cursor, the `Flow platform setup` section (added when missing, appended to when there) and the property; the snippet is off (not listed) while the Rigs folder is empty; checklist row.

## Order
1 → 2 → 3 is the rig note itself and can ship without the snippet. 4 needs only 1, so it may swap with 2 or 3. 5 needs 3 (the folder setting and a rig note to pick) and 4 (the engine).

## Verification
- Phase 1 fixtures are written from the rig families in BACKLOG "Rig notes checked against published flow rigs" (layouts from titles and abstracts only; part details are made up and say so).
- The generated Mermaid is checked as text in tests; that Obsidian draws it is a manual check (checklist 6i) on desktop and a phone.
- The user fills one real rig in `test-vault/` and says what the tables are missing before Phase 5 is called done.
