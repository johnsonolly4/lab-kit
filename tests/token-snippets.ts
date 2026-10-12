// Test helper: runs the six token-template snippets (the shipped files in kits/lab/Templates/Snippets/) the way Alt+S does,
// with the form's defaults and the given answers on top. Other snippet keys still go through labSnippets.js.
import { readFileSync } from "node:fs";
import { defaultAnswers, fillTemplate, isCancelled, parseTemplate } from "../src/kit/snippet-template";
import { makeEnv } from "../src/kit/snippet-env";

const DIR = "kits/lab/Templates/Snippets/";

/** Snippet key (as the old labSnippets.js called it) → shipped file. */
export const TOKEN_FILES: Record<string, string> = {
  matrix: "04 Variant naming matrix.md",
  samples: "05 Sample list.md",
  timetable: "06 Sampling timetable.md",
  column: "11 Flow column prep.md",
  rt: "12 Residence times.md",
  blank: "13 Blank calc table.md",
  optimisation: "14 Optimisation campaign.md",
};
export const isTokenSnippet = (key: string): boolean => key in TOKEN_FILES;

/** Test-only YAML: the header shapes of the six files (top-level keys, one list of `- key:` mappings, plain or "quoted" strings). */
export function miniYaml(src: string): unknown {
  const out: Record<string, unknown> = {};
  let list: Record<string, string>[] = [];
  let cur: Record<string, string> = {};
  const val = (s: string) => { const t = s.trim(); const q = /^"(.*)"$/.exec(t); return q ? q[1] : t; };
  for (const line of src.split("\n")) {
    let m: RegExpExecArray | null;
    if (!line.trim()) continue;
    if ((m = /^(\w+):\s*(.*)$/.exec(line))) { if (m[2] === "") { list = []; out[m[1]] = list; } else out[m[1]] = val(m[2]); }
    else if ((m = /^\s+-\s+(\w+):\s*(.*)$/.exec(line))) { cur = {}; list.push(cur); cur[m[1]] = val(m[2]); }
    else if ((m = /^\s+(\w+):\s*(.*)$/.exec(line))) cur[m[1]] = val(m[2]);
    else throw new Error("mini yaml: " + line);
  }
  return out;
}

/** The shipped template for a key, parsed. */
export function shippedTemplate(key: string) {
  const parsed = parseTemplate(readFileSync(DIR + TOKEN_FILES[key], "utf8"), miniYaml);
  if (!parsed) throw new Error(`${TOKEN_FILES[key]} has no header`);
  return parsed;
}

/** The text Alt+S would insert: defaults, then `answers` on top; "" when cancelled (a required list is empty). */
export function runToken(key: string, o: { note: string; prefix: string; answers?: Record<string, unknown>; props?: Record<string, string> }): string {
  const { header, body } = shippedTemplate(key);
  const env = makeEnv(o.note, o.prefix, (n, p) => o.props?.[`${n}.${p}`] ?? "");
  const given = Object.fromEntries(Object.entries(o.answers ?? {}).map(([k, v]) => [k, String(v)]));
  const all = { ...defaultAnswers(header, env), ...given };
  if (isCancelled(header, all)) return "";
  return fillTemplate(body, all, env);
}
