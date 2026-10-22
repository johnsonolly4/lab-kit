// Alt+S for token templates: the runner (header → form → filled text) on a stub app, and the chemical-class filter.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Notice, TFile, TFolder } from "obsidian";
import { SnippetTemplates, type SnippetTp } from "../src/kit/snippet-run";
import { chemicalClasses, classFilter, codeFormParts, codeSources, makeEnv, resolveCodes, type Chem } from "../src/kit/snippet-env";
import { parseTemplate, TemplateError } from "../src/kit/snippet-template";
import { KIT_DEFAULTS, type KitData } from "../src/kit/paths";
import type { FormFn } from "../src/kit/snippet-form";
import type { SetupFn, SetupInit } from "../src/solution/setup";
import { DEFAULT_SETUP, solutionBlock } from "../src/solution/setup-text";

// The calculators themselves are tested in snippet-port.test.ts; here only which key SnippetTemplates hands them, and with what.
const calc = vi.hoisted(() => ({ out: "", calls: [] as { key: string; ctx: { file: unknown; form: unknown; today: () => string } }[] }));
vi.mock("../src/snippets/run", () => ({ runCalculator: async (ctx: never, key: string) => { calc.calls.push({ key, ctx }); return calc.out; } }));

const json = (s: string): unknown => JSON.parse(s);
const header = (o: object, body: string): string => `---\n${JSON.stringify(o)}\n---\n${body}`;

const CHEMS: Chem[] = [
  { name: "Acetone", aliases: [], classes: ["Solvent"] },
  { name: "Methyl acrylate", aliases: ["MA"], classes: ["monomer", "reagent"] },
  { name: "AIBN", aliases: [], classes: ["initiator"] },
  { name: "Mystery", aliases: [] },
];

describe("chemicalClasses", () => {
  it("lists each class once, sorted, ignoring capitals and blanks", () => {
    expect(chemicalClasses([["solvent"], ["Monomer", " "], ["Solvent", "initiator"], []])).toEqual(["initiator", "Monomer", "solvent"]);
    expect(chemicalClasses([])).toEqual([]);
  });
});

describe("classFilter", () => {
  it("no class asked: everything, unchanged order", () => {
    expect(classFilter(CHEMS, undefined, true).map(c => c.name)).toEqual(["Acetone", "Methyl acrylate", "AIBN", "Mystery"]);
  });
  it("only: just the matching class, ignoring case", () => {
    expect(classFilter(CHEMS, ["solvent"], true).map(c => c.name)).toEqual(["Acetone"]);
  });
  it("class first: matching ones, then the rest", () => {
    expect(classFilter(CHEMS, ["initiator"], false).map(c => c.name)).toEqual(["AIBN", "Acetone", "Methyl acrylate", "Mystery"]);
  });
  it("a chemical with a list of classes matches any of them; a field may ask for several classes", () => {
    expect(classFilter(CHEMS, ["reagent"], true).map(c => c.name)).toEqual(["Methyl acrylate"]);
    expect(classFilter(CHEMS, ["solvent", "initiator"], true).map(c => c.name)).toEqual(["Acetone", "AIBN"]);
  });
  it("a class nobody has yet is allowed: nothing matches (only) or order unchanged (class first)", () => {
    expect(classFilter(CHEMS, ["zzz-new-class"], true)).toEqual([]);
    expect(classFilter(CHEMS, ["zzz-new-class"], false).map(c => c.name)).toEqual(["Acetone", "Methyl acrylate", "AIBN", "Mystery"]);
  });
  it("hands the form only name and aliases", () => {
    expect(classFilter(CHEMS, ["monomer"], true)).toEqual([{ name: "Methyl acrylate", aliases: ["MA"] }]);
  });
});

describe("header: suggest and class", () => {
  const parse = (fields: object[]) => parseTemplate(header({ fields }, "x"), json);
  it("reads suggest: chemicals with one class, a list of classes, or none", () => {
    const p = parse([
      { key: "a", suggest: "chemicals", class: "monomer" },
      { key: "b", suggest: "chemicals", class: ["a new class", "other"] },
      { key: "c", suggest: "chemicals" },
      { key: "d" },
    ])!;
    const [a, b, c, d] = p.header.fields;
    expect(a).toMatchObject({ suggest: "chemicals", classes: ["monomer"] });
    expect(b.classes).toEqual(["a new class", "other"]);
    expect(c.suggest).toBe("chemicals"); expect(c.classes).toBeUndefined();
    expect(d.suggest).toBeUndefined();
  });
  it("accepts any class name; rejects an unknown suggest, an empty class, a class without suggest", () => {
    expect(() => parse([{ key: "a", suggest: "chemicals", class: "zzz-new-class" }])).not.toThrow();
    expect(() => parse([{ key: "a", suggest: "people" }])).toThrow(TemplateError);
    expect(() => parse([{ key: "a", suggest: "chemicals", class: [""] }])).toThrow(TemplateError);
    expect(() => parse([{ key: "a", class: "monomer" }])).toThrow(TemplateError);
  });
  it("suggest: codes is accepted; class with it and a clash with its Codes from key are not", () => {
    expect(parse([{ key: "codes", suggest: "codes" }])!.header.fields[0].suggest).toBe("codes");
    expect(() => parse([{ key: "codes", suggest: "codes", class: "monomer" }])).toThrow(TemplateError);
    expect(() => parse([{ key: "codes", suggest: "codes" }, { key: "codes_from" }])).toThrow(TemplateError);
    expect(() => parse([{ key: "codes" }, { key: "codes_from" }])).not.toThrow();
  });
});

const F3 = "```";
const SAMPLES = `${F3}calc\nname: samples\ntitle: Sample list\ncodes: column A\n| Code | Note |\n|---|---|\n| ABC0016-A | x |\n| ABC0016-B | y |\n${F3}\n`;
const TIMES = `${F3}calc\nname: sampling\ntitle: Sampling timetable\n| Code | Time |\n|---|---|\n| ABC0016-A0 | 0 |\n| ABC0016-A30 | 30 |\n${F3}\n`;
const MATRIX = `${F3}calc\nname: variants\ntitle: Variant naming matrix\ncodes: cells\n| | x | y |\n|---|---|---|\n| a | ABC0016-C | ABC0016-D |\n${F3}\n`;

describe("codeSources (suggest: codes)", () => {
  it("reads codes: column A, codes: cells and older tables named like samples / sampling", () => {
    expect(codeSources(SAMPLES)).toEqual([{ label: "Sample list", codes: ["ABC0016-A", "ABC0016-B"] }]);
    expect(codeSources(TIMES)).toEqual([{ label: "Sampling timetable", codes: ["ABC0016-A0", "ABC0016-A30"] }]);
    expect(codeSources(MATRIX)).toEqual([{ label: "Variant naming matrix", codes: ["ABC0016-C", "ABC0016-D"] }]);
    expect(codeSources(`${F3}calc\nname: other\n| a |\n|---|\n| ABC0016-Z |\n${F3}\n`)).toEqual([]);
  });
  it("merges tables with one title and drops duplicates", () => {
    const second = SAMPLES.replace("name: samples", "name: samples2").replace("| ABC0016-B | y |", "| ABC0016-E | z |");
    expect(codeSources(SAMPLES + second)).toEqual([{ label: "Sample list", codes: ["ABC0016-A", "ABC0016-B", "ABC0016-E"] }]);
  });
  it("form parts: all codes in the box, a Codes from choice only with several tables", () => {
    expect(codeFormParts(codeSources(SAMPLES))).toEqual({ prefill: "ABC0016-A, ABC0016-B", options: [] });
    const parts = codeFormParts(codeSources(SAMPLES + TIMES));
    expect(parts.prefill).toBe("ABC0016-A, ABC0016-B, ABC0016-A0, ABC0016-A30");
    expect(parts.options).toEqual([{ value: "all", label: "All of them" }, { value: "0", label: "Sample list" }, { value: "1", label: "Sampling timetable" }]);
  });
  it("resolveCodes: the picked table when the box is untouched, else the box", () => {
    const src = codeSources(SAMPLES + TIMES), { prefill } = codeFormParts(src);
    expect(resolveCodes(src, prefill, prefill, "all")).toBe(prefill);
    expect(resolveCodes(src, prefill, prefill, "1")).toBe("ABC0016-A0, ABC0016-A30");
    expect(resolveCodes(src, prefill, "mine, own", "1")).toBe("mine, own");
    expect(resolveCodes(src, prefill, "mine", undefined)).toBe("mine");
  });
});

describe("run: suggest: codes", () => {
  const T = header({ fields: [{ key: "codes", label: "Sample codes", type: "textarea", suggest: "codes", value: "" }] }, "{{#each codes}}[{{.}}]{{/each}}");
  it("prefills the box from the note and adds Codes from when there are several tables", async () => {
    const { st } = setup({ files: { "S/t.md": T }, note: SAMPLES + TIMES });
    const calls: FormCall[] = [];
    const out = await st.run(tpWith({}, calls), file("S/t.md"));
    expect(calls[0].fields.map(f => f.key)).toEqual(["codes", "codes_from"]);
    expect(out).toBe("[ABC0016-A][ABC0016-B][ABC0016-A0][ABC0016-A30]");
    expect(await st.run(tpWith({ codes_from: "1" }), file("S/t.md"))).toBe("[ABC0016-A0][ABC0016-A30]");
    expect(await st.run(tpWith({ codes: "X, Y", codes_from: "1" }), file("S/t.md"))).toBe("[X][Y]");
  });
  it("one table: no Codes from; none: the field's own value", async () => {
    const one = setup({ files: { "S/t.md": T }, note: SAMPLES });
    const calls: FormCall[] = [];
    await one.st.run(tpWith({}, calls), file("S/t.md"));
    expect(calls[0].fields.map(f => f.key)).toEqual(["codes"]);
    const none = setup({ files: { "S/t.md": T.replace('"value":""', '"value":"Q1, Q2"') }, note: "" });
    expect(await none.st.run(tpWith({}), file("S/t.md"))).toBe("[Q1][Q2]");
  });
});

describe("makeEnv", () => {
  it("hands out unique table ids and continues sample letters", () => {
    const note = "```calc\nname: samples\n| Code |\n|---|\n| ABC0016-A |\n| ABC0016-B |\n```\n";
    const env = makeEnv(note, "ABC0016-", () => "");
    expect(env.uniqueTable("samples")).toBe("samples2");
    expect(env.uniqueTable("samples")).toBe("samples3");
    expect(env.nextFreeIndex()).toBe(2);
    expect(env.tableRows("samples")).toBe(2);
  });
});

/* ---------- the runner on a stub app ---------- */

const file = (path: string): TFile => { const base = path.replace(/\.md$/, "").split("/").pop()!; return new TFile({ path, basename: base }); };

function setup(opts: { files: Record<string, string>; note?: string; kit?: Partial<KitData>; chems?: { path: string; fm: Record<string, unknown> }[]; window?: SetupFn; cursor?: { ch: number }; form?: FormFn }) {
  const folder = new TFolder({ path: "Chem", children: [] });
  for (const c of opts.chems ?? []) folder.children.push(file(c.path));
  const fmOf = new Map((opts.chems ?? []).map((c, i) => [folder.children[i], c.fm]));
  const app = {
    vault: {
      cachedRead: async (f: TFile) => opts.files[f.path],
      getFolderByPath: (p: string) => (p === "Chem" ? folder : null),
    },
    workspace: { activeEditor: { editor: { getValue: () => opts.note ?? "", getCursor: () => opts.cursor ?? { line: 0, ch: 0 } } }, getActiveFile: () => file("ABC0016 - test.md") },
    metadataCache: {
      getFileCache: (f: TFile) => ({ frontmatter: f.basename === "toluene" ? { density: "0,867" } : fmOf.get(f) }),
      getFirstLinkpathDest: (name: string) => (name === "toluene" ? file("toluene.md") : null),
    },
  };
  const kit = { ...KIT_DEFAULTS, initials: "ABC", chemicalFolder: "Chem", ...opts.kit } as KitData;
  return { st: new SnippetTemplates(app as never, () => kit, undefined, opts.form, opts.window), app };
}

type FormCall = { title: string; fields: { key: string; value: string; required?: boolean; suggest?: { name: string }[] }[] };
const tpWith = (answers: Record<string, unknown> | null, calls: FormCall[] = []): SnippetTp => ({
  config: { target_file: { basename: "ABC0016 - test" } },
  user: { labForm: async (_tp, title, fields) => { calls.push({ title, fields: fields as FormCall["fields"] }); return answers ? { ...Object.fromEntries(fields.map(f => [f.key, f.value])), ...answers } : null; } },
});

const LIST = header({ title: "Samples", icon: "list", desc: "A list", required: "codes", fields: [{ key: "codes", label: "Codes", value: "" }] },
  "{{#each codes}}{{prefix}}{{.}}\n{{/each}}");

beforeEach(() => { Notice.messages.length = 0; });

describe("SnippetTemplates", () => {
  it("meta: header values for a token template, null for a plain snippet, empty for a broken header", async () => {
    const { st } = setup({ files: { "S/a.md": LIST, "S/b.md": "// icon: x\nplain", "S/c.md": "---\nnot json\n---\nbody" } });
    expect(await st.meta(file("S/a.md"))).toEqual({ title: "Samples", icon: "list", desc: "A list" });
    expect(await st.meta(file("S/b.md"))).toBeNull();
    // YAML that throws is a TemplateError; the stub reads JSON, so a non-JSON header stands in for it
    expect(await st.meta(file("S/c.md"))).toEqual({});
  });

  it("run: asks the fields, fills the body with the note's prefix", async () => {
    const { st } = setup({ files: { "S/a.md": LIST } });
    const calls: FormCall[] = [];
    const out = await st.run(tpWith({ codes: "A, B" }, calls), file("S/a.md"));
    expect(out).toBe("ABC0016-A\nABC0016-B\n");
    expect(calls[0].title).toBe("Samples");
  });

  it("run: a mandatory field is passed to the form as required, other fields are not", async () => {
    const t = header({ title: "T", fields: [{ key: "a", label: "A", mandatory: true }, { key: "b", label: "B" }] }, "{{a}}{{b}}");
    const { st } = setup({ files: { "S/m.md": t } });
    const calls: FormCall[] = [];
    await st.run(tpWith({ a: "x" }, calls), file("S/m.md"));
    expect(calls[0].fields[0].required).toBe(true);
    expect("required" in calls[0].fields[1]).toBe(false);
  });

  it("run: toggle, select and list are asked as such and come back as tokens", async () => {
    const t = header({ title: "T", fields: [
      { key: "t", label: "T", type: "toggle", value: "yes" },
      { key: "s", label: "S", type: "select", options: ["x", { value: "y", label: "Why" }] },
      { key: "l", label: "L", type: "list" },
    ] }, "{{#if t}}on{{else}}off{{/if}} {{s}} {{#each l}}<{{.}}>{{/each}}");
    const { st } = setup({ files: { "S/n.md": t } });
    const calls: FormCall[] = [];
    expect(await st.run(tpWith({ t: false, s: "y", l: "A,  B" }, calls), file("S/n.md"))).toBe("off y <A><B>");
    const f = calls[0].fields as unknown as { type: string; value: unknown; options?: unknown }[];
    expect(f[0]).toMatchObject({ type: "toggle", value: true });
    expect(f[1]).toMatchObject({ type: "select", options: [{ value: "x" }, { value: "y", label: "Why" }] });
    expect(f[2].type).toBe("text");
    expect(await st.run(tpWith({ t: true, s: "x" }), file("S/n.md"))).toBe("on x ");
  });

  it("run: cancel and an empty required list insert nothing", async () => {
    const { st } = setup({ files: { "S/a.md": LIST } });
    expect(await st.run(tpWith(null), file("S/a.md"))).toBe("");
    expect(await st.run(tpWith({ codes: "  " }), file("S/a.md"))).toBe("");
  });

  it("run: a bad template shows a Notice and inserts nothing", async () => {
    const bad = header({ fields: [{ key: "a", label: "A" }] }, "{{nope}}");
    const { st } = setup({ files: { "S/bad.md": bad } });
    expect(await st.run(tpWith({}), file("S/bad.md"))).toBe("");
    expect(Notice.messages.at(-1)).toContain("bad");
  });

  it("run: missing initials give XX and a Notice when the body uses the prefix", async () => {
    const { st } = setup({ files: { "S/a.md": LIST }, kit: { initials: "" } });
    expect(await st.run(tpWith({ codes: "A" }), file("S/a.md"))).toBe("XX0016-A\n");
    expect(Notice.messages.some(m => m.includes("initials"))).toBe(true);
  });

  it("run: the experiment number is read after the initials in the note name; XXXX when the name has none", async () => {
    const { st } = setup({ files: { "S/a.md": LIST }, kit: { initials: "OLJ" } });
    const at = (basename: string) => st.run({ ...tpWith({ codes: "A" }), config: { target_file: { basename } } }, file("S/a.md"));
    expect(await at("OLJ0001 - Test")).toBe("OLJ0001-A\n");
    expect(await at("0001 - Test")).toBe("OLJ0001-A\n");
    expect(await at("Untitled")).toBe("OLJXXXX-A\n");
  });

  it("run: initials come from the settings; a body without the prefix gives no initials Notice", async () => {
    const plainBody = header({ fields: [{ key: "a", label: "A" }] }, "{{a}}");
    const { st } = setup({ files: { "S/a.md": LIST, "S/p.md": plainBody }, kit: { initials: "" } });
    await st.run(tpWith({ a: "x" }), file("S/p.md"));
    expect(Notice.messages).toEqual([]);
    const set = setup({ files: { "S/a.md": LIST }, kit: { initials: "QRS" } });
    expect(await set.st.run(tpWith({ codes: "A" }), file("S/a.md"))).toBe("QRS0016-A\n");
    expect(Notice.messages).toEqual([]);
  });

  it("run: sample letters continue from the note", async () => {
    const t = header({ fields: [] }, "{{code}} {{code}}");
    const { st } = setup({ files: { "S/t.md": t }, note: "ABC0016-A and ABC0016-B" });
    expect(await st.run(tpWith({}), file("S/t.md"))).toBe("ABC0016-C ABC0016-D");
  });

  it("run: a number from another note's property", async () => {
    const t = header({ fields: [{ key: "solvent", label: "Solvent", value: "toluene" }] }, "{{note-number:solvent.Density}}");
    const { st } = setup({ files: { "S/t.md": t }, chems: [] });
    expect(await st.run(tpWith({}), file("S/t.md"))).toBe("0.867");
    const linked = setup({ files: { "S/t.md": t.replace("toluene", "[[toluene]]") }, chems: [] });
    expect(await linked.st.run(tpWith({}), file("S/t.md"))).toBe("0.867");
    const none = setup({ files: { "S/t.md": t.replace("toluene", "unknown") } });
    expect(await none.st.run(tpWith({}), file("S/t.md"))).toBe("");
  });

  const chemTemplate = (cls: string) => header({ fields: [{ key: "s", label: "S", suggest: "chemicals", class: cls }, { key: "r", label: "R", suggest: "chemicals" }] }, "{{s}}");
  const chems = [
    { path: "Chem/Acetone.md", fm: { "Chemical class": "Solvent" } },
    { path: "Chem/AIBN.md", fm: { "chemical  class": ["initiator"] } },
    { path: "Chem/Mystery.md", fm: { Names: ["Odd"] } },
  ];

  it("run: the field's class decides the suggestions; a field without a class gets all", async () => {
    const { st } = setup({ files: { "S/c.md": chemTemplate("solvent") }, chems });
    const calls: FormCall[] = [];
    await st.run(tpWith({ s: "x" }, calls), file("S/c.md"));
    const [s, r] = calls[0].fields;
    expect(s.suggest!.map(c => c.name)).toEqual(["Acetone", "AIBN", "Mystery"]);
    expect(r.suggest!.map(c => c.name)).toEqual(["Acetone", "AIBN", "Mystery"]);
  });

  it("run: the setting makes it the asked class only; a new class gives an empty list", async () => {
    const calls: FormCall[] = [];
    const only = setup({ files: { "S/c.md": chemTemplate("solvent") }, chems, kit: { chemClassOnly: true } });
    await only.st.run(tpWith({ s: "x" }, calls), file("S/c.md"));
    expect(calls[0].fields[0].suggest!.map(c => c.name)).toEqual(["Acetone"]);
    expect(calls[0].fields[1].suggest!.length).toBe(3);
    const fresh = setup({ files: { "S/c.md": chemTemplate("zzz-new-class") }, chems, kit: { chemClassOnly: true } });
    const calls2: FormCall[] = [];
    await fresh.st.run(tpWith({ s: "x" }, calls2), file("S/c.md"));
    expect(calls2[0].fields[0].suggest).toEqual([]);
  });
});

describe("SnippetTemplates: run: calculators", () => {
  const stub = (key: string, extra: object = {}) => header({ title: "Solution prep", icon: "test-tube", desc: "d", group: "Make up", run: key, ...extra }, "");
  const target = { basename: "ABC0016 - test", path: "ABC0016 - test.md" };
  const calcTp = (md = "## Out\n") => {
    calc.out = md;
    return { config: { target_file: target }, date: { now: () => "2026-10-02" }, user: { labForm: async () => ({}) } } as unknown as SnippetTp;
  };
  beforeEach(() => { calc.calls.length = 0; });

  it("meta: a run header lists like a token template and carries its group", async () => {
    const { st } = setup({ files: { "S/01.md": stub("solution") } });
    expect(await st.meta(file("S/01.md"))).toEqual({ title: "Solution prep", icon: "test-tube", desc: "d", group: "Make up" });
  });

  it("run: hands the key, the note and the date to the calculator and inserts exactly what it returns", async () => {
    for (const key of ["recipe", "results", "nmr", "gpc", "dls"]) {
      const { st } = setup({ files: { "S/s.md": stub(key) } });
      calc.calls.length = 0;
      expect(await st.run(calcTp(`## ${key}\n| a |\n\n`), file("S/s.md"))).toBe(`## ${key}\n| a |\n\n`);
      expect(calc.calls).toHaveLength(1);
      expect(calc.calls[0].key).toBe(key);
      expect(calc.calls[0].ctx.file).toBe(target);
      expect(calc.calls[0].ctx.today()).toBe("2026-10-02");
    }
    expect(Notice.messages).toEqual([]);
  });

  it("run: the plugin's own question window is the calculator's form; without it the tp's labForm is", async () => {
    const mine: FormFn = async () => ({ mine: true });
    const { st } = setup({ files: { "S/s.md": stub("recipe") }, form: mine });
    await st.run(calcTp(), file("S/s.md"));
    expect(calc.calls[0].ctx.form).toBe(mine);
    const bare = setup({ files: { "S/s.md": stub("recipe") } });
    await bare.st.run(calcTp(), file("S/s.md"));
    expect(await (calc.calls[1].ctx.form as FormFn)("t", [])).toEqual({});
  });

  it("run: raft-table is the old RAFT calc-table generator; run: raft is the live block", async () => {
    const { st } = setup({ files: { "S/s.md": stub("raft-table") } });
    expect(await st.run(calcTp("## raft\n"), file("S/s.md"))).toBe("## raft\n");
    expect(calc.calls.map(c => c.key)).toEqual(["raft-table"]);
  });

  it("run: solution is the live block: its own window, no calculator; solution-volume is the old volume form", async () => {
    const asked: SetupInit[] = [];
    const lines = { reagent: "Acetic acid", aqueous: "15.00 g", pH: "4.00", share: "60 %", use: "50 %", balance: "0.1 mg" };
    const window: SetupFn = async (_app, init) => { asked.push(init); return { values: init.values, lines }; };
    const { st } = setup({ files: { "S/s.md": stub("solution"), "S/v.md": stub("solution-volume") }, window });
    const out = await st.run(calcTp(), file("S/s.md"));
    expect(out).toBe(solutionBlock(lines));
    expect(out.startsWith("```solution\nformat: 1\n")).toBe(true);
    expect(calc.calls).toEqual([]);
    expect(asked[0].submit).toBe("Insert");
    expect(asked[0].values).toEqual(DEFAULT_SETUP);
    expect(await st.run(calcTp("old\n"), file("S/v.md"))).toBe("old\n");
    expect(calc.calls.map(c => c.key)).toEqual(["solution-volume"]);
  });

  it("run: solution, Method: by volume in the window gives the old volume form, the window offers the choice", async () => {
    const asked: SetupInit[] = [];
    const window: SetupFn = async (_app, init) => { asked.push(init); return { values: init.values, lines: {} as never, method: "volume" }; };
    const { st } = setup({ files: { "S/s.md": stub("solution") }, window });
    expect(await st.run(calcTp("old volume table\n"), file("S/s.md"))).toBe("old volume table\n");
    expect(calc.calls.map(c => c.key)).toEqual(["solution-volume"]);
    expect(asked[0].methods).toBe(true);
  });

  it("run: solution starts the block on a line of its own and gives nothing when the window is closed", async () => {
    const lines = { reagent: "A", aqueous: "1 g", pH: "4", share: "60 %", use: "50 %", balance: "0.1 mg" };
    const { st } = setup({ files: { "S/s.md": stub("solution") }, cursor: { ch: 5 }, window: async (_a, i) => ({ values: i.values, lines }) });
    expect((await st.run(calcTp(), file("S/s.md"))).startsWith("\n```solution\n")).toBe(true);
    const closed = setup({ files: { "S/s.md": stub("solution") }, window: async () => null });
    expect(await closed.st.run(calcTp(), file("S/s.md"))).toBe("");
  });

  it("run: an unknown key shows the Notice and inserts nothing; no calculator is called", async () => {
    const { st } = setup({ files: { "S/s.md": stub("nope") } });
    expect(await st.run(calcTp(), file("S/s.md"))).toBe("");
    expect(Notice.messages.at(-1)).toBe("“Solution prep”: Lab Kit has no calculator called “nope”.");
    expect(calc.calls).toEqual([]);
  });

  it("run: without the question window and without a labForm a Notice says so", async () => {
    const { st } = setup({ files: { "S/s.md": stub("recipe") } });
    expect(await st.run({ user: {} }, file("S/s.md"))).toBe("");
    expect(Notice.messages.at(-1)).toContain("question window");
    expect(calc.calls).toEqual([]);
  });

  it("run: a header with run: and fields, or an empty run:, is an error with a Notice", async () => {
    const { st } = setup({ files: { "S/a.md": stub("recipe", { fields: [] }), "S/b.md": stub("  ") } });
    expect(await st.run(calcTp(), file("S/a.md"))).toBe("");
    expect(Notice.messages.at(-1)).toContain("has no fields");
    expect(await st.run(calcTp(), file("S/b.md"))).toBe("");
    expect(Notice.messages.at(-1)).toContain("needs the name of a Lab Kit calculator");
  });
});

describe("SnippetTemplates: old calculator stubs kept in a vault", () => {
  const OLD = (key: string, extra = "") => `<%*\n// icon: wand\n// desc: My words\n${extra}tR += await tp.user.labSnippets(tp, "${key}");\n%>`;
  const calls = (): string[] => calc.calls.map(c => c.key);
  const calcTp = () => ({ user: { labForm: async () => ({}) } }) as unknown as SnippetTp;
  beforeEach(() => { calc.calls.length = 0; calc.out = "out\n"; });

  it("meta: the key, icon and description of the old form; no title (the menu uses the file name)", async () => {
    const { st } = setup({ files: { "S/07 NMR samples.md": OLD("nmr") } });
    expect(await st.meta(file("S/07 NMR samples.md"))).toEqual({ icon: "wand", desc: "My words", oldStub: "nmr" });
  });

  it("run: an old stub runs its calculator, an edited icon or an extra comment line changes nothing", async () => {
    const { st } = setup({ files: { "S/a.md": OLD("gpc"), "S/b.md": OLD("recipe", "// remember to check MW\n") } });
    expect(await st.run(calcTp(), file("S/a.md"))).toBe("out\n");
    expect(await st.run(calcTp(), file("S/b.md"))).toBe("out\n");
    expect(calls()).toEqual(["gpc", "recipe"]);
  });

  it("run: an old stub with an unknown key shows the Notice and inserts nothing", async () => {
    const { st } = setup({ files: { "S/07 Mine.md": OLD("mine") } });
    expect(await st.run(calcTp(), file("S/07 Mine.md"))).toBe("");
    expect(Notice.messages.at(-1)).toBe("“Mine”: Lab Kit has no calculator called “mine”.");
    expect(calls()).toEqual([]);
  });

  it("a snippet with other code in it is a plain snippet: inserted as it is (Templater runs it)", async () => {
    const code = '<%*\nconst x = 1;\ntR += await tp.user.labSnippets(tp, "nmr");\n%>';
    const { st } = setup({ files: { "S/c.md": code } });
    expect(await st.meta(file("S/c.md"))).toBeNull();
    expect(await st.run(calcTp(), file("S/c.md"))).toBe(code);
  });
});
