// `run: raft-table`: the RAFT recipe generator as two calc tables (Targets, Reagents), kept for copies made before the live ```raft block.
import type { SnippetRun } from "./common";
import { calc, list, str } from "./util";

export async function raftTable(r: SnippetRun): Promise<string> {
  const v = await r.form("RAFT recipe generator", [
    { key: "monomers", label: "Monomer(s)", hint: "comma separated", value: "", placeholder: "e.g. monomer 1, monomer 2", suggest: r.chemsFor("monomer") },
    { key: "cta", label: "CTA / macro-CTA", value: "", placeholder: "e.g. CTA name", suggest: r.chemsFor("CTA") },
    { key: "init", label: "Initiator", value: "", placeholder: "e.g. initiator name", suggest: r.chemsFor("initiator") },
    { key: "solvent", label: "Solvent", value: "", placeholder: "e.g. solvent name", suggest: r.chemsFor("solvent") },
    { key: "cosolvent", label: "Co-solvent", hint: "optional · leave blank for none", value: "", placeholder: "e.g. co-solvent name", suggest: r.chemsFor("solvent") },
    { key: "cosolventPct", label: "Co-solvent (% of the solvent's mass)", value: "20" },
    { key: "mass", label: "Total monomer mass (g)", value: "" },
    { key: "dp", label: "Target DP", value: "" },
    { key: "ratio", label: "CTA : initiator", value: "20" },
    { key: "solids", label: "Solids (% w/w)", value: "20" },
  ]);
  if (!v || !list(v.monomers).length) return "";
  const id = r.unique("raft"), R = r.unique(`${id}_r`);
  const monomers = list(v.monomers).map(x => r.link(x));
  const k = monomers.length, mLast = k + 1, ctaRow = k + 2, initRow = k + 3;
  const frac = k === 1 ? "1" : String(+(1 / k).toFixed(3));
  const rows = monomers.map((m, i) => { const n = i + 2; return ["Monomer", m, `=MW(B${n})`, frac, `=${id}!$B$6*D${n}/SUM(D$2:D$${mLast})`, `=E${n}*C${n}`, ""]; });
  rows.push(["CTA", r.link(v.cta), `=MW(B${ctaRow})`, "", `=${id}!B6/${id}!B3`, `=E${ctaRow}*C${ctaRow}`, ""]);
  rows.push(["Initiator", r.link(v.init), `=MW(B${initRow})`, "", `=E${ctaRow}/${id}!B4`, `=E${initRow}*C${initRow}`, ""]);
  rows.push(["Solvent", r.link(v.solvent), "", "", "", `=SUM(F2:F${initRow})*(100/${id}!B5-1)`, ""]);
  // A co-solvent is a share of the solvent's mass and is not part of the solids
  if (v.cosolvent) rows.push(["Co-solvent", r.link(v.cosolvent), "", "", "", `=F${initRow + 1}*${id}!B8/100`, ""]);
  return `## RAFT recipe generator
${calc({ name: id, title: "Targets", icon: "flask-conical" }, ["Parameter", "Value"], [
  ["Total monomer mass (g)", str(v.mass)], ["Target DP", str(v.dp)], ["CTA : initiator", str(v.ratio)], ["Solids (% w/w)", str(v.solids)],
  ["Total monomer (mol)", `=IF(B2="", 1/0, B2/(SUMPRODUCT(${R}!C2:C${mLast}, ${R}!D2:D${mLast})/SUM(${R}!D2:D${mLast})))`],
  ["Theoretical Mn (g/mol)", `=IF(B3="", 1/0, B3*SUMPRODUCT(${R}!C2:C${mLast}, ${R}!D2:D${mLast})/SUM(${R}!D2:D${mLast})+${R}!C${ctaRow})`],
  ...(v.cosolvent ? [["Co-solvent (% of solvent mass)", str(v.cosolventPct)]] : [])])}
${calc({ name: R, title: "Reagents", icon: "flask-conical" }, ["Role", "Name", "MW (g/mol)", "Mol fraction", "mol", "Mass (g)", "Used (g)"], rows)}
`;
}
