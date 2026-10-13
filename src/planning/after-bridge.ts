// Deleting a to-do keeps the plan in one piece (planning kit): the to-dos that came after it come after what it came after (A → B → C becomes A → C).
// Obsidian hands the deleted note's last properties to `metadataCache` "deleted", so its own `after` can still be read. The rule is src/planning/plan-link.ts (`bridgeAfter`).
import { Notice, stringifyYaml, type Plugin } from "obsidian";
import { inFolder, linkTarget } from "./lists";
import { bridgeAfter } from "./plan-link";
import { changeAfter, namesOf, undoNotice } from "./after-write";

/** The text of a note about to be deleted by Lab Kit itself (the plan map's Delete note), so Undo can bring it back whole. Other deletions give only the properties. */
const texts = new Map<string, string>();
export const rememberText = (path: string, text: string): void => { texts.set(path, text); };

/** `folder` is read each time (the Planning folder setting can change). */
export function bridgeOnDelete(plugin: Plugin, folder: () => string): void {
  const app = plugin.app;
  plugin.registerEvent(app.metadataCache.on("deleted", (file, prev) => {
    const fm = prev?.frontmatter;
    if (!fm || fm.kind !== "todo" || !inFolder(file.path, folder())) return;
    const gone = namesOf(file.path);
    const points = (v: unknown): boolean => (Array.isArray(v) ? v : [v]).some(i => { const t = linkTarget(i); return !!t && gone.some(n => t === n || n.endsWith("/" + t)); });
    const todos = app.vault.getMarkdownFiles().filter(f => inFolder(f.path, folder()) && points(app.metadataCache.getFileCache(f)?.frontmatter?.after));
    const text = texts.get(file.path);
    texts.delete(file.path);
    if (!todos.length) return;
    void (async () => {
      const before = new Map<string, unknown>();
      for (const f of todos) await changeAfter(app, f.path, v => { before.set(f.path, v); return bridgeAfter(v, gone, fm.after, namesOf(f.path)); });
      const n = todos.length;
      undoNotice(`Passed ${n} link${n === 1 ? "" : "s"} on.`, async () => {
        if (!app.vault.getAbstractFileByPath(file.path)) {   // the to-do itself comes back too (the links point at it again)
          const { position: _p, ...props } = fm;
          await app.vault.create(file.path, text ?? `---\n${stringifyYaml(props)}---\n`);
        }
        for (const [path, v] of before) await changeAfter(app, path, () => v);
      });
    })().catch(() => { new Notice("Could not pass the links on."); });
  }));
}
