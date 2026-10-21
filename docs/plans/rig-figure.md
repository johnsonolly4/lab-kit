# Plan: rig figure for posters and publications

_Agreed and approved by the user: 2026-10-13. Written by `/phase-plan` (Sonnet, with the user's survey answers). Each phase = one session; the user looks at the result after each of 2, 4, 5 and 6 before the next starts. Replaces the open item "Reactor schematics for publications" in BACKLOG._

## Goal
From a rig note's parts tables (`Feeds`, `Part`, ...) Lab Kit draws a clean flow-chemistry schematic as a vector figure the user can nudge by hand and export as SVG and a very large PNG, sharp at full width on an A0 or larger poster, in the style of the figures in the user's field (line art, symbols per module, coloured control lines).

## Decision taken
User, 2026-10-13 (chat, ten example figures looked at, survey):
- **Private modules.** The group's own module symbols and pictures are never committed, released or documented with real examples. The plugin ships only generic symbols drawn from scratch (pump, tee, valve, coil reactor, box, flask, laptop, outlet / waste arrow) plus batch glassware (round-bottom flask, hot plate / stirrer, balloon). A *module pack* is a folder of SVG / PNG files plus a list file in the vault; users add their own symbol by dropping in an SVG and a list line; group members get the pack privately. No pack = generic symbols.
- **Pack install without a dependency:** the pack is a folder; members copy or sync it into the vault; a command "Check module pack" reads the list file, says what is missing or unreadable and registers it. No zip library (none in the project today).
- **Vector first.** SVG is the master; a PNG about 10,000 px across (A0 at 300 dpi) is made from it. No PDF now (it would need Electron's print and is desktop-only); the SVG opens in PowerPoint, Illustrator and Inkscape. The figure is saved into a figures folder in the vault, not just copied.
- **Layout starts automatic from the `Feeds` tables, then is tweaked by hand** in a drag window; the positions are saved in the note as a `rig-layout` block (kept when the note is closed, unlike the plan map).
- **Colour:** process lines (monomer and tubing) stay black. Control and feedback lines from the computer are coloured and dashed: one colour for control (computer to part), one for data back (part to computer); both settable. Parts tables get two optional columns for this (names below, for the user to check at Phase 3).
- Rejected: Mermaid for the figure (cannot take coordinates: the figure is drawn as SVG like `src/planning/plan-slide.ts`); a zip library; saving positions in a separate file; colour per stream.

## What the user's example figures show (ten published flow-chemistry figures, pasted in chat 2026-10-13; kept only in the owner's private `my_work/private/rig-examples/`, never committed; no names)
Black line art on white, bold sans-serif labels with subscripts and units. Symbols: pump (circle with a triangle), tee / mixer (a small filled dot where lines meet), valve (bowtie), multiport valve (circle with arrows or ports), coil reactor (ribbed cylinder), CSTR (rounded box with a fan), tubular and column reactors (plain boxes), back-pressure regulator (box or valve labelled BPR), flask / vial, laptop or monitor for the controller, photo-like pictures for instruments (NMR magnet, light-scattering cell, GPC stack, small spectrum thumbnails). Dashed or dotted control and feedback lines in red, green and blue, labelled ("Flow rate", "Temperature", "Data output"); red-outlined frames that group analysis modules, panel letters (a) (b) (c); a reaction scheme with structures beside the rig; "Waste" arrows, a "Product collection" fan of arrows; a stage repeated n times in brackets. Use these to choose what to draw, never to copy a figure.

## Phase 2 result (2026-10-13)
`src/rig/symbols.ts` + `src/rig/figure-svg.ts`, 10 tests (tests 1025). Three fictional rigs (two pumps into a tee, coil, probe, BPR, vial; a branch with a bypass; a batch flask with hot plate and stir plate) were turned into PNGs and looked at: they read as line-art flow schemes. Symbols drawn from plain geometry, none traced from the examples: pump = circle with a triangle; tee = filled dot; valve = bowtie (two triangles); BPR = bowtie in a box; coil reactor = rounded box with slanted ribs; column / unknown = rounded box; round-bottom flask = circle with a neck; hot plate / stirrer = flat block with two short ticks; analysis = box with a small trace; waste = arrow; vial = open tube; tubing = thin bar. Attached parts hang straight under their host on a dashed line, labels to the right. Left: a long edge that skips a layer can cross a part, and a branch has no join dot (BACKLOG).

## Phase 3 result (2026-10-13)
`parts.ts` reads optional `Control` / `Data` columns; `figure.ts` adds `computer` and `controls` and moves the flow down by a band, never reshaping it (user rule: the flow stays as straight as possible, the control lines route around it); `figure-svg.ts` draws dashed blue (control) / red (data) lines with arrowheads and labels, from the computer's lower edge along lanes (longest run highest, so lines nest); a part with another part above it in its column is entered from the left of the column. The Rig template has the optional columns. Looked at as a PNG; the user has not yet. Limits: a host's label sits above it, so a line into it crosses the label; a far-off part can have its line cross another part.

## Out of scope
- Chemical structures and reaction schemes (they come from a structure editor); the user places them in the poster tool.
- A PDF export; the summary table (stays as it is). Changes to the rig block (the figure instead of Mermaid), the lab-note snapshot and the rig history moved to `docs/plans/rig-block-no-mermaid.md` (owner, 2026-10-20).
- Shipping, copying or redrawing the user's group's symbols or the example figures; the example images stay out of the repo.
- Pictures of instruments (NMR magnet, light-scattering cell): possible only through a pack.

## Names to check with the user (Phase 3)
Optional columns on a parts row: `Control` (what the computer sets, becomes the label on the control line, e.g. "Flow rate", "Temperature") and `Data` (what the part sends back, e.g. "Conversion"). The computer is drawn when any row has either; its label is the rig note's `Control:` property.

## Phases

### Phase 1: figure model and automatic layout (pure, tests only)
- Files: new `src/rig/figure.ts` (model: nodes from `readRig`'s parts and links, layers by the `Feeds` graph, positions in figure units, order inside a layer, branches and merges, repeated stage `n` ignored), `tests/rig-figure.test.ts` with fictional rigs (a two-pump tee into a coil into analysis into a collector; a branch with a bypass), `src/rig/parts.ts` only if a missing field must be exposed.
- Done when: tests cover layering, a merge (tee), a branch, a cycle that does not hang, an unknown part; positions are deterministic; lint and build clean. No UI.
- New dependencies: none

### Phase 2: generic symbols and the SVG writer
- Depends on: Phase 1
- Files: new `src/rig/symbols.ts` (each symbol = an SVG fragment drawn from scratch + its size + its in / out connection points; the interface a pack will fill in Phase 6), new `src/rig/figure-svg.ts` (`figureSvg(model, opts)` → one SVG string with lines meeting symbols at the connection points, bold sans labels, a small tee dot where streams merge, a Waste / Product arrow, units in subscript), tests.
- Done when: tests for the SVG (every part gets a symbol or the box fallback, lines end on connection points, the text is escaped); the SVG of a fictional example is rendered to a PNG and LOOKED AT (as in `plan-slide` Phase 1) and the user says it reads as a figure; symbols are original drawings (a note in the plan lists the standard shapes copied from none of the examples).
- New dependencies: none

### Phase 3: control and feedback lines and the computer
- Depends on: Phase 2
- Files: `src/rig/parts.ts` (read the optional `Control` / `Data` columns), `src/rig/figure.ts`, `figure-svg.ts` (laptop symbol, dashed coloured lines routed along the top, labelled), the Rig template in `kits/lab/Templates/Rig template.md` (the two optional columns, commented) and `npm run kit:manifest`, tests.
- Done when: tests for the two columns and the line routing; the example picture shows black process lines and coloured dashed control lines; the user has agreed the column names.

### Feedback fixes (2026-10-19, from the user's 13 marks on the feedback page; before Phase 4; BACKLOG "Rig figure feedback page, 2026-10-19")
Decided: marks 7-8 need no code (the figure draws the Control / Data lines the table gives). Mark 11 (the user's own tee image) and the pre-mixer box wait for the module pack (Phase 6); the tee dot stays (user, 2026-10-19).
- **FF1 Symbols** (marks 3, 6, 10, 4). Files: `src/rig/symbols.ts`, `tests/rig-figure-svg.test.ts`. A less acute pump triangle; a syringe symbol picked by Pump detail `syringe`; coil stripes centred. Check: tests for each symbol's size and connection points, PASS.
- **FF2 Straight lines** (marks 1, 5, 12 and screenshots b, c). Files: `symbols.ts` (flask output level with its centre), `figure-svg.ts` (`edgePoints`: vial entered straight from above, the dashed return joined to the valve, the recycle return clear of the feed line), tests. Check: one test per rig that the named line has no extra bend, PASS.
- **FF3 Attached parts** (marks 2, 13). Files: `figure-svg.ts` / `figure.ts` (hot plate directly under its flask or column), `symbols.ts` (a Heater with detail `oven` / `jacket` drawn around the column), tests. Check: tests for both placements, PASS.
- **FF4 Control lines** (mark 9 and screenshot a). Files: `figure-svg.ts` (`controlSvg`: one shared run under the computer where lines go the same way; the computer's label gets a fill), `figure.ts` (band height), tests. Check: tests for the shared run and the label fill, PASS.
- Then the four made-up rigs are rendered again as a feedback page for the user (their own browser; the built-in browser cannot open `file://`).

### Phase 4: the figure window and export to files
- Depends on: Phase 2 (Phase 3 optional before it)
- Spike first: the largest canvas that works on desktop Obsidian (Electron) for a 10,000 px PNG, and what happens past it (tile the drawing or lower the pixel count and say so). Not verified yet; the earlier survey found no size check in `plan-slide-ui.ts`.
- Files: new `src/rig/figure-ui.ts` (window: preview, width in mm and DPI, Save SVG, Save PNG), a button on the rig block in `src/rig/render.ts`, a "Figures folder" setting (`src/kit/ui.ts`, `src/kit/paths.ts`, folder contract in README), saving through the vault API (`createBinary` / `create`; no code for it exists yet), tests for the file names and the pixel size maths.
- Done when: tests; the user saves an SVG and a PNG of a fictional rig and opens the SVG in a drawing tool; the PNG pixel size is what the window says; desktop and mobile behaviour stated (desktop only if the canvas is).

#### Phase 4 result (spike, 2026-10-19, checked in a throwaway Obsidian 1.14.4 on macOS with `scripts/obsidian-check.mjs`; the figure was a made-up 1080 x 458 rig, drawn from its SVG onto a canvas, read back with `toBlob`)
| Canvas (w x h px) | Pixels | Result |
|---|---|---|
| 10,000 x 4,241 (figure's own height) | 42 M | PNG made, 1.1 MB, 2.0 s, size read back 10000x4241 |
| 14,000 x 5,937 | 83 M | PNG made, 2.0 MB, ink present, 1.5 s |
| 16,384 x 6,948 / 16,385 x 6,948 / 20,000 x 8,481 | 114-170 M | PNG made, size read back exact (no side limit at 16,384 here) |
| 10,000 x 14,000 (A0 portrait at 300 dpi is 9,933 x 14,043) | 140 M | PNG made, 3.0 MB, 2.2 s |
| 14,000 x 14,000 | 196 M | PNG made, 4.1 MB, 2.3 s |
| 16,384 x 16,384 | 268 M | PNG made, 5.6 MB, 2.6 s |
| 40,000 x 6,000 | 240 M | PNG made, 5.3 MB, 0.9 s |
| 32,767 x 10,000, 20,000 x 20,000 | 328-400 M | **fails**: no error is thrown, the canvas stays blank (`getImageData` all transparent) and `toBlob` gives `null` |

- The limit measured here is the total pixel count (between 268 M and 328 M), not 16,384 px a side. Other machines (Windows, Linux, a GPU with less memory) and Obsidian versions were not measured, and a phone has far less, so the cap is set well below the measured edge.
- **Cap used by the window: 16,000 px a side and 150 million pixels in all.** A0 at 300 dpi (139.5 M) fits. Above the cap the window lowers the pixel count to fit (same shape) and says so, with the size it got, in the notice. A `null` blob or a thrown error is also a notice ("could not make the PNG"), never a silent empty file.
- Not measured: the real Windows and Linux builds, memory use during the draw, mobile (the PNG is desktop only).

#### Phase 4 built (2026-10-19; tests plus a throwaway Obsidian; not seen by the user)
- SVG: fills as attributes, no `<style>`, one `<g>` per part; the computer's label is the note's `Control:` property (default "Control"). Figures folder setting (empty = the rig note's folder). Window `src/rig/figure-ui.ts`, button **Figure…** on the rig block, numbers and names in `src/rig/figure-export.ts`.
- Checked with obsidian-check (a made-up rig): the button opened the window; width 841 mm at 300 dpi showed 9,933 x 4,212 px; Save SVG, Save PNG and a second Save SVG wrote `figure.svg`, `figure.png`, `figure 2.svg` next to the note; the PNG's header read 9933x4212; the SVG had no `<style>` and the label "Lab PC". Under-the-button placement was checked with a faked button position (a hidden test window gives the button none): no dim, left 200 px as given. Not seen: a real window on screen, the PNG opened in another tool, Windows / Linux, a phone.

### Phase 5: hand layout
- **BUILT 2026-10-21 by Phase 6 of `docs/plans/rig-block-no-mermaid.md`** (drag in the Figure… window (N5 a), 20-unit snap, Reset to automatic, Save layout writes the ```` ```rig-layout ```` block; `src/rig/layout.ts`, `tests/rig-layout.test.ts`). Not built from this plan's Files line: bending or moving a line by hand (only parts move). Not seen by the owner; real touch and mouse not checked (BACKLOG "Rig Phase 6 leftovers").
- **Approved (owner, 2026-10-20): drag inside Obsidian, layout stored as plain text** in the rig note (answers BACKLOG "Rig figure R5"). Built as Phase 6 of `docs/plans/rig-block-no-mermaid.md`, which sets the ```` ```rig-layout ```` format (`format: 1` first line, then `ID: x, y` per hand-placed part, figure units on the snap grid; unlisted parts placed automatically; lines naming a part that is gone kept and listed as a problem) and the saved-old-note test. Where the drag happens (the Figure… window or the block) is that plan's N5. The layout text is also stored inside each rig snapshot SVG, so a lab note's snapshot keeps the layout it was drawn with.
- Depends on: Phase 4
- Files: `src/rig/figure-ui.ts` (drag a symbol, bend or move a line, snap to a grid, Reset to automatic), a `rig-layout` block read and written in the rig note (`src/rig/layout.ts`: parse, write, merge with the automatic layout when parts are added or removed), tests for the block's round trip and for a part removed or added.
- Done when: tests; the user moves symbols, saves, closes the note, reopens it and the figure is as left; a new part appears automatically placed without moving the others.

### Phase 6: module packs
- Depends on: Phases 2 and 5
- Files: new `src/rig/packs.ts` (list file format: `kind`, `name`, `file`, connection points, optional size; loader from a vault folder; fallback to generic symbols; safe handling of an SVG file: no scripts, size limit), a "Module pack folder" setting, a command "Check module pack" (what is missing / unreadable / unused), tests with a fictional pack, docs.
- Note (2026-10-20): a pack symbol is drawn into each rig snapshot SVG (`docs/plans/rig-block-no-mermaid.md`), so old lab notes keep their picture if the pack is later removed or changed; snapshots live in the user's vault only.
- Done when: tests; a fictional pack with two symbols replaces the generic ones in the figure; a broken pack falls back and says why; a test or check keeps any pack-like asset out of the repo (no `.svg` or `.png` under `src/` or `kits/` except the generic symbols' text in code).

### Phase 7: docs and tutorial
- Depends on: Phases 1-6
- Files: `docs/changelog.md`, `README.md`, `docs/tutorial.md`, the Rig how-to note if there is one, `docs/architecture.md`, `docs/obsidian-test-checklist.md`, `BACKLOG.md` (tick the item; add what is left), `docs/decisions.md`.
- Done when: docs match the code; each phase has a checklist row.

## Order check
1 → 2 → 3 are pure and testable without Obsidian; 4 needs 2; 5 needs 4 (and the rig block of `rig-block-no-mermaid.md` Phase 2, where it is built as Phase 6); 6 needs the symbol interface from 2 and the window from 5 (to show packs); 7 last. Phase 3 can swap with 4 if the user wants a first picture sooner.

## Verification
The look is the user's to judge, against their own field's figures (ten examples were shown in chat; kept only in `my_work/private/rig-examples/`, never committed). Each of 2, 4, 5, 6 ends with a picture the user opens. A poster check at the end: the SVG placed at A0 width in a drawing tool, no pixelation, text still crisp.
