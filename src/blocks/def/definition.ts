// Block definitions: the ```lk-definition block of a snippet file, read and checked. Pure (no Obsidian runtime): the YAML parser is passed in.
// Plan: docs/plans/custom-live-blocks.md, Target design §3 (the keys) and §5 (the checks), Phase C3. A definition with any problem is not used.
// Every problem is one sentence naming the key and its line in the definition block (line 1 = the first line after the ``` fence).
import type { Node } from "../../calc/engine";
import { checkFormula, circleProblem, circles, nameProblem, names } from "./formula";
import { LIMITS, rowsProblem, sizeProblem } from "./limits";

/** The definition language's version. A missing `format:` is a problem; a newer one is refused; every older one is read forever. */
export const DEFINITION_FORMAT = 1;
export const LAYOUTS = ["list", "table", "steps", "grouped"] as const;
export type Layout = typeof LAYOUTS[number];

/** The kinds of problem the reader finds; each has its own bad fixture in tests/fixtures/defs/ (`limit` is tested with generated text). */
export const CHECKS = [
  "yaml", "format-missing", "format-newer", "format-bad", "name", "key-unknown", "kind", "choice",
  "value-name", "formula", "function", "cell", "list", "circle", "name-unknown", "format-unknown",
  "each-unknown", "each-not-list", "row-id", "row-duplicate", "target-missing", "lookup", "token",
] as const;
export type Check = typeof CHECKS[number] | "limit";

export interface Problem { check: Check; key: string; line: number; text: string }

/** A question of the snippet header (`fields:`), as far as the definition needs it. */
export interface DefField { key: string; type: string; when?: string }

/** One display format: `mass`, `number: 0`, `unit: g/mol` … */
export interface Format { name: string; arg?: string | number | boolean }

export interface DefRow {
  id?: string; each?: string; role?: string; name?: string; when?: string;
  lookup: Record<string, string>; mol?: string; target: string; sub?: string; actual: "mass" | "none";
  hint?: string; help?: string;
}
export interface DefLive { when?: string; label: string; value: string; format: Format[]; hint?: string; help?: string }
export interface DefWorked { when?: string; each?: string; label?: string; text: string }

export interface Definition {
  format: number; name: string; layout: Layout; status: "weighed" | "none";
  title?: string; summary?: string;
  values: Record<string, string>;
  rows: DefRow[]; live: DefLive[]; worked: DefWorked[];
}

const TOP_KEYS = ["format", "name", "layout", "status", "title", "summary", "values", "rows", "live", "worked"];
const ROW_KEYS = ["id", "each", "role", "name", "when", "lookup", "mol", "target", "sub", "actual", "hint", "help"];
const LIVE_KEYS = ["when", "label", "value", "format", "hint", "help"];
const WORKED_KEYS = ["when", "each", "label", "text"];
/** What every row has, from outside as `<id>.<name>`. `actual` = the typed value, `amount` = actual, else target. */
const ROW_NAMES = ["mol", "target", "actual", "amount"];
/** What an item of a list answer has (`monomers.fraction`, or `fraction` inside its `each:` row). */
const ITEM_NAMES = ["fraction"];
const COUNT_NAMES = ["weighed", "rows"];
const FLAG_FORMATS = ["mass", "mass2", "mol", "mw", "group", "lower-first"];
const NUMBER_FORMATS = ["number", "sig", "percent"];
const FORMATS = [...FLAG_FORMATS, ...NUMBER_FORMATS, "unit"];
const DEF_NAME = /^[a-z][a-z0-9-]*$/;
/** The name a question has in formulas: upper case, `-` read as `_` (a stored line `monomer-mass` is `monomer_mass` in a formula). */
export const norm = (key: string): string => key.toUpperCase().replace(/-/g, "_");
const FORMULA_TOKEN = /\{\{=([^}]*)\}\}/g;

type Path = (string | number)[];
type Plain = Record<string, unknown>;
const isMap = (v: unknown): v is Plain => typeof v === "object" && v !== null && !Array.isArray(v);
const isScalar = (v: unknown): v is string | number | boolean => typeof v === "string" || typeof v === "number" || typeof v === "boolean";
/** A YAML value as the user wrote it, for a sentence. */
const shown = (v: unknown): string => isScalar(v) ? String(v) : JSON.stringify(v);

/** 1-based line of a key path in YAML block text (`["rows", 1, "target"]` = the second row's target), or of the nearest part of it that is found. */
export function lineOf(source: string, path: Path): number {
  const lines = source.split(/\r?\n/);
  const indent = (l: string): number => l.length - l.trimStart().length;
  const skip = (l: string): boolean => !l.trim() || l.trim().startsWith("#");
  const keyAt = (l: string): { col: number; key: string } | null => {
    const m = l.match(/^(\s*(?:-\s+)*)(["']?)([^\s"'#:-][^"':]*?)\2\s*:(?:\s|$)/);
    return m ? { col: m[1].length, key: m[3] } : null;
  };
  let from = 0, to = lines.length, parent = -1, at = 0;
  for (const step of path) {
    let found = -1, col = -1, seen = 0;
    for (let i = from; i < to && found < 0; i++) {
      if (skip(lines[i])) continue;
      if (typeof step === "number") {
        const m = lines[i].match(/^(\s*)-(?:\s|$)/);
        if (!m || m[1].length < parent) continue;
        if (col < 0) col = m[1].length;
        if (m[1].length === col && seen++ === step) found = i;
      } else {
        const k = keyAt(lines[i]);
        if (!k || k.col <= parent) continue;
        if (col < 0) col = k.col;
        if (k.col === col && k.key === step) found = i;
      }
    }
    if (found < 0) break;
    const listUnderKey = typeof step === "string";
    let end = found + 1;
    while (end < to && (skip(lines[end]) || indent(lines[end]) > col || (listUnderKey && indent(lines[end]) === col && /^\s*-(?:\s|$)/.test(lines[end])))) end++;
    at = found; from = found; to = end; parent = col;
  }
  return at + 1;
}

/** Display formats from a live line's `format:` (a name, or a map such as `{ number: 0, group: true, unit: g/mol }`) or a token's `| mass2 | unit: g`. */
function formatProblem(name: string, arg: unknown): string | null {
  if (!FORMATS.includes(name)) return `"${name}" is not a format. Use ${FORMATS.join(", ")}.`;
  if (FLAG_FORMATS.includes(name) && !(arg === undefined || arg === true || (name === "group" && arg === false)))
    return `the format "${name}" takes no number or text.`;
  if (NUMBER_FORMATS.includes(name) && !(Number.isInteger(Number(arg)) && Number(arg) >= 0 && Number(arg) <= 12 && arg !== "" && arg !== null && typeof arg !== "boolean"))
    return `the format "${name}" needs a whole number of places from 0 to 12, as "${name}: 2".`;
  if (name === "unit" && !(typeof arg === "string" && arg.trim())) return `the format "unit" needs a unit, as "unit: g/mol".`;
  return null;
}

/** Sorts a sentence from the formula check into its kind. */
function formulaCheck(problem: string): Check {
  if (/longer than|nested more than/.test(problem)) return "limit";
  if (/cell|range/i.test(problem)) return "cell";
  if (/cannot be used in a definition|not a calc function/.test(problem)) return "function";
  if (/is a list\. Use it only/.test(problem)) return "list";
  return "formula";
}

const where = (path: Path): string => {
  const [top, i, key, sub] = path;
  const item = (s: string): string => ({ rows: "row", live: "live line", worked: "worked line" } as Record<string, string>)[s] ?? s;
  if (top === "values" && typeof i === "string") return `value "${i}"`;
  if (typeof i !== "number") return `"${String(top)}"`;
  if (key === undefined) return `${item(String(top))} ${i + 1}`;
  if (sub !== undefined) return `"${String(sub)}" in "${String(key)}" of ${item(String(top))} ${i + 1}`;
  return `"${String(key)}" of ${item(String(top))} ${i + 1}`;
};

/** Reads and checks a definition. `fields` = the snippet header's questions. */
export function readDefinition(source: string, parseYaml: (yaml: string) => unknown, fields: readonly DefField[]): { def: Definition } | { problems: Problem[] } {
  const problems: Problem[] = [];
  const add = (check: Check, path: Path, text: string): void => {
    const line = lineOf(source, path);
    const key = String([...path].reverse().find(p => typeof p === "string") ?? "");
    problems.push({ check, key, line, text: `Line ${line}, ${path.length ? where(path) : "the definition"}: ${text.replace(/\.?$/, ".")}` });
  };
  const size = sizeProblem(source);
  if (size) { add("limit", [], size); return { problems }; }

  let raw: unknown;
  try { raw = parseYaml(source); }
  catch (e) {
    const err = e as { message?: string; mark?: { line?: number } };
    const line = typeof err.mark?.line === "number" ? err.mark.line + 1 : 1;
    const why = String(err.message ?? e).split("\n")[0].replace(/\s*\(\d+:\d+\)\s*$/, "");
    problems.push({ check: "yaml", key: "", line, text: `Line ${line}, the definition: cannot be read as YAML (${why}).` });
    return { problems };
  }
  if (!isMap(raw)) { add("yaml", [], "is not a list of key: value lines (format:, name:, layout:, rows: …)"); return { problems }; }

  // format first: a newer definition is not checked further (its keys may be ones this version does not know).
  const fmt = raw.format;
  if (fmt === undefined || fmt === null || fmt === "") { add("format-missing", [], `needs "format: ${DEFINITION_FORMAT}" as its first line`); return { problems }; }
  const fmtN = Number(fmt);
  if (typeof fmt === "boolean" || !Number.isInteger(fmtN) || fmtN < 1) { add("format-bad", ["format"], `"${shown(fmt)}" is not a format number; use format: ${DEFINITION_FORMAT}`); return { problems }; }
  if (fmtN > DEFINITION_FORMAT) { add("format-newer", ["format"], `made with a newer Lab Kit (format ${fmtN}): update the plugin`); return { problems }; }

  for (const k of Object.keys(raw)) if (!TOP_KEYS.includes(k)) add("key-unknown", [k], `"${k}" is not a definition key. Use ${TOP_KEYS.join(", ")}`);

  const text = (path: Path, v: unknown): string | undefined => {
    if (v === undefined || v === null) return undefined;
    if (typeof v === "string" || typeof v === "number") return String(v);
    add("kind", path, "must be one line of text");
    return undefined;
  };
  const formulaText = (path: Path, v: unknown): string | undefined => {
    if (v === undefined || v === null) return undefined;
    if (isScalar(v)) return String(v).replace(/^\s*=/, "");
    add("kind", path, "must be a formula on one line");
    return undefined;
  };
  const choice = <T extends string>(path: Path, v: unknown, options: readonly T[], fallback?: T): T | undefined => {
    if ((v === undefined || v === null) && fallback !== undefined) return fallback;
    if (typeof v === "string" && (options as readonly string[]).includes(v)) return v as T;
    add("choice", path, v === undefined || v === null ? `is missing: use one of ${options.join(", ")}` : `"${shown(v)}" is not one of ${options.join(", ")}`);
    return undefined;
  };
  const list = (key: string): Plain[] => {
    const v = raw[key];
    if (v === undefined || v === null) { if (key === "rows") add("kind", [], `needs "rows:", a list of rows`); return []; }
    if (!Array.isArray(v)) { add("kind", [key], `must be a list, one "- " item each`); return []; }
    return (v as unknown[]).filter((item, i): item is Plain => isMap(item) || (add("kind", [key, i], "must be key: value lines"), false));
  };
  const unknownKeys = (top: string, i: number, item: Plain, allowed: string[]): void => {
    for (const k of Object.keys(item)) if (!allowed.includes(k)) add("key-unknown", [top, i, k], `"${k}" is not a key here. Use ${allowed.join(", ")}`);
  };

  // name, layout, status, texts
  const name = text(["name"], raw.name);
  if (!name || !DEF_NAME.test(name)) add("name", ["name"], name ? `"${name}" is not a definition name: use small letters, digits and -, starting with a letter` : `is missing a name, e.g. "name: raft"`);
  const layout = choice(["layout"], raw.layout, LAYOUTS);
  const status = choice(["status"], raw.status, ["weighed", "none"] as const, "none");
  const title = text(["title"], raw.title), summary = text(["summary"], raw.summary);

  // answers and the names they give
  const answers = new Map(fields.map(f => [norm(f.key), f]));
  const listFields = new Set(fields.filter(f => f.type === "list").map(f => norm(f.key)));

  // values: names first, formulas later (rows give names values may read)
  const valuesRaw = raw.values;
  const values: Record<string, string> = {};
  if (valuesRaw !== undefined && valuesRaw !== null && !isMap(valuesRaw)) add("kind", ["values"], "must be name: formula lines");
  else if (isMap(valuesRaw)) {
    const n = Object.keys(valuesRaw).length;
    if (n > LIMITS.values) add("limit", ["values"], `A definition may have ${LIMITS.values} named values at most; this one has ${n}`);
    for (const [k, v] of Object.entries(valuesRaw)) {
      const bad = nameProblem(k, new Set(answers.keys()));
      if (bad) add("value-name", ["values", k], bad);
      const f = formulaText(["values", k], v);
      if (f !== undefined) values[k] = f;
    }
  }

  // rows
  const rowItems = list("rows");
  const rowsBad = rowsProblem(rowItems.length);
  if (rowsBad) add("limit", ["rows"], rowsBad);
  const rows: DefRow[] = [];
  const rowNames = new Map<string, number>();
  const itemNamesOf = new Map<string, string[]>();
  rowItems.forEach((item, i) => {
    unknownKeys("rows", i, item, ROW_KEYS);
    const at = (k: string): Path => ["rows", i, k];
    const id = text(at("id"), item.id), each = text(at("each"), item.each);
    if (each !== undefined) {
      if (!answers.has(norm(each))) add("each-unknown", at("each"), `"${each}" is not a question in the snippet's fields:`);
      else if (!listFields.has(norm(each))) add("each-not-list", at("each"), `"${each}" is not a list question (type: list), so a row cannot repeat over it`);
    }
    if (id !== undefined) {
      // a row may share its answer's name (`cta: "[[PDMA 76]]"` and the row `cta`, read as `cta.mw`), not a value's
      const bad = nameProblem(id, new Set(Object.keys(values).map(v => v.toUpperCase())));
      if (bad) add("row-id", at("id"), bad);
    } else if (each === undefined) add("row-id", ["rows", i], `needs "id:" (a name for the row) or "each:" (a list question)`);
    const rowName = (id !== undefined ? id.toUpperCase() : each !== undefined ? norm(each) : undefined);
    let first = false;
    if (rowName) {
      if (rowNames.has(rowName)) add("row-duplicate", at(id !== undefined ? "id" : "each"), `"${id ?? each}" is already row ${rowNames.get(rowName)! + 1}; each row needs its own name`);
      else { rowNames.set(rowName, i); first = true; }
    }
    const lookup: Record<string, string> = {};
    const lookupNames: string[] = [];
    if (item.lookup !== undefined && item.lookup !== null) {
      if (!isMap(item.lookup)) add("lookup", at("lookup"), `must be name: property lines, e.g. "lookup: { mw: MW }"`);
      else for (const [k, v] of Object.entries(item.lookup)) {
        const bad = nameProblem(k);
        if (bad) { add("lookup", ["rows", i, "lookup", k], bad); continue; }
        lookupNames.push(k);
        if (typeof v !== "string" || !v.trim()) add("lookup", ["rows", i, "lookup", k], `needs the chemical-note property to read, e.g. "${k}: MW"`);
        else lookup[k] = v.trim();
      }
    }
    const target = formulaText(at("target"), item.target);
    if (target === undefined && item.target === undefined) add("target-missing", ["rows", i], `needs "target:", the formula for the amount to weigh`);
    if (rowName && first) itemNamesOf.set(rowName, [...ROW_NAMES, ...lookupNames]);
    rows.push({
      id, each, role: text(at("role"), item.role), name: text(at("name"), item.name), when: formulaText(at("when"), item.when),
      lookup, mol: formulaText(at("mol"), item.mol), target: target ?? "", sub: text(at("sub"), item.sub),
      actual: choice(at("actual"), item.actual, ["mass", "none"] as const, "mass") ?? "mass",
      hint: text(at("hint"), item.hint), help: text(at("help"), item.help),
    });
  });

  // the names every formula may read
  const global = new Set<string>([...answers.keys(), ...Object.keys(values).map(v => v.toUpperCase()), ...COUNT_NAMES.map(c => c.toUpperCase())]);
  const lists = new Set<string>(listFields);
  for (const l of listFields) for (const n of ITEM_NAMES) { global.add(`${l}.${n.toUpperCase()}`); lists.add(`${l}.${n.toUpperCase()}`); }
  rows.forEach(r => {
    const rowName = (r.id !== undefined ? r.id.toUpperCase() : r.each !== undefined ? norm(r.each) : undefined);
    if (!rowName) return;
    for (const n of itemNamesOf.get(rowName) ?? []) {
      const full = `${rowName}.${n.toUpperCase()}`;
      global.add(full);
      if (!r.id && r.each) lists.add(full);
    }
  });
  /** Names inside a row (or a worked line / text that repeats over `each`): its own, without the row name. */
  const localOf = (rowName: string | undefined): Set<string> => {
    const out = new Set<string>();
    if (!rowName) return out;
    const up = norm(rowName);
    for (const n of itemNamesOf.get(up) ?? ROW_NAMES) out.add(n.toUpperCase());
    if (listFields.has(up)) for (const n of ITEM_NAMES) out.add(n.toUpperCase());
    return out;
  };

  const nodes = new Map<string, Node>();
  const formula = (path: Path, src: string | undefined, local: ReadonlySet<string> = new Set()): Node | null => {
    if (src === undefined) return null;
    const c = checkFormula(src, lists);
    if ("problem" in c) { add(formulaCheck(c.problem), path, c.problem); return null; }
    for (const n of names(c.node)) {
      if (global.has(n) || local.has(n)) continue;
      add("name-unknown", path, `"${n.toLowerCase()}" is not a question in the snippet's fields:, a value or a row name`);
      break;
    }
    return c.node;
  };
  const tokens = (path: Path, s: string | undefined, local: ReadonlySet<string> = new Set()): void => {
    if (s === undefined) return;
    const opens = s.split("{{=").length - 1;
    const closed = [...s.matchAll(FORMULA_TOKEN)];
    if (closed.length !== opens) { add("token", path, `a "{{=" has no closing "}}"`); return; }
    // inside {{#each list}} … {{/each}} the item's own names may be used
    const eachLocal = new Set(local);
    for (const m of s.matchAll(/\{\{#each\s+([A-Za-z_][\w-]*)/g)) for (const n of localOf(m[1])) eachLocal.add(n);
    for (const m of closed) {
      const [f, ...fmts] = m[1].split("|");
      if (!f.trim()) { add("token", path, `"{{=}}" needs a formula, as "{{= dp}}"`); continue; }
      formula(path, f.trim(), eachLocal);
      for (const part of fmts) {
        const i = part.indexOf(":");
        const fname = (i < 0 ? part : part.slice(0, i)).trim(), arg = i < 0 ? undefined : part.slice(i + 1).trim();
        const bad = formatProblem(fname, NUMBER_FORMATS.includes(fname) && arg !== undefined ? Number(arg) : arg);
        if (bad) add("format-unknown", path, bad);
      }
    }
  };

  for (const [k, f] of Object.entries(values)) { const n = formula(["values", k], f); if (n) nodes.set(k.toUpperCase(), n); }
  for (const c of circles(nodes)) add("circle", ["values", Object.keys(values).find(k => k.toUpperCase() === c[0]) ?? ""], circleProblem(c));
  tokens(["title"], title); tokens(["summary"], summary);
  rows.forEach((r, i) => {
    const local = localOf(r.id ?? r.each);
    formula(["rows", i, "when"], r.when, local); formula(["rows", i, "mol"], r.mol, local); formula(["rows", i, "target"], r.target || undefined, local);
    tokens(["rows", i, "name"], r.name, local); tokens(["rows", i, "sub"], r.sub, local);
  });

  // live lines
  const live: DefLive[] = [];
  list("live").forEach((item, i) => {
    unknownKeys("live", i, item, LIVE_KEYS);
    const at = (k: string): Path => ["live", i, k];
    const when = formulaText(at("when"), item.when), value = formulaText(at("value"), item.value), label = text(at("label"), item.label);
    if (value === undefined && item.value === undefined) add("kind", ["live", i], `needs "value:", the formula to show`);
    formula(at("when"), when); formula(at("value"), value); tokens(at("label"), label);
    const format: Format[] = [];
    const f = item.format;
    if (typeof f === "string") { const bad = formatProblem(f, undefined); if (bad) add("format-unknown", at("format"), bad); else format.push({ name: f }); }
    else if (isMap(f)) for (const [k, v] of Object.entries(f)) {
      const bad = formatProblem(k, v);
      if (bad) add("format-unknown", ["live", i, "format", k], bad); else format.push({ name: k, arg: v as Format["arg"] });
    }
    else if (f !== undefined && f !== null) add("format-unknown", at("format"), `must be a format name or format: value lines, e.g. "{ number: 0, unit: g/mol }"`);
    live.push({ when, label: label ?? "", value: value ?? "", format, hint: text(at("hint"), item.hint), help: text(at("help"), item.help) });
  });

  // worked lines
  const worked: DefWorked[] = [];
  list("worked").forEach((item, i) => {
    unknownKeys("worked", i, item, WORKED_KEYS);
    const at = (k: string): Path => ["worked", i, k];
    const when = formulaText(at("when"), item.when), each = text(at("each"), item.each), line = text(at("text"), item.text), label = text(at("label"), item.label);
    if (each !== undefined && !rowNames.has(norm(each))) add("each-unknown", at("each"), `"${each}" is not a row's "each:" or "id:"`);
    if (line === undefined && item.text === undefined) add("kind", ["worked", i], `needs "text:", the line to write`);
    if (each === undefined && label === undefined) add("kind", ["worked", i], `needs "label:" (the first column of its # line) or "each:" (one line per item)`);
    formula(at("when"), when); tokens(at("label"), label, localOf(each)); tokens(at("text"), line, localOf(each));
    worked.push({ when, each, label, text: line ?? "" });
  });

  if (problems.length || !name || !layout || !status) return { problems };
  return { def: { format: fmtN, name, layout, status, title, summary, values, rows, live, worked } };
}
