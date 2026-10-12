// Checklist progress: writes `progress: 3/7` into lab notes and the Shopping list so the Bases kanban cards (and the properties pane) can show it.
// Off unless the setting is on. Reads Obsidian's own list-item cache, so a note is never read from disk; writes only when the text changes.
import { TFile, type CachedMetadata, type Plugin } from "obsidian";
import { kitJoin, type KitData } from "../kit/paths";

/** "3/7" (ticked / all check boxes), or null when the note has no check boxes. */
export function progressOf(items: { task?: string }[] | undefined): string | null {
  const boxes = (items ?? []).filter(i => i.task !== undefined);
  if (!boxes.length) return null;
  return `${boxes.filter(i => i.task !== " ").length}/${boxes.length}`;
}

/** Whether a note is one that carries progress: a lab note (in the lab folder) or the Shopping list. */
export function wantsProgress(path: string, kit: Pick<KitData, "labFolder" | "planningFolders">): boolean {
  const lab = kit.labFolder.trim().replace(/\/+$/, "");
  return (!!lab && path.startsWith(lab + "/")) || path === kitJoin(kit.planningFolders.planning, "Shopping list.md");
}

const DELAY = 2000;   // after the last edit, so typing in a note is not interrupted by a property write

export class ProgressWriter {
  private timers = new Map<string, number>();
  constructor(private plugin: Plugin, private kit: () => KitData) {}

  start(): void {
    const { app } = this.plugin;
    this.plugin.registerEvent(app.metadataCache.on("changed", (f, _data, cache) => this.queue(f, cache)));
    this.plugin.register(() => { for (const t of this.timers.values()) window.clearTimeout(t); this.timers.clear(); });
  }

  private queue(f: TFile, cache: CachedMetadata): void {
    const kit = this.kit();
    if (!kit.checklistProgress || f.extension !== "md" || !wantsProgress(f.path, kit)) return;
    const want = progressOf(cache.listItems);
    const have = typeof cache.frontmatter?.progress === "string" ? cache.frontmatter.progress : null;
    window.clearTimeout(this.timers.get(f.path));
    if (want === have) { this.timers.delete(f.path); return; }
    this.timers.set(f.path, window.setTimeout(() => {
      this.timers.delete(f.path);
      void this.plugin.app.fileManager.processFrontMatter(f, (fm: Record<string, unknown>) => {
        if (want === null) delete fm.progress; else fm.progress = want;
      }).catch(e => console.error("Lab Kit checklist progress", e));
    }, DELAY));
  }
}
