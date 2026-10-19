// Rig figure Phase 2: symbols and the SVG writer (src/rig/symbols.ts, src/rig/figure-svg.ts). Fictional rigs only.
import { describe, it, expect } from "vitest";
import { readRig, controlLabel, PART_KINDS } from "../src/rig/parts";
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

/** The coordinate pairs of an SVG path of M / L commands. */
const nums = (d: string): number[][] => [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])]);

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
  it("a Pump with detail syringe is drawn as a syringe, any other pump as the round pump", () => {
    expect(symbolFor("Pump", "Syringe pump").name).toBe("syringe");
    expect(symbolFor("Pump", "HPLC").name).toBe("pump");
    expect(symbolFor("Pump", "").name).toBe("pump");
  });
  it("the pump's triangle is not acute (apex 60 degrees or wider) and lies inside its circle", () => {
    const [a, b, c] = nums(symbolFor("Pump", "").body.match(/<path d="([^"]+)"/)![1]);
    const v1 = [a[0] - b[0], a[1] - b[1]], v2 = [c[0] - b[0], c[1] - b[1]];
    const angle = Math.acos((v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2))) * 180 / Math.PI;
    expect(angle).toBeGreaterThanOrEqual(59.9);
    for (const p of [a, b, c]) expect(Math.hypot(p[0], p[1])).toBeLessThanOrEqual(26.01);
  });
  it("sizes and connection points: pump 52x52, syringe 72x22 with the line in on the plunger side and out at the tip, both on the centre line", () => {
    const pump = symbolFor("Pump", ""), syr = symbolFor("Pump", "syringe");
    expect([pump.w, pump.h]).toEqual([52, 52]);
    expect([syr.w, syr.h]).toEqual([72, 22]);
    expect([syr.in, syr.out]).toEqual([{ x: -36, y: 0 }, { x: 36, y: 0 }]);
    expect([pump.in.y, pump.out.y]).toEqual([0, 0]);
  });
  it("the coil's stripes are centred in the coil", () => {
    const xs = nums(symbolFor("Reactor", "coil").body.match(/<path d="([^"]+)"/)![1]).map(p => p[0]);
    expect(Math.min(...xs) + Math.max(...xs)).toBe(0);
    expect(Math.max(...xs)).toBeLessThan(42);
  });
  it("connection points lie on or inside the symbol's box and the input is left of the output", () => {
    for (const name of SYMBOL_NAMES) {
      const s = [...PART_KINDS, ""].map(k => symbolFor(k, ["waste", "flask", "column", "syringe", "oven"].includes(name) ? name : "")).find(x => x.name === name)!;
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
    expect(groups.map(g => g.join(" ")).sort()).toEqual(["analysis-1 analysis A1", "box-1 box X1", "coil-1 coil C1", "syringe-1 syringe PA", "syringe-2 syringe PB", "tee-1 tee T1", "vial-1 vial COL"]);
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
  it("tee rig: the flow into the collection vial is one level run and one straight drop from above", () => {
    const f = fig(...tee), r = figureSvg(f);
    const pts = nums(new RegExp(`data-from="A1" data-to="COL" d="M ([^"]+)"`).exec(r.svg)![1].replace(/ L /g, " "));
    const col = f.nodes.find(n => n.id === "COL")!;
    expect(pts).toHaveLength(3);
    expect(pts[0][1]).toBe(pts[1][1]);
    expect(pts[1][0]).toBe(pts[2][0]);
    expect(pts[2][0]).toBe(col.x);
    expect(pts[2][1]).toBeGreaterThan(pts[1][1]);   // the drop goes down into the mouth
  });
  it("batch rig: the line from the flask to the pump is straight and level (no jog)", () => {
    const f = fig("F1 | Reactor | flask | P1", "P1 | Pump | | C1", "C1 | Reactor | packed column | W", "W | Outlet | waste |"), r = figureSvg(f);
    const pts = nums(new RegExp(`data-from="F1" data-to="P1" d="M ([^"]+)"`).exec(r.svg)![1].replace(/ L /g, " "));
    expect(pts).toHaveLength(2);
    expect(pts[0][1]).toBe(pts[1][1]);
    expect(pts[0][1]).toBe(f.nodes.find(n => n.id === "F1")!.y);   // the output is level with the flask's centre
  });
  it("recycle rig: the dashed return leaves the valve itself and rejoins the target clear of the feed lines", () => {
    const f = fig("PA | Pump | | R1", "PB | Pump | | R1", "R1 | Reactor | coil | V1", "V1 | Valve | | OUT, R1", "OUT | Outlet | waste |"), r = figureSvg(f);
    const get = (attr: string) => nums(new RegExp(`${attr}[^>]* d="M ([^"]+)"`).exec(r.svg)![1].replace(/ L /g, " "));
    const n = (id: string) => f.nodes.find(x => x.id === id)!;
    const back = get('data-from="V1" data-to="R1" data-back="1"'), v = n("V1"), valve = symbolFor("Valve", ""), coil = symbolFor("Reactor", "coil");
    expect(back[0]).toEqual([v.x + valve.bottom.x, v.y + valve.bottom.y]);   // starts on the valve's underside
    expect(back[1][0]).toBe(back[0][0]);                                     // and drops straight down
    expect(back).toHaveLength(5);
    const r1 = n("R1"), feedX = r1.x + coil.in.x - 30;
    expect(back[3][0]).toBe(r1.x + coil.in.x - 15);                          // rises beside the feed lines' vertical, not on it
    expect(back[3][0]).not.toBe(feedX);
    expect(get('data-from="PA" data-to="R1"').some(p => p[0] === feedX)).toBe(true);
    expect(back[4]).toEqual([r1.x + coil.in.x, r1.y + coil.in.y]);
    expect(r.svg).toMatch(new RegExp(`<text x="${v.x + 12}" y="${v.y + 24}"[^>]*>V<tspan`));   // the valve's label is beside the return line, not on it
  });
  it("a join dot appears where two streams meet a part that is not a tee, and not on a single line", () => {
    const joined = draw("PA | Pump | | R1", "PB | Pump | | R1", "R1 | Reactor | coil |");
    expect((joined.svg.match(/<circle [^>]*r="5"/g) ?? [])).toHaveLength(1);
    expect(draw(...tee).svg).not.toMatch(/<circle [^>]*r="5"/);
    expect(draw("P1 | Pump | | R1", "R1 | Reactor | coil |").svg).not.toMatch(/<circle [^>]*r="5"/);
  });
  it("a cycle returns on a dashed line", () => {
    const c = draw("P1 | Pump | | R1", "R1 | Reactor | | V1", "V1 | Valve | | R1");
    expect(c.svg).toMatch(/data-back="1" d="[^"]+" stroke-dasharray/);
  });
  /** Where a part's symbol group is drawn: the translate of its `data-part` group. */
  const spot = (svg: string, id: string): number[] => {
    const m = new RegExp(`data-part="${id}" transform="translate\\(([-\\d.]+) ([-\\d.]+)\\)"`).exec(svg)!;
    return [Number(m[1]), Number(m[2])];
  };
  it("a hot plate sits directly under its flask (or column), touching it, with no line between", () => {
    for (const host of ["flask", "packed column"]) {
      const f = fig("P1 | Pump | | R1", `R1 | Reactor | ${host} | OUT`, "H1 | Heater | | R1", "OUT | Outlet | waste |"), r = figureSvg(f);
      const hs = symbolFor("Reactor", host), ps = symbolFor("Heater", "");
      const [hx, hy] = spot(r.svg, "R1"), [px, py] = spot(r.svg, "H1");
      expect(px).toBe(hx);
      expect(py + ps.top.y).toBe(hy + hs.bottom.y);   // the plate's top meets the host's underside
      expect(r.svg).not.toContain('data-attached="H1"');
      expect(r.svg).not.toMatch(/data-from="H1"/);
    }
  });
  it("a second attached part sits under the first", () => {
    const f = fig("P1 | Pump | | R1", "R1 | Reactor | flask | ", "H1 | Heater | | R1", "S1 | Stirrer | | R1"), r = figureSvg(f);
    const ps = symbolFor("Heater", "");
    expect(spot(r.svg, "S1")[1] + ps.top.y).toBe(spot(r.svg, "H1")[1] + ps.bottom.y);
  });
  it("a heater with detail oven or jacket is drawn around its column, larger than it and with the same centre, under the lines", () => {
    for (const detail of ["column oven", "jacket"]) {
      const f = fig("P1 | Pump | | R1", "R1 | Reactor | packed column | OUT", `H1 | Heater | ${detail} | R1`, "OUT | Outlet | waste |"), r = figureSvg(f);
      const col = symbolFor("Reactor", "packed column");
      expect(symbolFor("Heater", detail).name).toBe("oven");
      expect(spot(r.svg, "H1")).toEqual(spot(r.svg, "R1"));
      const m = new RegExp(`data-symbol="oven" data-part="H1"[^>]*><rect x="(-?[\\d.]+)" y="(-?[\\d.]+)" width="([\\d.]+)" height="([\\d.]+)"`).exec(r.svg)!;
      const [x, y, w, h] = m.slice(1).map(Number);
      expect(x).toBeLessThan(-col.w / 2); expect(y).toBeLessThan(-col.h / 2);
      expect(x + w).toBeGreaterThan(col.w / 2); expect(y + h).toBeGreaterThan(col.h / 2);
      expect(x + w).toBe(-x); expect(y + h).toBe(-y);
      expect(r.svg.indexOf('data-symbol="oven"')).toBeLessThan(r.svg.indexOf('<g fill="none">'));   // drawn first, so the lines run over it
      expect(r.svg).not.toContain('data-attached="H1"');
    }
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
  it("lines going the same way share one run: the same trunk and bus under the computer, one lane per direction", () => {
    const { svg, f } = ctl();
    const pts = (attr: string) => path(svg, attr)[1].split(" L ").map(p => p.split(" ").map(Number));
    const control = ["PA", "PB", "C1"].map(id => pts(`control="${id}"`));
    for (const c of control) { expect(c[0]).toEqual(control[0][0]); expect(c[1]).toEqual(control[0][1]); }   // one trunk start, one bus lane
    const data = pts('data="C1"'), lanes = new Set([control[0][1][1], data[data.length - 2][1]]);
    expect(lanes.size).toBe(2);                                          // control and data each have one lane
    const bottom = f.computer!.y + COMPUTER.h / 2;
    expect(data[data.length - 1][1]).toBe(bottom);
    expect(data[data.length - 1][0]).not.toBe(control[0][0][0]);          // the data trunk is apart from the control trunk
    expect(Math.max(...lanes)).toBeLessThan(Math.min(...f.nodes.map(n => n.y - 30)));   // both buses run above the flow
  });
  it("the computer's label is drawn with a fill, so it shows on the white symbol group", () => {
    expect(ctl().svg).toMatch(/<text [^>]*fill="#000000"[^>]*>PC &amp; co<\/text>/);
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

describe("an SVG other tools can read (Phase 4)", () => {
  it("has no <style> rule and no class: fills are attributes, the tee dot and the outlet arrow are black", () => {
    const { svg } = draw(...tee, "W1 | Outlet | waste |");
    expect(svg).not.toContain("<style");
    expect(svg).not.toContain("class=");
    expect(svg).toMatch(/<circle r="7" fill="#000000"\/>/);
    expect(svg).toMatch(/<path d="M12 -9 L32 0 L12 9 Z" fill="#000000"\/>/);
  });
  it("keeps one <g> per part", () => {
    const f = fig(...tee);
    const { svg } = figureSvg(f);
    expect([...svg.matchAll(/<g id="sym-[a-z]+-\d+" data-symbol="[a-z]+" data-part="/g)].length).toBe(f.nodes.length);
  });
  it("reads the Control: property as the computer's label", () => {
    expect(controlLabel("---\nTubing: PFA\nControl: Lab PC 2\n---\n```rig\n```")).toBe("Lab PC 2");
    expect(controlLabel('---\ncontrol: "Pump PC"\n---\n')).toBe("Pump PC");
    expect(controlLabel("---\nControl:\n---\n")).toBe("");
    expect(controlLabel("no front matter\nControl: x")).toBe("");
    const r = readRig([ "| ID | Part | Feeds | Control |", "|---|---|---|---|", "| PA | Pump | | Flow rate |"].join("\n"));
    const f = buildFigure(r.parts, r.links, { computer: controlLabel("---\nControl: Lab PC 2\n---\n") || undefined });
    expect(f.computer?.label).toBe("Lab PC 2");
    expect(figureSvg(f).svg).toContain(">Lab PC 2</text>");
  });
});
