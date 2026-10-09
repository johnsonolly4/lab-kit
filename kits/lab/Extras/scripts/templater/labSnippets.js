/* =====================================================================
   labSnippets: builds every Alt+S snippet (Templater user script)
   ---------------------------------------------------------------------
   Each file in the Snippets folder calls:
       tR += await tp.user.labSnippets(tp, "solution")
   Keys: solution, recipe, raft, nmr, gpc, dls, method, results
   (the simple snippets, matrix / samples / timetable / column / rt / blank, are token
   templates in the Snippets folder; the Lab Kit plugin fills them)

   Needs labForm.js and labMethods.js in the same folder.
   ===================================================================== */

const F = "```";

module.exports = async function labSnippets(tp, snippet) {
  /** "method:mass_spec" = the Analysis table of that method, without asking which (the Alt+S menu lists the Methods folder's notes like this). */
  const [key, arg] = String(snippet).split(":");
  /* ---------- helpers ---------- */
  const form = (title, fields, opts) => tp.user.labForm(tp, title, fields, opts);
  const list = (s) => String(s ?? "").split(/[,\n]/).map(x => x.trim()).filter(Boolean);
  const letter = (i) => { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const file = tp.config.target_file;
  const noteText = () => app.workspace.activeEditor?.editor?.getValue() ?? "";

  const readJson = async (path) => { try { return JSON.parse(await app.vault.adapter.read(path)); } catch (e) { return null; } };
  const kitData = (await readJson(`${app.vault.configDir ?? ".obsidian"}/plugins/lab-kit/data.json`))?.kit;

  /** The chemical notes (Settings → Lab Kit → Chemical folder) as { name, aliases, classes } for the forms' suggestions; undefined when no folder is set. */
  const chemList = () => {
    const path = String(kitData?.chemicalFolder ?? "").trim().replace(/^\/+|\/+$/g, "");
    const root = path ? app.vault.getFolderByPath(path) : null;
    if (!root) return undefined;
    const out = [];
    const walk = (children) => {
      for (const c of children ?? []) {
        if (Array.isArray(c.children)) walk(c.children);
        else if (c.extension === "md") {
          const fm = app.metadataCache.getFileCache(c)?.frontmatter ?? {};
          const key = Object.keys(fm).find(k => k.trim().toLowerCase() === "names");
          const raw = key === undefined ? [] : [fm[key]].flat(Infinity);
          const aliases = raw.filter(a => a != null && a !== "").map(a => String(a).trim()).filter(a => a && a.toLowerCase() !== c.basename.toLowerCase());
          const ckey = Object.keys(fm).find(k => k.replace(/\s+/g, " ").trim().toLowerCase() === "chemical class");
          const classes = ckey === undefined ? [] : [fm[ckey]].flat(Infinity).filter(a => a != null && a !== "").map(a => String(a).trim()).filter(Boolean);
          out.push({ name: c.basename, aliases, classes });
        }
      }
    };
    walk(root.children);
    return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  };
  const chemAll = chemList();
  const chems = chemAll?.map(({ name, aliases }) => ({ name, aliases }));
  /** The suggestions for a field that asks for Chemical classes (any text, never checked against a list; case-insensitive): those chemicals only (Settings → "Only suggest chemicals of the asked class") or first, then the rest. No class asked = all. src/kit/snippet-env.ts classFilter does the same for token templates. */
  const chemsFor = (...want) => {
    if (!chemAll || !want.length) return chems;
    const w = new Set(want.map(c => c.trim().toLowerCase()));
    const hit = (c) => c.classes.some(x => w.has(x.toLowerCase()));
    const plain = (list) => list.map(({ name, aliases }) => ({ name, aliases }));
    return kitData?.chemClassOnly === true ? plain(chemAll.filter(hit)) : plain([...chemAll.filter(hit), ...chemAll.filter(c => !hit(c))]);
  };
  /** NMR / GPC / DLS and the notes of the Methods folder (Settings → Lab Kit → Methods folder), see labMethods.js. */
  const M = tp.user?.labMethods?.();
  const methods = M ? M.loadMethods(app, kitData?.methodsFolder, file?.path ?? "") : [];
  /** Wrap in [[ ]] when a note with that name exists, so MW() and links work. */
  const link = (name) => {
    const n = String(name).replace(/^\[\[|\]\]$/g, "").trim();
    return app.metadataCache.getFirstLinkpathDest(n, file?.path ?? "") ? `[[${n}]]` : n;
  };
  const plain = (name) => String(name).replace(/^\[\[|\]\]$/g, "").split("|")[0].trim();
  /** A number from a property of the note called name (case and spacing ignored), or "" when there is no such note, property or number. */
  const noteNumber = (name, property) => {
    const note = app.metadataCache.getFirstLinkpathDest(plain(name), file?.path ?? "");
    const fm = note ? app.metadataCache.getFileCache(note)?.frontmatter ?? {} : {};
    const want = property.toLowerCase();
    const key = Object.keys(fm).find(k => k.trim().toLowerCase() === want);
    const n = key === undefined ? NaN : parseFloat(String(fm[key]).replace(",", "."));
    return isNaN(n) ? "" : String(n);
  };
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
  /** A method's tables in the note (nmr, nmr2…) with their sample counts and headers, for the results table to read. */
  const techTables = (base) => tablesNamed(base).map(t => ({ id: t.name, n: t.rows.length - 1, header: t.rows[0] ?? [] })).filter(t => t.n > 0);
  /** Add method tags (NMR, GPC, DLS…) to the note's tags property, after the snippet is inserted. */
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

  /* ---------- method tables (shared by several snippets) ---------- */
  const normName = (s) => String(s ?? "").toLowerCase().replace(/[\s_-]+/g, " ").trim();
  const machineOf = (m, name) => m.machines.find(x => x.name === name);
  /** One sample table for a method. machine = { name, fm } or undefined; values = the form's answers by column key. */
  const methodTable = (m, codes, { machine, values = {} } = {}) => {
    const id = unique(m.key);
    const plan = M.planColumns(m);
    const rows = M.buildRows(plan, codes, { values, machineCell: machine ? link(machine.name) : "", machineFm: machine?.fm });
    const copy = `column ${letter(plan.sampleIdx)}`;
    return { id, n: rows.length, header: plan.header, md: `## ${m.title}
${calc({ name: id, title: m.title, icon: m.icon, copy }, plan.header, rows)}
${m.dataset ? `Dataset: ${values.dataset ?? ""}\n\n` : ""}${m.checklist.map(c => `- [ ] ${c}\n`).join("")}` };
  };
  /** Columns with a default (from the method or any of its machines) get a field in the form. */
  const fieldColumns = (m) => m.columns.filter(c => !c.auto && c.formula == null && (c.def !== null || m.machines.some(x => M.columnDefault(c, x.fm) !== undefined && M.columnDefault(c, x.fm) !== null)));
  const methodForm = (m) => {
    const dm = machineOf(m, m.defaultMachine);
    return form(m.title, [
      { key: "codes", label: "Sample codes", type: "textarea", hint: "blank = codes from this note's sample list or timetable", value: codesFrom(["samples", "sampling"]).join(", ") },
      ...(m.machines.length ? [{ key: "machine", label: "Machine", type: "select", options: m.machines.map(x => ({ value: x.name, label: x.name })), value: m.defaultMachine }] : []),
      ...fieldColumns(m).map(c => ({ key: c.key, label: c.label ?? c.name, value: M.columnDefault(c, dm?.fm) ?? "" })),
      ...(m.dataset ? [{ key: "dataset", label: "Dataset / folder", hint: "optional · can be filled in later", value: "", placeholder: `e.g. folder name of the ${m.name} data` }] : []),
    ]);
  };
  /** Ask for one method's table and build it. A field left at the default machine's value follows the machine that was picked. */
  const runMethod = async (m, withResults = false) => {
    const v = await methodForm(m);
    if (!v) return "";
    const machine = machineOf(m, v.machine), dm = machineOf(m, m.defaultMachine);
    if (machine && dm && machine !== dm) for (const c of fieldColumns(m)) {
      if (v[c.key] === (M.columnDefault(c, dm.fm) ?? "")) v[c.key] = M.columnDefault(c, machine.fm) ?? "";
    }
    tag(m.tag);
    const codes = list(v.codes);
    const t = methodTable(m, codes, { machine, values: v });
    return withResults && m.results.length ? t.md + "\n" + resultsTable(codes, [{ method: m, tables: [t] }]) : t.md;
  };
  /** One row per sample, pulling values from the methods' tables by sample code. links = [{ method, tables }]; no tables = columns typed in. */
  const resultsTable = (codes, links) => {
    const id = unique("results");
    const header = ["Sample"]; const cols = [];
    const at = (t, name) => t.header.findIndex(h => normName(h) === normName(name));
    // One XLOOKUP per table of that method; a code missing from the first is looked up in the next (nmr, then nmr2…)
    const look = (tables, sample, name) => {
      const f = tables.reduceRight((rest, t) => {
        const s = at(t, sample), c = at(t, name);
        if (s < 0 || c < 0) return rest;
        const sl = letter(s), cl = letter(c);
        return `XLOOKUP(A$R, ${t.id}!${sl}$2:${sl}$${t.n + 1}, ${t.id}!${cl}$2:${cl}$${t.n + 1}, ${rest})`;
      }, '""');
      return f === '""' ? () => "" : (r) => "=" + f.replaceAll("A$R", `A${r}`);
    };
    for (const { method: m, tables } of links) {
      const sample = m.columns[m.sampleIdx].name;
      for (const name of m.results) { header.push(name); cols.push(tables?.length ? look(tables, sample, name) : () => ""); }
    }
    const rows = (codes.length ? codes : ["", "", ""]).map((c, i) => [c, ...cols.map(f => f(i + 2))]);
    return `## Results
${calc({ name: id, title: "Results by sample", icon: "table" }, header, rows)}`;
  };
  /* ---------- snippets ---------- */
  const S = {
    async solution() {
      const v = await form("Solution prep", [
        { key: "label", label: "Solution name", value: "Solution 1" },
        { key: "solutes", label: "Solutes", hint: "comma separated", value: "", placeholder: "e.g. solute 1, solute 2", suggest: chems },
        { key: "solvents", label: "Solvent(s)", hint: "optional · comma separated · several share the final volume equally", value: "", placeholder: "e.g. solvent name", suggest: chemsFor("solvent") },
        { key: "volume", label: "Final volume (mL)", hint: "blank = fill in later", value: "" },
        { key: "mode", label: "Targets", type: "select", options: [{ value: "each", label: "Each solute has its own target" }, { value: "total", label: "Total concentration split by a ratio" }], value: "each" },
        { key: "unit", label: "Target unit (own targets)", type: "select", options: [{ value: "M", label: "M (mol/L)" }, { value: "mg/mL", label: "mg/mL" }, { value: "g", label: "g (mass)" }], value: "M" },
        { key: "total", label: "Total concentration (ratio split)", hint: "only for 'Total concentration split by a ratio' · blank = fill in later", value: "" },
        { key: "totalUnit", label: "Total concentration unit", type: "select", options: [{ value: "M", label: "M (mol/L)" }, { value: "mg/mL", label: "mg/mL" }], value: "M" },
        { key: "basis", label: "Ratio between solutes", type: "select", options: [{ value: "molar", label: "Molar" }, { value: "mass", label: "Mass" }], value: "molar" },
        { key: "ratios", label: "Ratio numbers", hint: "same order as the solutes · blank = 1 each", value: "" },
        { key: "amount", label: "Amount unit", type: "select", options: [{ value: "mmol", label: "mmol" }, { value: "mol", label: "mol" }], value: "mmol" },
      ], { intro: "Added can be in g or mL (type g or mL in the In column); mL is converted with the row's Density." });
      if (!v || !list(v.solutes).length) return "";
      const solutes = list(v.solutes).map(link), solvents = list(v.solvents).map(link);
      const id = unique(v.label.match(/(\d+)\s*$/) ? "sol" + v.label.match(/(\d+)\s*$/)[1] : v.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "sol");
      const inp = unique(`${id}_in`);
      const total = v.mode === "total", mol = v.amount === "mol";
      const V = `${inp}!$B$2`, Ct = `${inp}!$B$3`;
      const s = solutes.length, last = s + 1, allEnd = last + solvents.length, totalRow = allEnd + 1;
      const ratios = list(v.ratios);
      const header = ["Component", "MW (g/mol)",
        ...(total ? [`Ratio (${v.basis})`, "Mol parts"] : ["Target", "Unit"]),
        "Target (g · mL)", "Added", "In", "Density (g/mL)", "Added (g)", `${v.amount} (added)`, "Conc. (M)", "Conc. (mg/mL)"];
      const rows = solutes.map((r, i) => {
        const n = i + 2;
        const parts = v.basis === "mass" ? `=C${n}/B${n}` : `=C${n}`;
        const target = total
          ? `=IF(${V}="", 1/0, IF(${Ct}="", 1/0, ${v.totalUnit === "M"
            ? `${Ct}*${V}/1000*D${n}/SUM(D$2:D$${last})*B${n}`
            : `${Ct}*${V}/1000*D${n}*B${n}/SUMPRODUCT(D$2:D$${last}, B$2:B$${last})`}))`
          : `=IF(C${n}="", "", IF(D${n}="M", IF(${V}="", 1/0, C${n}*${V}/1000*B${n}), IF(D${n}="mg/mL", IF(${V}="", 1/0, C${n}*${V}/1000), C${n})))`;
        return [r, `=MW(A${n})`, ...(total ? [ratios[i] ?? "1", parts] : ["", v.unit]),
          target, "", "g", noteNumber(r, "Density"), `=IF(F${n}="", "", IF(G${n}="mL", IF(H${n}="", 1/0, F${n}*H${n}), F${n}))`,
          `=IF(I${n}="", "", I${n}/B${n}${mol ? "" : "*1000"})`, `=IF(J${n}="", "", J${n}${mol ? "*1000" : ""}/${V})`, `=IF(I${n}="", "", I${n}*1000/${V})`];
      });
      solvents.forEach((r) => rows.push([r, "", "", "", solvents.length === 1 ? `=${V}` : `=${V}/${solvents.length}`, "", "mL", "", "", "", "", ""]));
      rows.push(["**Total**", "", "", "", `=SUM(E2:E${last})`, "", "", "", `=SUM(I2:I${last})`, `=SUM(J2:J${last})`, `=SUM(K2:K${last})`, `=SUM(L2:L${last})`]);
      const inRows = [["Final volume (mL)", v.volume ?? ""], ...(total ? [[`Total concentration (${v.totalUnit})`, v.total ?? ""]] : [])];
      return `## ${v.label}
Made on: ${tp.date.now("YYYY-MM-DD")}

${calc({ name: inp, title: `${v.label}: targets`, icon: "test-tube" }, ["Parameter", "Value"], inRows)}
${calc({ name: id, title: v.label, icon: "test-tube" }, header, rows)}${solvents.length ? "Dissolve the solutes, then make up to the final volume.\n" : ""}`;
    },

    async recipe() {
      const v = await form("Recipe by equivalents", [
        { key: "reagents", label: "Reagents", hint: "comma separated · the first is the reference", value: "", placeholder: "e.g. reagent 1, reagent 2", suggest: chems },
        { key: "solvent", label: "Solvent (makes up the rest)", hint: "leave blank for none", value: "", suggest: chemsFor("solvent") },
        { key: "amount", label: "Amount of the first reagent", hint: "leave blank to type it in the table", value: "" },
        { key: "amountUnit", label: "…in", type: "select", options: [{ value: "mmol", label: "mmol" }, { value: "g", label: "g (mass)" }, { value: "M", label: "M (concentration)" }], value: "mmol" },
        { key: "volume", label: "Total volume (mL)", hint: "only for a concentration: amount = M × mL", value: "" },
        { key: "total", label: "Total mass (g)", hint: "needed for the solvent row and wt%", value: "" },
      ], { intro: "Each row's amount = Eq. × the reagent named in 'Relative to'. Type a 'Set mmol' on any row to fix it directly." });
      if (!v || !list(v.reagents).length) return "";
      const id = unique("recipe");
      const reagents = list(v.reagents).map(link);
      const k = reagents.length, last = k + 1;
      const solvRow = v.solvent ? k + 2 : null;
      const totalRow = (solvRow ?? last) + 1;
      const allEnd = solvRow ?? last;
      // The first row's Set mmol cell: the amount as typed (mmol), or a visible formula from grams (÷ MW) or from a concentration (× volume)
      const amount = String(v.amount ?? "").trim(), volume = String(v.volume ?? "").trim();
      let first = amount;
      if (amount && v.amountUnit === "g") first = `=${amount}/D2*1000`;
      if (amount && v.amountUnit === "M") {
        if (volume) first = `=${amount}*${volume}`;
        else { first = ""; new Notice("A concentration needs the total volume (mL): type =M*mL in the first row's Set mmol cell."); }
      }
      const rows = reagents.map((r, i) => {
        const n = i + 2;
        return [r, i === 0 ? "1" : "1", i === 0 ? "" : plain(reagents[0]), `=MW(A${n})`, i === 0 ? first : "",
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
        { key: "monomers", label: "Monomer(s)", hint: "comma separated", value: "", placeholder: "e.g. monomer 1, monomer 2", suggest: chemsFor("monomer") },
        { key: "cta", label: "CTA / macro-CTA", value: "", placeholder: "e.g. CTA name", suggest: chemsFor("CTA") },
        { key: "init", label: "Initiator", value: "", placeholder: "e.g. initiator name", suggest: chemsFor("initiator") },
        { key: "solvent", label: "Solvent", value: "", placeholder: "e.g. solvent name", suggest: chemsFor("solvent") },
        { key: "cosolvent", label: "Co-solvent", hint: "optional · leave blank for none", value: "", placeholder: "e.g. co-solvent name", suggest: chemsFor("solvent") },
        { key: "cosolventPct", label: "Co-solvent (% of the solvent's mass)", value: "20" },
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
      const rows = monomers.map((m, i) => { const r = i + 2; return ["Monomer", m, `=MW(B${r})`, frac, `=${id}!$B$6*D${r}/SUM(D$2:D$${mLast})`, `=E${r}*C${r}`, ""]; });
      rows.push(["CTA", link(v.cta), `=MW(B${ctaRow})`, "", `=${id}!B6/${id}!B3`, `=E${ctaRow}*C${ctaRow}`, ""]);
      rows.push(["Initiator", link(v.init), `=MW(B${initRow})`, "", `=E${ctaRow}/${id}!B4`, `=E${initRow}*C${initRow}`, ""]);
      rows.push(["Solvent", link(v.solvent), "", "", "", `=SUM(F2:F${initRow})*(100/${id}!B5-1)`, ""]);
      // A co-solvent is a share of the solvent's mass and is not part of the solids
      if (v.cosolvent) rows.push(["Co-solvent", link(v.cosolvent), "", "", "", `=F${initRow + 1}*${id}!B8/100`, ""]);
      return `## RAFT recipe generator
${calc({ name: id, title: "Targets", icon: "flask-conical" }, ["Parameter", "Value"], [
  ["Total monomer mass (g)", v.mass], ["Target DP", v.dp], ["CTA : initiator", v.ratio], ["Solids (% w/w)", v.solids],
  ["Total monomer (mol)", `=IF(B2="", 1/0, B2/(SUMPRODUCT(${R}!C2:C${mLast}, ${R}!D2:D${mLast})/SUM(${R}!D2:D${mLast})))`],
  ["Theoretical Mn (g/mol)", `=IF(B3="", 1/0, B3*SUMPRODUCT(${R}!C2:C${mLast}, ${R}!D2:D${mLast})/SUM(${R}!D2:D${mLast})+${R}!C${ctaRow})`],
  ...(v.cosolvent ? [["Co-solvent (% of solvent mass)", v.cosolventPct]] : [])])}
${calc({ name: R, title: "Reagents", icon: "flask-conical" }, ["Role", "Name", "MW (g/mol)", "Mol fraction", "mol", "Mass (g)", "Used (g)"], rows)}
`;
    },

    nmr: () => runMethod(methods.find(m => m.key === "nmr")),
    gpc: () => runMethod(methods.find(m => m.key === "gpc")),
    dls: () => runMethod(methods.find(m => m.key === "dls")),

    async method() {
      if (arg) {
        const m = methods.find(x => x.key === arg);
        if (m) return runMethod(m);
        new Notice(`Unknown method "${arg}"`);
        return "";
      }
      const v = await form("Analysis table", [
        { key: "method", label: "Method", type: "select", options: methods.map(m => ({ value: m.key, label: m.name })), value: methods[0]?.key },
        { key: "results", label: "Also add a combined results table", type: "toggle", value: false },
      ]);
      const m = v && methods.find(x => x.key === v.method);
      return m ? runMethod(m, !!v.results) : "";
    },

    async results() {
      const tech = Object.fromEntries(methods.map(m => [m.key, techTables(m.key)]));
      const has = (k) => tech[k].length > 0;
      const hint = (k) => has(k) ? `linked to the ${tech[k].map(t => t.id).join(", ")} table${tech[k].length > 1 ? "s" : ""}` : "typed in";
      const withResults = methods.filter(m => m.results.length);
      const v = await form("Combined results table", [
        { key: "codes", label: "Sample codes", type: "textarea", hint: "defaults to this note's sample list or timetable", value: codesFrom(["samples", "sampling", ...methods.map(m => m.key)]).join(", ") },
        { type: "heading", label: "Columns" },
        ...withResults.map(m => ({ key: m.key, label: m.resultsLabel, hint: hint(m.key), type: "toggle", value: m.resultsDefault || has(m.key) })),
      ]);
      if (!v) return "";
      const links = withResults.filter(m => v[m.key]).map(method => ({ method, tables: tech[method.key] }));
      return resultsTable(list(v.codes), links);
    },
  };

  if (!tp.user?.labForm || !M) {
    new Notice("Lab snippets need Templater → User script functions folder = the folder that holds labSnippets.js (or a folder above it)");
    return "";
  }
  if (!S[key]) { new Notice(`Unknown snippet "${key}"`); return ""; }
  const md = await S[key]();
  return md ? md + "\n" : "";
};
