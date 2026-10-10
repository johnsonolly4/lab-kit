// Tidy up notes (Phase 7a, plan docs/plans/phase-7-tidy-notes.md): scans a vault's notes against the kit layout and lists what would change, as
// before / after text, plus what is only reported. Pure and read-only: the caller reads the vault into `files`; nothing here writes.
// Simple rules are data (`migrations` in a kit's manifest); rules that look across notes (hubs, meetings, leftovers, note bodies) are code.
import { unnumbered } from "../planning/lists";
import { firstSeries } from "../planning/meetings";
import { asBody, newHubPage, pageDiffers, templatePage, type HubKind } from "./tidy-hubs";

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
  /** The Projects folder (project hubs). Missing = the project rule is off. */
  projectsFolder?: string;
  /** The Project hub template's note text (after its Templater header): a missing hub is made from it. Without it a missing hub is only its properties. */
  projectHubText?: string;
  /** The three hub templates' text (with their Templater header): the hub body rule rewrites a hub's page from them. Missing = the rule is off. */
  hubTemplates?: { project: string; topic: string; series: string };
  /** Plugin settings the settings rules look at (Phase 7c-2); each part missing when that plugin isn't loaded. */
  settings?: TidySettings;
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

/** Does the scan need this note's text? (The caller reads only those: a whole-vault read is for finding unused view.js.) */
export function wantsText(path: string, ctx: TidyContext, readAll: boolean): boolean {
  if (!isNote(path) || hidden(path)) return false;
  return readAll || inFolder(path, ctx.labFolder) || (!!ctx.chemicalFolder && inFolder(path, ctx.chemicalFolder)) || inFolder(path, ctx.knowledgeFolder) || isHubName(path)
    || (!!ctx.meetings && (inFolder(path, ctx.meetings.folder) || inFolder(path, ctx.meetings.todos)))
    || (!!ctx.projectsFolder && inFolder(path, ctx.projectsFolder))
    || (ctx.hubFolders ?? []).some(f => parentOf(path) === f);
}

const topFolder = (p: string): string => p.includes("/") ? p.slice(0, p.indexOf("/")) : "";

/** Lab Kit commands that replace the old template-file buttons, by the template's file name (lower case, without .md). */
const BUTTON_COMMANDS: Record<string, string> = {
  "sort inbox": "lab-kit:sort-inbox", "archive old to-dos": "lab-kit:archive-todos", "open thursday deck": "lab-kit:open-deck",
  "new weekly meeting": "lab-kit:new-meeting", "new to-do": "lab-kit:new-todo",
};

/** The block a project note starts with: a link to its project's hub (the New project note template writes the same). */
const BACK_TO_PROJECT = "```vault-card\nshow: back-to-project\n```";

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

    // Notes in a project's folder: the `project` property, a link to the folder's hub (what the New project note template writes). Only where the hub exists.
    const hubs = new Set(notes.filter(x => inFolder(x.path, pf) && isHub(x.path)).map(x => x.path));
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
    const folders = [...new Set(files.filter(f => inFolder(f.path, pf) && !hidden(f.path)).map(f => f.path.slice(pf.length + 1)).filter(r => r.includes("/")).map(r => r.split("/")[0]))].sort();
    for (const name of folders) {
      const folder = `${pf}/${name}`, path = `${folder}/${name}.md`;
      if (files.some(f => f.path === path) || notes.some(x => parentOf(x.path) === folder && kindOf(x.path) === "project")) continue;
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
    const g: TidyGroup = { id: "todo-properties", title: "To-dos: add the properties the board needs", detail: "Notes in the to-dos folder without a kind property (or with an empty one) get kind: todo, day: Backlog, done: false and rolled: false (only the ones they lack).", changes: [] };
    for (const n of notes.filter(x => inFolder(x.path, mt.todos))) {
      const fm = fmOf(n.path);
      const kind = find(fm, "kind");
      if (kind && values(kind).length) continue;
      // an empty `kind:` (Obsidian shows "Empty") counts as no kind: fill that line in place
      const base = kind ? [...fm.slice(0, kind.start), line("kind", "todo"), ...fm.slice(kind.end)] : fm;
      const add = ([["kind", "todo"], ["day", "Backlog"], ["done", "false"], ["rolled", "false"]] as const).filter(([k]) => !find(base, k)).map(([k, v]) => line(k, v));
      const full = withClasses([...base, ...add], ["vt"]);
      g.changes.push({ path: n.path, before: fm.join("\n"), after: full.join("\n") });
      put(n.path, full.join("\n"));
    }
    if (g.changes.length) groups.push(g);
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
  reported.push(...settingsReported);
  if (skipped.items.length) reported.unshift(skipped);

  return { groups, reported: reported.filter((r): r is TidyReported => !!r) };
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
