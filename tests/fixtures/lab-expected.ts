// What the CURRENT Templater templates give (tests/fixtures/templates/old/Lab Book Template.md, Chemical database template.md, Daily note.md), written out by hand
// (Templater's `-%>` trims the line break after its code block, so a lab note starts at its first `---`). Phase 5 of
// docs/plans/templater-replacement-and-live-snippets.md: the token templates must give these texts byte for byte, except the decided differences:
//  - Daily note: `Type: [Daily Note]` is dropped (owner 2026-10-21: nothing reads it; `kind: daily` marks the note).
//  - Chemical: the class is written in the text by the template (the old flow wrote it with processFrontMatter after the note was made).
import { readFileSync } from "node:fs";

const F = "```";

export interface LabCase { status?: string; expClass?: string; today: string }

/** `Status:` is plain text when it matches `^[\w .-]+$`, else a JSON string (the old `/^[\w .-]+$/.test(status) ? status : JSON.stringify(status)`). */
export const yamlValue = (s: string): string => (/^[\w .-]+$/.test(s) ? s : JSON.stringify(s));

/** A numbered lab entry (New lab entry, a note made in the lab folder): the same lines whatever its number and title (those are the file name). Note the trailing spaces of `Exp. Class: ` (empty), `1. ` and `- `. */
export function expectedLabEntry(c: LabCase): string {
  return ["---", "Type:", `Status: ${yamlValue(c.status ?? "Planned")}`, `Exp. Class: ${c.expClass ? JSON.stringify(c.expClass) : ""}`, `Plan date: ${c.today}`,
    "Exp. Start:", "Chemicals:", "CoSHH:", "RA:", "Objective:", "Outcome:", "cssclasses:", "  - vt", "  - academia", "  - academia-rounded", "  - scrolling_mermaid", "---", "",
    `${F}lab-header`, F, "",
    "# 🔬 Objectives", "", "", "# ⚙️ Apparatus", "", "", "# ⚗️ Procedure", "1. ", "", "# 📈 Results / Analysis", "", "", "# 💡 Notes for next time", "- ", ""].join("\n");
}

/** The file name the old template moved the note to: initials + number + " - " + title ("Untitled" when empty), characters a file name cannot hold replaced by `-`. */
export const labName = (initials: string, number: string, title: string): string => `${initials}${number} - ${title || "Untitled"}`.replace(/[\\/:*?"<>|]/g, "-");

const oldFile = (name: string): string => readFileSync(`tests/fixtures/templates/old/${name}.md`, "utf8");

/** The Chemical database template has no Templater code: the old text as it is; with a class, `Chemical class:` holds one list item (what the old New chemical wrote after making the note). */
export function expectedChemical(cls = ""): string {
  const t = oldFile("Chemical database template");
  return cls ? t.replace("Chemical class:\n", `Chemical class:\n  - ${yamlValue(cls)}\n`) : t;
}

/** The Daily note has no Templater code: the old text without `Type: [Daily Note]` (decided). */
export function expectedDaily(): string {
  return oldFile("Daily note").replace("Type:\n  - Daily Note\n", "");
}
