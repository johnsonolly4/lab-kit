// Tidy up notes (Phase 7a, plan docs/plans/phase-7-tidy-notes.md): scans a vault's notes against the kit layout and lists what would change, as
// before / after text, plus what is only reported. Pure and read-only: the caller reads the vault into `files`; nothing here writes.
// Simple rules are data (`migrations` in a kit's manifest); rules that look across notes (hubs, meetings, leftovers, note bodies) are code.
import { BAR_BUTTONS } from "../planning/button-bar";
import { unnumbered } from "../planning/lists";
import { firstSeries } from "../planning/meetings";
import { normalisePatch, parseDay, type TodoPatch } from "../planning/todo";
import { freezeBody, raisedStamp, FROZEN, RAISED, type FreezeData } from "../planning/freeze";
import { headerIcon } from "./icon-list";
import { withIcon } from "./snippet-icon";
import { oldStub } from "./snippet-template";
import { asBody, newHubPage, pageDiffers, templatePage, type HubKind } from "./tidy-hubs";
import type { WinState } from "./window-look";

export type MigrationOp =
  /** A property with this value (e.g. `Type: Wiki`) becomes another property and value (`kind: concept`). Skipped when the new property exists. */
  | { op: "replace-property"; from: string; whenValue: string; to: string; value: string }
  /** Adds the property, empty or with `value`, when the note doesn't have it. */
  | { op: "add-property"; name: string; value: string }
  /** A property written as a list with one item becomes plain text (`Status: [Planned]` → `Status: Planned`). Several items: reported, not changed. */
  | { op: "list-to-text"; name: string }
  /** Moves a folder or file (Obsidian's rename, so links update). Only for `scope: "vault"`. Not done when the new place is taken. */
  | { op: "move"; from: string; to: string };

export interface Migration {
  id: string; title: string;
  /** Which notes it looks at: the Lab notes folder or the Knowledge folder (the folders in the settings), or the whole vault (moves). */
  scope: "lab" | "knowledge" | "chemical" | "vault";
  /** Only notes whose name matches this expression (without `.md`), e.g. numbered lab notes. */
  nameMatch?: string;
  /** Apply the rest only when the first op changed the note. */
  onlyIfMatched?: boolean;
  ops: MigrationOp[];
}

export interface TidyContext {
  labFolder: string; knowledgeFolder: string; inboxFolder: string;
  /** The Chemical folder; missing or empty = the chemical rule is off. */
  chemicalFolder?: string;
  /** Top-level folders notes belong in. Empty = don't report notes outside the contract. */
  contractFolders: string[];
  /** Notes allowed at the vault root (the homepage). */
  rootNotes: string[];
  migrations: Migration[];
  /** Top-level folders that should have a hub note (Go to link). Missing = the rule is off. */
  hubFolders?: string[];
  /** Meetings rule (Phase 7c): the meetings and to-do folders, today (YYYY-MM-DD) and what the user chose for the old hub. Missing = the rule is off. */
  meetings?: { folder: string; todos: string; today: string; interval: string; day: string };
  /** The lists of a meeting note as they are now (null: no since and date). Missing = the freeze rule is off. */
  freeze?: (path: string) => FreezeData | null;
  /** Folders whose notes (directly in them) and the root notes are read for old `BUTTON[...]` lines. Missing = the button rule has nothing to read. */
  buttonFolders?: string[];
  /** The Projects folder (project hubs). Missing = the project rule is off. */
  projectsFolder?: string;
  /** The Project hub template's note text (after its Templater header): a missing hub is made from it. Without it a missing hub is only its properties. */
  projectHubText?: string;
  /** The three hub templates' text (with their Templater header): the hub body rule rewrites a hub's page from them. Missing = the rule is off. */
  hubTemplates?: { project: string; topic: string; series: string };
  /** Plugin settings the settings rules look at (Phase 7c-2); each part missing when that plugin isn't loaded. */
  settings?: TidySettings;
  /** The Snippets folder of the Lab kit's templates. Missing = the old-stub rule is off. */
  snippetsFolder?: string;
  /** The icons saved under the old Settings → Snippet icons page (`kit.snippetIcons`, snippet name → icon). Missing or empty = the icons rule is off. */
  snippetIcons?: Record<string, string>;
  /** Paths of the kit's snippet files nobody has edited: their icon is not written (a kit update would meet it). */
  kitSnippets?: string[];
  /** I2: every note is read, for kept kit queries and your own queries that read the old to-do `day`. Missing = those rules are off. */
  todoQueries?: boolean;
}

/** A Meta Bind button action as saved (`type` plus its own fields). */
export type ButtonAction = { type?: string; command?: string; templateFile?: string; [k: string]: unknown };
export interface TidySettings {
  templater?: { startup: string[]; folders: { folder: string; template: string }[]; hotkeys: string[] };
  metaBind?: { id: string; actions: ButtonAction[] }[];
  /** Ids of the commands that have an Obsidian hotkey (only `templater-obsidian:` ones matter). */
  hotkeyCommands?: string[];
}
export type TidySettingTarget = "templater-startup" | "templater-folder" | "templater-hotkey" | "metabind-button";
/** One settings value to change: `key` finds it (the old path, the folder, the button id); it is changed only while it still equals `from`. */
export interface TidySetting { target: TidySettingTarget; key: string; from: unknown; to: unknown }

/** One vault file. `text` only for notes the scan needs to read (see `wantsText`). */
export interface TidyFile { path: string; text?: string }

/** A proposed change to one note's properties: `before` / `after` are the properties block (between the `---` lines), nothing else. */
export interface TidyChange {
  path: string; before: string; after: string;
  /** A move: the new path (`before` / `after` are empty). `note` says what is moved (e.g. "12 files"). */
  to?: string; note?: string;
  /** A new note at `path` whose properties are `after` (`before` is empty); never replaces a file. */
  create?: boolean;
  /** With `create`: the whole text of the new note (else `---` + `after` + `---`). */
  text?: string;
  /** The page below the properties is replaced: `before` / `after` are that page's text, not the properties. */
  body?: boolean;
  /** The file goes to Obsidian's trash (the user's own trash setting decides where); `before` / `after` are empty. A copy goes to the backups folder first. */
  trash?: boolean;
  /** A plugin setting rather than a note: `path` is the label shown, `before` / `after` the lines shown. */
  setting?: TidySetting;
}
/** `ask`: the window shows this rule's questions (the meetings rule asks how often and on which day). */
export interface TidyGroup { id: string; title: string; detail: string; changes: TidyChange[]; ask?: "meetings";
  /** Not ticked until the user ticks it (a rule that replaces text the user may have written). */
  optIn?: boolean }
export interface TidyReported { id: string; title: string; detail: string; items: { path: string; note?: string }[] }
export interface TidyScan { groups: TidyGroup[]; reported: TidyReported[] }

export interface DiffRow { kind: "same" | "added" | "removed" | "changed"; left: string | null; right: string | null }

/* ---- Properties block ---- */

const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, " ").trim();
const unquote = (s: string): string => { const t = s.trim(); return /^(".*"|'.*')$/.test(t) && t.length >= 2 ? t.slice(1, -1) : t; };
const lower = (s: string): string => s.toLowerCase();

/** The properties lines and the text after them; null when the note has no properties block. */
function split(text: string): { fm: string[]; body: string } | null {
  const t = text.replace(/\r\n/g, "\n");
  if (!t.startsWith("---\n")) return null;
  let end = t.indexOf("\n---", 3);
  while (end !== -1 && !(t.length === end + 4 || t[end + 4] === "\n")) end = t.indexOf("\n---", end + 1);
  if (end === -1) return null;
  const block = t.slice(4, Math.max(4, end));
  return { fm: block === "" ? [] : block.split("\n"), body: t.slice(end + 4) };
}

interface Prop { key: string; start: number; end: number; inline: string; items: string[] | null }
const KEY = /^([^\s#-][^:]*):(.*)$/;

function props(lines: string[]): Prop[] {
  const out: Prop[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = KEY.exec(lines[i]);
    if (!m) continue;
    let end = i + 1;
    while (end < lines.length && (!KEY.test(lines[end]) || /^\s*-/.test(lines[end]))) end++;
    const inline = m[2].trim();
    let items: string[] | null = null;
    if (inline.startsWith("[") && inline.endsWith("]")) items = inline.slice(1, -1).split(",").map(unquote).filter(Boolean);
    else if (inline === "") items = lines.slice(i + 1, end).map(l => /^\s*-\s*(.*)$/.exec(l)).filter((x): x is RegExpExecArray => !!x).map(x => unquote(x[1])).filter(Boolean);
    out.push({ key: m[1].trim(), start: i, end, inline, items });
    i = end - 1;
  }
  return out;
}

const find = (lines: string[], name: string): Prop | undefined => props(lines).find(p => norm(p.key) === norm(name));
/** A property's values as text: the list items, or the one plain value; empty when missing or blank. */
const values = (p: Prop | undefined): string[] => !p ? [] : p.items ?? (p.inline ? [unquote(p.inline)] : []);
/** Sets a property only when it is missing or empty (an empty `key:` is filled in place, a filled one is kept). */
const fillProp = (fm: string[], name: string, value: string): string[] => {
  const p = find(fm, name);
  if (!p) return [...fm, line(name, value)];
  return values(p).length ? fm : [...fm.slice(0, p.start), line(p.key, value), ...fm.slice(p.end)];
};
const line = (name: string, value: string): string => value === "" ? `${name}:` : `${name}: ${value}`;
/** The classes the kit's templates write (`vt` styles the planning theme): added to `cssclasses`, yours kept in order. Unchanged when all are there. */
const withClasses = (fm: string[], classes: string[]): string[] => {
  const p = find(fm, "cssclasses");
  const have = values(p).flatMap(v => v.split(/\s+/)).filter(Boolean);
  const miss = classes.filter(c => !have.includes(c));
  if (!miss.length) return fm;
  const block = ["cssclasses:", ...[...have, ...miss].map(c => `  - ${c}`)];
  return p ? [...fm.slice(0, p.start), ...block, ...fm.slice(p.end)] : [...fm, ...block];
};

type Result = { fm: string[] } | { reported: string } | null;

function runOp(fm: string[], op: MigrationOp): Result {
  if (op.op === "move") return null;
  if (op.op === "add-property") return find(fm, op.name) ? null : { fm: [...fm, line(op.name, op.value)] };
  if (op.op === "list-to-text") {
    const p = find(fm, op.name);
    if (!p || p.items === null || p.items.length === 0) return null;
    if (p.items.length > 1) return { reported: `${p.key} has ${p.items.length} values (${p.items.join(", ")}): left as it is` };
    return { fm: [...fm.slice(0, p.start), line(p.key, p.items[0]), ...fm.slice(p.end)] };
  }
  const p = find(fm, op.from);
  const vals = values(p);
  if (!p || vals.length !== 1 || lower(vals[0]) !== lower(op.whenValue)) return null;
  const target = find(fm, op.to);
  if (target && values(target).length) return { reported: `${p.key}: ${vals[0]} but ${op.to} is already set: left as it is` };
  // an empty target (`kind:`) is not set: its lines are dropped and the renamed line takes the old one's place
  const drop = (i: number): boolean => !!target && i >= target.start && i < target.end;
  return { fm: [...fm.slice(0, p.start).filter((_, i) => !drop(i)), line(op.to, op.value), ...fm.slice(p.end).filter((_, i) => !drop(i + p.end))] };
}

/** Runs one migration on one note's text. A change, a reason it was left alone, or null (nothing to do). */
export function applyMigration(text: string, mig: Migration): { change: { before: string; after: string } } | { reported: string } | null {
  const s = split(text) ?? { fm: [], body: text };   // no properties block: the ops see an empty one (add-property makes it)
  let fm = s.fm, changed = false;
  for (const [i, op] of mig.ops.entries()) {
    const r = runOp(fm, op);
    if (r && "reported" in r) return changed ? null : r;
    if (r) { fm = r.fm; changed = true; }
    else if (i === 0 && mig.onlyIfMatched) return null;
  }
  return changed ? { change: { before: s.fm.join("\n"), after: fm.join("\n") } } : null;
}

/**
 * The note's text with its properties block changed from `before` to `after` (what the window showed). Null when the block is not `before`
 * any more (the note changed since the scan). A note with no block (`before` empty) gets one. Line endings are kept.
 */
export function replaceProperties(text: string, before: string, after: string): string | null {
  const crlf = text.includes("\r\n"), t = text.replace(/\r\n/g, "\n");
  const s = split(t);
  let out: string;
  if (!s) { if (before !== "" || after === "") return null; out = `---\n${after}\n---\n${t}`; }
  else if (s.fm.join("\n") !== before) return null;
  else out = `---\n${after}${after ? "\n" : ""}---${s.body}`;
  return crlf ? out.replace(/\n/g, "\r\n") : out;
}

/* ---- To-dos on planned dates (I2) ---- */

/** The kit's to-do query lines as shipped before I2, and what they read now (Weekly review Backlog; the Daily note's Planned for today). */
export const OLD_TODO_QUERIES: [string, string][] = [
  ['WHERE kind = "todo" AND day = "Backlog" AND !done',
    'WHERE kind = "todo" AND !scheduled AND !contains(list("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Done"), day) AND !done'],
  ['WHERE kind = "todo" AND !done AND day != "Done" AND (day = dateformat(date(this.file.name), "ccc") OR (due AND due <= date(this.file.name)))',
    'WHERE kind = "todo" AND !done AND day != "Done" AND ((scheduled AND scheduled <= date(this.file.name)) OR (!scheduled AND day = dateformat(date(this.file.name), "ccc")) OR (due AND due <= date(this.file.name)))'],
];
/** What the kit's own queries say about `day` (they stay right on dates): taken out before looking for another use of `day`. */
const KIT_DAY_READS = [/day\s*!=\s*"Done"/g, /day\s*=\s*"Done"/g, /contains\(list\([^)]*\),\s*day\)/g, /!scheduled AND day = dateformat\(date\(this\.file\.name\),\s*"ccc"\)/g, /dur\([^)]*\)/g, /"[^"]*"/g];
/** A query line (inside a code block) that reads the to-do property `day` in a way the kit's queries don't. */
function readsDay(l: string): boolean {
  const rest = KIT_DAY_READS.reduce((t, re) => t.replace(re, ""), l);
  return /(^|[^\w.])day\b(?!\s*\()/.test(rest) && !/^\s*(\/\/|%%)/.test(l);
}

/** The properties as the to-do rules read them: true / false, a list, text; an empty value is null. */
function fmObject(lines: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of props(lines)) {
    const v = unquote(p.inline);
    out[p.key.trim()] = p.inline.startsWith("[") || (p.inline === "" && p.end > p.start + 1) ? p.items ?? []
      : p.inline === "" ? null : v === "true" ? true : v === "false" ? false : v;
  }
  return out;
}
/** A to-do patch on the properties lines: removed keys go, a changed key keeps its place, a new one goes before `cssclasses` (else last). */
function patchLines(lines: string[], p: TodoPatch): string[] {
  let fm = lines;
  for (const k of p.remove) { const q = find(fm, k); if (q) fm = [...fm.slice(0, q.start), ...fm.slice(q.end)]; }
  for (const [k, v] of Object.entries(p.set)) {
    const q = find(fm, k), l = line(k, String(v)), c = find(fm, "cssclasses");
    fm = q ? [...fm.slice(0, q.start), l, ...fm.slice(q.end)] : c ? [...fm.slice(0, c.start), l, ...fm.slice(c.start)] : [...fm, l];
  }
  return fm;
}

/* ---- Scan ---- */

export const inFolder = (path: string, folder: string): boolean => !!folder && path.startsWith(folder.replace(/\/+$/, "") + "/");
const isNote = (p: string): boolean => p.endsWith(".md");
const baseName = (p: string): string => p.slice(p.lastIndexOf("/") + 1).replace(/\.[^.]+$/, "");
const parentOf = (p: string): string => p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
const hidden = (p: string): boolean => p.split("/").some(s => s.startsWith("."));

/** Index and hub notes: named "index", "… index", or like their folder. */
function isHubName(path: string): boolean {
  const name = lower(baseName(path)), parent = lower(baseName(parentOf(path)));
  return name === "index" || name.endsWith(" index") || (!!parent && name === parent);
}

/** Does the scan need this note's text? (The caller reads only those: a whole-vault read is for finding unused view.js, and for the to-do query rules.) */
export function wantsText(path: string, ctx: TidyContext, readAll: boolean): boolean {
  if (!isNote(path) || hidden(path)) return false;
  return readAll || !!ctx.todoQueries || readForRules(path, ctx) || (!!ctx.snippetsFolder && parentOf(path) === ctx.snippetsFolder.replace(/\/+$/, ""));
}
/** The notes the folder rules read (the button rule looks only at these, unless a view.js made the scan read every note). */
function readForRules(path: string, ctx: TidyContext): boolean {
  return inFolder(path, ctx.labFolder) || (!!ctx.chemicalFolder && inFolder(path, ctx.chemicalFolder)) || inFolder(path, ctx.knowledgeFolder) || isHubName(path)
    || (!!ctx.meetings && (inFolder(path, ctx.meetings.folder) || inFolder(path, ctx.meetings.todos)))
    || (!!ctx.projectsFolder && inFolder(path, ctx.projectsFolder))
    || (ctx.hubFolders ?? []).some(f => parentOf(path) === f)
    || ctx.rootNotes.includes(path) || (ctx.buttonFolders ?? []).some(f => parentOf(path) === f);
}

const topFolder = (p: string): string => p.includes("/") ? p.slice(0, p.indexOf("/")) : "";

/** Lab Kit commands that replace the old template-file buttons, by the template's file name (lower case, without .md). */
const BUTTON_COMMANDS: Record<string, string> = {
  "sort inbox": "lab-kit:sort-inbox", "archive old to-dos": "lab-kit:archive-todos", "open thursday deck": "lab-kit:open-deck",
  "new weekly meeting": "lab-kit:new-meeting", "new to-do": "lab-kit:new-todo",
};

/** The block a project note starts with: a link to its project's hub (the New project note template writes the same). */
const BACK_TO_PROJECT = "```vault-card\nshow: back-to-project\n```";

/** A line that is only Meta Bind buttons (`BUTTON[a, b]` in backticks). */
const BUTTON_LINE = /^`BUTTON\[([^\]]*)\]`[ \t]*$/;

/** The plugin's button bar for these ids (the planning kit's notes write the same). */
const buttonBlock = (ids: string[]): string => `\`\`\`vault-card\nshow: button-bar\nids: ${ids.join(", ")}\n\`\`\``;

/** The chip bar a to-do starts with (the To-do template writes the same). */
const TODO_BAR = "```vault-card\nshow: todo-bar\n```";

export function scan(files: TidyFile[], ctx: TidyContext): TidyScan {
  const groups: TidyGroup[] = [];
  const skipped: TidyReported = { id: "left-alone", title: "Left as they are", detail: "A rule matched, but changing the note would mean guessing.", items: [] };
  const effective = new Map<string, string>();   // each note's text with the proposed changes applied
  const notes = files.filter(f => isNote(f.path) && !hidden(f.path) && f.text !== undefined).sort((a, b) => a.path.localeCompare(b.path));
  for (const n of notes) effective.set(n.path, n.text ?? "");

  for (const mig of ctx.migrations) {
    const g: TidyGroup = { id: mig.id, title: mig.title, detail: "", changes: [] };
    if (mig.scope === "vault") {
      for (const op of mig.ops) {
        if (op.op !== "move") continue;
        const from = op.from.replace(/\/+$/, ""), to = op.to.replace(/\/+$/, "");
        const inside = files.filter(f => f.path === from || f.path.startsWith(from + "/"));
        if (!inside.length) continue;
        if (files.some(f => f.path === to || f.path.startsWith(to + "/"))) { skipped.items.push({ path: from, note: `${to} already exists: not moved` }); continue; }
        g.changes.push({ path: from, before: "", after: "", to, note: `${inside.length} ${inside.length === 1 ? "file" : "files"}` });
      }
      if (g.changes.length) groups.push(g);
      continue;
    }
    const folder = mig.scope === "lab" ? ctx.labFolder : mig.scope === "chemical" ? ctx.chemicalFolder ?? "" : ctx.knowledgeFolder;
    const name = mig.nameMatch ? new RegExp(mig.nameMatch) : null;
    for (const n of notes.filter(x => inFolder(x.path, folder) && (!name || name.test(baseName(x.path))))) {
      const r = applyMigration(effective.get(n.path) ?? "", mig);
      if (!r) continue;
      if ("reported" in r) { skipped.items.push({ path: n.path, note: r.reported }); continue; }
      g.changes.push({ path: n.path, ...r.change });
      const cur = effective.get(n.path) ?? "", s = split(cur);
      effective.set(n.path, s ? `---\n${r.change.after}${r.change.after ? "\n" : ""}---${s.body}` : `---\n${r.change.after}\n---\n${cur}`);
    }
    if (g.changes.length) groups.push(g);
  }

  // Meetings (Phase 7c): old weekly-meeting hub → series hub, meeting notes get `series`, to-dos `meeting: true` → a link
  const put = (path: string, after: string): void => {
    const cur = effective.get(path) ?? "", s = split(cur);
    effective.set(path, s ? `---\n${after}${after ? "\n" : ""}---${s.body}` : `---\n${after}\n---\n${cur}`);
  };
  const fmOf = (path: string): string[] => split(effective.get(path) ?? "")?.fm ?? [];
  const kindOf = (path: string): string => values(find(fmOf(path), "kind")).map(lower)[0] ?? "";
  const mt = ctx.meetings;
  if (mt) {
    const g: TidyGroup = { id: "meetings", title: "Meetings: series hub and links", detail: "The old weekly-meeting hub becomes a meeting series, meeting notes get a series link and to-dos flagged with meeting: true link to the first series.", changes: [], ask: "meetings" };
    const inMeet = notes.filter(n => inFolder(n.path, mt.folder));
    const propose = (path: string, fm0: string[]): void => { const fm = withClasses(fm0, ["vt"]); g.changes.push({ path, before: split(effective.get(path) ?? "")?.fm.join("\n") ?? "", after: fm.join("\n") }); put(path, fm.join("\n")); };
    for (const n of inMeet.filter(x => baseName(x.path) === baseName(parentOf(x.path)) && kindOf(x.path) === "hub" && !values(find(fmOf(x.path), "interval")).length)) {
      let fm = fmOf(n.path);
      const k = find(fm, "kind");
      fm = k ? [...fm.slice(0, k.start), "kind: meeting-series", ...fm.slice(k.end)] : [...fm, "kind: meeting-series"];
      for (const [key, val] of [["interval", mt.interval], ["day", mt.day], ["start", mt.today]]) fm = fillProp(fm, key, val);
      propose(n.path, fm);
    }
    const series = inMeet.filter(x => kindOf(x.path) === "meeting-series").map(x => ({ name: baseName(x.path), folder: parentOf(x.path) }));
    for (const n of inMeet.filter(x => kindOf(x.path) === "meeting" && !values(find(fmOf(x.path), "series")).length)) {
      const hub = series.find(x => x.folder === parentOf(n.path));
      if (!hub) { skipped.items.push({ path: n.path, note: "meeting note, but no series hub in the same folder: left as it is" }); continue; }
      propose(n.path, [...fmOf(n.path), `series: "[[${hub.name}]]"`]);
    }
    const first = firstSeries(series)?.name;
    for (const n of notes.filter(x => inFolder(x.path, mt.todos))) {
      const p = find(fmOf(n.path), "meeting");
      if (!p || values(p).length !== 1 || lower(values(p)[0]) !== "true") continue;
      if (!first) { skipped.items.push({ path: n.path, note: "meeting: true, but there is no meeting series to link to: left as it is" }); continue; }
      const fm = fmOf(n.path);
      propose(n.path, [...fm.slice(0, p.start), `meeting: "[[${first}]]"`, ...fm.slice(p.end)]);
    }
    if (g.changes.length) groups.push(g);
  }

  // Meeting notes made before projects: the `project` property (a link or a list of links), empty, so a project hub can list them
  if (mt) {
    const g: TidyGroup = { id: "meeting-project", title: "Meeting notes: add the project property", detail: "Meeting notes (kind: meeting) without a project property get an empty one; set it to a project hub to show the meeting on that project.", changes: [] };
    for (const n of notes.filter(x => inFolder(x.path, mt.folder) && kindOf(x.path) === "meeting" && !find(fmOf(x.path), "project"))) {
      const fm = fmOf(n.path), after = withClasses([...fm, line("project", "")], ["vt"]);
      g.changes.push({ path: n.path, before: fm.join("\n"), after: after.join("\n") });
      put(n.path, after.join("\n"));
    }
    if (g.changes.length) groups.push(g);
  }

  // Project hubs made before deadlines (or before `kind`): the properties the Project hub template has. A note named like its folder, directly in a
  // project folder, is a hub even without `kind`; it gets `kind: project` too.
  if (ctx.projectsFolder) {
    const pf = ctx.projectsFolder;
    const isHub = (path: string): boolean => kindOf(path) === "project" || (kindOf(path) === "" && parentOf(parentOf(path)) === pf && baseName(path) === baseName(parentOf(path)));
    const g: TidyGroup = { id: "project-properties", title: "Project hubs: add the template's missing properties", detail: "Project hubs (kind: project, or a note named like its project folder) get kind: project, Status: Active, an empty deadline and the vt and project classes when they lack them (only the ones they lack).", changes: [] };
    for (const n of notes.filter(x => inFolder(x.path, pf) && isHub(x.path))) {
      const fm = fmOf(n.path);
      const needKind = kindOf(n.path) !== "project";   // a hub found by its name only (empty or no kind)
      const withKind = needKind ? fillProp(fm, "kind", "project") : fm;
      const add = ([["Status", "Active"], ["deadline", ""]] as const).filter(([k]) => !find(fm, k)).map(([k, v]) => line(k, v));
      const full = withClasses([...withKind, ...add], ["vt", "project"]);
      if (full.join("\n") === fm.join("\n")) continue;
      g.changes.push({ path: n.path, before: fm.join("\n"), after: full.join("\n") });
      put(n.path, full.join("\n"));
    }
    if (g.changes.length) groups.push(g);

    // Notes in a project's folder: the `project` property, a link to the folder's hub (what the New project note template writes). Only where the hub exists or this scan makes it.
    // A project folder with notes but no hub gets one below (project-hub-missing): its notes are linked to that hub in the same scan, not in a second one
    const projectFolders = [...new Set(files.filter(f => inFolder(f.path, pf) && !hidden(f.path)).map(f => f.path.slice(pf.length + 1)).filter(r => r.includes("/")).map(r => r.split("/")[0]))].sort();
    const newHubs = projectFolders.map(name => ({ folder: `${pf}/${name}`, path: `${pf}/${name}/${name}.md` }))
      .filter(h => !files.some(f => f.path === h.path) && !notes.some(x => parentOf(x.path) === h.folder && kindOf(x.path) === "project")).map(h => h.path);
    const hubs = new Set([...notes.filter(x => inFolder(x.path, pf) && isHub(x.path)).map(x => x.path), ...newHubs]);
    const g2: TidyGroup = { id: "project-notes", title: "Project notes: add the project property", detail: "Notes inside a project's folder (not the hub, not to-dos, meetings or literature) without a project property get a link to that project's hub; notes without the vt class get it; a back link to the project hub is added at the top of the page (a page change, shown as such).", changes: [] };
    for (const n of notes.filter(x => inFolder(x.path, pf) && !hubs.has(x.path))) {
      const name = n.path.slice(pf.length + 1).split("/")[0];
      if (!name || !hubs.has(`${pf}/${name}/${name}.md`) || ["todo", "meeting", "literature", "hub", "project"].includes(kindOf(n.path))) continue;
      const fm = fmOf(n.path), p = find(fm, "project");
      const item = ["project:", `  - "[[${name}]]"`];
      const linked = p && values(p).length ? fm : p ? [...fm.slice(0, p.start), ...item, ...fm.slice(p.end)] : [...fm, ...item];
      const after = withClasses(linked, ["vt"]);
      if (after.join("\n") !== fm.join("\n")) {
        g2.changes.push({ path: n.path, before: fm.join("\n"), after: after.join("\n") });
        put(n.path, after.join("\n"));
      }
      // a link back to the project's hub at the top of the page, like the New project note template writes
      const body = split(effective.get(n.path) ?? "")?.body;
      if (body !== undefined && !body.includes("show: back-to-project")) g2.changes.push({ path: n.path, before: body, after: `\n\n${BACK_TO_PROJECT}\n${body.replace(/^\n+/, "\n")}`, body: true });
    }
    if (g2.changes.length) groups.push(g2);

    // A project folder with notes but no hub note (it was deleted): make it again from the Project hub template, named like the folder
    const g3: TidyGroup = { id: "project-hub-missing", title: "Project folders without a hub note", detail: "A folder under Projects that holds notes but has no hub note (kind: project) gets a new hub, named like the folder, made from the Project hub template. Existing notes are not touched; their project links work again.", changes: [] };
    for (const path of newHubs) {
      g3.changes.push({ path, before: "", after: "kind: project\nStatus: Active\ndeadline:\ncssclasses:\n  - vt\n  - project", create: true, ...(ctx.projectHubText ? { text: ctx.projectHubText } : {}) });
    }
    if (g3.changes.length) groups.push(g3);
  }

  // Hub pages: the page below a hub's properties becomes the template's (new buttons and tiles), keeping the goal, Related text and a topic's intro
  if (ctx.hubTemplates) {
    const g: TidyGroup = { id: "hub-body", title: "Hubs: bring the page up to the current template", detail: "Project, topic and meeting series hubs get the page the kit's template has now (back link, buttons, tiles). A project keeps its goal and what is under Related; a topic keeps its intro text; anything else on the page is replaced. Not ticked until you tick it; each note is backed up first.", changes: [], optIn: true };
    const kindFor = (path: string): HubKind | null => {
      const k = kindOf(path), folder = parentOf(path);
      if (baseName(path) !== baseName(folder)) return null;
      if (k === "project" && ctx.projectsFolder && parentOf(folder) === ctx.projectsFolder) return "project";
      if (k === "hub" && ctx.knowledgeFolder && parentOf(folder) === ctx.knowledgeFolder) return "topic";
      if (k === "meeting-series" && mt && parentOf(folder) === mt.folder) return "series";
      return null;
    };
    for (const n of notes) {
      const kind = kindFor(n.path);
      const s = kind ? split(effective.get(n.path) ?? "") : null;
      if (!kind || !s) continue;
      const page = templatePage(ctx.hubTemplates[kind], parentOf(n.path));
      const next = newHubPage(kind, page, s.body);
      if (!pageDiffers(s.body, next)) continue;
      g.changes.push({ path: n.path, before: s.body, after: asBody(next), body: true });
    }
    if (g.changes.length) groups.push(g);
  }

  // To-dos: a note in the to-dos folder with no `kind` (a quick capture, a hand-made note) gets the properties the board reads. Notes that have a kind are left alone.
  if (mt) {
    const g: TidyGroup = { id: "todo-properties", title: "To-dos: add the properties the board needs", detail: "Notes in the to-dos folder without a kind property (or with an empty one) get kind: todo and done: false (only the ones they lack); no date puts them in the Backlog.", changes: [] };
    for (const n of notes.filter(x => inFolder(x.path, mt.todos))) {
      const fm = fmOf(n.path);
      const kind = find(fm, "kind");
      if (kind && values(kind).length) continue;
      // an empty `kind:` (Obsidian shows "Empty") counts as no kind: fill that line in place
      const base = kind ? [...fm.slice(0, kind.start), line("kind", "todo"), ...fm.slice(kind.end)] : fm;
      const add = ([["kind", "todo"], ["done", "false"]] as const).filter(([k]) => !find(base, k)).map(([k, v]) => line(k, v));
      const full = withClasses([...base, ...add], ["vt"]);
      g.changes.push({ path: n.path, before: fm.join("\n"), after: full.join("\n") });
      put(n.path, full.join("\n"));
    }
    if (g.changes.length) groups.push(g);

    // Meeting notes before the newest of their series are frozen (I19, I20): lists written out as links, `frozen` set, flagged to-dos stamped `raised_on`. Opt-in: it replaces generated text in many notes.
    if (ctx.freeze) {
      const fz: TidyGroup = { id: "meeting-freeze", title: "Meetings: freeze old meeting notes", detail: "Meeting notes dated before the newest one of their series get their generated lists (experiments, done, papers, waiting, flagged) written out as plain links, and the date frozen. What you wrote is kept. To-dos in the flagged list are stamped with raised_on. Not ticked until you tick it; each note is backed up first.", changes: [], optIn: true };
      const dateOf = (path: string): string => (values(find(fmOf(path), "date"))[0] ?? "").slice(0, 10);
      const meet = notes.filter(n => inFolder(n.path, mt.folder) && kindOf(n.path) === "meeting" && dateOf(n.path));
      const oneOff = new Set(notes.filter(n => kindOf(n.path) === "meeting-series" && (values(find(fmOf(n.path), "interval"))[0] ?? "").toLowerCase() === "once").map(n => parentOf(n.path)));
      const newest = new Map<string, string>();
      for (const n of meet) newest.set(parentOf(n.path), [newest.get(parentOf(n.path)) ?? "", dateOf(n.path)].sort()[1]);
      // Worked out from each note as it is on disk, not from the other rules' proposals, so the rule works when it is the only one ticked (a note another ticked rule also changes is skipped by Change notes… and found again by the next scan)
      const disk = new Map(notes.map(n => [n.path, n.text ?? ""]));
      const stamps = new Map<string, { change: TidyChange; fm: string[] }>();
      for (const n of meet.filter(x => !oneOff.has(parentOf(x.path)) && dateOf(x.path) < (newest.get(parentOf(x.path)) ?? "") && !find(fmOf(x.path), FROZEN)).sort((a, b) => dateOf(a.path).localeCompare(dateOf(b.path)) || a.path.localeCompare(b.path))) {
        const data = ctx.freeze(n.path), date = dateOf(n.path);
        if (!data) { skipped.items.push({ path: n.path, note: "meeting note without since and date properties: not frozen" }); continue; }
        const s = split(disk.get(n.path) ?? "");
        if (!s) continue;
        const body = freezeBody(s.body, data.lists);
        fz.changes.push({ path: n.path, before: s.fm.join("\n"), after: [...s.fm, line(FROZEN, mt.today)].join("\n") });
        if (body !== s.body) fz.changes.push({ path: n.path, before: s.body, after: body, body: true });
        for (const t of data.flagged) {
          const prior = stamps.get(t.path), tf = prior?.fm ?? split(disk.get(t.path) ?? "")?.fm;
          const stamp = tf ? raisedStamp(values(find(tf, RAISED))[0], date) : null;
          if (!tf || !stamp) continue;
          const had = find(tf, RAISED), next = had ? [...tf.slice(0, had.start), line(RAISED, stamp), ...tf.slice(had.end)] : [...tf, line(RAISED, stamp)];
          if (prior) { prior.change.after = next.join("\n"); prior.fm = next; }
          else { const change = { path: t.path, before: tf.join("\n"), after: next.join("\n") }; stamps.set(t.path, { change, fm: next }); fz.changes.push(change); }
        }
      }
      if (fz.changes.length) groups.push(fz);
    }

    // The chip bar at the top of each to-do (show: todo-bar): opt-in, because it touches every to-do
    const bar: TidyGroup = { id: "todo-bar", title: "To-dos: add the chip bar", detail: "Every to-do (kind: todo) gets the bar of chips (project, meeting, due, priority) at the top of the page, like the To-do template writes now. Not ticked until you tick it; each note is backed up first.", changes: [], optIn: true };
    for (const n of notes.filter(x => inFolder(x.path, mt.todos) && kindOf(x.path) === "todo")) {
      const body = split(effective.get(n.path) ?? "")?.body;
      if (body !== undefined && !body.includes("show: todo-bar")) bar.changes.push({ path: n.path, before: body, after: `\n\n${TODO_BAR}\n${body.replace(/^\n+/, "\n")}`, body: true });
    }
    if (bar.changes.length) groups.push(bar);

    // I2 planned dates: old to-do properties brought to the slim model, as the engine does for a note arriving in the to-dos folder (the same normalisePatch).
    // Opt-in (Q9: old notes are read as they are). Worked out from each note on disk, like the freeze rule.
    const now = parseDay(mt.today) ?? new Date();
    const dates: TidyGroup = { id: "todo-dates", title: "To-dos: give each card a date", detail: "To-dos with the old day property get the date the board reads it as (scheduled), and lose day, planned, rolled, countdown and empty properties; an old Done card is ticked. The board looks the same afterwards. A day value Lab Kit can't read is kept. Not ticked until you tick it; each note is backed up first.", changes: [], optIn: true };
    for (const n of notes.filter(x => inFolder(x.path, mt.todos))) {
      const s = split(n.text ?? "");
      const p = s ? normalisePatch(fmObject(s.fm), now) : null;
      if (s && p) dates.changes.push({ path: n.path, before: s.fm.join("\n"), after: patchLines(s.fm, p).join("\n") });
    }
    if (dates.changes.length) groups.push(dates);
  }

  // Kept copies of the kit's to-do lists (Weekly review, daily notes) whose query still reads the old `day`: the line becomes the kit's new one. Opt-in.
  // Any other query in a note that reads `day` is only listed.
  const ownQueries: { path: string; note?: string }[] = [];
  if (ctx.todoQueries) {
    const kept: TidyGroup = { id: "todo-queries", title: "To-dos: lists read the planned date", detail: "Your copies of the Weekly review and daily notes list to-dos by the old day property; their query line becomes the kit's new one, which reads scheduled (the rest of the note is kept). Not ticked until you tick it; each note is backed up first.", changes: [], optIn: true };
    for (const n of notes) {
      const text = effective.get(n.path) ?? "", s = split(text), body = s ? s.body : text.replace(/\r\n/g, "\n");
      let fence = false, first = "";
      const out = body.split("\n").map(l => {
        const bare = l.replace(/^(\s*>)*\s?/, "");
        if (/^\s*(```|~~~)/.test(bare)) { fence = !fence; return l; }
        if (!fence) return l;
        const swap = OLD_TODO_QUERIES.find(([old]) => bare.trim() === old);
        if (swap) return l.slice(0, l.length - bare.length) + bare.replace(swap[0], swap[1]);
        if (!first && readsDay(bare)) first = bare.trim();
        return l;
      }).join("\n");
      if (out !== body && s) kept.changes.push({ path: n.path, before: body, after: out, body: true });   // a body change needs a properties block (as the button rule)
      if (first) ownQueries.push({ path: n.path, note: first });
    }
    if (kept.changes.length) groups.push(kept);
  }

  // Buttons: a line that is only Meta Bind buttons becomes the plugin's button bar (the window a button opens then appears under it). Opt-in: it replaces text in many notes. Off with the planning kit.
  if (ctx.buttonFolders) {
    const bar: TidyGroup = { id: "button-bar", title: "Buttons: use the Lab Kit button bar", detail: "A line that holds only Meta Bind buttons (like `BUTTON[new-meeting, go-deck]`) becomes a button-bar block, so the window a button opens appears under it. Lines with other text, buttons Lab Kit does not know, notes in Extras and hub pages (the hub rule rewrites those) are left as they are. Not ticked until you tick it; each note is backed up first.", changes: [], optIn: true };
    const hubPages = new Set((groups.find(g => g.id === "hub-body")?.changes ?? []).map(c => c.path));
    const readAll = files.some(f => /(^|\/)view\.js$/.test(f.path));
    for (const n of notes) {
      if (inFolder(n.path, "Extras") || hubPages.has(n.path) || (!readAll && !readForRules(n.path, ctx))) continue;
      const text = effective.get(n.path) ?? "", s = split(text);
      const body = s ? s.body : text.replace(/\r\n/g, "\n");
      if (!body.includes("BUTTON[")) continue;
      let fence = false;
      const out = body.split("\n").map(l => {
        if (/^\s*(```|~~~)/.test(l)) fence = !fence;
        const m = fence ? null : BUTTON_LINE.exec(l);
        if (!m) return l;
        const ids = m[1].split(",").map(x => x.trim()).filter(Boolean);
        const bad = ids.filter(id => !BAR_BUTTONS.has(id));
        if (!ids.length || bad.length) { skipped.items.push({ path: n.path, note: `button line with ${bad.length ? `${bad.join(", ")}: not a Lab Kit button` : "no buttons"}: left as it is` }); return l; }
        return buttonBlock(ids);
      }).join("\n");
      if (out !== body && s) bar.changes.push({ path: n.path, before: body, after: out, body: true });
    }
    if (bar.changes.length) groups.push(bar);
  }

  // Hubs: index / hub notes without `kind`
  const hubs: TidyGroup = { id: "hub-kind", title: "Add kind: hub to index notes", detail: "Notes named index, “… index” or like their folder that have no kind property.", changes: [] };
  for (const n of notes) {
    if (!isHubName(n.path) || !n.path.includes("/") || inFolder(n.path, "Extras")) continue;
    const s = split(effective.get(n.path) ?? "");
    if (s && values(find(s.fm, "kind")).length) continue;
    hubs.changes.push({ path: n.path, before: s ? s.fm.join("\n") : "", after: withClasses(fillProp(s?.fm ?? [], "kind", "hub"), ["vt"]).join("\n") });
  }
  if (hubs.changes.length) groups.push(hubs);

  // Folders without a hub note (same test as Go to): a new `<Folder>.md` with kind: hub. Only creates.
  const missing: TidyGroup = { id: "hub-missing", title: "Add a hub note to folders without one", detail: "Go to links need a hub note (kind: hub) in the folder. The new note is empty apart from that.", changes: [] };
  const proposed = new Set(hubs.changes.map(c => c.path));
  for (const folder of ctx.hubFolders ?? []) {
    if (folder.includes("/") || !files.some(f => inFolder(f.path, folder))) continue;
    const has = files.some(f => parentOf(f.path) === folder && !hidden(f.path) && (f.path.endsWith(".base") || proposed.has(f.path)
      || (isNote(f.path) && (baseName(f.path) === unnumbered(folder) || kindOf(f.path) === "hub"))));
    const path = `${folder}/${unnumbered(folder)}.md`;
    if (!has && !files.some(f => f.path === path)) missing.changes.push({ path, before: "", after: "kind: hub\ncssclasses:\n  - vt", create: true });
  }
  if (missing.changes.length) groups.push(missing);

  // Snippets: the old NMR / GPC / DLS stub files (the Alt+S menu lists those three itself since Phase 3). Opt-in: a file goes to the trash.
  if (ctx.snippetsFolder) {
    const folder = ctx.snippetsFolder.replace(/\/+$/, "");
    const stubs: TidyGroup = { id: "snippet-stubs", title: "Snippets: old NMR, GPC and DLS files", detail: "The menu now lists NMR, GPC and DLS itself. These files show them a second time. Moved to Obsidian's trash (you can get them back). Not ticked until you tick it; each file is copied to the backups folder first.", changes: [], optIn: true };
    for (const n of notes) {
      if (parentOf(n.path) !== folder) continue;
      const stub = oldStub(n.text ?? "");
      if (stub && ["nmr", "gpc", "dls"].includes(stub.run)) stubs.changes.push({ path: n.path, before: "", after: "", trash: true, note: stub.run.toUpperCase() });
    }
    if (stubs.changes.length) groups.push(stubs);
  }

  // Snippets: icons saved under the old Settings → Snippet icons page go into each snippet's header (`icon:`). Opt-in; a note is backed up first.
  const savedIcons = Object.entries(ctx.snippetIcons ?? {}).map(([name, icon]) => [name.trim(), icon.trim()] as const).filter(([name, icon]) => name && icon);
  if (ctx.snippetsFolder && savedIcons.length) {
    const folder = ctx.snippetsFolder.replace(/\/+$/, "");
    const icons: TidyGroup = { id: "snippet-icons", title: "Snippets: icons from settings into the notes", detail: "Icons picked under Settings → Snippet icons are written into each snippet's header (icon:). The settings page goes. Not ticked until you tick it; each note is backed up first.", changes: [], optIn: true };
    const kit = new Set(ctx.kitSnippets ?? []);
    const nameOf = (path: string): string => baseName(path).replace(/^\d+\s*[-.]?\s*/, "");
    for (const [name, icon] of savedIcons) {
      const hit = notes.find(n => parentOf(n.path) === folder && nameOf(n.path) === name);
      if (!hit) { skipped.items.push({ path: name, note: `Snippet icon “${icon}”: there is no snippet of that name in the Snippets folder: left as it is` }); continue; }
      if (kit.has(hit.path)) { skipped.items.push({ path: hit.path, note: `Snippet icon “${icon}”: a kit file nobody has edited keeps the kit's icon. Make my own copy of it to give the copy an icon` }); continue; }
      const text = hit.text ?? "";
      const s = split(text);
      if (headerIcon(text) === icon) continue;
      const next = s ? withIcon(text, icon) : null;
      const after = next ? split(next) : null;
      if (!s || !after) { skipped.items.push({ path: hit.path, note: `Snippet icon “${icon}”: this snippet has no header to hold it: left as it is` }); continue; }
      icons.changes.push({ path: hit.path, before: s.fm.join("\n"), after: after.fm.join("\n") });
    }
    if (icons.changes.length) groups.push(icons);
  }

  // Plugin settings (Phase 7c-2): Templater paths into moved folders, Meta Bind buttons that run a template file
  const settingsReported: TidyReported[] = [];
  const st = ctx.settings;
  if (st) {
    const moves = ctx.migrations.filter(m => m.scope === "vault").flatMap(m => m.ops).flatMap(o => o.op === "move" ? [{ from: o.from.replace(/\/+$/, ""), to: o.to.replace(/\/+$/, "") }] : []);
    const remap = (v: string): string | null => { for (const m of moves) if (v === m.from || v.startsWith(m.from + "/")) return m.to + v.slice(m.from.length); return null; };
    const moving = (v: string): boolean => groups.some(g => g.changes.some(c => c.to !== undefined && (v === c.path || v.startsWith(c.path + "/"))));
    const there = (to: string, from: string): boolean => files.some(f => f.path === to) || moving(from);
    const tp: TidyGroup = { id: "templater-paths", title: "Templater: paths into renamed folders", detail: "Startup templates, folder templates and template hotkeys that point into a folder this tidy moves.", changes: [] };
    const add = (target: TidySettingTarget, label: string, key: string, from: string, to: string): void => {
      if (!there(to, from)) { skipped.items.push({ path: label, note: `${to} is not there yet: left as it is` }); return; }
      tp.changes.push({ path: label, before: from, after: to, setting: { target, key, from, to } });
    };
    for (const v of st.templater?.startup ?? []) { const n = remap(v); if (n) add("templater-startup", "Templater › Startup templates", v, v, n); }
    for (const f of st.templater?.folders ?? []) { const n = remap(f.template); if (n) add("templater-folder", `Templater › Folder template for ${f.folder}`, f.folder, f.template, n); }
    for (const v of st.templater?.hotkeys ?? []) { const n = remap(v); if (n) add("templater-hotkey", "Templater › Template hotkeys", v, v, n); }
    if (tp.changes.length) groups.push(tp);

    const mb: TidyGroup = { id: "metabind-buttons", title: "Meta Bind: buttons that run a template", detail: "A button that runs a Templater file becomes a button that runs the matching Lab Kit command.", changes: [] };
    const unknown: { path: string; note: string }[] = [];
    const show = (a: ButtonAction): string => `${a.type ?? "?"}${a.command ? ` ${a.command}` : a.templateFile ? ` ${a.templateFile}` : ""}`;
    for (const b of st.metaBind ?? []) {
      let changed = false;
      const actions = b.actions.map((a): ButtonAction => {
        if (a.type !== "runTemplaterFile" || typeof a.templateFile !== "string") return a;
        const command = BUTTON_COMMANDS[lower(baseName(a.templateFile))];
        if (!command) { unknown.push({ path: `Meta Bind › button ${b.id}`, note: `runs ${a.templateFile}: no matching command known` }); return a; }
        changed = true;
        return { type: "command", command };
      });
      if (changed) mb.changes.push({ path: `Meta Bind › button ${b.id}`, before: b.actions.map(show).join("\n"), after: actions.map(show).join("\n"), setting: { target: "metabind-button", key: b.id, from: b.actions, to: actions } });
    }
    if (mb.changes.length) groups.push(mb);
    if (unknown.length) settingsReported.push({ id: "metabind-unknown", title: "Buttons that run a template file", detail: "No Lab Kit command is known for these; change them in Meta Bind's settings.", items: unknown });
    const keys = (st.hotkeyCommands ?? []).filter(c => c.startsWith("templater-obsidian:") && remap(c.slice("templater-obsidian:".length)));
    if (keys.length) settingsReported.push({ id: "hotkeys-renamed", title: "Hotkeys for templates in a renamed folder", detail: "Obsidian keeps these under the old template path; set them again in Settings → Hotkeys.", items: keys.map(path => ({ path })) });
  }

  // Only reported
  const rep = (id: string, title: string, detail: string, items: { path: string; note?: string }[]): TidyReported | null => items.length ? { id, title, detail, items } : null;
  const all = files.filter(f => !hidden(f.path)).map(f => f.path).sort();
  const reported = [
    rep("untitled", "Untitled notes", "Name them, or delete them if they are empty.", all.filter(p => isNote(p) && /^untitled( \d+)?$/i.test(baseName(p))).map(path => ({ path }))),
    rep("double-extension", "Double extensions", "The file name ends in a second .md (like “. md.md”); rename it in Obsidian.", all.filter(p => /\.\s*md\.md$/i.test(p)).map(path => ({ path }))),
    rep("inbox-canvas", "Canvases in the inbox", "The inbox is for notes you will sort; move the canvas.", all.filter(p => p.endsWith(".canvas") && inFolder(p, ctx.inboxFolder)).map(path => ({ path }))),
    rep("outside-contract", "Notes outside the folder layout", "Not in any folder the kits use. Move them in Obsidian (links update).",
      ctx.contractFolders.length ? all.filter(p => isNote(p) && !ctx.contractFolders.includes(topFolder(p)) && !(topFolder(p) === "" && ctx.rootNotes.includes(p))).map(path => ({ path })) : []),
  ];
  const viewJs = all.filter(p => /(^|\/)view\.js$/.test(p));
  const used = (dir: string): boolean => [...effective.values()].some(t => t.includes("dv.view") && t.includes(dir));
  reported.push(rep("unused-view-js", "view.js scripts no note uses", "No note calls this folder with dv.view. Delete it yourself if you don't need it.",
    viewJs.filter(p => !used(parentOf(p))).map(path => ({ path }))));

  // Knowledge notes (as they will be after the changes above): ### headings, no summary, no sources
  const concept = notes.filter(n => inFolder(n.path, ctx.knowledgeFolder)).filter(n => { const s = split(effective.get(n.path) ?? ""); return !!s && values(find(s.fm, "kind")).map(lower).includes("concept"); });
  const heads: { path: string }[] = [], noSummary: { path: string }[] = [], noSources: { path: string }[] = [];
  for (const n of concept) {
    const s = split(effective.get(n.path) ?? "");
    if (!s) continue;
    if (!values(find(s.fm, "summary")).length) noSummary.push({ path: n.path });
    if (!values(find(s.fm, "sources")).length) noSources.push({ path: n.path });
    let fence = false;
    if (s.body.split("\n").some(l => { if (/^\s*(```|~~~)/.test(l)) fence = !fence; return !fence && /^###\s/.test(l); })) heads.push({ path: n.path });
  }
  reported.push(
    rep("knowledge-headings", "Knowledge notes with ### headings", "Section headings use ## in the kit's concept notes. Change them by hand.", heads),
    rep("knowledge-summary", "Knowledge notes without a summary", "Write one line in the summary property.", noSummary),
    rep("knowledge-sources", "Knowledge notes without sources", "Add the sources property (links or references).", noSources));
  reported.push(rep("todo-own-queries", "Your own queries that read day", "A Dataview query in these notes reads the to-do day property. To-dos planned on the board have scheduled (a date) instead; old ones keep day until they are given a date. Change the query by hand (Lab Kit does not rewrite it).", ownQueries));
  reported.push(...settingsReported);
  if (skipped.items.length) reported.unshift(skipped);

  return { groups, reported: reported.filter((r): r is TidyReported => !!r) };
}

/** How many to-dos the applied changes of "To-dos: give each card a date" gave a planned date (`changed`: the notes Change notes… wrote). */
export function datedTodos(s: TidyScan, applied: readonly TidyChange[], changed: readonly string[]): number {
  const g = s.groups.find(x => x.id === "todo-dates");
  return (g?.changes ?? []).filter(c => applied.includes(c) && changed.includes(c.path) && !/^scheduled:/m.test(c.before) && /^scheduled:/m.test(c.after)).length;
}

/** The changes of the rules the user left ticked: the only ones Change notes… may carry out. */
export const selectChanges = (s: TidyScan, ticked: ReadonlySet<string>, off: ReadonlySet<string> = new Set()): TidyChange[] =>
  s.groups.filter(g => ticked.has(g.id)).flatMap(g => g.changes.filter((_, i) => !off.has(changeKey(g.id, i))));

/** One change of a rule, for ticking it on its own ("rule id|position"). */
export const changeKey = (groupId: string, index: number): string => `${groupId}|${index}`;

/* ---- Before / after rows ---- */

/** Line diff of two property blocks, as side-by-side rows: a removed line next to an added one is one "changed" row. */
export function diffRows(before: string, after: string): DiffRow[] {
  const a = before === "" ? [] : before.split("\n"), b = after === "" ? [] : after.split("\n");
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const rows: DiffRow[] = [];
  let i = 0, j = 0, gone: string[] = [], came: string[] = [];
  const flush = (): void => {
    for (let k = 0; k < Math.max(gone.length, came.length); k++) {
      const l = gone[k] ?? null, r = came[k] ?? null;
      rows.push({ kind: l !== null && r !== null ? "changed" : l !== null ? "removed" : "added", left: l, right: r });
    }
    gone = []; came = [];
  };
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { flush(); rows.push({ kind: "same", left: a[i], right: b[j] }); i++; j++; }
    else if (j >= b.length || (i < a.length && lcs[i + 1][j] >= lcs[i][j + 1])) gone.push(a[i++]);
    else came.push(b[j++]);
  }
  flush();
  return rows;
}

/** A run of unchanged rows the window shows as one line ("… N unchanged lines") until it is opened. */
export interface FoldRow { kind: "fold"; rows: DiffRow[] }

/**
 * The rows with the unchanged ones folded away: `context` unchanged rows stay next to every added, removed or changed row, and a longer run
 * between them becomes one fold. A run is folded only when it hides 3 rows or more. Added, removed and changed rows are never folded.
 */
export function foldRows(rows: DiffRow[], context = 1): (DiffRow | FoldRow)[] {
  const keep = rows.map(r => r.kind !== "same");
  rows.forEach((r, i) => { if (r.kind !== "same") for (let k = Math.max(0, i - context); k <= Math.min(rows.length - 1, i + context); k++) keep[k] = true; });
  const out: (DiffRow | FoldRow)[] = [];
  let run: DiffRow[] = [];
  const flush = (): void => { if (run.length >= 3) out.push({ kind: "fold", rows: run }); else out.push(...run); run = []; };
  rows.forEach((r, i) => { if (keep[i]) { flush(); out.push(r); } else run.push(r); });
  flush();
  return out;
}

/** How many rows of each kind a change has, for the short count beside its path ("3 added · 1 changed"). */
export function countRows(rows: DiffRow[]): { added: number; removed: number; changed: number } {
  const n = { added: 0, removed: 0, changed: 0 };
  for (const r of rows) if (r.kind !== "same") n[r.kind]++;
  return n;
}

/** Is this a page change that takes lines away or rewrites them (a hub's page replaced by the template), not one that only adds lines? */
export const replacesPage = (c: TidyChange): boolean => !!c.body && diffRows(c.before, c.after).some(r => r.kind === "removed" || r.kind === "changed");

/** A replaced page in short: your lines that are not in the new page, how many of yours stay, and the new page's lines you did not have. */
export interface PageSummary { lost: string[]; kept: number; added: string[] }

/**
 * Compares a page with the page that replaces it, line by line but not by position: a line counts as kept when the new page has it anywhere,
 * also inside a callout (the leading `>` and spaces are ignored, so a goal moved into the Goal box is kept). Blank lines are left out.
 */
export function pageSummary(before: string, after: string): PageSummary {
  const bare = (l: string): string => l.replace(/^[>\s]+/, "").trim();
  const lines = (t: string): string[] => t.replace(/\r\n/g, "\n").split("\n").filter(l => bare(l) !== "");
  const count = (ls: string[]): Map<string, number> => { const m = new Map<string, number>(); for (const l of ls) m.set(bare(l), (m.get(bare(l)) ?? 0) + 1); return m; };
  /** The lines of `ls` that `other` does not have (each line of `other` is used once). */
  const without = (ls: string[], other: string[]): string[] => {
    const left = count(other);
    return ls.filter(l => { const n = left.get(bare(l)) ?? 0; if (n > 0) { left.set(bare(l), n - 1); return false; } return true; });
  };
  const a = lines(before), b = lines(after), lost = without(a, b);
  return { lost, kept: a.length - lost.length, added: without(b, a) };
}

/**
 * A rule's changes grouped into batches of the same change: the same sort (properties, page, new note) and exactly the same added, removed
 * and changed lines; the unchanged lines around them may differ. A replaced page is compared by the lines it loses and gains (`pageSummary`).
 * Positions in `changes`, in first-seen order. Moves and settings stay alone.
 */
export function batchChanges(changes: TidyChange[]): { indices: number[] }[] {
  const out: { indices: number[] }[] = [], at = new Map<string, number>();
  changes.forEach((c, i) => {
    if (c.to !== undefined || c.setting || c.trash) { out.push({ indices: [i] }); return; }
    // a replaced page is the same change when it loses and gains the same lines, whatever it keeps (hubs differ in their goal)
    const sum = replacesPage(c) ? pageSummary(c.before, c.after) : null;
    const key = sum ? `replace\n${JSON.stringify([sum.lost, sum.added])}`
      : `${c.create ? "new" : c.body ? "page" : "properties"}\n${JSON.stringify(diffRows(c.before, c.after).filter(r => r.kind !== "same").map(r => [r.left, r.right]))}`;
    const have = at.get(key);
    if (have !== undefined) out[have].indices.push(i);
    else { at.set(key, out.length); out.push({ indices: [i] }); }
  });
  return out;
}

/** The scan as Markdown, for Copy report (paths and counts only; no note text). `ticked` = rule ids the user left ticked (default: all). */
export function reportMarkdown(s: TidyScan, ticked?: ReadonlySet<string>): string {
  const out = ["# Tidy up notes: report", ""];
  const changes = s.groups.reduce((n, g) => n + g.changes.length, 0);
  out.push(`${changes} change${changes === 1 ? "" : "s"} in ${s.groups.length} rule${s.groups.length === 1 ? "" : "s"}; ${s.reported.reduce((n, r) => n + r.items.length, 0)} only reported.`, "");
  for (const g of s.groups) {
    out.push(`## ${g.title} (${g.changes.length})${ticked && !ticked.has(g.id) ? " (not ticked)" : ""}`);
    for (const c of g.changes) out.push(`- ${c.path}`);
    out.push("");
  }
  if (s.reported.length) out.push("## Only reported", "");
  for (const r of s.reported) {
    out.push(`### ${r.title} (${r.items.length})`);
    for (const it of r.items) out.push(`- ${it.path}${it.note ? `: ${it.note}` : ""}`);
    out.push("");
  }
  return out.join("\n").trimEnd() + "\n";
}

/** How a rule reads in the window: red when it removes lines of the user's (a replaced page that drops some, or a change that only deletes), else amber. */
export function tidyGroupState(g: TidyGroup): WinState {
  const removes = g.changes.some(c => {
    if (c.to !== undefined || c.create || c.setting || c.trash) return false;
    if (replacesPage(c)) return pageSummary(c.before, c.after).lost.length > 0;
    return countRows(diffRows(c.before, c.after)).removed > 0;
  });
  return removes ? "missing" : "todo";
}

/** The big line of the Tidy up notes window. */
export function tidySummary(r: TidyScan): string {
  const g = r.groups.length, n = r.reported.length;
  if (!g && !n) return "Nothing to tidy.";
  const will = g ? `${g} ${g === 1 ? "thing" : "things"} will change` : "", look = n ? `${n} ${n === 1 ? "needs" : "need"} a look` : "";
  return (g && n ? `${will}, ${look}` : will || `${n} ${n === 1 ? "thing needs" : "things need"} a look`) + ".";
}
