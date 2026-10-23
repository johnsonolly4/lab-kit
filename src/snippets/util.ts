// Small text helpers the Alt+S calculators share.

export const FENCE = "```";

/** A value as text: nothing → "", a list → its items joined with ",", an object → "". */
export const str = (v: unknown): string => v == null ? "" : Array.isArray(v) ? v.map(str).join(",") : typeof v === "string" || typeof v === "number" || typeof v === "boolean" || typeof v === "bigint" ? String(v) : "";

/** 0 → A, 25 → Z, 26 → AA. */
export const letter = (i: number): string => { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

/** A comma or line-break separated answer as a list. */
export const list = (s: unknown): string[] => str(s).split(/[,\n]/).map(x => x.trim()).filter(Boolean);

export const plain = (name: unknown): string => str(name).replace(/^\[\[|\]\]$/g, "").split("|")[0].trim();

/** A ```calc block: the options, then the table. */
export function calc(opts: Record<string, unknown>, header: string[], rows: string[][]): string {
  const o = Object.entries(opts).filter(([, v]) => v != null && v !== "").map(([k, v]) => `${k}: ${str(v)}`).join("\n");
  return `${FENCE}calc\n${o}\n| ${header.join(" | ")} |\n|${header.map(() => "---").join("|")}|\n${rows.map(r => "| " + r.join(" | ") + " |").join("\n")}\n${FENCE}\n`;
}

/** Today as YYYY-MM-DD. */
export function isoToday(now: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
