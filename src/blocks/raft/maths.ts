// RAFT recipe, the maths. Pure (no Obsidian runtime), no user-facing text.
// Plan: docs/plans/templater-replacement-and-live-snippets.md, Phase 9. Known answers: docs/plans/raft-known-answers.py (0005: Mn = 19990.14, CTA 0.3125 g, water 11.259 g).
// Same formulas as the old calc-table generator (labSnippets.js raft()), so a note made either way agrees.

export interface RaftMonomer { name: string; mw: number; /** Mole fraction (any positive weights; they are normalised). */ fraction: number }
export interface RaftSetup {
  monomers: RaftMonomer[];
  cta: { name: string; mw: number };
  initiator: { name: string; mw: number };
  /** Total monomer mass, g. */
  massG: number;
  dp: number;
  /** CTA : initiator (moles). */
  ratio: number;
  /** Solids, % w/w. */
  solidsPct: number;
  /** Co-solvent as a share of the solvent's mass, %; outside the solids. Undefined = no co-solvent. */
  cosolventPct?: number;
}

export interface RaftTargets {
  meanMw: number;
  /** Total monomer, mol. */
  nMonomer: number;
  monomers: { name: string; mw: number; mol: number; g: number }[];
  cta: { mol: number; g: number };
  initiator: { mol: number; g: number };
  solidsG: number;
  solventG: number;
  cosolventG: number | null;
  /** Theoretical Mn, g/mol. */
  mn: number;
}

const positive = (x: number): boolean => Number.isFinite(x) && x > 0;

/** Every mass and Mn from the set-up; null when an input is not a usable positive number (nothing is guessed). */
export function raftTargets(s: RaftSetup): RaftTargets | null {
  if (!s.monomers.length || !s.monomers.every(m => positive(m.mw) && positive(m.fraction))) return null;
  if (![s.cta.mw, s.initiator.mw, s.massG, s.dp, s.ratio, s.solidsPct].every(positive) || s.solidsPct > 100) return null;
  if (s.cosolventPct !== undefined && !(Number.isFinite(s.cosolventPct) && s.cosolventPct >= 0)) return null;
  const fSum = s.monomers.reduce((a, m) => a + m.fraction, 0);
  const meanMw = s.monomers.reduce((a, m) => a + m.mw * m.fraction, 0) / fSum;
  const nMonomer = s.massG / meanMw;
  const monomers = s.monomers.map(m => { const mol = nMonomer * m.fraction / fSum; return { name: m.name, mw: m.mw, mol, g: mol * m.mw }; });
  const nCta = nMonomer / s.dp, nInit = nCta / s.ratio;
  const cta = { mol: nCta, g: nCta * s.cta.mw }, initiator = { mol: nInit, g: nInit * s.initiator.mw };
  const solidsG = monomers.reduce((a, m) => a + m.g, 0) + cta.g + initiator.g;
  const solventG = solidsG * (100 / s.solidsPct - 1);
  return { meanMw, nMonomer, monomers, cta, initiator, solidsG, solventG, cosolventG: s.cosolventPct === undefined ? null : solventG * s.cosolventPct / 100, mn: s.dp * meanMw + s.cta.mw };
}

/** What has been weighed so far, g; undefined = not weighed yet (its target is used). `monomers` is in the set-up's order. */
export interface RaftWeighed { monomers: (number | undefined)[]; cta?: number; initiator?: number; solvent?: number }

export interface RaftFromWeighed { dp: number; mn: number; solidsPct: number }

/** DP, Mn and solids from the actual masses typed so far, the target for each one not typed (as Solution prep does for pH). */
export function raftFromWeighed(s: RaftSetup, t: RaftTargets, w: RaftWeighed): RaftFromWeighed {
  const g = t.monomers.map((m, i) => w.monomers[i] ?? m.g);
  const molM = g.reduce((a, x, i) => a + x / s.monomers[i].mw, 0);
  const gM = g.reduce((a, x) => a + x, 0);
  const cta = w.cta ?? t.cta.g, init = w.initiator ?? t.initiator.g, solvent = w.solvent ?? t.solventG;
  const nCta = cta / s.cta.mw;
  const solids = gM + cta + init;
  return { dp: molM / nCta, mn: gM / nCta + s.cta.mw, solidsPct: solids / (solids + solvent) * 100 };
}
