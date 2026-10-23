// Solution prep, the set-up window's answers as block text and back. Pure (no Obsidian runtime).
// Plan: docs/plans/solution-live-block.md, Phase 5. The window itself is setup.ts.
import { massToGrams, parseQuantity } from "./block";
import type { ReagentRead } from "./reagent";
import { reagentName } from "./view";

/** What the window's boxes hold, as typed. */
export interface SetupValues { reagent: string; aqueous: string; pH: string; share: string; use: string; balance: string }
export type SetupField = keyof SetupValues;

/** The window's starting values (the approved picture's). */
export const DEFAULT_SETUP: SetupValues = { reagent: "", aqueous: "15.00 g", pH: "4.00", share: "60 %", use: "50 %", balance: "0.1 mg" };

/** The block key each box is stored under. */
export const SETUP_KEY: Record<SetupField, string> = { reagent: "reagent", aqueous: "aqueous", pH: "target-pH", share: "share", use: "use", balance: "balance" };

/** Labels of the picture (L1); `Share as acid solution` says base for a base. */
export const SETUP_LABEL = {
  aqueous: "Aqueous phase", pH: "Target pH", reagent: "Reagent",
  share: (base: boolean) => `Share as ${base ? "base" : "acid"} solution`,
  use: "Share you use", balance: "Balance",
};
const LABEL_OF = (f: SetupField): string => f === "share" ? SETUP_LABEL.share(false) : SETUP_LABEL[f];

/** New wording, asked in BACKLOG "Questions for the owner". */
export const setupProblem = (f: SetupField): string => `${LABEL_OF(f)}: not a usable value.`;

const UNIT_END = /\s*(kg|mg|ug|µg|g|mL|L|%)\s*$/;

/** One box as the line value: a mass (bare number takes `unit`), a percent, or a plain number; null when it is not usable. */
function normalise(f: SetupField, typed: string): string | null {
  const s = typed.trim();
  const q = parseQuantity(s);
  if (!q || !Number.isFinite(q.value)) return null;
  const number = s.replace(UNIT_END, "");
  if (f === "aqueous" || f === "balance") {
    const unit = q.unit || (f === "aqueous" ? "g" : "mg");
    const g = massToGrams({ value: q.value, unit });
    return g !== null && g > 0 ? `${number} ${unit}` : null;
  }
  if (f === "share" || f === "use") return (q.unit === "" || q.unit === "%") && q.value > 0 && q.value <= 100 ? `${number} %` : null;
  if (f === "pH") return q.unit === "" && q.value > 0 && q.value < 14 ? number : null;
  return null;
}

export type SetupLines = Record<SetupField, string>;

/** The answers as block lines, or the first box that is not usable. */
export function setupLines(v: SetupValues): { lines: SetupLines } | { problem: string; field: SetupField } {
  const reagent = reagentName(v.reagent);
  if (!reagent) return { problem: setupProblem("reagent"), field: "reagent" };
  const lines = { reagent } as SetupLines;
  for (const f of ["aqueous", "pH", "share", "use", "balance"] as const) {
    const n = normalise(f, v[f]);
    if (n === null) return { problem: setupProblem(f), field: f };
    lines[f] = n;
  }
  return { lines };
}

/** The block text between the fences: the set-up and empty actuals. No `title:` line (the title follows the pH). */
export function solutionSource(l: SetupLines): string {
  return [
    "format: 1", "method: by mass", "kind: acid for pH",
    `reagent: "[[${l.reagent}]]"`, `aqueous: ${l.aqueous}`, `target-pH: ${l.pH}`, `share: ${l.share}`, `use: ${l.use}`, `balance: ${l.balance}`,
    "step 1:", "  acid:", "  water-to:", "step 2:", "  acid-solution:", "  water:",
  ].join("\n");
}

/** The block as inserted: fences included, the cursor ends on the line after. */
export function solutionBlock(l: SetupLines): string {
  return "```solution\n" + solutionSource(l) + "\n```\n";
}

/** The window's boxes for a block that exists (Edit set-up): what the block says now. */
export function valuesFromSetup(setup: Record<string, string>): SetupValues {
  return {
    reagent: reagentName(setup.reagent),
    aqueous: setup.aqueous ?? "", pH: setup["target-pH"] ?? "", share: setup.share ?? "", use: setup.use ?? "", balance: setup.balance ?? "",
  };
}

/** The lines Edit set-up rewrites: only the boxes whose text changed, as block values (the reagent as a link). */
export function setupChanges(before: SetupValues, after: SetupValues): [key: string, value: string][] {
  const done = setupLines(after);
  if (!("lines" in done)) return [];
  const out: [string, string][] = [];
  for (const f of ["reagent", "aqueous", "pH", "share", "use", "balance"] as const) {
    if (after[f].trim() === before[f].trim()) continue;
    out.push([SETUP_KEY[f], f === "reagent" ? `"[[${done.lines.reagent}]]"` : done.lines[f]]);
  }
  return out;
}

/** A reagent as the picker lists it, like Sigma's list: `Acetic acid · 99.7 % · pKa 4.76` (a molarity reagent shows its mol/L). */
export function reagentRow(name: string, read: ReagentRead): string {
  const strength = read.basis === "concentration" ? `${read.reagent.concentration} mol/L` : read.reagent.purity !== undefined ? `${read.reagent.purity} %` : "";
  return [name, strength, read.pKa === undefined ? "" : `pKa ${read.pKa}`].filter(Boolean).join(" · ");
}

/** What `reagentRow` shows after the name: `99.7 % · pKa 4.76` (empty when the note has neither). */
export function reagentDetail(read: ReagentRead): string {
  return reagentRow("", read).replace(/^ · /, "");
}
