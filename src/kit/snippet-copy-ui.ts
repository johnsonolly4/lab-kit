// "Make my own copy" button: asks for a name, runs the kit's snippet once and saves the result as a plain note (engine: snippet-copy.ts).
// Works on mobile: the kit scripts come from the bundle, nothing is evaluated and no Node API is used.
import { Notice, normalizePath, type App } from "obsidian";
import { ask } from "../planning/ask";
import labSnippets from "../../kits/lab/Extras/scripts/templater/labSnippets.js";
import labMethods from "../../kits/lab/Extras/scripts/templater/labMethods.js";
import { canCopy, defaultCopyName, makeSnippetCopy, snippetKey, type HeadlessTp } from "./snippet-copy";

/** Asks for the copy's name and saves the copy next to the kit snippet; a Notice says what was made. */
export async function makeMyCopy(app: App, stubPath: string): Promise<void> {
  const file = app.vault.getFileByPath(stubPath);
  const key = file ? snippetKey(await app.vault.cachedRead(file)) : null;
  if (!file || !canCopy(key)) return;
  const name = await ask(app, "Name of your copy (Enter keeps it)", defaultCopyName(file.basename));
  if (name === null) return;
  const copyName = name.replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").trim() || defaultCopyName(file.basename);
  const folder = file.parent?.path ?? "";
  // labSnippets.js reads the globals `app` and `Notice`, as Templater provides them
  const g = window as unknown as { Notice?: unknown };
  const had = g.Notice;
  g.Notice = Notice;
  try {
    const res = await makeSnippetCopy({
      key, name: file.basename, copyName, folder, user: { labMethods },
      run: (tp: HeadlessTp) => labSnippets(tp, key),
      exists: (p) => !!app.vault.getAbstractFileByPath(normalizePath(p)),
      write: async (p, text) => { await app.vault.create(normalizePath(p), text); },
    });
    new Notice(`Made ${res.path}. It is yours: Lab Kit updates never change it.` +
      (res.fixedCodes ? " Its sample codes are fixed and \"Made on\" is today's date." : ""));
  } catch (e) {
    new Notice("Couldn't make the copy: " + (e as Error).message);
  } finally {
    g.Notice = had;
  }
}
