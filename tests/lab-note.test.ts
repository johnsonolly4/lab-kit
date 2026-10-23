// Lab notes, chemical notes and the daily note without Templater (Phase 5): the token templates give the texts the old Templater ones gave
// (tests/fixtures/lab-expected.ts, checked against the old files in tests/lab-old-templates.test.ts), byte for byte, except the decided differences.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHEMICAL_TEMPLATE, LAB_TEMPLATE, chemicalNoteText, createLabNote, foundStatus, freeName, holdsTemplaterCode, isNoteTemplate, labAnswers, labNoteText, labTemplate } from "../src/kit/lab-note";
import { noteFromTemplate } from "../src/kit/note-template";
import { expectedChemical, expectedDaily, expectedLabEntry, labName } from "./fixtures/lab-expected";
import { miniYaml } from "./token-snippets";

const kit = (p: string): string => readFileSync(p, "utf8");
const LAB = "kits/lab/Templates/Lab Book Template.md", CHEM = "kits/lab/Templates/Chemical database template.md", DAILY = "kits/planning/Extras/Templates/Daily note.md";
const NOW = new Date(2026, 9, 21);
const TODAY = "2026-10-21";
const note = { title: "RAFT test", expClass: "", initials: "ABC", number: "0014" };

describe("the bundled templates are the kit files", () => {
  it("equal text", () => {
    expect(LAB_TEMPLATE).toBe(kit(LAB));
    expect(CHEMICAL_TEMPLATE).toBe(kit(CHEM));
  });
});

describe.each([["the kit file", () => kit(LAB)], ["the bundled text", () => LAB_TEMPLATE]])("lab note: %s", (_l, get) => {
  it("a numbered entry: Planned, no class", () => {
    const m = labNoteText(get(), miniYaml, note, NOW);
    expect(m.text).toBe(expectedLabEntry({ today: TODAY }));
    expect(m.name).toBe(labName("ABC", "0014", "RAFT test"));
  });
  it("with an Exp. Class (quoted as JSON), with a quote in it", () => {
    expect(labNoteText(get(), miniYaml, { ...note, expClass: "RAFT" }, NOW).text).toBe(expectedLabEntry({ today: TODAY, expClass: "RAFT" }));
    expect(labNoteText(get(), miniYaml, { ...note, expClass: 'He said "hi"' }, NOW).text).toBe(expectedLabEntry({ today: TODAY, expClass: 'He said "hi"' }));
  });
  it("keeps the board column's Status: plain word, or quoted when it needs it", () => {
    expect(labNoteText(get(), miniYaml, { ...note, status: "Started" }, NOW).text).toBe(expectedLabEntry({ today: TODAY, status: "Started" }));
    expect(labNoteText(get(), miniYaml, { ...note, status: "Needs: review" }, NOW).text).toBe(expectedLabEntry({ today: TODAY, status: "Needs: review" }));
  });
  it("the name: empty title is Untitled, characters a file name cannot hold become -", () => {
    expect(labNoteText(get(), miniYaml, { ...note, title: "  " }, NOW).name).toBe("ABC0014 - Untitled");
    expect(labNoteText(get(), miniYaml, { ...note, number: "0015", title: "Flow: 50/50 mix" }, NOW).name).toBe(labName("ABC", "0015", "Flow: 50/50 mix"));
  });
  it("the date is the day it is made", () => {
    expect(labNoteText(get(), miniYaml, note, new Date(2026, 10, 2)).text).toBe(expectedLabEntry({ today: "2026-11-02" }));
  });
});

describe.each([["the kit file", () => kit(CHEM)], ["the bundled text", () => CHEMICAL_TEMPLATE]])("chemical note: %s", (_l, get) => {
  it("without a class it is the old text", () => {
    expect(chemicalNoteText(get(), miniYaml, "", NOW)).toBe(expectedChemical());
  });
  it("with a class the class is written as the one list item (decided difference: written by the template)", () => {
    expect(chemicalNoteText(get(), miniYaml, "Monomer", NOW)).toBe(expectedChemical("Monomer"));
    expect(chemicalNoteText(get(), miniYaml, "Acid / base", NOW)).toBe(expectedChemical("Acid / base"));
  });
});

describe("daily note", () => {
  it("the kit file fills with no questions to the old text without `Type: [Daily Note]` (decided)", () => {
    const made = noteFromTemplate(kit(DAILY), {}, { parseYaml: miniYaml, now: NOW, noteName: "2026-10-21" });
    expect(made.text).toBe(expectedDaily());
    expect(made.text).not.toContain("Daily Note");
    expect(made.text).toContain("kind: daily");
  });
});

describe("old Templater files are never run", () => {
  const old = (n: string): string => readFileSync(`tests/fixtures/templates/old/${n}.md`, "utf8");
  it("an old Lab Book Template is not a note template: the bundled text is used", () => {
    expect(isNoteTemplate(old("Lab Book Template"), miniYaml)).toBe(false);
    expect(holdsTemplaterCode(old("Lab Book Template"), miniYaml)).toBe(true);
    expect(labTemplate(old("Lab Book Template"), LAB_TEMPLATE, miniYaml)).toBe(LAB_TEMPLATE);
    expect(labTemplate(null, LAB_TEMPLATE, miniYaml)).toBe(LAB_TEMPLATE);
  });
  it("an own token template is used", () => {
    const own = LAB_TEMPLATE.replace("Objective:", "Objective: mine");
    expect(labTemplate(own, LAB_TEMPLATE, miniYaml)).toBe(own);
    expect(holdsTemplaterCode(own, miniYaml)).toBe(false);
  });
});

describe("answers and names", () => {
  it("labAnswers: Untitled and Planned when empty", () => {
    expect(labAnswers({ ...note, title: "", status: "" })).toMatchObject({ title: "Untitled", status: "Planned" });
  });
  it("foundStatus reads the Status a board column wrote", () => {
    expect(foundStatus("---\nStatus: Started\n---\n")).toBe("Started");
    expect(foundStatus('---\nStatus: "Needs: review"\n---\n')).toBe("Needs: review");
    expect(foundStatus("---\nkind: x\n---\n")).toBe("");
    expect(foundStatus(LAB_TEMPLATE)).toBe("");   // the raw template is no column
  });
  const vault = (paths: string[]) => ({
    getAbstractFileByPath: (p: string) => (paths.includes(p) ? ({ path: p } as never) : null),
    getFolderByPath: () => ({ children: paths.map(path => ({ path })) }) as never,
  });
  it("freeName: a name that differs only in capitals is taken (as for to-dos and meetings)", () => {
    const v = vault(["Lab/ABC0014 - Raft test.md", "Lab/ABC0014 - Raft test 2.md"]);
    expect(freeName(v, "Lab", "ABC0014 - Other")).toBe("ABC0014 - Other");
    expect(freeName(v, "Lab", "ABC0014 - raft TEST")).toBe("ABC0014 - raft TEST 3");
  });
  it("createLabNote makes the note under a free name", async () => {
    const made: [string, string][] = [];
    const v = { ...vault(["Lab/ABC0014 - raft test.md"]), create: async (p: string, t: string) => { made.push([p, t]); return { path: p } as never; } };
    await createLabNote(v as never, "Lab", LAB_TEMPLATE, miniYaml, note, NOW);
    expect(made).toEqual([["Lab/ABC0014 - RAFT test 2.md", expectedLabEntry({ today: TODAY })]]);
  });
});
