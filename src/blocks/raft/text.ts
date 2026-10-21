// RAFT block text: what the window's boxes hold, the ```raft block they make, reading it back, and the one-line writes. Pure (no Obsidian runtime).
// The format and the one-line writer are the shared live-block core (../core.ts). Plan: docs/plans/templater-replacement-and-live-snippets.md, Phase 9;
// Q33 a (steps), Q36 a (the worked-out targets kept as `#` lines, rewritten only on insert / Edit set-up, never when an actual is typed).
// Format (`format: 1`): `monomers:` with one `"[[Name]]": fraction` line each, `cta:` `initiator:` `solvent:` as links, `cosolvent:` + `cosolvent-pct:` optional,
// `monomer-mass:` `DP:` `CTA-to-initiator:` `solids:`, then `used:` with one `Name: mass` line per reagent (empty until weighed), then the `#` lines.
import { blockRange, massToGrams, parseBlock, parseQuantity, setLine, writeInNote, type Block } from "../core";
import { reagentName } from "../../solution/view";
import { fmtMass, fmtMmol, fmtMw, trimZeros } from "./format";
import { raftTargets, type RaftSetup, type RaftTargets } from "./maths";

/** What the window's boxes hold, as typed. `monomers` is `DAAm, DMAm` or with a mole fraction after a colon: `DAAm: 0.7, DMAm: 0.3`. */
export interface RaftValues { monomers: string; cta: string; initiator: string; solvent: string; cosolvent: string; cosolventPct: string; mass: string; dp: string; ratio: string; solids: string }
export type RaftField = keyof RaftValues;

/** The window's starting values: the old generator's (CTA : initiator 20, solids 20 %, co-solvent 20 % of the solvent's mass). */
export const DEFAULT_RAFT: RaftValues = { monomers: "", cta: "", initiator: "", solvent: "", cosolvent: "", cosolventPct: "20", mass: "", dp: "", ratio: "20", solids: "20" };

/** The block's lines for each box, ready to write. */
export interface RaftLines {
  monomers: { name: string; fraction: string }[];
  cta: string; initiator: string; solvent: string; cosolvent: string; cosolventPct: string;
  mass: string; dp: string; ratio: string; solids: string;
}

/** Labels of the page's R-A summary and the window. New wording (BACKLOG "Questions for the owner"). */
export const RAFT_LABEL: Record<RaftField, string> = {
  monomers: "Monomer(s)", cta: "CTA / macro-CTA", initiator: "Initiator", solvent: "Solvent", cosolvent: "Co-solvent",
  cosolventPct: "Co-solvent (% of the solvent's mass)", mass: "Total monomer mass", dp: "Target DP", ratio: "CTA : initiator", solids: "Solids (% w/w)",
};
export const raftProblem = (f: RaftField): string => `${RAFT_LABEL[f]}: not a usable value.`;

/** The monomer boxes' text as names and fractions; a name with no number after a colon has fraction 1. null for an empty or unusable box. */
export function parseMonomers(text: string): { name: string; fraction: string }[] | null {
  const parts = text.split(",").map(s => s.trim()).filter(Boolean);
  if (!parts.length) return null;
  const out: { name: string; fraction: string }[] = [];
  for (const p of parts) {
    const i = p.lastIndexOf(":");
    const name = reagentName(i < 0 ? p : p.slice(0, i)), f = i < 0 ? "1" : p.slice(i + 1).trim();
    const q = parseQuantity(f);
    if (!name || !q || q.unit !== "" || !(q.value > 0)) return null;
    if (out.some(m => m.name.toLowerCase() === name.toLowerCase())) return null;
    out.push({ name, fraction: f });
  }
  return out;
}

/** One box as a positive number (a plain one), as typed. */
function plain(s: string): string | null {
  const q = parseQuantity(s);
  return q && q.unit === "" && q.value > 0 ? s.trim() : null;
}

/** The answers as block lines, or the first box that is not usable. */
export function raftLines(v: RaftValues): { lines: RaftLines } | { problem: string; field: RaftField } {
  const bad = (field: RaftField) => ({ problem: raftProblem(field), field });
  const monomers = parseMonomers(v.monomers);
  if (!monomers) return bad("monomers");
  const cta = reagentName(v.cta), initiator = reagentName(v.initiator), solvent = reagentName(v.solvent), cosolvent = reagentName(v.cosolvent);
  if (!cta) return bad("cta");
  if (!initiator) return bad("initiator");
  if (!solvent) return bad("solvent");
  const q = parseQuantity(v.mass);
  const g = q ? massToGrams({ value: q.value, unit: q.unit || "g" }) : null;
  if (!q || g === null || !(g > 0)) return bad("mass");
  const mass = `${v.mass.trim().replace(/\s*(kg|mg|ug|µg|g)\s*$/, "")} ${q.unit || "g"}`;
  const dp = plain(v.dp); if (dp === null) return bad("dp");
  const ratio = plain(v.ratio); if (ratio === null) return bad("ratio");
  const sq = parseQuantity(v.solids);
  if (!sq || (sq.unit !== "" && sq.unit !== "%") || !(sq.value > 0 && sq.value <= 100)) return bad("solids");
  const solids = `${v.solids.trim().replace(/\s*%\s*$/, "")} %`;
  let cosolventPct = "";
  if (cosolvent) {
    const cq = parseQuantity(v.cosolventPct);
    if (!cq || (cq.unit !== "" && cq.unit !== "%") || !(cq.value >= 0)) return bad("cosolventPct");
    cosolventPct = `${v.cosolventPct.trim().replace(/\s*%\s*$/, "")} %`;
  }
  return { lines: { monomers, cta, initiator, solvent, cosolvent, cosolventPct, mass, dp, ratio, solids } };
}

const link = (name: string): string => `"[[${name}]]"`;

/** The reagents in bench order (the keys of `used:`): monomers, CTA, solvent, co-solvent, initiator. */
export function usedNames(l: Pick<RaftLines, "monomers" | "cta" | "initiator" | "solvent" | "cosolvent">): string[] {
  return [...l.monomers.map(m => m.name), l.cta, l.solvent, ...(l.cosolvent ? [l.cosolvent] : []), l.initiator];
}

/** The block text between the fences: the set-up, empty `used:` lines, and the worked-out `#` lines when given. */
export function raftSource(l: RaftLines, worked: string[] = []): string {
  return [
    "format: 1",
    "monomers:", ...l.monomers.map(m => `  ${link(m.name)}: ${m.fraction}`),
    `cta: ${link(l.cta)}`, `initiator: ${link(l.initiator)}`, `solvent: ${link(l.solvent)}`,
    ...(l.cosolvent ? [`cosolvent: ${link(l.cosolvent)}`, `cosolvent-pct: ${l.cosolventPct}`] : []),
    `monomer-mass: ${l.mass}`, `DP: ${l.dp}`, `CTA-to-initiator: ${l.ratio}`, `solids: ${l.solids}`,
    "used:", ...usedNames(l).map(n => `  ${n}:`),
    ...worked,
  ].join("\n");
}

/** The block as inserted: fences included. */
export function raftBlock(l: RaftLines, worked: string[] = []): string {
  return "```raft\n" + raftSource(l, worked) + "\n```\n";
}

/** What the block says, as the boxes: the names without links, fractions only when they differ. */
export function valuesFromBlock(block: Block): RaftValues {
  const m = monomersOf(block);
  const equal = m.every(x => x.fraction === m[0]?.fraction);
  const su = block.setup;
  return {
    monomers: m.map(x => equal ? x.name : `${x.name}: ${x.fraction}`).join(", "),
    cta: reagentName(su.cta), initiator: reagentName(su.initiator), solvent: reagentName(su.solvent),
    cosolvent: reagentName(su.cosolvent), cosolventPct: su["cosolvent-pct"]?.replace(/\s*%$/, "") ?? DEFAULT_RAFT.cosolventPct,
    mass: su["monomer-mass"] ?? "", dp: su.DP ?? "", ratio: su["CTA-to-initiator"] ?? "", solids: su.solids?.replace(/\s*%$/, "") ?? "",
  };
}

/** The `monomers:` lines as names with their fractions as typed; a single `monomers: [[A]]` line counts as one monomer. */
export function monomersOf(block: Block): { key: string; name: string; fraction: string }[] {
  const sec = block.steps.find(s => s.name === "monomers");
  if (sec) return Object.entries(sec.values).map(([key, fraction]) => ({ key, name: reagentName(key), fraction: fraction || "1" })).filter(m => m.name);
  const one = reagentName(block.setup.monomers);
  return one ? [{ key: block.setup.monomers, name: one, fraction: "1" }] : [];
}

/** What a line of the block needs to change, from the boxes before and after (Edit set-up): only what differs. */
export type RaftOp = { set: [section: string | null, key: string, value: string] } | { remove: [section: string | null, key: string] };

export function raftChanges(before: RaftValues, after: RaftValues): RaftOp[] {
  const a = raftLines(after);
  if (!("lines" in a)) return [];
  const l = a.lines, ops: RaftOp[] = [];
  const changed = (f: RaftField): boolean => before[f].trim() !== after[f].trim();
  if (changed("monomers")) {
    const old = parseMonomers(before.monomers) ?? [];
    for (const o of old) if (!l.monomers.some(m => m.name === o.name)) ops.push({ remove: ["monomers", link(o.name)] });
    for (const m of l.monomers) ops.push({ set: ["monomers", link(m.name), m.fraction] });
  }
  const set = (f: RaftField, key: string, value: string): void => { if (changed(f)) ops.push({ set: [null, key, value] }); };
  set("cta", "cta", link(l.cta)); set("initiator", "initiator", link(l.initiator)); set("solvent", "solvent", link(l.solvent));
  set("mass", "monomer-mass", l.mass); set("dp", "DP", l.dp); set("ratio", "CTA-to-initiator", l.ratio); set("solids", "solids", l.solids);
  if (changed("cosolvent")) {
    if (l.cosolvent) ops.push({ set: [null, "cosolvent", link(l.cosolvent)] }, { set: [null, "cosolvent-pct", l.cosolventPct] });
    else ops.push({ remove: [null, "cosolvent"] }, { remove: [null, "cosolvent-pct"] });
  } else if (l.cosolvent && changed("cosolventPct")) ops.push({ set: [null, "cosolvent-pct", l.cosolventPct] });
  return ops;
}

/** Drops one line (the first with that key in that section); the text is otherwise untouched. A missing line changes nothing. */
export function removeLine(source: string, section: string | null, key: string): string {
  const lines = source.split("\n");
  let cur: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, "");
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const m = /^(\s*)([^\s:#][^:]*?)\s*:(?:\s+(.*?)|)\s*$/.exec(line);
    if (!m) continue;
    const top = m[1].length === 0;
    if (top && (m[3] ?? "") === "" && m[2] !== "format") { cur = m[2]; if (section === cur && key === cur) return lines.filter((_, j) => j !== i).join("\n"); continue; }
    if (top) cur = null;
    if (cur === section && m[2] === key) return lines.filter((_, j) => j !== i).join("\n");
  }
  return source;
}

/** Applies Edit set-up's changes to the block text. */
export function applyOps(source: string, ops: RaftOp[]): string {
  let s = source;
  for (const op of ops) s = "set" in op ? setLine(s, op.set[0], op.set[1], op.set[2]) : removeLine(s, op.remove[0], op.remove[1]);
  return s;
}

/** The `#` lines worked out by Lab Kit, for a block whose reagents all have a MW: the sums written out, one line per reagent, then Mn (Q36 a). */
export const WORKED_HEAD = "# worked out by Lab Kit, rewritten when the set-up changes";

/** The set-up with the names of the solvent and co-solvent, which the maths does not need. */
export interface RaftNamed extends RaftSetup { solvent: string; cosolvent?: string }

export function workedOut(s: RaftNamed, t: RaftTargets): string[] {
  const names = [...s.monomers.map(m => m.name), s.cta.name, s.initiator.name, s.solvent, ...(t.cosolventG === null ? [] : [s.cosolvent ?? ""]), "Mn"];
  const w = Math.max(...names.map(n => n.length)) + 2;
  const row = (name: string, text: string): string => `# ${name.padEnd(w)}${text}`;
  const mws = [...s.monomers, s.cta, s.initiator].map(r => `${r.name} ${fmtMw(r.mw)}`).join(", ");
  const out = [WORKED_HEAD, `# MW from the chemical notes: ${mws}`];
  const fSum = s.monomers.reduce((a, m) => a + m.fraction, 0);
  if (s.monomers.length === 1) {
    out.push(row(s.monomers[0].name, `${fmtMass(s.massG)} ÷ ${fmtMw(s.monomers[0].mw)} = ${fmtMmol(t.monomers[0].mol)}`));
  } else {
    const sum = s.monomers.map(m => `${fmtMw(m.mw)} × ${trimZeros(String(m.fraction))}`).join(" + ");
    out.push(row("Monomers", `mean MW = (${sum}) ÷ ${trimZeros(String(fSum))} = ${fmtMw(t.meanMw)}; ${fmtMass(s.massG)} ÷ ${fmtMw(t.meanMw)} = ${fmtMmol(t.nMonomer)}`));
    s.monomers.forEach((m, i) => out.push(row(m.name, `${fmtMmol(t.nMonomer).replace(" mmol", "")} × ${trimZeros(String(m.fraction))}/${trimZeros(String(fSum))} = ${fmtMmol(t.monomers[i].mol)} × ${fmtMw(m.mw)} = ${fmtMass(t.monomers[i].g)}`)));
  }
  const mmolM = fmtMmol(t.nMonomer).replace(" mmol", "");
  out.push(row(s.cta.name, `${mmolM} ÷ ${trimZeros(String(s.dp))} = ${fmtMmol(t.cta.mol)} × ${fmtMw(s.cta.mw)} = ${fmtMass(t.cta.g)}`));
  out.push(row(s.initiator.name, `${fmtMmol(t.cta.mol).replace(" mmol", "")} ÷ ${trimZeros(String(s.ratio))} = ${fmtMmol(t.initiator.mol)} × ${fmtMw(s.initiator.mw)} = ${fmtMass(t.initiator.g)}`));
  out.push(row(s.solvent, `${fmtMass(t.solidsG)} solids × (100 ÷ ${trimZeros(String(s.solidsPct))} − 1) = ${fmtMass(t.solventG)}`));
  if (t.cosolventG !== null) out.push(row(s.cosolvent ?? "", `${fmtMass(t.solventG)} × ${trimZeros(String(s.cosolventPct ?? 0))} % = ${fmtMass(t.cosolventG)}`));
  out.push(row("Mn", `${trimZeros(String(s.dp))} × ${fmtMw(t.meanMw)} + ${fmtMw(s.cta.mw)} = ${trimZeros(t.mn.toFixed(2))} g/mol`));
  return out;
}

/** The set-up the maths needs from block lines and a MW lookup; null when a name has no MW or a number is not usable. */
export function setupFromLines(l: RaftLines, mwOf: (name: string) => number | null): RaftNamed | null {
  const mw = (name: string): number | null => { const x = mwOf(name); return x !== null && Number.isFinite(x) && x > 0 ? x : null; };
  const monomers = l.monomers.map(m => ({ name: m.name, mw: mw(m.name), fraction: Number(m.fraction) }));
  const cta = mw(l.cta), initiator = mw(l.initiator);
  const q = parseQuantity(l.mass), g = q ? massToGrams(q) : null;
  if (monomers.some(m => m.mw === null) || cta === null || initiator === null || g === null) return null;
  return {
    monomers: monomers as RaftNamed["monomers"], cta: { name: l.cta, mw: cta }, initiator: { name: l.initiator, mw: initiator }, solvent: l.solvent,
    massG: g, dp: Number(l.dp), ratio: Number(l.ratio), solidsPct: parseQuantity(l.solids)!.value,
    ...(l.cosolvent ? { cosolvent: l.cosolvent, cosolventPct: parseQuantity(l.cosolventPct)!.value } : {}),
  };
}

/** The `#` lines for these lines and MW; empty when a MW is missing or a number is not usable (then none are written). */
export function workedFor(l: RaftLines, mwOf: (name: string) => number | null): string[] {
  const s = setupFromLines(l, mwOf), t = s && raftTargets(s);
  return s && t ? workedOut(s, t) : [];
}

/** The block text with its worked-out `#` lines replaced (the lines from the head line on that start with `#`), or appended when there are none. Hand comments elsewhere stay. */
export function replaceWorkedOut(source: string, worked: string[]): string {
  const lines = source.split("\n");
  const at = lines.findIndex(l => l.trim().startsWith("# worked out by Lab Kit"));
  if (at < 0) {
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    return [...lines, ...worked].join("\n");
  }
  let end = at + 1;
  while (end < lines.length && lines[end].trim().startsWith("#")) end++;
  lines.splice(at, end - at, ...worked);
  return lines.join("\n");
}

/** One typed actual into its own `used:` line, e.g. `writeUsed(note, 12, "DAAm", "2.5012 g")`. null when there is no such block or it is from a newer plugin. */
export function writeUsed(note: string, lineStart: number, name: string, value: string): string | null {
  return writeInNote(note, lineStart, "used", name, value);
}

/** Runs `fn` on the block text of the block that opens on `lineStart`; the note with the new text, or null when there is no such block or it is from a newer plugin. */
export function inBlock(note: string, lineStart: number, fn: (source: string) => string): string | null {
  const r = blockRange(note, lineStart);
  if (!r || parseBlock(r.source).newer) return null;
  const next = fn(r.source);
  const lines = note.split("\n");
  lines.splice(r.from, r.to - r.from, ...(next === "" ? [] : next.split("\n")));
  return lines.join("\n");
}
