// ZotLit's settings that the kit's literature lists need (Settings → ZotLit → Templates → Frontmatter, and two folders), read from ZotLit's data.json.
// Pure (no Obsidian runtime). The fields are the table in the Vault spec ("Literature note") and in the Set up ZotLit note.
// Shape (ZotLit 2.1.4, settings version 9): "note.frontmatter-fields": [{ key, expr, merge: "replace" | "keep" | "append", language: "liquid" }],
// "note.literature-folder", "template.folder". Anything else in the file is left as it is.

export interface ZotlitField { key: string; expr: string; merge: "replace" | "keep" | "append"; language: "liquid" }

/** The frontmatter fields the kit expects, in the order of the Vault spec table. `DOI`'s expression (`zt.DOI`) is a guess from Zotero's field name, not checked in ZotLit. */
export const ZOTLIT_FIELDS: ZotlitField[] = [
  { key: "citekey", expr: "zt.citationKey", merge: "replace", language: "liquid" },
  { key: "kind", expr: "\"literature\"", merge: "keep", language: "liquid" },
  { key: "Type", expr: "\"Literature Note\" | split: \",\"", merge: "keep", language: "liquid" },
  { key: "Title", expr: "zt.title", merge: "replace", language: "liquid" },
  { key: "Year", expr: "zt.date.year", merge: "replace", language: "liquid" },
  { key: "Authors", expr: "zt.authors | join: \", \"", merge: "replace", language: "liquid" },
  { key: "Zotero Tags", expr: "zt.tags | map: \"name\"", merge: "replace", language: "liquid" },
  { key: "URL", expr: "zt.url", merge: "keep", language: "liquid" },
  { key: "DOI", expr: "zt.DOI", merge: "keep", language: "liquid" },
  { key: "cssclasses", expr: "\"vt,literature,wide\" | split: \",\"", merge: "keep", language: "liquid" },
  { key: "Collections", expr: "zt.collections | collection_paths", merge: "replace", language: "liquid" },
  { key: "aliases", expr: "zt.title | split: \"§§\"", merge: "append", language: "liquid" },
  { key: "imported", expr: "\"now\" | date: \"%Y-%m-%d\"", merge: "keep", language: "liquid" },
];

const FIELDS = "note.frontmatter-fields", LITERATURE = "note.literature-folder", TEMPLATES = "template.folder";

export interface ZotlitScan {
  /** False when the file is not an object or the field list is not a list: nothing can be changed. */
  readable: boolean;
  /** Fields the kit expects that ZotLit does not have (by key). */
  missing: ZotlitField[];
  /** Fields with the kit's key but another expression or merge: the user's own, never changed. */
  differing: { key: string; now: string; kit: string }[];
  /** Folders: `empty` = not set (Fix sets it), `ok` = as the kit says, `other` = the user's own (left alone). */
  literature: "empty" | "ok" | "other";
  templates: "empty" | "ok" | "other";
}

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const describe = (f: { expr?: unknown; merge?: unknown }): string => `${text(f.expr)} (${text(f.merge)})`;

/** Compares ZotLit's settings with what the kit expects. `wanted`: the Literature note folder and the template folder the kit's checklist names. */
export function zotlitScan(data: unknown, wanted: { literature: string; templates: string }): ZotlitScan {
  if (!data || typeof data !== "object" || Array.isArray(data)) return { readable: false, missing: [], differing: [], literature: "empty", templates: "empty" };
  const d = data as Record<string, unknown>;
  const list = d[FIELDS];
  if (list !== undefined && !Array.isArray(list)) return { readable: false, missing: [], differing: [], literature: "empty", templates: "empty" };
  const have = (list ?? []) as { key?: unknown; expr?: unknown; merge?: unknown }[];
  const missing: ZotlitField[] = [], differing: ZotlitScan["differing"] = [];
  for (const f of ZOTLIT_FIELDS) {
    const mine = have.find(h => text(h?.key) === f.key);
    if (!mine) missing.push(f);
    else if (text(mine.expr) !== f.expr || text(mine.merge) !== f.merge) differing.push({ key: f.key, now: describe(mine), kit: describe(f) });
  }
  const folder = (value: unknown, want: string): ZotlitScan["literature"] => (text(value) === "" ? "empty" : text(value) === want ? "ok" : "other");
  return { readable: true, missing, differing, literature: folder(d[LITERATURE], wanted.literature), templates: folder(d[TEMPLATES], wanted.templates) };
}

/** The settings with the missing fields appended and empty folders set; every other key and every field you already have stays as it is. */
export function zotlitApply(data: Record<string, unknown>, scan: ZotlitScan, wanted: { literature: string; templates: string }): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  if (scan.missing.length) out[FIELDS] = [...((data[FIELDS] as unknown[] | undefined) ?? []), ...scan.missing.map(f => ({ ...f }))];
  if (scan.literature === "empty") out[LITERATURE] = wanted.literature;
  if (scan.templates === "empty") out[TEMPLATES] = wanted.templates;
  return out;
}
