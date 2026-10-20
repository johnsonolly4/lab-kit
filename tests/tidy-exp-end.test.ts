// Tidy rule `exp-end` (Q7b): a typed Exp. End moves to closed_on; the rest is listed or left.
import { describe, it, expect } from "vitest";
import { scan, type TidyContext } from "../src/kit/tidy";
import { normaliseDate } from "../src/kit/exp-end";

const ctx: TidyContext = { labFolder: "03 Lab Book/Notes", knowledgeFolder: "06 Knowledge", inboxFolder: "00 Inbox", contractFolders: [], rootNotes: [], migrations: [] };
const run = (fm: string, name = "ABC0001-A") => scan([{ path: `03 Lab Book/Notes/${name}.md`, text: `---\n${fm}\n---\n# Body\n` }], ctx);
const rule = (r: ReturnType<typeof scan>) => r.groups.find(g => g.id === "exp-end");
const left = (r: ReturnType<typeof scan>) => r.reported.find(x => x.id === "left-alone")?.items ?? [];

describe("Tidy rule exp-end", () => {
  it("a typed ISO date becomes closed_on in the same place; the Exp. End line goes; opt-in", () => {
    const g = rule(run("Status: Finished\nExp. Start: 2026-09-02\nExp. End: 2026-09-03\nChemicals:"));
    expect(g?.optIn).toBe(true);
    expect(g?.changes).toEqual([{ path: "03 Lab Book/Notes/ABC0001-A.md", before: "Status: Finished\nExp. Start: 2026-09-02\nExp. End: 2026-09-03\nChemicals:", after: "Status: Finished\nExp. Start: 2026-09-02\nclosed_on: 2026-09-03\nChemicals:" }]);
  });
  it("a text date is normalised to YYYY-MM-DD", () => {
    expect(rule(run("Exp. End: 3rd Sept 2026"))?.changes[0].after).toBe("closed_on: 2026-09-03");
    expect(rule(run("Exp. End: 03/09/2026"))?.changes[0].after).toBe("closed_on: 2026-09-03");
    expect(rule(run('Exp. End: "2026-9-3"'))?.changes[0].after).toBe("closed_on: 2026-09-03");
  });
  it("an empty closed_on line is replaced, not duplicated", () => {
    expect(rule(run("closed_on:\nExp. End: 2026-09-03\nOutcome:"))?.changes[0].after).toBe("closed_on: 2026-09-03\nOutcome:");
  });
  it("a date that cannot be read is reported and not changed", () => {
    const r = run("Exp. End: next week");
    expect(rule(r)).toBeUndefined();
    expect(left(r)[0].note).toContain("not a date I can read");
    expect(rule(run("Exp. End: 03/09/26"))).toBeUndefined();
    expect(rule(run("Exp. End: 2026-02-30"))).toBeUndefined();
  });
  it("an empty Exp. End is simply removed", () => {
    expect(rule(run("Status: Planned\nExp. End:\nOutcome:"))?.changes[0].after).toBe("Status: Planned\nOutcome:");
  });
  it("both present: left and reported (an empty Exp. End is still removed)", () => {
    const r = run("Exp. End: 2026-09-03\nclosed_on: 2026-09-04");
    expect(rule(r)).toBeUndefined();
    expect(left(r)[0].note).toContain("both set");
    expect(rule(run("Exp. End:\nclosed_on: 2026-09-04"))?.changes[0].after).toBe("closed_on: 2026-09-04");
  });
  it("no Exp. End: nothing; an unnumbered note or one outside the lab folder is not looked at", () => {
    expect(rule(run("Status: Planned"))).toBeUndefined();
    expect(rule(run("Exp. End: 2026-09-03", "Notes about this folder"))).toBeUndefined();
    expect(rule(scan([{ path: "06 Knowledge/ABC0001.md", text: "---\nExp. End: 2026-09-03\n---\n" }], ctx))).toBeUndefined();
  });
});

describe("normaliseDate", () => {
  it("reads the common hand-typed forms", () => {
    expect(normaliseDate("2026-09-03")).toBe("2026-09-03");
    expect(normaliseDate("2026/09/03")).toBe("2026-09-03");
    expect(normaliseDate("2026-09-03T10:30")).toBe("2026-09-03");
    expect(normaliseDate("3 September 2026")).toBe("2026-09-03");
    expect(normaliseDate("September 3, 2026")).toBe("2026-09-03");
    expect(normaliseDate("3.9.2026")).toBe("2026-09-03");
  });
  it("refuses what it cannot read with certainty", () => {
    for (const t of ["", "soon", "3 Sept", "09-03", "31/02/2026", "13/13/2026"]) expect(normaliseDate(t)).toBeNull();
  });
});
