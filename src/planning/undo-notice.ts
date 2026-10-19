// Ticking a to-do from the board, with the notice `Ticked "<name>". Undo` (I2 Phase 6, Q19; docs/plans/planned-dates.md "What writes what").
// Undo writes the note's properties back as they were before the tick. Unticks get no notice.
import { Notice, type App, type TFile } from "obsidian";
import { undoPatch, applyPatch } from "./todo";

/** How long the notice stays (ms). */
export const UNDO_MS = 8000;

/** The keys a tick and the to-do engine's stamps may change (`tickPatch`): Undo puts back the whole front matter block only when nothing else moved. */
const TICK_KEYS = new Set(["done", "done_on", "rolled", "day"]);

/** The front matter block at the top of a note (`---` … `---`, with its line breaks), or "" when there is none. */
export function frontOf(text: string): string {
  const m = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(text);
  return m ? m[0] : "";
}

/** `text` with its front matter block swapped for `front` (the body is kept as it is now). */
export function swapFront(text: string, front: string): string {
  return front + text.slice(frontOf(text).length);
}

/**
 * What Undo does, from the properties before the tick and now: "restore" puts the old block back as it was (only tick keys changed),
 * a patch sets back only the tick keys (other properties were changed since: they stay), null when nothing is left to undo.
 */
export function undoPlan(before: Record<string, unknown>, now: Record<string, unknown>): "restore" | { set: Record<string, unknown>; remove: string[] } | null {
  const p = undoPatch(before, now);
  const keys = [...Object.keys(p.set), ...p.remove];
  if (!keys.length) return null;
  if (keys.every(k => TICK_KEYS.has(k))) return "restore";
  const set = Object.fromEntries(Object.entries(p.set).filter(([k]) => TICK_KEYS.has(k)));
  const remove = p.remove.filter(k => TICK_KEYS.has(k));
  return Object.keys(set).length || remove.length ? { set, remove } : null;
}

/** The one notice on screen: a second tick replaces it. */
let current: Notice | null = null;

/** Shows `Ticked "<name>". Undo`, hiding the notice of an earlier tick. */
export function tickNotice(name: string, undo: () => Promise<void>): Notice {
  current?.hide();
  const n = new Notice("", UNDO_MS);
  current = n;
  n.messageEl.createSpan({ text: `Ticked "${name}". ` });
  n.messageEl.createEl("button", { text: "Undo" }).addEventListener("click", () => {
    n.hide();
    if (current === n) current = null;
    undo().catch(e => { console.error("Lab Kit undo", e); new Notice("Could not undo that."); });
  });
  return n;
}

/** Ticks or unticks `file` (flips `done`); a tick gets the Undo notice. The to-do engine stamps `done_on` as it sees the change. */
export async function toggleDoneWithUndo(app: App, file: TFile): Promise<void> {
  const text = await app.vault.read(file);
  let before: Record<string, unknown> = {}, ticked = false;
  await app.fileManager.processFrontMatter(file, (x: Record<string, unknown>) => {
    before = structuredClone(x);
    x.done = x.done !== true;
    ticked = x.done === true;
  });
  if (!ticked) return;
  const front = frontOf(text);
  tickNotice(file.basename, async () => {
    const now = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    const plan = undoPlan(before, now);
    if (plan === "restore") await app.vault.process(file, t => swapFront(t, front));
    else if (plan) await app.fileManager.processFrontMatter(file, (x: Record<string, unknown>) => applyPatch(x, plan));
  });
}
