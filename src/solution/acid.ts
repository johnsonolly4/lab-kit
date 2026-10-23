// Solution prep, acid (or base) for a target pH: the maths only. Pure (no Obsidian runtime), no user-facing text.
// Plan: docs/plans/solution-live-block.md, Phase 1. Known answers: its Appendix script.
// mol/kg is taken as mol/L (owner, 2026-10-20): the result says so with `approximate`.

/** Water's ion product, 25 °C. pH + pOH = 14 follows from it. */
export const KW = 1e-14;
export const PKW = 14;

/** `acid` or `base`. For a base the given pKa is the one of its conjugate acid (ammonium 9.25), so pKb = 14 - pKa. */
export type Kind = "acid" | "base";

/** What a chemical note says about a reagent. A field that is not there is left out (never 0). */
export interface Reagent {
  /** g/mol */
  mw?: number;
  /** wt% (0-100) of the liquid or solid as bought */
  purity?: number;
  /** mol/L of a reagent given as a molarity; used with `density`, instead of `purity` */
  concentration?: number;
  /** g/mL */
  density?: number;
}

export type ReagentKey = "mw" | "purity" | "density";

/** Moles of reagent per gram of the stuff in the bottle. `missing` lists what is needed and not given (asking is a later phase). */
export interface PerGram {
  value: number | null;
  basis: "purity" | "concentration" | null;
  missing: ReagentKey[];
  /** Purity and Concentration both given: the owner's rule is one of them. */
  conflict: boolean;
}

const has = (n: number | undefined): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

/** Moles per gram: purity / 100 / MW for a wt% reagent, M / (density x 1000) for a molarity reagent. */
export function molesPerGram(r: Reagent): PerGram {
  const conflict = has(r.purity) && has(r.concentration);
  const byConc = has(r.concentration) && !has(r.purity);
  const basis = conflict ? null : byConc ? "concentration" : "purity";
  const missing: ReagentKey[] = [];
  if (conflict) return { value: null, basis: null, missing, conflict };
  if (byConc) {
    if (!has(r.density)) missing.push("density");
  } else {
    if (!has(r.purity)) missing.push("purity");
    if (!has(r.mw)) missing.push("mw");
  }
  if (missing.length) return { value: null, basis, missing, conflict };
  const value = byConc ? r.concentration! / (r.density! * 1000) : r.purity! / 100 / r.mw!;
  return { value, basis, missing, conflict };
}

/** Bottle molarity (Sigma style): wt%/100 x density x 1000 / MW. A molarity reagent is its own concentration. */
export function bottleMolarity(r: Reagent): { value: number | null; missing: ReagentKey[] } {
  if (has(r.concentration) && !has(r.purity)) return { value: r.concentration, missing: [] };
  const missing: ReagentKey[] = [];
  if (!has(r.purity)) missing.push("purity");
  if (!has(r.density)) missing.push("density");
  if (!has(r.mw)) missing.push("mw");
  if (missing.length) return { value: null, missing };
  return { value: (r.purity! / 100) * r.density! * 1000 / r.mw!, missing };
}

/** Solve the charge balance for a weak acid on the H+ side. `pK` null = strong. Returns C for a given pH. */
function concForAcidSide(pH: number, pK: number | null): number {
  const h = 10 ** -pH;
  const free = h - KW / h;
  if (pK === null) return free;
  const ka = 10 ** -pK;
  return free * (ka + h) / ka;
}

/** pH of C mol/L on the acid side: bisection on log [H+] of h = C·Ka/(Ka+h) + Kw/h (strong: h = C + Kw/h). */
function pHAcidSide(c: number, pK: number | null): number {
  const ka = pK === null ? 0 : 10 ** -pK;
  let lo = -14, hi = 0, m = -7;
  for (let i = 0; i < 200; i++) {
    m = (lo + hi) / 2;
    const h = 10 ** m;
    const bound = pK === null ? c : c * ka / (ka + h);
    if (h - bound - KW / h > 0) hi = m; else lo = m;
  }
  return -m;
}

/** Mirror for a base: the same balance on [OH-] with pKb = 14 - pKa. */
const pKOf = (pKa: number | null, kind: Kind): number | null => pKa === null ? null : kind === "acid" ? pKa : PKW - pKa;

/** Concentration (mol/L, taken as mol/kg) of an acid / base that gives the target pH. `pKa` null = strong. */
export function acidConcForPH(pH: number, pKa: number | null, kind: Kind = "acid"): number {
  return concForAcidSide(kind === "acid" ? pH : PKW - pH, pKOf(pKa, kind));
}

/** pH of a solution of concentration C (mol/L). */
export function pHFromConc(c: number, pKa: number | null, kind: Kind = "acid"): number {
  const p = pHAcidSide(c, pKOf(pKa, kind));
  return kind === "acid" ? p : PKW - p;
}

/** Set-up of one acid-for-pH solution made in one step on a balance (all masses in g). */
export interface AcidSetup {
  aqueousG: number;
  pH: number;
  /** Fraction (0-1) of the aqueous phase that is the acid solution. */
  share: number;
  /** Fraction (0-1) of the made acid solution that is used. */
  use: number;
  reagent: Reagent;
  /** null = strong */
  pKa: number | null;
  kind: Kind;
  /** Balance readability in g (0.0001 = 0.1 mg). */
  readabilityG: number;
}

export type AcidProblem = "aqueous" | "pH" | "share" | "use" | "readability" | "conflict";

export interface AcidRecipe {
  /** Target concentration, mol/L. */
  conc: number;
  /** mol/kg was taken as mol/L: the value is approximate (a flag; the wording is a later phase). */
  approximate: true;
  /** Step 1: weigh this much reagent, add water up to `madeG`. */
  acidG: number | null;
  madeG: number;
  /** Step 2: add this much acid solution and `waterG` water to the aqueous phase. */
  solutionG: number;
  waterG: number;
  /** Reagent data that is missing (acidG is null then). */
  missing: ReagentKey[];
  basis: "purity" | "concentration" | null;
  problems: AcidProblem[];
  /** Acid mass under 10 x the readability. */
  tooSmall: boolean;
  /** Made mass that brings the acid to 10 x the readability (same share and use); null when not too small. */
  batchG: number | null;
}

/** Acid mass is too small for the balance when under this many readabilities (owner, 2026-10-20). */
export const MIN_READABILITIES = 10;

/** Targets for step 1 and step 2 from the set-up. Invalid input is named in `problems`, never thrown. */
export function acidRecipe(s: AcidSetup): AcidRecipe {
  const problems: AcidProblem[] = [];
  if (!(s.aqueousG > 0)) problems.push("aqueous");
  if (!Number.isFinite(s.pH) || s.pH <= 0 || s.pH >= PKW) problems.push("pH");
  if (!(s.share > 0 && s.share <= 1)) problems.push("share");
  if (!(s.use > 0 && s.use <= 1)) problems.push("use");
  if (!(s.readabilityG > 0)) problems.push("readability");
  const pg = molesPerGram(s.reagent);
  if (pg.conflict) problems.push("conflict");
  const solutionG = s.aqueousG * s.share;
  const madeG = solutionG / s.use;
  const base: AcidRecipe = { conc: NaN, approximate: true, acidG: null, madeG, solutionG, waterG: s.aqueousG - solutionG, missing: pg.missing, basis: pg.basis, problems, tooSmall: false, batchG: null };
  if (problems.some(p => p !== "conflict" && p !== "readability")) return base;
  const conc = acidConcForPH(s.pH, s.pKa, s.kind);
  base.conc = conc;
  if (pg.value === null) return base;
  const acidG = conc * (s.aqueousG / 1000) * (madeG / solutionG) / pg.value;
  base.acidG = acidG;
  if (s.readabilityG > 0) {
    const need = MIN_READABILITIES * s.readabilityG;
    base.tooSmall = acidG < need;
    base.batchG = base.tooSmall ? madeG * need / acidG : null;
  }
  return base;
}

/** The made masses once actuals are typed: what the pH will be. Missing actuals are replaced by targets by the caller. */
export interface Actuals {
  acidG: number;
  /** Final mass of the acid solution (acid + water). */
  madeG: number;
  /** Acid solution that went into the aqueous phase. */
  solutionG: number;
  /** Whole aqueous phase after step 2. */
  aqueousG: number;
}

/** Estimated pH from the masses really weighed. null when the reagent data is missing. */
export function pHFromMasses(a: Actuals, reagent: Reagent, pKa: number | null, kind: Kind = "acid"): number | null {
  const pg = molesPerGram(reagent);
  if (pg.value === null) return null;
  const conc = (a.acidG * pg.value) * (a.solutionG / a.madeG) / (a.aqueousG / 1000);
  return pHFromConc(conc, pKa, kind);
}

/** pH when the acid mass is off by one readability each way: the higher and the lower of the two pH values. */
export function balanceRange(s: AcidSetup, acidG: number): { high: number; low: number } | null {
  const pg = molesPerGram(s.reagent);
  if (pg.value === null) return null;
  const solutionG = s.aqueousG * s.share;
  const at = (g: number) => pHFromMasses({ acidG: g, madeG: solutionG / s.use, solutionG, aqueousG: s.aqueousG }, s.reagent, s.pKa, s.kind)!;
  const a = at(acidG - s.readabilityG), b = at(acidG + s.readabilityG);
  return { high: Math.max(a, b), low: Math.min(a, b) };
}
