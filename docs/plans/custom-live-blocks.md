# Plan: Custom snippet blocks and live blocks from a definition

> [!warning] PLAN WAITING FOR OWNER
> Written 2026-10-21 by `/phase-plan` (Opus, plan only, no code changed), from the owner's chat of 2026-10-21 ("Custom snippet blocks that ask questions like the built-in ones: plan it now"; `docs/decisions.md` 2026-10-21, lines "Code block names" and "Custom snippet blocks"). Owner input of the same day is in **Decided by the owner** below; CQ2, CQ7 and CQ8 are answered. Questions CQ1, CQ9, CQ12-CQ22 are at the end, ready for BACKLOG "Questions for the owner". Phases C1-C3 need no answer and can start; every later phase says which answers it needs. Looks are never decided here: the two new looks (the definition check report, the "worked out with an older definition" line) go on a feedback page first (Phase CF). Each phase = one Sonnet session.

## Goal
A user writes a snippet file that asks questions in every way the built-in blocks do (text, number, chemical, note, codes, toggle, choice, a list of chemicals with fractions) and, if they want, puts a **live block** in the note that is described in that file (rows, look-ups from chemical notes, target formulas, actual values typed at the bench), without any code, in the plugin's own look, and still readable when the plugin is gone.

## Decided by the owner (chat 2026-10-21, relayed by the orchestrator; not re-asked)
- One shared tag for definition-driven blocks, ```` ```lk-block ```` with a `use: <definition>` line: "This seems sensible" (CQ2 a).
- A `layout:` from a small fixed menu, `steps` / `list` / `table` / `grouped`, checked against all four chosen looks: "Yes makes sense".
- The `lk-` rename of every Lab Kit block, old names not read, is confirmed: nobody has notes with Lab Kit blocks yet.
- The owner's Excel sheets with the original RAFT logic (sent 2026-10-21, kept in the owner's Drive; private, never in the public repo): the definition format must express their formulas. Compared the same day (derived, `my_work/private/raft-excel/compare.py`, unreviewed): Lab Kit's RAFT maths equals the sheet to 6 decimals for both homopolymer cases and for a 0.5 : 0.5 copolymer; for a 0.95 : 0.05 copolymer the sheet takes a plain average of the two MWs, so its monomer masses add up to less than the mass typed (13.68 g for 20 g), while Lab Kit weights by the fractions and gives 20.00 g; Mn is equal. The sheet also has an `Init eq` box, an NMR standard row (2 % of the solvent) and a small equivalents table, which the built-in RAFT block lacks (CQ10, CQ11).
- CQ7 a ("Yes this one"): a definition writes only its own block's lines plus the ask-once chemical property after a click.
- CQ3 c ("Okay, lets do that then"): before the release, kit-only; own definitions are read from the next release. Plain token-template snippets are not affected.
- CQ6 a ("lets set the limit where suggested"): the limits in Target design §5; they may be raised later (never lowered).
- NMR standard row: not wanted in the snippet (owner 2026-10-21); CQ11 is now only about `Init eq` (the owner's sheet has it, B9; neither the old calc-table generator `labSnippets.js:310-342` nor the P9 block ever had it).
- CQ10 a ("Okay just use the old one then"): the mole-fraction-weighted mean MW, as the old calc-table generator (`labSnippets.js:337-338`) and the P9 block do.
- CQ11: no `Init eq` box, but the CTA : initiator question must make plain that the initiator counts as 1 (owner: "Make sure it is obvious that init eq is 1"): label `CTA : initiator`, hint `mol CTA per 1 mol initiator (e.g. 20 = 20 : 1)`; exact wording shown to the owner before it ships.
- Help texts (owner: "The snippet syntax should be able to store tooltips like this too … important for new snippets or new users"): every question already has `hint:` (the small line under the box, `docs/snippet-syntax.md` §1); the definition syntax gets `hint:` on rows, values and live lines too, and every kit snippet fills them. A longer `help:` text shown on demand (an (i) next to the label) is a new look: feedback page first (Phase CF), owner question CQ22.
- CQ22 a ("Seems like a sound idea"): `hint:` plus optional `help:` behind an (i).
- Every calculation kept in the note's text (owner: "any calculation that was done should be kept (even if just algebraically) so that a human with the plain text file can recreate"): rule 8 of the stored text standard below.
- Sample list, Sampling timetable and Variant naming matrix become one menu entry with a format choice (owner, CQ16 for these three); RAFT stays its own snippet (owner: "I want raft separate").
- A syntax dictionary for users and LLMs is kept (owner): Phase C10 writes `docs/snippet-syntax.md` for people and a machine-readable reference (every key, type, allowed values, one example each) next to it, both tested against `definition.ts`.
- CQ17: an exact plugin function `PH_ACID` is acceptable (owner: "This is ok really, its only small"); the owner judges the shortcut from the error chart before it is closed.
- CQ19: render first (feedback page) before anything is decided.
- CQ23 (owner 2026-10-21): every snippet shipped today stays in the plugin (groups can already be switched off in Settings); future snippets are added to a folder of the GitHub repo, outside the build.
- pH (owner 2026-10-21): `PH_ACID` / `PH_BASE` are fine; every snippet that shows a pH carries a hint that it is an estimate (25 °C, first pKa, activity ignored; check with a pH meter); wording shown to the owner first.
- Rule 8 `#` lines and hand edits: a `#` line outside Lab Kit's group (from its head line on) is the user's and is never touched; Lab Kit's group is rewritten only on insert / Edit set-up / Update; a hand edit inside the group, a hand edit of a set-up line, or a changed definition makes the re-worked lines differ, so the block shows the CQ5 line with Update (never an automatic rewrite).
- CQ8 b ("This one"): once the RAFT proof passes, the kit's RAFT snippet switches to the definition at once and the built-in RAFT view / window code goes (Phase C7); the built-in maths stays only as the test reference.

## Decision taken
- **Declarative only** (owner direction, chat 2026-10-21). Questions in the snippet file's `fields:` header as today (Q27 a); the live block described as rows with formulas in the existing calc formula language; one shared tag; looks only from the plugin's CSS; a small fixed set of layouts.
- **Changed from the chat direction, with reasons (each asked below):**
  - The rows and layout sit in a ```` ```lk-definition ```` block **in the body** of the snippet file, not in the header (CQ1). Obsidian's properties editor shows nested lists of maps badly and may rewrite the YAML when a property is clicked (Phase 0 of the Templater plan measured this risk for `{{tokens}}` in front matter); a code block is never rewritten, keeps comments, and the plugin can draw a check report under it in the snippet file itself.
  - **Four layouts as decided, but `grouped` is a look, not Results' data:** `list`, `table`, `steps`, `grouped` (a `table` whose columns sit under group headings, look S-B). Any row definition can use `grouped`. What Combined results itself does (rows = sample codes found in other tables, values looked up there) is not a set of rows with targets, so the Results block stays built-in: see "Do the four chosen looks fit one format?" (CQ4).
  - **Kit-only first:** the definition language ships with the kit's own definitions before the release, but definitions in the user's own files are read only from the release after (CQ3), so format 1 can still change while nobody outside depends on it. Once open, format 1 is read forever (owner rule for live blocks, 2026-10-20).
- **Rejected:** a Templater-like syntax with code (`<% %>`, JavaScript, `eval`): unbounded, not store-review safe, the thing being removed. Free layouts or user CSS classes: no stable look, breaks the "styling only from the plugin" rule. A new formula language: the calc one is known to the owner from every calc table and already parses on mobile.

## What is there today (read 2026-10-21 on this branch and on `claude/templater-p9-raft-17c0be`; line counts measured with `wc -l`)
- **Questions:** `src/kit/snippet-template.ts` (594 lines) reads `fields:` with `type` `text` / `number` / `textarea` only; `:137-138` refuses any other type. `src/kit/snippet-form.ts` (230 lines) already draws `toggle` (a Yes / No pill, `:177`) and `select` (pills up to `PILL_MAX` = 3 options, a dropdown above, `:81`, `:185`); `src/kit/snippet-run.ts:161-166` maps template fields to form fields and already passes a `select` for "Codes from". So toggle and select need a header reader and token rules, not a new window.
- **Body:** `{{tokens}}` (`fillTemplate`, `snippet-template.ts:592`), `#each` / `#if` / `#repeat`, chemical and note look-ups (`docs/snippet-syntax.md` §1).
- **Live-block core:** `src/blocks/core.ts` (189 lines, Templater plan Phase 8): the `key: value` line format with two-space sections, `format:` line and newer-version refusal, `setLine` one-line writer, `blockRange`, `actualText` (masses only, `NOT_A_MASS`), `processNote`, `holdScroll`.
- **RAFT live block** (branch `claude/templater-p9-raft-17c0be`, not merged): `src/blocks/raft/` = `maths.ts` 67, `format.ts` 32, `text.ts` 250, `view.ts` 132, `setup.ts` 113, `render.ts` 321 lines; look R-C (one Target / Actual list, `N of M weighed` chip, summary line, "Mn from what you've weighed", a collapsed "How it's worked out" fold), `#` worked-out lines per Q36 a; fixtures `tests/fixtures/raft/raft-0005.md`, `raft-0005-fresh.md`, five chemical notes; `tests/raft-text.test.ts` (22 cases), `raft-view.test.ts` (12), `raft-maths.test.ts`.
- **Formula engine:** `src/calc/engine.ts` (512 lines). `parseFormula` (`:156`) already turns a bare name into a `const` node (`:210`; names may hold dots, `:137`, and are upper-cased, `:148`); `evalNode` answers `#NAME?` for any name but PI / TRUE / FALSE (`:373-377`). Functions: `FUNCS` (`:242-296`, not exported) plus IF, XLOOKUP, INDEX, MW, PROP (`:425-457`). A name shaped like a cell (`dp1`, `cta2`, 1-3 letters then digits) is read as a cell reference by the tokenizer (`:136`).
- **Looks the owner chose** (`my_work/mockups/live-block-looks.html`; `docs/decisions.md` 2026-10-21; brief of this session): RAFT R-C, Recipe P-B (7 columns with a total row), Combined results S-B (columns grouped by method), M-A (`#` lines); Solution prep as approved (`my_work/reference_visual/solution-live-block.png`: numbered steps, accent bar, Target / Actual, estimated pH line).

## Do the four chosen looks fit one format? (checked against the mock-up text and the R-C code)
| Look | Layout | Rows with targets and actuals? | Maths as formulas? | Verdict |
|---|---|---|---|---|
| RAFT R-C | `list`: name + small line, Target, Actual; chip; summary; live line; fold | yes; the monomer row repeats per monomer, the co-solvent row is optional | yes (sums, products, ratios) | **fits**, with repeated rows (`each:`), optional rows (`when:`) and number formats; see "RAFT-only quirks" below |
| Recipe P-B | `table`: 7 declared columns (Reagent, Eq., Relative to, mmol, Target, Actual, wt%), solvent "rest" row, total row | yes | yes (rest = total − sum of the others; wt% = target ÷ total) | **fits**, needs `columns:` and `total:` |
| Solution prep (approved) | `steps`: numbered sections, done bar | yes | **no**: the estimated pH solves the charge balance by bisection (`docs/plans/solution-live-block.md`, Technical choices), which no formula does | **look fits, maths does not**: stays built-in |
| Combined results S-B | grouped header over columns | **no**: rows are sample codes found in other tables, columns are look-ups into the note's `nmr` / `gpc` / `dls` tables, nothing is weighed | not rows-with-targets: a query over other calc tables | **look fits** (`grouped`), **data does not**: the Results block stays built-in (Templater plan Phase 11), CQ4 |

So the layout menu covers all four looks, but the row format covers the maths of only two (RAFT, Recipe); Solution prep (a solver) and Combined results (a look-up across tables) keep their built-in code (interpretation from the table above). The language is aimed at "a recipe you weigh out": a fixed or repeated set of reagents, targets worked out from the answers and chemical notes, actuals typed in.

### RAFT-only quirks the byte-for-byte proof needs (measured in `view.ts` / `text.ts` on the P9 branch)
The proof demands the same text, so these must be expressible. Each is generic enough to keep, except where marked:
1. Masses as a balance reading: five figures, at most four decimals, below 0.1 g in mg with two decimals (`fmtMass`); mmol with 3 / 4 / 5 decimals by size (`fmtMmol`); MW with trailing zeros dropped (`fmtMw`) → three named formats `mass`, `mol`, `mw`.
2. Mn with a thin space between thousands in the drawn block but not in the `#` lines (`groupThousands`) → a format option `group`.
3. The summary's monomer mass as `2.50 g` (two decimals from 1 g up, else `mass`; `summaryMass`) → RAFT-only; a format `mass2`.
4. The solvent's name lower-cased in the summary ("in water"; `lowerFirst`) → RAFT-only; a text filter `lower-first`.
5. Different worked-out lines for one monomer and for several (a mean-MW line first) → `when:` on worked-out lines.
6. Worked-out lines padded to the longest name + 2 (`workedOut`) → the fixed rule for every definition's `#` lines (generic).
Stop rule for the build: if the proof needs **more than these** RAFT-only features, the phase stops and asks (the language is bending to one block).

## One stored text standard for every live block (owner 2026-10-21: "standardised across all snippets and all potential future snippets")
What lands in the note is set by **the plugin**, not by the snippet file: a definition chooses the names (its field keys and row names), never the shape of the text. The shape is one written standard, shared by built-in and definition blocks:
1. a fence with an `lk-` tag; 2. `format: N` first; 3. `use: <definition>` for a definition block; 4. one `key: value` line per answer, by field key, units after the number (`monomer-mass: 2.5 g`); a list answer as a section with one two-space line per item; 5. `used:` (or `step N:` sections for `steps`) with one line per row name for the typed actuals; 6. the `#` worked-out lines, head line first, names padded, rewritten only on insert / Edit set-up; 7. any other `#` line is the user's and is kept; 8. every number the block shows can be recomputed by a person from the text alone: each target has a `#` line with its sum written out in numbers, and each live value worked out from what is typed (e.g. "Mn from what you've weighed") has one `#` line with its formula in words and names (`# Mn from weighed = Σ monomer g ÷ (CTA g ÷ CTA MW) + CTA MW`), written on insert / Edit set-up, never while typing.
Plain token templates (calc tables, text) stay set by the template's body, as today: they are not live blocks.
Phase C4 writes this standard as `docs/live-block-format.md`; a test runs every block writer (Solution prep, RAFT, definitions) over its fixtures and checks rules 1-7. Solution prep's existing `step N:` layout is rule 5's steps form; any other difference is listed, not changed, until the owner says.

## Target design

### 1. The snippet file (CQ1 a)
````markdown
---
title: RAFT recipe generator
icon: flask-conical
desc: Monomer mass, DP, CTA:initiator, solids → every mass and Mn
group: Make up
block: definition
fields:
  - key: monomers
    label: Monomer(s)
    type: list           # new: "DAAm, DMAm" or "DAAm: 0.7, DMAm: 0.3"
    weights: fraction
    suggest: chemicals
    wide: true
  - key: mass
    label: Monomer mass
    type: number
    unit: g
  - key: cosolvent
    label: Co-solvent
    suggest: chemicals
  ...
---
```lk-definition
format: 1
name: raft
layout: list
...
```
````
- `block: definition` = this snippet inserts a live block described by the ```` ```lk-definition ```` block in its body (the `run:` / `block: raft` headers keep meaning a built-in).
- The header's `fields:` are the set-up questions; the same list is the set-up window and the Edit set-up window (one source).
- The ```` ```lk-definition ```` block is YAML (Obsidian's `parseYaml`, on every platform), drawn in the snippet note as a check report: "Definition raft: OK, 5 rows, 9 values" or the list of problems (look: feedback page first, CF).

### 2. New question types (header, also for plain token templates)
| Type | Window | Answer as a token | Stored in a live block |
|---|---|---|---|
| `toggle` | Yes / No pill (`snippet-form.ts:177`) | `yes` or empty, so `{{#if key}}` works | `key: yes` / `key: no` |
| `select` + `options:` (list of texts or `value` / `label`) | pills up to 3, a dropdown above (`:185`) | the option's value | `key: <value>` |
| `list` (+ `weights: fraction`, + `suggest: chemicals`) | one box, the RAFT hint line | `A, B` (for `#each`) | a section, one `"[[A]]": 0.7` line each (as RAFT's `monomers:`) |
Plus `unit:` on a number field (the stored line gets it, as `monomer-mass: 2.5 g`) and `wide: true` (spans the window's grid, as RAFT's monomer row).

### 3. The definition (illustrative; Phase C3 fixes the exact keys)
```yaml
format: 1
name: raft                     # what `use:` names; unique in the vault
layout: list                   # list | table | steps | grouped
status: weighed                # chip "N of M weighed" / done
title: 'RAFT: P({{#each monomers | "-co-"}}{{name}}{{/each}}), DP {{= dp}}'
summary: '{{#each monomers | ", "}}{{name}}{{/each}} {{= mass | mass2}} · DP {{= dp}} · {{cta}} · ...'
values:                         # named formulas, calc syntax, any order, no cycles
  mean_mw: SUMPRODUCT(monomers.mw, monomers.fraction) / SUM(monomers.fraction)
  n_monomer: mass / mean_mw
  n_cta: n_monomer / dp
  mn: dp * mean_mw + cta.mw
rows:
  - each: monomers             # one row per item of the list answer
    role: monomer
    lookup: { mw: MW }         # from the chemical note (MW name rules of calc); ask once when missing
    mol: n_monomer * fraction / SUM(monomers.fraction)
    target: mol * mw           # grams
    sub: 'monomer · {{= mol | mol}}'
    actual: mass               # mass | none
  - id: cta
    name: '{{cta}}'
    lookup: { mw: MW }
    target: n_cta * cta.mw
  - id: cosolvent
    when: cosolvent            # row only when the answer is filled
    ...
live:                           # lines under the rows, from what is typed (x.amount = actual, else target)
  - when: weighed > 0
    label: "Mn from what you've weighed:"
    value: SUM(monomers.amount) / (cta.amount / cta.mw) + cta.mw
    format: { number: 0, group: true, unit: g/mol }
worked:                         # the M-A `#` lines, rewritten only on insert / Edit set-up
  - when: COUNT(monomers) = 1
    each: monomers
    text: '{{= mass | mass}} ÷ {{= mw | mw}} = {{= mol | mol}}'
  ...
```
- **Names:** `answer keys`, `values`, row ids; per row `mw` / `mol` / `target` / `actual` / `amount`; from outside a row `cta.target`; for a repeated row `monomers.target` is a list, usable only inside SUM, SUMPRODUCT, AVERAGE, MIN, MAX, COUNT. `weighed` / `rows` = counts. Names are not case-sensitive (the tokenizer upper-cases them) and must not look like a cell (`dp1`): the check says so.
- **Formulas:** parsed by `parseFormula`, evaluated by a new exported `evaluate(node, resolveName)` beside `Workbook` that shares `FUNCS`; table evaluation is unchanged (0011 guard, calccraft tests). Refused at check time: cell references and ranges (no reading the note's tables in v1), XLOOKUP / INDEX / PROP / MW (look-ups go through `lookup:`), CLOCK. Errors come back as the calc error values (`#DIV/0!` …) and show on the row.
- **Texts:** titles, summary, `sub`, `worked` and labels use the token syntax users already know, plus one new token `{{= formula | format}}`. Whether this reuses `fillTemplate` or a small own filler is decided in C4 (fewer surprises if it is the same `#each` / `#if`).
- **Named chemistry functions** (option, CQ14): a fixed, tested function shipped in the plugin, e.g. `PH_WEAK_ACID(c, pKa)`, may be added to the allow-list; it is still no user code. This is what would let Solution prep's pH (a solve, not a formula) become a definition.
- **The owner's RAFT Excel sheet** (to be resent; `my_work/private/raft-excel/`, placeholder): the formula functions are the calc engine's, which are Excel-like (SUM, SUMPRODUCT, IF, ROUND …), so each cell formula of the sheet should become one named value. C4 checks this; a sheet formula that cannot be written (a function the engine lacks, a lookup into another sheet) is listed and asked about, not worked around.
- **Formats (fixed list):** `mass`, `mass2`, `mol`, `mw`, `number: N`, `sig: N`, `percent: N`, `group`, `unit: <text>`, text filter `lower-first`.

### 4. The block in the note (one shared tag, CQ2 a)
````
```lk-block
format: 1
use: raft
monomers:
  "[[DAAm]]": 1
cta: "[[PDMA 76]]"
...
monomer-mass: 2.5 g
used:
  DAAm: 2.5012 g
  PDMA 76:
# worked out by Lab Kit (raft), rewritten when the set-up changes
# MW from the chemical notes: DAAm 169.23, PDMA 76 2220.99, VA-044 323.33
# DAAm     2.5000 g ÷ 169.23 = 14.773 mmol
...
```
````
- Same line format and writer as every live block (`src/blocks/core.ts`): answers by field key, `used:` per row name, `#` lines per M-A. Without Lab Kit the note still shows every input, every typed mass and every target with its sum.
- The `#` head line names the definition and a short hash of it. When the definition later changes, the block says so and offers Update, which rewrites the `#` lines only (CQ5); inputs and actuals are never touched.
- A block whose definition is missing (file deleted or renamed, or a user definition before CQ3 opens them) is drawn as its own lines with one error line ("No definition called raft"); its text is left alone. A newer `format:` is refused as in every live block.
- Why one tag: Obsidian registers code block processors when the plugin loads; a tag per definition would need a reload whenever a definition is added and could clash with built-in names.

### 5. Stability rules (the "hard limits")
- **Two versions:** `format:` in ```` ```lk-definition ```` (the language) and in ```` ```lk-block ```` (the stored block). Both: a missing line = 1 for the block, but **required** in a definition; a newer one is refused with "made with a newer Lab Kit: update the plugin"; every older one is read forever, each change ships with a reader and a saved old fixture (owner rule 2026-10-20).
- **Checked when the definition is read** (plugin load, file change), not while drawing: unknown keys, unknown names, cycles between values, a name like a cell, a refused function, a format not in the list, a `when:` that is not a formula, a field used in a row but not in `fields:`. Each problem = one sentence naming the key and the line in the definition block. A definition with any problem is not used: its blocks show "Definition raft has a problem: open <snippet>".
- **Limits (CQ6 a):** 50 rows, 30 items in a repeated row, 200 named values, 300 characters per formula, nesting depth 32, 32 KB per definition block, 100 definitions in the vault. A draw evaluates each name once (memo), so work is bounded by these numbers.
- **What a definition can do:** read its own block's lines, the answers, and properties of the chemical notes its answers link to. **Writes (CQ7 a):** only its own block's lines (set-up on Edit set-up, one `used:` line per typed actual, the `#` lines), and the ask-once property (e.g. MW) into a chemical note after a click, through `fileManager.processFrontMatter` as Solution prep does. No other note, no files, no network, no commands, no loops other than `each:` over an answer, no HTML (text via `setText`), no CSS classes or colours from the definition.
- **Mobile:** pure TypeScript and `parseYaml`; the window is centred on a phone as every snippet window; `hasNode()` not needed anywhere.
- **Store review:** no `eval` / `new Function`, no `innerHTML`, no inline styles, all classes in `styles.css` on `--lk-radius-*` (`.claude/rules/obsidian-plugin.md`).

### 6. Looks
Only the plugin's CSS. The four layouts reuse the live-block classes the RAFT and Solution blocks already draw with (`.lk-sol-*` in `styles.css`; a shared rename belongs to the `lk-` prefix work, not here): `list` = R-C, `table` = P-B (sideways scroll inside the block on a phone, as in the mock-up), `steps` = the approved Solution prep steps, `grouped` = S-B (group headings over the columns, the copy button copies flat). Nothing a definition writes changes a colour, size or corner.

## Out of scope
- Anything that reads other tables of the note (Combined results, S-B), solvers or iteration (Solution prep's pH), dates or clocks in block maths.
- Actuals other than masses (volumes, times) in v1: `actual: mass | none`.
- Code of any kind; user CSS; free layouts; more than the four layouts.
- Converting blocks already in notes (old ```` ```raft ```` / calc tables stay as they are; Templater plan Q10).
- Definitions outside the Snippets folder; sharing definitions between vaults (a snippet file is copied like any note).
- The `lk-` prefix rename of every existing block (owner decision 2026-10-21, not built): its own plan, see "Order".

## Phases (each = one Sonnet session)

### Phase C1 — Question types toggle, select, list (token templates)
- Depends on: none.
- Files: `src/kit/snippet-template.ts` (`readHeader`: `toggle`, `select` + `options`, `list` + `weights`, `unit`, `wide`; tokens: toggle = `yes` / empty, list = `A, B`), `src/kit/snippet-run.ts:161` (pass `options`), `tests/snippet-template.test.ts`, `tests/snippet-form-audit.test.ts`, `docs/snippet-syntax.md` §1 (field keys).
- Done when: a header with each new type parses; a bad `options` / unknown type gives one clear `TemplateError`; `{{#if toggle}}` and `{{#each list}}` work; the 28 token-template scenarios and the form audit are unchanged; 0005 / 0011 guards; check PASS. Not seen in Obsidian → checklist 6i row.

### Phase C2 — Named formulas on the calc parser (BUILT 2026-10-21)
- Built: `evaluate` in `src/calc/engine.ts` (the table evaluator's binary operators moved to a shared `binary`, nothing else changed), `src/blocks/def/formula.ts`, `tests/def-formula.test.ts` (16 tests). 0005 `dp * mean_mw + cta.mw` = 19990.14 (to 6 decimals), the 0.95 : 0.05 copolymer mean MW equals `raftTargets().meanMw` to 9 decimals; the refusals, `a: b` / `b: a` = `#CIRC!`, limits 200 / 300 / 32 tested at the edge. SLOPE / INTERCEPT / RSQ / STDEV were already in `FUNCS` (MS3). Check PASS: tests 2214, lint 0 errors / 5 warnings, build ok. Depth counts operators and functions (a bare number is 0).
- Depends on: none (can run with C1 in either order).
- Files: `src/calc/engine.ts` (export `evaluate(node, resolve)` sharing `FUNCS`; `Workbook` unchanged), new `src/blocks/def/formula.ts` (`checkFormula`: allowed nodes and functions, cell-like names, `names(node)` for the dependency graph; `evalScope`: memo, cycle → `#CIRC!`, lists into the aggregate functions only), `tests/def-formula.test.ts`.
- Done when: `dp * mean_mw + cta.mw` with the 0005 inputs gives 19990.14 (reported known answer, CLAUDE.md); `A1`, `sampling!B2`, `XLOOKUP(…)`, `dp1` are refused with a sentence each; a cycle `a: b`, `b: a` is an error, not a hang; every calc test (incl. `calccraft-compat`, 0011 = 1.7591) passes unchanged; check PASS.

### Phase C3 — Definition reader, check and limits
- Depends on: C2.
- Files: new `src/blocks/def/definition.ts` (YAML → `Definition`, every check of Target design §5, `format:` rules), `src/blocks/def/limits.ts`, fixtures `tests/fixtures/defs/` (one good RAFT definition, one bad file per check), `tests/def-definition.test.ts`.
- Done when: each bad fixture gives exactly its sentence with the key and line; the good RAFT definition reads; a `format: 2` definition is refused; the limits are hit by generated over-size fixtures; check PASS.

### Phase C4 — Block text: answers, `used:`, `#` lines (RAFT proof, part 1)
- Depends on: C1, C3; **Templater Phase 9 merged** (the built-in RAFT and its fixtures are the reference).
- Files: new `src/blocks/def/block.ts` (answers ↔ lines, Edit set-up ops generalised from `raftChanges`, `worked` lines with the padding rule, definition hash in the head line), `src/blocks/def/text.ts` (the `{{= … }}` token and formats; `format.ts` of RAFT moved into a shared place if both need it), `kits/lab/Templates/Snippets/` is **not** touched yet; the RAFT definition as a test fixture `tests/fixtures/defs/raft.md`; `tests/def-raft-proof.test.ts`.
- Done when: for every block-text case of `tests/raft-text.test.ts` (fresh 0005, several monomers, three monomers, co-solvent added and removed, a used line written, Edit set-up DP 105 → 120) the definition gives the built-in's block text **byte for byte except the fence line and the `use:` line** (and the head line's definition name); the stop rule above held (list the RAFT-only features used); **compare against the owner's Excel sheet**: every formula of the sheet's RAFT calculator written as a definition value (`Init eq` and the NMR standard row per CQ11), and the cases of `my_work/private/raft-excel/compare.py` reproduced by the definition (results noted in `my_work/`, not in the public repo; the copolymer case follows CQ10); check PASS.

### Phase C5 — View model, `list` layout (RAFT proof, part 2)
- Depends on: C4.
- Files: new `src/blocks/def/view.ts` (title, chip, summary, rows, live lines, fold lines; errors for a missing note / MW with the ask target), `tests/def-raft-proof.test.ts` (view part).
- Done when: for the 12 cases of `tests/raft-view.test.ts` the definition's view equals `buildRaftView` field by field (title, status, summary, rows label / sub / target / actual, estimate, worked, errors); 0005 Mn 19990.14 and the weighed estimate 19 963 g/mol (mock-up R-C) come out; check PASS.

### Phase C6 — In Obsidian: registry, ```` ```lk-block ````, typing actuals
- Depends on: C5; CQ5 (CQ2 answered a).
- Files: new `src/blocks/def/registry.ts` (definitions from the Snippets folder, re-read on change, duplicates and missing names), `src/blocks/def/render.ts` (`registerMarkdownCodeBlockProcessor("lk-block")`, `list` layout from the shared classes, Actual cells through `core.ts`, Update line for a changed definition), `src/main.ts`, `styles.css` only if a class is missing (no new look), tests (DOM: no `<table>`, scoped classes).
- Done when: obsidian-check: a note with the RAFT definition fixture and a note with the built-in block side by side, light / dark / 390 px; the two `.lk-raft` crops show the same texts (compare as N4 Phase 8 did); typing 2.5012 g writes one line (byte check); deleting the definition file leaves the block text untouched and shows the error line; console errors []; check PASS. The Update line is drawn only after CF.

### Phase C7 — Set-up window, Alt+S and Edit set-up
- Depends on: C6, C1.
- Files: new `src/blocks/def/setup.ts` (the grid window of Solution / RAFT, built from `fields:`; `wide`, units, chemical suggestions, the list hint), `src/kit/snippet-run.ts` / `snippet-insert.ts` (`block: definition`), ask-once look-ups (reuse `src/solution/ask-reagent.ts`), tests.
- CQ8 b switch, in this phase: `kits/lab/Templates/Snippets/03 RAFT recipe generator.md` becomes `block: definition` with the RAFT ```` ```lk-definition ````, `npm run kit:manifest`; `src/blocks/raft/view.ts`, `render.ts`, `setup.ts` are removed and their tests moved to the definition (the maths and text tests stay as the reference until C10).
- Done when: Alt+S → the fixture snippet with the 0005 answers inserts the fresh block byte for byte (C4's reference); Edit set-up DP → 120 rewrites DP and the `#` lines only; a chemical with no MW is asked once and written to its note; obsidian-check desktop + `--mobile`; check PASS.

### Phase C8 — `table` layout and Recipe P-B as a kit definition (replaces Templater Phase 10, if CQ3 = a or c)
- Depends on: C7; Q34 = P-B.
- Files: a known-answer script first (`docs/plans/recipe-known-answers.py`, the mock-up's numbers: lipoic acid 10 mmol, DCM to 60 g → 2.0632 g, 1.0814 g, 0.1222 g, 2.2696 g, 54.4636 g, wt% 3.44 / 1.80 / 0.20 / 3.78 / 90.77; derived, unreviewed until `/claims-review`), `src/blocks/def/render.ts` (`table`: `columns:`, `total:`), `kits/lab/Templates/Snippets/02 Recipe by equivalents.md` (`block: definition` + its ```` ```lk-definition ````; `run: recipe` stays readable for old copies), `npm run kit:manifest`, fixtures, tests.
- Done when: the script's numbers come out of the definition; "0.5 eq of DCC" (relative to another reagent) works; the "From what you've weighed" eq. line; an old Recipe calc table in a note still draws unchanged; obsidian-check incl. the phone's sideways scroll; check PASS.

### Phase CF — Feedback page for the two new looks (no plugin code)
- Depends on: C3 (the real problem sentences); can run any time after it.
- Files: `my_work/mockups/` page with `my_work/agent_kit/render_check.py feedback`: (1) the check report under ```` ```lk-definition ```` in the snippet file (OK and with problems), (2) the "worked out with an older definition" line with Update; BACKLOG question with the picks.
- Done when: the owner has picked; picks in `my_work/reference_visual/` with README rows.

### Phase C9 — `steps` and `grouped` layouts, the check report, Make my own copy
- Depends on: C6, CF.
- Files: `src/blocks/def/render.ts` (`steps`: `step:` on a row, done bar per step, chip "step n of m"; `grouped`: `group:` on a column, a heading row over the grouped columns, flat copy), `src/blocks/def/report.ts` (```` ```lk-definition ```` processor = the check report as picked), `src/kit/snippet-copy*.ts` (Make my own copy of a definition snippet gives it a new `name:`), a made-up two-step definition fixture and a made-up grouped fixture, tests.
- Done when: the two-step fixture draws like the approved Solution prep steps (crop beside `solution-live-block.png`); the grouped fixture draws like S-B in `my_work/mockups/live-block-looks.html` (crop beside it) and Copy gives flat rows; a broken definition shows its report; a copy has a unique name and the original's blocks still use the original; check PASS.

### Phase C10 — Docs and the switch for own definitions
- Depends on: C9; CQ3 (whether own definitions are read in this release).
- Files: `docs/snippet-syntax.md` (new §: live block definitions, every key, the limits, the formats, the two version rules, a worked RAFT example), changelog, tutorial, architecture (`src/blocks/def/`), `docs/obsidian-test-checklist.md` 6i rows, the setting / switch that opens own definitions (CQ3).
- Done when: every key in `definition.ts` is in the syntax page (a test greps them); check PASS.

## Order (how this fits the Templater plan)
- **Now → C1, C2, C3** need nothing from other branches and can run while Templater Phases 2-6 (note templates) are built: different files.
- **C4 waits for Templater Phase 9 to merge** (the reference). Phase 8 (core) is already merged.
- **Templater Phase 10 (Recipe):** replaced by C8 when CQ3 = a or c; built as planned (built-in) when CQ3 = b.
- **Templater Phase 11 (Combined results):** unchanged and independent (CQ4 a); may run before or between C-phases.
- **Templater Phase 12** needs C8 (or Phase 10) for the `recipe` key. **Phase 13** is unchanged.
- **The `lk-` prefix rename** (owner confirmed 2026-10-21: old names not read, nobody has notes with Lab Kit blocks yet; not built) should get its own plan and land before C6, so the new processors and the renamed ones are one set of names, and before the release (otherwise `raft` / `recipe` blocks ship under names that are dropped one release later). It touches every block processor, kit template and test; it is not part of this plan.
- Size: C1-C10 + CF = 11 sessions (interpretation); against 1 session for a built-in Recipe. With one side session at a time (owner, 2026-10-21) this adds about 10 sessions before the release if CQ3 = a or c.

## Risks
- **Language creep** to reach RAFT byte for byte: the stop rule (more than the six listed quirks → stop and ask).
- **A changed definition re-computes old notes:** the `#` lines are the record; the block says the definition changed and only Update rewrites them (CQ5).
- **Format freeze:** once own definitions are read, format 1 must be read forever; kit-only first (CQ3) keeps it changeable for one release.
- **Two Mn's:** the built-in RAFT and the definition RAFT could drift; C4 / C5 compare them on every case, and CQ8 decides when one goes.
- **Names read as cells** (`dp1`) and upper-casing: refused at check time with a sentence.
- **Obsidian rewriting the header:** the rows are in a code block (CQ1 a); the header holds only `fields:` as today.
- **Performance:** bounded by the limits; definitions parsed once per change, not per draw.
- **The `lk-` rename** turns any old-named block into plain code; the owner says nobody has such notes yet (2026-10-21). Outside this plan; the changelog still names the new block names.

## Verification
- Outside reference: the built-in RAFT block (P9) for every text and view case; the 0005 known answer Mn = 19990.14 (reported, CLAUDE.md); the mock-up's R-C weighed estimate 19 963 g/mol and its Recipe numbers (derived by a saved script before C8's code).
- Saved fixtures for both version lines, never regenerated from the writer.
- obsidian-check light / dark / 390 px / `--mobile` per UI phase; crops compared with the built-in block and the approved Solution prep picture; the owner via checklist 6i rows.
- The owner's RAFT Excel sheets (C4; `my_work/private/raft-excel/`): every formula expressible, its numbers reproduced (copolymer case per CQ10).
- Literature, read 2026-10-21 (reported): Perrier, *Macromolecules* 2017, 50, 7433-7447 (owner's copy): eq 3 gives Mn,th = [M]0·p·M_M ÷ ([CTA]0 + 2f[I]0(1 − e^(−kd·t))(1 − fc/2)) + M_CTA and eq 4 its practical form [M]0·p·M_M ÷ [CTA]0 + M_CTA (p. 7440); livingness L = [CTA]0 ÷ ([CTA]0 + 2f[I]0(1 − e^(−kd·t))(1 − fc/2)) (eq 2, p. 7435); CTA : initiator typically 5-10 (p. 7440). Lab Kit and the owner's sheet use eq 4 at p = 1. A future "livingness" line in the RAFT definition would need f, kd (or the initiator's 10 h half-life temperature) and time: owner question CQ21.
- Literature (web search 2026-10-21, secondary sources only): the theoretical Mn used here, DP × mean repeat-unit MW + MW of the CTA, is the standard RAFT form at full conversion, Mn,th = ([M]0 / [CTA]0) × conversion × M_monomer + M_CTA, which assumes initiator-derived chains are negligible (a high CTA : initiator ratio); a copolymer's repeat-unit MW is the mole-fraction-weighted mean.
- 0005 / 0011 guards every phase.

## Open questions (paste into BACKLOG "Questions for the owner"; rec. = recommended)
See the session report; the same list:
- **CQ1 Where a block definition sits in the snippet file:** (a, rec) questions in the header as today, rows and layout in a ```` ```lk-definition ```` block in the body (Obsidian never rewrites it; the plugin draws a check report under it) / (b) everything in the header (nested properties; Obsidian's property editor may rewrite them) / (c) a separate definition file (`.json` in Extras).
- ~~CQ2 Tag~~: answered 2026-10-21, (a) one ```` ```lk-block ```` with `use: <name>` ("This seems sensible").
- **CQ3 When it ships:** (a) everything before the release, own definitions included / (b) Recipe built-in now (Templater Phase 10), definitions after the release / (c, rec) before the release but kit-only (the Recipe ships as a kit definition; own definitions are read from the next release, so format 1 can still change).
- **CQ4 Combined results (S-B):** the `grouped` look is in the layout menu (decided); the question is its data: (a, rec) the Results block stays built-in (Templater Phase 11), because it looks values up in the note's method tables, which the row language does not do / (b) a second kind of definition ("look-up table" from the note's tables) later / (c) add that kind now.
- **CQ5 A definition changed after blocks were made with it:** (a, rec) the block draws with the new definition; when its `#` lines no longer match it says so and offers Update (rewrites the `#` lines only) / (b) refuse to draw until Update / (c) say nothing.
- **CQ6 Limits:** (a, rec) 50 rows, 30 items in a repeated row, 200 named values, 300 characters per formula, 32 KB per definition, no reading of the note's other tables in v1 / (b) looser.
- ~~CQ7~~ answered (a); ~~CQ8~~ answered (b), 2026-10-21.
- ~~CQ3~~ answered (c); ~~CQ6~~ answered (a), 2026-10-21.
- **CQ5 detail, what counts as a change:** (a, rec) Lab Kit re-works the `#` lines with the current definition and the chemical notes' current MW and flags the block only when they come out different: comments, spacing, titles and labels never flag; a formula edit that gives the same numbers does not flag either; the head line says which changed (definition or a MW) / (b) a fingerprint of the definition's maths (values, rows, look-ups, formats), flagged even when the numbers are the same / (c) a fingerprint of the whole definition text (every edit flags). And how the old maths stays visible: (a, rec) a dated copy of the old definition is kept when it changes (like rig snapshots) and the head line links to it / (b) the formulas written as `#` lines in every block / (c) name and date only.
- **CQ12 Trying own definitions before they are open:** (a, rec) a setting "Try my own block definitions (test: the format may still change)", off by default, so the owner can test alternative snippet designs now; those drafts become test fixtures / (b) no switch: own definitions wait for the next release.
- **CQ13 Filtering suggestions by property:** today `suggest: chemicals` filters by Chemical class only and `suggest: notes` by folder only. (a, rec) add `where:` with simple tests on the note's properties (`Acid / base: acid`, `Purity: set`, `Kind: stock`), any number of them, all must hold / (b) class and folder only.
- **CQ14 Solution prep by mass or by volume:** (a, rec) one snippet, a `select` question (by mass / by volume) and `when:` rows for what differs, while the two methods share most rows; split into two snippets only when the rows mostly differ / (b) always one snippet per method. And whether Solution prep becomes a definition at all: (a) yes, with a named plugin function for the pH solve (above) / (b, rec) not in v1: it stays built-in, its look is the `steps` layout.
- **CQ15 Method notes (NMR, GPC, … in the Methods folder):** they are properties notes (`Columns`, `Results`, `Machines` …) with their own small formula form (`{Other column}`), and they need no change for this plan. (a, rec) leave them as they are now; one syntax page explains both; aligning the formula naming later is a BACKLOG item / (b) align the formula naming in this plan / (c) make a method a kind of definition.
- ~~CQ5 detail~~ answered (a) 2026-10-21: flag only when the re-worked `#` lines differ.
- **CQ16 Merging snippets that are one menu entry** (owner: "If they are called by the same snippet menu option, they should have the same file"): (a, rec) one file per menu entry, alternatives as a `select` question with `when:` rows: Solution prep by mass / by volume first; candidates to look at, one by one with a picture: RAFT and Recipe by equivalents (RAFT is equivalents relative to the monomer: CTA = 1/DP, initiator = 1/(DP × ratio)), Sample list / Sampling timetable / Variant naming matrix (all make sample-code tables), Flow column prep / Residence times / b) only Solution prep now, the rest left as separate entries.
- **CQ17 Solution prep's pH as a formula:** measured 2026-10-21 (derived, script in the session note): the closed-form weak-acid formula that leaves out water's own ions, pH = −log10((−Ka + √(Ka² + 4·Ka·C)) / 2), equals the exact solve to 4 decimals from pH 3 to 5 (fixture 3.9852 both), is 0.004 off at pH 6 and 0.045 off at pH 6.5. (a, rec) a plugin function `PH_ACID(c, pKa)` that does the exact solve (fixed code, tested, same answer everywhere), so Solution prep can be a definition / (b) the closed formula in the definition, with a warning line above pH 6 / (c) Solution prep stays built-in.
- **CQ18 Several-ingredient chemicals (stock solutions, pre-mixes) now or later:** no users yet, so the chemical-note format can still change freely. (a, rec) design the `components` format now, in the chemical-database session (card below), and put it into definition format 1 if it is ready before Phase C3; else format 2 / (b) later, as format 2.
- **CQ19 Chemical properties visible in the note** (properties are hidden everywhere): (a, rec) a Lab Kit block in the chemical template that draws the note's own filled-in properties as a table, with an Edit / Add property button (writes through `processFrontMatter`, so everything else keeps reading the same properties) / (b) Meta Bind fields / (c) nothing; open Properties when needed. Looks on a feedback page first; part of the chemical-database session.
- **CQ20 Snippet headers are front matter** (so they are note properties of the snippet files and show in property search / Bases; Obsidian keeps one type per property name for the whole vault): checked in the front-matter survey session (card below); options there.
- **CQ21 RAFT livingness line** (Perrier eq 2): (a) later, needs initiator data (f, 10 h half-life temperature) in chemical notes / (b) not wanted.
- **CQ22 Longer help text:** (a, rec) `hint:` (always shown, one line) plus an optional `help:` (shown when the (i) is tapped; works on a phone, unlike a hover tooltip) / (b) `hint:` only. Look on the CF feedback page.
- ~~CQ10~~ answered (a), ~~CQ11~~ answered (no box; obvious hint), 2026-10-21.
- ~~CQ23~~ answered 2026-10-21 (see Decided). Was: **CQ23 Where kit snippets live:** (a) as now, built into the plugin and updated with it / (b, rec) the plugin ships only the core snippets (Solution prep, Recipe, Samples, methods); the rest (RAFT among them, as the owner's own) sit in a `snippets/` folder of the GitHub repo that anyone can copy, outside the build / (c) all snippets outside the build.
- **Functions a definition may call besides the calc ones** (CQ17 follow-up): only `PH_ACID` / `PH_BASE` (charge balance, first pKa) need a solve; everything else met so far has a closed form (dilution, molarity ⇄ wt% with density, equivalents, solids, Henderson-Hasselbalch, initiator kd = ln 2 ÷ t½, livingness, conversion from NMR integrals). Possible later: polyprotic pH, copolymer composition drift (Mayo-Lewis / Skeist), both solves.
- **CQ24 Token-template snippets as live blocks?** (a, rec) keep Sample list / Sampling timetable / Variant naming matrix, Residence times, Blank calc table as calc tables (the typed table is the record and other snippets read its `codes:`); Flow column prep is a weighing record (empty, packed, packed + solvent → reactor volume, the 0011 known answer 1.7591 mL) and is the one candidate for a live block, later, as a definition; Rig follows its own plan / (b) make all of them live / (c) none.
- **CQ10 Copolymer mass when fractions differ:** (a, rec) keep Lab Kit's mole-fraction-weighted mean MW (the masses add up to the mass typed; Mn unchanged) and note in the docs that the old sheet's plain average gives smaller masses / (b) copy the sheet's plain average (same numbers as the sheet, but the monomer masses no longer add up to the mass typed).
- **CQ11 `Init eq`** (NMR standard not wanted): the sheet's initiator mol = CTA mol ÷ (CTA:Init ÷ Init eq), so `Init eq` only scales the ratio (CTA:Init 10 with Init eq 2 = CTA:initiator 5); it lets one ratio be typed as two numbers (e.g. 20 : 1). (a) add it (default 1) / (b, rec) leave it out: CTA : initiator alone already says it, and one box cannot be misread (old generator and P9 block). Also note: the old calc-table generator already used the weighted mean MW (`labSnippets.js:337-338`, SUMPRODUCT), so only the Excel copolymer tab differs (CQ10).
- **CQ9 New question types for every snippet:** (a, rec) `toggle`, `select` with `options`, and `list` with `weights: fraction` (the RAFT monomer box) for token templates too / (b) only inside block definitions.
- Looks (not asked here, feedback page in Phase CF): the check report under ```` ```lk-definition ````; the "worked out with an older definition" line with Update.
