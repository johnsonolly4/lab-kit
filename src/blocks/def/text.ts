// Texts of a block definition: display formats and the small filler for titles, summaries, row subs, labels and worked-out lines. Pure (no Obsidian runtime).
// Plan: docs/plans/custom-live-blocks.md, Target design §3 (Texts, Formats), Phase C4. Tokens: `{{key}}` (a word), `{{= formula | format | format}}`, `{{#each list | ", "}}…{{/each}}`.
// The number rules are the built-in RAFT block's (../raft/format.ts), so a definition writes the same text.
import { isErr, type Value } from "../../calc/engine";
import { fmtMass, fmtMmol, fmtMw, groupThousands, trimZeros } from "../raft/format";

/** One display format as written after a `|`: `mass`, `number: 2`, `unit: g/mol`. */
export interface Fmt { name: string; arg?: string | number | boolean }

/** `["number: 2", "group"]` → formats. The reader (definition.ts) has already checked the names and arguments. */
export function parseFormats(parts: readonly string[]): Fmt[] {
  return parts.map(p => {
    const i = p.indexOf(":");
    const name = (i < 0 ? p : p.slice(0, i)).trim();
    if (i < 0) return { name };
    const arg = p.slice(i + 1).trim();
    return { name, arg: /^\d+$/.test(arg) ? Number(arg) : arg };
  });
}

/** A number as `String(n)` after rounding to 12 significant digits, so float noise (0.30000000000000004) is not written. */
export const plainNumber = (n: number): string => String(Number(n.toPrecision(12)));

/** A target mass in g as a balance reading, but two decimals from 1 g up (`2.50 g`), for summaries. */
export const fmtMass2 = (g: number): string => g >= 1 ? `${g.toFixed(2)} g` : fmtMass(g);

/**
 * A value as text, through the formats in order. The first number format picks the digits, later ones decorate:
 * `mass` `mass2` (grams) · `mol` (`14.773 mmol`) · `mmol` (`14.773`, the same digits without the unit) · `mw` (4 decimals, zeros dropped) ·
 * `number: N` (at most N decimals, trailing zeros dropped) · `sig: N` (N significant figures) · `percent: N` (N decimals, then ` %`; the value is already in percent) ·
 * `group` (thin space between thousands) · `unit: text` (appended after a space) · `lower-first`.
 * No number format: the number rounded to 12 figures. An error value shows its code (`#DIV/0!`).
 */
export function formatValue(v: Value, fmts: readonly Fmt[] = []): string {
  if (isErr(v)) return v.err;
  const one = Array.isArray(v) ? (v.length === 1 ? v[0] : null) : v;
  if (one === null || one === undefined) return "";
  let out = typeof one === "number" ? plainNumber(one) : typeof one === "boolean" ? (one ? "TRUE" : "FALSE") : typeof one === "string" ? one : isErr(one) ? one.err : "";
  const n = typeof one === "number" && Number.isFinite(one) ? one : null;
  for (const f of fmts) {
    const places = typeof f.arg === "number" ? f.arg : 0;
    switch (f.name) {
      case "mass": if (n !== null) out = fmtMass(n); break;
      case "mass2": if (n !== null) out = fmtMass2(n); break;
      case "mol": if (n !== null) out = fmtMmol(n); break;
      case "mmol": if (n !== null) out = fmtMmol(n).replace(" mmol", ""); break;
      case "mw": if (n !== null) out = fmtMw(n); break;
      case "number": if (n !== null) out = trimZeros(n.toFixed(places)); break;
      case "sig": if (n !== null) out = String(Number(n.toPrecision(Math.max(1, places)))); break;
      case "percent": if (n !== null) out = `${trimZeros(n.toFixed(places))} %`; break;
      case "group": out = groupThousands(out); break;
      case "unit": out = `${out} ${f.arg ?? ""}`.trimEnd(); break;
      case "lower-first": out = out.charAt(0).toLowerCase() + out.slice(1); break;
    }
  }
  return out;
}

/** What the filler asks of its caller. `C` is whatever the caller needs to tell one place from another (a row, an item of a list). */
export interface FillHost<C> {
  /** The value of a formula in this place. */
  value(formula: string, ctx: C): Value;
  /** The text of `{{key}}` (an answer, or an item's `name`); undefined = not known, the token is left as written. */
  word(key: string, ctx: C): string | undefined;
  /** The places of a list answer, one per item; null = not a list. */
  items(list: string, ctx: C): C[] | null;
}

const EACH = /\{\{#each\s+([A-Za-z_][\w-]*)(?:\s*\|\s*"([^"]*)")?\s*\}\}([\s\S]*?)\{\{\/each\}\}/g;
const TOKEN = /\{\{(=?)([^{}]*)\}\}/g;

/** The text with its tokens filled. A loop does not nest. */
export function fillText<C>(text: string, ctx: C, host: FillHost<C>): string {
  const looped = text.replace(EACH, (whole, list: string, sep: string | undefined, body: string) => {
    const items = host.items(list, ctx);
    return items ? items.map(c => fillTokens(body, c, host)).join(sep ?? "") : whole;
  });
  return fillTokens(looped, ctx, host);
}

function fillTokens<C>(text: string, ctx: C, host: FillHost<C>): string {
  return text.replace(TOKEN, (whole, eq: string, inner: string) => {
    if (eq) {
      const [formula, ...fmts] = inner.split("|");
      return formatValue(host.value(formula.trim(), ctx), parseFormats(fmts.map(s => s.trim())));
    }
    return host.word(inner.trim(), ctx) ?? whole;
  });
}
