// Rig snapshots in the vault: find the latest, tell whether the rig changed since, write a new one (never over an old one), add the history row.
// The pure parts are in snapshot.ts and history.ts. Plan: docs/plans/rig-block-no-mermaid.md, Phases 3 and 4.
import { TFile, TFolder, normalizePath, type App } from "obsidian";
import { ensureFolder } from "../kit/ensure-folder";
import { kitJoin, kitParent } from "../kit/paths";
import { makeFigure } from "./figure-make";
import { appendRow } from "./history";
import { localDate, readSnapshotMeta, rigRecord, sameRecord, snapshotName, snapshotNames, snapshotSvg, type SnapshotMeta } from "./snapshot";

/** The folder a rig note's snapshots live in: "<rig> history", beside the rig note (owner, N2 a). */
export const historyFolder = (rigPath: string, basename: string): string => kitJoin(kitParent(rigPath), `${basename} history`);

export interface Latest { file: TFile; meta: SnapshotMeta | null; /** True when the file was made with a newer Lab Kit (its record is not read). */ newer: boolean }

/** The newest snapshot of a rig note, null when there is none. */
export async function latestSnapshot(app: App, rig: TFile): Promise<Latest | null> {
  const folder = app.vault.getAbstractFileByPath(historyFolder(rig.path, rig.basename));
  if (!(folder instanceof TFolder)) return null;
  const files = folder.children.filter((c): c is TFile => c instanceof TFile && c.extension === "svg");
  const last = snapshotNames(rig.basename, files.map(f => f.name)).pop();
  const file = files.find(f => f.name === last);
  if (!file) return null;
  const read = readSnapshotMeta(await app.vault.cachedRead(file));
  return { file, meta: read.status === "ok" ? read.meta : null, newer: read.status === "newer" };
}

/** What the rig block says about snapshots: the date of the latest one (null when there is none) and whether the rig changed since it. */
export async function snapshotState(app: App, rig: TFile, text: string): Promise<{ date: string; changed: boolean } | null> {
  const last = await latestSnapshot(app, rig);
  if (!last?.meta) return null;   // none, or one this Lab Kit cannot read: say nothing rather than guess
  return { date: last.meta.date, changed: !sameRecord(last.meta.record, rigRecord(text)) };
}

export interface Taken { file: TFile; /** False when the latest snapshot already held this rig, so it is used again. */ created: boolean }

/** A snapshot of the rig note as it is now: the latest one when the rig is unchanged since, else a new file (vault.create, so an existing file is never touched). null when the rig has no parts to draw. */
export async function takeSnapshot(app: App, rig: TFile, version: string, now: Date = new Date()): Promise<Taken | null> {
  const text = await app.vault.read(rig);
  const made = makeFigure(text);
  if (!made) return null;
  const record = rigRecord(text);
  const last = await latestSnapshot(app, rig);
  if (last?.meta && sameRecord(last.meta.record, record)) return { file: last.file, created: false };
  const folder = historyFolder(rig.path, rig.basename);
  await ensureFolder(app.vault, folder);
  const name = snapshotName(rig.basename, localDate(now), n => !!app.vault.getAbstractFileByPath(normalizePath(`${folder}/${n}`)));
  const file = await app.vault.create(normalizePath(`${folder}/${name}`), snapshotSvg(made.svg, { rig: rig.basename, date: localDate(now), version, record }));
  return { file, created: true };
}

export interface Saved extends Taken { /** Why no history row was added (a new snapshot only), "" when it was added or none was needed. */ rowNote: string }

/** Takes the snapshot and, when a new file was made, adds its row to the rig note's `## Rig history` table. */
export async function saveSnapshot(app: App, rig: TFile, version: string, change: string, now: Date = new Date()): Promise<Saved | null> {
  const taken = await takeSnapshot(app, rig, version, now);
  if (!taken) return null;
  if (!taken.created) return { ...taken, rowNote: "" };
  let rowNote = "";
  const link = app.fileManager.generateMarkdownLink(taken.file, rig.path);
  await app.vault.process(rig, data => {
    const r = appendRow(data, { date: localDate(now), snapshot: link, change });
    if ("refused" in r) { rowNote = r.refused; return data; }
    return r.text;
  });
  return { ...taken, rowNote };
}
