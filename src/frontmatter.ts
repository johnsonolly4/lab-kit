// Small readers for note properties (frontmatter), shared by the hazard header and the chemical database.
import { text } from "./calc/engine";

const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Frontmatter value by property name, ignoring capitals and spacing ("Exp. Class" = "exp. class"). */
export function prop(fm: Record<string, unknown> | undefined, name: string): unknown {
  if (!fm) return undefined;
  const want = norm(name);
  const key = Object.keys(fm).find(k => norm(k) === want);
  return key === undefined ? undefined : fm[key];
}

/** A property value as a flat list of non-empty strings (YAML `[[link]]` unquoted arrives as nested arrays). */
export function toList(v: unknown): string[] {
  if (v == null || v === "") return [];
  if (Array.isArray(v)) return v.flatMap(toList);
  return [text(v)];
}
