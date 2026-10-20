# Plan: rig block without Mermaid, rig snapshots and rig history

**Status (2026-10-20, revised after owner board 2):** Q1, Q2, Q3 and Q5 ANSWERED (below). Phase 0 DONE. Q4 EVALUATED with a recommendation: **PLAN WAITING FOR OWNER** only for the OK on Q4 and the new questions N2-N5 (BACKLOG item "Rig block without Mermaid"). Phase 2 (the rig block draws the figure) needs no further answer and can start. Each phase = one Sonnet session. Looks are the owner's: every look not answered below goes on the Phase 1 page, never decided by the session.

## Goal
1. The ```` ```rig ```` block in a rig note draws its diagram with Lab Kit's own figure engine (the one behind **Figure…**) instead of Mermaid, so Obsidian 1.14.4 no longer asks "Display Mermaid diagrams in this vault?" and the note shows the same drawing the user saves for a poster.
2. **Data integrity (owner, 2026-10-20, added to Q1):** the real rig changes over time, so a lab note keeps a **picture of the rig as it was** when the entry was made, and the rig note keeps a **history**. Everything is stored as flat files a person can open without Lab Kit: plain text (Markdown tables, code blocks of plain lines) and image files. If the plugin stops working or is no longer supported, the record can still be read.

## Owner's answers (owner board 2, 2026-10-20)
- **Q1 (a):** the rig note shows the figure itself (same picture as Figure… and the saved SVG). Added requirement: the rig may evolve, so a lab note must include a snapshot (an image) of the rig as it was; the rig file should have a history; flat formats / plain text / image files wherever possible so the data survives the plugin.
- **Q2 (a):** a white card with black line art in every theme (as the Figure… preview and the slide picture). The SVG already draws its own white background (`src/rig/figure-svg.ts:190`), so the card stays white even where no Lab Kit CSS applies.
- **Q3 (a):** shrink to the page width down to a smallest size (labels not under about 9 px), then slide sideways. Also answers BACKLOG "Phone pass questions" (c) and Phone pass item 6.
- **Q4:** "see my answer to Q11 and evaluate" (Q11 on the board = Q1 here). Evaluated below; recommendation waits for the owner's OK (N1).
- **Q5 (a):** `feat/rig-figure` merged into `overnight/2026-10-19` (commit 57bee8b). Phase 0 DONE.
- **Also decided (owner, 2026-10-20):** moving a part by hand is done by **dragging inside Obsidian** (rig-figure Phase 5, hand layout), and the positions are stored **as plain text in the rig note**. This also answers BACKLOG "Rig figure R5".

## What we know (read 2026-10-20, on the merged branch)
- Rig block today: `src/rig/render.ts:59` hands `"```mermaid\n" + rig.mermaid + "\n```"` to `MarkdownRenderer.render`; text from `toMermaid` (`src/rig/parts.ts`): one box per part, left to right. Redraw on edit after 250 ms, skipped when `[mermaid, problems]` is unchanged (`render.ts:55`). The **Figure…** button opens `src/rig/figure-ui.ts`.
- `makeFigure(text)` (`src/rig/figure-ui.ts:18-24`): `readRig` → `buildFigure` → `figureSvg`, returns `{ svg, width, height, missing }`; pure apart from living in the UI file. The SVG: `viewBox` + `width` / `height` in figure units, `font-family="Helvetica, Arial, sans-serif"` (`figure-svg.ts:18`), a white `<rect>` behind everything, fills as attributes, no `<style>`, labels as `<text>` (so the part IDs are searchable text inside the file).
- Saving: `figuresTarget` (`src/kit/paths.ts:323`: the Figures folder setting, else the rig note's folder) + `figureFileName` (`src/rig/figure-export.ts:50`: `<note> figure.svg`, then ` 2`, ` 3`) + `vault.create` (SVG, every device) / `createBinary` (PNG, **desktop only**: the window shows Save PNG only when `Platform.isDesktop`, `figure-ui.ts:82`).
- PNG sizes measured in the rig-figure Phase 4 spike (reported in `docs/plans/rig-figure.md`, Phase 4 result): a 10,000 × 4,241 px PNG of a made-up rig was 1.1 MB; 16,384 × 16,384 was 5.6 MB. SVG file size of a fixture rig: not measured (Phase 3 measures it).
- The Rig snippet (`kits/lab/Templates/Snippets/14 Rig.md`) writes `[[rig]]`, `{{rig-diagram:rig}}` (a **fixed** Mermaid block at the cursor: `src/kit/snippet-template.ts:276`, `src/kit/snippet-env.ts:69-71`), `{{rig-summary:rig}}`, and under the `Flow platform setup` heading (from the rig note's `Setup heading`) the `Tubing` and `Control` lines and `{{rig-tables:rig}}` (the parts tables as plain Markdown). Decision 2026-10-12: the lab note keeps a copy that does not follow later rig edits.
- Live-block rule (`docs/decisions.md` 2026-10-20, GENERAL RULE; wording in `docs/plans/solution-live-block.md` "Block format version"): each block's text carries a format version (no line = version 1); the plugin always reads older versions; a format change ships with a reader for the old version and a test on a saved old note (fixture never regenerated); a block with a newer version than the plugin knows is shown as "made with a newer Lab Kit: update the plugin" and left untouched.
- Plugin rules: no `innerHTML`; SVG shown as an `<img>` (blob or data URL) as in `figure-ui.ts:71` and `src/planning/plan-slide-ui.ts`.

## One engine (unchanged)
The rig block shows `makeFigure`'s SVG as an `<img>`: one SVG string is the only output, so the note, the saved figure and the snapshots can never drift apart; scripts in an image never run (also covers module-pack SVGs, rig-figure Phase 6); no Node, so phones too. Cost: the text in the block cannot be selected and a part cannot be clicked in the block (hand layout drags in the Figure… window, N5).

## Q4 evaluated: what the lab note keeps of the rig
Main criterion (owner): **can the record be read, as it was, without Lab Kit?** Also: it must not change when the rig note changes; works on a phone; one look with the rig note (Q1); size in the vault; the Mermaid question.

| | (i) SVG snapshot + tables | (ii) PNG snapshot | (iii) empty live ```` ```rig ```` block only | (iv) keep the Mermaid block |
|---|---|---|---|---|
| Readable without Lab Kit | Yes: Obsidian core shows `![[x.svg]]`; any web browser, Inkscape, Illustrator, PowerPoint open it; a text editor shows the labels and (proposed) the parts tables inside it | Yes, by the widest set of tools (any image viewer, Word, a phone's gallery, Windows Photos); not readable as text | **No picture at all**: the fence shows as an empty code block | Yes as text (`P1 --> M1`); drawn by Obsidian core (after the prompt), GitHub, GitLab, mermaid.live |
| Fixed as it was | Yes: a file written once, never rewritten | Yes | **No**: redrawn on every open from the copied tables by whatever Lab Kit version is installed; new symbols, a new layout or a later hand layout change the picture of an old experiment; editing the copied tables changes it too | Text yes; the picture depends on the Mermaid version that draws it (layout can shift; content stays) |
| Same look as the rig note (Q1 a) | Yes (same engine, incl. hand layout) | Yes | Yes today, not over time | **No**: boxes, a second drawing of one rig |
| Phone | Yes (`vault.create` of text) | **No** today (canvas PNG is desktop only, `figure-ui.ts:82`): a lab note made on a phone would have no picture | Yes | Yes |
| Size | Small (text; measured in Phase 3) | 1.1 MB at 10,000 px (measured, Phase 4 spike); a screen-size PNG is smaller, not measured | none | none |
| Fonts | Drawn with the viewer's Helvetica / Arial / sans-serif: spacing can differ slightly on a machine without them; labels stay readable | Baked in: identical everywhere | n/a | Viewer's font |
| Mermaid question | Gone | Gone | Gone | **Stays** in every vault |

Why (iii) violates the requirement: the block stores no drawing. The picture exists only while Lab Kit runs, and it is re-made from the current engine each time; so it is not a record of the rig as it was, and with the plugin gone the lab note shows an empty code block. (It does not follow rig-note edits, because it reads the lab note's own copied tables, but that alone is not a record.)

Mermaid weighed honestly (iv): Mermaid is plain text and an open format several tools draw, so as a record it is better than (iii). But the same facts (parts and connections) are already in the copied parts tables, which are the source and more complete (models, tubing, settings); the Mermaid picture is a different drawing from the rig note, cannot carry the hand layout or the symbols, and keeps the Mermaid prompt that this plan exists to remove. So it adds no record the tables do not hold, and loses the picture the owner asked for.

PNG weighed (ii): the widest-read format and fonts baked in, but desktop only today, MB-size at poster resolution, not searchable or diffable, and not the master (the SVG is, decision 2026-10-13). A PNG can always be made later from an SVG (browser, Inkscape, the Figure… window); the reverse loses quality.

**Recommendation (N1, for the owner's OK): (i).** The Rig snippet writes, at the cursor, `![[<rig> <date>.svg]]` (a dated SVG snapshot, a plain file in the vault) and a caption line naming the rig and the date; it keeps copying the parts tables as plain text under `Flow platform setup`, with a `Snapshot:` line there; and it sets a `Rig snapshot` property beside `Rig`. The snapshot SVG also carries, in a `<metadata>` element, the rig note's parts tables, its `Control` line and its hand-layout block as plain text, so the one file holds both the picture and the data it was drawn from. A PNG is not made by default; the Figure… window still makes one on demand (desktop).

What is stored where (recommendation; folder per N2):
- **Snapshot file:** `<rig note name> <YYYY-MM-DD>.svg` (local date the snapshot was made), ` 2`, ` 3` for a second different version on the same day; in `<rig note's folder>/<rig note name> history/` (N2 a). Written once with `vault.create`, **never rewritten** by Lab Kit.
- **Reuse:** a lab note made when the rig has not changed since the last snapshot links that snapshot instead of making a new file, so files grow with rig versions, not with lab notes. "Not changed" = the parts tables text, `Control` and the layout block equal the `<metadata>` of the latest snapshot (not the SVG text, so a plugin update that redraws symbols does not count as a rig change).
- **Link:** the embed and the property use the link text Obsidian makes (`fileManager.generateMarkdownLink`), so two rigs with the same name in different folders do not clash.
- **Who deletes:** nobody automatically. Lab Kit never deletes or overwrites a snapshot. The user may delete one by hand; the lab note then shows Obsidian's missing-file embed and still has its copied tables. A later Tidy rule may *list* snapshots no note links to (BACKLOG if wanted), never delete them.
- **Figures folder setting:** stays for poster figures saved from Figure… (`<rig> figure.svg` / `.png`). Snapshots are records, kept apart so clearing out poster drafts never removes a lab record. With N2 (b) the history folder goes under the Figures folder instead.
- **Existing lab notes:** untouched. Their Mermaid block and copied tables are their record. Never back-filled with a snapshot made now: a picture of today's rig in an old note would be a false record. They still ask the Mermaid question once per vault (Obsidian's own prompt).
- **Users' own copies of the Rig snippet** (Make my own copy): `{{rig-diagram:rig}}` keeps writing the Mermaid block as today (no behaviour change for a copy the user owns); the kit snippet switches to a new token `{{rig-snapshot:rig}}`. So `toMermaid` stays in `parts.ts`.

## Rig history (design)
- **In the rig note (plain text):** a `## Rig history` section, a Markdown table, newest row last, preceded by a format line (an HTML comment, hidden in reading view):
  ```
  ## Rig history
  <!-- lab-kit rig-history format: 1 -->
  | Date | Snapshot | Change |
  |---|---|---|
  | 2026-10-20 | [[Flow rig A 2026-10-20.svg]] | First snapshot |
  | 2026-11-03 | [[Flow rig A 2026-11-03.svg]] | Coil R1 10 mL → 5 mL |
  ```
  Lab Kit appends a row when it makes a snapshot (the Change cell from the "What changed?" box, or empty); the user can type or edit rows and add columns. Rows Lab Kit did not write are never changed. Chosen over front matter (lists of objects are awkward in Obsidian's Properties editor and hidden from reading) and over a separate history note (one more file to keep in step); the images live in the sibling history folder because a table cannot hold them.
- **Snapshot files:** the dated SVGs above, each with `<metadata>` (format 1): rig note name, date, Lab Kit version, the parts tables text, `Control`, the `rig-layout` block text. Self-contained: one file restores what the rig was.
- **When a snapshot is made (N3, rec a):** (1) when a lab note takes one (Rig snippet), reusing an equal one; (2) on demand, a **Save snapshot…** button on the rig block beside **Figure…**, with an optional "What changed?" box; (3) the rig block shows a line "changed since the last snapshot (date)" when the tables or layout differ from the latest snapshot. Not on every edit: edits come in keystrokes and half-typed tables.
- **How a lab note points to the version it used:** the `Rig snapshot` property and the embed both name the snapshot file, and the file name carries the date; the rig note's history table row with that file says what changed then. The `Rig` property still links the rig note (today's state).
- **Recovery without Lab Kit (to go in the docs, Phase 7), in order:**
  1. Open the lab note (Obsidian without Lab Kit, or any text editor): `Rig` and `Rig snapshot` properties, the embedded picture (Obsidian core), the parts tables under `Flow platform setup`.
  2. Open the snapshot `.svg` in any web browser for the picture; in a text editor, its `<metadata>` holds the parts tables and layout as they were.
  3. Open the rig note: `## Rig history` lists every snapshot with its date and change; the parts tables are the rig's current state; the `rig-layout` block lists hand positions as `ID: x, y`.
  4. For a PNG: open the SVG in Inkscape or a browser and export / print.
  5. The ```` ```rig ```` block shows as an empty code block: expected, it never held data.
- **Format versions (GENERAL RULE for live blocks):**
  - ```` ```rig ````: empty today = format 1. If options are ever added, the first line carries `format: N`.
  - ```` ```rig-layout ```` (Phase 6): first line `format: 1` from the start; one line per part placed by hand, `P1: 120, 40` (figure units, whole numbers on the snap grid); parts not listed are placed automatically.
  - History table: `<!-- lab-kit rig-history format: 1 -->`; a missing line = format 1; the reader finds columns by header name and keeps unknown columns.
  - Snapshot `<metadata>`: `format: 1`. Snapshots are never migrated (write-once); every later reader reads every older metadata format.
  - Each of the above: a newer format than the plugin knows is shown, not edited ("made with a newer Lab Kit: update the plugin"); any format change ships with an old-version reader and a test on a saved old note under `tests/fixtures/rigs/saved/` (never regenerated from the new writer).

## What changes for users (after the OK)
- Rig note: no Mermaid question; the figure (symbols, dashed control lines) on a white card, shrinking to the page then sliding; long details cut at 20 characters (Mermaid showed them whole). Figure…, the problems list stay; new: Save snapshot…, the "changed since" line, the `## Rig history` section, later the `rig-layout` block.
- Lab note (Rig snippet): the dated snapshot picture and a caption line at the cursor, the `Rig snapshot` property, the tables as today. No Mermaid.
- Nothing changes for the user's own Mermaid diagrams (`scrolling-mermaid.css`, the `scrolling_mermaid` cssclass) or for old lab notes.

## Decision taken
- Owner, 2026-10-20 (owner board): plan it; Q1 a, Q2 a, Q3 a, Q5 a (merged); data-integrity requirement (snapshot in the lab note, rig history, flat formats); hand layout by dragging inside Obsidian, stored as plain text in the rig note.
- Rejected: keeping Mermaid and only a README line about the prompt (BACKLOG "Mermaid asks once per vault", option a): two drawings of one rig. This plan replaces rig-figure's "Out of scope: any change to the existing rig block".

## Open questions (one BACKLOG item; answer with the letter; rec = recommended)
- **N1 (Q4) The lab-note copy.** (a, rec) a dated SVG snapshot embedded with `![[…svg]]`, the parts tables as plain text, a `Rig snapshot` property, the tables and layout also inside the SVG; (b) (a) plus a PNG beside it (desktop only, MB-size at poster resolution); (c) keep the Mermaid block. Old lab notes stay as they are in every case.
- **N2 Where snapshots live.** (a, rec) a `<rig> history` folder beside the rig note; (b) a `<rig> history` folder in the Figures folder; (c) Obsidian's own attachment folder (Settings → Files and links).
- **N3 When snapshots are made.** (a, rec) when a lab note takes one, plus a Save snapshot… button, with a "changed since the last snapshot" line on the rig block; (b) (a), plus one automatically the first time the rig note is opened on a day after its tables changed; (c) only when a lab note takes one.
- **N4 The snapshot in a lab note on a narrow page or phone.** (a, rec) Obsidian's own image rule (fits the width; the same in any Markdown viewer, no Lab Kit CSS); (b) as the rig block (Q3: shrink to the label floor, then slide), a Lab Kit CSS rule on embeds from history folders.
- **N5 Where you drag parts (hand layout).** (a, rec) in the Figure… window (room for Reset and a snap grid; the note's block stays a picture); (b) directly on the rig block in the note (needs live SVG elements instead of an image: a larger change).

## Out of scope
- Back-filling old lab notes or their Mermaid blocks (they stay; never a snapshot of today's rig in an old note).
- The user's own Mermaid diagrams and `scrolling-mermaid.css`.
- Module packs (rig-figure Phase 6): snapshots simply contain whatever the engine draws (a pack symbol is drawn into the snapshot SVG, so the record survives the pack being removed).
- The group's module symbols and example figures: never committed, never on the feedback page (only the made-up rigs in `tests/fixtures/rigs/`).
- Deleting snapshots (by hand only).

## Phases

### Phase 0 — merge `feat/rig-figure`
- **DONE 2026-10-20:** merged (commit 57bee8b; backup `backup/pre-rig-merge-2026-10-20`), conflicts resolved: README.md, STATUS.md, docs/architecture.md, docs/changelog.md, docs/obsidian-test-checklist.md, src/kit/paths.ts, src/main.ts (both sides kept); plus `scripts/obsidian-internals.json` (added `src/rig/figure-ui.ts` to `modal-bg`). `check.py --build` PASS, 1695 tests.

### Phase 1 — before / after page for the looks still open (no plugin code)
- Depends on: nothing; Q1-Q3 are answered and are NOT on the page again.
- Shows only proposals not yet decided: the lab note with the snapshot embed and caption line (N4 a / b at 390 px, light and dark); the `## Rig history` table and the Save snapshot… box with "What changed?"; the "changed since the last snapshot" line; the `rig-layout` block as it reads in the note (as code text, or folded to a one-line summary). Made-up rigs from `tests/fixtures/rigs/` only.
- Files (private): `my_work/mockups/rig-snapshots.html` via `my_work/agent_kit/render_check.py feedback`; commit in `my_work/`; BACKLOG item gets the path.
- Done when: the owner has answered N1-N5 and the looks on the page (ticked in BACKLOG, a line in `docs/decisions.md`).

### Phase 2 — the rig block draws the figure
- **BUILT 2026-10-20 (Phase 2** commit "Rig block draws the figure…"; `src/rig/figure-make.ts`, `render.ts`, `styles.css`, `tests/rig-render.test.ts` (12 tests, 7 fixtures), `scripts/smoke.mjs` rig step; checklist 6i row). Docs not changed yet and **to update with Phase 4** (ship 2 and 4 together): README Rig notes line and `docs/tutorial.md` Mermaid-prompt line still describe Mermaid.
- Depends on: Phase 0 (done); Q1-Q3 answered. Does not wait for N1-N5.
- Files: move `makeFigure` out of `figure-ui.ts` to a pure `src/rig/figure-make.ts` (window and block share it); `src/rig/render.ts` (no `MarkdownRenderer`; `<img class="lab-kit-rig-diagram">` from the SVG; redraw key = SVG text + problems; the "drawn as a plain box" line); `styles.css` (Q3 a: width 100 % with a minimum width so labels stay ≥ about 9 px, then `overflow-x: auto`; white card per Q2 a; corners `--lk-radius-control`); `tests/rig-render.test.ts` (rewritten); `scripts/smoke.mjs` (rig step: image, no Mermaid).
- Tests against fixtures: for each of the 7 rigs, the block's SVG equals `figureSvg(buildFigure(...))` and has one `data-part` per part; no `MarkdownRenderer.render`; problems as today; no table → message, no image; redraw once on a change, not for an equal SVG, not after unload.
- Done when: `python3 scripts/check.py` PASS; obsidian-check: a rig note shows the image, no Mermaid question, no console error, reading view and live preview, light and dark, `--mobile` 390 px (Q3); PDF export prints the image (blob URL; data URL as fallback). Not seen on a real phone: say so.

### Phase 3 — snapshot files (writer and reader)
- **BUILT 2026-10-20 (Phase 3** commit "Rig snapshots: dated write-once SVG…"; N1 a, N2 a answered by the owner). Built as planned in `src/rig/snapshot.ts` (pure: `rigRecord`, `sameRecord`, `snapshotSvg`, `readSnapshotMeta`, `snapshotName`, `snapshotNames`), `src/rig/snapshot-io.ts` (`latestSnapshot`, `snapshotState`, `takeSnapshot`; `vault.create` only, no `modify`), `tests/rig-snapshot.test.ts` (30 tests, all 7 fixture rigs), saved fixture `tests/fixtures/rigs/saved/snapshot-v1.svg` (written by hand). Differences from the text below: the metadata is plain lines (`lab-kit rig-snapshot format: 1`, `rig:`, `date:`, `lab-kit:`, `control:`, then `=== tables ===` and `=== layout ===` sections), XML-escaped (`&`, `<`, `>` only). **Measured SVG sizes (fixtures, UTF-8 bytes; figure alone / snapshot):** batch-vessel 1411 / 1833, inline-analysis-one-table 2691 / 3342, inline-analysis 2691 / 3441, sampling-valve 2523 / 3193, single-tubular 2426 / 3081, telescoped-cascade 4031 / 4940, two-pumps-mixer 2462 / 3053: the tables add 0.4 to 0.9 KB. Not done: the obsidian-check step (embed with Lab Kit switched off, file in a browser) because another throwaway Obsidian was running; not seen in Obsidian.
- Depends on: Phase 2; N1 a (or b), N2.
- Files: new `src/rig/snapshot.ts` (pure: `snapshotSvg(made, meta)` adds `<metadata>` format 1 with the escaped tables, `Control`, layout text, rig name, date, plugin version; `readSnapshotMeta(svg)` (reader for format 1; newer → "newer Lab Kit"); `rigFingerprint(noteText)` = normalised tables + `Control` + layout block; `snapshotName(rig, date, taken)`); new `src/rig/snapshot-io.ts` (`takeSnapshot(app, rigFile, folderSetting)`: latest equal snapshot → reuse, else `vault.create` a new file; never `modify`); tests `tests/rig-snapshot.test.ts`; saved fixture `tests/fixtures/rigs/saved/snapshot-v1.svg`.
- Tests: metadata round trip on all 7 rigs (tables text read back byte-equal); special characters escaped (`<`, `&`, `>`) and read back unescaped; reuse when unchanged, new file when a table cell changes, not when only the engine output differs; name ` 2` on the same day; the saved v1 snapshot reads; file size of each fixture snapshot printed and stated in the plan.
- Done when: check PASS; obsidian-check: a snapshot file opens as an embed in Obsidian with Lab Kit switched off, and the file opens in a browser.

### Phase 4 — rig history and Save snapshot…
- **BUILT 2026-10-20 (Phase 4** commits "Rig snapshots…" (history writer) and "Rig block: Save snapshot… button…"; N3 a answered). `src/rig/history.ts` (pure: `readHistory`, `appendRow`; adds only at the end of the table, or the section; a newer format or a table without Date and Snapshot columns adds nothing and says why), `src/rig/snapshot-ui.ts` (the Save snapshot… window with an optional "What changed?" box, plain, in the Figure… window's frame), `snapshot-io.ts` `saveSnapshot` (a row only for a new file; link from `generateMarkdownLink`), `render.ts` (button, the line, redraw key holds the snapshot state), `styles.css` (two small rules), `tests/rig-history.test.ts` (9), `tests/rig-snapshot-block.test.ts` (4), saved fixture `tests/fixtures/rigs/saved/history-v1.md` (by hand; extra column and a hand-typed row). Not done: `Rig template.md` empty section (needs the owner's answer); obsidian-check (another throwaway Obsidian was running): not seen in Obsidian. The looks (window, line, wording) are in BACKLOG "Questions for the owner". **Latest snapshot, table first (owner, 2026-10-20: "Surely the table is the best source of truth"):** `snapshot-io.ts` `latestSnapshot` takes the LAST row of the `## Rig history` table whose snapshot file exists (links read by `history.ts` `historyTargets` / `linkTarget`; resolved as a path, else the way Obsidian resolves a link from the rig note). No section / table / Snapshot column, no row with a link, no row whose file exists, or a newer table format: the newest-dated file in the `<rig> history` folder (`<rig> <date>[ n].svg`). The pure `history.ts` `reconcile` returns two kinds of problem, shown in the rig block's problem list (same style as the parts problems); nothing is deleted or rewritten: `History lists "<file>" but the file is missing.` and `"<file>" is in the history folder but not in the table.` (only when the table has at least one linked row; a newer-format table is not compared). The reuse rule (same tables, Control line and layout reuse the latest snapshot) and the "Changed since" line use this latest. Tests: `tests/rig-snapshot.test.ts` (table-first block), `tests/rig-history.test.ts`, `tests/rig-snapshot-block.test.ts`.
- Depends on: Phase 3; N3; the Phase 1 looks.
- Files: new `src/rig/history.ts` (pure: find `## Rig history`, read rows by header name, `appendRow` that changes only the end of the table and adds the section with its format line when missing; unknown columns kept); `src/rig/render.ts` (Save snapshot… button, "changed since the last snapshot (date)" line); a small "What changed?" window in the entry-window look; writes through `vault.process`; `kits/lab/Templates/Rig template.md` only if the owner wants the empty section in new rigs (ask; not decided here) + `npm run kit:manifest`; tests `tests/rig-history.test.ts`, saved fixture `tests/fixtures/rigs/saved/history-v1.md`.
- Tests: append keeps every other byte of the note; a hand-edited table with an extra column and a hand-typed row survives; no section → section added; the saved v1 note reads.
- Done when: check PASS; obsidian-check: Save snapshot… writes the file and the row; the line appears after a table edit and goes after a snapshot.

### Phase 5 — the lab-note snapshot (Rig snippet)
- Depends on: Phases 3-4; N1.
- Files: `src/kit/snippet-template.ts` (new token `{{rig-snapshot:rig}}`; `{{rig-diagram:rig}}` unchanged), `src/kit/snippet-env.ts` (`TemplateEnv.rigSnapshot(note)` → the link text; the vault side calls `takeSnapshot` and appends the history row), `src/kit/snippet-copy.ts` (Make my own copy's stub env returns a placeholder, writes no file), `kits/lab/Templates/Snippets/14 Rig.md` (embed + caption line at the cursor, `Rig snapshot` in `set:`, a `Snapshot:` line under `Flow platform setup`), `npm run kit:manifest`, `tests/snippet-rig.test.ts`, `tests/snippet-notes.test.ts`, `docs/snippet-syntax.md` (new token row).
- Tests against fixtures: Alt+S → Rig on a fixture rig gives a lab note with `![[…svg]]`, the property, the tables (read by `readRig` equal to the rig note's), no ```` ```mermaid ````; a second lab note with the rig unchanged links the same file; after a table change a new dated file; a saved lab note made with the old Mermaid snippet is left byte-equal; a user copy with `{{rig-diagram:rig}}` still writes Mermaid. Two Rig snippets in one lab note: two embeds, each its own rig (test).
- Done when: check PASS; obsidian-check: the lab note shows the snapshot, no Mermaid question, light and dark, 390 px (N4).

### Phase 6 — hand layout (rig-figure Phase 5; approved: drag inside Obsidian, layout stored as plain text)
- Depends on: Phase 2 (independent of 3-5; may run before them); N5.
- Files: new `src/rig/layout.ts` (pure: parse / write the ```` ```rig-layout ```` block, `format: 1` first line, `ID: x, y` per hand-placed part; merge with the automatic layout: listed parts at their place, new parts placed automatically without moving the others, lines naming a part that is gone kept as text and listed under the rig's problems, never dropped silently); `src/rig/figure.ts` (take fixed positions); `src/rig/figure-ui.ts` (N5 a: drag a symbol, snap grid, Reset to automatic, Save writes the block through `vault.process`); `src/rig/render.ts` (the `rig-layout` block's own look per Phase 1); tests `tests/rig-layout.test.ts`, saved fixture `tests/fixtures/rigs/saved/layout-v1.md`.
- Tests: round trip byte-equal; a part added / removed; a hand-typed line; a newer format left untouched; the saved v1 block reads; the snapshot `<metadata>` carries the layout text (Phase 3 slot).
- Done when: check PASS; the owner drags parts, closes and reopens the note and the figure is as left (rig-figure Phase 5 "Done when"); the block reads as plain lines with Lab Kit off.

### Phase 7 — clean-up and docs
- Depends on: Phases 2-6.
- Files: `README.md` (Rig notes line: no Mermaid; snapshots and history; **Recovering rig records without Lab Kit**, the five steps above); `docs/tutorial.md` (the one-time Mermaid prompt line for rigs goes); `docs/architecture.md` (`src/rig/` line: figure-make, snapshot, snapshot-io, history, layout); `docs/snippet-syntax.md`; `docs/maintenance.md` (smoke row); `docs/obsidian-test-checklist.md` (Rig block row for symbols; rows for snapshot, history, layout); `docs/changelog.md`; `docs/plans/rig-figure.md`; BACKLOG ticks ("Mermaid asks once per vault", Phone pass item 6, "Phone pass questions" (c), R5); `docs/decisions.md`. `toMermaid` stays (old snippet copies use it).
- Done when: check PASS; docs match the code; `grep -n mermaid src/rig/render.ts` empty.

## Order check
0 done. 2 can start now. 1 runs before 3-6 and ends with N1-N5 answered. 3 → 4 → 5 (the snippet needs the writer and the history row). 6 needs only 2 (its layout text is stored in snapshots from Phase 3 on, so if 6 comes after 3, Phase 3's metadata already has the empty layout slot). 7 last. Ship 2 and 7's README / tutorial lines in one release (the README Rig line and the tutorial's Mermaid prompt line become wrong in 2).

## Risks
- **Phone:** Q3 floor on a 366 px page; blob / data URLs in an `<img>` on Obsidian mobile and `![[x.svg]]` embeds on a phone: checked in emulation only; a real phone stays on the owner's list.
- **PDF export:** Mermaid prints today; a blob-URL `<img>` and an SVG embed: not known, checked in Phases 2 and 5.
- **Fonts:** snapshots name Helvetica / Arial / sans-serif; on a machine without them spacing can differ (labels may overrun a symbol slightly). Not measured on Windows or Linux.
- **Vault size:** one small SVG per rig version (reuse avoids one per lab note); sizes measured in Phase 3.
- **Rename / move:** renaming the rig note does not rename its history folder; Lab Kit finds the latest snapshot through the history table's links (folder listing only as the fallback), and Obsidian updates those links when files move.
- **Hand-edited history:** a broken table (missing pipe) is read as far as it parses and the rig block lists it under problems; Lab Kit then adds no row rather than guess.
- **Look:** details cut at 20 characters; labels under or beside symbols (Mermaid boxes held full text).
- **Private symbols:** feedback page and tests use only `tests/fixtures/rigs/`; snapshots in the user's vault may contain pack symbols, which is the user's vault, never the repo.

## Verification
Tests compare the block's SVG with the engine's on all 7 fixture rigs; snapshot metadata round-trips the tables byte-equal; history and layout writes leave every other byte; saved v1 fixtures (`tests/fixtures/rigs/saved/`) read for every format. A throwaway Obsidian run shows no Mermaid question in a rig note and a lab note, light, dark and 390 px, and the snapshot embed with Lab Kit switched off. Looks: the Phase 1 page, then checklist rows.
