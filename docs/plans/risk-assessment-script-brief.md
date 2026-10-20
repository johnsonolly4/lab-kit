# Brief: a Python script that fills the risk assessment from Lab Kit notes

_Written 2026-10-21 for an agent the owner will start. Decision (owner, chat 2026-10-21): route B of `docs/plans/risk-assessment-word.md`. The owner writes and runs the script in their own repository, next to the SDS-to-MD tool. **No Lab Kit plugin change.** This file only says where the data is and what it looks like._

## What the script does
Read one lab note, follow its chemicals to their chemical notes, collect each chemical's name, CAS number and H statements, and fill those into the group's risk assessment Word template. Only chemicals and H phrases are needed (owner, 2026-10-21); amounts are not.

## Where the files are (Lab Kit defaults; each is a setting, so read the owner's vault settings, do not hard-code)
| What | Default folder in the vault | Where the setting lives |
|---|---|---|
| Lab notes | `03 Lab Book/Notes` | `<vault>/.obsidian/plugins/lab-kit/data.json` → `kit.labFolder` |
| Chemical notes | `05 Chemicals/Chemicals` | same file → `kit.chemicalFolder` |
| Lab note template | `Templates/Lab Book Template.md` (kit file) | installed by Lab Kit |
| Chemical note template | `Templates/Chemical database template.md` (kit file) | installed by Lab Kit |

The vault path is the owner's and is never written into this public repository; the script takes it as an argument or an environment variable.

## What the data looks like
Both kinds of note are Markdown files with YAML front matter (between the first two `---` lines).

**Lab note** (file name like `ABC0014 - Title.md`; front matter written by the Lab Book Template):
```yaml
Type:
Status: Started
Exp. Class: RAFT
Plan date: 2026-10-21
Chemicals:
  - "[[Styrene]]"
  - "[[AIBN]]"
CoSHH:
RA:
Objective:
Outcome:
```
- `Chemicals` is a list of Obsidian links (the property name is a Lab Kit header setting, default `Chemicals`). A link may carry an alias (`[[Styrene|St]]`) or a path (`[[05 Chemicals/Chemicals/Styrene]]`). Resolve a link the way Obsidian does (Lab Kit uses `metadataCache.getFirstLinkpathDest(name, labNotePath)`): a path link points to that file; a bare name matches a note with that file name, preferring the closest one to the lab note when several exist. A simple script can match by file name and report any name that matches more than one file.
- Property names contain spaces and dots (`Exp. Class`): read them as plain YAML keys.
- `RA` is where the owner may link the finished risk assessment later (not set by the script unless the owner asks).

**Chemical note** (file name = the chemical, e.g. `Styrene.md`; front matter from the Chemical database template):
```yaml
Type: Chemical database
Names: Styrene
Chemical class: Monomer
H_Phrase:
  - "H226: Flammable liquid and vapour"
  - "H315: Causes skin irritation"
CAS-No.: 100-42-5
Molecular weight: 104.15
```
- `H_Phrase` is a list of strings `"<code>: <text>"` (colon form, decision C-107 of the SDS-to-MD tool). Older notes may hold a single string or an empty first item (`- `): treat empty as none.
- `CAS-No.` may be empty (mixtures have none).
- Notes made by the SDS-to-MD tool use the same template and property names.
- Lab Kit's own hazard header reads exactly these two things (`Chemicals` on the lab note, `H_Phrase` on each chemical note): see `src/header/hazards.ts` for the rules it follows (chemicals without a note are kept and shown; the hazard table is hidden for `Exp. Class` values `in-silico` and `setup` by default; phrases are sorted worst first using `src/header/ghs.ts`).

## Rules for the script (owner's principles)
- Read only; never change a note. Write the filled document next to the lab note or into the data folder (owner to choose).
- A chemical without a note, or without H statements, is written as `not recorded`, never left out silently.
- Record in the document (properties or a small footer): the template file's SHA-256, the lab note's file name and SHA-256, each chemical note's SHA-256, and the script version, so the draft can be checked later.
- The document is a draft: hazards from the procedure, controls, PPE, waste, emergency steps, risk rating and signatures stay typed by people.
- Keep the group's template private: never commit it or a filled document to a public repository.

## Open points for the owner (ask before building)
1. Where the blank template lives (it is private; `my_work/private/` in the Lab Kit checkout is one place, or the script's own repo, git-ignored).
2. Where the filled draft goes: next to the lab note or in the data folder.
3. Whether the script also sets the lab note's `RA` property to the draft's link (default: no).
