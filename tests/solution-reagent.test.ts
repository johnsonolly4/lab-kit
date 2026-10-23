// Solution prep: chemical-note front matter read into a reagent. Fixtures in tests/fixtures/solution/chemicals/ are saved notes.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { readReagent, isReagentNote } from "../src/solution/reagent";
import { acidConcForPH, molesPerGram, bottleMolarity } from "../src/solution/acid";

/** Just enough YAML for these notes: `key: value`, empty = null, numbers, `- item` lists. Obsidian's own parser is not run in tests. */
function frontMatter(path: string): Record<string, unknown> {
  const text = readFileSync(path, "utf8");
  const body = text.split("\n---\n")[0].replace(/^---\n/, "");
  const fm: Record<string, unknown> = {};
  let key = "";
  for (const line of body.split("\n")) {
    const item = /^\s+-\s*(.*)$/.exec(line);
    if (item && key) { const list = Array.isArray(fm[key]) ? (fm[key] as unknown[]) : []; if (item[1]) list.push(item[1]); fm[key] = list; continue; }
    const m = /^([^:]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    key = m[1].trim();
    fm[key] = m[2] === "" ? null : /^-?\d+(\.\d+)?$/.test(m[2]) ? Number(m[2]) : m[2];
  }
  return fm;
}
const note = (name: string) => frontMatter(`tests/fixtures/solution/chemicals/${name}.md`);

describe("the three L5 reagents", () => {
  it("acetic acid: wt% read from text, nothing missing", () => {
    const r = readReagent(note("Acetic acid"));
    expect(r.reagent).toEqual({ mw: 60.05, purity: 99.7, density: 1.049 });
    expect(r.pKa).toBe(4.76);
    expect(r.kind).toBe("acid");
    expect(r.basis).toBe("purity");
    expect([r.conflict, r.missing, r.invalid]).toEqual([false, [], []]);
    expect(bottleMolarity(r.reagent).value).toBeCloseTo(17.42, 2);
    // the Phase 1 known answer, through the reader: 1.2205 mg for pH 4.00 (15.00 g aqueous, 60 % share, 50 % used)
    const c = acidConcForPH(4, r.pKa!, r.kind);
    expect(c * 15 / 1000 * 60.05 * 1000 * (18 / 9) / 0.997).toBeCloseTo(1.2205, 3);
  });
  it("HCl 37 % and NaOH 50 %", () => {
    const hcl = readReagent(note("Hydrochloric acid 37"));
    expect(hcl.reagent).toEqual({ mw: 36.46, purity: 37, density: 1.19 });
    expect(hcl.pKa).toBe(-6.3);
    expect(bottleMolarity(hcl.reagent).value).toBeCloseTo(12.08, 2);
    const naoh = readReagent(note("Sodium hydroxide 50"));
    expect(naoh.kind).toBe("base");
    expect(naoh.pKa).toBe(14);
    expect(bottleMolarity(naoh.reagent).value).toBeCloseTo(19.0, 2);
  });
});

describe("a molarity reagent", () => {
  it("Concentration with a comma-decimal density; Molar mass counts as MW; Acid is case-free", () => {
    const r = readReagent(note("HCl stock 1 M"));
    expect(r.reagent).toEqual({ mw: 36.46, concentration: 1, density: 1.015 });
    expect(r.basis).toBe("concentration");
    expect(r.kind).toBe("acid");
    expect(r.missing).toEqual([]);
    expect(molesPerGram(r.reagent).value).toBeCloseTo(1 / 1015, 9);
  });
  it("no Density is reported, not guessed", () => {
    const r = readReagent({ Concentration: 1, pKa: 4.76, "Acid / base": "acid" });
    expect(r.basis).toBe("concentration");
    expect(r.missing).toEqual(["density"]);
  });
  it("a molarity reagent needs no MW", () => {
    expect(readReagent({ Concentration: 1, Density: 1, pKa: 4, "Acid / base": "acid" }).missing).toEqual([]);
  });
});

describe("Purity and Concentration together", () => {
  it("is a conflict: no basis, nothing else reported about the amount", () => {
    const r = readReagent(note("Both given"));
    expect(r.conflict).toBe(true);
    expect(r.basis).toBeNull();
    expect(r.missing).toEqual([]);
    expect(molesPerGram(r.reagent).conflict).toBe(true);
  });
});

describe("missing and old notes", () => {
  it("the blank template reads as everything missing (empty fields are not a conflict)", () => {
    const r = readReagent(note("Blank template"));
    expect(r.conflict).toBe(false);
    expect(r.basis).toBeNull();
    expect(r.reagent).toEqual({});
    expect(r.missing).toEqual(["purity", "mw", "pKa", "kind"]);
    expect(r.invalid).toEqual([]);
    expect(isReagentNote(note("Blank template"))).toBe(false);
  });
  it("an old note (no new fields) still reads its MW and Density; Purity is missing, not 100 %", () => {
    const r = readReagent(note("Old note"));
    expect(r.reagent).toEqual({ mw: 92.14, density: 0.87 });
    expect(r.missing).toEqual(["purity", "pKa", "kind"]);
    expect(isReagentNote(note("Old note"))).toBe(false);
  });
  it("no front matter at all", () => {
    expect(readReagent(undefined).missing).toEqual(["purity", "mw", "pKa", "kind"]);
  });
  it("the user's own MW property name is tried first", () => {
    expect(readReagent(note("Odd values")).reagent.mw).toBeUndefined();
    expect(readReagent(note("Odd values"), "Mol. wt").reagent.mw).toBe(100.5);
    expect(readReagent({ "Mol. wt": 50, "Molecular weight": 99 }, "mol. wt").reagent.mw).toBe(50);
  });
  it("picker: a note with Acid / base set is a reagent note", () => {
    expect(isReagentNote(note("Acetic acid"))).toBe(true);
    expect(isReagentNote({ "Acid/base": "base" })).toBe(true);
  });
});

describe("filled in but unusable", () => {
  it("reports the field, keeps the rest, takes the first pKa", () => {
    const r = readReagent(note("Odd values"), "Mol. wt");
    expect(r.invalid).toEqual(["purity", "concentration", "density", "kind"]);
    expect(r.reagent).toEqual({ mw: 100.5 });
    expect(r.pKa).toBe(4.76);
    expect(r.kind).toBeUndefined();
    expect(r.missing).toEqual([]);
  });
  it("purity over 100 or zero, and a negative MW", () => {
    expect(readReagent({ Purity: 150, "Molecular weight": 60, pKa: 4, "Acid / base": "acid" }).invalid).toEqual(["purity"]);
    expect(readReagent({ Purity: 0 }).invalid).toEqual(["purity"]);
    expect(readReagent({ MW: -5 }).invalid).toEqual(["mw"]);
  });
  it("pKa as a list uses the first", () => {
    expect(readReagent({ pKa: [4.76, 9.25] }).pKa).toBe(4.76);
  });
});

describe("the Chemical database template", () => {
  it("has Purity, Concentration, pKa and Acid / base after Density, empty, and nothing else new", () => {
    const t = readFileSync("kits/lab/Templates/Chemical database template.md", "utf8");
    const keys = t.split("\n").filter(l => /^[^\s-][^:]*:/.test(l)).map(l => l.split(":")[0]);
    expect(keys.slice(keys.indexOf("Density"))).toEqual(["Density", "Purity", "Concentration", "pKa", "Acid / base"]);
    expect(isReagentNote(frontMatter("kits/lab/Templates/Chemical database template.md"))).toBe(false);
    expect(readReagent(frontMatter("kits/lab/Templates/Chemical database template.md")).conflict).toBe(false);
  });
});
