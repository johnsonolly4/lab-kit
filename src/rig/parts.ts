// Rig notes: read a note's parts tables and give the parts, the connections and the Mermaid flowchart text.
// Pure (no Obsidian runtime). Problems come back as messages, never thrown. Plan: docs/plans/rig-notes.md, Phase 1.
import { isSeparator, splitRow } from "../calc/engine";

/** The part kinds, as written in a `Part` column or (plural allowed) as the heading above a table. */
export const PART_KINDS = ["Pump", "Mixer", "Reactor", "Heater", "Stirrer", "Regulator", "Valve", "Analysis", "Outlet", "Tubing"] as const;
export type PartKind = (typeof PART_KINDS)[number];

/** A parts table as found in the note: any table with an `ID` and a `Feeds` column. */
export interface RigTable { heading: string; header: string[]; lines: string[] }
/** One row of a parts table. `cells` holds every column as written, by header. `kind` is "" when it could not be worked out. */
export interface RigPart {
  id: string; kind: PartKind | ""; detail: string; feeds: string[]; cells: Record<string, string>; table: number;
  /** The optional `Control` and `Data` columns: what the computer sets on this part, and what the part sends back ("" when empty or absent). Used by the rig figure. */
  control: string; data: string;
}
/** A connection between two parts. `attached` = not in the flow (a heater on its reactor). */
export interface RigLink { from: string; to: string; attached: boolean }
export interface Rig { tables: RigTable[]; parts: RigPart[]; links: RigLink[]; problems: string[]; mermaid: string }

/** The columns that describe a part under its ID in the diagram: the first one filled in wins. */
const DETAIL_COLUMNS = ["type / model", "type", "model", "instrument"];
/** Words Mermaid reads as syntax: a part with such an ID gets a made-up node name. */
const RESERVED = new Set(["end", "graph", "subgraph", "flowchart", "direction", "click", "style", "class", "classdef", "linkstyle", "default", "call", "href"]);

/** Cell text without link brackets and bold: "[[Pump A|A]]" → "A". */
const plain = (s: string): string => s.replace(/!?\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g, (_m, name: string, alias?: string) => alias ?? name).replace(/\*\*/g, "").trim();

/** "Pumps" / "pump" → "Pump"; anything that is not one kind → "". */
export function partKind(s: string): PartKind | "" {
  const t = plain(s).toLowerCase();
  return PART_KINDS.find(k => { const l = k.toLowerCase(); return t === l || t === l + "s" || (k === "Analysis" && t === "analyses"); }) ?? "";
}

/** Text for a quoted Mermaid label: every character Mermaid or HTML could read as syntax becomes an entity code. */
export const mermaidText = (s: string): string => s.replace(/[#"<>&[\]{}()|`\\]/g, c => `#${c.charCodeAt(0)};`);

/** The parts tables of a note, each with the heading above it. Front matter and code blocks are not read. */
function findTables(text: string): RigTable[] {
  const lines = text.split(/\r?\n/);
  const tables: RigTable[] = [];
  let heading = "", fence = "", i = 0;
  if (lines[0]?.trim() === "---") {
    const end = lines.findIndex((l, n) => n > 0 && l.trim() === "---");
    if (end > 0) i = end + 1;
  }
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    const f = /^(`{3,}|~{3,})/.exec(line);
    if (fence) { if (f && line === f[1] && f[1][0] === fence[0] && f[1].length >= fence.length) fence = ""; continue; }
    if (f) { fence = f[1]; continue; }
    const h = /^#{1,6}\s+(.*?)\s*#*$/.exec(line);
    if (h) { heading = plain(h[1]); continue; }
    if (!line.startsWith("|") || !isSeparator(lines[i + 1] ?? "")) continue;
    const start = i;
    i += 2;
    while (i < lines.length && lines[i].trim().startsWith("|")) i++;
    const header = splitRow(line).map(plain);
    const names = header.map(c => c.toLowerCase());
    if (names.includes("id") && names.includes("feeds")) tables.push({ heading, header, lines: lines.slice(start, i) });
    i--;
  }
  return tables;
}

/** The Mermaid flowchart of the parts: one box per part (ID, then its detail), flow as arrows, attached parts on a dashed line. */
function toMermaid(parts: RigPart[], links: RigLink[]): string {
  if (!parts.length) return "";
  const node = new Map<string, string>();
  const used = new Set<string>();
  parts.forEach((p, i) => {
    let name = /^[A-Za-z][A-Za-z0-9_]*$/.test(p.id) && !RESERVED.has(p.id.toLowerCase()) ? p.id : `n${i + 1}`;
    while (used.has(name)) name += "_";
    used.add(name); node.set(p.id, name);
  });
  const out = ["flowchart LR"];
  for (const p of parts) out.push(`  ${node.get(p.id)}["${mermaidText(p.id)}${p.detail ? "<br>" + mermaidText(p.detail) : ""}"]`);
  for (const l of links) out.push(`  ${node.get(l.from)} ${l.attached ? "-.-" : "-->"} ${node.get(l.to)}`);
  return out.join("\n");
}

/** The first table under a heading called Summary, as written ("" when there is none). It has no ID / Feeds columns, so it is not a parts table. */
export function readSummary(text: string): string {
  const lines = text.split(/\r?\n/);
  let heading = "", fence = "", i = 0;
  if (lines[0]?.trim() === "---") {
    const end = lines.findIndex((l, n) => n > 0 && l.trim() === "---");
    if (end > 0) i = end + 1;
  }
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    const f = /^(`{3,}|~{3,})/.exec(line);
    if (fence) { if (f && line === f[1] && f[1][0] === fence[0] && f[1].length >= fence.length) fence = ""; continue; }
    if (f) { fence = f[1]; continue; }
    const h = /^#{1,6}\s+(.*?)\s*#*$/.exec(line);
    if (h) { heading = plain(h[1]).toLowerCase(); continue; }
    if (heading !== "summary" || !line.startsWith("|") || !isSeparator(lines[i + 1] ?? "")) continue;
    const start = i;
    i += 2;
    while (i < lines.length && lines[i].trim().startsWith("|")) i++;
    return lines.slice(start, i).map(l => l.trim()).join("\n");
  }
  return "";
}

/** Read every parts table in a note's text. */
export function readRig(text: string): Rig {
  const tables = findTables(text);
  const parts: RigPart[] = [], links: RigLink[] = [], problems: string[] = [];
  if (!tables.length) return { tables, parts, links, problems: ["No parts table found: a parts table has an ID and a Feeds column."], mermaid: "" };

  const byId = new Map<string, RigPart>();   // IDs match without regard to case
  tables.forEach((t, ti) => {
    const names = t.header.map(c => c.toLowerCase());
    const idCol = names.indexOf("id"), feedsCol = names.indexOf("feeds"), partCol = names.indexOf("part");
    const where = t.heading ? `the table under "${t.heading}"` : `table ${ti + 1}`;
    const fromHeading = partKind(t.heading);
    t.lines.slice(2).forEach((raw, r) => {
      const row = splitRow(raw);
      if (row.every(c => !c)) return;
      const cell = (n: number): string => n >= 0 ? plain(row[n] ?? "") : "";
      const id = cell(idCol);
      if (!id) { problems.push(`Row ${r + 1} of ${where} has no ID.`); return; }
      if (byId.has(id.toLowerCase())) { problems.push(`The ID "${id}" is used more than once: only the first is drawn.`); return; }
      const written = cell(partCol);
      const kind = written ? partKind(written) : fromHeading;
      if (written && !kind) problems.push(`${id}: "${written}" is not a part kind (${PART_KINDS.join(", ")}).`);
      else if (!kind) problems.push(`${id} has no part kind: add a Part column to ${where}, or put the table under a heading that names one kind (Pumps, Analysis).`);
      const cells: Record<string, string> = {};
      t.header.forEach((h, n) => { if (h) cells[h] = row[n] ?? ""; });
      const detail = DETAIL_COLUMNS.map(d => cell(names.indexOf(d))).find(Boolean) ?? kind;
      const part: RigPart = { id, kind, detail, feeds: cell(feedsCol).split(",").map(s => s.trim()).filter(Boolean), cells, table: ti, control: cell(names.indexOf("control")), data: cell(names.indexOf("data")) };
      parts.push(part); byId.set(id.toLowerCase(), part);
    });
  });

  for (const p of parts) {
    for (const f of p.feeds) {
      const to = byId.get(f.toLowerCase());
      if (!to) { problems.push(`${p.id} feeds "${f}", which is not the ID of a part.`); continue; }
      links.push({ from: p.id, to: to.id, attached: p.kind === "Heater" || p.kind === "Stirrer" });
    }
  }
  return { tables, parts, links, problems, mermaid: toMermaid(parts, links) };
}
