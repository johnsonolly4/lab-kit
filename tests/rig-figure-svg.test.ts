// Rig figure Phase 2: symbols and the SVG writer (src/rig/symbols.ts, src/rig/figure-svg.ts). Fictional rigs only.
import { describe, it, expect } from "vitest";
import { readRig, PART_KINDS } from "../src/rig/parts";
import { buildFigure } from "../src/rig/figure";
import { figureSvg } from "../src/rig/figure-svg";
import { symbolFor, SYMBOL_NAMES } from "../src/rig/symbols";

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
    expect(symbolFor("Reactor", "packed column").name).toBe("box");
    expect(symbolFor("Reactor", "coil").name).toBe("coil");
    expect(symbolFor("Outlet", "Waste").name).toBe("waste");
    expect(symbolFor("Outlet", "collection vial").name).toBe("vial");
  });
  it("connection points lie on or inside the symbol's box and the input is left of the output", () => {
    for (const name of SYMBOL_NAMES) {
      const s = [...PART_KINDS, ""].map(k => symbolFor(k, name === "waste" ? "waste" : name === "flask" ? "flask" : "")).find(x => x.name === name)!;
      expect(s.in.x).toBeLessThan(s.out.x);
      for (const p of [s.in, s.out, s.top, s.bottom]) {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(s.w / 2);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(s.h / 2 + 8);
      }
    }
  });
});

describe("figureSvg", () => {
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
