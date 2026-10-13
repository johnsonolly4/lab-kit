// Rig figure: the SVG text of a laid-out figure (symbols, lines, labels). Pure (no Obsidian runtime).
// Plan: docs/plans/rig-figure.md, Phase 2. Colour and control lines come in Phase 3.
import type { FigEdge, Figure, FigNode } from "./figure";
import { symbolFor, type Point, type RigSymbol } from "./symbols";

export interface FigureSvgOptions { title?: string }
export interface FigureSvg {
  svg: string;
  /** IDs of the parts drawn as a plain box because their kind is unknown. */
  missing: string[];
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

/** The polyline of a process edge: out of the source, a bend in front of the target, into the target. A back edge goes round underneath. */
function edgePoints(e: FigEdge, from: Placed, to: Placed, bottom: number): Point[] {
  const a = at(from, from.sym.out), b = at(to, to.sym.in);
  const bx = b.x - BEND;
  if (e.back) return [a, { x: a.x + BEND, y: a.y }, { x: a.x + BEND, y: bottom }, { x: bx, y: bottom }, { x: bx, y: b.y }, b];
  return [a, { x: bx, y: a.y }, { x: bx, y: b.y }, b];
}

/** The dashed line of a part attached to a host: straight down from the slot above it (the host, or the part attached before it). */
function attachedPoints(above: Placed, part: Placed): Point[] {
  return [at(above, above.sym.bottom), at(part, part.sym.top)];
}

function symbolSvg(p: Placed): string {
  return `<g data-part="${esc(p.node.id)}" transform="translate(${n1(p.node.x)} ${n1(p.node.y)})">${p.sym.body}</g>`;
}

function labelSvg(p: Placed, above: boolean): string {
  const { node, sym } = p;
  const detail = node.detail && node.detail !== node.kind ? cut(node.detail, DETAIL_CHARS) : "";
  if (node.host) {   // an attached part keeps its label to the right, so the dashed line down the middle stays clear
    const x = n1(node.x + sym.w / 2 + 10);
    return `<text x="${x}" y="${n1(node.y + (detail ? 0 : 5))}" font-size="16" font-weight="700">${idText(node.id)}</text>`
      + (detail ? `<text x="${x}" y="${n1(node.y + 17)}" font-size="13">${esc(detail)}</text>` : "");
  }
  const id = n1(above ? node.y - sym.h / 2 - (detail ? 26 : 10) : node.y + sym.h / 2 + 20);
  const dy = n1(above ? node.y - sym.h / 2 - 9 : node.y + sym.h / 2 + 37);
  return `<text x="${n1(node.x)}" y="${id}" font-size="16" font-weight="700" text-anchor="middle">${idText(node.id)}</text>`
    + (detail ? `<text x="${n1(node.x)}" y="${dy}" font-size="13" text-anchor="middle">${esc(detail)}</text>` : "");
}

/** The SVG of a figure: black line art on white, one symbol and label per part, lines ending on the symbols' connection points. */
export function figureSvg(fig: Figure, opts: FigureSvgOptions = {}): FigureSvg {
  const placed = new Map<string, Placed>(fig.nodes.map(node => [node.id, { node, sym: symbolFor(node.kind, node.detail) }]));
  const missing = fig.nodes.filter(n => !n.kind).map(n => n.id);
  const hosts = new Set(fig.nodes.map(n => n.host).filter(Boolean));
  const bottom = fig.height - 14;

  const lines: string[] = [], dots: string[] = [];
  const merges = new Map<string, number>();
  for (const e of fig.edges) {
    const from = placed.get(e.from), to = placed.get(e.to);
    if (!from || !to) continue;
    const onHost = e.attached && from.node.host === e.to;
    const dashed = e.attached || e.back;
    const above = onHost ? fig.nodes.find(n => n.layer === from.node.layer && n.row === from.node.row - 1) : undefined;
    const pts = onHost && above ? attachedPoints(placed.get(above.id)!, from) : edgePoints(e, from, to, bottom);
    const attr = onHost && above ? `data-attached="${esc(e.from)}" data-host="${esc(e.to)}"` : `data-from="${esc(e.from)}" data-to="${esc(e.to)}"${e.back ? ' data-back="1"' : ""}`;
    lines.push(`<path ${attr} d="M ${pts.map(pt).join(" L ")}"${dashed ? ' stroke-dasharray="7 5"' : ""}/>`);
    if (!onHost && !e.attached && !e.back) merges.set(e.to, (merges.get(e.to) ?? 0) + 1);
  }
  // Where two or more streams run into one part, a small filled dot marks the join (a tee symbol is its own dot).
  for (const [id, count] of merges) {
    const to = placed.get(id)!;
    if (count < 2 || to.node.kind === "Mixer") continue;
    const b = at(to, to.sym.in);
    dots.push(`<circle cx="${n1(b.x - BEND)}" cy="${n1(b.y)}" r="5" fill="${INK}" stroke="none"/>`);
  }

  const parts = fig.nodes.map(node => placed.get(node.id)!);
  const title = opts.title ? `<text x="20" y="28" font-size="20" font-weight="700">${esc(opts.title)}</text>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fig.width} ${fig.height}" width="${fig.width}" height="${fig.height}" font-family="${FONT}" fill="${INK}">`
    + `<style>.fill{fill:${INK}}</style>`
    + `<rect width="${fig.width}" height="${fig.height}" fill="#ffffff"/>${title}`
    + `<g fill="#ffffff" stroke="${INK}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">`
    + `<g fill="none">${lines.join("")}</g>${dots.join("")}${parts.map(symbolSvg).join("")}</g>`
    + `<g stroke="none">${parts.map(p => labelSvg(p, hosts.has(p.node.id))).join("")}</g></svg>`;
  return { svg, missing };
}
