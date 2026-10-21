// Named formulas of a block definition: checked, then evaluated by the calc engine. Pure (no Obsidian runtime), no user code.
// Plan: docs/plans/custom-live-blocks.md, Phase C2. Limits: CQ6 a (§5 "Stability rules").
import { ERR, SUPPORTED_FUNCTIONS, evaluate, indexToCol, parseFormula, type Node, type Value } from "../../calc/engine";

export const LIMITS = { values: 200, formulaChars: 300, depth: 32 };

/** Functions that take a list (e.g. `monomers.mw`) as an argument. */
export const LIST_FUNCTIONS = ["SUM", "SUMPRODUCT", "AVERAGE", "MIN", "MAX", "COUNT"];
const TABLE_FUNCTIONS = ["XLOOKUP", "INDEX", "PROP", "MW"];
const REFUSED_FUNCTIONS = [...TABLE_FUNCTIONS, "CLOCK"];
const ALLOWED_FUNCTIONS = new Set(SUPPORTED_FUNCTIONS.filter(f => !REFUSED_FUNCTIONS.includes(f)));
const BUILT_IN_NAMES = ["PI", "TRUE", "FALSE"];
const CELL_LIKE = /^\$?[A-Za-z]{1,3}\$?\d+$/;
const VALUE_NAME = /^[A-Za-z_]\w*$/;

export type Checked = { node: Node } | { problem: string };

const cellName = (n: Extract<Node, { t: "ref" }>): string => `${indexToCol(n.c)}${n.r + 1}`.toLowerCase();

function depthOf(n: Node): number {
  switch (n.t) {
    case "fn": return 1 + Math.max(0, ...n.args.map(depthOf));
    case "neg": case "pct": return 1 + depthOf(n.a);
    case "bin": return 1 + Math.max(depthOf(n.a), depthOf(n.b));
    default: return 0;
  }
}

/** Names a formula reads (upper case, once each), for the dependency graph. Built-in PI / TRUE / FALSE are not names. */
export function names(node: Node): string[] {
  const out = new Set<string>();
  const walk = (n: Node): void => {
    switch (n.t) {
      case "const": if (!BUILT_IN_NAMES.includes(n.name)) out.add(n.name); break;
      case "fn": n.args.forEach(walk); break;
      case "neg": case "pct": walk(n.a); break;
      case "bin": walk(n.a); walk(n.b); break;
    }
  };
  walk(node);
  return [...out];
}

/** Parses a formula and refuses what a definition may not use. `lists` = upper-case names of lists, allowed only as a direct argument of SUM, SUMPRODUCT, AVERAGE, MIN, MAX, COUNT. */
export function checkFormula(src: string, lists: ReadonlySet<string> = new Set()): Checked {
  if (src.length > LIMITS.formulaChars) return { problem: `The formula is longer than ${LIMITS.formulaChars} characters; split it into two named values.` };
  let node: Node;
  try { node = parseFormula(src.replace(/^\s*=/, "")); }
  catch (e) { return { problem: `The formula cannot be read: ${(e as Error).message}.` }; }
  if (depthOf(node) > LIMITS.depth) return { problem: `The formula is nested more than ${LIMITS.depth} levels deep; split it into two named values.` };
  const problem = refusal(node, lists, false);
  return problem ? { problem } : { node };
}

function refusal(n: Node, lists: ReadonlySet<string>, listOk: boolean): string | null {
  switch (n.t) {
    case "ref":
      return n.block === null ? `"${cellName(n)}" looks like a cell. Names must not look like a cell (such as dp1): rename it, e.g. dp_1.`
        : `"${n.block}!${cellName(n)}" is a cell of another table. A definition cannot read the note's tables.`;
    case "range": return "A range of cells cannot be used. A definition cannot read the note's tables.";
    case "rel": return "A cell reference such as (-1c-0r) cannot be used. A definition cannot read the note's tables.";
    case "const":
      if (lists.has(n.name) && !listOk) return `"${n.name.toLowerCase()}" is a list. Use it only inside ${LIST_FUNCTIONS.join(", ")}.`;
      return null;
    case "fn": {
      if (TABLE_FUNCTIONS.includes(n.name)) return `${n.name} cannot be used in a definition. Look-ups go through "lookup:" on a row.`;
      if (n.name === "CLOCK") return "CLOCK cannot be used in a definition; it works on times in a table.";
      if (!ALLOWED_FUNCTIONS.has(n.name)) return `${n.name} is not a calc function. Allowed: ${[...ALLOWED_FUNCTIONS].join(", ")}.`;
      const direct = LIST_FUNCTIONS.includes(n.name);
      for (const a of n.args) { const p = refusal(a, lists, direct); if (p) return p; }
      return null;
    }
    case "neg": case "pct": return refusal(n.a, lists, false);
    case "bin": return refusal(n.a, lists, false) ?? refusal(n.b, lists, false);
    default: return null;
  }
}

/** Problems of a set of named values (name → formula), one sentence each; empty = fine. `answers` = names that are already taken (answer keys, row ids), `lists` = the upper-case names of lists. */
export function checkValues(values: Record<string, string>, answers: readonly string[] = [], lists: ReadonlySet<string> = new Set()): string[] {
  const problems: string[] = [];
  const keys = Object.keys(values);
  if (keys.length > LIMITS.values) problems.push(`A definition may have ${LIMITS.values} named values at most; this one has ${keys.length}.`);
  const taken = new Set(answers.map(a => a.toUpperCase()));
  const nodes = new Map<string, Node>();
  for (const k of keys) {
    const up = k.toUpperCase();
    if (!VALUE_NAME.test(k)) problems.push(`"${k}" is not a name: use letters, digits and _, starting with a letter.`);
    else if (CELL_LIKE.test(k)) problems.push(`"${k}" looks like a cell. Names must not look like a cell (such as dp1): rename it, e.g. dp_1.`);
    else if (BUILT_IN_NAMES.includes(up)) problems.push(`"${k}" is a built-in name; use another.`);
    else if (taken.has(up)) problems.push(`"${k}" is already used as an answer or row name.`);
    const c = checkFormula(values[k], lists);
    if ("problem" in c) problems.push(`${k}: ${c.problem}`); else nodes.set(up, c.node);
  }
  const state = new Map<string, 1 | 2>();
  const visit = (k: string, path: string[]): void => {
    if (state.get(k) === 2) return;
    if (state.get(k) === 1) { problems.push(`${[...path.slice(path.indexOf(k)), k].join(" → ").toLowerCase()} refer to each other in a circle.`); return; }
    state.set(k, 1);
    for (const d of names(nodes.get(k)!)) if (nodes.has(d)) visit(d, [...path, k]);
    state.set(k, 2);
  };
  for (const k of nodes.keys()) visit(k, []);
  return problems;
}

/** Evaluates every named value once (memo). `base` = the answers and row values that are already known (an array is a list). A value that refers back to itself, or that fails its check, is an error value (#CIRC!, #ERROR!); an unknown name is #NAME?. Keys of the result are upper case. */
export function evalScope(values: Record<string, string>, base: Record<string, Value> = {}): Map<string, Value> {
  const out = new Map<string, Value>();
  const known = new Map<string, Value>(Object.entries(base).map(([k, v]) => [k.toUpperCase(), v]));
  const lists = new Set([...known].filter(([, v]) => Array.isArray(v)).map(([k]) => k));
  const formulas = new Map(Object.entries(values).map(([k, f]) => [k.toUpperCase(), f]));
  const tooMany = formulas.size > LIMITS.values;
  const running = new Set<string>();
  const nodes = new Map<string, Checked>();
  const get = (name: string): Value | undefined => {
    if (out.has(name)) return out.get(name);
    const f = formulas.get(name);
    if (f === undefined) return known.get(name);
    if (running.has(name)) return ERR("#CIRC!", `${name.toLowerCase()} refers to itself`);
    running.add(name);
    let c = nodes.get(name);
    if (!c) { c = tooMany ? { problem: `More than ${LIMITS.values} named values.` } : checkFormula(f, lists); nodes.set(name, c); }
    const v: Value = "problem" in c ? ERR("#ERROR!", c.problem) : evaluate(c.node, get);
    running.delete(name);
    out.set(name, v);
    return v;
  };
  for (const k of formulas.keys()) get(k);
  return out;
}
