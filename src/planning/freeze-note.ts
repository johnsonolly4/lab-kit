// Freezing a meeting note in the vault (I19, I20): reads the lists the blocks show, writes them out and stamps the flagged to-dos.
// The text rules are in freeze.ts (pure). Plan: docs/plans/freeze-meeting-notes.md.
import type { App, TFile } from "obsidian";
import { kitJoin, todoFolder, type KitData } from "../kit/paths";
import { dueToFreeze, freezeMeeting, frozenOn, meetingFreezeLists, raisedStamp, RAISED, type FreezeData } from "./freeze";
import { inFolder, linkTarget, meetingWindow, type NoteRec } from "./lists";
import { readPlan } from "./plan";
import { firstSeries } from "./meetings";
import { ymd } from "./todo";

export function recOf(app: App, f: TFile): NoteRec {
  const cache = app.metadataCache.getFileCache(f);
  return { path: f.path, name: f.basename, folder: f.parent?.path ?? "", fm: cache?.frontmatter ?? {}, ctime: f.stat.ctime, mtime: f.stat.mtime };
}

/** The lists of the meeting note `file` as they are now; null when it has no since and date (or is not a meeting note). Nothing is written. */
export function freezeDataFor(app: App, kit: KitData, file: TFile): FreezeData | null {
  const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
  if (fm.kind !== "meeting") return null;
  const f = kit.planningFolders, notes = app.vault.getMarkdownFiles().map(x => recOf(app, x));
  const inside = (folder: string): NoteRec[] => notes.filter(n => inFolder(n.path, folder));
  const target = linkTarget(fm.series), hubFile = target ? app.metadataCache.getFirstLinkpathDest(target, file.path) : null;
  const hub = hubFile ? recOf(app, hubFile) : null;
  const hubs = notes.filter(n => n.fm.kind === "meeting-series");
  const lab = kit.labFolder.trim() ? kitJoin(kit.labFolder.trim()) : "";
  return meetingFreezeLists({
    fm,
    lab: lab && app.vault.getFolderByPath(lab) ? inside(lab) : undefined,
    todos: inside(todoFolder(f)),
    literature: app.vault.getFolderByPath(f.literature) ? inside(f.literature) : undefined,
    hub, isFirst: !!hub && firstSeries(hubs)?.name === hub.name,
    planOf: link => {   // a plan-picture block's project: its plan, when the link finds a project hub
      const t = app.metadataCache.getFirstLinkpathDest(link, file.path), rec = t ? recOf(app, t) : null;
      return rec?.fm.kind === "project" ? readPlan(inside(todoFolder(f)), rec, lab && app.vault.getFolderByPath(lab) ? inside(lab) : undefined) : null;
    },
  }, new Date());
}

export type FreezeResult = { done: true; flagged: number } | { done: false; why: "not-meeting" | "frozen" | "no-window"; on?: string };

/** Freezes the meeting note `file`: its lists become plain links, `frozen: <today>` is set, and each flagged to-do gets `raised_on` (the earlier date is kept). */
export async function freezeFile(app: App, kit: KitData, file: TFile, today: Date = new Date()): Promise<FreezeResult> {
  const text = await app.vault.read(file);
  if (app.metadataCache.getFileCache(file)?.frontmatter?.kind !== "meeting") return { done: false, why: "not-meeting" };
  const was = frozenOn(text);
  if (was) return { done: false, why: "frozen", on: was };
  const data = freezeDataFor(app, kit, file);
  const date = meetingWindow(app.metadataCache.getFileCache(file)?.frontmatter ?? {})?.date;
  if (!data || !date) return { done: false, why: "no-window" };
  await app.vault.process(file, cur => freezeMeeting(cur, data.lists, ymd(today), data.pictures) ?? cur);
  for (const t of data.flagged) {
    const todo = app.vault.getFileByPath(t.path);
    if (todo) await app.fileManager.processFrontMatter(todo, (fm: Record<string, unknown>) => { const s = raisedStamp(fm[RAISED], date); if (s) fm[RAISED] = s; });
  }
  return { done: true, flagged: data.flagged.length };
}

/** The daily check (I19; nothing when `kit.freezeAuto` is off): freezes each meeting note of a regular series whose date is before `today` (see `dueToFreeze`). One-off meetings are left to the command. Returns the names of the notes that failed; the others are still done. */
export async function freezeDue(app: App, kit: KitData, today: Date = new Date()): Promise<string[]> {
  if (kit.freezeAuto === false) return [];   // switched off under Settings → Planning: the command and the Tidy rule still freeze
  const day = ymd(today), failed: string[] = [];
  const folder = kit.planningFolders.meetings;
  for (const f of app.vault.getMarkdownFiles()) {
    if (!inFolder(f.path, folder)) continue;
    const fm = app.metadataCache.getFileCache(f)?.frontmatter ?? {};
    if (!dueToFreeze(fm, day)) continue;
    const target = linkTarget(fm.series), hub = target ? app.metadataCache.getFirstLinkpathDest(target, f.path) : null;
    if (!hub || String(app.metadataCache.getFileCache(hub)?.frontmatter?.interval ?? "").toLowerCase() === "once") continue;   // no series or a one-off: not by date
    try { await freezeFile(app, kit, f, today); }
    catch (e) { console.error("Lab Kit", "freeze", e); failed.push(f.basename); }
  }
  return failed;
}
