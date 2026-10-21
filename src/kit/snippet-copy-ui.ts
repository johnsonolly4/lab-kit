// "Make my own copy" button: asks for a name, runs the kit's snippet once and saves the result as a plain note (engine: snippet-copy.ts).
// Works on mobile: the kit scripts come from the bundle, nothing is evaluated and no Node API is used.
import { Notice, normalizePath, parseYaml, type App } from "obsidian";
import { ask } from "../planning/ask";
import labSnippets from "./bundled/labSnippets.js";
import labMethods from "./bundled/labMethods.js";
import { canCopy, copyTokenTemplate, defaultCopyName, isTokenTemplate, makeSnippetCopy, snippetKey, type HeadlessTp } from "./snippet-copy";

/** Asks for the copy's name and saves the copy next to the kit snippet; a Notice says what was made. Returns the copy's path (null when cancelled or it failed). */
export async function makeMyCopy(app: App, stubPath: string): Promise<string | null> {
  const file = app.vault.getFileByPath(stubPath);
  const source = file ? await app.vault.cachedRead(file) : "";
  const key = snippetKey(source);
  const token = !key && isTokenTemplate(source, parseYaml);
  if (!file || !(token || canCopy(key))) return null;
  const name = await ask(app, "Name of your copy (Enter keeps it)", defaultCopyName(file.basename));
  if (name === null) return null;
  const copyName = name.replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").trim() || defaultCopyName(file.basename);
  const folder = file.parent?.path ?? "";
  const exists = (p: string) => !!app.vault.getAbstractFileByPath(normalizePath(p));
  if (token) {
    try {
      const res = await copyTokenTemplate({ text: source, name: file.basename, copyName, folder, exists,
        write: async (p, text) => { await app.vault.create(normalizePath(p), text); } });
      new Notice(`Made ${res.path}. It is yours: Lab Kit updates never change it.`);
      return res.path;
    } catch (e) {
      new Notice("Couldn't make the copy: " + (e as Error).message);
    }
    return null;
  }
  // labSnippets.js reads the globals `app` and `Notice`, as Templater provides them
  const g = window as unknown as { Notice?: unknown };
  const had = g.Notice;
  g.Notice = Notice;
  try {
    const res = await makeSnippetCopy({
      key: key!, name: file.basename, copyName, folder, user: { labMethods },
      run: (tp: HeadlessTp) => labSnippets(tp, key!),
      exists,
      write: async (p, text) => { await app.vault.create(normalizePath(p), text); },
    });
    new Notice(`Made ${res.path}. It is yours: Lab Kit updates never change it.` +
      (res.fixedCodes ? " Its sample codes are fixed and \"Made on\" is today's date." : ""));
    return res.path;
  } catch (e) {
    new Notice("Couldn't make the copy: " + (e as Error).message);
    return null;
  } finally {
    g.Notice = had;
  }
}
