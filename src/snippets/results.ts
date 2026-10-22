// `run: results`: the Combined results calc table, one row per sample, pulling values from the note's method tables with XLOOKUP.
// (The live Results block of the plan's Phase 11 is a separate build.)
import type { SnippetRun } from "./common";
import { letter, calc, list } from "./util";
import { norm, type Method } from "./methods";

type Tech = { id: string; n: number; header: string[] };

/** One row per sample, pulling values from the methods' tables by sample code. links = [{ method, tables }]; no tables = columns typed in. */
function resultsTable(r: SnippetRun, codes: string[], links: { method: Method; tables: Tech[] }[]): string {
  const id = r.unique("results");
  const header = ["Sample"]; const cols: ((row: number) => string)[] = [];
  const at = (t: Tech, name: string): number => t.header.findIndex(h => norm(h) === norm(name));
  // One XLOOKUP per table of that method; a code missing from the first is looked up in the next (nmr, then nmr2…)
  const look = (tables: Tech[], sample: string, name: string): ((row: number) => string) => {
    const f = tables.reduceRight((rest, t) => {
      const s = at(t, sample), c = at(t, name);
      if (s < 0 || c < 0) return rest;
      const sl = letter(s), cl = letter(c);
      return `XLOOKUP(A$R, ${t.id}!${sl}$2:${sl}$${t.n + 1}, ${t.id}!${cl}$2:${cl}$${t.n + 1}, ${rest})`;
    }, '""');
    return f === '""' ? () => "" : (row) => "=" + f.split("A$R").join(`A${row}`);
  };
  for (const { method: m, tables } of links) {
    const sample = m.columns[m.sampleIdx].name;
    for (const name of m.results) { header.push(name); cols.push(tables?.length ? look(tables, sample, name) : () => ""); }
  }
  const rows = (codes.length ? codes : ["", "", ""]).map((c, i) => [c, ...cols.map(f => f(i + 2))]);
  return `## Results
${calc({ name: id, title: "Results by sample", icon: "table" }, header, rows)}`;
}

export async function results(r: SnippetRun): Promise<string> {
  const { methods } = r;
  const tech = Object.fromEntries(methods.map(m => [m.key, r.techTables(m.key)]));
  const has = (k: string): boolean => tech[k].length > 0;
  const hint = (k: string): string => has(k) ? `linked to the ${tech[k].map(t => t.id).join(", ")} table${tech[k].length > 1 ? "s" : ""}` : "typed in";
  const withResults = methods.filter(m => m.results.length);
  const cf = r.codeField(methods.map(m => m.key));
  const v = await r.form("Combined results table", [
    ...cf.fields,
    { type: "heading", label: "Columns" },
    ...withResults.map(m => ({ key: m.key, label: m.resultsLabel ?? "", hint: hint(m.key), type: "toggle", value: m.resultsDefault || has(m.key) })),
  ]);
  if (!v) return "";
  v.codes = cf.resolve(v).join(", ");
  const links = withResults.filter(m => v[m.key]).map(method => ({ method, tables: tech[method.key] }));
  return resultsTable(r, list(v.codes), links);
}
