// The ```rig-layout block of a rig note: where parts were placed by hand, as plain lines ("format: 1", then "ID: x, y" in figure units). Pure (no Obsidian runtime).
// Lines Lab Kit did not write are kept: a note line, a line it cannot read, a line naming a part that is gone (listed as a problem, never dropped).
// Plan: docs/plans/rig-block-no-mermaid.md, Phase 6. Format version 1; a reader for every older version stays (tests/fixtures/rigs/saved/).
import type { PartBox } from "./figure-svg";

export const LAYOUT_FORMAT = 1;
/** The snap grid in figure units (owner, 2026-10-21: 20). Columns are 200 apart, rows 120. */
export const GRID = 20;
export const snap = (v: number): number => Math.round(v / GRID) * GRID;

export interface Pos { x: number; y: number }
export type Places = Map<string, Pos>;

const FENCE_OPEN = /^```rig-layout\b/;
const FENCE_CLOSE = /^```\s*$/;
const RIG_OPEN = /^```rig\s*$/;
const POS = /^\s*([^:]*?\S)\s*:\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;
const FORMAT = /^\s*format:\s*(\d+)\s*$/;
const NOTE = /^\s*([%#].*)?$/;   // blank, or a note the user typed

const bare = (l: string): string => l.replace(/\r$/, "");

/** The first ```rig-layout block of a note: its lines (each with any "\r" it had) between the fences, and where they are. Null when there is none. */
export function findLayout(text: string): { body: string; open: number; close: number } | null {
  const lines = text.split("\n");
  const open = lines.findIndex(l => FENCE_OPEN.test(bare(l)));
  if (open < 0) return null;
  const close = lines.findIndex((l, i) => i > open && FENCE_CLOSE.test(bare(l)));
  if (close < 0) return null;
  return { body: lines.slice(open + 1, close).join("\n"), open, close };
}

export interface Layout {
  /** "newer" = a format this Lab Kit does not know: shown, never used or edited. */
  status: "ok" | "newer";
  /** The places of the parts the block names, under the part's own ID. */
  fixed: Places;
  problems: string[];
}

/** The part a layout ID names (IDs match like the parts tables do, ignoring case), or "". */
const partOf = (id: string, ids: string[]): string => ids.find(p => p.toLowerCase() === id.toLowerCase()) ?? "";

/** Reads a block's lines against the rig's part IDs. */
export function readLayout(body: string, ids: string[]): Layout {
  const lines = body.split("\n").map(bare);
  const first = lines.find(l => l.trim());
  const f = first !== undefined ? FORMAT.exec(first) : null;
  if (f && Number(f[1]) > LAYOUT_FORMAT) {
    return { status: "newer", fixed: new Map(), problems: [`The rig-layout block was made with a newer Lab Kit (format ${f[1]}): update the plugin. The figure is drawn automatically.`] };
  }
  const fixed: Places = new Map(), problems: string[] = [];
  for (const l of lines) {
    if (FORMAT.test(l) || NOTE.test(l)) continue;
    const m = POS.exec(l);
    if (!m) { problems.push(`Layout line not read: "${l.trim()}".`); continue; }
    const id = partOf(m[1], ids);
    if (!id) { problems.push(`The layout names "${m[1]}", which is not in the parts tables (its line is kept).`); continue; }
    if (!fixed.has(id)) fixed.set(id, { x: Number(m[2]), y: Number(m[3]) });
  }
  return { status: "ok", fixed, problems };
}

const line = (id: string, p: Pos): string => `${id}: ${Math.round(p.x)}, ${Math.round(p.y)}`;

/**
 * The block's new lines for `places` (every part the window manages, `managed`). An unchanged line stays byte-equal; a moved part's line is rewritten;
 * a managed part with no place loses its line (Reset to automatic); other lines are kept; new parts are added at the end. Null for a newer format.
 */
export function writeLayout(body: string | null, places: Places, managed: string[]): string | null {
  if (body === null) return [`format: ${LAYOUT_FORMAT}`, ...[...places].map(([id, p]) => line(id, p))].join("\n");
  const lines = body.split("\n");
  const eol = lines.length && lines[0].endsWith("\r") ? "\r" : "";
  const first = lines.find(l => bare(l).trim());
  const f = first !== undefined ? FORMAT.exec(bare(first)) : null;
  if (f && Number(f[1]) > LAYOUT_FORMAT) return null;
  const done = new Set<string>();
  const out: string[] = f ? [] : [`format: ${LAYOUT_FORMAT}${eol}`];
  for (const l of lines) {
    const m = POS.exec(bare(l));
    const id = m ? partOf(m[1], managed) : "";
    if (!m || !id || done.has(id)) { out.push(l); continue; }
    done.add(id);
    const p = places.get(id);
    if (!p) continue;
    const same = Number(m[2]) === Math.round(p.x) && Number(m[3]) === Math.round(p.y);
    out.push(same ? l : line(id, p) + (l.endsWith("\r") ? "\r" : ""));
  }
  for (const [id, p] of places) if (!done.has(id)) out.push(line(id, p) + eol);
  return out.join("\n");
}

/** The note with its ```rig-layout block's lines set to `body`; a note without one gets the block directly under its ```rig block (owner, 2026-10-21), or at the end. */
export function setLayoutInNote(text: string, body: string): string {
  const lines = text.split("\n");
  const b = findLayout(text);
  if (b) return [...lines.slice(0, b.open + 1), ...body.split("\n"), ...lines.slice(b.close)].join("\n");
  const eol = text.includes("\r\n") ? "\r" : "";
  const block = ["```rig-layout", ...body.split("\n").map(bare), "```"].map(l => l + eol);
  const open = lines.findIndex(l => RIG_OPEN.test(bare(l)));
  const close = open < 0 ? -1 : lines.findIndex((l, i) => i > open && FENCE_CLOSE.test(bare(l)));
  if (close >= 0) return [...lines.slice(0, close + 1), eol, ...block, ...lines.slice(close + 1)].join("\n");
  return text.replace(/\s*$/, "") + `${eol}\n${eol}\n` + block.join("\n") + `${eol}\n`;
}

/** The part under a point (figure units), "" for none. A part attached to a host counts as its host: it moves with it. */
export function partAt(boxes: PartBox[], x: number, y: number, pad = 6): string {
  const hit = boxes.find(b => Math.abs(x - b.x) <= b.w / 2 + pad && Math.abs(y - b.y) <= b.h / 2 + pad && !b.host)
    ?? boxes.find(b => Math.abs(x - b.x) <= b.w / 2 + pad && Math.abs(y - b.y) <= b.h / 2 + pad);
  return hit ? (hit.host || hit.id) : "";
}

/** A point on the page in figure units, for an <img> of a `w` × `h` figure shown with object-fit: contain inside `rect`. */
export function toFigure(rect: { left: number; top: number; width: number; height: number }, w: number, h: number, cx: number, cy: number): Pos {
  const k = Math.min(rect.width / w, rect.height / h) || 1;
  return { x: (cx - rect.left - (rect.width - w * k) / 2) / k, y: (cy - rect.top - (rect.height - h * k) / 2) / k };
}

/** Where a dragged part lands: its start moved by the drag, on the grid, its symbol kept off the top and left edges. */
export function dropAt(start: Pos, dx: number, dy: number, size: { w: number; h: number }): Pos {
  const keep = (v: number, half: number): number => Math.max(snap(v), Math.ceil((half + 10) / GRID) * GRID);
  return { x: keep(start.x + dx, size.w / 2), y: keep(start.y + dy, size.h / 2) };
}
