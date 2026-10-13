// Add result (planning kit): sets the one-line `result` of the to-do in the active note; the project plan shows it as "→ result".
import { Notice, type App } from "obsidian";
import { ask } from "./ask";

/** The result as one line: line breaks become spaces, ends trimmed. */
export const cleanResult = (text: string): string => text.replace(/\s*[\r\n]+\s*/g, " ").trim();

/** Asks for the result of the active to-do and writes it; leaving it empty removes it, cancelling changes nothing. */
export async function addResult(app: App): Promise<void> {
  const file = app.workspace.getActiveFile();
  const fm = file ? app.metadataCache.getFileCache(file)?.frontmatter : undefined;
  if (!file || fm?.kind !== "todo") { new Notice("Open a to-do first."); return; }
  const current = typeof fm.result === "string" ? fm.result : typeof fm.result === "number" ? String(fm.result) : "";
  const typed = await ask(app, "Result of this to-do, one line (empty removes it)", current);
  if (typed === null) return;
  const result = cleanResult(typed);
  await app.fileManager.processFrontMatter(file, (f: Record<string, unknown>) => { if (result) f.result = result; else delete f.result; });
}
