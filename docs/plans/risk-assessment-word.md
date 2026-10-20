# Plan: risk assessments as Word documents

> [!warning] PLAN WAITING FOR OWNER
> Written 2026-10-21 by a planning side session (Opus; no plugin code, nothing built, nothing installed, nothing tried in Obsidian or Word). Owner's question (chat, 2026-10-21): "could the plugin generate Word documents? We have to write standard-format risk assessments and I would like to speed that up. If not, maybe I do a Python script that can read the chemicals from a saved lab note and the SDS info from the chemical database, then fill in the template." The group's real RA form has **not** been seen: everything about its layout below is a guess until a blank copy is in `my_work/private/` (Q1). Each phase = one session.

How the facts were got (tags as in the verifiable-claims rule; this note is **not** entered in a claims register, so every tag is **unreviewed**):
- **reported** = read on a web page or registry entry on 2026-10-21 and paraphrased; URL given. A page summary made by the fetch tool is not a full read of the docs (grade C, "not read in full").
- **derived** = measured on this machine by the command named.
- **(interpretation)** = my reading, not a measured fact.
- Code facts carry `file:line` (read 2026-10-21 on branch `overnight/2026-10-19`).

## 1. Short answer

1. **Can the plugin make .docx files? Yes.** A `.docx` is a zip of XML files; a JavaScript library bundled into `main.js` can build or fill one and `Vault.createBinary(path, ArrayBuffer)` writes it into the vault on desktop and phone ([API page](https://docs.obsidian.md/Reference/TypeScript+API/Vault/createBinary), reported; it throws if the file already exists, so it never overwrites). Store rules allow bundled libraries; they forbid obfuscation, self-updating and client telemetry, and ask that network use be disclosed ([Developer policies](https://docs.obsidian.md/Community+directory/Developer+policies), reported). No network is needed for this.
2. **The best way is to FILL the group's own Word template**, not to draw a new document: the group's standard format is then kept exactly, because the plugin only swaps placeholders (`{Title}`) and repeats one table row per chemical (interpretation).
3. **Plugin or Python?** Both can fill a template. The deciding fact is in Lab Kit's own notes: **amounts in calc tables are stored as formulas** (`=B3-B2`, `=PROP(B5,"Density")`; `tests/fixtures/snippet-templates/expected.json:18-19`), so a Python script reading the `.md` sees formulas, not grams, unless it re-implements the calc engine (`src/calc/engine.ts:301` `Workbook`). The plugin already has the engine. So (rec): **the plugin collects the data; the filling is done by the plugin if the form is simple, or by a small Python script from a JSON file the plugin writes if the form is complex** (section 6).
4. **It speeds the form up, it does not assess the risk.** Lab Kit can fill chemicals, CAS, amounts, H statements, signal word and (with a lookup) pictograms. Procedure hazards, controls, PPE, waste, emergency and sign-off stay typed by a person (section 4). The output says "draft, check every row against the SDS" (section 7).

## 2. What Lab Kit holds today (read 2026-10-21)

- **Lab note** front matter (`kits/lab/Templates/Lab Book Template.md:58-74`): `Type`, `Status`, `Exp. Class`, `Plan date`, `Exp. Start`, `Chemicals` (links), `CoSHH`, `RA` (both typed by hand today; `docs/plans/lab-notes-board-and-completed-view.md:161`), `Objective`, `Outcome`. Note name `ABC0014 - Title`. Body: Objectives and procedure as the user writes them; recipe tables are calc blocks with columns `Reagent | Eq. | Relative to | MW (g/mol) | Set mmol | mmol | Mass (g) | Added (g) | wt%` (`kits/lab/Extras/scripts/templater/labSnippets.js:306`) or `Role | Name | MW (g/mol) | Mol fraction | mol | Mass (g) | Used (g)` (RAFT, `:340`); solution live blocks hold the acid mass (`docs/plans/solution-live-block.md`).
- **Chemical note** (`kits/lab/Templates/Chemical database template.md:1-17`): `Names`, `Chemical class`, `H_Phrase` (list, `"H225: Highly flammable liquid and vapour"`), `CAS-No.`, `Molecular weight`, `State at RTP`, `Boiling point`, `Melting point`, `Density`, `Purity`, `Concentration`, `pKa`, `Acid / base`.
- **Not in chemical notes:** P statements, signal word, pictograms, supplier, SDS date, flash point. The owner's SDS tool parses signal word, P statements, supplier, product number, revision date, flash point but does **not** write them (its decision C-101, owner); pictograms are images in the PDFs and are not read at all (`SDS to MD handoff/HANDOFF.md` sections 4-5, read only). Extending that tool is the owner's separate project, not planned here.
- **Already worked out by Lab Kit:** the hazard header reads `Chemicals`, resolves each link and reads `H_Phrase` from the metadata cache (`src/header/hazards.ts:44-81`); each H code maps to a GHS category and signal word, and a severity level (`src/header/ghs.ts:10-39`). Exp. Classes `in-silico`, `setup` hide hazards (`src/header/hazards.ts:39`).
- **Writing files:** Close experiment writes PDFs outside the vault on desktop with `saveFileTo` (`src/node.ts:90-96`), which **overwrites** (`fs.writeFileSync`); an RA writer must not reuse it as is (interpretation: a draft RA that someone has already edited in Word must never be replaced).
- **Bundle today:** `main.js` = 1,019,849 bytes (derived: `ls -la main.js`, repo root, build of 2026-10-21 00:20).

## 3. Can an Obsidian plugin make .docx files? The options

Library facts from the npm registry JSON (`registry.npmjs.org/<pkg>/latest`) and minified sizes from the Bundlephobia API (`bundlephobia.com/api/size?package=<pkg>@<ver>`), both fetched 2026-10-21 (reported). Sizes are Bundlephobia's numbers, **not** measured in our esbuild build.

| Option | What it does | Licence | Min / gzip | Mobile | Keeps the group's format? |
|---|---|---|---|---|---|
| (a) `docx` 9.13.0 ([npm](https://www.npmjs.com/package/docx)) | Builds a document from code (paragraphs, tables). Also `patchDocument`: replaces `{{placeholder}}` in an existing file and can repeat table rows (`PatchType.TABLE_ROWS`) ([patcher docs](https://github.com/dolanmiu/docx/blob/master/docs/usage/patcher.md), reported, not read in full) | MIT | 453 KB / 130 KB | browser use of the patcher not stated on the page (not confirmed) | From scratch: no, we would redraw the form. Patcher: yes |
| (b1) `docxtemplater` 3.71.1 + `pizzip` 3.3.0 ([docxtemplater](https://docxtemplater.com/docs/tag-types/)) | Fills a Word template: `{tag}`, loops `{#chemicals}…{/chemicals}` (a loop in a table row repeats the row), conditions `{#GHS02}…{/GHS02}` | docxtemplater MIT (the [pricing page](https://docxtemplater.com/pricing/) says MIT or GPLv3 dual); pizzip MIT OR GPL-3.0 | 189 KB + 87 KB (gzip 56 + 27) | pure JS, so expected to work (interpretation, not tried) | **Yes, exactly** |
| (b2) Own small filler on `fflate` 0.8.3 | Unzip, string-replace placeholders in `word/document.xml`, repeat a `<w:tr>`, zip again | MIT | 32 KB / 12 KB | yes (interpretation) | Yes, for simple placeholders; we must handle Word splitting `{Title}` across runs ourselves (interpretation: a known Word behaviour, the reason docxtemplater exists) |
| (c) Where it is written | `vault.createBinary` into the lab note's folder (or an attachments folder): desktop and phone. A copy into the data folder outside the vault: desktop only, through `src/node.ts` | — | — | vault: yes; data folder: desktop | — |
| (d) Store review | Bundled code in `main.js` is fine; no remote code, no network, no self-update, no obfuscation; comply with and credit the libraries' licences ([Developer policies](https://docs.obsidian.md/Community+directory/Developer+policies), reported) | — | — | — | — |

Notes on (b1):
- Paid docxtemplater modules (500 EUR per module per year) include **Image**, Html, Table, Word-run, Styling and others; there is **no checkbox module** listed (pricing page, reported). Loops, conditions and placeholders are in the free core (reported). So the plugin must not need the Image module (rec: pictograms by condition, below).
- **Pictograms without the Image module** (interpretation, not tried): the template holds all nine GHS pictograms once, each wrapped in a condition `{#GHS02}{/GHS02}` around its picture; the filler keeps the ones the chemicals need. GHS pictogram from H code is a lookup table we would add next to `src/header/ghs.ts` (not built; some H codes have no pictogram, e.g. H303 / H333, and the table needs checking against the GHS text before use).
- **Checkboxes** (interpretation, not tried): a Word content-control checkbox is XML the free core does not toggle; the simple way is a placeholder that becomes `☒` or `☐` (or a condition). Which the group's form uses is not known until Q1.
- Adding docxtemplater + pizzip is about +27 % on today's `main.js` by Bundlephobia's numbers (derived from the two sizes above: 275,293 / 1,019,849); fflate about +3 %.

## 4. What a risk assessment form usually needs, and who fills it

The group's own form is not seen; this is a usual UK university chemistry RA / CoSHH layout (interpretation, from general knowledge, no source read).

| Part of the form | Lab Kit has it | Owner types it |
|---|---|---|
| Title, experiment number, date, location, assessor | note name and title, `Plan date` / `Exp. Start` | location, assessor, supervisor (settings could hold defaults: empty, public repo) |
| Chemicals: name, CAS, amount, state | `Chemicals` links, `CAS-No.`, `State at RTP`; amounts from calc tables / solution blocks (computed by the plugin, section 1.3) | chemicals not in a table, scale-up amounts |
| Hazards: H statements, signal word, GHS category, pictograms | `H_Phrase`; signal word and category from `src/header/ghs.ts`; pictograms by lookup (to build) | checking them against the SDS |
| P statements, first aid, fire, spill (SDS sections 4-6) | **no** (the SDS tool parses P only and does not write it) | yes, or later from the SDS tool (owner's separate project) |
| Exposure limits (WEL), routes of exposure | no | yes |
| Procedure steps and their hazards (heat, pressure, sharps, vacuum, light, gas) | the note body, but not as a list a form can use | yes |
| Controls (fume hood, glovebox, blast shield), PPE | no | yes (a few defaults per Exp. Class could be a later idea) |
| Risk rating (likelihood × severity, before / after controls) | no (Lab Kit's severity level is a hazard level, not a risk rating; using it as one would be wrong, interpretation) | yes |
| Waste and disposal | no | yes |
| Emergency procedures, out-of-hours | no | yes |
| Sign-off, signatures, review date | no | yes, by hand or Word's own signature; never filled by the plugin |

## 5. The Python route (owner's idea)

- **Libraries** (PyPI JSON, fetched 2026-10-21, reported): `python-docx` 1.2.0, MIT, needs `lxml`; `docxtpl` 0.20.2, **LGPL-2.1-only**, needs `python-docx`, `jinja2`, `lxml` ([pypi docxtpl](https://pypi.org/project/docxtpl/), [docs](https://docxtpl.readthedocs.io/en/latest/), reported, not read in full). docxtpl has Jinja tags in Word, `{%tr for c in chemicals %}` table-row loops, `InlineImage` for pictures (free), `RichText`. LGPL is fine for a script the owner runs (interpretation; not legal advice).
- **Reading the note:** front matter by YAML; `Chemicals` links `[[Name]]` resolved by file name in the chemical folder (Obsidian's own link resolution is not copied exactly, so ambiguous names must be reported, not guessed; interpretation). Chemical notes: `H_Phrase`, `CAS-No.`, `Molecular weight` etc.
- **The weak point: amounts.** Calc cells hold formulas (section 1.3). A script can read only typed cells (`Added (g)`, `Used (g)` once filled at the bench), not targets, unless it ports the calc engine. Solution blocks hold their own line format (`docs/plans/solution-live-block.md`, "Technical choices").
- **Fit with the SDS tool:** a separate command or package in the owner's own repo, next to `sds2md`, not inside it (its handoff says keep it separate; section 7 there). Same rules apply: never overwrite, never guess, report gaps, no network.
- **Run:** by hand (`ra-fill "ABC0014 - Title.md" --template ... --out ...`). A button in Obsidian that starts Python needs `child_process`, which the plugin rules forbid (`.claude/rules/obsidian-plugin.md`), so "from a button" is not possible in Lab Kit (interpretation: a Shell-commands plugin could do it, not ours).

## 6. Recommendation

**Fill the group's own template. The plugin always collects the data; who fills depends on the form** (rec, interpretation):

- **Route P (plugin fills):** if the form has plain text fields and one chemicals table. Command **Make risk assessment (Word)** on a lab note: reads the template `.docx` (setting, a vault path), fills it with docxtemplater + pizzip, writes `ABC0014 - Title RA draft.docx` next to the note (a number added if it exists). Works on the phone.
- **Route J (plugin exports, Python fills):** if the form has merged cells, several tables, checkbox grids or pictures in cells. Command **Export risk assessment data** writes `ABC0014 - Title RA data.json` (no library, tiny), and the owner's Python script (docxtpl) fills the template from it. Desktop and phone for the export; Python on desktop.
- Not recommended: drawing the form from scratch with `docx` (the format would drift from the group's), and a Python script that parses the `.md` itself (amounts would be formulas).

### Verifiability (both routes)
The output records, in the document's custom properties (`docProps/custom.xml`) and in a one-line footer placeholder `{_record}` (interpretation: custom properties are standard in .docx; not tried with the group's form):
- template file name and SHA-256, lab note name and SHA-256 of its text (the same hash rule as `closed_hash`, `docs/plans/close-experiment.md:40`), each chemical note's path and SHA-256, Lab Kit version, date made;
- the list of gaps (chemical with no note, no `H_Phrase`, no amount) printed in the draft as `not recorded` rows, never left out;
- the JSON in route J carries the same record, and the Python script copies it and adds its own version and the template hash it used.
A later check (`Check setup` row or a script flag) can say "this RA was made from older chemical notes" by comparing hashes (later phase, optional).

### Phases (one session each; Sonnet unless said)
- **Phase 0, owner:** blank RA template into `my_work/private/` (Q1). A session reads it (`anthropic-skills:docx` unpack), lists every field, table, checkbox and picture, and decides P or J with the owner (Opus, short). No code.
- **Phase 1, data, pure:** `src/ra/collect.ts` builds the RA data (note fields, chemicals from `collectHazards`, amounts from calc tables / solution blocks via `Workbook`, signal word, category, pictogram lookup, gaps, hashes). Tests on fixtures (two chemicals, one missing note, one formula amount; 0005 / 0011 guards). Done when the JSON is byte-stable.
- **Phase 2, export command (route J) or tagged template (route P):** J: `Export risk assessment data` writes the JSON with `createBinary`, never overwriting. P: the owner's form copied in `my_work/private/` gets placeholders (a tagged copy, kept private), plus a made-up public test template in `tests/fixtures/ra/`.
- **Phase 3, filling:** P: docxtemplater + pizzip bundled, `Make risk assessment (Word)`, licence notices in README / `docs/`, size measured after build; tests unzip the output and check the XML. J: the owner's Python script (owner's repo, not here; this repo only documents the JSON format).
- **Phase 4, in Obsidian and Word:** throwaway vault (`obsidian-check`), open the result in Word (owner) and LibreOffice; phone write tried. Docs per `docs/maintenance.md`.
- **Later (ask first):** `RA` property set to the draft's link; data-folder copy on desktop; stale-RA check; defaults per Exp. Class for controls / PPE.

### Risks
- **Template changes** (the safety office issues a new version): placeholders lost, or a new field. Mitigation: the template's SHA-256 is recorded; the filler lists placeholders it did not find and fields left as tags.
- **Tables that grow with the number of chemicals:** a row loop is fine; a fixed 10-row table with a page break, merged "hazard" cells across rows, or chemicals split across two tables is not (route J then).
- **Checkbox fields and pictures:** content-control checkboxes and pictograms need tricks (section 3); the Image module is paid, so route P uses conditions.
- **Signatures:** never filled; the draft must be signed by people in Word.
- **Wrong or stale data reads as authoritative:** H statements come from parsed SDS text (the SDS tool's claims are unreviewed). The draft says it is a draft, and the hashes show which notes it came from.
- **Word run splitting** breaks hand-typed placeholders silently (b2); docxtemplater reports it.
- **Bundle size** +~27 % (route P) and two new dependencies to keep up to date.
- **Public repo:** the group's form must never be committed; only a made-up test template.

## 7. Questions for the owner (rec first)

- **Q1 Template:** please copy a **BLANK** copy of the group's RA template (the `.docx` you fill in) into `my_work/private/` (never into the public repo). (a, rec) yes, the Word file / (b) only a PDF or screenshot (then the plan stays a guess) / (c) the group has a web form, not Word (then this plan changes).
- **Q2 Who fills the form:** (a, rec) decide after Phase 0: plugin (P) if the form is simple, JSON + your Python script (J) if not / (b) plugin only, also on the phone / (c) Python only, reading the notes itself (amounts would be formulas, so typed amounts only).
- **Q3 Is one RA per lab note right?** (a, rec) yes, one draft per lab note / (b) one RA covers several experiments (a "procedure" RA), so the source is a list of notes / (c) both.
- **Q4 Where the draft goes:** (a, rec) next to the lab note in the vault (phone too) / (b) the experiment's data folder on desktop / (c) both.
- **Q5 Pictograms:** (a, rec) yes, looked up from the H codes and shown by condition in the template / (b) no, H statements only / (c) only when the SDS tool one day reads them.
- **Q6 P statements, first aid, spill, fire:** (a, rec) typed by you in Word for now; ask the SDS tool's own session later whether it should write them (C-101 there) / (b) add empty properties to the Chemical database template now (a kit template change, needs your OK).
- **Q7 Record in the document:** (a, rec) custom properties + one small footer line with the hashes / (b) custom properties only (nothing visible) / (c) none.
- **Q8 Lab note link:** (a, rec) not yet; later the `RA` property may get the draft's link (ask then) / (b) yes, set `RA` when the draft is made.

## 8. Not confirmed
- The group's form: fields, tables, checkboxes, pictures, Word or web (Q1).
- That docxtemplater + pizzip and fflate run on Obsidian mobile (pure JS, expected; not tried). Bundle sizes are Bundlephobia's, not our build's.
- Whether `docx`'s `patchDocument` works without Node in the browser (page does not say).
- That the condition trick keeps or removes a picture cleanly, and how the form's checkboxes are made.
- docxtpl licence details beyond the PyPI field (`LGPL-2.1-only`); licence compatibility is my reading, not legal advice.
- The developer-policies page was read through the fetch tool's summary (grade C); re-read before release.
- Nothing was opened in Word or Obsidian.
