// Rig notes Phase 1: parts tables to parts, connections and Mermaid text (src/rig/parts.ts). Fixtures: tests/fixtures/rigs (made-up part details).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { mermaidText, partKind, readRig } from "../src/rig/parts";

const rig = (name: string) => readRig(readFileSync(`tests/fixtures/rigs/${name}.md`, "utf8"));
const arrows = (name: string): string[] => rig(name).links.map(l => `${l.from}${l.attached ? " -.- " : " --> "}${l.to}`);
const table = (header: string, ...rows: string[]): string => [header, header.replace(/[^|]+/g, "---"), ...rows].join("\n");

describe("fixture rigs", () => {
  it("single tubular reactor: the whole diagram text, heater on a dashed line", () => {
    const r = rig("single-tubular");
    expect(r.problems).toEqual([]);
    expect(r.mermaid).toBe([
      "flowchart LR",
      '  P1["P1<br>syringe pump"]',
      '  R1["R1<br>coil"]',
      '  H1["H1<br>heating cartridge"]',
      '  BPR["BPR<br>cartridge"]',
      '  OUT["OUT<br>collection vial"]',
      "  P1 --> R1",
      "  R1 --> BPR",
      "  H1 -.- R1",
      "  BPR --> OUT",
    ].join("\n"));
  });
  it("kind comes from the Part column, else from the heading above the table", () => {
    const r = rig("single-tubular");
    expect(r.parts.map(p => `${p.id}:${p.kind}`)).toEqual(["P1:Pump", "R1:Reactor", "H1:Heater", "BPR:Regulator", "OUT:Outlet"]);
    expect(r.tables.map(t => t.heading)).toEqual(["Pumps", "Reactor line"]);
  });
  it("extra columns are kept as written, by header", () => {
    const p1 = rig("single-tubular").parts[0];
    expect(p1.cells).toMatchObject({ Carries: "monomer solution", "Tubing in": "PFA 1.6 mm", "Tubing out": "PFA 0.75 mm", "Pressure limit": "" });
    expect(rig("single-tubular").tables[0].lines).toHaveLength(3);
  });
  it("two pumps into a mixer", () => {
    expect(rig("two-pumps-mixer").problems).toEqual([]);
    expect(arrows("two-pumps-mixer")).toEqual(["P1 --> M1", "P2 --> M1", "M1 --> R1", "R1 --> OUT"]);
  });
  it("telescoped tubular + two-tank cascade: stages in their own tables", () => {
    const r = rig("telescoped-cascade");
    expect(r.problems).toEqual([]);
    expect(r.parts.filter(p => p.kind === "Reactor").map(p => `${p.id} ${p.cells.Size}`)).toEqual(["R1 10 mL", "T1 5 mL", "T2 5 mL"]);
    expect(arrows("telescoped-cascade")).toEqual(["P1 --> R1", "P2 --> M1", "R1 --> M1", "H1 -.- R1", "M1 --> T1", "T1 --> T2", "T2 --> BPR", "BPR --> OUT"]);
  });
  it("in-line analysis after the regulator", () => {
    const r = rig("inline-analysis");
    expect(r.problems).toEqual([]);
    expect(r.parts.at(-1)).toMatchObject({ id: "NMR", kind: "Analysis", detail: "benchtop NMR" });
    expect(arrows("inline-analysis")).toContain("BPR --> NMR");
  });
  it("the same rig as one table and as three tables gives the same diagram", () => {
    expect(rig("inline-analysis-one-table").problems).toEqual([]);
    expect(rig("inline-analysis-one-table").mermaid).toBe(rig("inline-analysis").mermaid);
    expect(rig("inline-analysis-one-table").tables).toHaveLength(1);
    expect(rig("inline-analysis").tables).toHaveLength(3);
  });
  it("a sampling valve feeds an analysis module and the outlet", () => {
    expect(rig("sampling-valve").problems).toEqual([]);
    expect(arrows("sampling-valve")).toEqual(["P1 --> R1", "R1 --> V1", "V1 --> GPC", "V1 --> OUT"]);
  });
});

describe("reading the tables", () => {
  it("columns are found by name in any order and any case; a table without ID and Feeds is not a parts table", () => {
    const r = readRig(["# Pumps", table("| feeds | Model | id |", "| R1 | pump | P1 |"), "", table("| Sample | Conversion |", "| A | 50 |"), "",
      table("| ID | Part | Feeds |", "| R1 | reactor | |")].join("\n"));
    expect(r.problems).toEqual([]);
    expect(r.tables).toHaveLength(2);
    expect(r.mermaid).toContain("P1 --> R1");
  });
  it("front matter and code blocks are not read; empty rows are skipped", () => {
    const r = readRig(["---", "Tubing: PFA", "---", "```", table("| ID | Part | Feeds |", "| X1 | Pump | |"), "```", "## Pumps",
      table("| ID | Feeds |", "| P1 | |", "| | |")].join("\n"));
    expect(r.problems).toEqual([]);
    expect(r.parts.map(p => p.id)).toEqual(["P1"]);
  });
  it("Feeds matches IDs without regard to case; links in cells read as their text", () => {
    const r = readRig(table("| ID | Part | Type | Feeds |", "| P1 | Pump | [[Pump note\\|syringe pump]] | bpr |", "| BPR | **Regulator** | | |"));
    expect(r.problems).toEqual([]);
    expect(r.links).toEqual([{ from: "P1", to: "BPR", attached: false }]);
    expect(r.parts[0].detail).toBe("syringe pump");
  });
  it("part kinds: singular or plural, any case", () => {
    expect([partKind("Pumps"), partKind("analysis"), partKind("Analyses"), partKind("Reactor line"), partKind("")]).toEqual(["Pump", "Analysis", "Analysis", "", ""]);
  });
});

describe("problems are messages, never thrown", () => {
  it("no parts table", () => {
    const r = readRig("Just a note.\n\n" + table("| Sample | Conversion |", "| A | 50 |"));
    expect(r.problems).toEqual(["No parts table found: a parts table has an ID and a Feeds column."]);
    expect(r.mermaid).toBe("");
    expect(readRig("").mermaid).toBe("");
  });
  it("unknown Feeds ID: the message names it, the other connections are drawn", () => {
    const r = readRig(table("| ID | Part | Feeds |", "| P1 | Pump | R1, R9 |", "| R1 | Reactor | |"));
    expect(r.problems).toEqual(['P1 feeds "R9", which is not the ID of a part.']);
    expect(r.links).toHaveLength(1);
  });
  it("duplicate ID, also across tables: the first is drawn", () => {
    const r = readRig(["## Pumps", table("| ID | Model | Feeds |", "| P1 | first | |"), "## Mixers", table("| ID | Model | Feeds |", "| p1 | second | |")].join("\n"));
    expect(r.problems).toEqual(['The ID "p1" is used more than once: only the first is drawn.']);
    expect(r.parts.map(p => p.detail)).toEqual(["first"]);
  });
  it("missing ID", () => {
    const r = readRig(["## Pumps", table("| ID | Model | Feeds |", "| P1 | a | |", "| | b | P1 |")].join("\n"));
    expect(r.problems).toEqual(['Row 2 of the table under "Pumps" has no ID.']);
    expect(r.parts).toHaveLength(1);
  });
  it("a kind that cannot be worked out: the part is still drawn", () => {
    const r = readRig(["## Reactor line", table("| ID | Feeds |", "| R1 | |"), "", table("| ID | Part | Feeds |", "| M1 | Mixr | |")].join("\n"));
    expect(r.problems).toEqual([
      'R1 has no part kind: add a Part column to the table under "Reactor line", or put the table under a heading that names one kind (Pumps, Analysis).',
      'M1: "Mixr" is not a part kind (Pump, Mixer, Reactor, Heater, Regulator, Valve, Analysis, Outlet, Tubing).',
    ]);
    expect(r.mermaid).toBe('flowchart LR\n  R1["R1"]\n  M1["M1"]');
  });
});

describe("Mermaid text", () => {
  it("special characters in labels become entity codes", () => {
    expect(mermaidText('a "b" [c] {d} (e) | <f> & # `g`')).toBe("a #34;b#34; #91;c#93; #123;d#125; #40;e#41; #124; #60;f#62; #38; #35; #96;g#96;");
  });
  it("IDs that are not plain names, or are Mermaid words, get a made-up node name; the label keeps the ID", () => {
    const r = readRig(table("| ID | Part | Type | Feeds |", '| P-1 "A" | Pump | pump [x] \\| y | end |', "| end | Outlet | | |", "| n1 | Mixer | | |"));
    expect(r.problems).toEqual([]);
    expect(r.mermaid).toBe([
      "flowchart LR",
      '  n1["P-1 #34;A#34;<br>pump #91;x#93; #124; y"]',
      '  n2["end<br>Outlet"]',
      '  n1_["n1<br>Mixer"]',
      "  n1 --> n2",
    ].join("\n"));
  });
});
