# Plan: Chemical database, next step: components (stock solutions, pre-mixes), a visible properties view, other uses

> [!warning] PLAN WAITING FOR OWNER
> Written 2026-10-21 (Opus, side session of the custom-live-blocks plan; plan and research only, no plugin code). It answers custom-live-blocks **CQ18 a** (owner: design the components format now; it goes into definition format 1 if it is ready before that plan's Phase C3) and **CQ19** (properties visible in the note, render first). Looks are never decided here: three looks of the properties view are on a feedback page, `my_work/mockups/chemical-properties-looks.html` (private). Owner questions **CD1-CD14** are at the end, ready for BACKLOG "Questions for the owner".

**How each finding is backed** (one tag per line, as in `frontmatter-survey.md`):
- **measured**: checked in a throwaway Obsidian 1.14.4 (`node scripts/obsidian-check.mjs`, 2026-10-21); probe in the Appendix.
- **code**: read in this repo, with a `file:line` pointer.
- **derived**: printed by `docs/plans/chemical-components-known-answers.py` (re-run: `python3 -I -B docs/plans/chemical-components-known-answers.py`); labels `D1`…`D12` match the script's printed lines. All **unreviewed**.
- **web (read)**: a page fetched and read this session (through the fetch tool's page summary, so not word for word). **web (search only)**: seen as a search-result snippet, not read; treat it as a lead.
- **(interpretation)**: my reading of the findings it names.

## Short answer
1. **Where the parts live:** two flat list properties in the chemical note, `Components` (a list of links) and `Component amounts` (a list of texts like `22 %`, `30 ppm`, `0.02 mol/L`, `rest`), item *n* of one goes with item *n* of the other (CD1). Measured: a list of links keeps Obsidian's links (backlinks, rename updates), and both lists get Obsidian's normal List type (so a base can show them; not opened in a base); a link with text after it (`"[[C]] 22 %"`) is **not** a link and goes stale on rename; a nested list of maps keeps its links but shows as raw JSON (type *Unknown*).
2. **One rule for purity, stocks and pre-mixes:** a note with `Purity` (or `Concentration`) is a *substance*; a note with only `Components` is a *mixture*. "How much pure X is in 1 g of this?" is worked out recursively through the notes. Owner example: Solution A has C at 22 %, and C's own note says Purity 66, so pure C per g of A = 0.22 × 0.66 = **0.1452** (D1); 0.500 g of pure C needs **3.4435 g** of A (D1).
3. **Totals per ingredient** (acid from a stock *and* a pre-mix, MEHQ inside a monomer, surfactant in two pre-mixes) come from the same rule summed over every row of a block, so a block can show an **ingredient totals** table and top up one ingredient from a second source: (0.300 − 5.000 × 0.02) ÷ 0.10 = **2.000 g** of acid stock (D2).
4. **Definition language additions** (small, fits format 1): a `CONTENT(x)` look-up on a row, an `IN(row, x)` formula function, and a `balance:` key. Solves of several targets at once (D8) are left for later (CD8).
5. **Properties view:** a Lab Kit block in the chemical template (```` ```lk-chemical ````) that draws the note's own filled-in properties, with the components as a sub-table, and Add / Edit writing ordinary properties through `fileManager.processFrontMatter`. So every other reader (Solution prep, `MW()`, hazards header, the base) is unchanged. Three looks are on the feedback page (CD10). Meta Bind can bind fields, but only a fixed list per template, and it is a third plugin the kit is moving off (table in §3).

## What is there today (read 2026-10-21)
- Template `kits/lab/Templates/Chemical database template.md`: `Type`, `Names`, `Chemical class`, `H_Phrase` (list), `CAS-No.`, `Molecular weight`, `State at RTP`, `Boiling point`, `Melting point`, `Density`, `Purity`, `Concentration`, `pKa`, `Acid / base`. The body is empty (code).
- `kits/lab/05 Chemicals/Chemical database.base`: a table and a kanban by `Chemical class`, filtered to `05 Chemicals/Chemicals` (code).
- `src/solution/reagent.ts`: `readReagent` reads MW (`MW_KEYS` + the `mwProperty` setting, `:47-52`), `Purity` (0-100, `:73`), `Concentration` (mol/L; refuses mmol/mM units, `:74`), `Density` (g/mL; refuses kg/m³, `:75`), `pKa` (first number), `Acid / base` (`:54-59`). It takes the first number from a text such as `99.7 wt% (glacial)` (`:28-40`). Purity and Concentration together = `conflict` (`:83`) (code).
- `src/calc/render.ts:90-103`: `PROP` / `MW` read a linked note's front matter, names matched without regard to capitals, the user's MW name first (code).
- `src/solution/ask-reagent.ts:9`: a missing property is written under the template's name through `processFrontMatter` (code).
- `H_Phrase` is read by the hazards header (`src/header/hazards.ts:63`) and by the owner's own risk-assessment script (decision 2026-10-21, `docs/decisions.md:318`) (code).
- Front-matter rules (measured in `frontmatter-survey.md`, branch `claude/frontmatter-survey`): property names are one property whatever the capitals; one type per name across the vault; nested properties are type *Unknown* and drawn as JSON. No property called `Components` or `Component amounts` exists in `src/` or `kits/` (code, grep 2026-10-21), and neither equals another name apart from capitals (FM2).
- **Names:** this plan renames no existing property. Every new name here (`Components`, `Component amounts`, and the §4 candidates `SDS`, `Storage class`, `10 h half-life temperature`, `Activation energy`, `ln A`, `Efficiency`, `Tg of homopolymer`, `Monomer class`, `RAFT agent class`, `Volatile`) is a proposal: it follows the owner's answers to the survey's FM2 (no name equal to another apart from capitals; so no `Kind`), FM8 (`Names` / `aliases`) and FM9 (naming style, e.g. `H_Phrase`, `CAS-No.`), and is added to the survey's §1 chemical table when built.
- The owner's SDS-to-chemical-note tool (own repository, decision 2026-10-20) writes these notes too, so whatever format is chosen must be simple to write from Python (interpretation).

## 1. Components format (CQ18 a)

### 1.1 Where the parts live: measured options
Probe (Appendix A): six small notes in a throwaway vault, then `metadataCache.frontmatterLinks`, `resolvedLinks`, `metadataTypeManager.getAllProperties()`, and a rename of `C.md` → `C renamed.md` (Update links: Just once).

| Form | Links / backlinks | After renaming C | Obsidian type | Bases column (from the type) | Hand edit |
|---|---|---|---|---|---|
| **(a) two lists**: `Components: ["[[C]]", "[[D]]"]` + `Component amounts: ["22 %", "5 %"]` | yes (`Made of.0 -> C`) | **updated** | List + List | yes, both (List type; not opened in a base) | in Properties (chips) or source; the two lists must stay in step |
| (b) one list of text: `["[[C]] 22 %", …]` | **no** (no `frontmatterLinks`, no backlink) | **left stale** (`[[C]]` stays) | List | yes | easy, but the link is dead text |
| (c) nested: `Parts: [{chemical: "[[C]]", wt: 22}]` | yes (`Parts.0.chemical -> C`) | updated | **Unknown** (JSON) | no | source mode only |
| (d) Markdown table under `## Components` in the body | yes | updated | not a property | no | easy, visible without Lab Kit |
| (e) a ```` ```lk-components ```` code block | no (code is not scanned for links) (interpretation, not probed) | would go stale | not a property | no | easy |
| a list of numbers (`Made of wt%: [22, 5]`) | — | — | **Unknown** | no | — |

All measured except (e). Also measured: on the rename, Obsidian re-wrote the whole front matter of the note with the two lists and dropped the quotes (`- 22 %`), which is still valid YAML.

**Proposal (CD1 a):** (a). `Components` holds links only; `Component amounts` holds texts. Item *n* goes with item *n*. Reasons: links survive renames and give "used in" for free (backlinks); both are ordinary List properties (one type each, no clash), so a base can show and filter them (interpretation from the type; not opened in a base); Lab Kit reads them synchronously from the metadata cache like MW today; the Python SDS tool writes two plain lists. Its weakness is that the two lists can get out of step after a hand edit. The Lab Kit view edits both in one `processFrontMatter` call and shows a problem line when the lengths differ ("Components has 4 items, Component amounts 3"). Not measured: whether Obsidian's Properties chip editor merges two equal chips in one list (e.g. two components at `5 %`); this is checked in Phase CD-A, and if it merges them, (d) is the fallback.

### 1.2 What a chemical note says
- **Substance note**: has `Purity` (wt%) or `Concentration` (mol/L) or neither (= taken as 100 %, as today's ask-once rule). Its `Components`, if any, are *named minor parts inside the rest* (an inhibitor, water in a hydrate, a known impurity): they must add up to no more than 100 − Purity.
- **Mixture note** (stock solution, pre-mix): has `Components` and no `Purity` / `Concentration`. One item may be `rest` (the solvent: 100 % minus the others).
- `Purity` and `Concentration` keep their meaning, so `readReagent` and Solution prep do not change. A one-solute stock written as `Concentration: 1` stays valid. The same stock could also be written as a mixture (`[[HCl]] 1 mol/L`, `[[Water]] rest`); both read the same (§1.4).

Example notes (front matter only):
```yaml
# Solution A (owner example: C, D and E in solvent X)
Type: Chemical database
Chemical class: [stock solution]
Components:
  - "[[C]]"
  - "[[D]]"
  - "[[E]]"
  - "[[X]]"
Component amounts:
  - 22 %
  - 5 %
  - 0.5 %
  - rest
Density: 1.05
```
```yaml
# C (on its own, 66 % pure by mass)
Type: Chemical database
Molecular weight: 250.3
Purity: 66
```
```yaml
# Methyl methacrylate (a substance carrying its inhibitor)
Molecular weight: 100.12
Purity: 99
Components:
  - "[[MEHQ]]"
Component amounts:
  - ≤ 30 ppm
```
```yaml
# VA-044 stock (a molarity stock written as a mixture)
Components:
  - "[[VA-044]]"
  - "[[Water]]"
Component amounts:
  - 0.020 mol/L
  - rest
Density: 1.00
```

### 1.3 Amount texts (one per component)
| Text | Means (g of the component, as weighed, per g of this note's material) | Needs |
|---|---|---|
| `22 %`, `22 wt%`, `22 % w/w` | 0.22 | — |
| `30 ppm` | 30 × 10⁻⁶ (w/w) | — |
| `0.020 mol/L`, `0.020 M`, `20 mmol/L` | c × MW(component) ÷ (1000 × Density of this note) | the component's MW, this note's Density (asked once, as Q7) |
| `20 mg/mL`, `20 g/L` | (g/L) ÷ (1000 × Density) | Density |
| `5 % w/v` | 5 ÷ (100 × Density) | Density |
| `10 % v/v` | 0.10 × Density(component) ÷ Density(this note) | both densities |
| `rest` | 1 − the sum of the others (at most one per note) | the others in w/w terms |
| `by MW` | MW(component) ÷ MW(this note): a salt or a derivative counted as its parent (Restek's HCl-salt example: 0.635) | both MWs |
| `10-20 %`, `≤ 30 ppm` | a range, as an SDS gives it (CD6) | — |
| empty | not known: shown, never guessed | — |
`mol/kg` is not in the list: it can mean per kg of solution or of solvent (molality). It is refused with a line, as kg/m³ is today (CD2).

### 1.4 The one rule: content
`content(M, X)` = grams of **pure** X in 1 g of material M, as weighed:
- M is X itself (the same note, or the same `CAS-No.`, CD5): Purity ÷ 100 (or Concentration × MW ÷ (1000 × Density)), or 1 when neither is set.
- M has components: Σ over its items `amount_i (g/g) × content(component_i, X)`.
- Otherwise 0. Depth limit 6, a note met twice on one path = a cycle error. Both are shown as one line naming the notes.

Owner example (D1): content(A, C) = 0.22 × content(C, C) = 0.22 × 0.66 = **0.1452 g/g**. A target of 0.500 g pure C needs 0.500 ÷ 0.1452 = **3.4435 g** of A. That A also brings D **0.1722 g**, E **0.0172 g**, X **2.4966 g**, and **0.2576 g** of C's unnamed impurity (22 % × 34 %), all derived (D1).

**Which component is "the" one:** typically C is A's main component. Proposal (CD4 a): the first item of `Components` is the main one; a recipe can name any other ("A for 3 mg of E"). Other ways looked at: a `Main component` property (one more name) or always asking.

### 1.5 One ingredient from several sources, at several stages
The block keeps, for every row, the material (a chemical note) and the mass (actual if typed, else target). The **ingredient totals** of the block are, for every ingredient X met anywhere in the trees: Σ rows `mass_row × content(material_row, X)`, as grams and wt% of the block's total. Unnamed parts (C's 34 %) show as "other (from C)".
- **Acid from a stock and from a pre-mix** (D2): pre-mix P (surfactant 10 %, acid 2 %, water rest) is fixed at 5.000 g for its surfactant; the acid target is 0.300 g, so stock S (acid 10 %) tops it up: (0.300 − 5.000 × 0.02) ÷ 0.10 = **2.000 g**. Monomer 4.000 g, water q.s. to 20.000 g → **9.000 g** water to add, and **15.200 g** water in total (the stocks bring 6.2 g). Acid **1.50 wt%**, surfactant **2.50 wt%** of the batch.
- **Inhibitor already in a monomer** (D3): 10.000 g of monomer at ≤ 30 ppm MEHQ brings ≤ **0.30 mg**, i.e. ≤ **15.0 ppm** of a 20 g batch. The totals show it with "≤". The 30 ppm is the maximum on a supplier listing (web, search only: Sigma-Aldrich M55909 "contains ≤30 ppm MEHQ"; methacrylic acid 155721 lists 250 ppm). The lot's certificate gives the real value.
- **Surfactant in two pre-mixes**: the same sum; no special case.
- **Stages:** in a `steps` block each step is a stage. The totals can be shown after each step (what is in the flask now) and for the finished batch (CD9). A pre-mix *made* in one step and used in a later step of the same block is a row whose material is the step's own output: its content is the step's totals ÷ the step's mass (no chemical note needed).
- **Purity / target / total per ingredient:** target = what the definition asked for; total = the sum above from what was weighed; the difference is the live line ("acid 0.296 g of 0.300 g target, −1.3 %").

### 1.6 How a definition reads and loops over components (additions to the custom-live-blocks Target design §3)
Three additions, each checked by the definition reader (Phase C3) like everything else:
1. **Look-up `CONTENT(key)` on a row**: `lookup: { f: CONTENT(of) }` gives the row's material's content of the chemical named by answer `of` (or `CONTENT(main)` = its first component). Like `MW`, it is read from the chemical notes, with ask-once for a missing amount or density.
2. **Formula function `IN(row, key)`**: grams of that chemical in a row's mass (actual if typed, else target). `IN(ALL, key)` = all rows, `IN(OTHERS, key)` = all rows but this one. A top-up row that uses `IN(OTHERS, …)` and another one that does the same form a cycle, which the evaluator already reports as `#CIRC!` (custom-live-blocks Phase C2).
3. **`balance:`**: `balance: { show: fold, at: each-step }` draws the ingredient totals (§1.5) under the rows. The plugin draws it; the definition only switches it on.
Plus one question source: `select` with `options: components of <chemical answer>` (the window lists A's components, the first one pre-selected).

Example 1, the owner's case (add a mixture for a target amount of one of its parts):
```yaml
# snippet header fields: mix (chemical), of (select: components of mix), want (number, g)
format: 1
name: add-from-mix
layout: list
rows:
  - id: mix
    name: '{{mix}}'
    lookup: { f: CONTENT(of) }          # g of pure <of> per g of <mix>, through every level
    target: want / f
    sub: '{{= f | sig: 4}} g {{of}} per g · gives {{= want | mass}} {{of}}'
balance: { show: fold }
```
Stored block (rule 8 of the one stored text standard: the compositions used are copied into the `#` lines, so a later edit of a chemical note does not silently change the record):
````
```lk-block
format: 1
use: add-from-mix
mix: "[[Solution A]]"
of: "[[C]]"
want: 0.500 g
used:
  Solution A:
# worked out by Lab Kit (add-from-mix), rewritten when the set-up changes
# from the chemical notes: Solution A = C 22 %, D 5 %, E 0.5 %, X rest; C purity 66 %
# C per g of Solution A = 0.22 × 0.66 = 0.1452
# Solution A   0.500 g ÷ 0.1452 = 3.4435 g
```
````

Example 2, top-up from a second source and water q.s. (D2):
```yaml
rows:
  - id: premix
    name: '{{premix}}'
    target: premix_mass                         # an answer: fixed for its surfactant
  - id: stock
    name: '{{acid_stock}}'
    lookup: { f: CONTENT(acid) }
    target: (acid_total - IN(premix, acid)) / f
  - id: monomer
    name: '{{monomer}}'
    target: monomer_mass
  - id: water
    name: Water
    target: total - premix.amount - stock.amount - monomer.amount   # q.s. to the total mass
balance: { show: fold }
```
The CQ5 "definition changed" check compares re-worked `#` lines, so a changed chemical note (a new purity) also flags the block with Update. That is the wanted behaviour: the record keeps the old composition until the user updates it (interpretation, from CQ5 detail a).

### 1.7 Not in v1 (asked)
- **Several targets met by several pre-mixes at once** (each pre-mix carries two of the targeted ingredients): a linear solve, e.g. P1 = surfactant 10 % / acid 2 %, P2 = 5 % / 8 %, targets 0.600 g / 0.300 g → P1 **4.7143 g**, P2 **2.5714 g** (D8). It is a solve, like Solution prep's pH. In v1 a definition tops up one ingredient per row, in order (CD8).
- **As-made composition**: a pre-mix made in one experiment and used in another is read from its chemical note's nominal amounts in v1; reading the actual masses from the block that made it ("as made in [[0012 …]]") is later (CD7).
- **Volumes as actuals** (pipetting a stock): actuals are masses in definition format 1 (custom-live-blocks "Out of scope"). A volume line `≈ 0.46 mL` from the density can be shown as a hint (interpretation).

## 2. How formulations are calculated in practice (research)
Each case lists whether the syntax above handles it, with a worked example.

| # | Case (field) | Rule found | Handled by | Worked example |
|---|---|---|---|---|
| 1 | **"As is" vs "active" basis** (detergents, cosmetics: ASM) | As-is mass = active wanted ÷ active fraction; a 30 %-active surfactant used at 10 % adds 3 % active (web, search only: Chemists Corner forum threads; a NaLAS patent defines "RM Active %") | `content` + `target: want / f` | Owner example: 0.500 ÷ 0.1452 = 3.4435 g (D1) |
| 2 | **Assay / potency adjustment** (pharma) | Addition = required active ÷ assay (as received); dry-basis assay × (1 − LOD) first; salt → base by MW ratio; off-spec material is not "compensated into tolerance" (web, read: SG Systems "Potency/Assay Adjustment" glossary) | `Purity` (as received); `by MW` | 1.500 kg active at 62 % dry basis, LOD 5 % → 0.589 → **2.5467 kg** (D5) |
| 3 | **Purity and salt correction for standards** (analytical) | 98 % pure: weigh 100 ÷ 0.98 = 102 mg; HCl salt with parent fraction 0.635: 157.5 mg (web, read: Restek purity-correction page) | `Purity`; `by MW` | **157.48 mg** of salt for 100 mg parent (D6) |
| 4 | **Solids content** (coatings, latex, resin solutions) | Weight solids = Σ non-volatile mass ÷ total; resin solids drift within spec (50 ± 2 %) and should be checked per batch ticket; ASTM D5201 is the calculation practice (web, search only: ASTM store listing; a coatings article, page not reachable) | `balance:` with a non-volatile flag per ingredient (later: a `Volatile` property) | 2.500 g monomer + 0.150 g CTA + 0.010 g initiator in 10.000 g → **26.60 %** solids at full conversion (D10) |
| 5 | **Dilute to target solids** (dispersions) | Water = m × (S₀ ÷ S₁ − 1), a mass balance on solids (no source read; standard mass balance) | `rest` / q.s. row | 100 g at 45 % to 30 % → **50.0 g** water (D7) |
| 6 | **q.s. vehicle, scale-up and overage** (compounding) | Scale factor = wanted ÷ master; overage multiplies the actives; the q.s. vehicle is worked out last by subtraction, never scaled (web, read: Varsity Tutors NAPLEX "compounding ingredient quantities"); overages must be justified (web, search only: EMA-style guidance on gmp-compliance.org) | `total -` row; a `scale` answer | Master 120 g → 45 g with 20 % excess: 2.70 g, 0.54 g, base 50.76 g (web, read; not re-derived) |
| 7 | **Mixing two strengths (alligation)** | Parts = differences from the target (web, search only: Pearson two-component solver) | a 2-row top-up; the general form is the solve of 1.7 | 500 g of 25 % from 10 % and 40 % → **250 g + 250 g** (D12) |
| 8 | **Molarity stocks dosed by mass** (RAFT initiator stocks) | Initiator stocks at a set mg/mL, volumes measured by weight from densities (web, search only: RSC ESI snippets; Sigma-Aldrich RAFT protocol, page timed out) | `mol/L`, `mg/mL` amounts | VA-044 0.020 mol/L, density 1.00 → **0.006467 g/g**; 3.00 mg needs **0.4639 g** of stock (D4) |
| 9 | **w/v and v/v strengths** | % w/v = g per 100 mL (web, read: Varsity Tutors page) | `% w/v`, `% v/v` with densities | 5 % w/v at 1.02 g/mL = **0.04902 g/g** (D4b) |
| 10 | **Ingredient from several raw materials** (cosmetics INCI roll-up, COSMOS forms) | Each raw material's share × its content of each ingredient, summed per ingredient (web, search only: SpecialChem COSMOS guide, page refused) | ingredient totals (§1.5) | Acid 0.300 g from 5.000 g pre-mix + 2.000 g stock (D2) |
| 11 | **Blend compositions as ranges** (SDS) | Suppliers give ranges (e.g. benzyl alcohol 77-86 % in a preservative blend) (web, search only: Chemists Corner thread quoting a Lonza SDS) | range amounts (CD6) | Totals show "a-b"; a target from a range is refused |
| 12 | **Inhibitor / stabiliser in monomers** | Given as ppm on the label (≤ 30 ppm MEHQ in MMA; 250 ppm in methacrylic acid) (web, search only: Sigma-Aldrich listings) | `ppm` component of a substance note | ≤ **0.30 mg** MEHQ per 10 g monomer (D3) |
| 13 | **Typical emulsion recipe** | water 50-55 %, monomer 40-50 %, surfactant 0.5-5 %, initiator 0.2-0.5 % of the batch; initiator often as % on monomer, dissolved in a known water mass (web, search only: Indorama webinar PDF; patents) | `balance:` wt%; target "% on monomer" = `IN(monomer, …)` | (no number derived) |

Other cases the syntax should handle (from the table; interpretation): **% on monomer** (initiator 0.74 % on monomer, case 13): a target written against another row's content; **water q.s. counting the water of the stocks** (case 6 and D2: two meanings, "water to add" and "water in total", both writable); **non-volatile vs volatile** for solids (case 4: needs one more per-chemical fact); **ppm limits** shown as "≤"; **salt / derivative as parent** (`by MW`).

**Papers or books the owner could fetch** (none read here; citations from memory, check before use):
- ASTM D5201, *Standard Practice for Calculating Formulation Physical Constants of Paints and Coatings* (weight / volume solids, VOC): paywalled; only if solids or VOC lines are wanted.
- Ansel's *Pharmaceutical Calculations* (any recent edition): alligation, potency, q.s., w/v; the textbook form of cases 2, 6, 7, 9.
- Keddie, Moad, Rizzardo, Thang, "RAFT Agent Design and Synthesis", *Macromolecules* 2012, 45, 5321: the table of which CTA class suits which monomer class (for §4 "RAFT agent suitability").
- Perrier, *Macromolecules* 2017, 50, 7433 (the owner's copy, already read in the custom-live-blocks session): livingness, eq 2, quoted there from p. 7435; not re-read here.
- FUJIFILM Wako azo initiator catalogue (free PDF): 10 h half-life temperatures, Ea and ln A for every azo initiator in one table.
- Odian, *Principles of Polymerization* (ch. 3): initiator efficiency f and kd, for a default f.

**Sources read this session** (through the fetch tool's page summary): SG Systems "Potency/Assay Adjustment – Recipe Compensation" glossary; Restek purity-correction page (discover.restek.com/?p=1780); Varsity Tutors NAPLEX "compounding ingredient quantities"; FUJIFILM Wako VA-044 page (10 h half-life 44 °C in water, Ea 108.2 kJ/mol, ln A 30.19, MW 323.27); Meta Bind docs "Input Fields" and "Bind Targets". **Seen as search results only:** Chemists Corner threads (fetch refused, 403), NaLAS / dishwashing patents, ASTM D5201 store pages, coatings.mst.edu article (host not found), Sigma-Aldrich M55909 / 155721 / 444332 listings, Sigma-Aldrich RAFT protocol (fetch timed out), RSC ESI files, gmp-compliance.org overage guidance, Pearson alligation solver, SpecialChem COSMOS guide (403), Indorama webinar, TxDOT Tex-605-J, Wako V-50 / V-501 pages.

## 3. Properties visible in the note (CQ19)
**Proposal:** an empty ```` ```lk-chemical ```` block in the chemical template's body (name per the `lk-` rename decision). It reads **this note's** front matter from the metadata cache and redraws when the cache changes.
- **Shows** every filled-in property except `Type` and kit stamps, in groups (identity, physical, grade, acid / base, hazards), with units from one table in the plugin (`Molecular weight` g/mol, `Density` g/mL, `Purity` wt% …). A property the plugin does not know shows as text under "Other". So chemicals with different properties all draw, and nothing needs a fixed list (CD12).
- **Components** as a sub-table: link, amount, and what it means in g/g where it can be worked out, plus problem lines (length mismatch, over 100 %, a range, a cycle).
- **Worked-out lines** (nothing stored): bottle molarity (wt% × ρ × 1000 ÷ MW, the Solution prep maths), "pure X per g" for a mixture, and later the initiator half-life at a temperature (§4).
- **Add / Edit** write ordinary properties through `fileManager.processFrontMatter`, numbers as numbers (as `ask-reagent.ts` does), so Solution prep, `MW()` / `PROP()`, the hazards header, the base and the owner's scripts read the same names as today. "+ Add" lists the template's empty properties and the known extras; "Other…" takes any name but refuses one that equals an existing property apart from capitals (FM2). Components rows are edited as pairs (both lists in one write). Lab Kit does **not** set property types (a text value like `99.7 wt% (glacial)` under a Number type would show Obsidian's mismatch icon, `frontmatter-survey.md` §1 finding 4).
- **Without Lab Kit** the block is an empty code block and the properties are still the note's ordinary properties (interpretation).
- Existing chemical notes do not get the block by themselves: the template only affects new notes. An opt-in Tidy up notes rule could add it (CD11 follow-up).

**Compared:**
| | Lab Kit block | Meta Bind fields | Bases view embedded, filtered to this note | Show Obsidian's Properties for chemicals only |
|---|---|---|---|---|
| Shows only what is filled, per chemical | yes | no: one `INPUT[…]` per property written in the template, so every note shows the same list, empty ones too | no: fixed columns | yes (Obsidian's own) |
| Add any property | yes (+ Add) | no (edit the template, and each old note) | no | yes |
| Components (two lists) as rows | yes, edited as pairs | each list as a separate list field; nested paths bind (web, read: Meta Bind "Bind Targets") but there is no row editor | one cell each | as two chip lists |
| Units, worked-out lines, problem lines | yes | view fields can compute (JS / math) | formulas per column | no |
| Extra plugin | no | yes; the kit is moving its Meta Bind buttons to plugin blocks (decisions 2026-10-15) | no | no |
| Phone | to check (`obsidian-check --mobile`) | not checked | not checked | yes |
| Look | the kit's own (`--lk-radius-*`) | Meta Bind's | Bases' | the theme's |
The last column is not checked: whether the owner hides properties with Obsidian's setting (then nothing is drawn, and a CSS class cannot bring it back) or with a CSS snippet (then a `cssclasses` value could show them for chemicals only) (interpretation).

**Looks:** three on the feedback page (`my_work/mockups/chemical-properties-looks.html`, open with `python3 my_work/agent_kit/render_check.py feedback my_work/mockups/chemical-properties-looks.html`): **K-A** a two-column table in groups with click-to-edit values; **K-B** key-number tiles plus hazard chips, the rest in a fold; **K-C** one summary line, everything else in a fold, Edit opens a window. Each shows a substance (glacial acetic acid) and a mixture (the owner's Solution A), the "+ Add" menu and an edit in progress. A fourth panel shows the **ingredient totals** fold of a recipe block (§1.5) for comment. Nothing on the page is decided.

## 4. Other uses of the chemical database and missing features
Not inventory (bottles, amounts left, locations: would need syncing between users' vaults; out of scope). Each item is a property or a worked-out line in the view; most need no new code path.
| Feature | What it needs | Uses it | Notes |
|---|---|---|---|
| **SDS link** | `SDS` (a link to the PDF in the vault, or a URL) | the view (button), the lab-note header (link per chemical) | the owner's SDS tool knows the file; it can write it |
| **GHS pictograms and signal word** | nothing new: worked out from `H_Phrase` codes with a fixed H-code → pictogram table | view, hazards header | code table only (interpretation) |
| **Storage class and incompatibilities** | `Storage class` (a word from a short list, e.g. flammable, oxidiser, acid, base, toxic) | the lab-note header warns when one experiment's chemicals hold classes that must not be stored or mixed together | the class list and the pairs table need the group's own rules (owner) |
| **Risk-assessment data** | already `H_Phrase`; maybe `P_Phrase`, `WEL` | the owner's RA script (route B) | no plugin change (decision 2026-10-21) |
| **Initiator data** | `10 h half-life temperature`, `Activation energy` (kJ/mol), `ln A`, `Efficiency` (f) | view line "t½ at 70 °C = 0.44 h"; RAFT livingness line (CQ21, Perrier eq 2 as quoted in custom-live-blocks) | VA-044 from the maker's Ea and ln A: t½ **9.87 h** at 44 °C (the maker says 10 h at 44 °C, a check) and **0.44 h** at 70 °C (D9); f has no maker value (Odian) |
| **Monomer data** | inhibitor as a component (§1.2), `Tg of homopolymer`, monomer class (MAM / LAM) | Fox Tg line for a copolymer; inhibitor in the totals | Fox, 50 / 50 w/w with homopolymer Tg 378 K and 293 K → **330.1 K** (D11, illustrative values) |
| **RAFT agent suitability** | `RAFT agent class` (trithiocarbonate, dithiobenzoate, xanthate, dithiocarbamate) on CTAs, monomer class on monomers | a warning line in the RAFT block for a poor pair | table from Keddie 2012 (owner to fetch) |
| **PubChem link** | nothing new: a URL built from `CAS-No.` | view button | no network call by the plugin (opening a link is the user's click) |
| **Used in** | nothing new: backlinks (and links in `Components`, measured §1.1) | view fold "Used in: 3 experiments, 2 stocks" | decided "later" (decisions 2026-10-20 Q6) |
| **Check chemical notes** | nothing new | Check setup row: missing MW / density, Purity with Concentration, components over 100 % or out of step, cycles, ranges, units refused | reuses `readReagent` and `content` |
| **Volatile / non-volatile** | `Volatile` (yes / no) | solids line in `balance:` (§2 case 4) | only if solids lines are wanted |

## Out of scope
Inventory and stock levels; writing chemical notes from the web (the SDS tool fills them); a solver for several targets (CD8); actual volumes; structure drawing (SMILES); changing `readReagent` or the Solution prep maths; renaming existing properties (FM9 is its own question).

## Phases (if it gets built; each = one Sonnet session unless marked)
### Phase CD-A — Components reader, pure (before custom-live-blocks C3 if CD1 is answered by then)
- Files: new `src/chem/components.ts` (`readComponents(fm)` → items with link, amount, basis, range, problems; `content(note, ingredient, lookup)` recursive with depth 6, cycles, CAS identity per CD5; `amountFraction` for every basis in §1.3), fixtures `tests/fixtures/chem/components/` (Solution A, C, MMA with MEHQ, VA-044 stock, pre-mix P, stock S, a cycle, a mismatch, a range), `tests/chem-components.test.ts`.
- Done when: the D1-D4 numbers come out of `content` to 4 decimals; each bad fixture gives its one problem sentence; `readReagent` tests unchanged; 0005 / 0011 guards; check PASS. Then one obsidian-check: whether the Properties chip editor merges two equal items in one list (§1.1); if it does, stop and ask (CD1 fallback).
### Phase CD-B — Definition hooks (folded into custom-live-blocks C3-C5)
- `CONTENT()` look-up, `IN()` function, `balance:` key, `options: components of`; the composition `#` lines (rule 8). Fixtures: Example 1 and Example 2 of §1.6 with D1 / D2 as known answers. Needs CD-A, C2.
### Phase CD-C — Template and Check chemical notes
- `kits/lab/Templates/Chemical database template.md` gets `Components:` and `Component amounts:` (and the picked CD13 properties), the base gets the columns only if the owner wants them (look unchanged otherwise), `npm run kit:manifest`; Check setup row "Chemical notes" (§4). Docs: Vault spec chemical-note table, `docs/snippet-syntax.md` (the amount texts), a short "chemical notes format" page the SDS tool can follow.
### Phase CD-F — Feedback page (done in this session) → owner pick → picks in `my_work/reference_visual/`
### Phase CD-D — `lk-chemical` view, read only (needs CD10, CD12)
- `src/chem/view.ts` (pure view model: groups, units, worked-out lines, components rows, problems), `src/chem/render.ts`, `styles.css` (`.lk-chem-*`, radius variables), template body, tests (DOM: classes scoped, no `<table>` if the picked look follows the live-block rule). obsidian-check light / dark / 390 px / `--mobile`.
### Phase CD-E — Add / Edit (needs CD11)
- Click-to-edit or window per CD11, "+ Add" menu, "Other…" with the capitals check, components as pairs, `processFrontMatter`, scroll held. Tests on the write (byte check of the front matter), obsidian-check.
### Phase CD-G — Features picked in CD13, one per session (pictograms first: no new property).
Order: CD-A and the feedback page need nothing else. CD-B waits for custom-live-blocks C2 / C3. CD-D / CD-E are independent of the definition work.

## Risks
- **Two lists out of step** after a hand edit: problem line, never a guess; the view edits pairs. Fallback (d) if Obsidian merges equal chips (not measured).
- **A chemical note changed after a block used it**: the composition `#` lines keep the old values and the CQ5 check offers Update (§1.6).
- **Ranges and "≤" values used as exact**: refused for targets (CD6).
- **Recursion**: depth 6 and cycle check; cost bounded by the definition limits (CQ6 a).
- **Case clash** of new names: checked (none today); "Other…" refuses clashes.
- **The SDS tool writing a different shape**: one written format page (Phase CD-C) and fixtures it can test against.

## Verification
- D1-D12 from the saved script (unreviewed until `/claims-review`); D9 checks itself against the maker's stated 10 h at 44 °C (9.87 h).
- Measured facts: Appendix A, re-runnable.
- The owner's own stocks and pre-mixes (one real note each, in the owner's vault, never read by agents) are the only check that the format covers the lab's cases: owner to try after CD-C.

## Owner questions (paste into BACKLOG "Questions for the owner"; rec. = recommended)
- **CD1 Where a chemical note keeps its components:** (a, rec) two list properties, `Components` (links) and `Component amounts` (`22 %`, `30 ppm`, `0.02 mol/L`, `rest`), item n with item n: measured, links and renames work, both are normal List properties / (b) one nested property (links work, but its type is *Unknown*: raw JSON in Properties, so no normal Bases column) / (c) a Markdown table under `## Components` in the body (links work, readable without Lab Kit, but not a property) / (d) one list of `"[[C]] 22 %"` texts (measured: not a link, goes stale on rename; not recommended).
- **CD2 Amount texts:** (a, rec) a bare `%` means w/w of the material as weighed; also `ppm`, `mol/L` / `M`, `mg/mL`, `% w/v`, `% v/v`, `rest`, `by MW`; `mol/kg` refused (per kg of solution or of solvent is unclear) / (b) the same but `mol/kg` read as per kg of solution / (c) w/w only.
- **CD3 A component's own purity:** (a, rec) taken from the component's own note (C's `Purity: 66`), through every level: pure C per g of A = 0.22 × 0.66 = 0.1452 / (b) written in the mixture note's item (`22 % of 66 %`).
- **CD4 The main component:** (a, rec) the first item of `Components`; a recipe can name another / (b) a `Main component` property / (c) always asked.
- **CD5 The same compound in two notes** (glacial acetic acid and acetic acid): (a, rec) the same `CAS-No.` counts as the same ingredient in totals; notes without a CAS match only themselves / (b) a grade note lists the substance as its only component / (c) never merged.
- **CD6 Ranges and limits from an SDS** (`10-20 %`, `≤ 30 ppm`): (a, rec) stored as written; totals show the range or "≤"; a target worked out from a range is refused with a line asking for the lot's value / (b) the middle of the range with a warning.
- **CD7 A pre-mix made in an earlier experiment:** (a, rec) v1 uses the chemical note's amounts, copied into the block's `#` lines / (b) also "as made in [[experiment]]", reading that block's actual masses (later).
- **CD8 Several targets from several pre-mixes at once** (a solve): (a, rec) not in v1: one top-up ingredient per row, in order / (b) a plugin function that solves it, like `PH_ACID`.
- **CD9 Ingredient totals in a block:** (a, rec) a fold "Ingredient totals" under the rows, per step in a `steps` block / (b) always open / (c) none. (Look: panel 4 of the feedback page.)
- **CD10 Properties view look:** K-A / K-B / K-C on the feedback page, or say what to change. Rec. K-A (shows every value at once with its unit and edits in place, like the Actual cells already approved).
- **CD11 Editing:** (a, rec) click a value to type in place; "+ Add" menu with the template's names and units, and "Other…" / (b) an Edit button that opens a window with every field / (c) both. And for notes made before: (a, rec) an opt-in Tidy up notes rule adds the block / (b) only new notes.
- **CD12 Which properties the view shows:** (a, rec) every filled-in property except `Type` and kit stamps; empty template ones only in "+ Add" / (b) every template property, empty ones too / (c) a list set in Settings.
- **CD13 Which other features, in which order** (multi-select): SDS link · GHS pictograms from H-codes · storage class and incompatibility warning in the lab header · initiator data and half-life line (with CQ21 livingness) · Tg and the Fox line · RAFT agent class vs monomer class warning · PubChem link from CAS · "Used in" fold · Check chemical notes row · volatile flag for solids. Rec. pictograms, SDS link, Check chemical notes, initiator data first.
- **CD14 When:** (a, rec) CD-A now, so the components reader is in definition format 1 (CQ18 a); the view (CD-D / CD-E) after the owner's pick / (b) all after the custom-live-blocks plan.

## Appendix A: probe (measured 2026-10-21, re-runnable)
Notes (front matter as in §1.1): `C.md` (`Purity: 66`), `D.md`, `E.md`, `Water.md`; `Solution A.md` (one list of `"[[C]] 22 %"` texts), `Solution B.md` (`Made of` list of links + `Made of wt%` list of numbers), `Solution N.md` (`Parts` list of maps), `Solution K.md` (`"[[C]]: 22 %"` texts); then, created in the running vault, `Solution T.md` (Markdown table) and `Solution P.md` (`Components` links + `Amounts` texts). `OBSIDIAN_CHECK_PORT=9347 node scripts/obsidian-check.mjs start --notes <folder> --dir <scratch> --no-build`, then `eval --file`:
```js
const out = {};
for (const n of ["Solution A.md","Solution B.md","Solution N.md","Solution K.md"]) {
  const c = app.metadataCache.getFileCache(app.vault.getFileByPath(n));
  out[n] = { fmLinks: (c.frontmatterLinks||[]).map(l => l.key + " -> " + l.link), resolved: app.metadataCache.resolvedLinks[n] };
}
out.backlinksOfC = Object.keys(app.metadataCache.resolvedLinks).filter(k => app.metadataCache.resolvedLinks[k]["C.md"]);
const all = app.metadataTypeManager.getAllProperties();
out.types = Object.fromEntries(["components","made of","made of wt%","parts","mix"].map(k => [k, all[k]?.widget]));
return out;
```
Result: A and K no links; B `Made of.0 -> C`, N `Parts.0.chemical -> C`; backlinks of C = B, N; widgets `components` / `made of` / `mix` = multitext, `made of wt%` / `parts` = unknown. Second probe: create T and P, `app.fileManager.renameFile(C, "C renamed.md")`, answer the Update links window with "Just once", read the files: B, N, T, P now say `[[C renamed]]`, A still says `[[C]] 22 %`; P's front matter was re-written without quotes; `amounts` widget = multitext.
