# Plan: Close experiment (I24)

_Written: 2026-10-19 (I24-PLAN). **Re-cut 2026-10-20 (N3a)** to the owner's decision of 2026-10-19 (`docs/decisions.md`, I24 line): NO freeze. The first version of this plan froze the note text; that is gone. Open points are BACKLOG "Questions for the owner" → **I24 re-cut** (a)-(d); the plan is written for the recommended answers ("rec."). Model: Sonnet for Phases 1-5, Opus only if the PDF route fails in Phase 2._

## Goal
"Close experiment" turns a finished lab note into a record, without touching the note's text:
1. **PDF**: a PDF of the note (front matter as a properties table, full content of every table, no hazards) saved to the destination folder(s) each user sets. Desktop only; on a phone the PDF is `pending`.
2. **Mark**: `closed_on: YYYY-MM-DD` and `closed_hash` (SHA-256 of the note at closing) in the front matter.
3. **Footer**: every PDF page prints `Closed {date} · {note name} · SHA-256 {12 characters}`, so a later edit of the note is detectable (hash of the note now differs from the footer).
4. **Reopen** clears the mark. The PDFs stay.
Live blocks (calc tables, rig) stay live: the PDF shows their values on the day. Status `Closed` set by hand (board drag) does not close; Check setup lists such notes.

## Spike result (history, written for the first plan; still valid for the PDF route) (2026-10-19, desktop, macOS, Obsidian 1.14.4 / Electron 43, obsidian-check on a copy of the 0011 note)
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
- **Wide table cut on a landscape page**: CSS named pages (`@page wide { size: landscape }`) change the page box but Chromium lays the content out at the first page's width. One orientation per PDF: landscape when any table has more than 7 columns (decided: landscape only for tables too wide), set by `@page { size: A4 landscape }` (the `landscape: true` option of `printToPDF` is ignored once CSS sets a size).
- **Words split mid-word** (`Residenc/e`): `table-layout: fixed` + `overflow-wrap: anywhere` only on wide tables; normal tables keep their own width.
- `require("obsidian")` is not reachable from the window console; the plugin has it, so this only mattered for the spike.

Electron access: `require("electron").remote` exists in Obsidian 1.14.4 (Obsidian supplies it); `remote.BrowserWindow` and `webContents.printToPDF` worked. It is an Obsidian internal (like `@electron/remote` in `obsidian-check`): isolate it in `src/node.ts` with a comment, and fall back to Option A (Obsidian's export window, the user picks the file) when it is missing.

**Phone**: no Electron, so no `printToPDF`; Obsidian's own Export to PDF is believed to be desktop only (not checked: emulation still runs desktop Electron, so the command shows there). Web Crypto (`crypto.subtle.digest`) works on both, so the hash works on the phone. Decided: the PDF is desktop only; on a phone, Close sets the mark and `closed_pdf: pending`; Check setup on a computer lists it with a Make PDF button.

## Decisions (owner, 2026-10-19; plus rec. answers marked "rec.")
- No freeze: the note stays editable and live. Nothing in the body is rewritten.
- PDFs go to one or more destination folders **set by each user** in the plugin settings (empty default; absolute paths on this device, so they can be outside the vault). Desktop only.
- The hash is SHA-256 (hex) of the note text with the `closed_*` lines and `Status` removed, line ends normalised to `\n` (rec.: `Status` is left out so a board drag is not an edit).
- Hazards are not printed in the PDF (the Hazard header block is removed from the rendered note). Smaller text; the whole PDF turns landscape only when a table is wider than 7 columns.
- Reopen removes `closed_on` and `closed_hash`; PDFs are never deleted.

## Out of scope
- Freezing, locking or rewriting the note; signing with a key or timestamp server; Dataview / Meta Bind inline fields (left as they are); embedded images and PDFs beyond what `MarkdownRenderer` draws; a batch "close all Closed notes"; a phone PDF.

## Phases (one commit each, one per session; `python3 scripts/check.py` before each commit)

### 1. Mark and hash, pure
- Files: `src/close/mark.ts` (new: `closedHash(text): Promise<string>`, `isClosed(fm)`, `closedFooter(date, name, hash)`, `withoutClosedLines(text)`), `tests/close-mark.test.ts`. No UI, no I/O. `crypto.subtle` works on desktop and phone (as in `src/kit/managed.ts`).
- Done when: the hash is 64 lowercase hex and stable; changes when one body character changes; does not change when `Status` or any `closed_*` line changes or with CRLF line ends; `isClosed` true only for a non-empty `closed_on`; the footer text is exact (see strings).

### 2. PDF, desktop (BUILT 2026-10-20, N3b: commit 923380c; checked in a throwaway Obsidian on a made-up 0011 note: 2 pages A4 landscape, 100 199 B, all 11 columns, 1.7591, footer on both pages, no hazards, phone emulation null; `pdfHtml` takes the cleaned body as a string and `cleanForPdf` does the DOM clean-up, so both are tested without a browser; the fallback to Obsidian's own export when `electron.remote` is missing is NOT built: `printHtmlToPdf` returns null, Phase 3 decides what the user sees)
- Files: `src/close/pdf.ts` (new: `pdfHtml(title, props, bodyEl, wide)`, `renderForPdf(app, file)`, `PRINT_CSS`), `src/node.ts` (`printHtmlToPdf(html, footer): Promise<ArrayBuffer | null>`, the only place that touches `electron.remote`), `tests/close-pdf.test.ts` (HTML string: properties rows, `.print` wrapper, landscape switch at > 7 columns, buttons and Hazard header removed).
- HTML is built with `createEl` on a detached document and serialised with `XMLSerializer` (no `innerHTML`). Page CSS: the app's stylesheets + `PRINT_CSS`; light theme forced; A4; margin 14 mm; smaller text.
- Footer on every page (`printToPDF` `footerTemplate`) from `closedFooter`.
- Done when: obsidian-check on the 0011 note: properties PASS, 1.7591 PASS, all 11 columns PASS, no hazard table, pages and bytes reported; `errors` []. Mobile emulation: `printHtmlToPdf` returns null, no console error.

### 3. Settings and commands: Close and Reopen (BUILT 2026-10-20, N3c: commit 6a47014; the I24 re-cut questions were still unanswered, so it follows the rec. answers, except: Reopen sets Status to `Started`, because the Lab book base has Planned / Started / Processing results / Closed and no `Running`; the confirm window on a phone leaves out the sentence about folders; two notices not in the string list below were added: `Experiment closed. This Obsidian cannot make the PDF here: Check setup lists it as pending.` and `This note is not closed.`; a note counts as a lab note when it sits in the lab notes folder and its name has a number; a closed_pdf of a failed or missing PDF is `pending`; closed_pdf is a list of file names)
- Files: `src/close/commands.ts` (new: `closeExperiment`, `reopenExperiment`), settings row "Close experiment: PDF folders" (list of folders, add / remove), `src/kit/ui.ts` (`addCommand` next to `clone-experiment`), `tests/close-commands.test.ts`.
- Close: active note is a lab note; no folder set on this device → the window says so and offers to open the setting; confirm window (Check setup look, `docs/design-standard.md`); hash; PDF to every folder; then `closed_on`, `closed_hash`, `closed_pdf` (file names). A folder that cannot be written is named in a notice; the others still get the PDF. On a phone: `closed_on` / `closed_hash` are set and `closed_pdf: pending`.
- Reopen: clears `closed_on` and `closed_hash`; keeps `closed_pdf` as `closed_pdf_old`.
- Done when: unit tests for refusal cases and a Close / Reopen round trip (body byte for byte); obsidian-check: Close on 0011 writes the PDF to a temp folder, Reopen clears the mark.

**Changed 2026-10-20 (Exp. End retired, Q7b a, owner chat):** a note is closed only when `closed_on` AND (`closed_hash` or `closed_pdf`) are set; a note with only `closed_on` is "ended" (Tidy moves an old `Exp. End` there). Close experiment accepts such a note and keeps its `closed_on` date (PDF name, footer and mark use it); Reopen says "This note is not closed." and leaves it; Check setup has no row for it.

### 4. Check setup (BUILT 2026-10-20, N3d: commits bbf28bd, e41a2e8; (c) not answered by the owner, built as rec. A: rows only, no Close again button; the rows show only for their case, group `Lab notes`, amber; detail = the plan's sentence + the note names; a row's Close button closes each listed note in turn through the Close experiment window, Make PDF asks once, saves with the closing date and the note's own `closed_hash` in the footer and sets `closed_pdf` to the file names; Make PDF has no button on a phone)
- Files: `src/kit/setup-check.ts` + `setup-check-ui.ts` (rows), tests.
- Rows: closed notes whose hash no longer matches (edited after closing); `Status: Closed` without `closed_on` (button Close); `closed_pdf: pending` (button Make PDF, desktop).
- Done when: a test per row on a fixture vault.

### 5. Docs (BUILT 2026-10-20, N3e: changelog line, six checklist rows in 6i, architecture already current from Phases 3-4, no new decision; the rig PDF item in BACKLOG "NEXT TASK" was NOT ticked because the rig diagram was never checked in a closed-note PDF; the owner's answers to BACKLOG "I24 Phase 3 leftovers" (2)-(6), "I24 Phase 4 leftovers" and "I24 re-cut" (c) were still missing, so nothing from them was applied)
- `docs/changelog.md`, `docs/obsidian-test-checklist.md` 6i rows (Close, Reopen, phone pending, Check setup rows), `docs/architecture.md` (`src/close/`), `docs/decisions.md` line, BACKLOG tick of the rig PDF item (NEXT TASK, item (1)) only if the rig diagram was checked in the PDF.

## Where the closed-note rows live (owner, chat 2026-10-20: "Isn't that Tidy notes? Check setup is meant to be for settings and the like")
Assessed 2026-10-20 against `src/kit/tidy.ts` and `src/kit/tidy-ui.ts`. Nothing moved; the three rows stay in Check setup until the owner picks.
- What Tidy up notes is: rules that propose a `TidyChange` per note (properties, page, move, new note, trash, setting), shown before / after, ticked per rule, applied together after "I have backed up my vault". The only other output is `reported`: path plus a note, no button, headed "Nothing here is ever changed".
- The two button rows do not fit: Close writes a PDF to the device's folders and sets `closed_*` after a confirm window, and Make PDF writes only a file; neither is a note rewrite shown as before / after, neither is applied by the window's one Change notes button, and Tidy has no per-note action buttons (a PDF is per device, Tidy's changes are the same everywhere). The "edited after closing" row fits `reported` (info lines) as it is.
- Options:
  - A. Leave all three in Check setup (today). One place for "needs a look", buttons work, but it holds notes, not settings.
  - B. Move only "edited after closing" to Tidy `reported`; Close and Make PDF stay in Check setup. Splits one feature over two windows.
  - C. Move all three to a Tidy group `closed-notes` and add per-note action buttons to Tidy's `reported` list (new UI: a button beside a path, runs an injected action, window re-scans). Fits the question best, needs a new Tidy feature and a look to approve.
  - D. Own small window `Closed lab notes` (command + Home link), listing the three cases with the buttons; Check setup keeps one line "N closed lab notes need a look" opening it.
- Recommendation: C if the owner wants Tidy to be "everything about notes"; otherwise D (smallest new UI that does not bend Tidy). Not A long term. `scanClosed` stays pure and unchanged in every option. `Close again` is not needed (owner: rows only, unchanged).
- Asked in BACKLOG "Questions for the owner" (Closed-note rows: where they live).

## New user-facing strings (exact; for the rec. answers)
- Commands: `Close experiment` · `Reopen experiment` · `Make PDF of closed experiment`
- Confirm window: title `Close this experiment?`; text `A PDF of this note is saved in {folders}. The note is marked closed on {date}; if you change it later, Check setup tells you. You can reopen it.`; buttons `Close experiment` · `Cancel`
- Reopen window: title `Reopen this experiment?`; text `The closed mark (closed {date}) is removed. The PDFs are kept.`; buttons `Reopen` · `Cancel`
- Notices: `Experiment closed. PDF saved: {file}.` · `Experiment closed. No PDF on this device: make it on a computer (Check setup).` · `Could not save the PDF in {folder}. See the developer console.` · `This note is already closed (on {date}).` · `This is not a lab note.` · `Experiment reopened.` · `Set a folder for closed-experiment PDFs first.`
- PDF footer: `Closed {date} · {note name} · SHA-256 {hash12}`
- Setting: `Close experiment: PDF folders`
- Check setup rows: `Closed lab notes edited after closing` (detail `{n} note(s) changed since they were closed.`) · `Lab notes marked Closed but not closed` (button `Close`) · `Closed lab notes without a PDF` (button `Make PDF`)
- Properties: `closed_on`, `closed_hash`, `closed_pdf`, `closed_pdf_old`.

## Checks (every phase reports numbers or PASS/PARTIAL/FAIL)
Known answers: 0011 Reactor volume 1.7591 in the PDF. obsidian-check for Phases 2-4 ("checked in a throwaway Obsidian", not the owner). Not verifiable by Claude: a real phone, Windows / Linux PDF output, how the PDF looks printed on paper, the store review's view of `electron.remote`.
