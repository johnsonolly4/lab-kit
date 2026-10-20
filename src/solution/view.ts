// Solution prep, the ```solution block as what is drawn: a view model made from the block text and the reagent note. Pure (no Obsidian runtime).
// Plan: docs/plans/solution-live-block.md, Phase 3 (read only). Texts are the plan's and the approved picture's; new wording is listed in BACKLOG "Questions for the owner".
import { acidRecipe, balanceRange, pHFromMasses, type AcidSetup } from "./acid";
import { formatQuantity, massToGrams, parseQuantity, parseSolution, type Solution } from "./block";
import type { ReagentField, ReagentRead } from "./reagent";

export interface ViewRow { label: string; target: string; actual: string }
export interface ViewStep { title: string; done: boolean; rows: ViewRow[] }
export interface View {
  /** Set when the block is from a newer plugin: only this line is drawn. */
  newer: string | null;
  /** Lines that stop the block from being drawn (nothing else is shown with them). */
  errors: string[];
  title: string;
  status: string;
  summary: string;
  steps: ViewStep[];
  /** "Estimated pH from what you've entered:" value, the ± text and the asterisk note; null until something is entered. */
  estimate: { pH: string; range: string } | null;
  caution: string;
  /** The mol/kg-as-mol/L note the asterisk on the estimate points to. */
  approx: string;
}

/** What the renderer found for the `reagent:` link. */
export type ReagentLookup = { name: string; read: ReagentRead } | { name: string; read: null };

export const TEXT = {
  newer: "Made with a newer Lab Kit: update the plugin.",
  inProgress: (n: number, m: number) => `in progress · step ${n} of ${m}`,
  done: "done",
  estimate: "Estimated pH from what you've entered:",
  caution: (name: string) => `Estimate for ${lowerFirst(name)} in water alone; monomer, initiator or salts shift it. Check with a pH meter.`,
  noNote: (name: string) => `no note called "${name}"`,
  hasNo: (name: string, what: string) => `"${name}" has no ${what}`,
  // New wording, asked in BACKLOG "Questions for the owner":
  approx: "* Approximate: mol/kg is taken as mol/L.",
  noReagent: "no reagent given",
  bad: (key: string) => `${key} is missing or not a number`,
  both: (name: string) => `"${name}" has both Purity and Concentration: use one`,
  unusable: (name: string, what: string) => `"${name}": ${what} is not usable`,
  unsupported: (what: string) => `not supported yet: ${what}`,
};

const FIELD_LABEL: Record<ReagentField, string> = { mw: "MW", purity: "Purity", concentration: "Concentration", density: "Density", pKa: "pKa", kind: "Acid / base" };

/** "Acetic acid" → "acetic acid"; "HCl stock" stays. */
function lowerFirst(s: string): string {
  return /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
}

/** `[[Acetic acid]]`, `"[[Acetic acid|acid]]"` or a plain name → the note name to look up. */
export function reagentName(v: string | undefined): string {
  let s = (v ?? "").trim().replace(/^"(.*)"$/, "$1").trim();
  const m = /^\[\[([^\]]*)\]\]$/.exec(s);
  if (m) s = m[1];
  return s.split("|")[0].split("#")[0].trim();
}

const num = (v: string | undefined): number | null => {
  const q = v === undefined ? null : parseQuantity(v);
  return q && q.unit === "" ? q.value : null;
};
const pct = (v: string | undefined): number | null => {
  const q = v === undefined ? null : parseQuantity(v);
  return q && (q.unit === "%" || q.unit === "") ? q.value : null;
};
const grams = (v: string | undefined): number | null => {
  const q = v === undefined ? null : parseQuantity(v);
  return q ? massToGrams(q) : null;
};

/** An actual as typed: its text, and grams when it is a mass (a bare number takes the unit the row shows). */
function actual(v: string | undefined, rowUnit: string): { text: string; g: number | null } {
  const text = (v ?? "").trim();
  if (!text) return { text: "", g: null };
  const q = parseQuantity(text);
  if (!q) return { text, g: null };
  return { text: q.unit ? text : `${text} ${rowUnit}`, g: massToGrams(q.unit ? q : { value: q.value, unit: rowUnit }) };
}

const stripUnit = (g: number): { v: number; u: string } => g < 1 ? { v: g * 1000, u: "mg" } : { v: g, u: "g" };

/** What the block shows for this text and this reagent note. */
export function buildView(source: string, lookup: (name: string) => ReagentLookup): View {
  const sol: Solution = parseSolution(source);
  const view: View = { newer: null, errors: [], title: "", status: "", summary: "", steps: [], estimate: null, caution: "", approx: "" };
  if (sol.newer) { view.newer = TEXT.newer; return view; }

  const su = sol.setup;
  const method = su.method?.trim().toLowerCase(), kind = su.kind?.trim().toLowerCase();
  if ((method && method !== "by mass") || (kind && kind !== "acid for ph")) { view.errors.push(TEXT.unsupported([method && method !== "by mass" ? `method: ${su.method}` : "", kind && kind !== "acid for ph" ? `kind: ${su.kind}` : ""].filter(Boolean).join(", "))); return view; }

  const name = reagentName(su.reagent);
  if (!name) view.errors.push(TEXT.noReagent);
  const found = name ? lookup(name) : null;
  if (found && found.read === null) view.errors.push(TEXT.noNote(name));
  const read = found?.read ?? null;
  if (read) {
    if (read.conflict) view.errors.push(TEXT.both(name));
    for (const f of read.invalid) view.errors.push(TEXT.unusable(name, FIELD_LABEL[f]));
    for (const f of read.missing) view.errors.push(TEXT.hasNo(name, FIELD_LABEL[f]));
  }

  const aqueous = grams(su.aqueous), pH = num(su["target-pH"]), share = pct(su.share), use = pct(su.use), balance = grams(su.balance);
  if (aqueous === null) view.errors.push(TEXT.bad("aqueous"));
  if (pH === null) view.errors.push(TEXT.bad("target-pH"));
  if (share === null) view.errors.push(TEXT.bad("share"));
  if (use === null) view.errors.push(TEXT.bad("use"));
  if (balance === null) view.errors.push(TEXT.bad("balance"));
  if (view.errors.length || !read || aqueous === null || pH === null || share === null || use === null || balance === null) return view;

  const base = read.kind === "base";
  const setup: AcidSetup = { aqueousG: aqueous, pH, share: share / 100, use: use / 100, reagent: read.reagent, pKa: read.pKa ?? null, kind: read.kind ?? "acid", readabilityG: balance };
  const recipe = acidRecipe(setup);
  if (recipe.acidG === null) { view.errors.push(TEXT.bad("target-pH")); return view; }

  const rows = (sec: string, keyA: string, keyB: string, ua: string, ub: string) => {
    const v = sol.steps.find(s => s.name === sec)?.values ?? {};
    return [actual(v[keyA], ua), actual(v[keyB], ub)];
  };
  const [accAct, waterToAct] = rows("step 1", "acid", "water-to", "mg", "g");
  const [solAct, waterAct] = rows("step 2", "acid-solution", "water", "g", "g");

  const a = stripUnit(recipe.acidG);
  const t = (g: number, d = 2) => formatQuantity(g, "g", d);
  const done1 = !!accAct.text && !!waterToAct.text, done2 = !!solAct.text && !!waterAct.text;
  const title = `${base ? "Base" : "Acid"} solution for pH ${pH.toFixed(2)}`;
  view.title = su.title?.trim() || title;
  view.steps = [
    { title: `1. Make the ${base ? "base" : "acid"} solution (${t(recipe.madeG)}): ${base ? "base" : "acid"} first${done1 ? " ✓" : ""}`, done: done1, rows: [
      { label: name, target: formatQuantity(a.v, a.u, 2), actual: accAct.text },
      { label: "Water to a total of", target: t(recipe.madeG), actual: waterToAct.text },
    ] },
    { title: `2. Into the aqueous phase${done2 ? " ✓" : ""}`, done: done2, rows: [
      { label: `${base ? "Base" : "Acid"} solution`, target: t(recipe.solutionG), actual: solAct.text },
      { label: "Water", target: t(recipe.waterG), actual: waterAct.text },
    ] },
  ];
  const left = view.steps.findIndex(s => !s.done);
  view.status = left < 0 ? TEXT.done : TEXT.inProgress(left + 1, view.steps.length);

  const strength = read.basis === "concentration" ? `${read.reagent.concentration} mol/L` : `${read.reagent.purity} %`;
  const pka = read.pKa === undefined ? "" : `, pKa ${read.pKa}`;
  view.summary = `${name} (${strength}${pka}) · aqueous phase ${t(aqueous)} · ${share} % ${base ? "base" : "acid"} solution, ${use} % used · balance ${balanceShow(balance)}`;

  const entered = [accAct, waterToAct, solAct, waterAct].some(x => x.g !== null);
  if (entered) {
    const acidG = accAct.g ?? recipe.acidG, madeG = waterToAct.g ?? recipe.madeG, solutionG = solAct.g ?? recipe.solutionG;
    const aqueousG = solutionG + (waterAct.g ?? recipe.waterG);
    const est = pHFromMasses({ acidG, madeG, solutionG, aqueousG }, read.reagent, read.pKa ?? null, read.kind ?? "acid");
    if (est !== null) {
      const r = balanceRange(setup, acidG);
      view.estimate = { pH: est.toFixed(2), range: r ? `±${((r.high - r.low) / 2).toFixed(2)} from the balance` : "" };
      view.approx = TEXT.approx;
    }
  }
  view.caution = TEXT.caution(name);
  return view;
}

/** The balance as it is shown: 0.1 mg for 0.0001 g. */
function balanceShow(g: number): string {
  const s = stripUnit(g);
  return `${Number(s.v.toPrecision(6))} ${s.u}`;
}
