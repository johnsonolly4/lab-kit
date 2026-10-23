// Alt+S without Templater (I23 Phase 6): the Lab Kit command lists the Snippets folder, asks, builds the text and puts it at the cursor.
// The calculators (src/snippets/) are part of the plugin, so nothing is evaluated and Templater's user-script folder does not matter.
// Templater is only used for a plain snippet that holds Templater code (`<% %>`), when Templater is there.
import { Notice, TFile, type App, type Editor } from "obsidian";
import type { FormField, FormFn, FormOpts } from "./snippet-form";
import type { KitData } from "./paths";
import { runCalculator } from "../snippets/run";
import { menuEntries } from "../snippets/methods";
import type { MenuItem } from "./snippet-menu";
import type { SnippetMeta, SnippetTemplates, SnippetTp } from "./snippet-run";

export interface InsertDeps {
  app: App;
  /** The menu, the header reader and the token-template runner (`plugin.snippets`). */
  snippets: Pick<SnippetTemplates, "menu" | "meta" | "run">;
  /** The plugin's question window. */
  form: FormFn;
  /** The settings the calculators read: the Chemical folder, the class filter and the Methods folder. */
  kit: Pick<KitData, "chemicalFolder" | "chemClassOnly" | "methodsFolder">;
  /** The folder with the snippet notes (the lab kit's snippets folder: `Extras/Snippets`, or `<templates>/Snippets` in an older vault). */
  snippetFolder: string;
  /** Templater's insert-at-cursor, when Templater is installed; null without it. Only used for a plain snippet that holds `<% %>`. */
  templaterInsert: ((file: TFile) => Promise<boolean>) | null;
}

/** The part of Templater's `date.now` the kit scripts use: the tokens YYYY MM DD HH mm ss. */
export function formatNow(format: string, now: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  const parts: Record<string, string> = { YYYY: String(now.getFullYear()), MM: pad(now.getMonth() + 1), DD: pad(now.getDate()), HH: pad(now.getHours()), mm: pad(now.getMinutes()), ss: pad(now.getSeconds()) };
  return format.replace(/YYYY|MM|DD|HH|mm|ss/g, t => parts[t]);
}

/** The `tp` a token template reads: the note being written, the date and the plugin's form.
 *  `target_file` is the note's TFile, as in Templater. */
export function snippetTp(app: App, form: FormFn, now: Date = new Date()): SnippetTp & { date: { now: (format?: string) => string } } {
  const active = app.workspace.getActiveFile();
  const basename = active?.basename ?? "";
  return {
    config: { target_file: active },
    file: { title: basename },
    date: { now: (format = "YYYY-MM-DD") => formatNow(format, now) },
    user: { labForm: (_tp: unknown, title: string, fields: FormField[], opts?: FormOpts) => form(title, fields, opts) },
  };
}

/** The Insert snippet command: the menu, then the picked snippet's text at the cursor. Plain snippets are inserted as they are. */
export async function insertSnippet(d: InsertDeps, editor: Editor, now?: Date): Promise<void> {
  const { app } = d;
  const files = app.vault.getMarkdownFiles()
    .filter(f => f.parent?.path === d.snippetFolder)
    .sort((a, b) => a.basename.localeCompare(b.basename, undefined, { numeric: true }));
  const methods = menuEntries(app, d.kit.methodsFolder, { builtins: true });
  if (!files.length && !methods.length) { new Notice(`No snippets found in ${d.snippetFolder}`); return; }
  const items: MenuItem[] = [];
  const texts = new Map<TFile, string>();
  const tokens = new Set<unknown>();
  for (const f of files) {
    const text = await app.vault.cachedRead(f);
    texts.set(f, text);
    const meta: SnippetMeta | null = await d.snippets.meta(f);
    if (meta) tokens.add(f);
    items.push({
      name: meta?.title || f.basename.replace(/^\d+\s*[-.]?\s*/, ""),
      icon: meta ? meta.icon?.trim() : text.match(/^\/\/\s*icon:\s*(.+)$/m)?.[1]?.trim(),
      desc: meta ? meta.desc?.trim() : text.match(/^\/\/\s*desc:\s*(.+)$/m)?.[1]?.trim(),
      group: meta?.group,
      oldStub: meta?.oldStub,
      value: f,
    });
  }
  for (const m of methods) items.push({ name: m.name, icon: m.icon, desc: m.desc, value: { method: m.key } });
  const pick = await d.snippets.menu(items);
  if (!pick) return;
  const tp = snippetTp(app, d.form, now);
  const text = await (async () => {
    const method = (pick as { method?: string }).method;
    if (method) return await runCalculator({ app, kit: d.kit, form: d.form, file: app.workspace.getActiveFile(), today: () => tp.date.now("YYYY-MM-DD") }, `method:${method}`);
    if (!(pick instanceof TFile)) return "";
    const file = pick;
    if (tokens.has(pick)) return await d.snippets.run(tp, file);
    const plain = texts.get(file) ?? await app.vault.cachedRead(file);
    if (!plain.includes("<%")) return plain;
    // Templater code in a plain snippet: only Templater can run it
    if (d.templaterInsert && await d.templaterInsert(file)) return "";
    new Notice(`“${file.basename.replace(/^\d+\s*[-.]?\s*/, "")}” holds Templater code. Install and turn on the Templater plugin to insert it.`);
    return "";
  })();
  if (text) editor.replaceSelection(text);
}
