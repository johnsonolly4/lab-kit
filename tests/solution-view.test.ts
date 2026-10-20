// Solution prep Phase 3: the ```solution block as a view model and as DOM (div rows, no <table>). Fixtures: tests/fixtures/solution/.
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "fs";
import { createRequire } from "node:module";
import { TFile } from "obsidian";
import { buildView, type ReagentLookup } from "../src/solution/view";
import { drawView, SolutionRenderer } from "../src/solution/render";
import { readReagent } from "../src/solution/reagent";
import { blockRange } from "../src/solution/block";
import { acidRecipe, pHFromMasses } from "../src/solution/acid";

const { El } = createRequire(import.meta.url)("./helpers/minidom.cjs");
const tick = (): Promise<void> => new Promise(r => setTimeout(r, 0));

/** Just enough YAML for the saved chemical notes (as in solution-reagent.test.ts). */
function frontMatter(path: string): Record<string, unknown> {
  const body = readFileSync(path, "utf8").split("\n---\n")[0].replace(/^---\n/, "");
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
const chem = (name: string): Record<string, unknown> | null => { try { return frontMatter(`tests/fixtures/solution/chemicals/${name}.md`); } catch { return null; } };
const lookup = (name: string): ReagentLookup => { const fm = chem(name); return { name, read: fm ? readReagent(fm) : null }; };
const noteText = (f: string): string => readFileSync(`tests/fixtures/solution/${f}`, "utf8");
const sourceOf = (f: string): string => blockRange(noteText(f), noteText(f).split("\n").findIndex(l => l.startsWith("```solution")))!.source;

/** The drawn block as lines: rows as `a | b | c`, other blocks as their text. */
function textOf(el: any): string[] {
  const out: string[] = [];
  const walk = (e: any): void => {
    if (e.classList.contains("lk-sol-row")) { out.push(e.children.map((c: any) => c.textContent).join(" | ")); return; }
    if (e.children.length && e.children.every((c: any) => c.tagName === "SPAN")) { out.push(e.children.map((c: any) => c.textContent).join(" ").replace(/\s+/g, " ")); return; }
    if (!e.children.length) { out.push(e.textContent); return; }
    e.children.forEach(walk);
  };
  walk(el);
  return out;
}
const draw = (view: ReturnType<typeof buildView>) => { const host = new El("div"); drawView(host, view); return host; };

describe("fixture note acid-ph4-half.md (the picture)", () => {
  const view = buildView(sourceOf("acid-ph4-half.md"), lookup);
  it("has the picture's numbers", () => {
    expect(view.errors).toEqual([]);
    expect(view.title).toBe("Acid solution for pH 4.00");
    expect(view.status).toBe("in progress · step 2 of 2");
    expect(view.steps[0].rows.map(r => [r.target, r.actual])).toEqual([["1.22 mg", "1.30 mg"], ["18.00 g", "18.0012 g"]]);
    expect(view.steps[1].rows.map(r => [r.target, r.actual])).toEqual([["9.00 g", ""], ["6.00 g", ""]]);
    expect(view.estimate?.pH).toBe("3.99");
  });
  it("estimate matches the maths with the actuals (plan: 3.985)", () => {
    const r = readReagent(chem("Acetic acid")!);
    const rec = acidRecipe({ aqueousG: 15, pH: 4, share: 0.6, use: 0.5, reagent: r.reagent, pKa: 4.76, kind: "acid", readabilityG: 0.0001 });
    expect(rec.acidG! * 1000).toBeCloseTo(1.2205, 4);
    expect(pHFromMasses({ acidG: 0.0013, madeG: 18.0012, solutionG: 9, aqueousG: 15 }, r.reagent, 4.76)).toBeCloseTo(3.985, 3);
  });
  it("draws as the saved expected text, with div rows and no table", () => {
    const host = draw(view);
    expect(textOf(host).join("\n")).toBe(readFileSync("tests/fixtures/solution/acid-ph4-half.expected.txt", "utf8").trimEnd());
    expect(host.querySelectorAll("table")).toHaveLength(0);
    expect(host.querySelectorAll("td")).toHaveLength(0);
    for (const e of host.all()) for (const c of e.classList.s) expect(c.startsWith("lk-sol") || c.startsWith("is-")).toBe(true);
  });
});

describe("states", () => {
  const base = sourceOf("acid-ph4.md");
  it("nothing typed: step 1 of 2, no estimate, empty actual cells", () => {
    const v = buildView(base.replace(/^ {2}acid: .*$/m, "  acid:").replace(/^ {2}water-to: .*$/m, "  water-to:").replace(/^ {2}acid-solution: .*$/m, "").replace(/^ {2}water: .*$/m, ""), lookup);
    expect(v.status).toBe("in progress · step 1 of 2");
    expect(v.estimate).toBeNull();
    expect(v.steps.flatMap(s => s.rows.map(r => r.actual))).toEqual(["", "", "", ""]);
  });
  it("all four typed: done, both steps ticked", () => {
    const v = buildView(base, lookup);
    expect(v.status).toBe("done");
    expect(v.steps.every(s => s.done && s.title.endsWith("✓"))).toBe(true);
  });
  it("a bare number takes the row's unit", () => {
    const v = buildView(base.replace("acid: 1.30 mg", "acid: 1.30"), lookup);
    expect(v.steps[0].rows[0].actual).toBe("1.30 mg");
  });
  it("a block from a newer plugin shows one line and nothing else", () => {
    const v = buildView(base.replace("format: 1", "format: 2"), lookup);
    expect(v.newer).toBe("Made with a newer Lab Kit: update the plugin.");
    expect(textOf(draw(v))).toEqual(["Made with a newer Lab Kit: update the plugin."]);
  });
  it("a block without a format line is read as version 1 (not newer)", () => {
    const v = buildView(sourceOf("acid-ph4-no-format.md"), lookup);
    expect(v.newer).toBeNull();
    expect(v.errors).toContain("no reagent given");
  });
  it("errors: no note, missing pKa, both Purity and Concentration", () => {
    expect(buildView(base.replace("[[Acetic acid]]", "[[Nope]]"), lookup).errors).toEqual(['no note called "Nope"']);
    expect(buildView(base.replace("[[Acetic acid]]", "[[Blank template]]"), lookup).errors).toContain('"Blank template" has no pKa');
    expect(buildView(base.replace("[[Acetic acid]]", "[[Both given]]"), lookup).errors.join()).toContain("use one");
  });
  it("a base reads 'Base solution for pH …'", () => {
    const v = buildView(base.replace("[[Acetic acid]]", "[[Sodium hydroxide 50]]").replace("target-pH: 4.00", "target-pH: 10.00"), lookup);
    expect(v.errors).toEqual([]);
    expect(v.title).toBe("Base solution for pH 10.00");
  });
  it("a molarity reagent says its mol/L", () => {
    const v = buildView(base.replace("[[Acetic acid]]", "[[HCl stock 1 M]]"), lookup);
    expect(v.errors).toEqual([]);
    expect(v.summary).toContain("mol/L");
  });
});

describe("the processor", () => {
  afterEach(() => { vi.restoreAllMocks(); });
  it("draws the block of a note from the vault and redraws on a hand edit", async () => {
    const note = noteText("acid-ph4.md");
    const notes: Record<string, string> = { "Lab/0042.md": note };
    let modify: ((f: { path: string }) => void) | undefined;
    let proc: ((src: string, el: any, ctx: any) => void) | undefined;
    const app: any = {
      vault: { getAbstractFileByPath: (p: string) => p in notes ? new TFile({ path: p }) : null, cachedRead: async (f: TFile) => notes[f.path], on: (_e: string, fn: typeof modify) => { modify = fn; return {}; } },
      metadataCache: { getFirstLinkpathDest: (n: string) => chem(n) ? new TFile({ path: `Chem/${n}.md` }) : null, getFileCache: (f: TFile) => ({ frontmatter: chem(f.path.replace(/^Chem\/|\.md$/g, "")) }), on: () => ({}) },
    };
    const plugin: any = { app, registerMarkdownCodeBlockProcessor: (_n: string, fn: any) => { proc = fn; }, registerEvent() { /* nothing to clean up */ } };
    new SolutionRenderer(plugin).register();
    const el = new El("div");
    const line = note.split("\n").findIndex(l => l.startsWith("```solution"));
    proc!(sourceOf("acid-ph4.md"), el, { sourcePath: "Lab/0042.md", getSectionInfo: () => ({ lineStart: line }), addChild: (c: any) => c.onload() });
    await tick();
    expect(el.querySelectorAll(".lk-sol-step")).toHaveLength(2);
    expect(el.querySelector(".lk-sol-title").textContent).toBe("Acid solution for pH 4.00");
    vi.useFakeTimers();
    notes["Lab/0042.md"] = note.replace("target-pH: 4.00", "target-pH: 4.50");
    modify!({ path: "Lab/0042.md" });
    await vi.advanceTimersByTimeAsync(300);
    vi.useRealTimers();
    await tick();
    expect(el.querySelector(".lk-sol-title").textContent).toBe("Acid solution for pH 4.50");
  });
});

describe("styles.css", () => {
  it("every solution rule is scoped under .lk-sol and uses a shape variable, never a number", () => {
    const css = readFileSync("styles.css", "utf8");
    const at = css.indexOf("Solution prep: the ```solution block");
    const part = css.slice(css.lastIndexOf("/*", at)).replace(/\/\*[\s\S]*?\*\//g, "").replace(/@media[^{]*\{/, "");
    const rules = [...part.matchAll(/(^|\})\s*([^{}@]+)\{([^}]*)\}/g)];
    expect(rules.length).toBeGreaterThan(10);
    for (const r of rules) {
      for (const sel of r[2].split(",")) expect(sel.trim().startsWith(".lk-sol")).toBe(true);
      expect(/border-radius:\s*\d/.test(r[3])).toBe(false);
    }
    expect(/\btable\b|\btd\b|\bth\b/.test(part)).toBe(false);
  });
});
