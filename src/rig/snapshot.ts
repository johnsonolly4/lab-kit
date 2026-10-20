// Rig snapshots: a dated, write-once SVG of the rig with the data it was drawn from kept as plain text in its <metadata>. Pure (no Obsidian runtime).
// The file name is "<rig> <YYYY-MM-DD>.svg" (" 2", " 3" for another one the same day). Lab Kit never rewrites or deletes one.
// Plan: docs/plans/rig-block-no-mermaid.md, Phase 3. Format version 1; a reader for every older version stays (tests/fixtures/rigs/saved/).
import { controlLabel, readRig } from "./parts";

/** The newest snapshot format this Lab Kit writes and reads. */
export const SNAPSHOT_FORMAT = 1;
const META_ID = "lab-kit-rig-snapshot";
const TABLES_MARK = "=== tables ===";
const LAYOUT_MARK = "=== layout ===";

/** What a snapshot records about the rig, as text: the parts tables as the rig note writes them, the `Control` line, the hand layout block. */
export interface RigRecord { control: string; tables: string; layout: string }
export interface SnapshotMeta { format: number; rig: string; date: string; version: string; record: RigRecord }

/** The text of the ```rig-layout block of a note (its lines, trimmed), "" when there is none. Phase 6 writes this block; the snapshot already keeps it. */
function layoutText(text: string): string {
  const m = /^```rig-layout[^\n]*\n([\s\S]*?)\n```/m.exec(text.replace(/\r\n/g, "\n"));
  return m ? m[1].split("\n").map(l => l.trim()).join("\n").trim() : "";
}

/** The record of a rig note's text: every parts table with its heading (as the Rig snippet copies them), the Control line, the layout block. */
export function rigRecord(text: string): RigRecord {
  const rig = readRig(text);
  const tables = rig.tables.map(t => (t.heading ? `## ${t.heading}\n` : "") + t.lines.map(l => l.trim()).join("\n")).join("\n\n");
  return { control: controlLabel(text), tables, layout: layoutText(text) };
}

/** Two records are the same rig. (The picture is not compared: an engine update that redraws a symbol is not a change to the rig.) */
export const sameRecord = (a: RigRecord, b: RigRecord): boolean => a.control === b.control && a.tables === b.tables && a.layout === b.layout;

const escXml = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const unescXml = (s: string): string => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** The snapshot file text: the figure's SVG with a <metadata> element (plain lines) right after the opening tag. */
export function snapshotSvg(svg: string, meta: Omit<SnapshotMeta, "format">): string {
  const body = [
    `lab-kit rig-snapshot format: ${SNAPSHOT_FORMAT}`,
    `rig: ${meta.rig}`,
    `date: ${meta.date}`,
    `lab-kit: ${meta.version}`,
    `control: ${meta.record.control}`,
    TABLES_MARK, meta.record.tables,
    LAYOUT_MARK, meta.record.layout,
  ].join("\n");
  const tag = svg.indexOf(">", svg.indexOf("<svg") + 1) + 1;
  if (tag <= 0) throw new Error("Not an SVG.");
  return `${svg.slice(0, tag)}\n<metadata id="${META_ID}">\n${escXml(body)}\n</metadata>${svg.slice(tag)}`;
}

export type SnapshotRead = { status: "ok"; meta: SnapshotMeta } | { status: "newer"; format: number } | { status: "none" };

/** The record inside a snapshot file. "newer" = made with a newer Lab Kit (shown, never edited); "none" = no Lab Kit metadata. */
export function readSnapshotMeta(svg: string): SnapshotRead {
  const m = new RegExp(`<metadata id="${META_ID}">\\n([\\s\\S]*?)\\n</metadata>`).exec(svg);
  if (!m) return { status: "none" };
  const body = unescXml(m[1]);
  const first = /^lab-kit rig-snapshot format: (\d+)$/m.exec(body.split("\n")[0] ?? "");
  if (!first) return { status: "none" };
  const format = Number(first[1]);
  if (format > SNAPSHOT_FORMAT) return { status: "newer", format };
  const t = body.indexOf(`\n${TABLES_MARK}\n`), l = body.indexOf(`\n${LAYOUT_MARK}\n`, t + 1);
  if (t < 0 || l < 0) return { status: "none" };
  const head = body.slice(0, t).split("\n");
  const field = (name: string): string => (head.find(h => h.startsWith(name + ": ")) ?? "").slice(name.length + 2);
  const tables = body.slice(t + TABLES_MARK.length + 2, l);
  const layout = body.slice(l + LAYOUT_MARK.length + 2);
  return { status: "ok", meta: { format, rig: field("rig"), date: field("date"), version: field("lab-kit"), record: { control: field("control"), tables, layout } } };
}

/** The local date as YYYY-MM-DD. */
export const localDate = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** "<rig> <date>.svg", then "<rig> <date> 2.svg", " 3" while the name is taken. Never a name that is taken. */
export function snapshotName(rig: string, date: string, taken: (name: string) => boolean): string {
  let name = `${rig} ${date}.svg`;
  for (let n = 2; taken(name); n++) name = `${rig} ${date} ${n}.svg`;
  return name;
}

const escRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The snapshot names among `names` (file names in the history folder), oldest first: by date, then by the number after it. */
export function snapshotNames(rig: string, names: string[]): string[] {
  const re = new RegExp(`^${escRe(rig)} (\\d{4}-\\d{2}-\\d{2})(?: (\\d+))?\\.svg$`);
  const keyed = names.flatMap(n => { const m = re.exec(n); return m ? [{ n, date: m[1], i: m[2] ? Number(m[2]) : 1 }] : []; });
  return keyed.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.i - b.i).map(k => k.n);
}
