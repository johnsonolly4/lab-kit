// Rig figure: the SVG text of a laid-out figure (symbols, lines, labels). Pure (no Obsidian runtime).
// Plan: docs/plans/rig-figure.md, Phase 2. Colour and control lines come in Phase 3.
import { COL_W, LANE, MARGIN, ROW_H, type FigEdge, type Figure, type FigNode } from "./figure";
import { COMPUTER, ovenAround, symbolFor, type Point, type RigSymbol } from "./symbols";

export interface FigureSvgOptions {
  title?: string;
  /** Colour of the lines the computer sends to the parts, and of the lines that bring data back. */
  controlColor?: string; dataColor?: string;
  /** Grid dots this many units apart over the white ground: only in the Figure… window while a part is dragged, never in a saved file. */
  grid?: number;
}
/** A part's symbol as drawn (centre and size, figure units); `host` is the part an attached one sits with. The Figure… window drags these. */
export interface PartBox { id: string; host: string; x: number; y: number; w: number; h: number }
export interface FigureSvg {
  svg: string;
  /** IDs of the parts drawn as a plain box because their kind is unknown. */
  missing: string[];
  /** The size of the drawing (its viewBox). */
  width: number; height: number;
  boxes: PartBox[];
}

const INK = "#000000";
const FONT = "Helvetica, Arial, sans-serif";
const DETAIL_CHARS = 20;   // text is never measured: the detail line is cut by character count (about 150 px at 13 px)
const BEND = 30;       // how far in front of the target's input the lines bend

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const n1 = (n: number): number => Math.round(n * 10) / 10;
const pt = (p: Point): string => `${n1(p.x)} ${n1(p.y)}`;
const cut = (s: string, n: number): string => (s.length <= n ? s : s.slice(0, Math.max(1, n - 1)).trimEnd() + "…");

/** An ID with its trailing digits as a subscript: "P1" → P, then a small lowered 1. */
function idText(id: string): string {
  const m = /^(.*[^\d\s])(\d+)$/.exec(id);
  return m ? `${esc(m[1])}<tspan dy="4" font-size="70%">${esc(m[2])}</tspan>` : esc(id);
}

interface Placed { node: FigNode; sym: RigSymbol }
const at = (p: Placed, rel: Point): Point => ({ x: p.node.x + rel.x, y: p.node.y + rel.y });

/** Drops repeated points and points in the middle of a straight run, so a level chain is one straight line. */
function tidy(pts: Point[]): Point[] {
  const flat = pts.filter((p, i) => i === 0 || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y);
  return flat.filter((p, i) => i === 0 || i === flat.length - 1 || !((flat[i - 1].x === p.x && p.x === flat[i + 1].x) || (flat[i - 1].y === p.y && p.y === flat[i + 1].y)));
}

/** The polyline of a process edge: out of the source, a bend in front of the target, into the target. A tee is met at its centre; a vial is entered from above (level, then straight down); a back edge goes round underneath. */
function edgePoints(e: FigEdge, from: Placed, to: Placed, bottom: number): Point[] {
  const a = at(from, from.sym.out), b = at(to, to.sym.in);
  let pts: Point[];
  if (e.back) {   // leaves the source's underside (so it visibly joins the source) and rejoins the target's last stretch, clear of the lines that feed it
    const s = at(from, from.sym.bottom);
    pts = [s, { x: s.x, y: bottom }, { x: b.x - BEND / 2, y: bottom }, { x: b.x - BEND / 2, y: b.y }, b];
  } else if (to.sym.enter === "top" && a.y < b.y) pts = [a, { x: b.x, y: a.y }, b];
  else if (to.node.kind === "Mixer") pts = [a, { x: b.x, y: a.y }, b];
  else pts = [a, { x: b.x - BEND, y: a.y }, { x: b.x - BEND, y: b.y }, b];
  return tidy(pts);
}

/** `<g id="sym-<name>-<n>" data-symbol="<name>">`: which symbols.ts entry a mark is, numbered per name in drawing order, so feedback on a picture maps back to the table. */
const symAttr = (name: string, n: number): string => `id="sym-${esc(name)}-${n}" data-symbol="${esc(name)}"`;

function symbolSvg(p: Placed, n: number): string {
  return `<g ${symAttr(p.sym.name, n)} data-part="${esc(p.node.id)}" transform="translate(${n1(p.node.x)} ${n1(p.node.y)})">${p.sym.body}</g>`;
}

function labelSvg(p: Placed, above: boolean, half = p.sym.h / 2, returns = false): string {
  const { node, sym } = p;
  const detail = node.detail && node.detail !== node.kind ? cut(node.detail, DETAIL_CHARS) : "";
  if (node.host && sym.name !== "oven") {   // an attached part keeps its label to the right, so the dashed line down the middle stays clear
    const x = n1(node.x + sym.w / 2 + 10);
    return `<text x="${x}" y="${n1(node.y + (detail ? 0 : 5))}" font-size="16" font-weight="700">${idText(node.id)}</text>`
      + (detail ? `<text x="${x}" y="${n1(node.y + 17)}" font-size="13">${esc(detail)}</text>` : "");
  }
  if (node.kind === "Mixer" || returns) {   // streams run into a tee from above and below, and a return line leaves a part's underside, so the label sits to the lower right
    const x = n1(node.x + 12);
    return `<text x="${x}" y="${n1(node.y + 24)}" font-size="16" font-weight="700">${idText(node.id)}</text>`
      + (detail ? `<text x="${x}" y="${n1(node.y + 41)}" font-size="13">${esc(detail)}</text>` : "");
  }
  const id = n1(above ? node.y - half - (detail ? 26 : 10) : node.y + sym.bottom.y + 20);
  const dy = n1(above ? node.y - half - 9 : node.y + sym.bottom.y + 37);
  return `<text x="${n1(node.x)}" y="${id}" font-size="16" font-weight="700" text-anchor="middle">${idText(node.id)}</text>`
    + (detail ? `<text x="${n1(node.x)}" y="${dy}" font-size="13" text-anchor="middle">${esc(detail)}</text>` : "");
}

const CONTROL_COLOR = "#1f4fd8", DATA_COLOR = "#d62728";

/** A filled arrowhead whose tip is `tip`, pointing along the last segment of the line. */
function arrowhead(pts: Point[], colour: string): string {
  const a = pts[pts.length - 2], b = pts[pts.length - 1];
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
  const base = { x: b.x - ux * 11, y: b.y - uy * 11 };
  return `<polygon points="${pt(b)} ${pt({ x: base.x - uy * 5, y: base.y + ux * 5 })} ${pt({ x: base.x + uy * 5, y: base.y - ux * 5 })}" fill="${colour}" stroke="none"/>`;
}

/**
 * The dashed coloured lines between the computer and the parts. Lines that go the same way share one run: the control lines leave the computer on one
 * trunk and run along one bus under it, the data lines likewise on a second, and each line drops from its bus to the top of its part.
 */
function controlSvg(fig: Figure, placed: Map<string, Placed>, colours: { control: string; data: string }): string {
  const comp = fig.computer;
  if (!comp || !fig.controls.length) return "";
  const both = new Set(fig.controls.filter(c => c.dir === "data").map(c => c.part).filter(id => fig.controls.some(c => c.part === id && c.dir === "control")));
  // A part with another part above it in its column cannot be reached from above: its line comes down left of the column and enters from the side.
  const lines = fig.controls.flatMap(c => {
    const p = placed.get(c.part);
    if (!p) return [];
    const shift = both.has(c.part) ? (c.dir === "control" ? -10 : 10) : 0;
    // a column = the parts drawn within half a column of it (the automatic layout's own columns; a part moved by hand joins the one it is in)
    const near = (m: FigNode): boolean => Math.abs(m.x - p.node.x) < COL_W / 2;
    const column = fig.nodes.filter(m => near(m) && !m.host);
    const blocked = fig.nodes.some(m => m !== p.node && near(m) && m.y < p.node.y);
    if (!blocked) return [{ c, tx: p.node.x + shift, ty: p.node.y + p.sym.top.y, side: false, endX: 0, sideY: 0 }];
    const left = Math.min(...column.map(m => m.x - placed.get(m.id)!.sym.w / 2));
    return [{ c, tx: left - 24 - (c.dir === "data" ? 8 : 0), ty: p.node.y, side: true, endX: p.node.x - p.sym.w / 2, sideY: p.node.y + (shift || -12) }];
  }).sort((a, b) => a.tx - b.tx);
  const bottom = comp.y + COMPUTER.h / 2;
  const dirs = (["control", "data"] as const).filter(d => lines.some(l => l.c.dir === d));
  const laneOf = (d: "control" | "data"): number => bottom + 16 + dirs.indexOf(d) * LANE;
  const trunkOf = (d: "control" | "data"): number => comp.x + (dirs.length > 1 ? (d === "control" ? -8 : 8) : 0);
  const out: string[] = [];
  lines.forEach(l => {
    const lane = laneOf(l.c.dir), trunk = trunkOf(l.c.dir);
    const toPart = tidy(l.side
      ? [{ x: trunk, y: bottom }, { x: trunk, y: lane }, { x: l.tx, y: lane }, { x: l.tx, y: l.sideY }, { x: l.endX, y: l.sideY }]
      : [{ x: trunk, y: bottom }, { x: trunk, y: lane }, { x: l.tx, y: lane }, { x: l.tx, y: l.ty }]);
    const colour = l.c.dir === "control" ? colours.control : colours.data;
    const pts = l.c.dir === "control" ? toPart : [...toPart].reverse();
    // The lines of one direction share their first stretch, so the dashes must line up there: a data line is written from the part to the computer, so its dash pattern is shifted to read the same from the computer's end.
    const len = toPart.reduce((sum, q, k) => sum + (k ? Math.hypot(q.x - toPart[k - 1].x, q.y - toPart[k - 1].y) : 0), 0);
    const offset = l.c.dir === "data" ? ` stroke-dashoffset="${n1(((7 - len) % 12 + 12) % 12)}"` : "";
    out.push(`<path data-${l.c.dir}="${esc(l.c.part)}" d="M ${pts.map(pt).join(" L ")}" stroke="${colour}" stroke-dasharray="7 5"${offset} fill="none"/>`
      + arrowhead(pts, colour)
      + `<text x="${n1(l.tx + (l.side || l.c.dir === "control" ? -8 : 8))}" y="${n1(l.side ? l.sideY - 6 : l.ty - 10)}" font-size="13" font-weight="700" fill="${colour}" stroke="none" text-anchor="${l.side || l.c.dir === "control" ? "end" : "start"}">${esc(l.c.label)}</text>`);
  });
  return out.join("");
}

function computerSvg(fig: Figure): string {
  const c = fig.computer;
  if (!c) return "";
  return `<g ${symAttr(COMPUTER.name, 1)} data-computer="1" transform="translate(${n1(c.x)} ${n1(c.y)})">${COMPUTER.body}</g>`
    + `<text x="${n1(c.x + COMPUTER.w / 2 + 10)}" y="${n1(c.y + 5)}" font-size="16" font-weight="700" fill="${INK}" stroke="none">${esc(c.label)}</text>`;
}

/**
 * The frame's height: the layout keeps a whole row under a part for each part attached to it, but draws a plate or stirrer touching it (owner, 2026-10-21:
 * trim that band). So the frame ends a margin under the lowest part in the flow (its row, as before) or the lowest attached part as drawn, whichever is lower.
 * A figure with a return line keeps its height: the return runs along the bottom.
 */
function fitHeight(fig: Figure, placed: Map<string, Placed>, ovens: Map<string, number>): number {
  if (!fig.nodes.some(n => n.host) || fig.edges.some(e => e.back)) return fig.height;
  const low = fig.nodes.map(n => {
    const { node, sym } = placed.get(n.id)!;
    if (!n.host) return Math.max(node.y + ROW_H / 2, node.y + sym.bottom.y + 41);   // its row, or deeper when the symbol hangs low (a vial) with its label under it
    if (sym.name === "oven" && ovens.has(n.host)) return node.y + sym.bottom.y + 41;   // label under the oven
    return Math.max(node.y + sym.h / 2, node.y + 21);   // label to the right: ID, then the detail line
  });
  return Math.min(fig.height, Math.ceil(Math.max(...low) + MARGIN));
}

const gridSvg = (g: number | undefined, w: number, h: number): string => !g ? ""
  : `<defs><pattern id="lk-grid" width="${g}" height="${g}" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r="1.6" fill="#a8a8b3"/></pattern></defs><rect width="${w}" height="${h}" fill="url(#lk-grid)"/>`;

/** The SVG of a figure: black line art on white, one symbol and label per part, lines ending on the symbols' connection points. */
export function figureSvg(fig: Figure, opts: FigureSvgOptions = {}): FigureSvg {
  const placed = new Map<string, Placed>(fig.nodes.map(node => [node.id, { node, sym: symbolFor(node.kind, node.detail) }]));
  const missing = fig.nodes.filter(n => !n.kind).map(n => n.id);
  const returnFrom = new Set(fig.edges.filter(e => e.back).map(e => e.from));
  const hosts = new Set(fig.nodes.map(n => n.host).filter(Boolean));
  const bottom = fig.height - 14;
  // An attached part is drawn touching its host: a plate directly under it (or under the part attached before it), an oven or jacket around it.
  const ovens = new Map<string, number>();   // host ID -> half the height of the oven around it
  for (const n of fig.nodes) {
    if (!n.host) continue;
    const p = placed.get(n.id)!, h = placed.get(n.host);
    if (p.sym.name === "oven" && h) {
      p.sym = ovenAround(h.sym);
      p.node = { ...n, x: h.node.x, y: h.node.y };
      ovens.set(n.host, p.sym.h / 2);
      continue;
    }
    const above = fig.nodes.find(m => m.layer === n.layer && m.row === n.row - 1);
    const a = above && placed.get(above.id);
    if (a) p.node = { ...n, y: a.node.y + a.sym.bottom.y - p.sym.top.y };
  }

  const height = fitHeight(fig, placed, ovens);

  const lines: string[] = [], dots: string[] = [];
  const merges = new Map<string, number>();
  for (const e of fig.edges) {
    const from = placed.get(e.from), to = placed.get(e.to);
    if (!from || !to) continue;
    const onHost = e.attached && from.node.host === e.to;
    const dashed = e.attached || e.back;
    if (onHost && fig.nodes.some(n => n.layer === from.node.layer && n.row === from.node.row - 1)) continue;   // touching its host: no line to draw
    const pts = edgePoints(e, from, to, bottom);
    const attr = `data-from="${esc(e.from)}" data-to="${esc(e.to)}"${e.back ? ' data-back="1"' : ""}`;
    lines.push(`<path ${attr} d="M ${pts.map(pt).join(" L ")}"${dashed ? ' stroke-dasharray="7 5"' : ""}/>`);
    if (!e.attached && !e.back) merges.set(e.to, (merges.get(e.to) ?? 0) + 1);
  }
  // Where two or more streams run into one part, a small filled dot marks the join (a tee symbol is its own dot).
  for (const [id, count] of merges) {
    const to = placed.get(id)!;
    if (count < 2 || to.node.kind === "Mixer") continue;
    const b = at(to, to.sym.in);
    dots.push(`<circle cx="${n1(b.x - BEND)}" cy="${n1(b.y)}" r="5" fill="${INK}" stroke="none"/>`);
  }

  const parts = fig.nodes.map(node => placed.get(node.id)!);
  const seen = new Map<string, number>();
  const drawn = parts.map(p => { const n = (seen.get(p.sym.name) ?? 0) + 1; seen.set(p.sym.name, n); return { p, svg: symbolSvg(p, n) }; });
  const isOven = (d: { p: Placed }): boolean => d.p.sym.name === "oven" && ovens.has(d.p.node.host);
  const title = opts.title ? `<text x="20" y="28" font-size="20" font-weight="700">${esc(opts.title)}</text>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fig.width} ${height}" width="${fig.width}" height="${height}" font-family="${FONT}" fill="${INK}">`
    + `<rect width="${fig.width}" height="${height}" fill="#ffffff"/>${gridSvg(opts.grid, fig.width, height)}${title}`
    + `<g fill="#ffffff" stroke="${INK}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">`
    + `${drawn.filter(isOven).map(d => d.svg).join("")}<g fill="none">${lines.join("")}</g>${dots.join("")}${drawn.filter(d => !isOven(d)).map(d => d.svg).join("")}${computerSvg(fig)}${controlSvg(fig, placed, { control: opts.controlColor ?? CONTROL_COLOR, data: opts.dataColor ?? DATA_COLOR })}</g>`
    + `<g stroke="none">${parts.map(p => labelSvg(p, hosts.has(p.node.id), ovens.get(p.node.id), returnFrom.has(p.node.id))).join("")}</g></svg>`;
  const boxes = parts.map(p => ({ id: p.node.id, host: p.node.host, x: p.node.x, y: p.node.y, w: p.sym.w, h: p.sym.h }));
  return { svg, missing, width: fig.width, height, boxes };
}
