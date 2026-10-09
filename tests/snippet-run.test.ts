// Alt+S for token templates: the runner (header → form → filled text) on a stub app, and the chemical-class filter.
import { describe, it, expect, beforeEach } from "vitest";
import { Notice, TFile, TFolder } from "obsidian";
import { SnippetTemplates, type SnippetTp } from "../src/kit/snippet-run";
import { classFilter, makeEnv, type Chem } from "../src/kit/snippet-env";
import { parseTemplate, TemplateError } from "../src/kit/snippet-template";
import { KIT_DEFAULTS, type KitData } from "../src/kit/paths";

const json = (s: string): unknown => JSON.parse(s);
const header = (o: object, body: string): string => `---\n${JSON.stringify(o)}\n---\n${body}`;

const CHEMS: Chem[] = [
  { name: "Acetone", aliases: [], classes: ["Solvent"] },
  { name: "Methyl acrylate", aliases: ["MA"], classes: ["monomer", "reagent"] },
  { name: "AIBN", aliases: [], classes: ["initiator"] },
  { name: "Mystery", aliases: [] },
];

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

function setup(opts: { files: Record<string, string>; note?: string; kit?: Partial<KitData>; chems?: { path: string; fm: Record<string, unknown> }[] }) {
  const folder = new TFolder({ path: "Chem", children: [] });
  for (const c of opts.chems ?? []) folder.children.push(file(c.path));
  const fmOf = new Map((opts.chems ?? []).map((c, i) => [folder.children[i], c.fm]));
  const app = {
    vault: {
      cachedRead: async (f: TFile) => opts.files[f.path],
      getFolderByPath: (p: string) => (p === "Chem" ? folder : null),
    },
    workspace: { activeEditor: { editor: { getValue: () => opts.note ?? "" } }, getActiveFile: () => file("ABC0016 - test.md") },
    metadataCache: {
      getFileCache: (f: TFile) => ({ frontmatter: f.basename === "toluene" ? { density: "0,867" } : fmOf.get(f) }),
      getFirstLinkpathDest: (name: string) => (name === "toluene" ? file("toluene.md") : null),
    },
  };
  const kit = { ...KIT_DEFAULTS, initials: "ABC", chemicalFolder: "Chem", ...opts.kit } as KitData;
  return { st: new SnippetTemplates(app as never, () => kit), app };
}

type FormCall = { title: string; fields: { key: string; value: string; suggest?: { name: string }[] }[] };
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
