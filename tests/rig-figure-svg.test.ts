// Rig figure Phase 2: symbols and the SVG writer (src/rig/symbols.ts, src/rig/figure-svg.ts). Fictional rigs only.
import { describe, it, expect } from "vitest";
import { readRig, PART_KINDS } from "../src/rig/parts";
import { buildFigure } from "../src/rig/figure";
import { figureSvg } from "../src/rig/figure-svg";
import { COMPUTER, symbolFor, SYMBOL_NAMES } from "../src/rig/symbols";

const header = "| ID | Part | Type | Feeds |";
const fig = (...rows: string[]) => { const r = readRig([header, "|---|---|---|---|", ...rows.map(x => `| ${x} |`)].join("\n")); return buildFigure(r.parts, r.links); };
const draw = (...rows: string[]) => figureSvg(fig(...rows));
const tee = ["PA | Pump | syringe | T1", "PB | Pump | syringe | T1", "T1 | Mixer | tee | C1", "C1 | Reactor | coil | A1", "A1 | Analysis | probe | COL", "COL | Outlet | vial |"];
/** The first and last point of a drawn line: "M x y L x y ...". */
const ends = (svg: string, attr: string): [number[], number[]] => {
  const d = new RegExp(`${attr}[^>]* d="M ([^"]+)"`).exec(svg)![1].split(" L ").map(p => p.split(" ").map(Number));
  return [d[0], d[d.length - 1]];
};

describe("symbols", () => {
  it("every part kind has a symbol and an unknown kind gets the box", () => {
    for (const k of PART_KINDS) expect(symbolFor(k, "").name).not.toBe("box");
    expect(symbolFor("", "").name).toBe("box");
  });
  it("the detail picks a flask, a column box or a waste arrow", () => {
    expect(symbolFor("Reactor", "Batch vessel").name).toBe("flask");
    expect(symbolFor("Reactor", "packed column").name).toBe("column");
    expect(symbolFor("Reactor", "chip").name).toBe("box");
    expect(symbolFor("Reactor", "coil").name).toBe("coil");
    expect(symbolFor("Outlet", "Waste").name).toBe("waste");
    expect(symbolFor("Outlet", "collection vial").name).toBe("vial");
  });
  it("connection points lie on or inside the symbol's box and the input is left of the output", () => {
    for (const name of SYMBOL_NAMES) {
      const s = [...PART_KINDS, ""].map(k => symbolFor(k, ["waste", "flask", "column"].includes(name) ? name : "")).find(x => x.name === name)!;
      expect(s.in.x).toBeLessThanOrEqual(s.out.x);
      for (const p of [s.in, s.out, s.top, s.bottom]) {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(s.w / 2);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(s.h / 2 + 8);
      }
    }
  });
});

describe("figureSvg", () => {
  it("wraps each symbol in a group named for its symbols.ts entry, numbered per name", () => {
    const r = draw(...tee, "X1 | Gizmo | | ");
    const groups = [...r.svg.matchAll(/<g id="sym-([a-z]+)-(\d+)" data-symbol="([a-z]+)" data-part="([^"]+)"/g)].map(m => [m[1] + "-" + m[2], m[3], m[4]]);
    expect(groups.map(g => g.join(" ")).sort()).toEqual(["analysis-1 analysis A1", "box-1 box X1", "coil-1 coil C1", "pump-1 pump PA", "pump-2 pump PB", "tee-1 tee T1", "vial-1 vial COL"]);
    for (const [, name] of groups) expect([...SYMBOL_NAMES, "box"]).toContain(name);
    expect(new Set(groups.map(g => g[0])).size).toBe(groups.length);
  });
  it("gives every part one symbol and one label, and lists unknown kinds as missing", () => {
    const r = draw(...tee, "X1 | Gizmo | | ");
    for (const id of ["PA", "PB", "T1", "C1", "A1", "COL", "X1"]) expect(r.svg).toContain(`data-part="${id}"`);
    expect(r.missing).toEqual(["X1"]);
    expect((r.svg.match(/<text /g) ?? []).length).toBeGreaterThanOrEqual(7);
  });
  it("each process line starts on the source's output and ends on the target's input", () => {
    const f = fig(...tee), r = figureSvg(f);
    const n = (id: string) => f.nodes.find(x => x.id === id)!;
    for (const e of f.edges) {
      const a = n(e.from), b = n(e.to), sa = symbolFor(a.kind, a.detail), sb = symbolFor(b.kind, b.detail);
      const [start, end] = ends(r.svg, `data-from="${e.from}" data-to="${e.to}"`);
      expect(start).toEqual([Math.round((a.x + sa.out.x) * 10) / 10, Math.round((a.y + sa.out.y) * 10) / 10]);
      expect(end).toEqual([Math.round((b.x + sb.in.x) * 10) / 10, Math.round((b.y + sb.in.y) * 10) / 10]);
    }
  });
  it("a chain level with its feeder is drawn without a bend, a tee is met at its centre and a vial is entered from above", () => {
    const f = fig(...tee), r = figureSvg(f);
    const d = (from: string, to: string) => new RegExp(`data-from="${from}" data-to="${to}" d="M ([^"]+)"`).exec(r.svg)![1].split(" L ");
    expect(d("T1", "C1")).toHaveLength(2);
    expect(d("C1", "A1")).toHaveLength(2);
    const pa = d("PA", "T1"), t = f.nodes.find(n => n.id === "T1")!;
    expect(pa[pa.length - 1]).toBe(`${t.x} ${t.y}`);
    expect(pa[pa.length - 2].split(" ")[0]).toBe(String(t.x));
    const col = f.nodes.find(n => n.id === "COL")!, v = d("A1", "COL");
    expect(v[v.length - 1]).toBe(`${col.x} ${col.y + symbolFor(col.kind, col.detail).in.y}`);
    expect(v[v.length - 2].split(" ")[0]).toBe(String(col.x));
  });
  it("a join dot appears where two streams meet a part that is not a tee, and not on a single line", () => {
    const joined = draw("PA | Pump | | R1", "PB | Pump | | R1", "R1 | Reactor | coil |");
    expect((joined.svg.match(/<circle [^>]*r="5"/g) ?? [])).toHaveLength(1);
    expect(draw(...tee).svg).not.toMatch(/<circle [^>]*r="5"/);
    expect(draw("P1 | Pump | | R1", "R1 | Reactor | coil |").svg).not.toMatch(/<circle [^>]*r="5"/);
  });
  it("a heater hangs off its reactor on a dashed line, a cycle returns on a dashed line", () => {
    const h = draw("P1 | Pump | | R1", "R1 | Reactor | | OUT", "H1 | Heater | | R1", "OUT | Outlet | |");
    expect(h.svg).toMatch(/data-attached="H1" data-host="R1" d="[^"]+" stroke-dasharray/);
    const c = draw("P1 | Pump | | R1", "R1 | Reactor | | V1", "V1 | Valve | | R1");
    expect(c.svg).toMatch(/data-back="1" d="[^"]+" stroke-dasharray/);
  });
  it("text is escaped and the SVG has no script", () => {
    const r = figureSvg(fig("P1 | Pump | <script>alert(1)</script> & \"q\" |"), { title: "A <b> & B" });
    expect(r.svg).not.toContain("<script");
    expect(r.svg).not.toContain("<b>");
    expect(r.svg).toContain("A &lt;b&gt; &amp; B");
    expect(r.svg).toContain("&amp;");
  });
  it("tags are balanced and an ID's trailing digits are a subscript", () => {
    const { svg } = draw(...tee);
    const count = (re: RegExp) => (svg.match(re) ?? []).length;
    expect(count(/<g[ >]/g)).toBe(count(/<\/g>/g));
    expect(count(/<text /g)).toBe(count(/<\/text>/g));
    expect(svg).toContain('T<tspan dy="4" font-size="70%">1</tspan>');
  });
  it("is deterministic, and an empty figure is a valid small SVG", () => {
    expect(draw(...tee).svg).toBe(draw(...tee).svg);
    const e = figureSvg(buildFigure([], []));
    expect(e.svg).toMatch(/^<svg [^>]*viewBox="0 0 80 80"/);
    expect(e.svg.endsWith("</svg>")).toBe(true);
  });
});

describe("computer and control lines", () => {
  const ctl = (opts = {}) => { const r = readRig(["| ID | Part | Type | Feeds | Control | Data |", "|---|---|---|---|---|---|", "| PA | Pump | | T1 | Flow rate | |", "| PB | Pump | | T1 | Flow rate | |", "| T1 | Mixer | | C1 | | |", "| C1 | Reactor | coil | A1 | Temperature | Conversion |", "| A1 | Analysis | | | | |"].join("\n")); const f = buildFigure(r.parts, r.links, { computer: "PC & co" }); return { f, svg: figureSvg(f, opts).svg }; };
  const path = (svg: string, attr: string) => new RegExp(`<path data-${attr} d="M ([^"]+)" stroke="([^"]+)" stroke-dasharray="7 5"`).exec(svg)!;
  it("draws the computer with its escaped label, and a dashed coloured line per control and data cell", () => {
    const { svg, f } = ctl();
    expect(svg).toContain('data-computer="1"');
    expect(svg).toContain('<g id="sym-computer-1" data-symbol="computer" data-computer="1"');
    expect(svg).toContain("PC &amp; co");
    expect((svg.match(/data-control="/g) ?? [])).toHaveLength(3);
    expect((svg.match(/data-data="/g) ?? [])).toHaveLength(1);
    expect(path(svg, 'control="PA"')[2]).toBe("#1f4fd8");
    expect(path(svg, 'data="C1"')[2]).toBe("#d62728");
    expect(f.computer).not.toBeNull();
  });
  it("a control line starts on the computer and ends on the top of its part; a data line starts on the part and ends on the computer", () => {
    const { svg, f } = ctl();
    const c = f.computer!, bottom = c.y + COMPUTER.h / 2;
    const pts = (m: RegExpExecArray) => m[1].split(" L ").map(p => p.split(" ").map(Number));
    const part = (id: string) => f.nodes.find(n => n.id === id)!;
    const ctrl = pts(path(svg, 'control="PA"')), pa = part("PA");
    expect(ctrl[0][1]).toBe(bottom);
    expect(ctrl[ctrl.length - 1][1]).toBe(pa.y + symbolFor(pa.kind, pa.detail).top.y);
    const data = pts(path(svg, 'data="C1"'));
    expect(data[data.length - 1][1]).toBe(bottom);
    expect(Math.abs(data[0][0] - part("C1").x)).toBeLessThanOrEqual(10);
  });
  it("process lines stay black and solid, and the colours can be set", () => {
    const { svg } = ctl({ controlColor: "#00aa00", dataColor: "#aa00aa" });
    expect(path(svg, 'control="PA"')[2]).toBe("#00aa00");
    expect(path(svg, 'data="C1"')[2]).toBe("#aa00aa");
    expect(/<path data-from="PA" data-to="T1" d="[^"]+"\/>/.test(svg)).toBe(true);
  });
  it("a figure with no control cells has no computer and no coloured lines", () => {
    const { svg } = { svg: draw(...tee).svg };
    expect(svg).not.toContain("data-computer");
    expect(svg).not.toContain("#1f4fd8");
  });
});
