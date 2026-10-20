# Plan: Solution prep as a live block, acid for a target pH, chemical note fields (roadmap N4)

> [!info] PLAN ANSWERED 2026-10-20, partly waiting for a look
> Written 2026-10-20 by `/phase-plan` (Opus, overnight; nothing built, no code changed). The owner answered Q1-Q12 in chat on 2026-10-20 (see **Answered 2026-10-20** below; recorded in `docs/decisions.md`) and added three things: reagents can be a molarity (`Concentration`), blocks keep a format version, and the SDS script is a separate item. Phases 1-5 and 7 can be built as written. **Phase 6 still needs a feedback page first** (Q11), the L1 window is tried after Phase 5, and new warning / error lines are shown as crops before the owner OKs them. Each phase = one session, Sonnet.

## Goal
Alt+S → Solution prep puts a live ```` ```solution ```` block in the note: the set-up and the actual masses are stored as plain text in the block, the plugin works out the targets and draws numbered steps with Target / Actual columns you fill in at the bench, so leaving midway loses nothing. First use: an acid solution for a target pH (one step, by mass), with the reagent's purity, density, pKa and acid / base kind read from its chemical note.

## What is there today (read 2026-10-20)
- Solution prep = `kits/lab/Templates/Snippets/01 Solution prep.md` (header `run: solution`, group Make up) → `labSnippets.js:227` `solution()`: a form (solutes, solvents, final volume, own targets or a ratio, M / mg/mL / g) and two ```` ```calc ```` tables by **volume** (`labSnippets.js:249-271`). Run without Templater through `src/kit/snippet-insert.ts:64` and `snippet-run.ts:28` (`CALCULATORS`).
- The question window `src/kit/snippet-form.ts` already opens under the cursor on desktop (`openSnippetForm` :226 → `cursorAnchor`, `src/planning/entry-window.ts:25`; centred on a phone). There is **no setting** for it (L6 asked for one).
- Live blocks: `calc` (`src/calc/render.ts:69`; cell edit → `writeCell` :495 → `vault.process` + `writeCellText`, `src/calc/rewrite.ts:132`; `holdScroll` / `restoreScroll` :416-443; redraw on `vault.on("modify")` :80). Simpler processors: `rig` (`src/rig/render.ts:16`), `lab-header`, planning blocks (`src/planning/blocks.ts:41`, writes through `vault.process` :547). Calc CSS is `lab-kit-*` on plain `<table>` elements (`styles.css:24-25` resets `width` / `margin`, so vault `table` rules reach them).
- Chemical notes: `kits/lab/Templates/Chemical database template.md` has `Molecular weight` and `Density`; **no Purity, pKa or acid / base property anywhere** in `kits/`, `src/`, `tests/`. MW is read by name list + the `mwProperty` setting (`src/calc/render.ts:90-103`); chemical folder setting `src/kit/ui.ts:297`; `listChemicals` `src/chem/index.ts:72`.
- Close experiment (I24) prints the note through `MarkdownRenderer.render` (`src/close/pdf.ts:78`), so code block processors draw in the PDF; it waits only for `.block-language-calc table` (:80-84). The note is never changed (no freeze, decision 2026-10-19).
- Known answers (guards, re-run every phase): 0005 RAFT Mn = 19990.14 (`tests/snippets.test.ts:149`), 0011 reactor volume = 1.7591 mL (`tests/calccraft-compat.test.ts:68-72`).

## Decisions taken (owner, 2026-10-19; not re-asked)
- Everything by mass. The acid solution is made in **one step** on a **4-figure balance (0.1 mg)**: acid first, then water to the final mass; about **50 % or more of the aqueous phase** is acid solution (mock-up: 60 % share, 50 % of the made solution used).
- The model is Sigma's acids-and-bases calculator (pick a concentrated reagent whose wt% and density are known), not the molarity / molality converter; the block gives a mass to weigh.
- L1 set-up window at the cursor: built, then adjusted after the owner has tried it. L2 (block with steps, `my_work/reference_visual/solution-live-block.png`) approved. L3 plain text in the note, the plugin does the processing. L4 and L5 fine as shown. L6 (all snippet forms at the cursor) behind a setting; calc-table snippets stay plain ```` ```calc ```` blocks.
- Own scoped CSS classes: the block must not pick up the vault's table styling.
- Reagent fields live in the chemical notes (L5: `Purity`, `Density`, `pKa`, `Acid / base`; owner 2026-10-20: also `Concentration`); a missing value is asked once and written to the chemical note (Q7).
- Owner 2026-10-20: a reagent comes either as a **wt%** (`Purity`) or as a **molarity** (`Concentration`, mol/L), never both in one note; the block shows which one it used (see Phase 2).
- Owner 2026-10-20 (Q1, Q2): the live block IS Solution prep; the old volume table leaves the menu but still runs from a kept copy; the closed-experiment PDF draws the L4 table from the block's values.
- Not part of this plan: the SDS-to-chemical-database script (fills Purity / Concentration / Density / pKa from safety data sheets). Separate plan; the owner's own script is still not in `my_work/private/` (BACKLOG item, owner to copy it).

## Technical choices (no owner decision needed; say if wrong)
- New folder `src/solution/` (pure maths, block text, view model, renderer), its own processor `solution`; the calc engine is not touched.
- The block is drawn with `div` rows (`role="table"` / `row` / `cell`), not `<table>`, under `.lk-sol` with `.lk-sol-*` classes, so vault snippets that style `table` / `td` do not reach it. Corners from `--lk-radius-*` (`docs/design-standard.md`).
- The block text is a small line format (as L3): `key: value`, two-space nesting, values with units (`g`, `mg`, `kg`, `%`, `mL`). Our own tolerant parser; a write changes only the one line it edits (no YAML re-dump), so hand edits and comments survive.
- Chemistry (acid for pH): weak monoprotic acid from the charge balance `[H+] = C·Ka/(Ka+[H+]) + Kw/[H+]`, so `C = ([H+] − Kw/[H+])·(Ka+[H+])/Ka`; strong acid `C = [H+] − Kw/[H+]`; bases the same on `[OH−]` (if Q6 = A). Estimated pH from the actual masses solves the same balance (bisection on log [H+], no iteration limits hit). Concentration per Q3. Acid to weigh = moles × MW ÷ (Purity / 100). The ± from the balance = pH at acid mass ± readability. Bottle molarity (Sigma-style) = wt%/100 × density × 1000 ÷ MW. `Density` in a chemical note is the stored value as it is today (g/mL) for wt% reagents; for a **molarity** reagent the block needs moles per gram of liquid = `Concentration` ÷ (density × 1000), and for a wt% reagent = `Purity` ÷ 100 ÷ MW (the two are the same quantity, so the rest of the maths is one code path: grams to weigh = moles ÷ moles-per-gram). Mol/kg is treated as mol/L with an asterisk (Q3).
- Estimated pH uses the actual values typed so far and the targets for the rest (as the mock-up: 3.99 after step 1).

## Block format version (rule, owner 2026-10-20; applies to every live block, also `docs/decisions.md`)
Blocks are stored in the user's notes, so they must keep reading after future plugin updates.
- The first line of every ```` ```solution ```` block carries a format version (`format: 1`). A block without it is read as version 1.
- The plugin always reads every older version it ever wrote. A change of the format ships **together with** a reader (migration in memory; the note is rewritten only when the user edits the block) for the old version and **a test on a saved old note** (fixture kept in `tests/fixtures/solution/`, never regenerated from the new writer).
- A block with a **newer** version than the plugin knows is not drawn or edited: it shows "made with a newer Lab Kit: update the plugin" and its text is left untouched.
- Phase 1 writes `format: 1` into `acid-ph4.md` and adds the test that reads the saved file; each later format change adds its own saved fixture.

## Out of scope
- The SDS script review (owner to copy it into `my_work/private/`; separate session).
- Two-step dilution chains (V2) and kept acid stocks (V3): owner does not work that way.
- The wt% ⇄ mol/kg ⇄ mol/L converter (not what the owner meant).
- Activity coefficients, buffers, salts, monomer effects: the block says "check with a pH meter" (approved caution text).
- Changing old Solution prep calc tables already in notes (they stay calc blocks and keep working).
- Building the SDS script (see above).
- Volumetric methods A, C, E, G (owner: almost never / not used).

## Phases

### Phase 1 — Maths and block text, pure (no UI)
- BUILT 2026-10-20 (Phase 1: `src/solution/acid.ts`, `block.ts`, tests `tests/solution-acid.test.ts` / `solution-block.test.ts`, saved notes `tests/fixtures/solution/`; not wired into the plugin; Check PASS; known answers matched).
- Files: `src/solution/acid.ts` (`acidConcForPH`, `pHFromConc`, `acidRecipe` = targets for step 1 and 2 from the set-up, `balanceRange`, `bottleMolarity`, `tooSmall` per Q4: acid mass < 10 × balance readability; returns the batch size that brings it to 10 ×; molarity reagents via moles per gram), `src/solution/block.ts` (`parseSolution(source)` → set-up + actuals with units; `writeActual(text, lineStart, key, value)` and `writeSetup(...)` that change one line only; `format: 1` line and the newer-version refusal (see **Block format version**); unit parse / format with the balance's decimals), `tests/solution-acid.test.ts`, `tests/solution-block.test.ts`, fixture `tests/fixtures/solution/acid-ph4.md` (the L3 source of the approved picture inside a note, with `format: 1`; a saved old-version note test reads it, per the format rule).
- Done when (known answers, derived by the script in **Appendix**, unreviewed): acetic acid (MW 60.05, Purity 99.7, pKa 4.76), aqueous 15.00 g, pH 4.00, share 60 %, use 50 % → C = 6.754 × 10⁻⁴ mol/kg, make 18.00 g of acid solution with **1.2205 mg** glacial acid (block shows 1.22 mg), add 9.00 g acid solution + 6.00 g water; with actuals acid 1.30 mg, water-to 18.0012 g and step 2 at target → **estimated pH 3.985** (shows 3.99); balance ±0.1 mg on the 1.22 mg target → pH 4.020 / 3.982; pH 4.5 needs 0.161 mg (below what a 0.1 mg balance weighs well: `tooSmall` true); bottle molarity acetic 99.7 % / 1.049 g/mL → 17.42 M, HCl 37 % / 1.19 → 12.08 M, NaOH 50 % / 1.52 → 19.00 M. Parse → write → parse round-trips the fixture byte for byte except the edited line; a hand comment line survives. 0005 / 0011 guards pass. `python3 scripts/check.py` PASS.
- New dependencies: none.

### Phase 2 — Reagent fields in chemical notes
- BUILT 2026-10-20 (Phase 2: template fields `Purity`, `Concentration`, `pKa`, `Acid / base` after `Density` (3d434c1); reader `src/solution/reagent.ts` `readReagent` / `isReagentNote` in the Phase 1 `Reagent` shape (c0ddae2), placed in `src/solution/` not `src/chem/`; tests `tests/solution-reagent.test.ts`, saved notes `tests/fixtures/solution/chemicals/`; Purity with Concentration = `conflict`; missing and unusable values listed, nothing guessed; no Chemical database base column added, so its look is unchanged; Check PASS; not seen in Obsidian). Not built here: `reagentList` for the picker, the "use one" line and the "from 99.7 wt%" text (Phase 3), asking and saving a missing value (Phase 4).
- Depends on: none (can run before or after Phase 1).
- Files: `kits/lab/Templates/Chemical database template.md` (add `Purity:`, `Concentration:`, `pKa:`, `Acid / base:` after `Density:`; then `npm run kit:manifest`), `src/chem/reagent.ts` (pure `readReagent(frontmatter, mwProperty)` → `{ mw, purity, concentration, density, pKa, kind }` with the same MW name rules as `calc/render.ts:90-103`, numbers parsed from text like `99.7 wt% (glacial)`; `missingFor(reagent, need)`; `reagentList(entries)` = chemical notes with `Acid / base` set, for the picker), `tests/chem-reagent.test.ts`, docs (vault spec of chemical notes, `docs/snippet-syntax.md` if it lists chemical properties).
- Done when: tests read the three L5 examples (acetic acid, HCl 37 %, NaOH 50 %) and one molarity reagent (e.g. 1.00 mol/L stock with its density) from fixture front matter; `Purity` and `Concentration` together in one note is an error line ("use one"); the block states which it used ("from 99.7 wt%" / "from 1.00 mol/L"); a molarity reagent with no `Density` is asked once and saved (as Q7); a note without `Purity` reads as 100 % only when the owner picks that (else `missing`, asked once and saved: Q7 A); an existing chemical note is not changed by Review update… (the template only affects new notes). Check PASS.

### Phase 3 — The live block, read only (L2)
- BUILT 2026-10-20 (Phase 3: `src/solution/view.ts`, `render.ts`, `.lk-sol-*` in `styles.css`, registered in `src/main.ts`; `tests/solution-view.test.ts` with saved notes `acid-ph4-half.md` (the picture's state) and its expected text; checked in a throwaway Obsidian light / dark / 390 px / with a hostile `table td` style, crops in `my_work/analyses/n4p3/`; not seen by the owner). Not built: the Edit set-up button and `click to enter` (Phases 4-5), the Q4 warning line (Phase 5). New wording asked in BACKLOG.
- Depends on: Phases 1-2 (Q2, Q3, Q5, Q6 answered: A). Mol/kg shown as mol/L carries an asterisk marker on the value with a short note that it is an approximation: that asterisk text is NEW wording, shown as a crop for the owner's OK when built. Bases (Q6 A): the Acid / base field decides, title "Base solution for pH …".
- Files: `src/solution/view.ts` (pure view model: title, status `in progress · step n of m` / done, summary line, steps with rows Target / Actual, estimated pH line, caution, errors such as `no note called "…"` or `"Acetic acid" has no pKa`), `src/solution/render.ts` (`registerMarkdownCodeBlockProcessor("solution", …)`, redraw on modify like `calc/render.ts:80`), `src/main.ts` (register), `styles.css` (new `.lk-sol-*` section; Obsidian CSS variables only), `tests/solution-view.test.ts`, `tests/solution-render.test.ts` (DOM: no `table` element, classes scoped).
- Done when: the fixture note draws as in `my_work/reference_visual/solution-live-block.png` frame 2 (same texts, numbers 1.22 mg, 18.00 g, 9.00 g, 6.00 g, 3.99, ±0.02, the green bar on the finished step), checked with `node scripts/obsidian-check.mjs` in light and dark with a vault CSS snippet that styles `table td` (it must not change the block); console errors []. Not seen by the owner → checklist 6i row.

### Phase 4 — Typing the actual values in place
- BUILT 2026-10-20 (Phase 4: `src/solution/edit.ts` (`actualText`, `nextCell`, `cellsOf`), `ask-reagent.ts` (`askReagent`, `reagentQuestions`, `reagentValues`, `noteKey`), `render.ts` (click an Actual cell, Enter / Tab / Shift+Tab / Esc, `writeActual` through `vault.process`, scroll held, the next cell opens also in the copy Obsidian draws after the note changed, not in the hidden Live Preview / Reading copy), `view.ts` (row `field`, `ask` / `askLines`, Q12 wording on the missing-property line), `.lk-sol-input` etc. in `styles.css`; `tests/solution-edit.test.ts`; seen in a throwaway Obsidian in Reading view and Live Preview, light and dark, crops in `my_work/analyses/n4p4/`; not seen by the owner). New wording asked in BACKLOG.
- Depends on: Phase 3.
- Files: `src/solution/render.ts` (click an Actual cell → input; Enter saves and moves to the next empty Actual, Tab / Shift+Tab move, Esc cancels; save = `vault.process` + `writeActual`, located by `ctx.getSectionInfo`, scroll held like `calc/render.ts:416-443`), `src/solution/ask-reagent.ts` (a missing Purity (or Concentration) / Density / pKa / Acid / base / MW is asked once (Q7 A) in the question window and written to the chemical note with `fileManager.processFrontMatter`), `tests/solution-edit.test.ts`.
- Done when: typing 1.30 mg then 18.0012 g in the fixture writes exactly the L3 lines `acid: 1.30 mg` and `water-to: 18.0012 g` (nothing else in the note changes, byte check); the status chip moves to step 2 of 2 and the estimated pH to 3.99; a number with no unit takes the row's unit; a hand edit in source view redraws the block; checked in a throwaway Obsidian (desktop + phone emulation).

### Phase 5 — Set-up window (L1), Alt+S and Edit set-up
- BUILT 2026-10-20 (Phase 5: `src/solution/setup-text.ts` (pure: boxes ↔ block lines, `setupLines`, `solutionBlock`, `setupChanges`, `reagentRow`), `setup.ts` (the window, `reagentChoices`), `render.ts` (`Edit set-up`, one `vault.process` with `writeSetup` per changed line), `view.ts` (`warning`, Q4 / Q12 wording), `snippet-run.ts` (`run: solution` = the live block; `solution-volume` = the old volume form through labSnippets `solution`), setting `snippetFormsAtCursor` (L6, ON by default), `tests/solution-setup.test.ts`, saved note `tests/fixtures/solution/acid-ph4-fresh.md`; `tests/snippet-run*.test.ts` / `snippet-form-audit.test.ts` moved to the new Solution prep with the old form checked as `solution-volume`; seen in a throwaway Obsidian desktop light / dark and phone width, crops in `my_work/analyses/n4p5/`; not seen by the owner). The kit file `01 Solution prep.md` is unchanged (still `run: solution`), so no kit manifest change; Review update… is not needed. Not built: Phase 6 (`+ Solute` is disabled), Phase 7 (PDF table). New wording asked in BACKLOG.
- BUILT 2026-10-20 (Phase 5 follow-up, owner answers Q15 and Q17 A; tests only, not seen in Obsidian): field labels lighter (`.lk-sol-setup .lk-form-label`); the Reagent dropdown shows the name only, `99.7 % · pKa 4.76` (`reagentDetail`) in a small line under it; the `Method: by mass` chip opens a menu (`by mass` default, `by volume`) only in Alt+S (`SetupInit.methods`); by volume closes the window and `run: solution-volume` runs as before (`SetupAnswer.method`, `snippet-run.ts` `solutionBlock`).
- Depends on: Phase 4; Q1 answered (A-ish: the live block IS Solution prep).
- Files: `src/solution/setup.ts` (the L1 window at the cursor in the entry-window look: chips `Method: by mass`, `Acid for pH`, `+ Solute` (disabled until Phase 6), fields Aqueous phase, Target pH, Reagent (picker from `reagentList`, rows like Sigma's list: name · wt% · pKa), Share as acid solution, Share you use, Balance; Enter inserts, Esc closes), `src/kit/snippet-run.ts` / `snippet-insert.ts` (a `run:` key that inserts the block instead of calling `labSnippets.js`), `kits/lab/Templates/Snippets/01 Solution prep.md` (now inserts the live block; the old volume generator leaves the menu and still runs from a kept copy, so old copies and `labSnippets.js:227` keep working; then `npm run kit:manifest`), `src/solution/render.ts` (Edit set-up reopens the window filled in and rewrites only the set-up lines), tests for the inserted text and the Edit round trip.
- Done when: Alt+S → Solution prep with the L1 values inserts the fixture's source (empty actuals) at the cursor; Edit set-up with pH 4.50 rewrites `target-pH: 4.50` only and the Q4 warning (acid < 10 × balance readability, with a larger batch size suggested) shows; `tests/snippets.test.ts:75-84` (old Solution prep) is changed to the new Solution prep (the old volume form is moved to a test of the kept copy); 0005 / 0011 guards. Then the owner tries L1 and says what to adjust (owner rule: built first, adjusted after).

### Phase 6 — Solution by mass with solutes (methods D / B / F)
- Depends on: Phase 5; **a feedback page with 2-3 looks for this block first** (`my_work/agent_kit/render_check.py feedback`, Q11 yes), owner's pick; Q9 A (solvent target stays, a second line when the solid is more than 5 % off), Q10 A (approximate mol/L from the densities, marked as an estimate). Warning / error lines are shown as crops first.
- Files: `src/solution/bymass.ts` (targets from wt% or mol/kg or target mass per solute, ratio by mass or by moles, solvent(s) by mass; actual wt% and mol/kg from the actual masses; ≈ mol/L per Q10), `src/solution/view.ts` / `block.ts` (the `solutes:` / `solvents:` keys of the picked look), `src/solution/setup.ts` (`+ Solute`), tests with a by-mass fixture (e.g. 20 wt% monomer, 3.000 g total) and a ratio fixture (molar 200 : 1 : 0.2, checked against the masses of the old ratio table for the same moles).
- Done when: known answers worked out by a saved script before coding, both fixtures pass, the picked look matches the owner's choice in a throwaway Obsidian.

### Phase 7 — L6 setting and the closed-experiment record (L4)
- Depends on: Phase 3 (L4), none for L6. Q2 A: the PDF draws the L4 table from the block's values, the note is unchanged. Q8 A: the setting is ON by default.
- Files: `src/kit/paths.ts` + `src/kit/ui.ts` (setting "Open snippet forms at the cursor", default ON (Q8 A), in the Snippets group), `src/kit/snippet-form.ts` + `src/solution/setup.ts` (pass no anchor when off), `src/close/pdf.ts` (wait for `.block-language-solution` too; print layout), `src/solution/render.ts` (inside `.lk-close-host` draw the L4 single table: Step / What / Target / Actual + Estimated pH, `(as made on <date>)`), tests (`close-pdf.test.ts` extended, settings test), docs: changelog, `docs/snippet-syntax.md` section on ```` ```solution ````, tutorial, architecture (`src/solution/`), checklist 6i rows.
- Done when: a closed made-up note's PDF shows the L4 table with 1.30 mg / 18.0012 g; the note file is byte-equal before and after closing; the setting off opens the forms centred; check PASS.

Order check: 1 and 2 are independent pure work; 3 needs both; 4 needs 3; 5 needs 4 (Edit set-up writes through the same line writer); 6 needs 5 (the window's `+ Solute`) and an owner pick; 7's L6 part could go any time, its L4 part needs 3. Each phase updates the docs it touches (`docs/maintenance.md`) and commits after each change.

## Answered 2026-10-20 (owner, chat; also `docs/decisions.md`)
- **Q1** A-ish: the live block IS Solution prep; the old volume table leaves the menu (still runs from a kept copy).
- **Q2** A: the closed-experiment PDF draws the L4 table from the block's values; the note is unchanged.
- **Q3** A: mol/kg treated as mol/L, with an asterisk / marker on the shown value saying it is an approximation (asterisk text is new wording: crop for the owner's OK).
- **Q4** A: warn when the acid mass is under 10 × the balance readability and suggest a larger batch size.
- **Q5** A: first pKa only.
- **Q6** A: the same block handles bases (the acid / base field decides).
- **Q7** A: ask once for a missing Purity and save it to the chemical note.
- **Q8** A: the L6 setting "Open snippet forms at the cursor" is ON by default.
- **Q9** A: solvent target stays as planned; a second line when the solid is more than 5 % off.
- **Q10** A: also show approximate mol/L from the densities, marked as an estimate.
- **Q11** yes: the by-mass solutes block goes on a feedback page first; the L1 window is tried after Phase 5; warning / error lines come as crops first.
- **Q12** take the plan's wording and adjust after the owner sees it: `Acid to weigh is small for your balance (±… %): make … g and use … %.`; `"<note>" has no <property>: type it once, it is saved in the chemical note.`; `First pKa used.`; setting "Open snippet forms at the cursor" with description "Off: forms open in the middle of the window.".
- **New: reagent as a molarity.** A chemical note holds EITHER `Purity` (wt%) OR `Concentration` (mol/L), plus `Density`. Moles per gram of liquid = M ÷ (density × 1000) for a molarity reagent; Purity ÷ molar mass for wt%. A missing density for a molarity reagent is asked once and saved (as Q7). The block shows which it used. (Phases 1-2.)
- **New: format version.** Section **Block format version** above (also a general rule for live blocks in `docs/decisions.md`).
- **New: SDS-to-chemical-database script.** Separate script / plan that fills Purity / Concentration / Density / pKa from safety data sheets; not part of N4 (BACKLOG item: plan needed, owner to copy the script into `my_work/private/`).

## Verification
- Known answers above (Appendix script, re-runnable) are fixed in tests before any UI; the mock-up's own numbers (1.22 mg, 3.99, ±0.02, 17.4 M) match them, which is an outside check of the maths against the pages the owner saw.
- Each UI phase: throwaway Obsidian (`obsidian-check`), light and dark, phone emulation, with a vault CSS snippet styling `table` to prove the scoped classes; compared with `solution-live-block.png`. Owner checks via checklist 6i rows.
- A real pH-meter reading of one made solution (owner, optional) is the only check of the chemistry against the bench; not part of "done".

## Appendix: known-answer script (derived; re-run with `python3 -`)
```python
Kw = 1e-14
def conc_for_pH(pH, pKa, strong=False):
    h = 10**-pH; Ka = 10**-pKa
    return h - Kw/h if strong else (h - Kw/h)*(Ka + h)/Ka
def pH_of(C, pKa, strong=False):
    Ka = 10**-pKa; lo, hi = -14.0, 0.0
    for _ in range(200):
        m = (lo + hi)/2; h = 10**m
        f = h - (C if strong else C*Ka/(Ka + h)) - Kw/h
        lo, hi = (lo, m) if f > 0 else (m, hi)
    return -m
MW, pur, pKa = 60.05, 0.997, 4.76
aq, share, use = 15.00, 0.60, 0.50
C = conc_for_pH(4.00, pKa)                      # mol/kg taken as mol/L (Q3 A)
sol_in = aq*share; made = sol_in/use
acid_mg = C*aq/1000*MW*1000*(made/sol_in)/pur
print(C, acid_mg, made, sol_in, aq - sol_in)    # 6.754e-4, 1.2205, 18.0, 9.0, 6.0
C2 = (1.30*pur/1000/MW)*(sol_in/18.0012)/(aq/1000)
print(pH_of(C2, pKa))                           # 3.985
for d in (-0.1, 0.1):
    t = acid_mg + d; print(pH_of((t*pur/1000/MW)*(sol_in/made)/(aq/1000), pKa))  # 4.020, 3.982
print(conc_for_pH(4.5, pKa)*aq/1000*MW*1000*(made/sol_in)/pur)  # 0.161 mg
for w, rho, M in ((99.7, 1.049, 60.05), (37, 1.19, 36.46), (50, 1.52, 40.00)):
    print(w/100*rho*1000/M)                     # 17.42, 12.08, 19.00
```
