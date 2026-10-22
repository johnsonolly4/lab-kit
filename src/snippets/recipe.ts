// `run: recipe`: Recipe by equivalents as one calc table (Eq., Relative to, MW, Set mmol, mass, wt%). Becomes a kit definition with the custom live blocks (C8).
import type { SnippetRun } from "./common";
import { calc, list, plain, str } from "./util";

export async function recipe(r: SnippetRun): Promise<string> {
  const v = await r.form("Recipe by equivalents", [
    { key: "reagents", label: "Reagents", hint: "comma separated · the first is the reference", value: "", placeholder: "e.g. reagent 1, reagent 2", suggest: r.chems },
    { key: "solvent", label: "Solvent (makes up the rest)", hint: "leave blank for none", value: "", suggest: r.chemsFor("solvent") },
    { key: "amount", label: "Amount of the first reagent", hint: "leave blank to type it in the table", value: "" },
    { key: "amountUnit", label: "…in", type: "select", options: [{ value: "mmol", label: "mmol" }, { value: "g", label: "g (mass)" }, { value: "M", label: "M (concentration)" }], value: "mmol" },
    { key: "volume", label: "Total volume (mL)", hint: "only for a concentration: amount = M × mL", value: "" },
    { key: "total", label: "Total mass (g)", hint: "needed for the solvent row and wt%", value: "" },
  ], { intro: "Each row's amount = Eq. × the reagent named in 'Relative to'. Type a 'Set mmol' on any row to fix it directly." });
  if (!v || !list(v.reagents).length) return "";
  const id = r.unique("recipe");
  const reagents = list(v.reagents).map(x => r.link(x));
  const k = reagents.length, last = k + 1;
  const solvRow = v.solvent ? k + 2 : null;
  const totalRow = (solvRow ?? last) + 1;
  const allEnd = solvRow ?? last;
  // The first row's Set mmol cell: the amount as typed (mmol), or a visible formula from grams (÷ MW) or from a concentration (× volume)
  const amount = str(v.amount).trim(), volume = str(v.volume).trim();
  let first = amount;
  if (amount && v.amountUnit === "g") first = `=${amount}/D2*1000`;
  if (amount && v.amountUnit === "M") {
    if (volume) first = `=${amount}*${volume}`;
    else { first = ""; r.notice("A concentration needs the total volume (mL): type =M*mL in the first row's Set mmol cell."); }
  }
  const rows = reagents.map((name, i) => {
    const n = i + 2;
    return [name, "1", i === 0 ? "" : plain(reagents[0]), `=MW(A${n})`, i === 0 ? first : "",
      `=IF(E${n}<>"", E${n}, XLOOKUP(C${n}, A$2:A$${last}, F$2:F$${last})*B${n})`, `=F${n}*D${n}/1000`, "", `=IFERROR(G${n}/G$${totalRow}*100, "")`];
  });
  if (solvRow) rows.push([`${r.link(v.solvent)} (rest)`, "", "", "", "", "", `=IF(G${totalRow}="", 1/0, G${totalRow}-SUM(G2:G${last}))`, "", `=IFERROR(G${solvRow}/G$${totalRow}*100, "")`]);
  rows.push(["**Total**", "", "", "", "", "", solvRow ? str(v.total) : `=SUM(G2:G${last})`, `=SUM(H2:H${allEnd})`, ""]);
  return `## Recipe
${calc({ name: id, title: "Recipe by equivalents", icon: "flask-round" }, ["Reagent", "Eq.", "Relative to", "MW (g/mol)", "Set mmol", "mmol", "Mass (g)", "Added (g)", "wt%"], rows)}
`;
}
