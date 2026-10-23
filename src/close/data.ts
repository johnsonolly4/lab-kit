// Close experiment, the data check: where the note's data folder is on this device, what is in it, and which linked files are missing.
// Pure: the disk and the vault come in as arguments (`ui.ts` supplies them), so it works on mobile and in tests.
import { prop } from "../frontmatter";
import { text } from "../calc/engine";

export type DataState = "found" | "empty" | "missing" | "no-root" | "no-node";

export interface DataCheck {
  state: DataState;
  /** The folder as resolved on this device (root + note name); "" when it could not be. */
  folder: string;
  /** The note's own data-folder property, "" when it has none. */
  property: string;
  files: number;
  /** Linked or embedded files that are not in the vault. */
  missingLinks: string[];
}

/** Files that are not data. */
const NOISE = /(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini)$/i;

/** The header's rule: this platform's root joined with the note name. "" when no root is set. */
export function resolveDataFolder(root: string, noteName: string, join: (...p: string[]) => string): string {
  return root.trim() ? join(root.trim(), noteName) : "";
}

const PROP_NAME = /^data[ _-]?(folder|path|dir|directory|location)$/i;

/** The note's own data-folder property ("Data folder", "data_path" …), "" when none or empty. */
export function dataProperty(fm: Record<string, unknown> | undefined): string {
  const key = Object.keys(fm ?? {}).find(k => PROP_NAME.test(k.trim()));
  return key === undefined ? "" : text(prop(fm, key)).trim();
}

export interface DataInput {
  noteName: string;
  fm: Record<string, unknown> | undefined;
  /** This platform's data root from the settings. */
  root: string;
  join: (...p: string[]) => string;
  /** Can this device read folders (desktop with Node)? */
  canRead: boolean;
  /** The folder's files, or null where there is no Node (a phone). */
  list: (folder: string) => { exists: boolean; files: [string, number][] } | null;
  /** Linked or embedded files the vault does not have. */
  missingLinks: string[];
}

export async function checkData(i: DataInput): Promise<DataCheck> {
  const property = dataProperty(i.fm), base = { property, missingLinks: i.missingLinks };
  const folder = resolveDataFolder(i.root, i.noteName, i.join);
  const none = { files: 0 };
  if (!i.canRead) return { ...base, ...none, state: "no-node", folder };
  if (!folder) return { ...base, ...none, state: "no-root", folder };
  const found = i.list(folder);
  if (!found) return { ...base, ...none, state: "no-node", folder };
  if (!found.exists) return { ...base, ...none, state: "missing", folder };
  const files = found.files.filter(([p]) => !NOISE.test(p));
  return { ...base, state: files.length ? "found" : "empty", folder, files: files.length };
}

/** Warning lines; empty = nothing to confirm. A phone cannot check the folder, so only missing links warn there. */
export function dataWarnings(d: DataCheck): string[] {
  const out: string[] = [];
  if (d.state === "missing") out.push(`Data folder not found: ${d.folder}`);
  else if (d.state === "empty") out.push(`Data folder is empty: ${d.folder}`);
  else if (d.state === "no-root") out.push("No data folder root is set on this device.");
  if (d.missingLinks.length) {
    const shown = d.missingLinks.slice(0, 5).join(", "), more = d.missingLinks.length - 5;
    out.push(`Missing in the vault: ${shown}${more > 0 ? ` and ${more} more` : ""}`);
  }
  return out;
}

/** The one good line, or "" when the folder was not found. */
export function dataFoundLine(d: DataCheck): string {
  return d.state === "found" ? `Data folder found: ${d.files} ${d.files === 1 ? "file" : "files"}.` : "";
}

/** Shown when the check cannot run here. */
export const NO_NODE_LINE = "Cannot check the data folder on this device.";

/** The rows the PDF prints under the properties table: the folder location only (data may be added later, so no count or checksum). */
export function dataPdfRows(d: DataCheck): [string, string][] {
  const where = d.folder || (d.state === "no-node" ? "cannot check on this device" : "no data folder root set on this device");
  const rows: [string, string][] = [["Data folder (this device)", where]];
  if (d.property) rows.push(["Data folder (note property)", d.property]);
  return rows;
}

/** `closed_data` for the note: the resolved path, unless the note has its own data-folder property or no folder was resolved. */
export function closedDataValue(d: DataCheck): string {
  return d.property || !d.folder ? "" : d.folder;
}
