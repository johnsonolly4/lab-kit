// The note and vault side of snippet token templates: the engine's TemplateEnv built from the note text, and the chemical-class filter.
// Pure (no Obsidian imports): the note lookups are passed in. Mirrors the helpers inside labSnippets.js.
import type { TemplateEnv } from "./snippet-template";

const F = "```";

/** Inverse of letter(): A → 0, Z → 25, AA → 26. */
export const letterIndex = (s: string): number => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

const escapeRx = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Every calc table in the note, in order: name (lower case) and rows, each row its list of cells (header row first). */
export function calcTables(note: string): { name: string; rows: string[][] }[] {
  const rx = new RegExp("^[ \\t>]*" + F + "calc[ \\t]*\\n([\\s\\S]*?)\\n[ \\t>]*" + F + "[ \\t]*$", "gim");
  const out: { name: string; rows: string[][] }[] = [];
  let m: RegExpExecArray | null;
  while ((m = rx.exec(note))) {
    const lines = m[1].split("\n").map(l => l.replace(/^[ \t>]*/, ""));
    const name = lines.map(l => /^name:\s*(.+?)\s*$/i.exec(l)).find(Boolean)?.[1].toLowerCase() ?? "";
    const rows = lines.filter(l => l.startsWith("|") && !/^[\s|:-]+$/.test(l)).map(l => l.split("|").slice(1, -1).map(c => c.trim()));
    out.push({ name, rows });
  }
  return out;
}

/**
 * The engine's environment for one insert. `note` is the text of the note being edited, `prefix` its sample-code prefix (ABC0016-),
 * `noteProperty` reads a number from a property of another note. Table ids already handed out stay taken for this insert.
 */
export function makeEnv(note: string, prefix: string, noteProperty: (noteName: string, property: string) => string): TemplateEnv {
  const taken = new Set<string>();
  return {
    prefix,
    uniqueTable(base) {
      const exists = (n: string) => taken.has(n) || new RegExp(`^\\s*(?:>\\s*)*name:\\s*${escapeRx(n)}\\s*$`, "mi").test(note);
      let n = base, k = 2;
      while (exists(n)) n = `${base}${k++}`;
      taken.add(n);
      return n;
    },
    tableRows(name) {
      const t = calcTables(note).find(x => x.name === name.toLowerCase());
      return t ? Math.max(0, t.rows.length - 1) : 0;
    },
    nextFreeIndex(table) {
      // a base ending in "s" also matches the singular and numbered copies: samples → sample, sample2
      const text = table
        ? calcTables(note).filter(t => new RegExp(`^${escapeRx(table).replace(/s$/, "s?")}\\d*$`, "i").test(t.name)).flatMap(t => t.rows.flat()).join("\n")
        : note;
      const rx = new RegExp(escapeRx(prefix) + "([A-Z]+)", "g");
      let next = 0, m: RegExpExecArray | null;
      while ((m = rx.exec(text))) next = Math.max(next, letterIndex(m[1]) + 1);
      return next;
    },
    noteProperty,
  };
}

/** A chemical note as the forms list it. `classes` are the values of its Chemical class property. */
export interface Chem { name: string; aliases: string[]; classes?: string[] }

/** The distinct Chemical classes in use, from each chemical's own list: sorted, a class counted once whatever its capitals (the first spelling is kept). */
export function chemicalClasses(lists: string[][]): string[] {
  const seen = new Map<string, string>();
  for (const c of lists.flat().map(x => x.trim()).filter(Boolean)) if (!seen.has(c.toLowerCase())) seen.set(c.toLowerCase(), c);
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/**
 * The chemicals a field suggests when it asks for Chemical classes. Class names are free text and are never checked against a
 * list: a class no chemical has yet just matches nothing. Match = case-insensitive, exact. No classes asked = all chemicals, unchanged.
 * `only` true: just the matching ones; false: matching first, then the rest (each group keeps the incoming order).
 */
export function classFilter(chems: Chem[], want: string[] | undefined, only: boolean): { name: string; aliases: string[] }[] {
  const wanted = new Set((want ?? []).map(c => c.trim().toLowerCase()).filter(Boolean));
  const plain = (c: Chem) => ({ name: c.name, aliases: c.aliases });
  if (!wanted.size) return chems.map(plain);
  const hit = (c: Chem) => (c.classes ?? []).some(x => wanted.has(x.trim().toLowerCase()));
  const yes = chems.filter(hit).map(plain);
  return only ? yes : [...yes, ...chems.filter(c => !hit(c)).map(plain)];
}
