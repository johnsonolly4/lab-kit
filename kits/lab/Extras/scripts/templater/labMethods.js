/* =====================================================================
   labMethods: analysis methods and machines (Templater user script)
   ---------------------------------------------------------------------
   Used by labSnippets.js. Setup: same Templater "User script functions"
   folder as labForm.js.

     const M = tp.user.labMethods();
     const methods = M.loadMethods(app, "Methods", notePath);

   NMR, GPC and DLS are built in. A note in the Methods folder (Settings →
   Lab Kit → Methods folder) adds a method, or replaces a built-in one with
   the same name. Properties of a method note (case and spacing ignored):

     Columns          list: "Name" | "Name: default" | "Name: =formula" | "Name: {n}"
                      {Other column} inside a formula = that column's cell in the row,
                      {n} = row number. The first column holds the sample code
     Sample column    name of the column that holds the code (default: the first)
     Results          columns that go into Combined results
     Machines         list of links to machine notes
     Default machine  one of them (default: the first)
     Title, Icon, Tag, Checklist (list), Dataset folder (true / false)

   A machine note's property with the same name as a column sets that
   column's default (Eluent, Solvent, Temp, Calibrant…).
   ===================================================================== */

/** Compare names ignoring case, spacing, "_" and "-". */
const norm = (s) => String(s ?? "").toLowerCase().replace(/[\s_-]+/g, " ").trim();

/** A → 0 column letter helper (0 → A, 25 → Z, 26 → AA). */
const letter = (i) => { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

/** The value of a frontmatter property, name matched with norm(); undefined when absent. */
function prop(fm, name) {
  const want = norm(name);
  const key = Object.keys(fm ?? {}).find(k => norm(k) === want);
  return key === undefined ? undefined : fm[key];
}

/** A property as a flat list of non-empty values (a lone value becomes a one-item list; a string splits on line breaks only). */
function toItems(v) {
  if (v == null || v === "") return [];
  const items = Array.isArray(v) ? v.flat(Infinity) : typeof v === "string" ? v.split("\n") : [v];
  return items.filter(x => x != null && String(x).trim() !== "");
}

const truthy = (v) => v === true || /^(true|yes|1)$/i.test(String(v ?? "").trim());

/** Keys the snippet forms already use: a method or column with one of these gets "_" added. */
const RESERVED = new Set(["codes", "count", "times", "unit", "letters", "start", "results", "machine", "dataset",
  "samples", "sample", "sampling", "column", "rt"]);
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const safeKey = (s, fallback) => { const k = slug(s) || fallback; return RESERVED.has(k) ? k + "_" : k; };

const DEFAULT_CHECKLIST = ["Submitted", "Results processed", "Results saved"];

/** One column from a Columns item: "Name", "Name: default", "Name: =formula", "Name: {n}", or the object YAML makes of an unquoted "Name: default". */
function parseColumn(item, index) {
  let name, rest = null;
  if (item !== null && typeof item === "object" && !Array.isArray(item)) {
    const [k, v] = Object.entries(item)[0] ?? [];
    name = String(k ?? "").trim();
    // an unquoted "Run #: {n}" reaches us as { n: null }
    rest = v !== null && typeof v === "object" ? ("n" in v ? "{n}" : "") : v == null ? "" : String(v).trim();
  } else {
    const s = String(item).trim(), at = s.indexOf(":");
    name = (at < 0 ? s : s.slice(0, at)).trim();
    if (at >= 0) rest = s.slice(at + 1).trim();
  }
  if (!name) return null;
  const col = { name, key: safeKey(name, `c${index}`), label: null, def: null, formula: null, auto: false };
  if (rest === "{n}") col.auto = true;
  else if (rest !== null && rest.startsWith("=")) col.formula = rest;
  else if (rest !== null) col.def = rest;
  return col;
}

/** A method from a note's name and properties; null when it has no usable Columns. Machines are filled in by loadMethods. */
function parseMethod(basename, fm) {
  const seen = new Set();
  const columns = toItems(prop(fm, "Columns")).map(parseColumn).filter(c => c && !seen.has(c.key) && seen.add(c.key));
  if (!columns.length) return null;
  const find = (name) => columns.findIndex(c => norm(c.name) === norm(name));
  const sampleAt = find(String(prop(fm, "Sample column") ?? ""));
  const results = toItems(prop(fm, "Results")).map(r => columns[find(String(r))]?.name).filter(Boolean);
  const checklist = prop(fm, "Checklist");
  const str = (name, dflt) => String(prop(fm, name) ?? "").trim() || dflt;
  return {
    key: safeKey(basename, "method"), name: basename, title: str("Title", `${basename} samples`),
    icon: str("Icon", "microscope"), tag: str("Tag", basename.replace(/\s+/g, "-")),
    columns, sampleIdx: sampleAt < 0 ? 0 : sampleAt, results,
    checklist: checklist === undefined ? DEFAULT_CHECKLIST.slice() : toItems(checklist).map(String),
    dataset: truthy(prop(fm, "Dataset folder")),
    machineRefs: toItems(prop(fm, "Machines")).map(String), defaultMachineRef: String(prop(fm, "Default machine") ?? "").trim(),
    machines: [], defaultMachine: "", builtin: false, resultsLabel: null, resultsDefault: false,
  };
}

/** NMR, GPC and DLS exactly as they were before methods became notes. */
function builtins() {
  const col = (name, extra = {}) => ({ name, key: safeKey(name, "c"), label: null, def: null, formula: null, auto: false, ...extra });
  const base = { icon: "", machines: [], defaultMachine: "", machineRefs: [], defaultMachineRef: "", builtin: true, dataset: false,
    checklist: DEFAULT_CHECKLIST.slice(), sampleIdx: 0, resultsDefault: false };
  return [
    { ...base, key: "nmr", name: "NMR", title: "NMR samples", icon: "magnet", tag: "NMR", dataset: true, sampleIdx: 1,
      columns: [col("Run #", { auto: true }), col("Sample"), col("Solvent", { key: "solvent", def: "CDCl3" }), col("Method", { key: "method", def: "1H" }),
        col("Conversion (%)"), col("Notes")],
      results: ["Conversion (%)"], resultsLabel: "NMR conversion", resultsDefault: true },
    { ...base, key: "gpc", name: "GPC", title: "GPC samples", icon: "line-chart", tag: "GPC",
      columns: [col("Sample"), col("Eluent", { key: "eluent", def: "THF" }), col("Mn (g/mol)"), col("Mw (g/mol)"),
        col("Đ", { formula: '=IFERROR({Mw (g/mol)}/{Mn (g/mol)}, "")' }), col("Notes")],
      results: ["Mn (g/mol)", "Mw (g/mol)", "Đ"], resultsLabel: "GPC Mn, Mw, Đ", resultsDefault: true },
    { ...base, key: "dls", name: "DLS", title: "DLS samples", icon: "sparkles", tag: "DLS",
      columns: [col("Sample"), col("Solvent", { key: "solvent", label: "Solvent / dispersant", def: "Water" }),
        col("Temp (°C)", { key: "temp", label: "Temperature (°C)", def: "25" }), col("Dh (nm)"), col("PDI"), col("Notes")],
      results: ["Dh (nm)", "PDI"], resultsLabel: "DLS Dh, PDI" },
  ];
}

/** Methods that have a snippet file of their own in the Alt+S menu. */
const BUILTIN_KEYS = ["nmr", "gpc", "dls"];

const plainLink = (s) => String(s).replace(/^\[\[|\]\]$/g, "").split("|")[0].trim();

/** All methods: the built-in three (replaced by a note of the same name) followed by the folder's other notes A–Z. Folder "" = built-ins only. */
function loadMethods(app, folder, fromPath = "") {
  const out = new Map(builtins().map(m => [m.key, m]));
  const path = String(folder ?? "").trim().replace(/^\/+|\/+$/g, "");
  const root = path ? app.vault.getFolderByPath(path) : null;
  const walk = (children) => {
    for (const c of children ?? []) {
      if (Array.isArray(c.children)) { walk(c.children); continue; }
      if (c.extension !== "md") continue;
      const m = parseMethod(c.basename, app.metadataCache.getFileCache(c)?.frontmatter ?? {});
      if (!m) continue;
      const names = new Set();
      for (const ref of m.machineRefs) {
        const dest = app.metadataCache.getFirstLinkpathDest(plainLink(ref), c.path ?? fromPath);
        const name = dest?.basename ?? plainLink(ref);
        if (!name || names.has(norm(name))) continue;
        names.add(norm(name));
        m.machines.push({ name, fm: dest ? app.metadataCache.getFileCache(dest)?.frontmatter ?? {} : {} });
      }
      const want = norm(plainLink(m.defaultMachineRef));
      m.defaultMachine = (m.machines.find(x => norm(x.name) === want) ?? m.machines[0])?.name ?? "";
      m.resultsLabel = `${m.name} ${m.results.join(", ")}`;
      out.set(m.key, m);
    }
  };
  if (root) walk(root.children);
  const first = BUILTIN_KEYS;
  const rest = [...out.values()].filter(m => !first.includes(m.key));
  rest.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  return [...first.map(k => out.get(k)), ...rest];
}

/** Alt+S menu entries for the methods that have no snippet file (the folder's other notes): { key, name, icon, desc }. Reads the Methods folder from the plugin settings. */
async function menuEntries(app) {
  let folder = "";
  try { folder = JSON.parse(await app.vault.adapter.read(`${app.vault.configDir ?? ".obsidian"}/plugins/lab-kit/data.json`))?.kit?.methodsFolder ?? ""; } catch (e) { /* no settings yet */ }
  return loadMethods(app, folder).filter(m => !BUILTIN_KEYS.includes(m.key)).map(m => ({
    key: m.key, name: m.title, icon: m.icon,
    desc: `Sample table for ${m.name}` + (m.machines.length ? ` · ${m.machines.map(x => x.name).join(", ")}` : ""),
  }));
}

/** What a machine note says about a column: its property named like the column, or undefined. */
function machineValue(machineFm, columnName) {
  const v = prop(machineFm, columnName);
  if (v === undefined) return undefined;
  return v == null ? "" : Array.isArray(v) ? v.flat(Infinity).join(", ") : String(v).trim();
}

/** The column's default with this machine (undefined machine = the method's own default; null = no default, so no form field). */
function columnDefault(column, machineFm) {
  return machineValue(machineFm, column.name) ?? column.def;
}

/** Columns of a method's table: a Machine column after the sample column when the method has machines. */
function planColumns(method) {
  const cols = method.columns.map((c, i) => ({ ...c, sample: i === method.sampleIdx, machine: false }));
  const at = cols.findIndex(c => norm(c.name) === "machine");
  if (at >= 0) cols[at].machine = true;
  else if (method.machines.length) cols.splice(method.sampleIdx + 1, 0, { name: "Machine", key: "machine", label: null, def: null, formula: null, auto: false, sample: false, machine: true });
  return { cols, header: cols.map(c => c.name), sampleIdx: cols.findIndex(c => c.sample) };
}

/** Table rows: the sample code, auto numbers, formulas with {Column} → cell of this row, defaults (values wins), machine cell. No codes = three empty rows. */
function buildRows(plan, codes, { values = {}, machineCell = "", machineFm } = {}) {
  const sub = (f, r) => f.replace(/\{([^{}]+)\}/g, (all, nm) => { const i = plan.cols.findIndex(c => norm(c.name) === norm(nm)); return i < 0 ? all : letter(i) + r; });
  return (codes.length ? codes : ["", "", ""]).map((code, i) => plan.cols.map(c =>
    c.machine ? machineCell : c.sample ? code : c.auto ? String(i + 1) : c.formula != null ? sub(c.formula, i + 2)
      : String(values[c.key] ?? columnDefault(c, machineFm) ?? "")));
}

module.exports = function labMethods() {
  return { loadMethods, menuEntries, planColumns, buildRows, columnDefault, parseMethod, builtins, letter, norm };
};
Object.assign(module.exports, { loadMethods, menuEntries, planColumns, buildRows, columnDefault, parseMethod, builtins, letter, norm, machineValue });
