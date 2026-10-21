// Live blocks, the shared core: the tolerant `key: value` text format (two-space nesting, units), the one-line writer, the `format:` line with the
// newer-version refusal, and the Actual-cell write (vault.process) with scroll hold. Moved as it was from src/solution/ (plan
// docs/plans/templater-replacement-and-live-snippets.md, Phase 8); each block type keeps its own maths and its own words.
// Format: `key: value` lines, a `step N:` line opens a section of two-space nested lines, `#` lines and blank lines are kept as they are.
// A write changes only the one line it names (or adds one).
import type { App, TFile } from "obsidian";

/** The format this plugin writes. A block without a `format:` line is version 1. Older versions must always parse. */
export const FORMAT_VERSION = 1;

export interface Quantity { value: number; unit: string }

const NUMBER = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*(kg|mg|ug|µg|g|mL|L|%)?\s*$/;

/** "1.30 mg" → {1.3, "mg"}; "4.00" → {4, ""}; anything else (also empty) → null. */
export function parseQuantity(s: string): Quantity | null {
  const m = NUMBER.exec(s);
  if (!m) return null;
  return { value: Number(m[1]), unit: m[2] ?? "" };
}

/** Grams for a mass unit; null for a unit that is not a mass. */
const MASS_TO_G: Record<string, number> = { kg: 1000, g: 1, mg: 1e-3, ug: 1e-6, "µg": 1e-6 };
export function massToGrams(q: Quantity): number | null {
  const f = MASS_TO_G[q.unit];
  return f === undefined ? null : q.value * f;
}
export function gramsToUnit(g: number, unit: string): number | null {
  const f = MASS_TO_G[unit];
  return f === undefined ? null : g / f;
}

/** "1.30 mg": the number to `decimals` places, then the unit. */
export function formatQuantity(value: number, unit: string, decimals: number): string {
  const n = value.toFixed(decimals);
  return unit ? `${n} ${unit}` : n;
}

/** Decimals a balance of this readability (g) gives in this mass unit: 0.0001 g → 4 in g, 1 in mg. */
export function balanceDecimals(readabilityG: number, unit: string): number {
  const r = gramsToUnit(readabilityG, unit);
  if (r === null || !(r > 0)) return 0;
  return Math.max(0, Math.ceil(-Math.log10(r) - 1e-9));
}

export interface Section { name: string; values: Record<string, string> }
export interface Block {
  /** From the `format:` line; 1 when there is none. NaN when the line is not a whole number. */
  version: number;
  /** Written by a newer plugin: do not draw or edit it, leave the text alone. */
  newer: boolean;
  /** Top-level keys before and between sections, by key (last one wins). */
  setup: Record<string, string>;
  /** `step 1:`, `step 2:` … with their lines, in order. */
  steps: Section[];
  /** Lines that are not blank, not a comment and not `key: value` / `name:`: 1-based block line numbers. */
  problems: number[];
}

const KEY_LINE = /^(\s*)([^\s:#][^:]*?)\s*:(?:\s+(.*?)|)\s*$/;

/** Read the block text (the lines between the fences). Never throws. */
export function parseBlock(source: string): Block {
  const out: Block = { version: 1, newer: false, setup: {}, steps: [], problems: [] };
  let section: Section | null = null;
  source.split("\n").forEach((raw, i) => {
    const line = raw.replace(/\r$/, "");
    if (!line.trim() || line.trim().startsWith("#")) return;
    const m = KEY_LINE.exec(line);
    if (!m) { out.problems.push(i + 1); return; }
    const indent = m[1].length, key = m[2], value = m[3] ?? "";
    if (indent === 0 && value === "" && key !== "format") { section = { name: key, values: {} }; out.steps.push(section); return; }
    if (indent > 0 && section) { section.values[key] = value; return; }
    if (indent > 0) { out.problems.push(i + 1); return; }
    section = null;
    out.setup[key] = value;
  });
  if ("format" in out.setup) {
    const v = /^\d+$/.test(out.setup.format) ? Number(out.setup.format) : NaN;
    out.version = v;
    out.newer = v > FORMAT_VERSION;
  }
  return out;
}

/** Set `key` to `value` in the block text; `section` null = a top-level (set-up) line, else the `step N` section.
 *  Only that line changes; a missing line is added (set-up: after the last set-up line; a step line: at the end of its section;
 *  a missing section: at the end). Everything else, comments included, stays byte for byte. */
export function setLine(source: string, section: string | null, key: string, value: string): string {
  const lines = source.split("\n");
  const cr = lines.length > 0 && lines.some(l => l.endsWith("\r")) ? "\r" : "";
  const body = lines.map(l => l.replace(/\r$/, ""));
  let cur = null as string | null;
  let found = -1, lastIn = -1, firstSection = -1;
  body.forEach((line, i) => {
    if (!line.trim() || line.trim().startsWith("#")) return;
    const m = KEY_LINE.exec(line);
    if (!m) return;
    const indent = m[1].length, k = m[2], v = m[3] ?? "";
    if (indent === 0 && v === "" && k !== "format") { cur = k; if (firstSection < 0) firstSection = i; if (cur === section) lastIn = i; return; }
    if (indent === 0) cur = null;
    if (cur === section) { lastIn = i; if (k === key) found = i; }
  });
  const fmt = (indent: string) => `${indent}${key}:${value ? " " + value : ""}`;
  if (found >= 0) {
    const m = KEY_LINE.exec(body[found])!;
    body[found] = fmt(m[1]);
  } else if (section === null) {
    const at = lastIn >= 0 ? lastIn + 1 : firstSection >= 0 ? firstSection : lastNonBlank(body) + 1;
    body.splice(at, 0, fmt(""));
  } else if (lastIn >= 0) {
    body.splice(lastIn + 1, 0, fmt("  "));
  } else {
    const at = lastNonBlank(body) + 1;
    body.splice(at, 0, `${section}:`, fmt("  "));
  }
  return body.join(cr + "\n");
}

function lastNonBlank(lines: string[]): number {
  for (let i = lines.length - 1; i >= 0; i--) if (lines[i].trim()) return i;
  return -1;
}

/** The block text of the fenced block whose opening fence is on `lineStart` (0-based line of the note), and its line range. */
export function blockRange(note: string, lineStart: number): { source: string; from: number; to: number } | null {
  const lines = note.split("\n");
  if (!/^\s*(`{3,}|~{3,})/.test(lines[lineStart] ?? "")) return null;
  const fence = /^\s*(`{3,}|~{3,})/.exec(lines[lineStart])![1];
  for (let i = lineStart + 1; i < lines.length; i++) {
    if (lines[i].replace(/\r$/, "").trim().startsWith(fence) && lines[i].replace(/\r$/, "").trim().replace(new RegExp(`^${fence[0]}+`), "") === "") {
      return { source: lines.slice(lineStart + 1, i).join("\n"), from: lineStart + 1, to: i };
    }
  }
  return null;
}

/** Change one line inside the block that opens on `lineStart`; null when there is no such block or it is from a newer plugin. */
export function writeInNote(note: string, lineStart: number, section: string | null, key: string, value: string): string | null {
  const r = blockRange(note, lineStart);
  if (!r || parseBlock(r.source).newer) return null;
  const next = setLine(r.source, section, key, value);
  const lines = note.split("\n");
  lines.splice(r.from, r.to - r.from, ...(next === "" ? [] : next.split("\n")));
  return lines.join("\n");
}

/** The red line under an Actual box that is not a mass (owner board 5, 2026-10-20). */
export const NOT_A_MASS = "Not a mass: use g or mg.";

/** The line value for what was typed: "1.30" in a mg row → "1.30 mg", "1.3mg" → "1.3 mg", a mass in another unit keeps its unit ("0.0013 g"),
 *  "" → "" (clears the actual). null when it is not a number with a mass unit. The number is kept as typed (the balance's decimals). */
export function actualText(typed: string, rowUnit: string): string | null {
  const s = typed.trim();
  if (!s) return "";
  const q = parseQuantity(s);
  if (!q || (q.unit !== "" && massToGrams(q) === null)) return null;
  const number = s.replace(/\s*(kg|mg|ug|µg|g|mL|L|%)\s*$/, "");
  return `${number} ${q.unit || rowUnit}`;
}

/** The cell to open after the one at `from`: Enter and Tab go to the next empty one (Tab to the next cell, empty or not), Shift+Tab to the one before.
 *  null when there is none (Enter on the last empty cell just saves). */
export function nextCell(cells: { value: string }[], from: number, how: "enter" | "tab" | "back"): number | null {
  if (how === "back") return from > 0 ? from - 1 : null;
  for (let i = from + 1; i < cells.length; i++) if (how === "tab" || !cells[i].value) return i;
  return null;
}

/** Runs a write on the note under `vault.process`; the new note text, or null when the write refused (no such block, newer format). */
export async function processNote(app: App, file: TFile, write: (note: string) => string | null): Promise<string | null> {
  let out: string | null = null;
  await app.vault.process(file, data => { out = write(data); return out ?? data; });
  return out;
}



/** Puts the note back where it was scrolled to while Obsidian lays the redrawn block out, until the user scrolls. */
export function holdScroll(containerEl: HTMLElement): void {
  const scroller = containerEl.closest<HTMLElement>(".cm-scroller") ?? containerEl.closest<HTMLElement>(".markdown-preview-view");
  if (!scroller) return;
  const top = scroller.scrollTop;
  const ac = new AbortController();
  const stop = (): void => ac.abort();
  scroller.addEventListener("wheel", stop, { signal: ac.signal, passive: true });
  scroller.addEventListener("touchmove", stop, { signal: ac.signal, passive: true });
  for (const ms of [0, 60, 200, 500, 1000, 1800]) window.setTimeout(() => { if (!ac.signal.aborted && scroller.scrollTop !== top) scroller.scrollTop = top; if (ms === 1800) ac.abort(); }, ms);
}
