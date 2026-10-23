// Solution prep: a chemical note's front matter read into the reagent the maths needs. Pure (no Obsidian runtime), no user-facing text.
// Plan: docs/plans/solution-live-block.md, Phase 2. A missing value is reported, never guessed (asking and saving is Phase 4).
import { MW_KEYS } from "../calc/engine";
import { prop, toList } from "../frontmatter";
import type { Kind, Reagent } from "./acid";

/** The chemical-note properties the block reads. `kind` is the `Acid / base` property. */
export type ReagentField = "mw" | "purity" | "concentration" | "density" | "pKa" | "kind";

/** What the note says, and what is wrong with it. */
export interface ReagentRead {
  reagent: Reagent;
  /** First pKa only (Q5). For a base: the pKa of its conjugate acid. */
  pKa?: number;
  kind?: Kind;
  /** Which of Purity (wt%) / Concentration (mol/L) is used; null when neither is given or both are (conflict). */
  basis: "purity" | "concentration" | null;
  /** Purity and Concentration both filled in one note: use one. */
  conflict: boolean;
  /** Needed for an acid-for-pH recipe and not in the note (nothing is guessed). */
  missing: ReagentField[];
  /** Filled in but not usable: no number, a unit that is not converted (mmol/L, kg/m3), purity over 100, `Acid / base` that is neither word. */
  invalid: ReagentField[];
}

const NUMBER = /[-+]?(?:\d+(?:[.,]\d+)?|[.,]\d+)(?:e[-+]?\d+)?/i;

/** A value as the first number in it: 99.7, "99.7 wt% (glacial)", "1,05 g/mL". undefined = nothing there; null = something there with no number. */
function firstNumber(v: unknown): number | null | undefined {
  const raw = Array.isArray(v) ? toList(v)[0] : v;
  if (raw == null || raw === "") return undefined;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return undefined;
  const m = NUMBER.exec(s);
  if (!m) return null;
  const n = parseFloat(m[0].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** A number that carries a unit this reader does not convert counts as unusable (reported, not scaled by a guess). */
function unitOk(v: unknown, bad: RegExp): boolean {
  return typeof v !== "string" || !bad.test(v);
}

function molecularWeight(fm: Record<string, unknown>, mwProperty?: string): unknown {
  const mine = mwProperty?.trim() ? prop(fm, mwProperty.trim()) : undefined;   // same rule as calc/render.ts: the user's own name wins
  if (mine != null && mine !== "") return mine;
  const key = Object.keys(fm).find(k => MW_KEYS.includes(k.toLowerCase()));
  return key === undefined ? undefined : fm[key];
}

function kindOf(fm: Record<string, unknown>): Kind | null | undefined {
  const v = prop(fm, "Acid / base") ?? prop(fm, "Acid/base");
  const s = toList(v)[0]?.trim().toLowerCase();
  if (!s) return undefined;
  return s === "acid" ? "acid" : s === "base" ? "base" : null;
}

/** Reads a chemical note's front matter. `mwProperty` is the user's own MW property name (setting), tried before the built-in names. */
export function readReagent(fm: Record<string, unknown> | undefined, mwProperty?: string): ReagentRead {
  const f = fm ?? {};
  const invalid: ReagentField[] = [];
  const reagent: Reagent = {};
  const take = (field: ReagentField, key: keyof Reagent, raw: unknown, ok: (n: number) => boolean, bad?: RegExp): void => {
    const n = firstNumber(raw);
    if (n === undefined) return;
    if (n === null || !ok(n) || (bad && !unitOk(raw, bad))) { invalid.push(field); return; }
    reagent[key] = n;
  };
  take("mw", "mw", molecularWeight(f, mwProperty), n => n > 0);
  take("purity", "purity", prop(f, "Purity"), n => n > 0 && n <= 100);
  take("concentration", "concentration", prop(f, "Concentration"), n => n > 0, /[mµun]mol|[mµ]M\b/);
  take("density", "density", prop(f, "Density"), n => n > 0, /kg\s*\/\s*m/i);

  let pKa: number | undefined;
  const p = firstNumber(prop(f, "pKa"));
  if (p === null) invalid.push("pKa"); else if (p !== undefined) pKa = p;

  const k = kindOf(f);
  if (k === null) invalid.push("kind");

  const conflict = reagent.purity !== undefined && reagent.concentration !== undefined;
  const basis = conflict ? null : reagent.concentration !== undefined ? "concentration" : reagent.purity !== undefined ? "purity" : null;
  const missing: ReagentField[] = [];
  const need = (field: ReagentField, has: boolean): void => { if (!has && !invalid.includes(field)) missing.push(field); };
  if (!conflict) {
    if (basis === "concentration") need("density", reagent.density !== undefined);
    else { if (basis === null) need("purity", false); need("mw", reagent.mw !== undefined); }
  }
  need("pKa", pKa !== undefined);
  need("kind", k !== undefined && k !== null);

  return { reagent, pKa, kind: k ?? undefined, basis, conflict, missing, invalid };
}

/** Chemical notes that can be picked as a reagent: those with `Acid / base` set (plan: the picker). */
export function isReagentNote(fm: Record<string, unknown> | undefined): boolean {
  return kindOf(fm ?? {}) !== undefined;
}
