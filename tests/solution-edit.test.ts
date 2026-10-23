// Solution prep Phase 4: typing an actual writes its own line (byte for byte elsewhere), the block redraws and moves on; a missing reagent property is asked once and saved.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { createRequire } from "node:module";
import { TFile, Notice } from "obsidian";
import { actualText, cellsOf, nextCell } from "../src/solution/edit";
import { askReagent, noteKey, reagentQuestions, reagentValues } from "../src/solution/ask-reagent";
import { blockRange, writeActual } from "../src/solution/block";
import { SolutionRenderer } from "../src/solution/render";
import { buildView } from "../src/solution/view";
import { readReagent } from "../src/solution/reagent";

const { El } = createRequire(import.meta.url)("./helpers/minidom.cjs");
const tick = (): Promise<void> => new Promise(r => setTimeout(r, 0));
const ticks = async (n = 6): Promise<void> => { for (let i = 0; i < n; i++) await tick(); };
const noteText = (f: string): string => readFileSync(`tests/fixtures/solution/${f}`, "utf8");
const fenceLine = (note: string): number => note.split("\n").findIndex(l => l.startsWith("```solution"));

/** Just enough YAML for the saved chemical notes. */
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

describe("what a typed text becomes", () => {
  it("a bare number takes the row's unit, the number stays as typed", () => {
    expect(actualText("1.30", "mg")).toBe("1.30 mg");
    expect(actualText("18.0012", "g")).toBe("18.0012 g");
    expect(actualText(" 1.3mg ", "mg")).toBe("1.3 mg");
    expect(actualText("0.0013 g", "mg")).toBe("0.0013 g");
  });
  it("empty clears; anything that is not a mass is refused", () => {
    expect(actualText("  ", "g")).toBe("");
    expect(actualText("abc", "g")).toBeNull();
    expect(actualText("5 mL", "g")).toBeNull();
    expect(actualText("5 %", "g")).toBeNull();
  });
});

describe("the next cell", () => {
  const cells = [{ value: "1.30 mg" }, { value: "" }, { value: "9 g" }, { value: "" }].map(c => ({ ...c, field: { step: "", key: "", unit: "g" } }));
  it("Enter goes to the next empty one, Tab to the next, Shift+Tab back", () => {
    expect(nextCell(cells, 0, "enter")).toBe(1);
    expect(nextCell(cells, 1, "enter")).toBe(3);
    expect(nextCell(cells, 3, "enter")).toBeNull();
    expect(nextCell(cells, 1, "tab")).toBe(2);
    expect(nextCell(cells, 2, "back")).toBe(1);
    expect(nextCell(cells, 0, "back")).toBeNull();
  });
});

describe("writing an actual", () => {
  const half = noteText("acid-ph4-half.md");
  const line = fenceLine(half);
  const blank1 = half.replace("  acid: 1.30 mg", "  acid:").replace("  water-to: 18.0012 g", "  water-to:");
  it("typing 1.30 mg then 18.0012 g writes exactly those two lines, nothing else changes", () => {
    const a = writeActual(blank1, line, "step 1", "acid", "1.30 mg")!;
    const b = writeActual(a, line, "step 1", "water-to", "18.0012 g")!;
    expect(b).toBe(half);
    expect(a).toBe(blank1.replace("  acid:", "  acid: 1.30 mg"));
  });
  it("a changed value changes its own line only (comment and text around the block stay)", () => {
    const full = noteText("acid-ph4.md");
    const out = writeActual(full, fenceLine(full), "step 2", "water", "5.9986 g")!;
    expect(out).toBe(full.replace("  water: 6.00 g", "  water: 5.9986 g"));
  });
  it("a block from a newer plugin is not written", () => {
    expect(writeActual(half.replace("format: 1", "format: 2"), line, "step 1", "acid", "1 mg")).toBeNull();
  });
  it("the status moves to step 2 of 2 and the estimate to 3.99 once step 1 is typed", () => {
    const lookup = (name: string) => ({ name, read: readReagent(chemFm(name)!) });
    const empty = buildView(blockRange(blank1, line)!.source, lookup);
    expect(empty.status).toBe("in progress · step 1 of 2");
    expect(empty.estimate).toBeNull();
    const typed = buildView(blockRange(half, line)!.source, lookup);
    expect(typed.status).toBe("in progress · step 2 of 2");
    expect(typed.estimate?.pH).toBe("3.99");
    expect(cellsOf(typed).map(c => c.field.key)).toEqual(["acid", "water-to", "acid-solution", "water"]);
  });
});

/** A renderer on a fake vault holding `notes`; returns the drawn block and the notes. */
function setup(note: string, opts: { form?: any; fms?: Record<string, Record<string, unknown>> } = {}) {
  const notes: Record<string, string> = { "Lab/0042.md": note };
  const fms = opts.fms ?? {};
  let modify: ((f: { path: string }) => void) | undefined;
  let proc: ((src: string, el: any, ctx: any) => void) | undefined;
  const chemFiles: Record<string, TFile> = {};
  const chemOf = (n: string): TFile | null => (chemFm(n) || fms[n]) ? (chemFiles[n] ??= new TFile({ path: `Chem/${n}.md`, basename: n })) : null;
  const app: any = {
    vault: {
      getAbstractFileByPath: (p: string) => p in notes ? new TFile({ path: p }) : Object.values(chemFiles).find(f => f.path === p) ?? null,
      cachedRead: async (f: TFile) => notes[f.path],
      process: async (f: TFile, fn: (d: string) => string) => { notes[f.path] = fn(notes[f.path]); },
      on: (_e: string, fn: typeof modify) => { modify = fn; return {}; },
    },
    fileManager: { processFrontMatter: async (f: TFile, fn: (fm: Record<string, unknown>) => void) => { const n = f.basename; fms[n] ??= { ...(chemFm(n) ?? {}) }; fn(fms[n]); } },
    metadataCache: { getFirstLinkpathDest: (n: string) => chemOf(n), getFileCache: (f: TFile) => ({ frontmatter: fms[f.basename] ?? chemFm(f.basename) }), on: () => ({}) },
  };
  const plugin: any = { app, registerMarkdownCodeBlockProcessor: (_n: string, fn: any) => { proc = fn; }, registerEvent() { /* nothing to clean up */ } };
  const renderer = new SolutionRenderer(plugin, () => ({}), opts.form ?? null);
  renderer.register();
  const el = new El("div");
  const src = blockRange(note, fenceLine(note))!.source;
  proc!(src, el, { sourcePath: "Lab/0042.md", getSectionInfo: () => ({ lineStart: fenceLine(notes["Lab/0042.md"]) }), addChild: (c: any) => c.onload() });
  return { el, notes, fms, modify: () => modify!({ path: "Lab/0042.md" }) };
}
const actualCells = (el: any): any[] => el.querySelectorAll(".lk-sol-cell.is-actual");
const press = (el: any, key: string, extra: object = {}): void => { el.querySelector(".lk-sol-input").dispatch("keydown", { key, ...extra }); };

describe("the block in the note", () => {
  const half = noteText("acid-ph4-half.md");
  it("click, type, Enter writes that one line, redraws, and opens the next empty cell", async () => {
    const t = setup(half);
    await tick();
    expect(actualCells(t.el)[2].classList.contains("is-empty")).toBe(true);
    actualCells(t.el)[2].dispatch("click");
    const input = t.el.querySelector(".lk-sol-input");
    input.value = "9.0031";
    press(t.el, "Enter");
    await ticks();
    expect(t.notes["Lab/0042.md"]).toBe(half.replace("  acid-solution:", "  acid-solution: 9.0031 g"));
    expect(actualCells(t.el)[2].textContent).toBe("9.0031 g");
    expect(actualCells(t.el)[3].querySelector(".lk-sol-input")).not.toBeNull();   // moved on
    t.el.querySelector(".lk-sol-input").value = "5.9986";
    press(t.el, "Enter");
    await ticks();
    expect(t.notes["Lab/0042.md"]).toBe(half.replace("  acid-solution:", "  acid-solution: 9.0031 g").replace("  water:", "  water: 5.9986 g"));
    expect(t.el.querySelector(".lk-sol-chip").textContent).toBe("done");
    expect(t.el.querySelector(".lk-sol-input")).toBeNull();
  });
  it("Esc writes nothing; a text that is not a mass stays open and writes nothing", async () => {
    const t = setup(half);
    await tick();
    actualCells(t.el)[2].dispatch("click");
    t.el.querySelector(".lk-sol-input").value = "abc";
    press(t.el, "Enter");
    await ticks();
    expect(t.notes["Lab/0042.md"]).toBe(half);
    expect(t.el.querySelector(".lk-sol-input").classList.contains("is-bad")).toBe(true);
    expect(t.el.querySelector(".lk-sol-err").textContent).toBe("Not a mass: use g or mg.");
    expect(t.el.querySelectorAll(".lk-sol-err")).toHaveLength(1);
    press(t.el, "Escape");
    await ticks();
    expect(t.notes["Lab/0042.md"]).toBe(half);
    expect(t.el.querySelector(".lk-sol-input")).toBeNull();
  });
  it("Shift+Tab moves back and saves a changed value; an unchanged value writes nothing", async () => {
    const t = setup(half);
    await tick();
    actualCells(t.el)[1].dispatch("click");
    press(t.el, "Tab", { shiftKey: true });   // unchanged: no write
    await ticks();
    expect(t.notes["Lab/0042.md"]).toBe(half);
    expect(actualCells(t.el)[0].querySelector(".lk-sol-input")).not.toBeNull();
    t.el.querySelector(".lk-sol-input").value = "1.40 mg";
    press(t.el, "Enter");
    await ticks();
    expect(t.notes["Lab/0042.md"]).toBe(half.replace("acid: 1.30 mg", "acid: 1.40 mg"));
  });
  it("a hand edit in source view redraws the block", async () => {
    const t = setup(half);
    await tick();
    t.notes["Lab/0042.md"] = half.replace("  water:", "  water: 6.00 g").replace("  acid-solution:", "  acid-solution: 9.00 g");
    t.modify();
    await new Promise(r => setTimeout(r, 300));
    expect(t.el.querySelector(".lk-sol-chip").textContent).toBe("done");
  });
});

describe("a missing reagent property is asked once and saved in the chemical note", () => {
  it("the questions, and the values to write (numbers as numbers)", () => {
    const q = reagentQuestions(["purity", "density", "kind"]);
    expect(q.map(f => [f.key, f.label, f.hint ?? ""])).toEqual([["purity", "Purity", "wt%"], ["density", "Density", "g/mL"], ["kind", "Acid / base", ""]]);
    expect(reagentValues(["purity", "density", "kind", "pKa"], { purity: "99,7", density: "1.049 g/mL", kind: "Acid", pKa: "4.76" }).values)
      .toEqual({ Purity: 99.7, Density: 1.049, "Acid / base": "acid", pKa: 4.76 });
    const r = reagentValues(["purity", "density", "pKa"], { purity: "120", density: "-1", pKa: "x" });
    expect(r.values).toEqual({});
    expect(r.bad).toEqual(["purity", "density", "pKa"]);
  });
  it("writes under the name the note already has, else the template's; the user's MW name wins", () => {
    expect(noteKey("purity", ["purity", "Density"])).toBe("purity");
    expect(noteKey("kind", ["Acid/base"])).toBe("Acid/base");
    expect(noteKey("purity", [])).toBe("Purity");
    expect(noteKey("mw", ["MW"])).toBe("MW");
    expect(noteKey("mw", [], "Molar mass")).toBe("Molar mass");
    expect(noteKey("mw", [])).toBe("Molecular weight");
  });
  it("askReagent saves the answers with processFrontMatter and keeps the other properties", async () => {
    const fm: Record<string, unknown> = { Type: "Chemical database", Density: 1.049, Purity: null };
    const app: any = { fileManager: { processFrontMatter: async (_f: TFile, fn: (m: Record<string, unknown>) => void) => fn(fm) } };
    let asked: any[] = [];
    const form = async (_t: string, fields: any[]) => { asked = fields; return { purity: "99.7" }; };
    expect(await askReagent(app, form, new TFile({ path: "Chem/Acetic.md", basename: "Acetic" }), ["purity"])).toBe(true);
    expect(asked.map(f => f.key)).toEqual(["purity"]);
    expect(fm).toEqual({ Type: "Chemical database", Density: 1.049, Purity: 99.7 });
    expect(await askReagent(app, async () => null, new TFile(), ["purity"])).toBe(false);
  });
  it("a bad number is not saved and a notice says so", async () => {
    const fm: Record<string, unknown> = {};
    const app: any = { fileManager: { processFrontMatter: async (_f: TFile, fn: (m: Record<string, unknown>) => void) => fn(fm) } };
    const before = Notice.messages.length;
    expect(await askReagent(app, async () => ({ purity: "lots" }), new TFile(), ["purity"])).toBe(false);
    expect(fm).toEqual({});
    expect(Notice.messages.length).toBe(before + 1);
  });
  it("the block's missing-property line is clickable, asks, saves in the chemical note and redraws", async () => {
    const base = noteText("acid-ph4.md").replace("[[Acetic acid]]", "[[Blank template]]");
    let fields: any[] = [];
    const form = async (_t: string, f: any[]) => { fields = f; return { mw: "60.05", purity: "99.7", density: "1.049", pKa: "4.76", kind: "acid" }; };
    const t = setup(base, { form });
    await tick();
    const lines = t.el.querySelectorAll(".lk-sol-error");
    expect(lines.map((l: any) => l.textContent)).toContain('"Blank template" has no Purity: type it once, it is saved in the chemical note.');
    expect(lines.every((l: any) => l.tagName === "BUTTON")).toBe(true);
    lines[0].dispatch("click");
    await ticks();
    expect(fields.map(f => f.key)).toEqual(["purity", "mw", "pKa", "kind"]);
    expect(t.fms["Blank template"]).toMatchObject({ "Molecular weight": 60.05, Purity: 99.7, pKa: 4.76, "Acid / base": "acid" });
    expect(t.fms["Blank template"]["Density"]).toBeNull();   // not asked for a wt% reagent, left as it was
    await new Promise(r => setTimeout(r, 300));
    expect(t.el.querySelector(".lk-sol-title").textContent).toBe("Acid solution for pH 4.00");
  });
});
