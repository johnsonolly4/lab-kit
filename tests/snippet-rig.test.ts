// Rig notes Phase 5: the shipped Rig snippet (kits/lab/Templates/Snippets/14 Rig.md) run the way Alt+S runs it, on a stub app.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Notice, TFile, TFolder } from "obsidian";
import { readFileSync } from "node:fs";
import { SnippetTemplates, type SnippetTp } from "../src/kit/snippet-run";
import { copyTokenTemplate } from "../src/kit/snippet-copy";
import { readRig, readSummary } from "../src/rig/parts";
import { readSnapshotMeta } from "../src/rig/snapshot";
import { KIT_DEFAULTS, type KitData } from "../src/kit/paths";
import { miniYaml } from "./token-snippets";
import { rigVault } from "./helpers/rig-vault";

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
const BATCH = readFileSync("tests/fixtures/rigs/batch-vessel.md", "utf8");

/** The runner on the in-memory rig vault (create / process / read; no modify), with an editor on `note`. `processed` = the files written through vault.process. */
function setup(opts: { note: string; kit?: Partial<KitData>; rig?: string; template?: string; extra?: Record<string, string> }) {
  const v = rigVault({ "S/t.md": opts.template ?? TEMPLATE, "Rigs/Rig A.md": opts.rig ?? RIG, "Rigs/Batch.md": BATCH, ...opts.extra });
  const doc = { text: opts.note };
  const editor = {
    getValue: () => doc.text,
    offsetToPos: (o: number) => ({ line: 0, ch: o }),
    replaceRange: (text: string, from: { ch: number }, to: { ch: number }) => { doc.text = doc.text.slice(0, from.ch) + text + doc.text.slice(to.ch); },
  };
  const processed: string[] = [];
  const process = v.app.vault.process;
  v.app.vault.process = async (f: TFile, fn: (d: string) => string) => { processed.push(f.path); await process(f, fn); };
  v.app.vault.getFolderByPath = (p: string) => { const f = v.app.vault.getAbstractFileByPath(p); return f instanceof TFolder ? f : null; };
  v.app.workspace = { activeEditor: { editor }, getActiveFile: () => file("ABC0016 - test.md") };
  v.app.metadataCache.getFileCache = (f: TFile) => ({ frontmatter: f.basename === "Rig A" ? { Tubing: "PFA 0.75 mm", Control: "made-up 1.0" } : f.basename === "Batch" ? { "Setup heading": "Batch setup" } : undefined });
  const kit = { ...KIT_DEFAULTS, initials: "ABC", rigsFolder: "Rigs", ...opts.kit } as KitData;
  return { st: new SnippetTemplates(v.app as never, () => kit), doc, v, processed };
}

const tp = (answers: Record<string, unknown> | null): SnippetTp => ({
  config: { target_file: { basename: "ABC0016 - test" } },
  user: { labForm: async (_tp, _title, fields) => (answers ? { ...Object.fromEntries(fields.map(f => [f.key, f.value])), ...answers } : null) },
});

const NOTE = "---\nStatus: Planned\n---\n# Apparatus\n\n# Results\n";
const DIAGRAM = `${F}mermaid\n${readRig(RIG).mermaid}\n${F}`;
const A1 = "[[Rigs/Rig A history/Rig A 2026-10-21.svg]]";
const SNAPSHOT = `!${A1}\n*Snapshot of Rig A, 2026-10-21*`;
const day = (d: number) => vi.setSystemTime(new Date(2026, 9, d, 12));

beforeEach(() => { Notice.messages.length = 0; vi.useFakeTimers({ toFake: ["Date"] }); day(21); });
afterEach(() => { vi.useRealTimers(); });

describe("the shipped Rig snippet", () => {
  it("puts the link, the snapshot and its caption at the cursor, sets Rig and Rig snapshot, and adds Flow platform setup at the end", async () => {
    const { st, doc } = setup({ note: NOTE });
    const out = await st.run(tp({ rig: "Rig A" }), file("S/t.md"));
    expect(out).toBe(`\n[[Rig A]]\n\n${SNAPSHOT}\n`);   // starts with an empty line (user)
    expect(out + doc.text).not.toContain(`${F}mermaid`);   // no Mermaid block, so no Mermaid question (rig block plan Phase 5)
    expect(doc.text.startsWith(`---\nStatus: Planned\nRig: "[[Rig A]]"\nRig snapshot: "${A1}"\n---\n# Apparatus\n\n# Results\n\n# Flow platform setup\nRig: [[Rig A]]\nSnapshot: ${A1}\nTubing: PFA 0.75 mm\nControl: made-up 1.0\n\n## Pumps\n| ID |`)).toBe(true);
    expect(Notice.messages).toEqual([]);
  });
  it("a batch rig: its own section heading, no Tubing or Control lines, no blank gap, and the vessel tables", async () => {
    const { st, doc } = setup({ note: NOTE });
    await st.run(tp({ rig: "Batch" }), file("S/t.md"));
    expect(doc.text).toContain("# Results\n\n# Batch setup\nRig: [[Batch]]\nSnapshot: [[Rigs/Batch history/Batch 2026-10-21.svg]]\n\n## Vessel\n| ID | Part |");
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
  it("the snippet puts it under the snapshot and not again among the bottom tables", async () => {
    const { st, doc } = setup({ note: NOTE, rig: withSummary });
    const out = await st.run(tp({ rig: "Rig A" }), file("S/t.md"));
    expect(out).toContain(`${SNAPSHOT}\n\n${SUMMARY}\n`);
    expect(doc.text).not.toContain(SUMMARY);   // the bottom section (written into the note) has the parts tables only
  });
  it("a rig without a Summary table inserts nothing extra", async () => {
    const { st, doc } = setup({ note: NOTE });
    const out = await st.run(tp({ rig: "Rig A" }), file("S/t.md"));
    expect(out).not.toContain("| Item |");
    expect(out).toBe(`\n[[Rig A]]\n\n${SNAPSHOT}\n`);
  });
});

// Rig block plan Phase 5 (docs/plans/rig-block-no-mermaid.md): {{rig-snapshot:rig}} takes a dated SVG snapshot of the rig (or reuses the latest equal one) and links it.
describe("{{rig-snapshot}}: the lab note links a dated snapshot of the rig", () => {
  it("the shipped Rig snippet is this template, with the Summary and Tubing / Control lines", () => {
    for (const part of ["!{{rig-snapshot:rig}}\n*Snapshot of {{rig}}, {{rig-snapshot-date:rig}}*\n", 'Rig snapshot: "{{rig-snapshot:rig}}"', "Rig: [[{{rig}}]]\nSnapshot: {{rig-snapshot:rig}}\n"]) expect(SHIPPED).toContain(part);
    expect(SHIPPED).not.toContain("rig-diagram");
  });
  const SNAP_T = `---\n${JSON.stringify({ title: "Rig", set: { Rig: "[[{{rig}}]]", "Rig snapshot": "{{rig-snapshot:rig}}" }, required: "rig", fields: [{ key: "rig", label: "Rig", suggest: "notes", folder: "rigsFolder" }] })}\n---\n`
    + '\n[[{{rig}}]]\n\n!{{rig-snapshot:rig}}\n*Snapshot of {{rig}}, {{rig-snapshot-date:rig}}*\n{{#append "# Flow platform setup" from rig.Setup heading}}\nRig: [[{{rig}}]]\nSnapshot: {{rig-snapshot:rig}}\n\n{{rig-tables:rig}}\n{{/append}}\n';
  const OLD = readFileSync("tests/fixtures/rigs/saved/lab-note-mermaid-v1.md", "utf8");

  it("Alt+S → Rig: the embed and caption at the cursor, the Rig snapshot property, the Snapshot line and tables, no mermaid", async () => {
    const { st, doc, v } = setup({ note: NOTE, template: SNAP_T });
    const out = await st.run(tp({ rig: "Rig A" }), file("S/t.md"));
    expect(out).toBe(`\n[[Rig A]]\n\n!${A1}\n*Snapshot of Rig A, 2026-10-21*\n`);
    expect(doc.text).toContain(`Rig: "[[Rig A]]"\nRig snapshot: "${A1}"\n---\n`);
    expect(doc.text).toContain(`# Flow platform setup\nRig: [[Rig A]]\nSnapshot: ${A1}\n\n## Pumps\n`);
    expect(out + doc.text).not.toContain(`${F}mermaid`);
    expect(v.created).toEqual(["Rigs/Rig A history/Rig A 2026-10-21.svg"]);
    expect(Notice.messages).toEqual([]);
  });
  it("the copied tables equal the rig note's (readRig), and the snapshot holds the same tables", async () => {
    const { st, doc, v } = setup({ note: NOTE, template: SNAP_T });
    await st.run(tp({ rig: "Rig A" }), file("S/t.md"));
    const lines = (text: string) => readRig(text).tables.map(t => t.lines.map(l => l.trim()));
    expect(lines(doc.text.slice(doc.text.indexOf("# Flow platform setup")))).toEqual(lines(RIG));
    const meta = readSnapshotMeta(v.files.get("Rigs/Rig A history/Rig A 2026-10-21.svg")!);
    expect(meta.status).toBe("ok");
  });
  it("adds the row to the rig note's Rig history and writes nothing else but the new file and the lab note", async () => {
    const { st, v, processed } = setup({ note: NOTE, template: SNAP_T });
    await st.run(tp({ rig: "Rig A" }), file("S/t.md"));
    expect(v.files.get("Rigs/Rig A.md")).toContain(`## Rig history\n<!-- lab-kit rig-history format: 1 -->\n| Date | Snapshot | Change |\n|---|---|---|\n| 2026-10-21 | ${A1} |`);
    expect(v.files.get("Rigs/Rig A.md")!.startsWith(RIG.trimEnd())).toBe(true);
    expect(processed).toEqual(["Rigs/Rig A.md"]);
  });
  it("a second lab note with the rig unchanged links the same file; no new file, no new row", async () => {
    const { st, v } = setup({ note: NOTE, template: SNAP_T });
    await st.run(tp({ rig: "Rig A" }), file("S/t.md"));
    const rigAfter = v.files.get("Rigs/Rig A.md");
    day(23);
    expect(await st.run(tp({ rig: "Rig A" }), file("S/t.md"))).toBe(`\n[[Rig A]]\n\n!${A1}\n*Snapshot of Rig A, 2026-10-21*\n`);
    expect(v.created).toHaveLength(1);
    expect(v.files.get("Rigs/Rig A.md")).toBe(rigAfter);
  });
  it("after a table change: a new dated file, linked, with its own history row", async () => {
    const { st, v } = setup({ note: NOTE, template: SNAP_T });
    await st.run(tp({ rig: "Rig A" }), file("S/t.md"));
    v.files.set("Rigs/Rig A.md", v.files.get("Rigs/Rig A.md")!.replace("| monomer |", "| monomer B |"));
    day(22);
    const out = await st.run(tp({ rig: "Rig A" }), file("S/t.md"));
    expect(out).toContain("![[Rigs/Rig A history/Rig A 2026-10-22.svg]]\n*Snapshot of Rig A, 2026-10-22*");
    expect(v.created).toEqual(["Rigs/Rig A history/Rig A 2026-10-21.svg", "Rigs/Rig A history/Rig A 2026-10-22.svg"]);
    expect(v.files.get("Rigs/Rig A.md")).toContain("| 2026-10-22 | [[Rigs/Rig A history/Rig A 2026-10-22.svg]] |");
  });
  it("a lab note made with the old Mermaid snippet is left byte-equal", async () => {
    const { st, v, processed } = setup({ note: NOTE, template: SNAP_T, extra: { "Lab/ABC0010 - old.md": OLD } });
    await st.run(tp({ rig: "Rig A" }), file("S/t.md"));
    expect(v.files.get("Lab/ABC0010 - old.md")).toBe(OLD);
    expect(processed).not.toContain("Lab/ABC0010 - old.md");
    expect(v.created.every(p => p.endsWith(".svg"))).toBe(true);
  });
  it("a user's copy with {{rig-diagram:rig}} still writes the Mermaid block and takes no snapshot", async () => {
    const OLD_T = SNAP_T.replace("!{{rig-snapshot:rig}}\n*Snapshot of {{rig}}, {{rig-snapshot-date:rig}}*\n", "{{rig-diagram:rig}}\n").replace(',"Rig snapshot":"{{rig-snapshot:rig}}"', "").replace("Snapshot: {{rig-snapshot:rig}}\n", "");
    expect(OLD_T).not.toContain("rig-snapshot");
    const { st, v } = setup({ note: NOTE, template: OLD_T });
    expect(await st.run(tp({ rig: "Rig A" }), file("S/t.md"))).toBe(`\n[[Rig A]]\n\n${DIAGRAM}\n`);
    expect(v.created).toEqual([]);
  });
  it("two Rig snippets in one lab note: two embeds, each its own rig", async () => {
    const { st, doc } = setup({ note: NOTE, template: SNAP_T });
    const first = await st.run(tp({ rig: "Rig A" }), file("S/t.md"));
    doc.text += first;
    const second = await st.run(tp({ rig: "Batch" }), file("S/t.md"));
    doc.text += second;
    expect(doc.text.match(/^!\[\[.*\.svg\]\]$/gm)).toEqual([`!${A1}`, "![[Rigs/Batch history/Batch 2026-10-21.svg]]"]);
    expect(doc.text).toContain('Rig snapshot: "[[Rigs/Batch history/Batch 2026-10-21.svg]]"');   // the property names the last rig, as Rig does
  });
  it("cancelled, or a rig without parts: no file is made", async () => {
    const { st, v } = setup({ note: NOTE, template: SNAP_T, extra: { "Rigs/Empty.md": "No tables.\n" } });
    expect(await st.run(tp(null), file("S/t.md"))).toBe("");
    expect(await st.run(tp({ rig: "Empty" }), file("S/t.md"))).toBe("");
    expect(Notice.messages.at(-1)).toBe('t: "Empty" has no parts table (a table with an ID and a Feeds column).');
    expect(v.created).toEqual([]);
  });
  it("Make my own copy of a snapshot snippet copies the template (tokens kept) and makes no snapshot", async () => {
    const written: Record<string, string> = {};
    const res = await copyTokenTemplate({ text: SNAP_T, name: "14 Rig", copyName: "Rig (mine)", folder: "S", exists: () => false, write: async (p, t) => { written[p] = t; } });
    expect(Object.keys(written)).toEqual([res.path]);
    expect(written[res.path]).toContain("!{{rig-snapshot:rig}}");
  });
});
