# How Lab Kit stores chemical data for a CoSHH assessment

_For an agent that reads a Lab Kit vault to draft a CoSHH / risk assessment. Written 2026-10-21. The example notes in `example-vault/` are made up; their hazard statements are examples, not checked against a safety data sheet._

## In one paragraph
Each experiment is one **lab note**. Its `chemicals` property lists the chemicals used, as links. Each link points to a **chemical note**, one per chemical, whose `h_phrases` property lists its GHS hazard statements as `"<code>: <text>"`. To draft an assessment: read the lab note, follow each link to its chemical note, and collect the name, CAS number and hazard statements. Nothing else is needed (owner, 2026-10-21: only chemicals and H phrases, not amounts).

## Property names: new format and today's
The owner decided on 2026-10-21 that every Lab Kit property name becomes **lower-case snake_case** (decision FM9 in `docs/decisions.md`). The rename is planned, not built. The examples use the **new** names. Until the rename ships, notes still carry today's names. **Read both, new first, and match names ignoring capitals** (Obsidian treats `Status` and `status` as one property).

| Meaning | New name | Today's name |
|---|---|---|
| **Lab note** | | |
| chemicals used (list of links) | `chemicals` | `Chemicals` |
| experiment class | `exp_class` | `Exp. Class` |
| status (Planned / Started / Processing results / Closed) | `status` | `Status` |
| link to the CoSHH form | `coshh` | `CoSHH` |
| link to the risk assessment | `ra` | `RA` |
| planned date / start date | `plan_date` / `exp_start` | `Plan date` / `Exp. Start` |
| objective / outcome | `objective` / `outcome` | `Objective` / `Outcome` |
| **Chemical note** | | |
| hazard statements (list) | `h_phrases` | `H_Phrase` |
| CAS number | `cas_no` | `CAS-No.` |
| other names | `names` (Obsidian's `aliases` is read too) | `Names` |
| chemical class (list) | `chemical_class` | `Chemical class` |
| molecular weight, density, purity… | `molecular_weight`, `density`, `purity`, `concentration`, `pka`, `acid_base`, `state_at_rtp`, `boiling_point`, `melting_point` | `Molecular weight`, `Density`, `Purity`, … |

The exact final list is fixed by the property-rename plan. If a name there differs from this table, that plan wins.

## Where the files are
Every folder is a Lab Kit setting. Read the owner's settings; don't hard-code them.

| What | Default folder | Setting (in `<vault>/.obsidian/plugins/lab-kit/data.json`) |
|---|---|---|
| Lab notes | `03 Lab Book/Notes` | `kit.labFolder` |
| Chemical notes | `05 Chemicals/Chemicals` | `kit.chemicalFolder` |
| Templates that make them | `Extras/Templates` (`Lab Book Template.md`, `Chemical database template.md`) | Lab Kit's kit folders |

The vault path is the owner's and never goes into this public repository: take it as an argument or an environment variable.

## Reading a lab note
- File name: `<initials><number> - <title>.md`, e.g. `XX0001 - RAFT of styrene (example).md`.
- Front matter is YAML between the first two `---` lines.
- `chemicals` is a list of Obsidian links: `"[[Styrene]]"`. A link may have an alias (`"[[Styrene|St]]"`) or a path (`"[[05 Chemicals/Chemicals/Styrene]]"`).
- **Resolving a link**, as Obsidian does (Lab Kit uses `metadataCache.getFirstLinkpathDest(name, labNotePath)`):
  - a path link points to that file
  - a bare name matches the note with that file name, the one closest to the lab note when there are several
  - a simple script can match by file name and report any name that matches more than one file
- **No hazard table needed:** when `exp_class` is `in-silico` or `setup` (Lab Kit's defaults; a setting), the experiment has no hazard table. A draft can skip it or say so.

## Reading a chemical note
- One note per chemical. The file name is the chemical's name, e.g. `Styrene.md`.
- **`h_phrases`** is a list of strings `"<code>: <text>"`, e.g. `"H226: Flammable liquid and vapour"` (colon form, as the owner's SDS-to-note tool writes them).
  - **Combined codes** keep their joined form: `"H302+H332: Harmful if swallowed or if inhaled"`.
  - **Older notes** may hold a single string, a bare code (`H226`), or an empty first item (`- `). Treat empty as none, and a bare code as code only.
  - **Display:** the owner wants the full text shown, not just the code (CD10). Keep the text as written.
- **`cas_no`** may be empty: mixtures have none.
- **Mixtures and stock solutions (planned, CD1):** two paired lists, `components` (links to other chemical notes) and `component_amounts` (`"22 %"`, `"30 ppm"`, `"0.02 mol/L"`, `"rest"`).
  - Item *n* goes with item *n*.
  - The first component is the main one.
  - A mixture's hazards are its own `h_phrases`. Its components' notes can be listed alongside, but are not merged.
- **Notes from the SDS-to-note tool** use the same template and names.

## Rules for a draft (owner's principles)
- **Read only.** Never change a note.
- **Nothing silently left out:** a chemical without a note, or without hazard statements, is written as **not recorded**.
- **Record what the draft was made from:** the template's SHA-256, the lab note's file name and SHA-256, each chemical note's SHA-256, and the script version, so the draft can be checked later.
- **It's a draft:** hazards from the procedure, controls, PPE, waste, emergency steps, risk rating and signatures stay typed by people.
- **Keep the group's assessment template private:** never commit it, or a filled document, to a public repository.

## The example notes
`example-vault/` holds made-up notes with the vault's default folders:

| File | Shows |
|---|---|
| `03 Lab Book/Notes/XX0001 - RAFT of styrene (example).md` | a lab note with four chemicals: two with notes, one with a note but no hazard statements, one with no note at all |
| `05 Chemicals/Chemicals/Styrene.md` | a chemical note with CAS number and full-text hazard statements |
| `05 Chemicals/Chemicals/AIBN.md` | a second chemical, including a combined code |
| `05 Chemicals/Chemicals/Water.md` | a chemical with no hazard statements (empty list) |

`1,4-Dioxane` is linked from the lab note but has no note, which a draft must report as **not recorded**.

**Ignore the code blocks** in the examples:
- ```` ```lk-header ```` on the lab note and ```` ```lk-chemical ```` on a chemical note are Lab Kit's on-screen views, with no data inside.
- `lk-chemical` is the planned chemical view (CD10).
- The `lk-` names follow the decided block rename; today's lab notes have ```` ```lab-header ````.

**Planned, not built:** the `sds` property (a link to the safety data sheet, CD13) on Styrene.

Expected result for the example lab note:

| Chemical | CAS | Hazard statements |
|---|---|---|
| Styrene | 100-42-5 | H226, H315, H319, H332, H361d, H372 (with their texts) |
| AIBN | 78-67-1 | H242, H302+H332, H412 (with their texts) |
| Water | 7732-18-5 | none recorded |
| 1,4-Dioxane | — | not recorded (no chemical note) |

Related: `docs/plans/risk-assessment-script-brief.md` (the earlier brief, today's names) and `docs/plans/chemical-database-components.md` (mixtures).
