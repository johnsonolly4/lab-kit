// Rig notes Phase 4: token templates pick a note of a settings folder (suggest: notes), set properties (set:), read a rig
// ({{rig-tables}}, {{rig-diagram}}, {{note-prop}}) and append a part under a heading ({{#append}}). Engine, note edits and the runner on a stub app.
import { describe, it, expect, beforeEach } from "vitest";
import { Notice, TFile, TFolder } from "obsidian";
import { readFileSync } from "node:fs";
import { SnippetTemplates, type SnippetTp } from "../src/kit/snippet-run";
import { makeEnv } from "../src/kit/snippet-env";
import { appendEdits, applyEdits, noteEdits, propertyEdit } from "../src/kit/snippet-note";
import { TemplateError, fillParts, fillTemplate, parseTemplate } from "../src/kit/snippet-template";
import { readRig } from "../src/rig/parts";
import { KIT_DEFAULTS, type KitData } from "../src/kit/paths";

const json = (s: string): unknown => JSON.parse(s);
const header = (o: object, body: string): string => `---\n${JSON.stringify(o)}\n---\n${body}`;
const RIG = readFileSync("tests/fixtures/rigs/inline-analysis.md", "utf8");
const F = "```";

describe("header: suggest: notes and set", () => {
  const parse = (o: object) => parseTemplate(header(o, "x"), json)!.header;
  it("reads a notes field with its folder setting, and the set properties in order", () => {
    const h = parse({ set: { Rig: "[[{{rig}}]]", "Flow rig": "x" }, fields: [{ key: "rig", suggest: "notes", folder: "rigsFolder" }] });
    expect(h.fields[0]).toMatchObject({ suggest: "notes", folder: "rigsFolder" });
    expect(h.set).toEqual([{ name: "Rig", value: "[[{{rig}}]]" }, { name: "Flow rig", value: "x" }]);
    expect(parse({ fields: [] }).set).toBeUndefined();
  });
  it("rejects notes without a folder, a folder without notes, and a set that is not property: text", () => {
    expect(() => parse({ fields: [{ key: "a", suggest: "notes" }] })).toThrow(/needs folder/);
    expect(() => parse({ fields: [{ key: "a", folder: "rigsFolder" }] })).toThrow(/folder needs suggest: notes/);
    expect(() => parse({ set: ["Rig"], fields: [] })).toThrow(TemplateError);
    expect(() => parse({ set: { Rig: ["a"] }, fields: [] })).toThrow(/Rig/);
    expect(() => parse({ set: { "a: b": "x" }, fields: [] })).toThrow(TemplateError);
  });
});

describe("engine: rig tokens, note-prop and #append", () => {
  const notes = { text: (n: string) => (n === "Rig A" ? RIG : n === "Empty" ? "No tables." : null), prop: (n: string, p: string) => (n === "Rig A" && p === "Tubing" ? "PFA 0.75 mm" : "") };
  const env = () => makeEnv("", "ABC0016-", () => "", notes);
  const fill = (body: string, rig = "Rig A") => fillParts(body, { rig }, env());

  it("rig-diagram is the note's diagram as a mermaid block", () => {
    expect(fill("{{rig-diagram:rig}}").text).toBe(`${F}mermaid\n${readRig(RIG).mermaid}\n${F}`);
  });
  it("rig-tables gives every parts table under its heading, at the level asked for (## by default)", () => {
    const out = fill("{{rig-tables:rig}}").text;
    expect(out.split("\n").filter(l => l.startsWith("#"))).toEqual(["## Pumps", "## Reactor line", "## Analysis"]);
    expect(out).toContain("## Pumps\n| ID | Model | Carries | Tubing in | Tubing out | Pressure limit | Feeds |\n|---|---|---|---|---|---|---|\n| P1 | make, model | monomer | PFA 1.6 mm | PFA 0.75 mm | | M1 |\n\n## Reactor line\n");
    expect(readRig(out).mermaid).toBe(readRig(RIG).mermaid);
    expect(fill("{{rig-tables:rig ###}}").text).toContain("### Analysis\n| ID | Instrument |");
  });
  it("note-prop is a property of the picked note as text, empty when it has none", () => {
    expect(fill("[{{note-prop:rig.Tubing}}][{{note-prop:rig.Control}}]").text).toBe("[PFA 0.75 mm][]");
  });
  it("an empty answer gives nothing; a note without a parts table is an error", () => {
    expect(fill("[{{rig-tables:rig}}{{rig-diagram:rig}}{{note-prop:rig.Tubing}}]", "").text).toBe("[]");
    expect(() => fill("{{rig-diagram:rig}}", "Empty")).toThrow(/"Empty" has no parts table/);
    expect(() => fill("{{rig-tables:rig}}", "Gone")).toThrow(TemplateError);
    expect(() => fill("{{rig-tables:other}}")).toThrow(/not a field/);
  });
  it("#append parts are left out of the cursor text and returned with their heading and level", () => {
    const r = fill('at the cursor\n{{#append "# Flow platform setup"}}\nTubing: {{note-prop:rig.Tubing}}\n{{/append}}\nafter\n{{#append "Notes"}}\nn\n{{/append}}\n');
    expect(r.text).toBe("at the cursor\nafter\n");
    expect(r.appends).toEqual([{ heading: "Flow platform setup", level: 1, text: "Tubing: PFA 0.75 mm\n" }, { heading: "Notes", level: 2, text: "n\n" }]);
    expect(fillTemplate('a{{#append "H"}}b{{/append}}', {}, env())).toBe("a");
  });
  it("#append cannot be nested or left open", () => {
    expect(() => fillParts('{{#if rig}}{{#append "H"}}x{{/append}}{{/if}}', { rig: "x" }, env())).toThrow(/cannot be inside another block/);
    expect(() => fillParts('{{#append "H"}}x', {}, env())).toThrow(/never closed/);
    expect(() => fillParts("x{{/append}}", {}, env())).toThrow(/without a matching/);
    expect(() => fillParts("{{#append H}}x{{/append}}", {}, env())).toThrow(/Unknown block/);
  });
});

describe("note edits", () => {
  const A = (heading: string, text: string, level = 1) => ({ heading, level, text });
  it("adds the heading at the end of the note when it is missing", () => {
    expect(applyEdits("# Results\ntext\n\n", appendEdits("# Results\ntext\n\n", [A("Flow platform setup", "line\n")]))).toBe("# Results\ntext\n\n# Flow platform setup\nline\n");
    expect(applyEdits("", appendEdits("", [A("Setup", "line", 2)]))).toBe("## Setup\nline\n");
  });
  it("appends below the content of a heading that is there (any level, capitals ignored), before the next heading of that level", () => {
    const note = "# Results\nr\n## flow platform setup\nold\n### Pumps\np\n\n## Notes\nn\n";
    expect(applyEdits(note, appendEdits(note, [A("Flow platform setup", "new")]))).toBe("# Results\nr\n## flow platform setup\nold\n### Pumps\np\n\nnew\n\n## Notes\nn\n");
    expect(applyEdits("# Setup\n", appendEdits("# Setup\n", [A("Setup", "new")]))).toBe("# Setup\nnew\n");
  });
  it("a heading inside a code block is not a heading; parts for one heading are joined; an empty part is left out", () => {
    const note = `${F}\n# Setup\n${F}\n`;
    expect(applyEdits(note, appendEdits(note, [A("Setup", "a"), A("setup", "b"), A("Other", " \n")]))).toBe(`${F}\n# Setup\n${F}\n\n# Setup\na\n\nb\n`);
    expect(appendEdits(note, [A("Other", "")])).toEqual([]);
  });
  it("sets properties: adds front matter, adds a line, replaces a property with its list lines", () => {
    const set = (note: string, name: string, value: string) => applyEdits(note, [propertyEdit(note, [{ name, value }])!]);
    expect(set("body\n", "Rig", "[[Rig A]]")).toBe('---\nRig: "[[Rig A]]"\n---\nbody\n');
    expect(set("---\nStatus: Planned\n---\nbody\n", "Rig", "[[Rig A]]")).toBe('---\nStatus: Planned\nRig: "[[Rig A]]"\n---\nbody\n');
    expect(set("---\nrig:\n  - old\n  - older\nStatus: Planned\n---\nbody\n", "Rig", "[[Rig B]]")).toBe('---\nRig: "[[Rig B]]"\nStatus: Planned\n---\nbody\n');
    expect(set("---\n---\nbody\n", "Rig", "x")).toBe('---\nRig: "x"\n---\nbody\n');
    expect(propertyEdit("body", [])).toBeNull();
  });
  it("all edits of one insert come last-in-the-note first and leave the text between them alone", () => {
    const note = "---\nStatus: Planned\n---\n# Apparatus\nHERE\n# Results\n";
    const edits = noteEdits(note, [{ name: "Rig", value: "[[Rig A]]" }], [A("Flow platform setup", "tables")]);
    expect(edits.map(e => e.from)).toEqual([...edits.map(e => e.from)].sort((a, b) => b - a));
    expect(applyEdits(note, edits)).toBe('---\nStatus: Planned\nRig: "[[Rig A]]"\n---\n# Apparatus\nHERE\n# Results\n\n# Flow platform setup\ntables\n');
  });
});

/* ---------- the runner on a stub app ---------- */

const file = (path: string): TFile => new TFile({ path, basename: path.replace(/\.md$/, "").split("/").pop()! });

function setup(opts: { template: string; note?: string; kit?: Partial<KitData>; rigs?: Record<string, string>; editor?: boolean }) {
  const rigs = opts.rigs ?? { "Rigs/Rig A.md": RIG, "Rigs/Old/Rig B.md": "No tables here." };
  const folder = new TFolder({ path: "Rigs", children: Object.keys(rigs).map(file) });
  const files: Record<string, string> = { "S/t.md": opts.template, ...rigs };
  const doc = { text: opts.note ?? "" };
  const pos = (o: number) => ({ line: 0, ch: o });
  const editor = {
    getValue: () => doc.text,
    offsetToPos: pos,
    replaceRange: (text: string, from: { ch: number }, to: { ch: number }) => { doc.text = doc.text.slice(0, from.ch) + text + doc.text.slice(to.ch); },
  };
  const app = {
    vault: { cachedRead: async (f: TFile) => files[f.path], getFolderByPath: (p: string) => (p === "Rigs" ? folder : null) },
    workspace: { activeEditor: opts.editor === false ? null : { editor }, getActiveFile: () => file("ABC0016 - test.md") },
    metadataCache: { getFileCache: (f: TFile) => ({ frontmatter: f.basename === "Rig A" ? { Tubing: "PFA 0.75 mm", Control: "made-up 1.0" } : undefined }), getFirstLinkpathDest: () => null },
  };
  const kit = { ...KIT_DEFAULTS, initials: "ABC", rigsFolder: "Rigs", ...opts.kit } as KitData;
  return { st: new SnippetTemplates(app as never, () => kit), doc };
}

type FormCall = { fields: { key: string; value: string; suggest?: { name: string }[] }[] };
const tpWith = (answers: Record<string, unknown> | null, calls: FormCall[] = []): SnippetTp => ({
  config: { target_file: { basename: "ABC0016 - test" } },
  user: { labForm: async (_tp, _title, fields) => { calls.push({ fields: fields as FormCall["fields"] }); return answers ? { ...Object.fromEntries(fields.map(f => [f.key, f.value])), ...answers } : null; } },
});

const T = header({ title: "Rig", set: { Rig: "[[{{rig}}]]" }, required: "rig", fields: [{ key: "rig", label: "Rig", suggest: "notes", folder: "rigsFolder" }] },
  '[[{{rig}}]]\n{{rig-diagram:rig}}\n{{#append "# Flow platform setup"}}\nRig: [[{{rig}}]]\nTubing: {{note-prop:rig.Tubing}}\n\n{{rig-tables:rig}}\n{{/append}}\n');
const NOTE = "---\nStatus: Planned\n---\n# Apparatus\n\n# Results\n";

beforeEach(() => { Notice.messages.length = 0; });

describe("run: a snippet that picks a rig", () => {
  it("lists the notes of the settings folder and below, by name", async () => {
    const { st } = setup({ template: T });
    const calls: FormCall[] = [];
    await st.run(tpWith(null, calls), file("S/t.md"));
    expect(calls[0].fields[0].suggest!.map(n => n.name)).toEqual(["Rig A", "Rig B"]);
  });
  it("puts the link and diagram at the cursor, the property in the front matter and the rest under the heading at the end", async () => {
    const { st, doc } = setup({ template: T, note: NOTE });
    const out = await st.run(tpWith({ rig: "rig a" }), file("S/t.md"));
    expect(out).toBe(`[[Rig A]]\n${F}mermaid\n${readRig(RIG).mermaid}\n${F}\n`);
    expect(doc.text.startsWith('---\nStatus: Planned\nRig: "[[Rig A]]"\n---\n# Apparatus\n\n# Results\n\n# Flow platform setup\nRig: [[Rig A]]\nTubing: PFA 0.75 mm\n\n## Pumps\n| ID |')).toBe(true);
    expect(doc.text.endsWith("| NMR | benchtop NMR | method name | |\n")).toBe(true);
    expect(Notice.messages).toEqual([]);
  });
  it("a second run appends below what is already under the heading and replaces the property", async () => {
    const { st, doc } = setup({ template: T, note: NOTE });
    await st.run(tpWith({ rig: "Rig A" }), file("S/t.md"));
    await st.run(tpWith({ rig: "[[Rig A]]" }), file("S/t.md"));
    expect(doc.text.match(/^# Flow platform setup$/gm)).toHaveLength(1);
    expect(doc.text.match(/^## Pumps$/gm)).toHaveLength(2);
    expect(doc.text.match(/^Rig: "\[\[Rig A\]\]"$/gm)).toHaveLength(1);
  });
  it("cancelled, or the required pick left empty: nothing is inserted and the note is not touched", async () => {
    const { st, doc } = setup({ template: T, note: NOTE });
    expect(await st.run(tpWith(null), file("S/t.md"))).toBe("");
    expect(await st.run(tpWith({ rig: "" }), file("S/t.md"))).toBe("");
    expect(doc.text).toBe(NOTE);
  });
  it("errors name the snippet, insert nothing and leave the note alone", async () => {
    const run = async (o: Partial<Parameters<typeof setup>[0]>, rig = "Rig A") => {
      const s = setup({ template: T, note: NOTE, ...o });
      const out = await s.st.run(tpWith({ rig }), file("S/t.md"));
      expect(out).toBe("");
      expect(s.doc.text).toBe(NOTE);
      return Notice.messages.at(-1);
    };
    expect(await run({}, "Rig Z")).toBe('t: No note called "Rig Z" in the Rigs folder.');
    expect(await run({}, "Rig B")).toBe('t: "Rig B" has no parts table (a table with an ID and a Feeds column).');
    expect(await run({ kit: { rigsFolder: "" } })).toBe("t: Set the Rigs folder in Settings → Lab Kit first.");
    expect(await run({ rigs: {} })).toBe("t: There are no notes in the Rigs folder (Rigs) yet.");
    expect(await run({ template: T.replace("rigsFolder", "nopeFolder") })).toContain('"nopeFolder" is not a folder setting');
    expect(await run({ editor: false })).toBe("t: Open the note in the editor first: this snippet also writes outside the cursor.");
  });
});
