// Analysis methods as vault notes: NMR, GPC and DLS built in, the notes of the Methods folder added (or replacing a built-in of the same name),
// and the sample table each method gives. A port of the old labMethods.js and the method part of labSnippets.js (same output: tests/snippet-port.test.ts, tests/methods.test.ts).
//
// Properties of a method note (case and spacing ignored):
//   Columns          list: "Name" | "Name: default" | "Name: =formula" | "Name: {n}"
//                    {Other column} inside a formula = that column's cell in the row, {n} = row number. The first column holds the sample code
//   Sample column    name of the column that holds the code (default: the first)
//   Results          columns that go into Combined results
//   Machines         list of links to machine notes
//   Default machine  one of them (default: the first)
//   Title, Icon, Tag, Checklist (list), Dataset folder (true / false)
// A machine note's property with the same name as a column sets that column's default (Eluent, Solvent, Temp, Calibrant…).
import type { App } from "obsidian";
import type { SnippetRun } from "./common";
import { calc, letter, list, str } from "./util";

export interface Column { name: string; key: string; label: string | null; def: string | null; formula: string | null; auto: boolean }
export interface Machine { name: string; fm: Record<string, unknown> }
export interface Method {
  key: string; name: string; title: string; icon: string; tag: string; desc?: string; menuIcon?: string;
  columns: Column[]; sampleIdx: number; results: string[]; checklist: string[]; dataset: boolean;
  machineRefs: string[]; defaultMachineRef: string; machines: Machine[]; defaultMachine: string;
  builtin: boolean; resultsLabel: string | null; resultsDefault: boolean;
}
type Fm = Record<string, unknown>;

/** Compare names ignoring case, spacing, "_" and "-". */
export const norm = (s: unknown): string => str(s).toLowerCase().replace(/[\s_-]+/g, " ").trim();

/** The value of a frontmatter property, name matched with norm(); undefined when absent. */
function prop(fm: Fm | undefined, name: string): unknown {
  const want = norm(name);
  const key = Object.keys(fm ?? {}).find(k => norm(k) === want);
  return key === undefined ? undefined : fm![key];
}

/** A property as a flat list of non-empty values (a lone value becomes a one-item list; a string splits on line breaks only). */
function toItems(v: unknown): unknown[] {
  if (v == null || v === "") return [];
  const items = Array.isArray(v) ? v.flat(Infinity) : typeof v === "string" ? v.split("\n") : [v];
  return items.filter(x => x != null && (typeof x === "object" || str(x).trim() !== ""));
}

const truthy = (v: unknown): boolean => v === true || /^(true|yes|1)$/i.test(str(v).trim());

/** Keys the snippet forms already use: a method or column with one of these gets "_" added. */
const RESERVED = new Set(["codes", "count", "times", "unit", "letters", "start", "results", "machine", "dataset", "samples", "sample", "sampling", "column", "rt"]);
const slug = (s: unknown): string => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const safeKey = (s: unknown, fallback: string): string => { const k = slug(s) || fallback; return RESERVED.has(k) ? k + "_" : k; };

const DEFAULT_CHECKLIST = ["Submitted", "Results processed", "Results saved"];

/** One column from a Columns item: "Name", "Name: default", "Name: =formula", "Name: {n}", or the object YAML makes of an unquoted "Name: default". */
function parseColumn(item: unknown, index: number): Column | null {
  let name: string, rest: string | null = null;
  if (item !== null && typeof item === "object" && !Array.isArray(item)) {
    const first = Object.entries(item as Record<string, unknown>)[0];
    const k = first?.[0], v = first?.[1];
    name = (k ?? "").trim();
    // an unquoted "Run #: {n}" reaches us as { n: null }
    rest = v !== null && typeof v === "object" ? ("n" in v ? "{n}" : "") : v == null ? "" : str(v).trim();
  } else {
    const s = str(item).trim(), at = s.indexOf(":");
    name = (at < 0 ? s : s.slice(0, at)).trim();
    if (at >= 0) rest = s.slice(at + 1).trim();
  }
  if (!name) return null;
  const col: Column = { name, key: safeKey(name, `c${index}`), label: null, def: null, formula: null, auto: false };
  if (rest === "{n}") col.auto = true;
  else if (rest !== null && rest.startsWith("=")) col.formula = rest;
  else if (rest !== null) col.def = rest;
  return col;
}

/** A method from a note's name and properties; null when it has no usable Columns. Machines are filled in by loadMethods. */
export function parseMethod(basename: string, fm: Fm): Method | null {
  const seen = new Set<string>();
  const columns = toItems(prop(fm, "Columns")).map(parseColumn).filter((c): c is Column => !!c && !seen.has(c.key) && !!seen.add(c.key));
  if (!columns.length) return null;
  const find = (name: string): number => columns.findIndex(c => norm(c.name) === norm(name));
  const sampleAt = find(str(prop(fm, "Sample column")));
  const results = toItems(prop(fm, "Results")).map(r => columns[find(str(r))]?.name).filter((x): x is string => !!x);
  const checklist = prop(fm, "Checklist");
  const text = (name: string, dflt: string): string => str(prop(fm, name)).trim() || dflt;
  return {
    key: safeKey(basename, "method"), name: basename, title: text("Title", `${basename} samples`),
    icon: text("Icon", "microscope"), tag: text("Tag", basename.replace(/\s+/g, "-")),
    columns, sampleIdx: sampleAt < 0 ? 0 : sampleAt, results,
    checklist: checklist === undefined ? DEFAULT_CHECKLIST.slice() : toItems(checklist).map(str),
    dataset: truthy(prop(fm, "Dataset folder")),
    machineRefs: toItems(prop(fm, "Machines")).map(str), defaultMachineRef: str(prop(fm, "Default machine")).trim(),
    machines: [], defaultMachine: "", builtin: false, resultsLabel: null, resultsDefault: false,
  };
}

/** NMR, GPC and DLS exactly as they were before methods became notes. */
export function builtins(): Method[] {
  const col = (name: string, extra: Partial<Column> = {}): Column => ({ name, key: safeKey(name, "c"), label: null, def: null, formula: null, auto: false, ...extra });
  const base = { icon: "", machines: [], defaultMachine: "", machineRefs: [], defaultMachineRef: "", builtin: true, dataset: false,
    checklist: DEFAULT_CHECKLIST.slice(), sampleIdx: 0, resultsDefault: false };
  return [
    { ...base, key: "nmr", name: "NMR", title: "NMR samples", desc: "Sample / solvent / method / conversion, dataset, checklist · tags NMR", icon: "magnet", tag: "NMR", dataset: true, sampleIdx: 1,
      columns: [col("Run #", { auto: true }), col("Sample"), col("Solvent", { key: "solvent", def: "CDCl3" }), col("Method", { key: "method", def: "1H" }),
        col("Conversion (%)"), col("Notes")],
      results: ["Conversion (%)"], resultsLabel: "NMR conversion", resultsDefault: true },
    { ...base, key: "gpc", name: "GPC", title: "GPC samples", desc: "Sample / eluent / Mn / Mw / Đ, checklist · tags GPC", menuIcon: "line-chart, chart-line", icon: "line-chart", tag: "GPC",
      columns: [col("Sample"), col("Eluent", { key: "eluent", def: "THF" }), col("Mn (g/mol)"), col("Mw (g/mol)"),
        col("Đ", { formula: '=IFERROR({Mw (g/mol)}/{Mn (g/mol)}, "")' }), col("Notes")],
      results: ["Mn (g/mol)", "Mw (g/mol)", "Đ"], resultsLabel: "GPC Mn, Mw, Đ", resultsDefault: true },
    { ...base, key: "dls", name: "DLS", title: "DLS samples", desc: "Sample / solvent / temperature / Dh / PDI, checklist · tags DLS", icon: "sparkles", tag: "DLS",
      columns: [col("Sample"), col("Solvent", { key: "solvent", label: "Solvent / dispersant", def: "Water" }),
        col("Temp (°C)", { key: "temp", label: "Temperature (°C)", def: "25" }), col("Dh (nm)"), col("PDI"), col("Notes")],
      results: ["Dh (nm)", "PDI"], resultsLabel: "DLS Dh, PDI" },
  ];
}

/** Methods that have an entry of their own in the Alt+S menu. */
const BUILTIN_KEYS = ["nmr", "gpc", "dls"];

const plainLink = (s: unknown): string => str(s).replace(/^\[\[|\]\]$/g, "").split("|")[0].trim();

type Node = { children?: Node[]; extension?: string; basename: string; path?: string };
type CacheFile = Parameters<App["metadataCache"]["getFileCache"]>[0];
const fmOf = (app: App, f: unknown): Fm => app.metadataCache.getFileCache(f as CacheFile)?.frontmatter ?? {};

/** All methods: the built-in three (replaced by a note of the same name) followed by the folder's other notes A–Z. Folder "" = built-ins only. */
export function loadMethods(app: App, folder: string | undefined, fromPath = ""): Method[] {
  const out = new Map(builtins().map(m => [m.key, m]));
  const path = String(folder ?? "").trim().replace(/^\/+|\/+$/g, "");
  const root = (path ? app.vault.getFolderByPath(path) : null) as Node | null;
  const walk = (children: Node[] | undefined): void => {
    for (const c of children ?? []) {
      if (Array.isArray(c.children)) { walk(c.children); continue; }
      if (c.extension !== "md") continue;
      const m = parseMethod(c.basename, fmOf(app, c));
      if (!m) continue;
      const names = new Set<string>();
      for (const ref of m.machineRefs) {
        const dest = app.metadataCache.getFirstLinkpathDest(plainLink(ref), c.path ?? fromPath);
        const name = dest?.basename ?? plainLink(ref);
        if (!name || names.has(norm(name))) continue;
        names.add(norm(name));
        m.machines.push({ name, fm: dest ? fmOf(app, dest) : {} });
      }
      const want = norm(plainLink(m.defaultMachineRef));
      m.defaultMachine = (m.machines.find(x => norm(x.name) === want) ?? m.machines[0])?.name ?? "";
      m.resultsLabel = `${m.name} ${m.results.join(", ")}`;
      out.set(m.key, m);
    }
  };
  if (root) walk(root.children);
  const rest = [...out.values()].filter(m => !BUILTIN_KEYS.includes(m.key));
  rest.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  return [...BUILTIN_KEYS.map(k => out.get(k)!), ...rest];
}

/** Alt+S menu entries: { key, name, icon, desc }. The Methods folder's notes; with `builtins` NMR, GPC and DLS first (a note of the same name replaces one). */
export function menuEntries(app: App, methodsFolder: string, opts: { builtins?: boolean } = {}): { key: string; name: string; icon: string; desc: string }[] {
  return loadMethods(app, methodsFolder).filter(m => opts.builtins || !BUILTIN_KEYS.includes(m.key)).map(m => ({
    key: m.key, name: m.title, icon: m.menuIcon ?? m.icon,
    desc: m.builtin && m.desc ? m.desc : `Sample table for ${m.name}` + (m.machines.length ? ` · ${m.machines.map(x => x.name).join(", ")}` : ""),
  }));
}

/** What a machine note says about a column: its property named like the column, or undefined. */
export function machineValue(machineFm: Fm | undefined, columnName: string): string | undefined {
  const v = prop(machineFm, columnName);
  if (v === undefined) return undefined;
  return v == null ? "" : Array.isArray(v) ? v.flat(Infinity).join(", ") : str(v).trim();
}

/** The column's default with this machine (undefined machine = the method's own default; null = no default, so no form field). */
export function columnDefault(column: Column, machineFm?: Fm): string | null | undefined {
  return machineValue(machineFm, column.name) ?? column.def;
}

export interface PlanColumn extends Column { sample: boolean; machine: boolean }
/** Columns of a method's table: a Machine column after the sample column when the method has machines. */
export function planColumns(method: Method): { cols: PlanColumn[]; header: string[]; sampleIdx: number } {
  const cols: PlanColumn[] = method.columns.map((c, i) => ({ ...c, sample: i === method.sampleIdx, machine: false }));
  const at = cols.findIndex(c => norm(c.name) === "machine");
  if (at >= 0) cols[at].machine = true;
  else if (method.machines.length) cols.splice(method.sampleIdx + 1, 0, { name: "Machine", key: "machine", label: null, def: null, formula: null, auto: false, sample: false, machine: true });
  return { cols, header: cols.map(c => c.name), sampleIdx: cols.findIndex(c => c.sample) };
}

/** Table rows: the sample code, auto numbers, formulas with {Column} → cell of this row, defaults (values wins), machine cell. No codes = three empty rows. */
export function buildRows(plan: ReturnType<typeof planColumns>, codes: string[], { values = {}, machineCell = "", machineFm }: { values?: Record<string, unknown>; machineCell?: string; machineFm?: Fm } = {}): string[][] {
  const sub = (f: string, r: number): string => f.replace(/\{([^{}]+)\}/g, (all, nm: string) => { const i = plan.cols.findIndex(c => norm(c.name) === norm(nm)); return i < 0 ? all : letter(i) + r; });
  return (codes.length ? codes : ["", "", ""]).map((code, i) => plan.cols.map(c =>
    c.machine ? machineCell : c.sample ? code : c.auto ? String(i + 1) : c.formula != null ? sub(c.formula, i + 2)
      : str(values[c.key] ?? columnDefault(c, machineFm))));
}

const machineOf = (m: Method, name: unknown): Machine | undefined => m.machines.find(x => x.name === name);

/** One sample table for a method. machine = the picked machine or undefined; values = the form's answers by column key. */
export function methodTable(r: SnippetRun, m: Method, codes: string[], { machine, values = {} }: { machine?: Machine; values?: Record<string, unknown> } = {}): { id: string; n: number; header: string[]; md: string } {
  const id = r.unique(m.key);
  const plan = planColumns(m);
  const rows = buildRows(plan, codes, { values, machineCell: machine ? r.link(machine.name) : "", machineFm: machine?.fm });
  const copy = `column ${letter(plan.sampleIdx)}`;
  return { id, n: rows.length, header: plan.header, md: `## ${m.title}
${calc({ name: id, title: m.title, icon: m.icon, copy, codes: copy }, plan.header, rows)}
${m.dataset ? `Dataset: ${str(values.dataset)}\n\n` : ""}${m.checklist.map(c => `- [ ] ${c}\n`).join("")}` };
}

/** Columns with a default (from the method or any of its machines) get a field in the form. */
const fieldColumns = (m: Method): Column[] => m.columns.filter(c => !c.auto && c.formula == null && (c.def !== null || m.machines.some(x => columnDefault(c, x.fm) !== undefined && columnDefault(c, x.fm) !== null)));

async function methodForm(r: SnippetRun, m: Method): Promise<Record<string, unknown> | null> {
  const dm = machineOf(m, m.defaultMachine);
  const cf = r.codeField();
  const v = await r.form(m.title, [
    ...cf.fields,
    ...(m.machines.length ? [{ key: "machine", label: "Machine", type: "select", options: m.machines.map(x => ({ value: x.name, label: x.name })), value: m.defaultMachine }] : []),
    ...fieldColumns(m).map(c => ({ key: c.key, label: c.label ?? c.name, value: columnDefault(c, dm?.fm) ?? "",
      ...(m.machines.length ? { follows: { key: "machine", values: Object.fromEntries(m.machines.map(x => [x.name, columnDefault(c, x.fm) ?? ""])) } } : {}) })),
    ...(m.dataset ? [{ key: "dataset", label: "Dataset / folder", hint: "optional · can be filled in later", value: "", placeholder: `e.g. folder name of the ${m.name} data` }] : []),
  ]);
  if (v) v.codes = cf.resolve(v).join(", ");
  return v;
}

/** Ask for one method's table and build it. The boxes follow the picked machine in the form (`follows`), so the table gets what they show. */
export async function runMethod(r: SnippetRun, m: Method): Promise<string> {
  const v = await methodForm(r, m);
  if (!v) return "";
  const machine = machineOf(m, v.machine);
  r.tag(m.tag);
  return methodTable(r, m, list(v.codes), { machine, values: v }).md;
}
