// Rig figure: module packs. A pack is a vault folder of SVG / PNG symbol files plus a `Pack list.md` table; a symbol in it replaces the generic one for its part kind.
// Pure (no Obsidian runtime): the files come through a `PackIo`. Plan: docs/plans/rig-figure.md, Phase 6.
// Nothing here is ever fatal: a row that cannot be used falls back to the generic symbol and says why.
import { isSeparator, splitRow } from "../calc/engine";
import { PART_KINDS, partKind, type PartKind } from "./parts";
import type { Point, RigSymbol } from "./symbols";

export const PACK_LIST_FILE = "Pack list.md";
export const SVG_MAX = 200_000;
export const PNG_MAX = 300_000;
/** The longer side of a symbol with no `Size`, in figure units. */
export const DEFAULT_LONG_SIDE = 72;

/** How the loader reads the vault. `list` gives every file under the folder (paths relative to it), null when the folder does not exist. */
export interface PackIo {
  list(folder: string): Promise<string[] | null>;
  text(path: string): Promise<string | null>;
  binary(path: string): Promise<ArrayBuffer | null>;
}

/** One row of the list file and what became of it. `ok` = usable; the others say why not in `why`. */
export interface PackRow { name: string; kind: PartKind | ""; file: string; state: "ok" | "missing" | "unreadable"; why: string }
export interface PackSymbol { kind: PartKind; match: string; sym: RigSymbol; file: string }
export interface Pack {
  folder: string;
  symbols: PackSymbol[];
  rows: PackRow[];
  /** Files in the folder that no list row names (the list file itself excluded). */
  unused: string[];
  /** One line each: what the generic symbols replace, and why. Empty when the pack loaded cleanly. */
  problems: string[];
}

/** The figure's symbol for a part from the pack, or null (use the generic one). A row with a `Match` that the detail contains wins over a row without. */
export function packSymbol(pack: Pack | null | undefined, kind: PartKind | "", detail: string): RigSymbol | null {
  if (!pack || !kind) return null;
  const d = detail.toLowerCase();
  const mine = pack.symbols.filter(s => s.kind === kind);
  return (mine.find(s => s.match && d.includes(s.match.toLowerCase())) ?? mine.find(s => !s.match))?.sym ?? null;
}

// ---------- the pictures ----------

export function base64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Why an SVG text may not be drawn into a figure (null when it may). Scripts cannot run in an <img>, but a saved figure or snapshot opened in a browser is a page. */
export function svgRefusal(src: string): string | null {
  if (src.length > SVG_MAX) return `larger than ${SVG_MAX / 1000} KB`;
  if (!/<svg[\s>]/i.test(src)) return "not an SVG file";
  if (/<!DOCTYPE|<!ENTITY/i.test(src)) return "has a DOCTYPE or entity";
  const tag = /<\s*(script|foreignObject|iframe|object|embed|audio|video|animate\w*|set)\b/i.exec(src);
  if (tag) return `has a <${tag[1]}> element`;
  if (/\son\w+\s*=/i.test(src)) return "has an event attribute (onclick, onload…)";
  if (/javascript:/i.test(src)) return "has a javascript: link";
  if (/@import/i.test(src)) return "has an @import";
  for (const m of src.matchAll(/\bhref\s*=\s*["']([^"']*)["']/gi)) if (!/^(#|data:image\/(png|jpeg|gif|webp);base64,)/i.test(m[1].trim())) return "links to something outside the file";
  for (const m of src.matchAll(/url\(\s*["']?([^)"']*)/gi)) if (!/^(#|data:image\/(png|jpeg|gif|webp);base64,)/i.test(m[1].trim())) return "has a url() to something outside the file";
  return null;
}

/** The size of an SVG in its own units, and its drawing (the text inside the root element, editor leftovers removed). null when it has neither a viewBox nor a width and height. */
export function svgParts(src: string): { x: number; y: number; w: number; h: number; inner: string } | null {
  const root = /<svg\b[^>]*>/i.exec(src);
  if (!root) return null;
  const attr = (n: string): string => new RegExp(`\\s${n}\\s*=\\s*["']([^"']*)["']`, "i").exec(root[0])?.[1] ?? "";
  let x = 0, y = 0, w = NaN, h = NaN;
  const vb = attr("viewBox").trim().split(/[\s,]+/).map(Number);
  if (vb.length === 4 && vb.every(Number.isFinite)) [x, y, w, h] = vb;
  else { w = parseFloat(attr("width")); h = parseFloat(attr("height")); }
  if (!(w > 0) || !(h > 0)) return null;
  const end = src.lastIndexOf("</svg");
  let inner = src.slice(root.index + root[0].length, end < 0 ? undefined : end);
  inner = inner
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(metadata|title|desc)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(metadata|title|desc)\b[^>]*\/>/gi, "")
    .replace(/<([A-Za-z][\w-]*):([\w-]+)\b[^>]*?(?:\/>|>[\s\S]*?<\/\1:\2\s*>)/g, "")   // inkscape: / sodipodi: / rdf: elements
    .replace(/\sxlink:href=/g, " href=")
    .replace(/\s(?!xml:)[A-Za-z][\w-]*:[\w-]+\s*=\s*("[^"]*"|'[^']*')/g, "")   // inkscape:label="…" and the like: the prefix is not declared in the figure
    .trim();
  return { x, y, w, h, inner };
}

/** Width and height of a PNG from its header; null when the bytes are not a PNG. */
export function pngSize(b: Uint8Array): { w: number; h: number } | null {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length < 24 || sig.some((v, i) => b[i] !== v)) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const w = dv.getUint32(16), h = dv.getUint32(20);
  return w > 0 && h > 0 ? { w, h } : null;
}

// ---------- the list file ----------

/** "12,30" → a point; null when it is not two numbers. */
function point(s: string): Point | null {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(s);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
}

/** "60" → 60 wide, height from the picture; "60x40" → both; null when neither. */
function size(s: string): { w: number; h?: number } | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(?:[x×]\s*(\d+(?:\.\d+)?))?\s*$/i.exec(s);
  return m && Number(m[1]) > 0 && (!m[2] || Number(m[2]) > 0) ? { w: Number(m[1]), ...(m[2] ? { h: Number(m[2]) } : {}) } : null;
}

interface Row { line: number; cells: Record<string, string> }

/** The rows of the first table in the list file that has `Kind` and `File` columns. null when there is none. */
export function listRows(text: string): Row[] | null {
  const lines = text.replace(/^---\n[\s\S]*?\n---\n/, "").split(/\r?\n/);
  for (let i = 0; i + 1 < lines.length; i++) {
    if (!lines[i].includes("|") || !isSeparator(lines[i + 1])) continue;
    const head = splitRow(lines[i]).map(c => c.trim().toLowerCase());
    if (!head.includes("kind") || !head.includes("file")) continue;
    const rows: Row[] = [];
    for (let j = i + 2; j < lines.length && lines[j].includes("|"); j++) {
      const cells: Record<string, string> = {};
      splitRow(lines[j]).forEach((c, k) => { if (head[k]) cells[head[k]] = c.trim(); });
      if (Object.values(cells).some(Boolean)) rows.push({ line: j + 1, cells });
    }
    return rows;
  }
  return null;
}

const inside = (p: string): boolean => !!p && !p.startsWith("/") && !/(^|\/)\.\.(\/|$)/.test(p) && !/^[A-Za-z]:/.test(p);
const join = (folder: string, file: string): string => `${folder.replace(/\/+$/, "")}/${file}`;

/** Draws one list row into a symbol, or says why not. */
async function build(io: PackIo, folder: string, files: Set<string>, name: string, kind: PartKind, cells: Record<string, string>): Promise<{ sym: RigSymbol } | { state: "missing" | "unreadable"; why: string }> {
  const file = cells.file.replace(/^\.\//, "");
  if (!inside(file)) return { state: "unreadable", why: "the file must be inside the pack folder" };
  if (!files.has(file)) return { state: "missing", why: `no file ${file} in the pack folder` };
  const ext = file.slice(file.lastIndexOf(".") + 1).toLowerCase();
  let pic: { x: number; y: number; w: number; h: number };
  let draw: (sx: number, sy: number, cx: number, cy: number, w: number, h: number) => string;
  if (ext === "svg") {
    const src = await io.text(join(folder, file));
    if (src === null) return { state: "unreadable", why: `${file} could not be read` };
    const refusal = svgRefusal(src);
    if (refusal) return { state: "unreadable", why: `${file} was refused: ${refusal}` };
    const parts = svgParts(src);
    if (!parts) return { state: "unreadable", why: `${file} has no viewBox or width and height` };
    pic = parts;
    draw = (sx, sy, cx, cy) => `<g transform="scale(${sx} ${sy}) translate(${-cx} ${-cy})" stroke-width="${Math.round(25 / ((sx + sy) / 2)) / 10}">${parts.inner}</g>`;
  } else if (ext === "png") {
    const bin = await io.binary(join(folder, file));
    if (!bin) return { state: "unreadable", why: `${file} could not be read` };
    const bytes = new Uint8Array(bin);
    if (bytes.length > PNG_MAX) return { state: "unreadable", why: `${file} is larger than ${PNG_MAX / 1000} KB` };
    const dim = pngSize(bytes);
    if (!dim) return { state: "unreadable", why: `${file} is not a PNG` };
    pic = { x: 0, y: 0, ...dim };
    const uri = `data:image/png;base64,${base64(bytes)}`;
    draw = (_sx, _sy, _cx, _cy, w, h) => `<image href="${uri}" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" stroke="none"/>`;
  } else return { state: "unreadable", why: `${file} is not an .svg or .png file` };

  let w: number, h: number;
  if (cells.size) {
    const s = size(cells.size);
    if (!s) return { state: "unreadable", why: `Size "${cells.size}" is not a width (60) or width x height (60x40)` };
    w = s.w; h = s.h ?? s.w * pic.h / pic.w;
  } else {
    const k = DEFAULT_LONG_SIDE / Math.max(pic.w, pic.h);
    w = pic.w * k; h = pic.h * k;
  }
  w = Math.round(w * 10) / 10; h = Math.round(h * 10) / 10;
  const sx = w / pic.w, sy = h / pic.h;
  const cx = pic.x + pic.w / 2, cy = pic.y + pic.h / 2;
  const at = (col: "in" | "out" | "top" | "bottom", fallback: Point): Point | string => {
    if (!cells[col]) return fallback;
    const p = point(cells[col]);
    if (!p) return `${col[0].toUpperCase()}${col.slice(1)} "${cells[col]}" is not two numbers like 0,50`;
    if (p.x < pic.x - 0.5 || p.y < pic.y - 0.5 || p.x > pic.x + pic.w + 0.5 || p.y > pic.y + pic.h + 0.5) return `${col[0].toUpperCase()}${col.slice(1)} ${cells[col]} is outside the picture (${pic.w} x ${pic.h})`;
    return { x: Math.round((p.x - cx) * sx * 10) / 10, y: Math.round((p.y - cy) * sy * 10) / 10 };
  };
  const pts = { in: at("in", { x: -w / 2, y: 0 }), out: at("out", { x: w / 2, y: 0 }), top: at("top", { x: 0, y: -h / 2 }), bottom: at("bottom", { x: 0, y: h / 2 }) };
  for (const v of Object.values(pts)) if (typeof v === "string") return { state: "unreadable", why: v };
  const enter = cells.enter?.toLowerCase() === "top" ? "top" as const : undefined;
  if (cells.enter && !enter) return { state: "unreadable", why: `Enter "${cells.enter}" can only be "top" or empty` };
  return { sym: { name: `pack-${name}`, w, h, body: draw(sx, sy, cx, cy, w, h), in: pts.in as Point, out: pts.out as Point, top: pts.top as Point, bottom: pts.bottom as Point, ...(enter ? { enter } : {}) } };
}

/** Reads a pack folder. Never throws for a bad pack: the problems come back in `problems` and the rows that failed are left out. */
export async function loadPack(io: PackIo, folder: string): Promise<Pack> {
  const pack: Pack = { folder, symbols: [], rows: [], unused: [], problems: [] };
  const listed = await io.list(folder).catch(() => null);
  if (!listed) { pack.problems.push(`Module pack: the folder "${folder}" was not found, so the generic symbols are used.`); return pack; }
  const files = new Set(listed);
  const text = files.has(PACK_LIST_FILE) ? await io.text(join(folder, PACK_LIST_FILE)).catch(() => null) : null;
  if (text === null) { pack.problems.push(`Module pack: "${folder}" has no ${PACK_LIST_FILE} (or it cannot be read), so the generic symbols are used.`); pack.unused = [...files].sort(); return pack; }
  const rows = listRows(text);
  if (!rows) { pack.problems.push(`Module pack: ${PACK_LIST_FILE} has no table with Kind and File columns, so the generic symbols are used.`); pack.unused = [...files].filter(f => f !== PACK_LIST_FILE).sort(); return pack; }
  const named = new Set<string>();
  for (const { line, cells } of rows) {
    const name = cells.name || cells.file || `row ${line}`;
    const kind = partKind(cells.kind ?? "");
    const file = (cells.file ?? "").replace(/^\.\//, "");
    if (file) named.add(file);
    const bad = (state: PackRow["state"], why: string): void => {
      pack.rows.push({ name, kind, file, state, why });
      pack.problems.push(`Module pack: ${name} (${PACK_LIST_FILE} line ${line}): ${why}.${kind ? ` The generic ${kind.toLowerCase()} symbol is used.` : ""}`);
    };
    if (!kind) { bad("unreadable", `Kind "${cells.kind ?? ""}" is not one of ${PART_KINDS.join(", ")}`); continue; }
    if (!file) { bad("missing", "the File cell is empty"); continue; }
    const r = await build(io, folder, files, name, kind, { ...cells, file }).catch((e: unknown) => ({ state: "unreadable" as const, why: `${file} could not be used (${e instanceof Error ? e.message : String(e)})` }));
    if ("sym" in r) { pack.symbols.push({ kind, match: cells.match ?? "", sym: r.sym, file }); pack.rows.push({ name, kind, file, state: "ok", why: "" }); }
    else bad(r.state, r.why);
  }
  pack.unused = [...files].filter(f => f !== PACK_LIST_FILE && !named.has(f)).sort();
  return pack;
}

/** The answer of "Check module pack": one line per row and per unused file. */
export function packReport(pack: Pack): string[] {
  const out: string[] = [];
  const ok = pack.rows.filter(r => r.state === "ok").length;
  if (!pack.rows.length) return [...pack.problems.length ? pack.problems : [`Module pack: ${PACK_LIST_FILE} has no rows.`]];
  out.push(`${ok} of ${pack.rows.length} symbols are usable.`);
  for (const r of pack.rows) out.push(r.state === "ok" ? `OK: ${r.name} (${r.kind}, ${r.file})` : `${r.state === "missing" ? "Missing" : "Unreadable"}: ${r.name}: ${r.why}`);
  for (const f of pack.unused) out.push(`Unused: ${f} (not in ${PACK_LIST_FILE})`);
  return out;
}
