# Plan: Close experiment (I24)

_Written: 2026-10-19 (plan step I24-PLAN, plan and spike only). NOT approved: the owner answers BACKLOG "Questions for the owner" → **I24** first; this plan is written for the recommended answers (marked "rec." below) and changes if they differ. Model: Sonnet for Phases 1-5, Opus only if the PDF route fails in Phase 2._

## Goal
"Close experiment" turns a finished lab note into a record (ELN practice: a signed page is locked):
1. **Freeze**: every live block (calc tables, hazard header, rig) is written out as plain text, so the note no longer changes when a chemical's MW, a hazard phrase or a method note changes.
2. **Stamp**: `closed_on: YYYY-MM-DD` and `closed_hash` (SHA-256 of the frozen note) in the front matter.
3. **PDF**: a PDF of the note with the front matter as a properties table and the full content of every table.

Same idea as `docs/plans/freeze-meeting-notes.md` (meeting notes freeze when the next one is made). An old script that made the PDF is gone; this is built from scratch.

## Spike result (2026-10-19, desktop, macOS, Obsidian 1.14.4 / Electron 43, obsidian-check on a copy of the 0011 note)
Test note: 0011 front matter (11 properties, 2 chemicals), `lab-header`, the 0011 `column` calc table, an 11-column `wide` calc table. Scripts: throwaway branch `spike/i24-pdf` (`spike/i24/optA.js`, `optB.js`, `pdfinfo.swift`); PDFs and page images in the side-session notes `i24-pdf-spike/`.

| Check | A: Obsidian Export to PDF (`workspace:export-pdf`) | B: hidden BrowserWindow + `webContents.printToPDF` |
|---|---|---|
| Properties table | **FAIL** (not printed at all) | **PASS** (11 rows, built by us) |
| Calc values (Reactor volume 1.7591) | PASS | PASS |
| Wide table not cut | **FAIL** (cut after column 8: "Mw (g/mo", Dispersity, Sample code, Comment lost) | **PASS** (all 11 columns; page turns landscape) |
| Hazard table present | PASS (2 rows + legend) | PASS (2 rows + legend, forced open) |
| Pages / size | 2 pages, 176 826 B, Letter (locale default) | 2 pages, 174 121 B, A4 landscape |
| Time | 4.0 s | 0.8-2 s |
| Other | Opens Obsidian's own window, then a native Save dialog: the plugin cannot set the folder or file name (the spike had to stub the dialog). Prints the calc buttons (`+ Row`, `A1`, `Copy`), the name twice, the "Open data folder" button, the hazard fold triangle. | Content is ours: buttons removed, title + properties on top. File written with `vault.adapter.writeBinary` to the vault path we choose. |

What failed on the way with B, and the fix (all needed in Phase 2):
- **Blank page**: Obsidian's CSS has `@media print { body > :not(.print) { display: none } }`. Wrap the content in `<div class="print">`.
- **Missing text at the end** ("Dry the beads first." was gone): cloning the open reading view loses sections that are off screen (Obsidian renders lazily). Render the note fresh with `MarkdownRenderer.render` into an off-screen element instead, and wait until every calc block from `extractBlocks` has its table and the header has drawn (timeout 3 s).
- **Wide table cut on a landscape page**: CSS named pages (`@page wide { size: landscape }`) change the page box but Chromium lays the content out at the first page's width. One orientation per PDF: landscape when any table has more than 7 columns (rec., question I24-f), set by `@page { size: A4 landscape }` (the `landscape: true` option of `printToPDF` is ignored once CSS sets a size).
- **Words split mid-word** (`Residenc/e`): `table-layout: fixed` + `overflow-wrap: anywhere` only on wide tables; normal tables keep their own width.
- `require("obsidian")` is not reachable from the window console; the plugin has it, so this only mattered for the spike.

Electron access: `require("electron").remote` exists in Obsidian 1.14.4 (Obsidian supplies it); `remote.BrowserWindow` and `webContents.printToPDF` worked. It is an Obsidian internal (like `@electron/remote` in `obsidian-check`): isolate it in `src/node.ts` with a comment, and fall back to Option A (Obsidian's export window, the user picks the file) when it is missing.

**Phone**: no Electron, so no `printToPDF`; Obsidian's own Export to PDF is believed to be desktop only (not checked: emulation still runs desktop Electron, so the command shows there). Web Crypto (`crypto.subtle.digest`) works on both, so freeze + hash work on the phone. Rec. (question I24-e): on a phone, Close freezes and stamps the note and sets `closed_pdf: pending`; the next desktop start lists it in Check setup with a Make PDF button.

## Decisions taken in this plan (rec. answers; the owner can change them)
- Closing **freezes the text and makes the PDF** (I24-b). The PDF is made from the frozen note, so PDF and note show the same values.
- PDF goes to a **Records folder** in the vault: `<lab book folder>/Records/<note name> (closed YYYY-MM-DD).pdf`; a second close of the same note adds `, 2` (I24-a). The note gets `closed_pdf: "[[<that path>]]"`.
- Calc tables freeze to a **plain Markdown table of values**, the calc source kept under it in a folded callout so formulas are not lost (I24-c).
- Hazard header freezes to a callout with a Markdown table (Chemical, H phrases), "as on <date>" (I24-c). The data-folder button stays (it is a link, not data).
- **Reopen experiment** puts back the note as it was just before closing (from the backup Close made), removes `closed_on`, `closed_hash`; the PDF stays and is never deleted (I24-d).
- Setting **Status: Closed by hand** (board drag, property edit) does not close; Check setup lists such notes with a Close button (I24-g).
- Hash = SHA-256 (hex) of the note text with the three `closed_*` lines and `Status` removed, line ends normalised to `\n`. `Status` is left out so a board drag is not an edit.

## Out of scope
- Signing with a key or a timestamp server; locking the file against edits (Obsidian cannot); Dataview / Meta Bind inline fields (left as they are, listed in the PDF as text); embedded images and PDFs beyond what `MarkdownRenderer` draws; a batch "close all Closed notes".

## Phases (one commit each, one per session; `npm test` + `npm run lint` before each commit)

### 1. Freeze text, pure
- Files: `src/close/freeze.ts` (new: `freezeLabNote(text, rendered, today)`, `calcToMarkdown(block, values)`, `hazardsToMarkdown(rows, today)`, `closedHash(text)`, `isClosed(fm)`), `tests/close-freeze.test.ts`, `tests/fixtures/lab-notes/close-0011-before.md`, `close-0011-after.md`.
- `rendered` comes from the engine (`Workbook` / `formatValue` in `src/calc/engine.ts`, `collectHazards` in `src/header/hazards.ts`), not from the DOM, so it is testable.
- Done when: the after fixture has `| Reactor volume | 1.7591 |` and the 0005 fixture's Mn `19990.14`; a second freeze returns null; front matter and every other line are byte for byte; hash is stable and changes when one body character changes, not when `Status` changes.

### 2. PDF, desktop
- Files: `src/close/pdf.ts` (new: `pdfHtml(title, props, bodyEl, wide)`, `renderForPdf(app, file)`, `PRINT_CSS`), `src/node.ts` (`printHtmlToPdf(html): Promise<ArrayBuffer | null>`, the only place that touches `electron.remote`), `tests/close-pdf.test.ts` (HTML string: properties rows, `.print` wrapper, landscape switch at > 7 columns, buttons removed).
- HTML is built with `createEl` on a detached document and serialised with `XMLSerializer` (no `innerHTML`, plugin rule). Page CSS: the app's stylesheets + `PRINT_CSS`; light theme forced; A4; margin 14 mm.
- Footer line on every page (`printToPDF` `footerTemplate`): `Closed {date} · {note name} · SHA-256 {first 12 hex}` (I24-h).
- Done when: obsidian-check on the 0011 note: properties PASS, 1.7591 PASS, all 11 columns PASS, hazard table PASS, pages and bytes reported; `errors` []. Mobile emulation: `printHtmlToPdf` returns null, no console error.

### 3. Commands: Close and Reopen
- Files: `src/close/commands.ts` (new: `closeExperiment`, `reopenExperiment`), `src/kit/ui.ts` (`addCommand` next to `clone-experiment`, line 407), `src/main.ts` if wiring needs it, `tests/close-commands.test.ts`.
- Close: active note must be a lab note (in the lab book folder, has `Exp. Class` or `Status`); confirm window (Check setup look, `docs/design-standard.md`); backup with the kit backups (`src/kit/backups.ts`); freeze; write `Status: Closed`, `closed_on`, `closed_hash`; PDF; `closed_pdf`. A PDF failure never undoes the freeze: `closed_pdf: pending` and a notice.
- Reopen: restores the backup text, keeps `closed_pdf` as `closed_pdf_old` list (I24-d), clears `closed_on` / `closed_hash`, Status back to the value it had before closing.
- Done when: unit tests for refusal cases and Reopen round trip (before == after reopen); obsidian-check: Close on 0011 makes the PDF in `Records/`, Reopen gives the live calc block back.

### 4. Check setup and Tidy
- Files: `src/kit/setup-check.ts` + `setup-check-ui.ts` (rows), `src/kit/tidy.ts` + `tidy-ui.ts` (group), tests.
- Check setup rows: closed notes whose hash no longer matches (edited after closing); `Status: Closed` without `closed_on`; `closed_pdf: pending`.
- Tidy group (opt-in, not ticked until ticked, backed up first): "Lab notes edited after closing" → Close again (new freeze + PDF `, 2`); does nothing silently.
- Done when: tests for each row and the Tidy group on a tidy-vault fixture.

### 5. Docs
- `docs/changelog.md`, `docs/obsidian-test-checklist.md` 6i rows (Close, Reopen, phone pending, Check setup rows), `docs/architecture.md` (`src/close/`), `docs/decisions.md` line, BACKLOG tick of the rig PDF item (NEXT TASK, item (1)) only if the rig diagram was checked in the PDF.

## New user-facing strings (exact; for the rec. answers)
- Commands: `Close experiment` · `Reopen experiment` · `Make PDF of closed experiment`
- Confirm window: title `Close this experiment?`; text `The tables, hazards and rig are written out as plain text, so later changes to chemicals or methods no longer change this note. A PDF is saved in {folder}. You can reopen it later.`; buttons `Close experiment` · `Cancel`
- Reopen window: title `Reopen this experiment?`; text `The note goes back to how it was before it was closed on {date}, with live tables. The PDF is kept.`; buttons `Reopen` · `Cancel`
- Notices: `Experiment closed. PDF saved: {file}.` · `Experiment closed. No PDF on this device: make it on a computer (Check setup).` · `Could not make the PDF. The note is closed; see the developer console.` · `This note is already closed (on {date}).` · `This is not a lab note.` · `Experiment reopened.` · `No backup of this note from before it was closed: reopen by hand.`
- Frozen text: hazard callout title `Hazards (as on {date})`; formulas callout title `Formulas`; table header `Chemical | Hazard statements`
- PDF footer: `Closed {date} · {note name} · SHA-256 {hash12}`
- Check setup rows: `Closed lab notes edited after closing` (detail `{n} note(s) changed since they were closed: Close again makes a new PDF.`) · `Lab notes marked Closed but not closed` (button `Close`) · `Closed lab notes without a PDF` (button `Make PDF`)
- Tidy group title: `Lab notes edited after closing`; detail `Close again: freeze the note again and save a new PDF next to the old one. Not ticked until you tick it; each note is backed up first.`
- Properties: `closed_on`, `closed_hash`, `closed_pdf`, `closed_pdf_old`; folder `Records`.

## Checks (every phase reports numbers or PASS/PARTIAL/FAIL)
Known answers: 0011 Reactor volume 1.7591 in the frozen table and the PDF; 0005 RAFT Mn 19990.14 in the frozen table. obsidian-check for Phases 2-4 ("checked in a throwaway Obsidian", not the owner). Not verifiable by Claude: a real phone, Windows / Linux PDF output, how the PDF looks printed on paper, the store review's view of `electron.remote`.
