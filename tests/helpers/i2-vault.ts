// Loads tests/fixtures/i2-old-vaults (old-style 1.4.x planning notes) as NoteRec lists, for the I2 existing-vault tests.
// Flat YAML only (what the To-do template writes): `key: value`, quoted text, true / false, empty = null, inline lists.
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import type { NoteRec } from "../../src/planning/lists";

export const I2_ROOT = join(__dirname, "..", "fixtures", "i2-old-vaults");
export const TODO_DIR = "00 Planning/To-dos";

function value(raw: string): unknown {
  const v = raw.trim();
  if (v === "") return null;
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (/^".*"$/.test(v) || /^'.*'$/.test(v)) return v.slice(1, -1);
  return v;
}

/** The front matter of a note's text (flat keys; a `- item` list under a key is read too). */
export function readFm(text: string): Record<string, unknown> {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const fm: Record<string, unknown> = {};
  if (!m) return fm;
  let key = "";
  for (const line of m[1].split(/\r?\n/)) {
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item && key) { fm[key] = [...(Array.isArray(fm[key]) ? (fm[key] as unknown[]) : []), value(item[1])]; continue; }
    const kv = /^([\w .-]+):(.*)$/.exec(line);
    if (kv) { key = kv[1].trim(); fm[key] = value(kv[2]); }
  }
  return fm;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; }).sort();
}

/** Every .md note under `root` (a vault folder of the fixture), paths relative to it. */
export function loadNotes(root: string): NoteRec[] {
  return walk(root).filter(p => p.endsWith(".md")).map(p => {
    const path = relative(root, p).split("\\").join("/");
    const slash = path.lastIndexOf("/");
    return { path, name: path.slice(slash + 1).replace(/\.md$/, ""), folder: path.slice(0, Math.max(slash, 0)), fm: readFm(readFileSync(p, "utf8")), ctime: 0, mtime: 0 };
  });
}

export const loadVault = (name: string): NoteRec[] => loadNotes(join(I2_ROOT, name));
/** The to-do notes of a vault as the board's base sees them: in the to-dos folder (every note, with or without kind), `day` not "Done". */
export const boardNotes = (notes: NoteRec[]): NoteRec[] => notes.filter(n => n.folder === TODO_DIR && n.fm.day !== "Done");
export const todoNotes = (notes: NoteRec[]): NoteRec[] => notes.filter(n => n.folder === TODO_DIR);
