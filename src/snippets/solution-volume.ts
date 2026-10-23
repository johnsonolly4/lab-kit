// `run: solution-volume`: the old Solution prep by volume (two calc tables), kept for copies made before Solution prep became the live block.
import type { SnippetRun } from "./common";
import { calc, list, str } from "./util";

export async function solutionVolume(r: SnippetRun): Promise<string> {
  const { chems } = r;
  const v = await r.form("Solution prep", [
    { key: "label", label: "Solution name", value: "Solution 1" },
    { key: "solutes", label: "Solutes", hint: "comma separated", value: "", placeholder: "e.g. solute 1, solute 2", suggest: chems },
    { key: "solvents", label: "Solvent(s)", hint: "optional · comma separated · several share the final volume equally", value: "", placeholder: "e.g. solvent name", suggest: r.chemsFor("solvent") },
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
  const label = str(v.label), unit = str(v.unit), amount = str(v.amount), basis = str(v.basis), totalUnit = str(v.totalUnit);
  const solutes = list(v.solutes).map(x => r.link(x)), solvents = list(v.solvents).map(x => r.link(x));
  const trailing = label.match(/(\d+)\s*$/);
  const id = r.unique(trailing ? "sol" + trailing[1] : label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "sol");
  const inp = r.unique(`${id}_in`);
  const total = v.mode === "total", mol = amount === "mol";
  const V = `${inp}!$B$2`, Ct = `${inp}!$B$3`;
  const s = solutes.length, last = s + 1;
  const ratios = list(v.ratios);
  const header = ["Component", "MW (g/mol)",
    ...(total ? [`Ratio (${basis})`, "Mol parts"] : ["Target", "Unit"]),
    "Target (g · mL)", "Added", "In", "Density (g/mL)", "Added (g)", `${amount} (added)`, "Conc. (M)", "Conc. (mg/mL)"];
  const rows = solutes.map((name, i) => {
    const n = i + 2;
    const parts = basis === "mass" ? `=C${n}/B${n}` : `=C${n}`;
    const target = total
      ? `=IF(${V}="", 1/0, IF(${Ct}="", 1/0, ${totalUnit === "M"
        ? `${Ct}*${V}/1000*D${n}/SUM(D$2:D$${last})*B${n}`
        : `${Ct}*${V}/1000*D${n}*B${n}/SUMPRODUCT(D$2:D$${last}, B$2:B$${last})`}))`
      : `=IF(C${n}="", "", IF(D${n}="M", IF(${V}="", 1/0, C${n}*${V}/1000*B${n}), IF(D${n}="mg/mL", IF(${V}="", 1/0, C${n}*${V}/1000), C${n})))`;
    return [name, `=MW(A${n})`, ...(total ? [ratios[i] ?? "1", parts] : ["", unit]),
      target, "", "g", r.noteNumber(name, "Density"), `=IF(F${n}="", "", IF(G${n}="mL", IF(H${n}="", 1/0, F${n}*H${n}), F${n}))`,
      `=IF(I${n}="", "", I${n}/B${n}${mol ? "" : "*1000"})`, `=IF(J${n}="", "", J${n}${mol ? "*1000" : ""}/${V})`, `=IF(I${n}="", "", I${n}*1000/${V})`];
  });
  solvents.forEach((name) => rows.push([name, "", "", "", solvents.length === 1 ? `=${V}` : `=${V}/${solvents.length}`, "", "mL", "", "", "", "", ""]));
  rows.push(["**Total**", "", "", "", `=SUM(E2:E${last})`, "", "", "", `=SUM(I2:I${last})`, `=SUM(J2:J${last})`, `=SUM(K2:K${last})`, `=SUM(L2:L${last})`]);
  const inRows = [["Final volume (mL)", str(v.volume)], ...(total ? [[`Total concentration (${totalUnit})`, str(v.total)]] : [])];
  return `## ${label}
Made on: ${r.ctx.today()}

${calc({ name: inp, title: `${label}: targets`, icon: "test-tube" }, ["Parameter", "Value"], inRows)}
${calc({ name: id, title: label, icon: "test-tube" }, header, rows)}${solvents.length ? "Dissolve the solutes, then make up to the final volume.\n" : ""}`;
}
