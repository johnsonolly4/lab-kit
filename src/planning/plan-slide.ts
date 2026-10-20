// The picture of one project's plan for a slide (planning kit): which to-dos are shown how, and the SVG text of it.
// Pure (no DOM, no Obsidian runtime): the window turns the SVG into a PNG. Always light colours, whatever Obsidian's theme.
import type { PlanRow } from "./plan";
import { CARD_H, CARD_W, mapGeometry, subsLabel } from "./plan-map";
import type { MapArrow, MapCard, PlanMap } from "./plan-map";

/** How a to-do stands today. Late (open, due date passed) wins over waiting (open, `waiting` set); a to-do with something unfinished before it is blocked. */
export type RowStatus = "done" | "late" | "waiting" | "ready" | "blocked";
/** A due date this many days away or fewer is shown in amber. */
export const DUE_SOON_DAYS = 3;

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
  /** Every to-do of the whole plan, whatever is shown: status, "after X" and "N of M done" are worked out from these, never from the cut-down map. */
  all: PlanRow[];
}

/** Whole days from `today` to `due` (both YYYY-MM-DD), null when either is missing or unreadable. */
export function daysUntil(due: string, today: string | undefined): number | null {
  const n = (d: string): number | null => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d); return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000 : null; };
  const a = n(due), b = today ? n(today) : null;
  return a === null || b === null ? null : Math.round(a - b);
}

/** The status of a row. `row.blocked` was worked out by `readPlan` from the whole plan (a finished blocker never blocks), so it does not change when the picture shows fewer to-dos. No `today`: nothing is late. */
export function statusOf(row: PlanRow, today?: string): RowStatus {
  if (row.done) return "done";
  const left = daysUntil(row.due, today);
  if (left !== null && left < 0) return "late";
  if (row.waiting) return "waiting";
  return row.blocked ? "blocked" : "ready";
}

/** The names of the unfinished to-dos `row` comes after: its own `after` items that are open, and for a finished one the open ones before it, and so on. Looked up in the whole plan. */
export function openBefore(row: PlanRow, all: PlanRow[]): string[] {
  const byPath = new Map(all.map(r => [r.path, r]));
  const out: string[] = [], seen = new Set<string>();
  const walk = (paths: string[]): void => {
    for (const p of paths) {
      if (seen.has(p)) continue;
      seen.add(p);
      const r = byPath.get(p);
      if (!r) continue;
      if (r.done) walk(r.afterPaths); else out.push(r.name);
    }
  };
  walk(row.afterPaths);
  return out;
}

/** What a card says about its status, in order: late, waiting, "after X, Y" (cannot start), due date. `tone` picks the colour. */
export function statusLines(row: PlanRow, all: PlanRow[], today?: string): { text: string; tone: "late" | "waiting" | "soon" | "muted" }[] {
  if (row.done) return [];
  const out: { text: string; tone: "late" | "waiting" | "soon" | "muted" }[] = [];
  const left = daysUntil(row.due, today);
  const late = left !== null && left < 0;
  if (late) out.push({ text: `late: due ${shortDate(row.due)}`, tone: "late" });
  if (row.waiting) out.push({ text: `waiting: ${row.waiting}`, tone: "waiting" });
  if (row.blocked) { const names = openBefore(row, all); if (names.length) out.push({ text: `after ${names.join(", ")}`, tone: "muted" }); }
  if (row.due && !late) out.push(left !== null && left <= DUE_SOON_DAYS ? { text: `due ${shortDate(row.due)} (in ${left} d)`, tone: "soon" } : { text: `due ${shortDate(row.due)}`, tone: "muted" });
  return out;
}

/** Which to-dos become cards and which tiles. Compact: the finished ones and the open ones further than `ahead` steps from the first open step become tiles.
 *  Whole: every linked to-do is a card (finished ones marked), every unlinked one a tile. */
export function slideModel(map: PlanMap, layout: SlideLayout): SlideModel {
  const all = [...map.cards.map(c => c.row), ...map.unlinked];
  const shown = (cards: MapCard[], arrows: MapArrow[]): PlanMap => {
    const keep = new Set(cards.map(c => c.path));
    return { cards, arrows: arrows.filter(a => keep.has(a.from) && keep.has(a.to)), unlinked: [], startStep: 0, cyclic: new Set() };
  };
  if (layout.kind === "whole") return { done: [], map: shown(map.cards, map.arrows), later: [], loose: map.unlinked, all };

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
    all,
  };
}

/** `today` as YYYY-MM-DD: late marks, due-soon colours and the "as of" date; left out, none of them show. */
export interface SlideOptions { title: string; width?: number; height?: number; today?: string }
export interface SlidePicture {
  svg: string;
  /** The smallest text in the picture, in slide pixels at the picture's width. */
  minText: number;
  /** True when `minText` is under `MIN_READABLE`. */
  tooSmall: boolean;
}

/** About 11 pt on a standard slide when the picture is 1920 wide. */
export const MIN_READABLE = 22;

// LATE and WAIT are the pair the research session chose (plan-map-big-project-examples.md); the owner has still to confirm them by eye.
const INK = "#1b1f24", MUTED = "#6b7280", LINE = "#9aa1ab", TILE = "#eef0f3", ACCENT = "#1f6feb", LATE = "#b3124f", WAIT = "#c77700", OK = "#2e7d32";
const TONE = { late: LATE, waiting: WAIT, soon: WAIT, muted: MUTED } as const;
const FONT = "Helvetica, Arial, sans-serif";
const CHAR_W = 0.56;   // average character width in em: text is never measured, so wrap and cut by character count with room to spare
const MARGIN = 48, TITLE_H = 72, GAP = 16;
const TILE_W = 340, TILE_H = 48, TILE_GAP = 12, TILE_FONT = 22, LABEL_FONT = 24, LABEL_H = 36;
const CARD_TITLE = 17, CARD_META = 15, MAX_ZOOM = 1.7;
const SUB_LINE = 22, SUB_MAX = 5, SUB_PAD = 4;   // subtask strips under a card: line height, most lines (the last one says "+N more" when there are more), padding
const KEY_FONT = 22, KEY_H = 26, BAR_W = 360;   // the key at the bottom (text kept at the 22 px minimum), the progress bar
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
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** "Tue 20 Oct 2026" from YYYY-MM-DD, "" when unreadable. */
function asOfDate(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return "";
  return `${WEEKDAYS[new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()]} ${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/** The lines under a card: its subtasks, finished ones struck through; over `SUB_MAX` the last line says how many more. */
function subLines(r: PlanRow): { text: string; done: boolean; more: boolean }[] {
  const shown = r.subs.length > SUB_MAX ? r.subs.slice(0, SUB_MAX - 1) : r.subs;
  const lines = shown.map(s => ({ text: (s.done ? "✓ " : "○ ") + s.name, done: s.done, more: false }));
  if (r.subs.length > shown.length) lines.push({ text: `+${r.subs.length - shown.length} more`, done: false, more: true });
  return lines;
}
/** Height the strip under a card takes (0 for a card with no subtasks). */
const subRoom = (r: PlanRow): number => (r.subs.length ? subLines(r).length * SUB_LINE + 2 * SUB_PAD + SUB_PAD : 0);

function subsSvg(r: PlanRow, x: number, y: number): string {
  const lines = subLines(r);
  if (!lines.length) return "";
  const n = Math.floor((CARD_W - 20) / (CARD_META * CHAR_W));
  const top = y + CARD_H + SUB_PAD;
  return `<rect x="${x}" y="${top}" width="${CARD_W}" height="${lines.length * SUB_LINE + 2 * SUB_PAD}" rx="8" fill="${TILE}"/>`
    + lines.map((l, i) => `<text x="${x + 10}" y="${top + SUB_PAD + i * SUB_LINE + 16}" font-size="${CARD_META}" fill="${l.done || l.more ? MUTED : INK}"${l.done ? ' text-decoration="line-through"' : ""}>${esc(cut(l.text, n))}</text>`).join("");
}

function cardSvg(c: MapCard, x: number, y: number, all: PlanRow[], today?: string): string {
  const r = c.row;
  const st = statusOf(r, today);
  const stroke = st === "late" ? LATE : st === "waiting" ? WAIT : st === "ready" ? ACCENT : LINE;
  const strong = st === "late" || st === "waiting" || st === "ready";
  const fill = r.done ? TILE : "#ffffff";
  const ink = r.done ? MUTED : INK;
  const rect = `<rect x="${x}" y="${y}" width="${CARD_W}" height="${CARD_H}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="${strong ? 3 : 1.5}"${st === "blocked" ? ' stroke-dasharray="6 4"' : ""}/>`;
  const per = Math.floor((CARD_W - 20) / (CARD_TITLE * CHAR_W));
  const title = wrap((r.done ? "✓ " : "") + r.name, per, 2);
  const text = (ty: number, size: number, fill2: string, s: string, bold = false): string =>
    `<text x="${x + 10}" y="${y + ty}" font-size="${size}" fill="${fill2}"${bold ? ' font-weight="700"' : ""}>${esc(s)}</text>`;
  const metaN = Math.floor((CARD_W - 20) / (CARD_META * CHAR_W));
  const out = [rect, ...title.map((t, i) => text(24 + i * 20, CARD_TITLE, ink, t, true))];
  // After the title: status first, then priority and subtasks, the result, the experiment; as many lines as the card has room for.
  const sub = subsLabel(r).text;
  const extra = [r.priority ? PRIORITY[r.priority] : "", sub && `${sub} subtasks`].filter(Boolean).join("  ");
  const lines: { text: string; fill: string; bold: boolean }[] = [
    ...statusLines(r, all, today).map(l => ({ text: l.text, fill: TONE[l.tone], bold: l.tone !== "muted" })),
    ...(extra ? [{ text: extra, fill: MUTED, bold: false }] : []),
    ...(r.result ? [{ text: "→ " + r.result, fill: MUTED, bold: false }] : []),
    ...(r.experiment ? [{ text: r.experiment.status ? `${r.experiment.name} · ${r.experiment.status}` : r.experiment.name, fill: MUTED, bold: false }] : []),
  ];
  const first = title.length > 1 ? 68 : 50;
  lines.slice(0, title.length > 1 ? 2 : 3).forEach((l, i) => out.push(text(first + i * 20, CARD_META, l.fill, cut(l.text, metaN), l.bold)));
  out.push(subsSvg(r, x, y));
  return out.join("");
}

/** What a tile adds after the name: "2/4" subtasks and "late" / "waiting" (late wins), and a red outline when late. Only open tiles (Later, Not linked). */
interface TileMark { suffix: string; late: boolean }
const tileMark = (r: PlanRow, today?: string): TileMark => {
  const st = statusOf(r, today), n = subsLabel(r).text;
  return { suffix: [n, st === "late" ? "late" : st === "waiting" ? "waiting" : ""].filter(Boolean).map(t => "  " + t).join(""), late: st === "late" };
};

/** The tiles of one section, wrapped onto at most `maxRows` rows; what does not fit becomes a last "+N more" tile. `marks`: add the status marks (open sections), null for none. */
function tilesSvg(rows: PlanRow[], left: number, top: number, cols: number, maxRows: number, ticked: boolean, marks: { today?: string } | null): string {
  const room = cols * maxRows;
  const per = Math.floor((TILE_W - 24) / (TILE_FONT * CHAR_W));
  const more = rows.length > room;
  const shown = more ? rows.slice(0, room - 1) : rows;
  const tiles = shown.map(r => {
    const m: TileMark = marks ? tileMark(r, marks.today) : { suffix: "", late: false };
    return { text: cut((ticked ? "✓ " : "") + r.name, Math.max(4, per - m.suffix.length)) + m.suffix, muted: false, late: m.late };
  });
  if (more) tiles.push({ text: `+${rows.length - room + 1} more`, muted: true, late: false });
  return tiles.map((t, i) => {
    const x = left + (i % cols) * (TILE_W + TILE_GAP), y = top + Math.floor(i / cols) * (TILE_H + TILE_GAP);
    return `<rect x="${x}" y="${y}" width="${TILE_W}" height="${TILE_H}" rx="10" fill="${TILE}"${t.late ? ` stroke="${LATE}" stroke-width="2"` : ""}/>`
      + `<text x="${x + 12}" y="${y + TILE_H / 2 + 8}" font-size="${TILE_FONT}" fill="${t.muted ? MUTED : INK}">${esc(t.text)}</text>`;
  }).join("");
}

/** The key at the bottom: one entry for each mark that appears in the picture. */
function keySvg(used: Set<RowStatus>, x0: number, y: number): string {
  const items: [RowStatus, string, string][] = [
    ["done", `<rect width="34" height="22" rx="5" fill="${TILE}" stroke="${LINE}"/><text x="9" y="17" font-size="16" fill="${MUTED}">✓</text>`, "done"],
    ["ready", `<rect width="34" height="22" rx="5" fill="#fff" stroke="${ACCENT}" stroke-width="3"/>`, "can start"],
    ["blocked", `<rect width="34" height="22" rx="5" fill="#fff" stroke="${LINE}" stroke-width="2" stroke-dasharray="6 4"/>`, "waits for an earlier step"],
    ["late", `<rect width="34" height="22" rx="5" fill="#fff" stroke="${LATE}" stroke-width="3"/>`, "late"],
    ["waiting", `<rect width="34" height="22" rx="5" fill="#fff" stroke="${WAIT}" stroke-width="3"/>`, "waiting on someone"],
  ];
  let x = x0;
  const out: string[] = [];
  for (const [st, mark, label] of items) {
    if (!used.has(st)) continue;
    out.push(`<g transform="translate(${x} ${y})">${mark}<text x="44" y="19" font-size="${KEY_FONT}" fill="${MUTED}">${label}</text></g>`);
    x += 44 + Math.ceil(label.length * KEY_FONT * CHAR_W) + 36;
  }
  return out.join("");
}

/** The picture as SVG text (16:9, 1920 × 1080 unless asked otherwise), laid out for a slide. */
export function slideSvg(model: SlideModel, opts: SlideOptions): SlidePicture {
  const W = opts.width ?? 1920, H = opts.height ?? 1080;
  const today = opts.today && asOfDate(opts.today) ? opts.today : undefined;
  const inner = W - 2 * MARGIN;
  const cols = Math.max(1, Math.floor((inner + TILE_GAP) / (TILE_W + TILE_GAP)));
  const sections = [
    { label: "Done", rows: model.done, ticked: true },
    { label: "Later", rows: model.later, ticked: false },
    { label: "Not linked", rows: model.loose, ticked: false },
  ].filter(s => s.rows.length > 0);
  const hasCards = model.map.cards.length > 0;
  // Which marks appear: the key lists only those.
  const shownRows = [...model.map.cards.map(c => c.row), ...model.done, ...model.later, ...model.loose];
  const used = new Set<RowStatus>();
  for (const r of shownRows) { const st = statusOf(r, today); if (st === "done" || st === "late") used.add(st); if (!r.done && r.waiting) used.add("waiting"); }
  for (const c of model.map.cards) { const st = statusOf(c.row, today); if (st === "ready" || st === "blocked") used.add(st); }   // only cards have these borders
  const keyOn = used.size > 0;
  const bottom = H - MARGIN - (keyOn ? KEY_H + GAP : 0);
  const heightOf = (list: typeof sections, rowsMax: number): number => list.reduce((h, s) => h + GAP + LABEL_H + Math.min(Math.ceil(s.rows.length / cols), rowsMax) * (TILE_H + TILE_GAP) - TILE_GAP, 0);
  const free = bottom - (MARGIN + TITLE_H);
  const maxRows = hasCards && free - heightOf(sections, 2) < 360 ? 1 : 2;   // a crowded slide gives the cards the room

  const parts: string[] = [];
  let minText = 44;
  const note = (n: number): void => { minText = Math.min(minText, n); };
  // Header: the title, and on the right the "as of" date and the progress of the top-level to-dos.
  const top = model.all.filter(r => r.parent === null);
  const doneN = top.filter(r => r.done).length;
  const count = top.length ? `${doneN} of ${top.length} done` : "";
  const rightW = count ? BAR_W + 12 + Math.ceil(count.length * 22 * CHAR_W) : today ? Math.ceil(asOfDate(today).length * 22 * CHAR_W) + 60 : 0;
  parts.push(`<text x="${MARGIN}" y="${MARGIN + 40}" font-size="44" font-weight="700" fill="${INK}">${esc(cut(opts.title, Math.max(8, Math.floor((inner - (rightW ? rightW + 24 : 0)) / (44 * CHAR_W)))))}</text>`);
  if (today) { note(22); parts.push(`<text x="${W - MARGIN}" y="${MARGIN + 10}" font-size="22" text-anchor="end" fill="${MUTED}">as of ${esc(asOfDate(today))}</text>`); }
  if (count) {
    note(22);
    const bx = W - MARGIN - BAR_W;
    parts.push(`<rect x="${bx}" y="${MARGIN + 24}" width="${BAR_W}" height="14" rx="7" fill="${TILE}"/>`
      + (doneN ? `<rect x="${bx}" y="${MARGIN + 24}" width="${Math.max(14, Math.round(BAR_W * doneN / top.length))}" height="14" rx="7" fill="${OK}"/>` : "")
      + `<text x="${bx - 12}" y="${MARGIN + 38}" font-size="22" text-anchor="end" fill="${INK}">${count}</text>`);
  }
  let y = MARGIN + TITLE_H;
  const section = (s: typeof sections[number], at: number): number => {
    note(LABEL_FONT); note(TILE_FONT);
    parts.push(`<text x="${MARGIN}" y="${at + LABEL_FONT}" font-size="${LABEL_FONT}" font-weight="700" fill="${MUTED}">${esc(s.label)}</text>`);
    const rows = Math.min(Math.ceil(s.rows.length / cols), maxRows);
    parts.push(tilesSvg(s.rows, MARGIN, at + LABEL_H, cols, maxRows, s.ticked, s.ticked ? null : { today }));
    return at + LABEL_H + rows * (TILE_H + TILE_GAP) - TILE_GAP;
  };
  const middle = (): void => {
    const geo = mapGeometry(model.map, 0, "across", new Map(model.map.cards.map(c => [c.path, subRoom(c.row)] as const)));
    const mapTop = y + GAP, areaH = bottom - mapTop - heightOf(after, maxRows);
    const s = Math.min(inner / geo.width, areaH / geo.height, MAX_ZOOM);
    note(CARD_META * s);
    const ox = MARGIN + (inner - geo.width * s) / 2, oy = mapTop + Math.max(0, (areaH - geo.height * s) / 2);
    const arrows = geo.curves.map(c => `<path d="${c.d}" fill="none" stroke="${LINE}" stroke-width="2.5" marker-end="url(#head)"/>`).join("");
    const cards = model.map.cards.map(c => { const p = geo.pos.get(c.path)!; return cardSvg(c, p.x, p.y, model.all, today); }).join("");
    parts.push(`<g transform="translate(${ox.toFixed(1)} ${oy.toFixed(1)}) scale(${s.toFixed(4)})" font-family="${FONT}">${arrows}${cards}</g>`);
    y = mapTop + areaH;
  };

  const before = sections.filter(s => s.label === "Done"), after = sections.filter(s => s.label !== "Done");
  for (const s of before) y = section(s, y + GAP);
  if (hasCards) middle();
  for (const s of after) y = section(s, y + GAP);
  if (keyOn) { note(KEY_FONT); parts.push(keySvg(used, MARGIN, H - MARGIN - 24)); }

  const defs = `<defs><marker id="head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="${LINE}"/></marker></defs>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${FONT}">`
    + `<rect width="${W}" height="${H}" fill="#ffffff"/>${defs}${parts.join("")}</svg>`;
  const min = Math.round(minText * 10) / 10;
  return { svg, minText: min, tooSmall: min < MIN_READABLE };
}
