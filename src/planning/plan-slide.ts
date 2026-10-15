// The picture of one project's plan for a slide (planning kit): which to-dos are shown how, and the SVG text of it.
// Pure (no DOM, no Obsidian runtime): the window turns the SVG into a PNG. Always light colours, whatever Obsidian's theme.
import type { PlanRow } from "./plan";
import { CARD_H, CARD_W, mapGeometry, subsLabel } from "./plan-map";
import type { MapArrow, MapCard, PlanMap } from "./plan-map";

export type SlideLayout = { kind: "compact"; ahead: number } | { kind: "whole" };

export interface SlideModel {
  /** Finished to-dos shown as tiles (compact only): linked ones in step order, then the unlinked. */
  done: PlanRow[];
  /** The cards to draw, steps and places re-numbered from 0. */
  map: PlanMap;
  /** Open linked to-dos further ahead than asked, as tiles (compact only). */
  later: PlanRow[];
  /** To-dos with no links, as tiles (compact: open ones only, the finished are in `done`). */
  loose: PlanRow[];
}

/** Which to-dos become cards and which tiles. Compact: the finished ones and the open ones further than `ahead` steps from the first open step become tiles.
 *  Whole: every linked to-do is a card (finished ones marked), every unlinked one a tile. */
export function slideModel(map: PlanMap, layout: SlideLayout): SlideModel {
  const shown = (cards: MapCard[], arrows: MapArrow[]): PlanMap => {
    const keep = new Set(cards.map(c => c.path));
    return { cards, arrows: arrows.filter(a => keep.has(a.from) && keep.has(a.to)), unlinked: [], startStep: 0, cyclic: new Set() };
  };
  if (layout.kind === "whole") return { done: [], map: shown(map.cards, map.arrows), later: [], loose: map.unlinked };

  const open = map.cards.filter(c => !c.row.done);
  const first = open.length ? Math.min(...open.map(c => c.step)) : 0;
  const ahead = Math.max(1, Math.floor(layout.ahead) || 1);
  const near = open.filter(c => c.step - first < ahead);
  const byStep = new Map<number, MapCard[]>();
  for (const c of near) byStep.set(c.step, [...(byStep.get(c.step) ?? []), c]);
  const cards = near.map(c => ({ ...c, step: c.step - first, place: byStep.get(c.step)!.indexOf(c) }));   // `near` keeps the map's order: step, then place
  return {
    done: [...map.cards.filter(c => c.row.done).map(c => c.row), ...map.unlinked.filter(r => r.done)],
    map: shown(cards, map.arrows),
    later: open.filter(c => c.step - first >= ahead).map(c => c.row),
    loose: map.unlinked.filter(r => !r.done),
  };
}

export interface SlideOptions { title: string; width?: number; height?: number }
export interface SlidePicture {
  svg: string;
  /** The smallest text in the picture, in slide pixels at the picture's width. */
  minText: number;
  /** True when `minText` is under `MIN_READABLE`. */
  tooSmall: boolean;
}

/** About 11 pt on a standard slide when the picture is 1920 wide. */
export const MIN_READABLE = 22;

const INK = "#1b1f24", MUTED = "#6b7280", LINE = "#9aa1ab", TILE = "#eef0f3", ACCENT = "#1f6feb", WARN = "#b45309";
const FONT = "Helvetica, Arial, sans-serif";
const CHAR_W = 0.56;   // average character width in em: text is never measured, so wrap and cut by character count with room to spare
const MARGIN = 48, TITLE_H = 72, GAP = 16;
const TILE_W = 340, TILE_H = 48, TILE_GAP = 12, TILE_FONT = 22, LABEL_FONT = 24, LABEL_H = 36;
const CARD_TITLE = 17, CARD_META = 15, MAX_ZOOM = 1.7;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const cut = (s: string, n: number): string => (s.length <= n ? s : s.slice(0, Math.max(1, n - 1)).trimEnd() + "…");
/** At most `lines` lines of at most `n` characters, split at spaces; the rest is cut with "…". */
function wrap(s: string, n: number, lines: number): string[] {
  const out: string[] = [];
  let rest = s.trim();
  while (rest && out.length < lines) {
    if (rest.length <= n) { out.push(rest); rest = ""; break; }
    const at = rest.lastIndexOf(" ", n);
    const k = at > n / 2 ? at : n;
    out.push(rest.slice(0, k).trimEnd());
    rest = rest.slice(k).trim();
  }
  if (rest) out[out.length - 1] = cut(out[out.length - 1] + " " + rest, n);
  return out;
}
const shortDate = (d: string): string => {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(d);
  return m && Number(m[1]) >= 1 && Number(m[1]) <= 12 ? `${Number(m[2])} ${MONTHS[Number(m[1]) - 1]}` : d;
};
const PRIORITY = ["", "↑", "–", "↓"];

function cardSvg(c: MapCard, x: number, y: number): string {
  const r = c.row;
  const next = !r.done && !r.blocked;
  const stroke = r.done ? LINE : next ? ACCENT : LINE;
  const fill = r.done ? TILE : "#ffffff";
  const ink = r.done ? MUTED : INK;
  const rect = `<rect x="${x}" y="${y}" width="${CARD_W}" height="${CARD_H}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="${next ? 3 : 1.5}"${r.blocked ? ' stroke-dasharray="6 4"' : ""}/>`;
  const per = Math.floor((CARD_W - 20) / (CARD_TITLE * CHAR_W));
  const title = wrap((r.done ? "✓ " : "") + r.name, per, 2);
  const text = (ty: number, size: number, fill2: string, s: string, bold = false): string =>
    `<text x="${x + 10}" y="${y + ty}" font-size="${size}" fill="${fill2}"${bold ? ' font-weight="700"' : ""}>${esc(s)}</text>`;
  const metaN = Math.floor((CARD_W - 20) / (CARD_META * CHAR_W));
  const out = [rect, ...title.map((t, i) => text(24 + i * 20, CARD_TITLE, ink, t, true))];
  const sub = subsLabel(r).text;
  const line1 = [r.due && shortDate(r.due), r.priority ? PRIORITY[r.priority] : "", sub].filter(Boolean).join("  ");
  if (line1) out.push(text(64, CARD_META, r.due && !r.done && r.blocked ? WARN : MUTED, cut(line1, metaN)));
  if (r.result) out.push(text(82, CARD_META, MUTED, cut("→ " + r.result, metaN)));
  if (r.experiment) out.push(text(100, CARD_META, MUTED, cut(r.experiment.status ? `${r.experiment.name} · ${r.experiment.status}` : r.experiment.name, metaN)));
  return out.join("");
}

/** The tiles of one section, wrapped onto at most `maxRows` rows; what does not fit becomes a last "+N more" tile. */
function tilesSvg(rows: PlanRow[], left: number, top: number, cols: number, maxRows: number, ticked: boolean): string {
  const room = cols * maxRows;
  const names = rows.map(r => (ticked ? "✓ " : "") + r.name);
  const texts = rows.length > room ? [...names.slice(0, room - 1), `+${rows.length - room + 1} more`] : names;
  const per = Math.floor((TILE_W - 24) / (TILE_FONT * CHAR_W));
  return texts.map((t, i) => {
    const x = left + (i % cols) * (TILE_W + TILE_GAP), y = top + Math.floor(i / cols) * (TILE_H + TILE_GAP);
    const more = rows.length > room && i === room - 1;
    return `<rect x="${x}" y="${y}" width="${TILE_W}" height="${TILE_H}" rx="10" fill="${TILE}"/>`
      + `<text x="${x + 12}" y="${y + TILE_H / 2 + 8}" font-size="${TILE_FONT}" fill="${more ? MUTED : INK}">${esc(cut(t, per))}</text>`;
  }).join("");
}

/** The picture as SVG text (16:9, 1920 × 1080 unless asked otherwise), laid out for a slide. */
export function slideSvg(model: SlideModel, opts: SlideOptions): SlidePicture {
  const W = opts.width ?? 1920, H = opts.height ?? 1080;
  const inner = W - 2 * MARGIN;
  const cols = Math.max(1, Math.floor((inner + TILE_GAP) / (TILE_W + TILE_GAP)));
  const sections = [
    { label: "Done", rows: model.done, ticked: true },
    { label: "Later", rows: model.later, ticked: false },
    { label: "Not linked", rows: model.loose, ticked: false },
  ].filter(s => s.rows.length > 0);
  const hasCards = model.map.cards.length > 0;
  const heightOf = (list: typeof sections, rowsMax: number): number => list.reduce((h, s) => h + GAP + LABEL_H + Math.min(Math.ceil(s.rows.length / cols), rowsMax) * (TILE_H + TILE_GAP) - TILE_GAP, 0);
  const free = H - MARGIN - (MARGIN + TITLE_H);
  const maxRows = hasCards && free - heightOf(sections, 2) < 360 ? 1 : 2;   // a crowded slide gives the cards the room

  const parts: string[] = [];
  let minText = 44;
  const note = (n: number): void => { minText = Math.min(minText, n); };
  parts.push(`<text x="${MARGIN}" y="${MARGIN + 40}" font-size="44" font-weight="700" fill="${INK}">${esc(cut(opts.title, Math.floor(inner / (44 * CHAR_W))))}</text>`);
  let y = MARGIN + TITLE_H;
  const section = (s: typeof sections[number], at: number): number => {
    note(LABEL_FONT); note(TILE_FONT);
    parts.push(`<text x="${MARGIN}" y="${at + LABEL_FONT}" font-size="${LABEL_FONT}" font-weight="700" fill="${MUTED}">${esc(s.label)}</text>`);
    const rows = Math.min(Math.ceil(s.rows.length / cols), maxRows);
    parts.push(tilesSvg(s.rows, MARGIN, at + LABEL_H, cols, maxRows, s.ticked));
    return at + LABEL_H + rows * (TILE_H + TILE_GAP) - TILE_GAP;
  };
  const middle = (): void => {
    const geo = mapGeometry(model.map, 0, "across");
    const top = y + GAP, areaH = H - MARGIN - top - heightOf(after, maxRows);
    const s = Math.min(inner / geo.width, areaH / geo.height, MAX_ZOOM);
    note(CARD_META * s);
    const ox = MARGIN + (inner - geo.width * s) / 2, oy = top + Math.max(0, (areaH - geo.height * s) / 2);
    const arrows = geo.curves.map(c => `<path d="${c.d}" fill="none" stroke="${LINE}" stroke-width="2.5" marker-end="url(#head)"/>`).join("");
    const cards = model.map.cards.map(c => { const p = geo.pos.get(c.path)!; return cardSvg(c, p.x, p.y); }).join("");
    parts.push(`<g transform="translate(${ox.toFixed(1)} ${oy.toFixed(1)}) scale(${s.toFixed(4)})" font-family="${FONT}">${arrows}${cards}</g>`);
    y = top + areaH;
  };

  const before = sections.filter(s => s.label === "Done"), after = sections.filter(s => s.label !== "Done");
  for (const s of before) y = section(s, y + GAP);
  if (hasCards) middle();
  for (const s of after) y = section(s, y + GAP);

  const defs = `<defs><marker id="head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="${LINE}"/></marker></defs>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${FONT}">`
    + `<rect width="${W}" height="${H}" fill="#ffffff"/>${defs}${parts.join("")}</svg>`;
  const min = Math.round(minText * 10) / 10;
  return { svg, minText: min, tooSmall: min < MIN_READABLE };
}
