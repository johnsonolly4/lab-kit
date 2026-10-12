// Rig notes Phase 5: the shipped Rig snippet (kits/lab/Templates/Snippets/14 Rig.md) run the way Alt+S runs it, on a stub app.
import { describe, it, expect, beforeEach } from "vitest";
import { Notice, TFile, TFolder } from "obsidian";
import { readFileSync } from "node:fs";
import { SnippetTemplates, type SnippetTp } from "../src/kit/snippet-run";
import { readRig, readSummary } from "../src/rig/parts";
import { KIT_DEFAULTS, type KitData } from "../src/kit/paths";
import { miniYaml } from "./token-snippets";

const RIG = readFileSync("tests/fixtures/rigs/inline-analysis.md", "utf8");
const SHIPPED = readFileSync("kits/lab/Templates/Snippets/14 Rig.md", "utf8");
const F = "```";

// The stub's parseYaml reads JSON only: turn the shipped header into JSON, keep the body as written.
const asJsonHeader = (text: string): string => {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text)!;
  return `---\n${JSON.stringify(miniYaml(m[1]))}\n---\n${m[2]}`;
};
const TEMPLATE = asJsonHeader(SHIPPED);

const file = (path: string): TFile => new TFile({ path, basename: path.replace(/\.md$/, "").split("/").pop()! });

function setup(opts: { note: string; kit?: Partial<KitData>; rig?: string }) {
  const rigs: Record<string, string> = { "Rigs/Rig A.md": opts.rig ?? RIG, "Rigs/Batch.md": readFileSync("tests/fixtures/rigs/batch-vessel.md", "utf8") };
  const folder = new TFolder({ path: "Rigs", children: Object.keys(rigs).map(file) });
  const files: Record<string, string> = { "S/t.md": TEMPLATE, ...rigs };
  const doc = { text: opts.note };
  const editor = {
    getValue: () => doc.text,
    offsetToPos: (o: number) => ({ line: 0, ch: o }),
    replaceRange: (text: string, from: { ch: number }, to: { ch: number }) => { doc.text = doc.text.slice(0, from.ch) + text + doc.text.slice(to.ch); },
  };
  const app = {
    vault: { cachedRead: async (f: TFile) => files[f.path], getFolderByPath: (p: string) => (p === "Rigs" ? folder : null) },
    workspace: { activeEditor: { editor }, getActiveFile: () => file("ABC0016 - test.md") },
    metadataCache: { getFileCache: (f: TFile) => ({ frontmatter: f.basename === "Rig A" ? { Tubing: "PFA 0.75 mm", Control: "made-up 1.0" } : f.basename === "Batch" ? { "Setup heading": "Batch setup" } : undefined }), getFirstLinkpathDest: () => null },
  };
  const kit = { ...KIT_DEFAULTS, initials: "ABC", rigsFolder: "Rigs", ...opts.kit } as KitData;
  return { st: new SnippetTemplates(app as never, () => kit), doc };
}

const tp = (answers: Record<string, unknown> | null): SnippetTp => ({
  config: { target_file: { basename: "ABC0016 - test" } },
  user: { labForm: async (_tp, _title, fields) => (answers ? { ...Object.fromEntries(fields.map(f => [f.key, f.value])), ...answers } : null) },
});

const NOTE = "---\nStatus: Planned\n---\n# Apparatus\n\n# Results\n";
const DIAGRAM = `${F}mermaid\n${readRig(RIG).mermaid}\n${F}`;

beforeEach(() => { Notice.messages.length = 0; });

describe("the shipped Rig snippet", () => {
  it("puts the link and the diagram at the cursor, sets Rig, and adds Flow platform setup at the end", async () => {
    const { st, doc } = setup({ note: NOTE });
    const out = await st.run(tp({ rig: "Rig A" }), file("S/t.md"));
    expect(out).toBe(`\n[[Rig A]]\n\n${DIAGRAM}\n`);   // starts with an empty line (user): the diagram renders when the note is opened
    expect(doc.text.startsWith('---\nStatus: Planned\nRig: "[[Rig A]]"\n---\n# Apparatus\n\n# Results\n\n# Flow platform setup\nRig: [[Rig A]]\nTubing: PFA 0.75 mm\nControl: made-up 1.0\n\n## Pumps\n| ID |')).toBe(true);
    expect(Notice.messages).toEqual([]);
  });
  it("a batch rig: its own section heading, no Tubing or Control lines, no blank gap, and the vessel tables", async () => {
    const { st, doc } = setup({ note: NOTE });
    await st.run(tp({ rig: "Batch" }), file("S/t.md"));
    expect(doc.text).toContain("# Results\n\n# Batch setup\nRig: [[Batch]]\n\n## Vessel\n| ID | Part |");
    expect(doc.text).not.toContain("Flow platform setup");
    expect(doc.text).not.toContain("Tubing:");
  });
  it("the tables it copies draw the same diagram as the rig note", async () => {
    const { st, doc } = setup({ note: NOTE });
    await st.run(tp({ rig: "Rig A" }), file("S/t.md"));
    expect(readRig(doc.text.slice(doc.text.indexOf("# Flow platform setup"))).mermaid).toBe(readRig(RIG).mermaid);
  });
  it("a note that already has Flow platform setup gets the new setup below its content; Rig is replaced, not repeated", async () => {
    const note = '---\nRig: "[[Old]]"\n---\n# Apparatus\n\n# Flow platform setup\nmy own line\n\n# Results\n';
    const { st, doc } = setup({ note });
    await st.run(tp({ rig: "Rig A" }), file("S/t.md"));
    expect(doc.text.match(/^# Flow platform setup$/gm)).toHaveLength(1);
    expect(doc.text.match(/^Rig: "\[\[Rig A\]\]"$/gm)).toHaveLength(1);
    expect(doc.text.indexOf("my own line")).toBeLessThan(doc.text.indexOf("## Pumps"));
    expect(doc.text.indexOf("## Pumps")).toBeLessThan(doc.text.indexOf("# Results"));
  });
  it("with the Rigs folder empty it inserts nothing and says where to set it", async () => {
    const { st, doc } = setup({ note: NOTE, kit: { rigsFolder: "" } });
    expect(await st.run(tp({ rig: "Rig A" }), file("S/t.md"))).toBe("");
    expect(doc.text).toBe(NOTE);
    expect(Notice.messages.at(-1)).toBe("t: Set the Rigs folder in Settings → Lab Kit first.");
  });
  it("cancelled: nothing inserted, note untouched", async () => {
    const { st, doc } = setup({ note: NOTE });
    expect(await st.run(tp(null), file("S/t.md"))).toBe("");
    expect(doc.text).toBe(NOTE);
  });
  it("is kept off by the manifest while the Rigs folder is empty", () => {
    const m = JSON.parse(readFileSync("kits/lab/kit-manifest.json", "utf8")) as { files: { src: string; needs?: string; optional?: boolean }[] };
    expect(m.files.find(f => f.src === "Templates/Snippets/14 Rig.md")).toMatchObject({ needs: "rigsFolder", optional: true });
  });
});

describe("Rig snippet: Summary table", () => {
  const SUMMARY = "| Item | Value |\n|---|---|\n| Reactor volume | 2 mL |";
  const withSummary = RIG.replace("\n## ", `\n## Summary\n${SUMMARY}\n\n## `);
  it("readSummary gives the table under a Summary heading, and nothing else is a Summary", () => {
    expect(withSummary).not.toBe(RIG);
    expect(readSummary(withSummary)).toBe(SUMMARY);
    expect(readSummary(RIG)).toBe("");
    expect(readSummary("## Summary\n```\n| a |\n|---|\n```\n")).toBe("");
    expect(readRig(withSummary).mermaid).toBe(readRig(RIG).mermaid);
    expect(readRig(withSummary).tables).toHaveLength(readRig(RIG).tables.length);
  });
  it("the snippet puts it under the diagram and not again among the bottom tables", async () => {
    const { st, doc } = setup({ note: NOTE, rig: withSummary });
    const out = await st.run(tp({ rig: "Rig A" }), file("S/t.md"));
    expect(out).toContain(`${DIAGRAM}\n\n${SUMMARY}\n`);
    expect(doc.text).not.toContain(SUMMARY);   // the bottom section (written into the note) has the parts tables only
  });
  it("a rig without a Summary table inserts nothing extra", async () => {
    const { st, doc } = setup({ note: NOTE });
    const out = await st.run(tp({ rig: "Rig A" }), file("S/t.md"));
    expect(out).not.toContain("| Item |");
    expect(out).toBe(`\n[[Rig A]]\n\n${DIAGRAM}\n`);
  });
});
