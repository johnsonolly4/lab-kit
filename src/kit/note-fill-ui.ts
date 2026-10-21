// Self-filling note, the Obsidian side (Phase 2 of docs/plans/templater-replacement-and-live-snippets.md): `file-open` of the note in the active
// editor, and `modify` of that note (a raw header written by Templater about 0.3-0.5 s after create). Never `create`: a note made in the explorer
// is empty at create and open from file-open on, and a synced-in file is never open (measured, plan "Phase 0 result" items 2-3).
import { Notice, TFile, parseYaml, type App, type Plugin } from "obsidian";
import { NoteFiller, classify, type FillHost } from "./note-fill";
import { defaultAnswers, type TemplateHeader } from "./snippet-template";
import { emptyEnv } from "./snippet-env";
import { kitJoin, type KitData } from "./paths";
import { folderTemplateRows } from "./setup-check";
import { templaterFolderTemplates } from "./obsidian-private";
import type { FormFn } from "./snippet-form";

export interface NoteFillDeps {
  kit: () => KitData;
  /** The template folders to look in, the planning kit's first (only while it is on), then the lab kit's. */
  templateFolders: () => string[];
  planningOn: () => boolean;
  form: () => FormFn;
}

/** The text of a row's template: the first template folder that has the file. */
export async function rowTemplateText(app: App, folders: string[], file: string): Promise<string | null> {
  for (const f of folders) {
    const tf = app.vault.getFileByPath(kitJoin(f, file));
    if (tf) return app.vault.cachedRead(tf);
  }
  return null;
}

const answerText = (v: unknown): string => typeof v === "string" ? v.trim() : typeof v === "number" || typeof v === "boolean" ? String(v) : "";

export function noteFillHost(app: App, d: NoteFillDeps): FillHost {
  return {
    rows: () => folderTemplateRows(d.kit(), d.planningOn()).filter(r => r.folder.trim() && r.file.trim()),
    templaterFolders: () => templaterFolderTemplates(app).map(e => e.folder).filter(Boolean),
    activePath: () => app.workspace.getActiveFile()?.path ?? null,
    read: async path => { const f = app.vault.getFileByPath(path); return f ? app.vault.read(f) : null; },
    template: file => rowTemplateText(app, d.templateFolders(), file),
    write: async (path, expected, text) => {
      const f = app.vault.getFileByPath(path);
      if (!f) return false;
      let wrote = false;
      await app.vault.process(f, cur => { if (cur !== expected) return cur; wrote = true; return text; });
      return wrote;
    },
    ask: async (header: TemplateHeader, name: string) => {
      const defaults = defaultAnswers(header, emptyEnv());
      const got = await d.form()(name, header.fields.map(f => ({ key: f.key, label: f.label, hint: f.hint, placeholder: f.placeholder, type: f.type, value: defaults[f.key],
        ...(f.mandatory ? { required: true } : {}) })));
      return got ? Object.fromEntries(header.fields.map(f => [f.key, answerText(got[f.key])])) : null;
    },
    env: path => ({ parseYaml, folder: path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "", noteName: path.split("/").pop()!.replace(/\.md$/, "") }),
    parseYaml,
    failed: (path, message) => new Notice(`Lab Kit could not fill ${path.split("/").pop()}: ${message}`, 8000),
  };
}

/** Registers the two events. `modify` looks at the active note only and only reads it when it is cheap to tell (a front matter with `make`). */
export function registerNoteFill(plugin: Plugin, d: NoteFillDeps): NoteFiller {
  const app = plugin.app, host = noteFillHost(app, d), filler = new NoteFiller(host);
  const run = (f: TFile | null): void => { if (f && f.extension === "md") filler.check(f.path).catch(e => console.error(e)); };
  plugin.registerEvent(app.workspace.on("file-open", f => run(f)));
  plugin.registerEvent(app.vault.on("modify", f => { if (f instanceof TFile && f.path === app.workspace.getActiveFile()?.path) run(f); }));
  return filler;
}

/** Notes in the mapped folders whose front matter mixes a template header with the note's own keys (Check setup lists them; never filled, never guessed). */
export async function mixedNotes(app: App, d: Pick<NoteFillDeps, "kit" | "planningOn">): Promise<string[]> {
  const rows = folderTemplateRows(d.kit(), d.planningOn()).filter(r => r.folder.trim());
  const out: string[] = [];
  for (const f of app.vault.getMarkdownFiles()) {
    if (!rows.some(r => f.path.startsWith(r.folder.replace(/\/+$/, "") + "/"))) continue;
    if (!app.metadataCache.getFileCache(f)?.frontmatter || !("make" in (app.metadataCache.getFileCache(f)?.frontmatter ?? {}))) continue;   // the cache says it cheaply
    if (classify(await app.vault.cachedRead(f), parseYaml) === "mixed") out.push(f.path);
  }
  return out.sort();
}
