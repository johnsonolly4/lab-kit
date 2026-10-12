# Plan: Snippets as token templates

_Agreed: 2026-10-09. Written by `/phase-plan`. Phase 1 DONE 2026-10-09 (spec below). Each phase = one session. Replaces Phase 4 (split `labSnippets.js`) of `docs/plans/make-my-own-copy.md`._

## Goal
The simple kit snippets become plain editable Markdown files with a small header block (the questions) and `{{tokens}}` in the body, so ordinary users can read, copy and change them without touching JavaScript.

## Decision taken
- Format: a header block at the top of the snippet file lists the fields (label, hint, default); the body uses tokens. The plugin reads and fills it at Alt+S time; the file holds no Templater code (user, 2026-10-09). Rejected: Templater code in the file (users must edit JS); a sidecar JSON per snippet (two files to keep in sync).
- Scope of the first build: the six text-and-names snippets: matrix, samples, timetable, blank, column, rt. Sample list and Sampling timetable lose their "Also add NMR / GPC / DLS / Results" toggles (user, 2026-10-09, after the spike); methods are added afterwards with the Analysis table snippet, which picks up the sample codes. The computed ones (solution, recipe, raft, nmr, gpc, dls, results, method) stay in `labSnippets.js` and keep the current Make my own copy (user). Rejected: all 14 at once (the token language would need molecular weights, Methods lookups and continuing letters); a two-snippet pilot.
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

### Phase 1 — Spike and format spec (DONE 2026-10-09, see "Phase 1 result")
- Files: this plan; read `labSnippets.js` (matrix, samples, timetable, blank, column, rt), `Insert snippet.md`, `labForm.js`, `labPick.js`, `src/kit/snippet-copy*.ts`.
- Done when: this plan gives the header syntax, the token list (with the computed tokens), and per snippet the exact template text, shown as a table; a Node spike fills each of the six templates with default answers and the output equals `labSnippets(tp, key)` run on the stub `tp` (byte for byte, after table-id uniqueness). Anything that cannot match is listed with a fallback (stay code). Decision recorded in `docs/decisions.md`. No code in `src/` or `kits/`.
- New dependencies: none

### Phase 2 — Engine: parse and fill (DONE 2026-10-09, see "Phase 2 result")
- Depends on: Phase 1
- Files: new `src/kit/snippet-template.ts` (pure: parse the header block, fill tokens, computed tokens passed in), `tests/snippet-template.test.ts` on fixtures from Phase 1.
- Done when: for each of the six, filled template with default answers equals the script's output; unknown token, missing field and malformed header give a clear error, never a half-filled note; `npm test` and `npm run lint` clean. Engine change → fixtures; known answers 0005 and 0011 unaffected.

### Phase 3 — Alt+S runs token templates (DONE 2026-10-09, see "Phase 3 result")
- Depends on: Phase 2
- Files: `kits/lab/Templates/Insert snippet.md`, the form call (reuse `labForm.js` from the header fields), a Lab Kit command or Templater-callable entry in `src/` for the fill, `npm run kit:manifest`, tests.
- Done when: a token template in Snippets/ shows its form in Alt+S and inserts the filled text; plain snippets (no header) still insert as before; works with `hasNode()` false (mobile); Obsidian check in test-vault reported as seen / not seen.

### Phase 4 — Ship the six as token templates (DONE 2026-10-09, see "Phase 4 result")
- Depends on: Phase 3
- Files: the six stubs in `kits/lab/Templates/Snippets/` (05, 06, 04, 13, 11, 12), `kits/lab/kit-manifest.json` via `npm run kit:manifest`, `labSnippets.js` (remove the six only after the templates are proven), tests, `docs/architecture.md`, `docs/maintenance.md` items, `docs/obsidian-test-checklist.md`, `docs/changelog.md`.
- Done when: all six produce the same output as before (old tests re-pointed, not deleted); Review update… treats the new files as ordinary managed files; no version field changes (release only).

### Phase 5 — Make my own copy for token templates (DONE 2026-10-09, see "Phase 5 result")
- Depends on: Phase 4
- Files: `src/kit/snippet-copy.ts`, `src/kit/snippet-copy-ui.ts`, `src/kit/managed-ui.ts` (snippet rows), tests.
- Done when: for a token template the copy is the template itself (header and tokens kept, so the copy stays editable and still asks its questions); code snippets keep the headless-run copy; the Notice no longer says "fixed codes" for token templates.

## Verification
Per snippet: old script output equals filled-template output on the same stub answers (before and after, same test). Obsidian check in test-vault: not seen until the user does it.

## Phase 1 result (2026-10-09)

Spike: a 130-line Node engine plus the six templates below, run against `labSnippets(tp, key)` on a stub `tp` in 21 scenarios (defaults, typed answers, empty required list = cancel, ids already taken, letters continuing from earlier text, an existing `column` table, an existing `sampling` table, solvent density from a note, blank unit, count 0). **Result: 21 of 21 identical, byte for byte**, with these intended differences only:
- Sample list and Sampling timetable have no "Also add" toggles (decision above). With the toggles off the output is identical.
- Every answer is trimmed (the script trimmed only the column density). Only stray spaces inside a single cell can differ.
- `repeat` with a negative or non-number count uses the fallback (the script made an empty table for a negative rows count).
- Not compared: the form's hints and placeholders (taken from the header as text), the `tag()` call (only used with the toggles), and the script's "Set your initials" Notice (the plugin keeps that check).

The spike code stays in the scratchpad; Phase 2 writes the real engine in TypeScript from this spec. The scenario list above is the Phase 2 fixture list.

### File format
A snippet note starts with a header between `---` lines (valid YAML, so Obsidian shows it as properties). The plugin reads it with Obsidian's `parseYaml`; the engine takes the parsed object, so it stays pure and works on mobile (no Node). The body follows. A note with no such header is a plain snippet and inserts as today.

| Header key | Meaning |
|---|---|
| `title` | Form title |
| `icon`, `desc` | Same meaning as the `// icon:` and `// desc:` lines of code snippets (Alt+S menu) |
| `required` | A field that must hold at least one list item, else nothing is inserted (the script's "return empty") |
| `fields` | List of questions: `key`, `label`, optional `hint`, `placeholder`, `type` (`text` default, `number`, `textarea`), `value` (default; may hold tokens) |

Cancel (Esc) inserts nothing.

### Token language
`{{...}}` in the body and in a field's `value`. A block tag alone on a line removes its line. To write a literal `{{`, put a backslash before it (`\{{`); Phase 2 tests this. Unknown token, unknown field or an unclosed block = a clear error, nothing inserted.

| Token | Gives |
|---|---|
| `{{key}}` | The answer for field `key` |
| `{{a\|b\|"text"}}` | First non-empty of the alternatives; a literal fallback is in quotes |
| `{{#each key}}…{{/each}}` | Repeat for each item of a comma / newline separated answer. Inside: `{{.}}` the item. `{{#each key as x}}` names it `{{x}}`. `{{#each key \| " \| "}}` joins the repeats with a separator |
| `{{@i}}` `{{@n}}` `{{@seq}}` | Index from 0, from 1, and a running count over all repeats of that block (nested loops). `{{@i+2}}` adds a number (spreadsheet rows) |
| `{{#repeat key\|3}}…{{/repeat}}` | Repeat a number of times; fallback 3 when the answer is not a positive number |
| `{{#if key}}…{{else}}…{{/if}}` | True when the answer has at least one list item. `{{#if key ^= "h"}}` = starts with (ignoring case) |
| **Computed tokens (provided by the plugin, fixed set)** | |
| `{{prefix}}` | Initials + number of the note + `-` (`ABC0016-`) |
| `{{code}}` | `prefix` + the next free sample letter; continues from earlier codes in the note, advances on each use |
| `{{table:base}}` | A table id unique in the note (`base`, `base2`…). The same `base` gives the same id again in one insert. `{{table:$key\|"base"}}` takes the base from a field. `{{table:sampling>_start}}` = the id of `sampling` plus `_start`, made unique |
| `{{linked:column!B10}}` | `=column!B10` when the note has a `column` table with rows, else empty |
| `{{next-letter:sampling}}` | The first sample letter not used in the note's `sampling` tables (default of a field) |
| `{{note-number:key.Density}}` | A number from the property of the note named by field `key`, else empty |

Plugin functions the engine needs (injected, so it stays pure): note text, prefix, `unique(base)`, `tableRows(name)`, next free letter index (whole note or for a table name), note property lookup. All exist as helpers inside `labSnippets.js` today.

### The six templates
Exact file text (the whole file; the body is inserted verbatim, so the blank lines after the tables are part of the output).

#### 04 Variant naming matrix
~~~~markdown
---
title: Variant naming matrix
icon: grid-3x3, layout-grid
desc: Rows × columns → sample codes; Copy gives one column
required: rows
fields:
  - key: rows
    label: Row items
    hint: e.g. acids, comma separated
    placeholder: e.g. acid 1, acid 2
  - key: cols
    label: Column items
    hint: e.g. alcohols, comma separated
    placeholder: e.g. alcohol 1, alcohol 2
---
## Variant naming matrix
```calc
name: {{table:variants}}
title: Variant naming matrix
icon: grid-3x3
copy: list
|  | {{#if cols}}{{#each cols | " | "}}{{.}}{{/each}}{{else}}Code{{/if}} |
|{{#if cols}}{{#each cols}}---|{{/each}}{{else}}---|{{/if}}---|
{{#each rows as r}}
| **{{r}}** | {{#if cols}}{{#each cols | " | "}}{{code}}{{/each}}{{else}}{{code}}{{/if}} |
{{/each}}
```


~~~~

#### 05 Sample list
~~~~markdown
---
title: Sample list
icon: list
desc: Untimed list of sample codes, typed or generated
fields:
  - key: codes
    label: Sample codes
    type: textarea
    hint: one per line or comma separated · leave blank to generate
  - key: count
    label: …or generate this many
    type: number
    value: "6"
---
## Samples
```calc
name: {{table:samples}}
title: Samples
icon: list
copy: column A
| Code | Description | Notes |
|---|---|---|
{{#if codes}}
{{#each codes}}
| {{.}} |  |  |
{{/each}}
{{else}}
{{#repeat count|1}}
| {{code}} |  |  |
{{/repeat}}
{{/if}}
```

~~~~

#### 06 Sampling timetable
~~~~markdown
---
title: Sampling timetable
icon: timer
desc: Codes per time point with target clock times
required: times
fields:
  - key: times
    label: Time points
    hint: comma separated
    value: 0, 30, 60, 120
  - key: unit
    label: Time unit
    hint: min or h
    value: min
  - key: letters
    label: Sample letters
    hint: comma separated · blank = one sample
    value: "{{next-letter:sampling}}"
  - key: start
    label: Start time (hh:mm)
    hint: blank = fill in on the day
---
## Sampling timetable
```calc
name: {{table:sampling>_start}}
title: Start
icon: timer
| Setting | Value |
|---|---|
| Start time (hh:mm) | {{start}} |
```

```calc
name: {{table:sampling}}
title: Sampling timetable
icon: timer
copy: column A
| Code | Time ({{unit|"min"}}) | Target time | Taken at | Notes |
|---|---|---|---|---|
{{#each letters as L}}
{{#each times as t}}
| {{prefix}}{{L}}{{t}} | {{t}} | =CLOCK({{table:sampling>_start}}!$B$2, B{{@seq+2}}{{#if unit ^= "h"}}*60{{/if}}) |  |  |
{{/each}}
{{/each}}
```

~~~~

#### 11 Flow column prep
~~~~markdown
---
title: Flow column prep
icon: cylinder, database
desc: Column weighing → bead mass → reactor volume
fields:
  - key: id
    label: Table id
    hint: other tables use e.g. column!B10 for the reactor volume
    value: column
  - key: solvent
    label: Solvent
    hint: optional · its note's Density fills the density below
    placeholder: e.g. solvent name
  - key: density
    label: Solvent density (g/mL)
    hint: blank = from the solvent's note, or fill in later
  - key: dead
    label: End-fitting dead volume (mL)
    value: "0.21"
  - key: packing
    label: Packing material
    hint: blank = fill in later
    placeholder: e.g. glass beads, 100 µm
---
## Column prep
```calc
name: {{table:$id|"column"}}
title: Column weighing
icon: cylinder
| State | Value |
|---|---|
| Empty column (blanking plugs, glass wool) (g) |  |
| Packed column (beads, plugs, glass wool) (g) |  |
| Packed + full of solvent (g) |  |
| Solvent density (g/mL) | {{density|note-number:solvent.Density}} |
| End-fitting dead volume (mL) | {{dead}} |
| Mass of beads (g) | =B3-B2 |
| Mass of solvent (g) | =B4-B3 |
| Solvent volume (mL) | =B8/B5 |
| Reactor volume (mL) | =B9-B6 |
| Packing material | {{packing}} |
```

~~~~

#### 12 Residence times
~~~~markdown
---
title: Residence times
icon: waves
desc: Flow rate for each residence time from a reactor volume
required: rts
fields:
  - key: volume
    label: Reactor volume (mL)
    hint: type the volume, or link it like =column!B10
    value: "{{linked:column!B10}}"
  - key: rts
    label: Target residence times (min)
    hint: comma separated
    value: 2, 10, 20, 30
  - key: flows
    label: Flow rates to check (mL/min)
    hint: optional, comma separated
---
## Residence times
> [!info] Residence time
> $$\tau = \frac{V_{\text{reactor}}}{Q}$$

```calc
name: {{table:rt_in}}
title: Reactor
icon: waves
| Setting | Value |
|---|---|
| Reactor volume (mL) | {{volume}} |
```

```calc
name: {{table:rt}}
title: Flow rate for each residence time
icon: waves
| Residence time (min) | Flow rate (mL/min) | Time to steady state, 3 RTs (min) |
|---|---|---|
{{#each rts}}
| {{.}} | ={{table:rt_in}}!$B$2/A{{@i+2}} | =A{{@i+2}}*3 |
{{/each}}
```
{{#if flows}}

```calc
name: {{table:rt_check}}
title: Residence time for each flow rate
icon: waves
| Flow rate (mL/min) | Residence time (min) |
|---|---|
{{#each flows}}
| {{.}} | ={{table:rt_in}}!$B$2/A{{@i+2}} |
{{/each}}
```
{{/if}}

~~~~

#### 13 Blank calc table
~~~~markdown
---
title: Blank calc table
icon: calculator
desc: Your own columns and rows
required: cols
fields:
  - key: cols
    label: Column headings
    hint: comma separated
    value: Item, Value, Result
  - key: rows
    label: Rows
    type: number
    value: "3"
  - key: id
    label: Table id
    hint: used in formulas from other tables
    value: calc1
---
```calc
name: {{table:$id|"calc1"}}
icon: calculator
| {{#each cols | " | "}}{{.}}{{/each}} |
|{{#each cols}}---|{{/each}}
{{#repeat rows|3}}
| {{#each cols | " | "}}{{/each}} |
{{/repeat}}
```

~~~~

### Cannot match, with fallback
Nothing in the six. Left out on purpose: the "Also add" toggles of Sample list and Sampling timetable (decision above). Later phases must not claim parity for those two forms. The chemical-name suggestions (`suggest: chems`) are only used by the computed snippets and by `column`'s Solvent field; a token field type `chemical` (same list as today) is needed in Phase 3 for Solvent, or the field loses its suggestions. Recorded as an open point for Phase 3, not guessed.

### Phase 2 and 3 notes from the spike
- Phase 2 file list gains: the six templates as test fixtures under `tests/fixtures/` (the text above), and the 21 scenarios as table-driven tests against `labSnippets` (keep it until the six are removed from the script in Phase 4).
- Phase 3: an "Also add" replacement is not needed; Alt+S must show `title`, `icon`, `desc` from the header; `Insert snippet.md` reads icon / desc with a regex today and needs a second path for the header.
- Existing Make my own copy files (plain text, no header) keep working unchanged.

## Phase 2 result (2026-10-09)

Built: `src/kit/snippet-template.ts`, `tests/snippet-template.test.ts` (47 tests), the six templates as `tests/fixtures/snippet-templates/*.md`. 28 scenarios run the script and the filled template on the same stub answers: identical byte for byte. Engine only; tests only, not seen in Obsidian. The spike code was gone, so the engine was written from the spec above.

Changes to the spec found while building (the fixtures hold the new text):
- `{{#each key as L or ""}}`: when the list is empty the block runs once with that item. Needed because the script treats a blank "Sample letters" answer as one sample (`[""]`); a plain `#each` would give no rows. Only Sampling timetable uses it.
- A note counts as a token template only when its header has a `fields` key (an empty list is allowed). Any other note with properties is a plain snippet.
- Field keys may not be `prefix` or `code`; keys are letters, digits, `-`, `_`.
- `{{#repeat key|N}}` without `|N` falls back to 1.
- `{{#if key ^= "h"}}` is false for an empty answer.
- Env for the engine (Phase 3 provides the real one): `prefix`, `nextFreeIndex(table?)`, `uniqueTable(base)`, `tableRows(name)`, `noteProperty(note, property)`. The tests build one from the note text (`envFor` in the test file); Phase 3 can move that into `src/`.
- Tests use a small test-only YAML reader for the six headers, because the repo has no YAML library. Real `parseYaml` (Obsidian) is untested until Phase 3.

## Phase 3 result (2026-10-09)

Built: `src/kit/snippet-env.ts` (`makeEnv` = the real `TemplateEnv`, moved out of the test; `classFilter`), `src/kit/snippet-run.ts` (`SnippetTemplates.meta` / `.run`, on the plugin as `plugin.snippets`), `Insert snippet.md` (header snippets listed by `title` / `icon` / `desc`, run through the plugin; others through `tp.file.include`). Tests: `tests/snippet-run.test.ts`, `tests/snippets-chem-class.test.ts`; the Phase 2 tests now use `makeEnv`. Tests only, not seen in Obsidian; tests read headers as JSON (stub `parseYaml`), so Obsidian's real YAML reader is untested.

Added to the spec:
- Field options `suggest: chemicals` and `class: <text | list>` (any class name, never checked against a list). Setting `chemClassOnly` (Settings → Lab Kit): only the asked class, or asked class first then the rest (default). The same filter is in `labSnippets.js` (`chemsFor`) for the code snippets: monomers → monomer, CTA → CTA, initiator → initiator, solvents → solvent; reagents and solutes unfiltered.
- Missing `labForm` or a bad header/token: a Notice naming the snippet, nothing inserted.

## Phase 4 result (2026-10-09)

Built: the six files in `kits/lab/Templates/Snippets/` are the token templates (same names; manifest regenerated; `scripts/kit-manifest.mjs` also reads `desc:` from a header). The six are gone from `labSnippets.js` with the code only they used (prefix / initials Notice, `nextFreeIndex`, `tableRows`, `letterIndex`, the "Also add" toggles). Tests: `tests/token-snippets.ts` (helper: `runToken`, `miniYaml`) runs a key the way Alt+S does; `snippets*.test.ts` use it for the six and `labSnippets` for the rest. The 28 scenarios now compare with `tests/fixtures/snippet-templates/expected.json` (the script's output, recorded before the six were removed; the fixture copies of the templates are deleted, the shipped files are the source). Known answers 0005 and 0011 hold. Tests only, not seen in Obsidian.

Changes to the spec:
- Flow column prep's Solvent field has `suggest: chemicals` and `class: solvent` (the script had `chemsFor("solvent")`; Phase 1 left this open).
- `isStubSnippet` (`src/kit/snippet-copy.ts`): Manage files… shows Open on token templates (it hid it on every snippet because they were stubs).
- Tests that used the toggles now run the method snippets after the list (nmr, gpc, results, dls); the prefix / initials tests moved to `tests/snippet-run.test.ts`.
- Make my own copy is not offered for the six until Phase 5 (their `snippetKey` is null). `CODE_SNIPPETS` / `hasFixedCodes` still list samples, timetable and matrix: Phase 5 cleans that.

## Phase 5 result (2026-10-09)

Built: `isTokenTemplate` and `copyTokenTemplate` in `src/kit/snippet-copy.ts`; `makeMyCopy` copies the file text for a token template (stubs keep the headless run); `managed-ui.ts` shows the button on token templates; `CODE_SNIPPETS` is now nmr, gpc, dls, results. Tests in `tests/snippet-copy.test.ts` (522 pass). Tests only, not seen in Obsidian. The copy keeps the original `title:` (two Alt+S entries with one title): BACKLOG.
