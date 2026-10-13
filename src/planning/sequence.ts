// Link to-dos in order (planning kit): select a list of [[to-do]] links in a note; each to-do then comes after the one before it.
// The first half is pure (the links in a text, which pairs can be linked); linkInOrder reads the selection and writes `after`.
import type { App } from "obsidian";
import { Notice } from "obsidian";
import { todoFolder, type PlanningFolders } from "../kit/paths";
import { inFolder, linkTarget, type NoteRec } from "./lists";
import { readPlan, type Plan } from "./plan";
import { addAfter, canLink, removeAfter, type LinkVerdict } from "./plan-link";
import { changeAfter, linkText, namesOf, undoNotice } from "./after-write";
import { SequenceModal } from "./sequence-ui";

/** The targets of the `[[…]]` links in `text`, in order; the same one twice in a row counts once. */
export function linksIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const t = linkTarget(m[0]);
    if (t && out[out.length - 1] !== t) out.push(t);
  }
  return out;
}

export interface SequenceResult {
  links: { from: string; to: string }[];
  skipped: { from: string; to: string; why: Exclude<LinkVerdict, "ok"> }[];
}

/** For the to-dos `paths` in order: the links to write (each to-do after the one before it) and the pairs left out. Each pair is checked with the links accepted so far in mind. */
export function sequencePatches(plan: Plan, paths: string[]): SequenceResult {
  let rows = plan.rows.map(r => ({ ...r, afterPaths: [...r.afterPaths] }));
  const result: SequenceResult = { links: [], skipped: [] };
  for (let i = 1; i < paths.length; i++) {
    const from = paths[i - 1], to = paths[i];
    const why = canLink({ rows, problems: [] }, from, to);
    if (why !== "ok") { result.skipped.push({ from, to, why }); continue; }
    result.links.push({ from, to });
    rows = rows.map(r => (r.path === to ? { ...r, afterPaths: [...r.afterPaths, from] } : r));
  }
  return result;
}

const rec = (app: App, path: string): NoteRec | null => {
  const f = app.vault.getFileByPath(path);
  if (!f) return null;
  return { path: f.path, name: f.basename, folder: f.parent?.path ?? "", fm: app.metadataCache.getFileCache(f)?.frontmatter ?? {}, ctime: f.stat.ctime, mtime: f.stat.mtime };
};

/** The command: the selected links in the active note, checked, previewed, then written. */
export async function linkInOrder(app: App, folders: PlanningFolders): Promise<void> {
  const text = app.workspace.activeEditor?.editor?.getSelection() ?? "", active = app.workspace.getActiveFile();
  const targets = linksIn(text);
  if (!active || targets.length < 2) { new Notice("Select a list of at least two [[to-do]] links in a note first."); return; }
  const paths: string[] = [];
  const hubs = new Set<string>();
  for (const t of targets) {
    const f = app.metadataCache.getFirstLinkpathDest(t, active.path);
    const fm = f ? app.metadataCache.getFileCache(f)?.frontmatter : undefined;
    if (!f || fm?.kind !== "todo" || !inFolder(f.path, todoFolder(folders))) { new Notice(`"${t}" is not a to-do. Nothing was changed.`); return; }
    const project = linkTarget(Array.isArray(fm.project) ? (fm.project as unknown[])[0] : fm.project);
    const hub = project ? app.metadataCache.getFirstLinkpathDest(project, f.path) : null;
    if (!hub) { new Notice(`"${t}" has no project. Nothing was changed.`); return; }
    hubs.add(hub.path);
    paths.push(f.path);
  }
  if (hubs.size > 1) { new Notice("Those to-dos belong to different projects. Nothing was changed."); return; }
  const hub = rec(app, [...hubs][0]);
  if (!hub) return;
  const notes = app.vault.getMarkdownFiles().filter(f => inFolder(f.path, todoFolder(folders))).map(f => rec(app, f.path)).filter((n): n is NoteRec => !!n);
  const result = sequencePatches(readPlan(notes, hub), paths);
  const name = (p: string): string => p.slice(p.lastIndexOf("/") + 1).replace(/\.md$/, "");
  new SequenceModal(app, result.links.map(l => `${name(l.to)} comes after ${name(l.from)}`),
    result.skipped.map(s => `${name(s.to)} after ${name(s.from)}: ${s.why === "already" ? "already linked" : s.why === "loop" ? "would make a loop" : "the same to-do"}`),
    async () => {
      for (const l of result.links) { const t = linkText(app, l.from, l.to); await changeAfter(app, l.to, v => addAfter(v, t)); }
      undoNotice(`Linked ${result.links.length} ${result.links.length === 1 ? "pair" : "pairs"}.`, async () => {
        for (const l of result.links) await changeAfter(app, l.to, v => removeAfter(v, namesOf(l.from)));
      });
    }).open();
}
