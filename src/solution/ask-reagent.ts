// Solution prep: a property the reagent's chemical note lacks is asked once (plan Q7 A) and written into that note.
// The questions and the values to save are pure; `askReagent` opens the window and writes with `fileManager.processFrontMatter`.
import { Notice, type App, type TFile } from "obsidian";
import { MW_KEYS } from "../calc/engine";
import type { FormField, FormFn } from "../kit/snippet-form";
import type { ReagentField } from "./reagent";

/** The property name each field is written under when the note has none yet (the chemical database template's names). */
const KEY: Record<ReagentField, string> = { mw: "Molecular weight", purity: "Purity", concentration: "Concentration", density: "Density", pKa: "pKa", kind: "Acid / base" };
const LABEL: Record<ReagentField, string> = { mw: "Molecular weight", purity: "Purity", concentration: "Concentration", density: "Density", pKa: "pKa", kind: "Acid / base" };
/** New wording (BACKLOG "Questions for the owner"): the unit under each box. */
const HINT: Partial<Record<ReagentField, string>> = { mw: "g/mol", purity: "wt%", concentration: "mol/L", density: "g/mL" };

/** The window's fields for the missing properties, in the order given. */
export function reagentQuestions(missing: ReagentField[]): FormField[] {
  return missing.map(f => f === "kind"
    ? { key: f, label: LABEL[f], type: "select", options: [{ value: "acid" }, { value: "base" }] }
    : { key: f, label: LABEL[f], hint: HINT[f], required: true });
}

/** The first number in a typed text (a comma may be the decimal mark), or null. */
function numberOf(s: string): number | null {
  const m = /^\s*([-+]?(?:\d+(?:[.,]\d+)?|[.,]\d+))\s*[^\d]*$/.exec(s);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export interface Saved { values: Record<string, string | number>; /** Fields whose answer was not a usable number; nothing is saved for them. */ bad: ReagentField[] }

/** The answers as the values to write: numbers as numbers, `Acid / base` as the word. Purity must be 1-100, the others above 0, pKa may be any number. */
export function reagentValues(missing: ReagentField[], answers: Record<string, unknown>, existingKeys: string[] = [], mwProperty = ""): Saved {
  const values: Record<string, string | number> = {};
  const bad: ReagentField[] = [];
  for (const f of missing) {
    const raw = answers[f];
    const a = typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : "";
    const name = noteKey(f, existingKeys, mwProperty);
    if (f === "kind") { const k = a.trim().toLowerCase(); if (k === "acid" || k === "base") values[name] = k; else bad.push(f); continue; }
    const n = numberOf(a);
    if (n === null || (f !== "pKa" && !(n > 0)) || (f === "purity" && n > 100)) { bad.push(f); continue; }
    values[name] = n;
  }
  return { values, bad };
}

/** The property to write: one the note already has (empty or not, any case), else the user's own MW name or the template's name. */
export function noteKey(f: ReagentField, existingKeys: string[], mwProperty = ""): string {
  const norm = (s: string): string => s.toLowerCase().replace(/[\s_-]+/g, " ").trim();
  const names = f === "mw" ? [mwProperty.trim(), ...MW_KEYS, KEY.mw].filter(Boolean) : [KEY[f], ...(f === "kind" ? ["Acid/base"] : [])];
  for (const n of names) { const hit = existingKeys.find(k => norm(k) === norm(n)); if (hit) return hit; }
  return f === "mw" && mwProperty.trim() ? mwProperty.trim() : KEY[f];
}

/** Asks for the missing properties of the chemical note `file` and saves them there. Resolves true when something was saved. */
export async function askReagent(app: App, form: FormFn, file: TFile, missing: ReagentField[], mwProperty = ""): Promise<boolean> {
  if (!missing.length) return false;
  const answers = await form(file.basename, reagentQuestions(missing), { submitText: "Save" });
  if (!answers) return false;
  let saved: Saved = { values: {}, bad: [] };
  await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
    saved = reagentValues(missing, answers, Object.keys(fm), mwProperty);
    for (const [k, v] of Object.entries(saved.values)) fm[k] = v;
  });
  if (saved.bad.length) new Notice(`Not saved, not a usable number: ${saved.bad.map(f => LABEL[f]).join(", ")}.`);   // new wording, asked in BACKLOG
  return Object.keys(saved.values).length > 0;
}
