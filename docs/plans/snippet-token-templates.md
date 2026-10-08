# Plan: Snippets as token templates

_Agreed: 2026-10-09. Written by `/phase-plan`. Each phase = one session. Replaces Phase 4 (split `labSnippets.js`) of `docs/plans/make-my-own-copy.md`._

## Goal
The simple kit snippets become plain editable Markdown files with a small header block (the questions) and `{{tokens}}` in the body, so ordinary users can read, copy and change them without touching JavaScript.

## Decision taken
- Format: a header block at the top of the snippet file lists the fields (label, hint, default); the body uses tokens. The plugin reads and fills it at Alt+S time; the file holds no Templater code (user, 2026-10-09). Rejected: Templater code in the file (users must edit JS); a sidecar JSON per snippet (two files to keep in sync).
- Scope of the first build: the six text-and-names snippets: matrix, samples, timetable, blank, column, rt. The computed ones (solution, recipe, raft, nmr, gpc, dls, results, method) stay in `labSnippets.js` and keep the current Make my own copy (user). Rejected: all 14 at once (the token language would need molecular weights, Methods lookups and continuing letters); a two-snippet pilot.
- Phase 4 (split `labSnippets.js` into one file per snippet) is dropped. Revisit only if the remaining script grows (user).

## Out of scope
- Computed snippets (solution, recipe, raft, nmr, gpc, dls, results, method): stay as code.
- Form defaults as plain settings (BACKLOG "v0.4 quick changes").
- Snippet groups by type (BACKLOG "Future features").
- Any user-facing wording beyond the new button/Notice text: ask first.

## Open questions for Phase 1 (answered by the spike, not guessed)
- Token language: what the six need beyond `{{name}}`. Known: sample/variant codes (`{{prefix}}` + letter that continues from the note's earlier tables), repeat over a list (rows from "a, b, c"), a formula cell that refers to an earlier table (`=column!B10`), a unique table id (`unique("rt")`).
- Whether some of the six (timetable: rows = letters × times; rt: optional third table; column: density lookup from a note property) need a "computed token" provided by the plugin (fixed small set) rather than being pure text.
- How the Alt+S flow (`kits/lab/Templates/Insert snippet.md:41`, `tp.file.include`) detects a token template and hands it to the plugin, and how it works on mobile.
- What happens to existing copies made by Phase 3 (plain, no header): they keep working as plain text.

## Phases

### Phase 1 — Spike and format spec
- Files: this plan; read `labSnippets.js` (matrix, samples, timetable, blank, column, rt), `Insert snippet.md`, `labForm.js`, `labPick.js`, `src/kit/snippet-copy*.ts`.
- Done when: this plan gives the header syntax, the token list (with the computed tokens), and per snippet the exact template text, shown as a table; a Node spike fills each of the six templates with default answers and the output equals `labSnippets(tp, key)` run on the stub `tp` (byte for byte, after table-id uniqueness). Anything that cannot match is listed with a fallback (stay code). Decision recorded in `docs/decisions.md`. No code in `src/` or `kits/`.
- New dependencies: none

### Phase 2 — Engine: parse and fill
- Depends on: Phase 1
- Files: new `src/kit/snippet-template.ts` (pure: parse the header block, fill tokens, computed tokens passed in), `tests/snippet-template.test.ts` on fixtures from Phase 1.
- Done when: for each of the six, filled template with default answers equals the script's output; unknown token, missing field and malformed header give a clear error, never a half-filled note; `npm test` and `npm run lint` clean. Engine change → fixtures; known answers 0005 and 0011 unaffected.

### Phase 3 — Alt+S runs token templates
- Depends on: Phase 2
- Files: `kits/lab/Templates/Insert snippet.md`, the form call (reuse `labForm.js` from the header fields), a Lab Kit command or Templater-callable entry in `src/` for the fill, `npm run kit:manifest`, tests.
- Done when: a token template in Snippets/ shows its form in Alt+S and inserts the filled text; plain snippets (no header) still insert as before; works with `hasNode()` false (mobile); Obsidian check in test-vault reported as seen / not seen.

### Phase 4 — Ship the six as token templates
- Depends on: Phase 3
- Files: the six stubs in `kits/lab/Templates/Snippets/` (05, 06, 04, 13, 11, 12), `kits/lab/kit-manifest.json` via `npm run kit:manifest`, `labSnippets.js` (remove the six only after the templates are proven), tests, `docs/architecture.md`, `docs/maintenance.md` items, `docs/obsidian-test-checklist.md`, `docs/changelog.md`.
- Done when: all six produce the same output as before (old tests re-pointed, not deleted); Review update… treats the new files as ordinary managed files; no version field changes (release only).

### Phase 5 — Make my own copy for token templates
- Depends on: Phase 4
- Files: `src/kit/snippet-copy.ts`, `src/kit/snippet-copy-ui.ts`, `src/kit/managed-ui.ts` (snippet rows), tests.
- Done when: for a token template the copy is the template itself (header and tokens kept, so the copy stays editable and still asks its questions); code snippets keep the headless-run copy; the Notice no longer says "fixed codes" for token templates.

## Verification
Per snippet: old script output equals filled-template output on the same stub answers (before and after, same test). Obsidian check in test-vault: not seen until the user does it.
