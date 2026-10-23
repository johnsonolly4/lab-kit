// Chemical database: what a mixture note is made of (stock solution, pre-mix) and how much of an ingredient a gram of it carries.
// Pure (no Obsidian runtime): notes come in through `lookup`. Plan: docs/plans/chemical-database-components.md §1, Phase CD-A.
// Format (CD1 a): two lists in step, `components` (links) and `component_amounts` (texts), item n with item n. CD4 a: the first item is the main component.
import { prop } from "../frontmatter";
import { readReagent } from "../solution/reagent";

export type Basis = "ww" | "ppm" | "molL" | "gL" | "wv" | "vv" | "rest" | "byMW" | "unknown" | "invalid";

export interface ComponentItem {
  /** Note name the link points to (no brackets, alias or heading). */
  name: string;
  /** The amount as written. */
  text: string;
  basis: Basis;
  /** Lower and upper end in the basis' own unit (% for ww / wv / vv, ppm, mol/L, g/L). Equal for a plain amount; `≤ 30 ppm` is 0 to 30. Absent for rest, byMW, unknown, invalid. */
  lo?: number;
  hi?: number;
  problems: string[];
}

export interface ComponentsRead {
  items: ComponentItem[];
  problems: string[];
}

/** Other notes' front matter by note name (the caller matches names the way links resolve). */
export type Lookup = (name: string) => Record<string, unknown> | undefined;

/** An amount as a fraction range: g of the component per g of the material. */
export interface Fraction { lo: number; hi: number }

/** Grams of pure ingredient per gram of material, as weighed. min = max for an exact amount. */
export interface Content { min: number; max: number; problems: string[] }

/** What `amountFraction` needs from the notes around an item. */
export interface AmountContext {
  /** Name of the mixture note (for the sentences). */
  owner: string;
  /** g/mL of the mixture note. */
  density?: number;
  /** MW of the mixture note (for `by MW`). */
  ownMw?: number;
  /** g/mol and g/mL of the component. */
  mw?: number;
  componentDensity?: number;
}

export const MAX_DEPTH = 6;

/** Every sentence the reader can produce, in one place. */
export const PROBLEM = {
  mismatch: (items: number, amounts: number) => `Components has ${items} item${items === 1 ? "" : "s"}, component_amounts ${amounts}.`,
  notAmount: (owner: string, n: number, text: string) => `${owner}: component_amounts item ${n} "${text}" is not an amount.`,
  perKg: (text: string) => `${text}: mol/kg is not read; write it per litre of solution (mol/L).`,
  twoRest: (owner: string) => `More than one rest in ${owner}.`,
  cycle: (path: string[]) => `${path.join(" → ")}: a mixture cannot contain itself.`,
  deep: (name: string) => `Mixtures nest deeper than ${MAX_DEPTH} levels at ${name}.`,
  noNote: (name: string) => `There is no chemical note ${name}.`,
  missingMw: (name: string, text: string) => `MW of ${name} is missing, needed for ${text}.`,
  missingDensity: (name: string, text: string) => `Density of ${name} is missing, needed for ${text}.`,
  noAmount: (owner: string, name: string) => `${owner}: no amount for ${name}.`,
  over100: (owner: string) => `The amounts in ${owner} add up to more than 100 %.`,
  both: (name: string) => `${name} has both Purity and Concentration.`,
  unusable: (name: string, field: string) => `${name}: ${field} is filled in but is not a usable number.`
};

const NUM = String.raw`(\d+(?:[.,]\d+)?|[.,]\d+)`;
const AMOUNT = new RegExp(String.raw`^(?:(≤|<=|<)\s*)?${NUM}(?:\s*[-–]\s*${NUM})?\s*(.*)$`);

type Unit = { basis: Basis; scale: number };
/** Unit texts (lower case, spaces removed) and what they mean in the basis' own unit. */
const UNITS: Record<string, Unit> = {
  "%": { basis: "ww", scale: 1 }, "wt%": { basis: "ww", scale: 1 }, "%w/w": { basis: "ww", scale: 1 }, "w/w%": { basis: "ww", scale: 1 }, "%(w/w)": { basis: "ww", scale: 1 },
  "ppm": { basis: "ppm", scale: 1 },
  "mol/l": { basis: "molL", scale: 1 }, "m": { basis: "molL", scale: 1 },
  "mmol/l": { basis: "molL", scale: 1e-3 }, "mm": { basis: "molL", scale: 1e-3 }, "µmol/l": { basis: "molL", scale: 1e-6 },
  "g/l": { basis: "gL", scale: 1 }, "mg/ml": { basis: "gL", scale: 1 },
  "%w/v": { basis: "wv", scale: 1 }, "w/v%": { basis: "wv", scale: 1 },
  "%v/v": { basis: "vv", scale: 1 }, "v/v%": { basis: "vv", scale: 1 }
};

function num(s: string): number {
  return parseFloat(s.replace(",", "."));
}

/** One amount text as an item (everything but the name). */
function parseAmount(owner: string, n: number, name: string, raw: string): ComponentItem {
  const text = raw.trim();
  const item: ComponentItem = { name, text, basis: "unknown", problems: [] };
  if (!text) return item;
  const bad = (): ComponentItem => { item.basis = "invalid"; item.problems.push(PROBLEM.notAmount(owner, n, text)); return item; };
  if (/^rest$/i.test(text)) { item.basis = "rest"; return item; }
  if (/^by\s*mw$/i.test(text)) { item.basis = "byMW"; return item; }
  const m = AMOUNT.exec(text);
  if (!m) return bad();
  const unitText = m[4].toLowerCase().replace(/\s+/g, "");
  if (/^mol\/kg$/.test(unitText)) { item.basis = "invalid"; item.problems.push(PROBLEM.perKg(text)); return item; }
  const unit = UNITS[unitText];
  if (!unit) return bad();
  const a = num(m[2]);
  const b = m[3] === undefined ? a : num(m[3]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return bad();
  item.basis = unit.basis;
  item.lo = m[1] ? 0 : a * unit.scale;
  item.hi = (m[1] ? a : b) * unit.scale;
  return item;
}

/** Name a link points to: `[[C]]`, `[[C|alias]]`, `[[C#heading]]`, `C`. */
function linkTarget(s: string): string {
  return s.trim().replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].split("#")[0].trim();
}

const cellText = (v: unknown): string => typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : "";

/** A list property as cells, keeping empty ones so the two lists stay in step. */
function cells(v: unknown): string[] {
  if (v == null || v === "") return [];
  if (Array.isArray(v)) return v.flatMap(x => Array.isArray(x) ? cells(x) : x == null ? [""] : [cellText(x)]);
  return [cellText(v)];
}

const COMPONENTS = ["components", "Components"];
const AMOUNTS = ["component_amounts", "component amounts", "Component_amounts"];
const first = (fm: Record<string, unknown>, names: string[]): unknown => {
  for (const n of names) { const v = prop(fm, n); if (v != null && v !== "") return v; }
  return undefined;
};

/** The note's components and their amounts, each amount parsed. `owner` only names the note in sentences. */
export function readComponents(fm: Record<string, unknown> | undefined, owner = "This note"): ComponentsRead {
  const f = fm ?? {};
  const names = cells(first(f, COMPONENTS)).map(linkTarget);
  const amounts = cells(first(f, AMOUNTS));
  const problems: string[] = [];
  if (names.length !== amounts.length) problems.push(PROBLEM.mismatch(names.length, amounts.length));
  const items = names.map((name, i) => parseAmount(owner, i + 1, name, amounts[i] ?? ""));
  if (items.filter(i => i.basis === "rest").length > 1) problems.push(PROBLEM.twoRest(owner));
  for (const i of items) problems.push(...i.problems);
  return { items, problems };
}

/** CD4 a: the first item is the main component. */
export function mainComponent(items: ComponentItem[]): ComponentItem | undefined {
  return items[0];
}

/** g of the component per g of the mixture for one item (not `rest`: that needs the other items). A problem text instead when it cannot be worked out. */
export function amountFraction(item: ComponentItem, ctx: AmountContext): Fraction | { problem: string } {
  const { lo, hi } = item;
  if (item.basis === "unknown") return { problem: PROBLEM.noAmount(ctx.owner, item.name) };
  if (item.basis === "invalid") return { problem: item.problems[0] ?? PROBLEM.notAmount(ctx.owner, 0, item.text) };
  if (item.basis === "rest") return { problem: PROBLEM.twoRest(ctx.owner) };
  if (item.basis === "byMW") {
    if (!ctx.mw) return { problem: PROBLEM.missingMw(item.name, item.text) };
    if (!ctx.ownMw) return { problem: PROBLEM.missingMw(ctx.owner, item.text) };
    const r = ctx.mw / ctx.ownMw;
    return { lo: r, hi: r };
  }
  if (lo === undefined || hi === undefined) return { problem: PROBLEM.notAmount(ctx.owner, 0, item.text) };
  const scale = (k: number): Fraction => ({ lo: lo * k, hi: hi * k });
  switch (item.basis) {
    case "ww": return scale(1 / 100);
    case "ppm": return scale(1e-6);
    case "molL":
      if (!ctx.mw) return { problem: PROBLEM.missingMw(item.name, item.text) };
      if (!ctx.density) return { problem: PROBLEM.missingDensity(ctx.owner, item.text) };
      return scale(ctx.mw / (1000 * ctx.density));
    case "gL":
      if (!ctx.density) return { problem: PROBLEM.missingDensity(ctx.owner, item.text) };
      return scale(1 / (1000 * ctx.density));
    case "wv":
      if (!ctx.density) return { problem: PROBLEM.missingDensity(ctx.owner, item.text) };
      return scale(1 / (100 * ctx.density));
    case "vv":
      if (!ctx.density) return { problem: PROBLEM.missingDensity(ctx.owner, item.text) };
      if (!ctx.componentDensity) return { problem: PROBLEM.missingDensity(item.name, item.text) };
      return scale(ctx.componentDensity / (100 * ctx.density));
    default: return { problem: PROBLEM.notAmount(ctx.owner, 0, item.text) };
  }
}

const sameName = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

function casOf(fm: Record<string, unknown> | undefined): string {
  const v = fm ? first(fm, ["cas_no", "CAS-No.", "CAS No.", "CAS"]) : undefined;
  const one: unknown = Array.isArray(v) ? (v as unknown[])[0] : v;
  return cellText(one).replace(/\s+/g, "");
}

/** CD5 a: the same name, or the same CAS number when both notes have one. */
function isIngredient(name: string, fm: Record<string, unknown> | undefined, ingredient: string, ingredientCas: string): boolean {
  if (sameName(name, ingredient)) return true;
  const cas = casOf(fm);
  return !!cas && cas === ingredientCas;
}

/** The note as the ingredient itself: Purity ÷ 100, Concentration × MW ÷ (1000 × Density), or 1 when neither is set. */
function selfContent(name: string, fm: Record<string, unknown> | undefined): Content {
  const r = readReagent(fm);
  const problems: string[] = [];
  for (const field of r.invalid) if (field === "purity" || field === "concentration") problems.push(PROBLEM.unusable(name, field));
  if (r.conflict) { problems.push(PROBLEM.both(name)); return { min: 1, max: 1, problems }; }
  let v = 1;
  if (r.reagent.purity !== undefined) v = r.reagent.purity / 100;
  else if (r.reagent.concentration !== undefined) {
    if (!r.reagent.mw) problems.push(PROBLEM.missingMw(name, "Concentration"));
    else if (!r.reagent.density) problems.push(PROBLEM.missingDensity(name, "Concentration"));
    else v = r.reagent.concentration * r.reagent.mw / (1000 * r.reagent.density);
  }
  return { min: v, max: v, problems };
}

/** Grams of pure `ingredient` in 1 g of the note `name`, as weighed (plan §1.4). Depth limit 6; a note met twice on one path is a cycle. */
export function content(name: string, ingredient: string, lookup: Lookup): Content {
  const ingredientCas = casOf(lookup(ingredient));
  const problems: string[] = [];
  const walk = (note: string, path: string[]): Content => {
    const fm = lookup(note);
    if (isIngredient(note, fm, ingredient, ingredientCas)) return selfContent(note, fm);
    if (!fm) { problems.push(PROBLEM.noNote(note)); return { min: 0, max: 0, problems: [] }; }
    if (path.some(p => sameName(p, note))) { problems.push(PROBLEM.cycle([...path.slice(path.findIndex(p => sameName(p, note))), note])); return { min: 0, max: 0, problems: [] }; }
    if (path.length > MAX_DEPTH) { problems.push(PROBLEM.deep(note)); return { min: 0, max: 0, problems: [] }; }
    const { items } = readComponents(fm, note);
    if (!items.length) return { min: 0, max: 0, problems: [] };
    const own = readReagent(fm).reagent;
    const ctxFor = (item: ComponentItem): AmountContext => {
      const c = readReagent(lookup(item.name)).reagent;
      return { owner: note, density: own.density, ownMw: own.mw, mw: c.mw, componentDensity: c.density };
    };
    let sumLo = 0, sumHi = 0, min = 0, max = 0;
    const fractions: (Fraction | null)[] = items.map(item => {
      if (item.basis === "rest") return null;
      const fr = amountFraction(item, ctxFor(item));
      if ("problem" in fr) { problems.push(fr.problem); return { lo: 0, hi: 0 }; }
      sumLo += fr.lo; sumHi += fr.hi;
      return fr;
    });
    if (sumLo > 1 + 1e-9) problems.push(PROBLEM.over100(note));
    items.forEach((item, i) => {
      const fr = fractions[i] ?? { lo: Math.max(0, 1 - sumHi), hi: Math.max(0, 1 - sumLo) };
      if (fr.hi === 0) return;
      const c = walk(item.name, [...path, note]);
      min += fr.lo * c.min;
      max += fr.hi * c.max;
    });
    return { min, max, problems: [] };
  };
  const result = walk(name, []);
  return { min: result.min, max: result.max, problems: [...new Set([...problems, ...result.problems])] };
}
