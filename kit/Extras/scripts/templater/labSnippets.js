/* =====================================================================
   labSnippets: builds every Alt+S snippet (Templater user script)
   ---------------------------------------------------------------------
   Each file in Templates/Snippets calls:
       tR += await tp.user.labSnippets(tp, "solution")
   Keys: solution, recipe, raft, matrix, samples, timetable, nmr, gpc,
         dls, results, column, rt, blank

   Needs labForm.js in the same folder. Settings are read from
   Extras/scripts/lab-config.json (initials).
   ===================================================================== */

const F = "```";
const CONFIG = "Extras/scripts/lab-config.json";

module.exports = async function labSnippets(tp, key) {
  /* ---------- helpers ---------- */
  const form = (title, fields, opts) => tp.user.labForm(tp, title, fields, opts);
  const list = (s) => String(s ?? "").split(/[,\n]/).map(x => x.trim()).filter(Boolean);
  const letter = (i) => { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const file = tp.config.target_file;
  const noteText = () => app.workspace.activeEditor?.editor?.getValue() ?? "";

  let initials = "XX";
  try { initials = JSON.parse(await app.vault.adapter.read(CONFIG)).initials || initials; } catch (e) {}
  const num = (file?.basename ?? tp.file.title).match(/^\d+/)?.[0] ?? "XXXX";
  const prefix = `${initials}${num}-`;

  /** Chemical names from this note's Chemicals property. */
  const chemicals = () => {
    const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    const raw = fm.Chemicals ?? fm.chemicals ?? [];
    return (Array.isArray(raw) ? raw : [raw]).map(x => String(x).replace(/^\[\[|\]\]$/g, "").split("|")[0].trim()).filter(Boolean);
  };
  /** Wrap in [[ ]] when a note with that name exists, so MW() and links work. */
  const link = (name) => {
    const n = String(name).replace(/^\[\[|\]\]$/g, "").trim();
    return app.metadataCache.getFirstLinkpathDest(n, file?.path ?? "") ? `[[${n}]]` : n;
  };
  const plain = (name) => String(name).replace(/^\[\[|\]\]$/g, "").split("|")[0].trim();
  /** Table names must be unique within the note: nmr, nmr2, nmr3… */
  const taken = new Set();
  const unique = (base) => {
    const text = noteText();
    const exists = (n) => taken.has(n) || new RegExp(`^\\s*(?:>\\s*)*name:\\s*${n}\\s*$`, "mi").test(text);
    let n = base, k = 2;
    while (exists(n)) n = `${base}${k++}`;
    taken.add(n);
    return n;
  };
  /** Every calc table in the note, in order: { name (lower case), rows } where each row is its list of cells (header row first). */
  const calcTables = () => {
    const rx = new RegExp("^[ \\t>]*" + F + "calc[ \\t]*\\n([\\s\\S]*?)\\n[ \\t>]*" + F + "[ \\t]*$", "gim");
    const text = noteText();
    const out = []; let m;
    while ((m = rx.exec(text))) {
      const lines = m[1].split("\n").map(l => l.replace(/^[ \t>]*/, ""));
      const name = lines.map(l => l.match(/^name:\s*(.+?)\s*$/i)).find(Boolean)?.[1].toLowerCase() ?? "";
      const rows = lines.filter(l => l.startsWith("|") && !/^[\s|:\-]+$/.test(l)).map(l => l.split("|").slice(1, -1).map(c => c.trim()));
      out.push({ name, rows });
    }
    return out;
  };
  /** Tables called base, base2, base3… (a table may have been deleted or copied, so any number can exist). A base ending in "s" also matches the singular: samples → sample, sample2. */
  const tablesNamed = (base) => {
    const rx = new RegExp(`^${base.replace(/s$/, "s?")}\\d*$`, "i");
    return calcTables().filter(t => rx.test(t.name));
  };
  /** Codes from the first column of the note's tables: the first name in the list that has any, taken from all of its numbered copies. */
  const codesFrom = (names) => {
    for (const nm of names) {
      const codes = [...new Set(tablesNamed(nm).flatMap(t => t.rows.slice(1).map(r => r[0]).filter(Boolean)))];
      if (codes.length) return codes;
    }
    return [];
  };
  /** Number of body rows in the calc table with exactly this name, or 0. */
  const tableRows = (name) => {
    const t = calcTables().find(x => x.name === String(name).toLowerCase());
    return t ? Math.max(0, t.rows.length - 1) : 0;
  };
  /** The nmr / gpc / dls tables in the note (nmr, nmr2…) with their sample counts, for the results table to read. */
  const techTables = (base) => tablesNamed(base).map(t => ({ id: t.name, n: t.rows.length - 1 })).filter(t => t.n > 0);
  /** Add technique tags (NMR, GPC, DLS) to the note's tags property, after the snippet is inserted. */
  const tag = (...tags) => {
    if (!file || !tags.length) return;
    setTimeout(() => app.fileManager.processFrontMatter(file, (fm) => {
      const cur = fm.tags == null ? [] : Array.isArray(fm.tags) ? fm.tags : String(fm.tags).split(/[,\s]+/);
      fm.tags = [...new Set([...cur.filter(Boolean), ...tags])];
    }).catch(() => {}), 800);
  };
  const calc = (opts, header, rows) => {
    const o = Object.entries(opts).filter(([, v]) => v != null && v !== "").map(([k, v]) => `${k}: ${v}`).join("\n");
    return `${F}calc\n${o}\n| ${header.join(" | ")} |\n|${header.map(() => "---").join("|")}|\n${rows.map(r => "| " + r.join(" | ") + " |").join("\n")}\n${F}\n`;
  };

  /* ---------- technique tables (shared by several snippets) ---------- */
  const nmrTable = (codes, { solvent = "CDCl3", method = "1H", dataset = `Monty_${tp.date.now("YYYY_MM_DD")}` } = {}) => {
    const id = unique("nmr");
    const rows = (codes.length ? codes : ["", "", ""]).map((c, i) => [i + 1, c, solvent, method, "", ""]);
    return { id, n: rows.length, md: `## NMR samples
${calc({ name: id, title: "NMR samples", icon: "magnet", copy: "column B" }, ["Run #", "Sample", "Solvent", "Method", "Conversion (%)", "Notes"], rows)}
Dataset: ${dataset}

- [ ] Submitted
- [ ] Results processed
- [ ] Results saved
` };
  };
  const gpcTable = (codes, { eluent = "THF" } = {}) => {
    const id = unique("gpc");
    const rows = (codes.length ? codes : ["", "", ""]).map((c, i) => [c, eluent, "", "", `=IFERROR(D${i + 2}/C${i + 2}, "")`, ""]);
    return { id, n: rows.length, md: `## GPC samples
${calc({ name: id, title: "GPC samples", icon: "line-chart", copy: "column A" }, ["Sample", "Eluent", "Mn (g/mol)", "Mw (g/mol)", "Đ", "Notes"], rows)}
- [ ] Submitted
- [ ] Results processed
- [ ] Results saved
` };
  };
  const dlsTable = (codes, { solvent = "Water", temp = "25" } = {}) => {
    const id = unique("dls");
    const rows = (codes.length ? codes : ["", "", ""]).map(c => [c, solvent, temp, "", "", ""]);
    return { id, n: rows.length, md: `## DLS samples
${calc({ name: id, title: "DLS samples", icon: "sparkles", copy: "column A" }, ["Sample", "Solvent", "Temp (°C)", "Dh (nm)", "PDI", "Notes"], rows)}
- [ ] Submitted
- [ ] Results processed
- [ ] Results saved
` };
  };
  /** One row per sample, pulling values from the NMR/GPC/DLS tables by sample code. */
  const resultsTable = (codes, links) => {
    const id = unique("results");
    const header = ["Sample"]; const cols = [];
    // One XLOOKUP per table of that technique; a code missing from the first is looked up in the next (nmr, then nmr2…)
    const look = (tables, col, rngCol) => (r) => "=" + tables.reduceRight(
      (rest, t) => `XLOOKUP(A${r}, ${t.id}!${rngCol}$2:${rngCol}$${t.n + 1}, ${t.id}!${col}$2:${col}$${t.n + 1}, ${rest})`, '""');
    const linked = (l) => l.tables?.length > 0;
    if (links.nmr) { header.push("Conversion (%)"); cols.push(linked(links.nmr) ? look(links.nmr.tables, "E", "B") : () => ""); }
    if (links.gpc) { header.push("Mn (g/mol)", "Mw (g/mol)", "Đ");
      cols.push(...["C", "D", "E"].map(c => linked(links.gpc) ? look(links.gpc.tables, c, "A") : () => "")); }
    if (links.dls) { header.push("Dh (nm)", "PDI");
      cols.push(...["D", "E"].map(c => linked(links.dls) ? look(links.dls.tables, c, "A") : () => "")); }
    const rows = (codes.length ? codes : ["", "", ""]).map((c, i) => [c, ...cols.map(f => f(i + 2))]);
    return `## Results
${calc({ name: id, title: "Results by sample", icon: "table" }, header, rows)}`;
  };
  const techToggles = [
    { type: "heading", label: "Also add" },
    { key: "nmr", label: "NMR sample list", type: "toggle", value: false },
    { key: "gpc", label: "GPC sample list", type: "toggle", value: false },
    { key: "dls", label: "DLS sample list", type: "toggle", value: false },
    { key: "results", label: "Combined results table", hint: "one row per sample with NMR / GPC / DLS values", type: "toggle", value: false },
  ];
  const addTechniques = (v, codes) => {
    let out = ""; const links = {}; const tags = [];
    if (v.nmr) { const t = nmrTable(codes); out += "\n" + t.md; links.nmr = { tables: [t] }; tags.push("NMR"); }
    if (v.gpc) { const t = gpcTable(codes); out += "\n" + t.md; links.gpc = { tables: [t] }; tags.push("GPC"); }
    if (v.dls) { const t = dlsTable(codes); out += "\n" + t.md; links.dls = { tables: [t] }; tags.push("DLS"); }
    if (v.results) out += "\n" + resultsTable(codes, links.nmr || links.gpc || links.dls ? links : { nmr: {}, gpc: {}, dls: {} });
    tag(...tags);
    return out;
  };

  /* ---------- snippets ---------- */
  const S = {
    async solution() {
      const v = await form("Solution prep", [
        { key: "label", label: "Solution name", value: "Solution 1" },
        { key: "reagents", label: "Reagents", hint: "comma separated · defaults to this note's Chemicals", value: chemicals().join(", ") || "PABTC, Benzyl alcohol, DCM" },
      ]);
      if (!v || !list(v.reagents).length) return "";
      const reagents = list(v.reagents).map(link);
      const id = unique(v.label.match(/(\d+)\s*$/) ? "sol" + v.label.match(/(\d+)\s*$/)[1] : v.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "sol");
      const last = reagents.length + 1;
      const rows = reagents.map((r, i) => {
        const n = i + 2;
        return [r, `=MW(A${n})`, "", "", `=IF(D${n}="", "", D${n}/B${n}*1000)`, `=IFERROR(D${n}/SUM(D$2:D$${last})*100, "")`];
      });
      rows.push(["**Total**", "", `=SUM(C2:C${last})`, `=SUM(D2:D${last})`, "", ""]);
      return `## ${v.label}
Made on: ${tp.date.now("YYYY-MM-DD")}

${calc({ name: id, title: v.label, icon: "test-tube" }, ["Reagent", "MW (g/mol)", "Target (g)", "Added (g)", "mmol (added)", "wt% (added)"], rows)}
`;
    },

    async recipe() {
      const chem = chemicals();
      const v = await form("Recipe by equivalents", [
        { key: "reagents", label: "Reagents", hint: "comma separated · the first is the reference", value: chem.filter(c => !/dcm|thf|toluene|water|methanol|ethanol|acetonitrile|dmf|dmso/i.test(c)).join(", ") || "Acid, Alcohol" },
        { key: "solvent", label: "Solvent (makes up the rest)", hint: "leave blank for none", value: chem.find(c => /dcm|thf|toluene|water|methanol|ethanol|acetonitrile|dmf|dmso/i.test(c)) ?? "" },
        { key: "mmol", label: "Amount of the first reagent (mmol)", value: "" },
        { key: "total", label: "Total mass (g)", hint: "needed for the solvent row and wt%", value: "" },
      ], { intro: "Each row's amount = Eq. × the reagent named in 'Relative to'. Type a 'Set mmol' on any row to fix it directly." });
      if (!v || !list(v.reagents).length) return "";
      const id = unique("recipe");
      const reagents = list(v.reagents).map(link);
      const k = reagents.length, last = k + 1;
      const solvRow = v.solvent ? k + 2 : null;
      const totalRow = (solvRow ?? last) + 1;
      const allEnd = solvRow ?? last;
      const rows = reagents.map((r, i) => {
        const n = i + 2;
        return [r, i === 0 ? "1" : "1", i === 0 ? "" : plain(reagents[0]), `=MW(A${n})`, i === 0 ? (v.mmol ?? "") : "",
          `=IF(E${n}<>"", E${n}, XLOOKUP(C${n}, A$2:A$${last}, F$2:F$${last})*B${n})`, `=F${n}*D${n}/1000`, "", `=IFERROR(G${n}/G$${totalRow}*100, "")`];
      });
      if (solvRow) rows.push([`${link(v.solvent)} (rest)`, "", "", "", "", "", `=IF(G${totalRow}="", 1/0, G${totalRow}-SUM(G2:G${last}))`, "", `=IFERROR(G${solvRow}/G$${totalRow}*100, "")`]);
      rows.push(["**Total**", "", "", "", "", "", solvRow ? (v.total ?? "") : `=SUM(G2:G${last})`, `=SUM(H2:H${allEnd})`, ""]);
      return `## Recipe
${calc({ name: id, title: "Recipe by equivalents", icon: "flask-round" }, ["Reagent", "Eq.", "Relative to", "MW (g/mol)", "Set mmol", "mmol", "Mass (g)", "Added (g)", "wt%"], rows)}
`;
    },

    async raft() {
      const v = await form("RAFT recipe generator", [
        { key: "monomers", label: "Monomer(s)", hint: "comma separated", value: "DMA" },
        { key: "cta", label: "CTA / macro-CTA", value: "PABTC" },
        { key: "init", label: "Initiator", value: "VA-044" },
        { key: "solvent", label: "Solvent", value: "Water" },
        { key: "mass", label: "Total monomer mass (g)", value: "" },
        { key: "dp", label: "Target DP", value: "" },
        { key: "ratio", label: "CTA : initiator", value: "20" },
        { key: "solids", label: "Solids (% w/w)", value: "20" },
      ]);
      if (!v || !list(v.monomers).length) return "";
      const id = unique("raft"), R = unique(`${id}_r`);
      const monomers = list(v.monomers).map(link);
      const k = monomers.length, mLast = k + 1, ctaRow = k + 2, initRow = k + 3;
      const frac = k === 1 ? "1" : String(+(1 / k).toFixed(3));
      const rows = monomers.map((m, i) => { const r = i + 2; return ["Monomer", m, `=MW(B${r})`, frac, `=${id}!$B$6*D${r}`, `=E${r}*C${r}`, ""]; });
      rows.push(["CTA", link(v.cta), `=MW(B${ctaRow})`, "", `=${id}!B6/${id}!B3`, `=E${ctaRow}*C${ctaRow}`, ""]);
      rows.push(["Initiator", link(v.init), `=MW(B${initRow})`, "", `=E${ctaRow}/${id}!B4`, `=E${initRow}*C${initRow}`, ""]);
      rows.push(["Solvent", link(v.solvent), "", "", "", `=SUM(F2:F${initRow})*(100/${id}!B5-1)`, ""]);
      return `## RAFT recipe generator
${calc({ name: id, title: "Targets", icon: "flask-conical" }, ["Parameter", "Value"], [
  ["Total monomer mass (g)", v.mass], ["Target DP", v.dp], ["CTA : initiator", v.ratio], ["Solids (% w/w)", v.solids],
  ["Total monomer (mol)", `=IF(B2="", 1/0, B2/SUMPRODUCT(${R}!C2:C${mLast}, ${R}!D2:D${mLast}))`],
  ["Theoretical Mn (g/mol)", `=IF(B3="", 1/0, B3*SUMPRODUCT(${R}!C2:C${mLast}, ${R}!D2:D${mLast})+${R}!C${ctaRow})`]])}
${calc({ name: R, title: "Reagents", icon: "flask-conical" }, ["Role", "Name", "MW (g/mol)", "Mol fraction", "mol", "Mass (g)", "Used (g)"], rows)}
> [!tip] A CTA or macro-CTA without a chemical note: click its MW cell and type the number.
`;
    },

    async matrix() {
      const v = await form("Variant naming matrix", [
        { key: "rows", label: "Row items", hint: "e.g. acids, comma separated", value: "Lipoic acid, Acetic acid" },
        { key: "cols", label: "Column items", hint: "e.g. alcohols, comma separated", value: "Benzyl alcohol, Methanol" },
      ]);
      if (!v || !list(v.rows).length) return "";
      const rows = list(v.rows), cols = list(v.cols);
      let n = 0;
      const body = cols.length
        ? rows.map(r => [`**${r}**`, ...cols.map(() => prefix + letter(n++))])
        : rows.map(r => [`**${r}**`, prefix + letter(n++)]);
      return `## Variant naming matrix
${calc({ name: unique("variants"), title: "Variant naming matrix", icon: "grid-3x3", copy: "list" }, ["", ...(cols.length ? cols : ["Code"])], body)}
`;
    },

    async samples() {
      const v = await form("Sample list", [
        { key: "codes", label: "Sample codes", type: "textarea", hint: "one per line or comma separated · leave blank to generate", value: "" },
        { key: "count", label: "…or generate this many", type: "number", value: "6" },
        ...techToggles,
      ]);
      if (!v) return "";
      let codes = list(v.codes);
      if (!codes.length) codes = Array.from({ length: Math.max(1, parseInt(v.count, 10) || 1) }, (_, i) => prefix + letter(i));
      return `## Samples
${calc({ name: unique("samples"), title: "Samples", icon: "list", copy: "column A" }, ["Code", "Description", "Notes"], codes.map(c => [c, "", ""]))}${addTechniques(v, codes)}`;
    },

    async timetable() {
      const v = await form("Sampling timetable", [
        { key: "times", label: "Time points", hint: "comma separated", value: "0, 30, 60, 120" },
        { key: "unit", label: "Time unit", hint: "min or h", value: "min" },
        { key: "letters", label: "Sample letters", hint: "comma separated · blank = one sample", value: "A" },
        { key: "start", label: "Start time (hh:mm)", hint: "blank = fill in on the day", value: "" },
        ...techToggles,
      ]);
      if (!v || !list(v.times).length) return "";
      const id = unique("sampling"), st = unique(`${id}_start`);
      const hours = /^h/i.test(v.unit);
      const letters = list(v.letters).length ? list(v.letters) : [""];
      const codes = [], rows = [];
      for (const L of letters) for (const t of list(v.times)) {
        const r = rows.length + 2, code = `${prefix}${L}${t}`;
        codes.push(code);
        rows.push([code, t, `=CLOCK(${st}!$B$2, B${r}${hours ? "*60" : ""})`, "", ""]);
      }
      return `## Sampling timetable
${calc({ name: st, title: "Start", icon: "timer" }, ["Setting", "Value"], [["Start time (hh:mm)", v.start ?? ""]])}
${calc({ name: id, title: "Sampling timetable", icon: "timer", copy: "column A" }, ["Code", `Time (${v.unit || "min"})`, "Target time", "Taken at", "Notes"], rows)}${addTechniques(v, codes)}`;
    },

    async nmr() {
      const v = await form("NMR samples", [
        { key: "codes", label: "Sample codes", type: "textarea", hint: "blank = codes from this note's sample list or timetable", value: codesFrom(["samples", "sampling"]).join(", ") },
        { key: "solvent", label: "Solvent", value: "CDCl3" },
        { key: "method", label: "Method", value: "1H" },
        { key: "dataset", label: "Dataset / folder", value: `Monty_${tp.date.now("YYYY_MM_DD")}` },
      ]);
      if (!v) return "";
      tag("NMR");
      return nmrTable(list(v.codes), v).md;
    },

    async gpc() {
      const v = await form("GPC samples", [
        { key: "codes", label: "Sample codes", type: "textarea", hint: "blank = codes from this note's sample list or timetable", value: codesFrom(["samples", "sampling"]).join(", ") },
        { key: "eluent", label: "Eluent", value: "THF" },
      ]);
      if (!v) return "";
      tag("GPC");
      return gpcTable(list(v.codes), v).md;
    },

    async dls() {
      const v = await form("DLS samples", [
        { key: "codes", label: "Sample codes", type: "textarea", hint: "blank = codes from this note's sample list or timetable", value: codesFrom(["samples", "sampling"]).join(", ") },
        { key: "solvent", label: "Solvent / dispersant", value: "Water" },
        { key: "temp", label: "Temperature (°C)", value: "25" },
      ]);
      if (!v) return "";
      tag("DLS");
      return dlsTable(list(v.codes), v).md;
    },

    async results() {
      const tech = { nmr: techTables("nmr"), gpc: techTables("gpc"), dls: techTables("dls") };
      const has = (n) => tech[n].length > 0;
      const hint = (n) => has(n) ? `linked to the ${tech[n].map(t => t.id).join(", ")} table${tech[n].length > 1 ? "s" : ""}` : "typed in";
      const v = await form("Combined results table", [
        { key: "codes", label: "Sample codes", type: "textarea", hint: "defaults to this note's sample list or timetable", value: codesFrom(["samples", "sampling", "nmr", "gpc", "dls"]).join(", ") },
        { type: "heading", label: "Columns" },
        { key: "nmr", label: "NMR conversion", hint: hint("nmr"), type: "toggle", value: true },
        { key: "gpc", label: "GPC Mn, Mw, Đ", hint: hint("gpc"), type: "toggle", value: true },
        { key: "dls", label: "DLS Dh, PDI", hint: hint("dls"), type: "toggle", value: has("dls") },
      ]);
      if (!v) return "";
      const links = {};
      for (const t of ["nmr", "gpc", "dls"]) if (v[t]) links[t] = has(t) ? { tables: tech[t] } : {};
      return resultsTable(list(v.codes), links);
    },

    async column() {
      const v = await form("Flow column prep", [
        { key: "id", label: "Table id", hint: "other tables use e.g. column!B10 for the reactor volume", value: "column" },
        { key: "density", label: "Solvent density (g/mL)", hint: "blank = fill in later", value: "" },
        { key: "dead", label: "End-fitting dead volume (mL)", value: "0.21" },
      ]);
      if (!v) return "";
      return `## Column prep
${calc({ name: unique(v.id || "column"), title: "Column weighing", icon: "cylinder" }, ["State", "Value"], [
  ["Empty column (blanking plugs, glass wool) (g)", ""], ["Packed column (beads, plugs, glass wool) (g)", ""],
  ["Packed + full of solvent (g)", ""], ["Solvent density (g/mL)", v.density ?? ""], ["End-fitting dead volume (mL)", v.dead ?? ""],
  ["Mass of beads (g)", "=B3-B2"], ["Mass of solvent (g)", "=B4-B3"], ["Solvent volume (mL)", "=B8/B5"], ["Reactor volume (mL)", "=B9-B6"]])}`;
    },

    async rt() {
      const hasColumn = tableRows("column") > 0;
      const v = await form("Residence times", [
        { key: "volume", label: "Reactor volume (mL)", hint: hasColumn ? "linked to this note's column table; type a number to override" : "type the volume, or link it like =column!B10", value: hasColumn ? "=column!B10" : "" },
        { key: "rts", label: "Target residence times (min)", hint: "comma separated", value: "2, 10, 20, 30" },
        { key: "flows", label: "Flow rates to check (mL/min)", hint: "optional, comma separated", value: "" },
      ]);
      if (!v || !list(v.rts).length) return "";
      const inp = unique("rt_in"), id = unique("rt");
      let out = `## Residence times
$$\\tau = \\frac{V_{\\text{reactor}}}{Q}$$

${calc({ name: inp, title: "Reactor", icon: "waves" }, ["Setting", "Value"], [["Reactor volume (mL)", v.volume ?? ""]])}
${calc({ name: id, title: "Flow rate for each residence time", icon: "waves" }, ["Residence time (min)", "Flow rate (mL/min)", "Time to steady state, 3 RTs (min)"],
  list(v.rts).map((t, i) => [t, `=${inp}!$B$2/A${i + 2}`, `=A${i + 2}*3`]))}`;
      if (list(v.flows).length) out += `
${calc({ name: unique("rt_check"), title: "Residence time for each flow rate", icon: "waves" }, ["Flow rate (mL/min)", "Residence time (min)"],
  list(v.flows).map((q, i) => [q, `=${inp}!$B$2/A${i + 2}`]))}`;
      return out;
    },

    async blank() {
      const v = await form("Blank calc table", [
        { key: "cols", label: "Column headings", hint: "comma separated", value: "Item, Value, Result" },
        { key: "rows", label: "Rows", type: "number", value: "3" },
        { key: "id", label: "Table id", hint: "used in formulas from other tables", value: "calc1" },
      ]);
      if (!v || !list(v.cols).length) return "";
      const cols = list(v.cols);
      return calc({ name: unique(v.id || "calc1"), icon: "calculator" }, cols, Array.from({ length: parseInt(v.rows, 10) || 3 }, () => cols.map(() => "")));
    },
  };

  if (!tp.user?.labForm) {
    new Notice("Lab snippets need Templater → User script functions folder = Extras/scripts/templater");
    return "";
  }
  if (!S[key]) { new Notice(`Unknown snippet "${key}"`); return ""; }
  const md = await S[key]();
  return md ? md + "\n" : "";
};
