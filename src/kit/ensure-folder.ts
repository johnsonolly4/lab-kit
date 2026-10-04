// Creates a vault folder (and the folders above it) when it is missing: used for the Methods folder setting.
import type { Vault } from "obsidian";

/** True when the folder was created. Nothing is created when something already has that path (a folder or a note), or the path is empty, climbs out (`..`) or goes into a hidden folder. */
export async function ensureFolder(vault: Pick<Vault, "getAbstractFileByPath" | "createFolder">, path: string): Promise<boolean> {
  const parts = path.split("/").filter(Boolean);
  if (!parts.length || parts.some(p => p.startsWith("."))) return false;
  if (vault.getAbstractFileByPath(parts.join("/"))) return false;
  let at = "";
  for (const p of parts) {
    at = at ? `${at}/${p}` : p;
    if (!vault.getAbstractFileByPath(at)) await vault.createFolder(at);
  }
  return true;
}
