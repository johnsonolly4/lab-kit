// Lab notes and chemical notes without Templater (docs/plans/templater-replacement-and-live-snippets.md, Phase 5): the vault's Lab Book Template.md and
// Chemical database template.md are token templates (`make: note`), filled by noteFromTemplate. The bundled copies below are what is used when the vault
// has none, or only an old Templater one (Q7: never run, owner 2026-10-21); a test keeps them equal to the kit files. Pure: the vault is passed in.
import type { TFile, Vault } from "obsidian";
import { noteFromTemplate, type MadeNote } from "./note-template";
import { parseTemplate } from "./snippet-template";
import { nameTaken } from "../planning/todo-note";

/** The bundled Lab Book Template.md. */
export const LAB_TEMPLATE = `---
make: note
name: "{{initials}}{{number}} - {{title}}"
fields:
  - key: title
    label: Experiment title
  - key: expClass
    label: Exp. Class
  - key: initials
    label: Initials
  - key: number
    label: Number
  - key: status
    label: Status
    value: Planned
---
---
Type:
Status: {{yaml:status}}
Exp. Class: {{#if expClass != ""}}{{json:expClass}}{{/if}}
Plan date: {{today}}
Exp. Start:
Chemicals:
CoSHH:
RA:
Objective:
Outcome:
cssclasses:
  - vt
  - academia
  - academia-rounded
  - scrolling_mermaid
---

\`\`\`lab-header
\`\`\`

# 🔬 Objectives


# ⚙️ Apparatus


# ⚗️ Procedure
1. 

# 📈 Results / Analysis


# 💡 Notes for next time
- 
`;

/** The bundled Chemical database template.md. */
export const CHEMICAL_TEMPLATE = `---
make: note
fields:
  - key: chemClass
    label: Chemical class
---
---
Type: Chemical database
Names:
Chemical class:
{{#if chemClass != ""}}
  - {{yaml:chemClass}}
{{/if}}
H_Phrase:
  - 
CAS-No.:
Molecular weight:
State at RTP:
Boiling point:
Melting point:
Density:
Purity:
Concentration:
pKa:
Acid / base:
---
`;

/** True for a note template in the new format (`make: note`). */
export function isNoteTemplate(text: string | null, parseYaml: (yaml: string) => unknown): boolean {
  try { return !!text && parseTemplate(text, parseYaml)?.header.make === "note"; } catch { return false; }
}

/** The template to use: the vault's text when it is a token template (`make: note`), else the bundled one (an old Templater file, or none). */
export function labTemplate(vaultText: string | null, bundled: string, parseYaml: (yaml: string) => unknown): string {
  return vaultText && isNoteTemplate(vaultText, parseYaml) ? vaultText : bundled;
}

/** True when the vault file holds Templater code (`<%`) instead of the new format: Lab Kit does not run it and uses the bundled text (a notice says so). */
export const holdsTemplaterCode = (vaultText: string | null, parseYaml: (yaml: string) => unknown): boolean => !!vaultText && !isNoteTemplate(vaultText, parseYaml) && vaultText.includes("<%");

/** What a lab note needs: the title (empty = Untitled), the Exp. Class (empty = none), the initials, the number and the Status ("" = Planned). */
export interface LabNote { title: string; expClass: string; initials: string; number: string; status?: string }

/** The Status a note already holds in its raw text (a board column's `+` wrote it before the note was filled); "" when there is none. */
export function foundStatus(text: string): string {
  const found = (/^Status:[ \t]*["']?([^"'\r\n]+)/m.exec(text) ?? [])[1]?.trim() ?? "";
  return found.includes("{{") ? "" : found;   // a raw template (`Status: {{yaml:status}}`) holds no column
}

export function labAnswers(n: LabNote): Record<string, string> {
  return { title: n.title.trim() || "Untitled", expClass: n.expClass.trim(), initials: n.initials, number: n.number, status: n.status?.trim() || "Planned" };
}

/** The file name rule of old: characters a file name cannot hold become `-`. */
export const safeName = (name: string): string => name.replace(/[\\/:*?"<>|]/g, "-");

/** The lab note's text and its name (no folder, no `.md`) from `template`. Throws a TemplateError for a template that cannot be filled. */
export function labNoteText(template: string, parseYaml: (yaml: string) => unknown, n: LabNote, now: Date): MadeNote {
  const made = noteFromTemplate(template, labAnswers(n), { parseYaml, now });
  return { ...made, name: safeName(made.name || `${n.initials}${n.number} - ${labAnswers(n).title}`) };
}

/** A name that is free in `folder` (ignoring capitals): `name`, then `name 2`, `name 3`... */
export function freeName(vault: Pick<Vault, "getAbstractFileByPath"> & Partial<Pick<Vault, "getFolderByPath">>, folder: string, name: string, except?: string): string {
  const taken = nameTaken(vault, folder, except);
  let out = name, n = 2;
  while (taken(out)) out = `${name} ${n++}`;
  return out;
}

/** Makes the lab note in `folder` (which exists) under a free name; returns the file. */
export function createLabNote(vault: Vault, folder: string, template: string, parseYaml: (yaml: string) => unknown, n: LabNote, now: Date): Promise<TFile> {
  const made = labNoteText(template, parseYaml, n, now);
  return vault.create(`${folder}/${freeName(vault, folder, made.name)}.md`, made.text);
}

/** The chemical note's text from `template`; `chemClass` ("" = none) is written as the note's one Chemical class. */
export function chemicalNoteText(template: string, parseYaml: (yaml: string) => unknown, chemClass: string, now: Date): string {
  return noteFromTemplate(template, { chemClass: chemClass.trim() }, { parseYaml, now }).text;
}

/** Makes the chemical note `name` in `folder` (which exists); returns the file. The caller has checked the name is free. */
export function createChemicalNote(vault: Vault, folder: string, template: string, parseYaml: (yaml: string) => unknown, name: string, chemClass: string, now: Date): Promise<TFile> {
  return vault.create(`${folder}/${name}.md`, chemicalNoteText(template, parseYaml, chemClass, now));
}
