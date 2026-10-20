// Solution prep Phase 5: the set-up window's answers as block text (Alt+S → Solution prep), Edit set-up rewrites only the changed lines, the small-acid warning.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { createRequire } from "node:module";
import { TFile, TFolder } from "obsidian";
import { DEFAULT_SETUP, reagentRow, setupChanges, setupLines, solutionBlock, solutionSource, valuesFromSetup, type SetupValues } from "../src/solution/setup-text";
import { reagentChoices, type SetupFn } from "../src/solution/setup";
import { blockRange, parseSolution, writeSetup } from "../src/solution/block";
import { SolutionRenderer } from "../src/solution/render";
import { buildView, TEXT } from "../src/solution/view";
import { readReagent } from "../src/solution/reagent";

const { El } = createRequire(import.meta.url)("./helpers/minidom.cjs");
const tick = (): Promise<void> => new Promise(r => setTimeout(r, 0));
const ticks = async (n = 6): Promise<void> => { for (let i = 0; i < n; i++) await tick(); };
const noteText = (f: string): string => readFileSync(`tests/fixtures/solution/${f}`, "utf8");
const fenceLine = (note: string): number => note.split("\n").findIndex(l => l.startsWith("```solution"));
function chemFm(name: string): Record<string, unknown> | null {
  let text: string;
  try { text = readFileSync(`tests/fixtures/solution/chemicals/${name}.md`, "utf8"); } catch { return null; }
  const fm: Record<string, unknown> = {};
  for (const line of text.split("\n---\n")[0].replace(/^---\n/, "").split("\n")) {
    const m = /^([^:]+):\s*(.*)$/.exec(line);
    if (m && !line.startsWith(" ")) fm[m[1].trim()] = m[2] === "" ? null : /^-?\d+(\.\d+)?$/.test(m[2]) ? Number(m[2]) : m[2];
  }
  return fm;
}
const LOOKUP = (name: string) => ({ name, read: chemFm(name) ? readReagent(chemFm(name)!) : null });
const picture: SetupValues = { ...DEFAULT_SETUP, reagent: "Acetic acid" };

describe("the window's answers as block text", () => {
  it("the picture's values give the saved fixture's block, empty actuals, byte for byte", () => {
    const r = setupLines(picture);
    expect("lines" in r).toBe(true);
    const fresh = noteText("acid-ph4-fresh.md");
    expect(solutionBlock((r as { lines: never }).lines)).toBe(fresh.slice(fresh.indexOf("```solution"), fresh.indexOf("```\n\nAfter") + 4));
    expect(blockRange(fresh, fenceLine(fresh))!.source).toBe(solutionSource((r as { lines: never }).lines));
  });
  it("a bare number takes the box's unit, percent signs are added, the number stays as typed", () => {
    const r = setupLines({ reagent: "[[Acetic acid]]", aqueous: "15", pH: "4.5", share: "60", use: "50%", balance: "0.1" });
    expect(r).toEqual({ lines: { reagent: "Acetic acid", aqueous: "15 g", pH: "4.5", share: "60 %", use: "50 %", balance: "0.1 mg" } });
  });
  it("names the first box that is not usable", () => {
    expect(setupLines({ ...picture, reagent: " " })).toMatchObject({ field: "reagent" });
    expect(setupLines({ ...picture, aqueous: "lots" })).toMatchObject({ field: "aqueous", problem: "Aqueous phase: not a usable value." });
    expect(setupLines({ ...picture, pH: "15" })).toMatchObject({ field: "pH" });
    expect(setupLines({ ...picture, share: "120" })).toMatchObject({ field: "share" });
    expect(setupLines({ ...picture, use: "0" })).toMatchObject({ field: "use" });
    expect(setupLines({ ...picture, balance: "0.1 mL" })).toMatchObject({ field: "balance" });
  });
  it("the inserted block draws as the fresh picture: step 1 of 2, targets, no estimate", () => {
    const fresh = noteText("acid-ph4-fresh.md");
    const v = buildView(blockRange(fresh, fenceLine(fresh))!.source, LOOKUP);
    expect(v.errors).toEqual([]);
    expect(v.status).toBe("in progress · step 1 of 2");
    expect(v.estimate).toBeNull();
    expect(v.title).toBe("Acid solution for pH 4.00");
    expect(v.steps[0].rows.map(r => r.target)).toEqual(["1.22 mg", "18.00 g"]);
  });
  it("reagent rows read like the picker: name · wt% · pKa; a molarity reagent shows its mol/L", () => {
    expect(reagentRow("Acetic acid", readReagent(chemFm("Acetic acid")!))).toBe("Acetic acid · 99.7 % · pKa 4.76");
    expect(reagentRow("HCl stock 1 M", readReagent(chemFm("HCl stock 1 M")!))).toMatch(/^HCl stock 1 M · 1 mol\/L/);
  });
  it("the picker lists the chemical notes of the folder, those with Acid / base first-class", () => {
    const names = ["Acetic acid", "Blank template", "Sodium hydroxide 50"];
    const files = names.map(n => new TFile({ path: `Chem/${n}.md`, basename: n }));
    const app: any = {
      vault: { getFolderByPath: (p: string) => p === "Chem" ? new TFolder({ path: "Chem", children: files }) : null },
      metadataCache: { getFileCache: (f: TFile) => ({ frontmatter: chemFm(f.basename) }) },
    };
    const c = reagentChoices(app, "Chem/");
    expect(c.map(x => [x.name, x.reagent, x.base])).toEqual([["Acetic acid", true, false], ["Blank template", false, false], ["Sodium hydroxide 50", true, true]]);
    expect(c.find(x => x.name === "Acetic acid")?.detail).toBe("99.7 % · pKa 4.76");
    expect(reagentChoices(app, "")).toEqual([]);
    expect(reagentChoices(app, "Nope")).toEqual([]);
  });
});

describe("Edit set-up", () => {
  const fresh = noteText("acid-ph4-fresh.md");
  it("changes only the boxes that changed, as block lines", () => {
    const before = valuesFromSetup(parseSolution(blockRange(fresh, fenceLine(fresh))!.source).setup);
    expect(before).toEqual(picture);
    expect(setupChanges(before, { ...before })).toEqual([]);   // nothing changed: nothing to write
    expect(setupChanges(before, { ...before, pH: "4.50" })).toEqual([["target-pH", "4.50"]]);   // the plan's example
    expect(setupChanges(before, { ...before, pH: "4.5", reagent: "Sodium hydroxide 50", share: "70" })).toEqual([["reagent", '"[[Sodium hydroxide 50]]"'], ["target-pH", "4.5"], ["share", "70 %"]]);
    expect(setupChanges(before, { ...before, aqueous: "oops" })).toEqual([]);
  });
  it("pH 4.50 → 4.75 rewrites target-pH only, every other byte stays", () => {
    const out = writeSetup(fresh, fenceLine(fresh), "target-pH", "4.75")!;
    expect(out).toBe(fresh.replace("target-pH: 4.00", "target-pH: 4.75"));
  });
  it("the block's button opens the window with the block's set-up and Save writes one line, keeping typed actuals", async () => {
    const half = noteText("acid-ph4-half.md");
    const notes: Record<string, string> = { "Lab/0042.md": half };
    const asked: any[] = [];
    const setup: SetupFn = async (_a, init) => { asked.push(init); return { values: { ...init.values, pH: "4.5" }, lines: {} as never }; };
    const app: any = {
      vault: { getAbstractFileByPath: (p: string) => p in notes ? new TFile({ path: p }) : null, cachedRead: async (f: TFile) => notes[f.path], process: async (f: TFile, fn: (d: string) => string) => { notes[f.path] = fn(notes[f.path]); }, on: () => ({}), getFolderByPath: () => null },
      metadataCache: { getFirstLinkpathDest: (n: string) => chemFm(n) ? new TFile({ path: `Chem/${n}.md`, basename: n }) : null, getFileCache: (f: TFile) => ({ frontmatter: chemFm(f.basename) }), on: () => ({}) },
    };
    let proc: any;
    const plugin: any = { app, registerMarkdownCodeBlockProcessor: (_n: string, fn: any) => { proc = fn; }, registerEvent() { /* nothing */ } };
    new SolutionRenderer(plugin, () => ({}), null, setup).register();
    const el = new El("div");
    proc(blockRange(half, fenceLine(half))!.source, el, { sourcePath: "Lab/0042.md", getSectionInfo: () => ({ lineStart: fenceLine(notes["Lab/0042.md"]) }), addChild: (c: any) => c.onload() });
    await tick();
    const btn = el.querySelector(".lk-sol-edit");
    expect(btn.textContent).toBe("Edit set-up");
    btn.dispatch("click");
    await ticks();
    expect(asked[0].values).toEqual({ ...picture, pH: "4.00" });
    expect([asked[0].submit, asked[0].hint]).toEqual(["Save", "Enter saves · Esc closes"]);
    expect(notes["Lab/0042.md"]).toBe(half.replace("target-pH: 4.00", "target-pH: 4.5"));
    expect(el.querySelector(".lk-sol-chip").textContent).toBe("in progress · step 2 of 2");   // the typed actuals stay
    expect(el.querySelector(".lk-sol-step-title").textContent).toContain("1. Make");
  });
  it("Cancel writes nothing", async () => {
    const half = noteText("acid-ph4-half.md");
    const notes: Record<string, string> = { "Lab/0042.md": half };
    const app: any = {
      vault: { getAbstractFileByPath: (p: string) => p in notes ? new TFile({ path: p }) : null, cachedRead: async (f: TFile) => notes[f.path], process: async () => { throw new Error("no write expected"); }, on: () => ({}), getFolderByPath: () => null },
      metadataCache: { getFirstLinkpathDest: (n: string) => chemFm(n) ? new TFile({ path: `Chem/${n}.md`, basename: n }) : null, getFileCache: (f: TFile) => ({ frontmatter: chemFm(f.basename) }), on: () => ({}) },
    };
    let proc: any;
    const plugin: any = { app, registerMarkdownCodeBlockProcessor: (_n: string, fn: any) => { proc = fn; }, registerEvent() { /* nothing */ } };
    new SolutionRenderer(plugin, () => ({}), null, async () => null).register();
    const el = new El("div");
    proc(blockRange(half, fenceLine(half))!.source, el, { sourcePath: "Lab/0042.md", getSectionInfo: () => ({ lineStart: fenceLine(half) }), addChild: (c: any) => c.onload() });
    await tick();
    el.querySelector(".lk-sol-edit").dispatch("click");
    await ticks();
    expect(notes["Lab/0042.md"]).toBe(half);
  });
});

describe("the small-acid warning (Q4)", () => {
  const fresh = blockRange(noteText("acid-ph4-fresh.md"), fenceLine(noteText("acid-ph4-fresh.md")))!.source;
  it("pH 4.00 on a 0.1 mg balance: 1.22 mg is enough, no warning", () => {
    expect(buildView(fresh, LOOKUP).warning).toBe("");
  });
  it("pH 4.50 needs 0.161 mg: the line names the ± of the balance and a batch that brings it to 10 readabilities", () => {
    const v = buildView(fresh.replace("target-pH: 4.00", "target-pH: 4.50"), LOOKUP);
    expect(v.warning).toBe("Acid to weigh is small for your balance (±62 %): make 112 g and use 8 %.");
    expect(v.warning).toBe(TEXT.small(false, "62", "112", "8"));
  });
  it("a base says Base, and a better balance clears the warning", () => {
    const naOH = fresh.replace("[[Acetic acid]]", "[[Sodium hydroxide 50]]").replace("target-pH: 4.00", "target-pH: 10.00").replace("aqueous: 15.00 g", "aqueous: 0.50 g");
    expect(buildView(naOH, LOOKUP).warning).toMatch(/^Base to weigh is small for your balance/);
    expect(buildView(fresh.replace("target-pH: 4.00", "target-pH: 4.50").replace("balance: 0.1 mg", "balance: 0.01 mg"), LOOKUP).warning).toBe("");
  });
});
