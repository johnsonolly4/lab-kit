// RAFT block as what is drawn (look R-C of the owner-picked page: one Target / Actual list, role and mmol under each name, a live "Mn from what you've weighed",
// a collapsed "How it's worked out" fold). A view model made from the block text and the chemical notes' MW. Pure (no Obsidian runtime).
// Plan: docs/plans/templater-replacement-and-live-snippets.md, Phase 9. New wording is listed in BACKLOG "Questions for the owner".
import { parseBlock, parseQuantity, massToGrams } from "../core";
import { TEXT as SOL } from "../../solution/view";
import { fmtMass, fmtMmol, fmtMn, trimZeros } from "./format";
import { raftFromWeighed, raftTargets, type RaftWeighed } from "./maths";
import { raftLines, setupFromLines, valuesFromBlock, workedOut, type RaftField } from "./text";

/** Where an Actual is stored: its `used:` key and the unit a bare number takes. */
export interface UsedField { key: string; unit: string }
export interface RaftRow { label: string; sub: string; target: string; actual: string; field: UsedField }
export interface RaftError { text: string; /** The chemical note whose MW can be typed once (the line is clickable). */ ask?: string }
export interface RaftView {
  newer: string | null;
  errors: RaftError[];
  title: string;
  status: string;
  summary: string;
  /** One list (look R-C): monomer(s), CTA, solvent, co-solvent, initiator. */
  rows: RaftRow[];
  /** "Mn from what you've weighed:" value and the (DP · solids) text; null until a mass is entered. */
  estimate: { mn: string; range: string } | null;
  /** The sums of "How it's worked out", one line each (the note's `#` lines without the head and MW line, and without `# `). */
  worked: string[];
}

/** What the renderer found for a reagent name. */
export interface MwLookup { name: string; mw: number | null; state: "ok" | "no-note" | "no-mw" | "bad-mw" }

export const TEXT = {
  newer: SOL.newer,
  inProgress: SOL.inProgress,
  done: SOL.done,
  estimate: "Mn from what you've weighed:",
  editSetup: SOL.editSetup,
  fold: "How it's worked out",
  window: "RAFT recipe generator",
  noBlock: "Couldn't find this RAFT block. Edit it in source mode instead.",
  noChange: "Couldn't change this RAFT block. Edit it in source mode instead.",
  foldNote: "same lines as in the note",
  // New wording, asked in BACKLOG "Questions for the owner":
  weighed: (n: number, m: number) => `${n} of ${m} weighed`,
  noMonomer: "monomers: no monomer given",
  missing: (key: string) => `${key} is missing`,
  bad: (key: string) => `${key} is missing or not a number`,
};

/** The block key each box is stored under, for the problem lines. */
const KEY: Record<RaftField, string> = {
  monomers: "monomers", cta: "cta", initiator: "initiator", solvent: "solvent", cosolvent: "cosolvent", cosolventPct: "cosolvent-pct",
  mass: "monomer-mass", dp: "DP", ratio: "CTA-to-initiator", solids: "solids",
};

const lowerFirst = (s: string): string => /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;

/** An actual as typed: its text (a bare number takes the row's unit) and grams when it is a mass. */
function actual(v: string | undefined, rowUnit: string): { text: string; g: number | null } {
  const text = (v ?? "").trim();
  if (!text) return { text: "", g: null };
  const q = parseQuantity(text);
  if (!q) return { text, g: null };
  return { text: q.unit ? text : `${text} ${rowUnit}`, g: massToGrams(q.unit ? q : { value: q.value, unit: rowUnit }) };
}

/** The mass in the summary line: `2.50 g`. */
const summaryMass = (g: number): string => g >= 1 ? `${g.toFixed(2)} g` : fmtMass(g);

const unitOf = (g: number): string => g < 0.1 ? "mg" : "g";

/** What the block shows for this text and these chemical notes. */
export function buildRaftView(source: string, lookup: (name: string) => MwLookup): RaftView {
  const block = parseBlock(source);
  const view: RaftView = { newer: null, errors: [], title: "", status: "", summary: "", rows: [], estimate: null, worked: [] };
  if (block.newer) { view.newer = TEXT.newer; return view; }

  const parsed = raftLines(valuesFromBlock(block));
  if (!("lines" in parsed)) {
    const key = KEY[parsed.field];
    view.errors.push({ text: parsed.field === "monomers" ? TEXT.noMonomer : block.setup[key] === undefined || block.setup[key] === "" ? TEXT.missing(key) : TEXT.bad(key) });
    return view;
  }
  const l = parsed.lines;

  const mws = new Map<string, number | null>();
  for (const name of [...l.monomers.map(m => m.name), l.cta, l.initiator]) {
    if (mws.has(name)) continue;
    const f = lookup(name);
    mws.set(name, f.state === "ok" ? f.mw : null);
    if (f.state === "no-note") view.errors.push({ text: SOL.noNote(name) });
    else if (f.state === "no-mw") view.errors.push({ text: SOL.hasNo(name, "MW"), ask: name });
    else if (f.state === "bad-mw") view.errors.push({ text: SOL.unusable(name, "MW") });
  }
  const setup = view.errors.length ? null : setupFromLines(l, n => mws.get(n) ?? null);
  const t = setup && raftTargets(setup);
  if (!setup || !t) { if (!view.errors.length) view.errors.push({ text: TEXT.bad("DP") }); return view; }

  const used = block.steps.find(s => s.name === "used")?.values ?? {};
  const row = (label: string, sub: string, g: number): RaftRow & { g: number | null } => {
    const unit = unitOf(g), a = actual(used[label], unit);
    return { label, sub, target: fmtMass(g), actual: a.text, field: { key: label, unit }, g: a.g };
  };
  const mon = t.monomers.map(m => row(m.name, `monomer · ${fmtMmol(m.mol)}`, m.g));
  const cta = row(l.cta, `CTA · ${fmtMmol(t.cta.mol)}`, t.cta.g);
  const solvent = row(l.solvent, "solvent", t.solventG);
  const co = l.cosolvent && t.cosolventG !== null ? row(l.cosolvent, `co-solvent · ${trimZeros(String(setup.cosolventPct ?? 0))} % of the ${lowerFirst(l.solvent)}`, t.cosolventG) : null;
  const init = row(l.initiator, `initiator · ${fmtMmol(t.initiator.mol)}`, t.initiator.g);

  const all = [...mon, cta, ...(co ? [solvent, co] : [solvent]), init];
  const weighedN = all.filter(r => r.actual !== "").length;
  view.rows = all.map(({ g: _g, ...r }) => r);
  view.status = weighedN === all.length ? TEXT.done : TEXT.weighed(weighedN, all.length);

  const names = l.monomers.map(m => m.name);
  const solventText = co ? `${lowerFirst(l.solvent)} + ${lowerFirst(l.cosolvent)} (${trimZeros(String(setup.cosolventPct ?? 0))} % of the ${lowerFirst(l.solvent)})` : lowerFirst(l.solvent);
  view.title = block.setup.title?.trim() || `RAFT: P(${names.join("-co-")}), DP ${trimZeros(String(setup.dp))}`;
  view.summary = [`${names.join(", ")} ${summaryMass(setup.massG)}`, `DP ${trimZeros(String(setup.dp))}`, l.cta, `CTA : initiator ${trimZeros(String(setup.ratio))}`,
    `${trimZeros(String(setup.solidsPct))} % solids in ${solventText}`, `Mn ${fmtMn(t.mn, 2)}`].join(" · ");

  const w: RaftWeighed = { monomers: mon.map(r => r.g ?? undefined), cta: cta.g ?? undefined, initiator: init.g ?? undefined, solvent: solvent.g ?? undefined };
  if ([...mon, cta, init, solvent].some(r => r.g !== null)) {
    const e = raftFromWeighed(setup, t, w);
    view.estimate = { mn: fmtMn(e.mn, 0), range: `(DP ${e.dp.toFixed(1)} · solids ${e.solidsPct.toFixed(2)} %)` };
  }
  view.worked = workedOut(setup, t).slice(2).map(x => x.replace(/^# /, ""));
  return view;
}

/** The Actual cells in the order they are drawn. */
export function cellsOf(view: RaftView): { field: UsedField; value: string }[] {
  return view.rows.map(r => ({ field: r.field, value: r.actual }));
}
