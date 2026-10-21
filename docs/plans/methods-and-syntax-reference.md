# Methods and snippet syntax: reference, findings, gaps

> [!info] RESEARCH, NO CODE CHANGED
> Written 2026-10-21 by a side session (owner: "a separate session with full renders, inline .md so I can see, and workflows", plus a look at other standard lab processes). Plugin code is unchanged. The owner's picture page is private: `my_work/mockups/methods-and-syntax.html` (the comment copy: `methods-and-syntax-feedback.html`), built by `my_work/analyses/methods-syntax/make_page.py` from the renders and notes kept in the same folder. Owner questions at the end, ready for BACKLOG "Questions for the owner".

## How this was measured
- **Renders**: a throwaway Obsidian (`node scripts/obsidian-check.mjs`, plugin 1.4.1 built from this branch, dark theme), made-up notes only: a lab note `ABC0016 Test polymer`, `Methods/TGA.md`, `Methods/GPC.md`, four machine notes, three chemical notes, the kit's Snippets folder. Alt+S was driven through the real menu and the plugin's own question window (`lk-form`), by a small script that picks a row, sets boxes by label and presses Insert (`my_work/analyses/methods-syntax/drive.js`). Console errors at the end: `[]`.
- **Code read**: `kits/lab/Extras/scripts/templater/labMethods.js` (`parseColumn`, `parseMethod`, `builtins`, `loadMethods`, `planColumns`, `buildRows`), `labSnippets.js` (`methodTable`, `fieldColumns`, `methodForm`, `runMethod`, `resultsTable`, `results`), `src/kit/snippet-insert.ts`, `src/kit/snippet-run.ts`, `src/calc/engine.ts` (function list), `docs/snippet-syntax.md` §1-3, and `docs/plans/custom-live-blocks.md` on `refs/heads/claude/plan-custom-blocks-0a801d` (Target design §1-5, "One stored text standard").
- Claim labels below: **measured** = seen in the throwaway Obsidian this session; **code** = read in the source named; **(interpretation)** = a reading of those; **web (read)** / **web (search only)** for outside sources.

## 1. Method notes: what each property does (measured unless marked)
| Property | Alt+S asks | Lands in the lab note |
|---|---|---|
| `Columns: "Name"` | nothing | an empty column |
| `"Name: default"` | a box per such column, filled with the default | the answer in every row (`Atmosphere: N2` → `N2`) |
| `"Name: =formula"` | nothing | per row, `{Other column}` → that column's cell (`{Mass at 600 °C (mg)}/{Mass start (mg)}` → `G2/F2`) |
| `"Name: {n}"` | nothing | 1, 2, 3 (`Pan #`) |
| `Sample column` | the Sample codes box (pre-filled from every table with a `codes:` line; **Codes from** pills for 2-3 sources, a dropdown above) | codes in that column; the table gets `copy:` / `codes: column B` |
| `Results` | in Combined results, a Yes/No switch `<method> <columns>` | XLOOKUP columns in the `results` table, by sample code |
| `Machines`, `Default machine` | Machine pills (2 machines) | a `Machine` column after the sample column, `[[link]]` per row |
| machine note property named like a column | nothing extra (see F2) | that column's default for that machine (`Atmosphere: Air`) |
| `Title`, `Icon`, `Tag` | menu name and icon | heading + caption; the tag is **not** written (F1) |
| `Checklist` | nothing | one `- [ ]` per item (default Submitted, Results processed, Results saved) |
| `Dataset folder: true` | an optional Dataset / folder box | `Dataset: …` line |

Built-in NMR (code, `builtins`): `Run #` {n}, Sample (sample column), `Solvent: CDCl3`, `Method: 1H`, Conversion (%), Notes; Results Conversion (%); Dataset on; tag NMR. GPC: Sample, `Eluent: THF`, Mn, Mw, `Đ = IFERROR({Mw}/{Mn}, "")`. DLS: Sample, Solvent / dispersant Water, Temperature 25, Dh, PDI; its Results switch is off by default.

### Workflows rendered
- **W1** Sample list (generate 3) → NMR → GPC → TGA → Combined results in one note: each method's codes box was pre-filled with `ABC0016-A, -B, -C`; Combined results pulled Conversion, Mn, Mw, Đ and Residue (%) for each code (measured: A = 92 / 18400 / 21900 / 1.1902 / 5.0493 from typed values).
- **W2** a new method: one note `Methods/TGA.md` with `Columns` is enough; Alt+S lists "TGA samples · Sample table for TGA · TGA 550, TGA Q50" at the end of Characterise, after Combined results (measured).
- **W3** machines set defaults: `Methods/GPC.md` replaces built-in GPC and links `GPC THF` / `GPC DMF`; picking GPC DMF writes `DMF + 0.1 % LiBr` in Eluent (measured). Side effects of replacing a built-in (measured): description becomes "Sample table for GPC · …", the Combined results label becomes "GPC Mn (g/mol), Mw (g/mol), Đ" and the switch is on only when the note has a gpc table.

### Findings
- **F1 Method tags are not written** when Alt+S runs through the plugin (no Templater): after NMR, GPC and TGA the note had no front matter (measured). Cause (code, interpretation): `snippetTp` (`src/kit/snippet-insert.ts:40`) passes `target_file` as `{ basename, path }`; `labSnippets.js` `tag()` passes it to `fileManager.processFrontMatter`, which needs a `TFile`; the error is caught and dropped. Proposed BACKLOG item; not fixed (research only). **FIXED 2026-10-21** (338e9dc): `target_file` is the active TFile. Cause measured in a throwaway Obsidian: `processFrontMatter` on a plain `{ basename, path }` resolves with no error and writes nothing; on the TFile it writes. After the fix NMR, GPC, TGA gave `tags: TGA, NMR, GPC` (each once).
- **F2 Machine defaults switch only after Insert**: with TGA Q50 picked the window still showed `N2` / `10`, the table got `Air` / `20` (measured). `runMethod` swaps boxes left at the default machine's value (code). Nothing on screen says so (interpretation). Owner question MS1. **FIXED 2026-10-21** (e4ae8f4, MS1 a): form fields may `follows` a choice; picking TGA Q50 showed `Air` / `20` before Insert, a typed `15` stayed through TGA 550 and back, the table got `Air` / `15` (throwaway Obsidian).
- **F3** `{{next-letter:sampling}}` in Sampling timetable offered `A` in a note whose Sample list already used A-C (measured): it reads only `sampling` tables (documented). Noted, not asked.

## 2. Three syntaxes for "the other value"
| | Method note | Calc table | Token template | Definition (planned) |
|---|---|---|---|---|
| refers by | `{Column name}`, same row | `F2`, `tga!B$2` | `{{key}}` | bare names: `mass / mean_mw`, `cta.mw`, `monomers.target` |
| row number | `{n}` | none (typed) | `{{@n}}` in `#each` | none (gap G1) |
| typed later | any cell | any cell | any cell | masses only in v1 |

Methods turn `{Column}` into cell references when they write the table, so a lab note only ever holds cell formulas (measured in every method table above). The definition language is still kit-only (plan CQ3 c), so its naming can change for one release (code / plan).

## 3. Other standard lab processes (research)
Sources **read** this session: Malvern Panalytical "Top 10 tips for GPC sample preparation" (start at 1-5 mg/mL); Vanderbilt CSB "DLS guidelines" (1 mg/mL starting point; minimum 5 µL as-is, 10 µL centrifuged, 100 µL filtered); Wikipedia "Calibration curve" (y = m·x + y0, x = (y − y0)/m, the s_x formula); LabFriend "Buffer preparation calculator" (Henderson-Hasselbalch, pKa within ±1 of the target pH). **Search results only** (not read, no number here rests on them alone): Pearson and Sigma-Aldrich buffer calculators; university NMR sample-prep pages (Wisconsin, Iowa State, BU; two fetches were blocked); UF GPC / DLS prep pages (certificate error); titration pages (concordant titres within 0.10 cm³); RSC ESI pages on NMR conversion; LabArchives widget list (403) and Columbia ERN widgets; iOS lab calculator apps.

| Process | Fits the plan's definition language? | Why |
|---|---|---|
| Stock → working (C1V1 = C2V2) | partly | maths yes; the actual is a volume (G2) |
| Serial dilution | no | rows from a count with an index (G1) |
| Buffer (Henderson-Hasselbalch) | yes | `POWER`, `LOG10` exist (code: `engine.ts` FUNCS); pKa via `lookup:` |
| Acid for pH, polyprotic | with `PH_ACID` only | a solve (plan CQ17) |
| Standard curve | no | typed absorbances (G2); no SLOPE / INTERCEPT / RSQ (G3) |
| Titration / standardisation | no | titres are volumes (G2); no STDEV (G3) |
| Yield | yes | product mass is a mass actual |
| NMR conversion from integrals | no | integrals are typed numbers (G2); works today as a method column formula |
| NMR / GPC / DLS sample prep | mostly | one row per code; volume from the weighed mass (G4) |
| Sampling timetable | no (out of scope) | CLOCK / dates; stays a token template |
| Combined results | no (out of scope) | reads other tables (CQ4) |

(The "fits" column is interpretation, from the plan's §3 and §5 and the engine's function list: `SUM PRODUCT AVERAGE MIN MAX COUNT COUNTA SUMPRODUCT ROUND ROUNDUP ROUNDDOWN INT ABS SQRT EXP LN LOG10 LOG POWER MOD PI IFERROR AND OR NOT AVG CONCAT MATCH CLOCK` + IF, XLOOKUP, INDEX, MW, PROP.)

### Gaps
- **G1 rows from a number**: serial dilution 1:10 × 6 needs `repeat: steps` and an index `i` (`10^i`).
- **G2 typed values other than masses**: titre `22.05 mL`, absorbance `0.412`, integral `1.00` → `actual: number | volume | mass` with a unit.
- **G3 statistics functions**: slope of 5 standards, SD of 3 titres → SLOPE, INTERCEPT, RSQ, STDEV in the engine (calc tables gain them too).
- **G4 a target from an actual**: GPC, weighed 2.13 mg → add 1.07 mL for 2 mg/mL → allow `x.actual` in a target formula.
- **G5 several typed values per row**: TGA pan start mass and residue mass.

## 4. Owner questions (paste into BACKLOG "Questions for the owner"; rec. = recommended)

> [!done] Answered by the owner 2026-10-21 (`docs/decisions.md`): CQ15 **b** (align now); MS1 **a**; MS2 **G1, G2, G4** (G5 "might be needed"); MS3 **a**; MS4 **a** (F1 and F2 fixed in their own session).

- **CQ15 Method notes vs definitions:** (a, rec) leave method notes as they are; one syntax page explains both (table in §2); aligning formula naming later is a BACKLOG item / (b) align the formula naming now (method formulas also accept bare names) / (c) make a method a kind of definition (`layout: table`, rows from sample codes).
- **MS1 Machine switch in the method window (F2):** (a, rec) boxes follow the picked machine at once / (b) keep, add a hint "follows the machine" / (c) keep as is.
- **MS2 Gaps in definition format 1:** (a, rec) G2 and G4 (sample prep, titrations, NMR conversion need them), G1 / G3 / G5 later / (b) all five / (c) none: masses only.
- **MS3 Statistics functions for every calc table** (SLOPE, INTERCEPT, RSQ, STDEV): (a, rec) yes / (b) no.
- **MS4 Method tags not written (F1):** (a, rec) fix in its own small session (a bug, nothing on screen changes) / (b) leave.

## Not verified
- Light theme, phone width and Windows / Linux: renders are desktop macOS, dark only.
- The live-block pictures are the owner-chosen mock-ups (R-C, P-B), not renders: definitions are not built.
- Solution prep's set-up window was opened but not filled; its block was not rendered here (approved picture: `my_work/reference_visual/solution-live-block.png`).
- F1's cause is read from the code, not stepped through in a debugger.
