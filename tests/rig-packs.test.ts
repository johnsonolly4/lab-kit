// Rig figure Phase 6: module packs (src/rig/packs.ts). A FICTIONAL pack held as strings here: no symbol of any group is ever in the repo.
import { describe, it, expect, afterEach } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadPack, packReport, packSymbol, svgRefusal, type PackIo } from "../src/rig/packs";
import { makeFigure, usePack } from "../src/rig/figure-make";
import { snapshotSvg, readSnapshotMeta, rigRecord } from "../src/rig/snapshot";
import { symbolFor } from "../src/rig/symbols";

const TEE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="14"/><path d="M0 20 H6 M34 20 H40 M20 0 V6"/></svg>`;
// what Inkscape adds around a drawing: XML declaration, namespaces, metadata, a named view, labels, xlink links
const PREMIXER = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" viewBox="0 0 100 50">
<sodipodi:namedview id="nv" inkscape:zoom="2"/>
<metadata id="m"><rdf:RDF><rdf:Description about="x"/></rdf:RDF></metadata>
<defs><path id="p" d="M10 10 H90"/></defs>
<g inkscape:label="Layer 1"><rect x="2" y="2" width="96" height="46" rx="6"/><use xlink:href="#p"/></g></svg>`;
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 30, 0, 0, 0, 20, 8, 6, 0, 0, 0]);
const LIST = [
  "| Kind | Match | Name | File | In | Out | Top | Bottom | Size |", "|---|---|---|---|---|---|---|---|---|",
  "| Mixer | | test-tee | test-tee.svg | 0,20 | 40,20 | 20,0 | | 36 |",
  "| Mixer | pre-mix | test-premixer | symbols/test-premixer.svg | | | | | 80x40 |",
].join("\n");

const io = (files: Record<string, string | Uint8Array>, folder = "Pack"): PackIo => ({
  list: async f => f === folder ? Object.keys(files).filter(k => k.startsWith(folder + "/")).map(k => k.slice(folder.length + 1)) : null,
  text: async p => typeof files[p] === "string" ? files[p] as string : null,
  binary: async p => files[p] instanceof Uint8Array ? (files[p] as Uint8Array).slice().buffer : null,
});
const GOOD = { "Pack/Pack list.md": LIST, "Pack/test-tee.svg": TEE, "Pack/symbols/test-premixer.svg": PREMIXER };

const RIG = [
  "| ID | Part | Type / model | Feeds |", "|---|---|---|---|",
  "| PA | Pump | syringe | T1 |", "| PB | Pump | syringe | M1 |", "| T1 | Mixer | tee | M1 |", "| M1 | Mixer | pre-mixer box | C1 |", "| C1 | Reactor | coil | W |", "| W | Outlet | waste |  |",
].join("\n");

afterEach(() => usePack(null));

describe("loading a pack", () => {
  it("reads two symbols and their connection points (picture units → figure units, centred)", async () => {
    const p = await loadPack(io(GOOD), "Pack");
    expect(p.problems).toEqual([]);
    expect(p.symbols.map(s => s.sym.name)).toEqual(["pack-test-tee", "pack-test-premixer"]);
    const tee = p.symbols[0].sym;
    expect([tee.w, tee.h]).toEqual([36, 36]);
    expect(tee.in).toEqual({ x: -18, y: 0 });
    expect(tee.top).toEqual({ x: 0, y: -18 });
    expect(tee.bottom).toEqual({ x: 0, y: 18 });   // default: middle of the bottom edge
    expect([p.symbols[1].sym.w, p.symbols[1].sym.h]).toEqual([80, 40]);
  });
  it("drops editor leftovers so the figure stays valid XML", async () => {
    const body = (await loadPack(io(GOOD), "Pack")).symbols[1].sym.body;
    expect(body).not.toMatch(/inkscape|sodipodi|rdf|metadata|xlink/i);
    expect(body).toContain('<rect x="2"');
    expect(body).toContain('<use href="#p"/>');
  });
  it("a Match row wins for a part whose detail has the text; a row without Match is the rest", async () => {
    const p = await loadPack(io(GOOD), "Pack");
    expect(packSymbol(p, "Mixer", "Pre-mixer box")!.name).toBe("pack-test-premixer");
    expect(packSymbol(p, "Mixer", "tee")!.name).toBe("pack-test-tee");
    expect(packSymbol(p, "Pump", "syringe")).toBeNull();
    expect(symbolFor("Pump", "syringe", p).name).toBe("syringe");
  });
  it("takes a PNG as an embedded image with its size from the file", async () => {
    const files = { "Pack/Pack list.md": "| Kind | Name | File | Size |\n|---|---|---|---|\n| Valve | test-valve | v.png | 60 |", "Pack/v.png": PNG };
    const p = await loadPack(io(files), "Pack");
    expect(p.problems).toEqual([]);
    const s = p.symbols[0].sym;
    expect([s.w, s.h]).toEqual([60, 40]);
    expect(s.body).toMatch(/^<image href="data:image\/png;base64,iVBORw0KGgo/);
  });
  it("lists files the list does not name as unused", async () => {
    const p = await loadPack(io({ ...GOOD, "Pack/old.png": PNG }), "Pack");
    expect(p.unused).toEqual(["old.png"]);
    expect(packReport(p).join("\n")).toContain("Unused: old.png");
  });
});

describe("a broken pack falls back and says why", () => {
  it("folder missing", async () => {
    const p = await loadPack(io(GOOD), "Nope");
    expect(p.symbols).toEqual([]);
    expect(p.problems[0]).toContain('folder "Nope" was not found');
  });
  it("list file missing, or without a table", async () => {
    expect((await loadPack(io({ "Pack/test-tee.svg": TEE }), "Pack")).problems[0]).toContain("has no Pack list.md");
    expect((await loadPack(io({ "Pack/Pack list.md": "nothing here" }), "Pack")).problems[0]).toContain("no table with Kind and File");
  });
  it("one bad row does not spoil the others", async () => {
    const files = { ...GOOD, "Pack/Pack list.md": LIST + "\n| Pump | | p | gone.svg | | | | | |\n| Gizmo | | g | test-tee.svg | | | | | |\n| Valve | | v | test-tee.svg | 99,99 | | | | |\n| Valve | | w | test-tee.svg | | | | | wide |" };
    const p = await loadPack(io(files), "Pack");
    expect(p.symbols).toHaveLength(2);
    expect(p.rows.filter(r => r.state === "missing").map(r => r.name)).toEqual(["p"]);
    const text = p.problems.join("\n");
    expect(text).toContain("p (Pack list.md line 5): no file gone.svg in the pack folder. The generic pump symbol is used.");
    expect(text).toContain('Kind "Gizmo" is not one of');
    expect(text).toContain("In 99,99 is outside the picture");
    expect(text).toContain('Size "wide"');
  });
  it("refuses unsafe SVG", () => {
    const bad = (s: string): string | null => svgRefusal(`<svg viewBox="0 0 1 1">${s}</svg>`);
    expect(bad("<script>alert(1)</script>")).toContain("<script>");
    expect(bad("<foreignObject/>")).toContain("foreignObject");
    expect(bad('<rect onclick="x()"/>')).toContain("event attribute");
    expect(bad('<a href="javascript:x()"/>')).toContain("javascript");
    expect(bad('<image href="https://example.org/a.png"/>')).toContain("outside the file");
    expect(bad('<rect style="fill:url(http://x/y)"/>')).toContain("outside the file");
    expect(bad("<animate attributeName='x'/>")).toContain("animate");
    expect(bad('<use href="#a"/><rect fill="url(#g)"/>')).toBeNull();
    expect(svgRefusal("<!DOCTYPE svg [<!ENTITY a 'b'>]><svg viewBox='0 0 1 1'/>")).toContain("DOCTYPE");
    expect(svgRefusal("x".repeat(200_001))).toContain("larger than");
    expect(svgRefusal("hello")).toContain("not an SVG");
  });
  it("an unsafe, oversized or fake file is unreadable, with the reason", async () => {
    const files = { "Pack/Pack list.md": "| Kind | Name | File |\n|---|---|---|\n| Valve | a | a.svg |\n| Pump | b | b.png |\n| Tubing | c | c.png |\n| Heater | d | ../d.svg |\n| Outlet | e | e.svg |",
      "Pack/a.svg": '<svg viewBox="0 0 9 9"><script>1</script></svg>', "Pack/b.png": new Uint8Array(400_000), "Pack/c.png": new Uint8Array(40), "Pack/e.svg": "<svg><rect/></svg>" };
    const p = await loadPack(io(files), "Pack");
    expect(p.symbols).toEqual([]);
    const text = p.problems.join("\n");
    expect(text).toContain("a.svg was refused: has a <script> element");
    expect(text).toContain("b.png is larger than 300 KB");
    expect(text).toContain("c.png is not a PNG");
    expect(text).toContain("the file must be inside the pack folder");
    expect(text).toContain("e.svg has no viewBox or width and height");
  });
});

describe("in the figure", () => {
  it("two pack symbols replace the generic tee and pre-mixer, and the file stands alone", async () => {
    const generic = makeFigure(RIG)!;
    expect(generic.svg).toContain('data-symbol="tee"');
    usePack(await loadPack(io(GOOD), "Pack"));
    const m = makeFigure(RIG)!;
    expect(m.problems).toEqual([]);
    expect(m.svg).toContain('data-symbol="pack-test-tee"');
    expect(m.svg).toContain('data-symbol="pack-test-premixer"');
    expect(m.svg).not.toContain('data-symbol="tee"');
    expect(m.svg).not.toMatch(/inkscape|sodipodi|<script/i);
    expect(m.svg).not.toBe(generic.svg);
    // the pump, reactor and outlet keep the generic symbols
    expect(m.svg).toContain('data-symbol="syringe"');
    expect(m.boxes.find(b => b.id === "M1")).toMatchObject({ w: 80, h: 40 });
  });
  it("a broken pack draws the generic figure and lists why", async () => {
    usePack(await loadPack(io(GOOD), "Nope"));
    const m = makeFigure(RIG)!;
    expect(m.svg).toBe((usePack(null), makeFigure(RIG)!.svg));
    usePack(await loadPack(io(GOOD), "Nope"));
    expect(makeFigure(RIG)!.problems[0]).toContain("was not found");
  });
  it("a snapshot keeps the pack symbol and still reads back, after the pack is gone", async () => {
    usePack(await loadPack(io(GOOD), "Pack"));
    const file = snapshotSvg(makeFigure(RIG)!.svg, { rig: "Rig A", date: "2026-10-21", version: "1", record: rigRecord(RIG) });
    usePack(null);
    expect(file).toContain('data-symbol="pack-test-tee"');
    expect(file.match(/<metadata/g)).toHaveLength(1);
    expect(readSnapshotMeta(file).status).toBe("ok");
  });
});

describe("no pack asset in the repo", () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
  it("has no .svg or .png file under src/ or kits/", () => {
    expect([...walk("src"), ...walk("kits")].filter(p => /\.(svg|png)$/i.test(p))).toEqual([]);
  });
});

describe("label of a pack mixer", () => {
  it("sits under a sized pack symbol, not at the tee's lower right", async () => {
    usePack(await loadPack(io(GOOD), "Pack"));
    const m = makeFigure(RIG)!;
    const box = m.boxes.find(b => b.id === "M1")!;
    const label = new RegExp(`<text x="([\\d.]+)" y="([\\d.]+)"[^>]*text-anchor="middle">M<tspan|<text x="([\\d.]+)" y="([\\d.]+)"[^>]*text-anchor="middle">M`).exec(m.svg);
    expect(label).not.toBeNull();
    expect(Number(label![1] ?? label![3])).toBeCloseTo(box.x, 0);
  });
});
