// Self-filling note (docs/plans/templater-replacement-and-live-snippets.md, Phase 2): should this note be filled by Lab Kit, and the runner that
// acts on file-open / modify events. Pure: the vault, the clock, the form and Templater's settings are passed in (`FillHost`).
import { TemplateError, parseTemplate, type TemplateHeader } from "./snippet-template";
import { noteFromTemplate, type NoteEnv } from "./note-template";

/** One folder → template row (the template is a file name in the kit's templates folder, as in `planningFolderTemplates`). */
export interface FolderRow { folder: string; file: string }

/** What the text of a note is, for the fill rule. */
export type FillKind =
  | "empty"        // nothing but white space
  | "raw-header"   // a clean `make: note` header (and the note below it): what Templater or a copy leaves
  | "mixed"        // the header keys share one front matter with the note's own properties: never guessed
  | "board-stub"   // a note the board's New made (only `day` / `scheduled` and empty keys), or what Templater's row left of one: see `boardStub`
  | "other";

/** The keys a `make: note` header may hold. Any other key in the same front matter block makes the note "mixed". */
const HEADER_KEYS = ["make", "name", "folder", "fields", "title", "icon", "desc", "group", "required", "set"];

const FRONT = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/**
 * The column a board's New wrote into a new note: `scheduled` (a date) or an old weekday `day`, "" for the Backlog; null when the note is anything else.
 * The note holds a front matter of only `day`, `scheduled` and keys with no value (the board also writes `done:`) and no text, or that same
 * front matter plus a Lab Kit template header and the template's text below (what Templater's folder row makes of a stub, measured in the plan's
 * Phase 0 result item 3). Anything else in the properties is the user's: null.
 */
export function boardStub(text: string, parseYaml: (yaml: string) => unknown): { day: string } | null {
  const m = FRONT.exec(text);
  if (!m) return null;
  let raw: unknown;
  try { raw = parseYaml(m[1]); } catch { return null; }
  if (raw === null || raw === undefined) raw = {};
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>, own = Object.keys(o).filter(k => !HEADER_KEYS.includes(k));
  const templated = o.make === "note";
  if (!templated && text.slice(m[0].length).trim()) return null;
  if (templated && !own.length) return null;   // a header alone (with or without the note's text below) is a raw header
  if (!own.every(k => k === "day" || k === "scheduled" || o[k] === null || o[k] === "")) return null;
  // read as text, as the old template did: a YAML reader may turn a date into a Date object
  const at = (k: string): string => (new RegExp(`^${k}:[ \\t]*["']?([^"'\\r\\n]*)`, "m").exec(m[1]) ?? [])[1]?.trim() ?? "";
  return { day: at("scheduled") || at("day") };
}

export function classify(text: string, parseYaml: (yaml: string) => unknown): FillKind {
  if (!text.trim()) return "empty";
  if (text.startsWith("---") && boardStub(text, parseYaml)) return "board-stub";
  if (!text.startsWith("---") || !/\bmake\s*:/.test(text.slice(0, 4000))) return "other";   // cheap guard: most notes end here
  const m = FRONT.exec(text);
  if (!m) return "other";
  let raw: unknown;
  try { raw = parseYaml(m[1]); } catch { return "other"; }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw) || (raw as Record<string, unknown>).make !== "note") return "other";
  return Object.keys(raw).every(k => HEADER_KEYS.includes(k)) ? "raw-header" : "mixed";
}

const norm = (p: string): string => p.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
const folderOf = (path: string): string => path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
const covers = (row: string, folder: string): boolean => { const r = norm(row); return r === "" || folder === r || folder.startsWith(r + "/"); };

/** The row that applies to a note's folder: the deepest folder that is the note's folder or above it (how Templater's folder templates match). */
export function rowFor<T extends { folder: string }>(rows: T[], path: string): T | null {
  const folder = norm(folderOf(path));
  let best: T | null = null;
  for (const r of rows) if (norm(r.folder) !== "" && covers(r.folder, folder) && (!best || norm(r.folder).length > norm(best.folder).length)) best = r;
  return best;
}

export type FillSkip = "not-open" | "unmapped" | "templater-row" | "not-token-template" | "other" | "mixed" | "done";
export type FillDecision = { action: "fill"; source: "raw-header" | "row-template"; day?: string } | { action: "skip"; reason: FillSkip };

export interface FillInput {
  text: string;
  path: string;
  /** The note is the file open in the active editor on this device. */
  active: boolean;
  /** Lab Kit's folder list (`kit.folderTemplates`). */
  rows: FolderRow[];
  /** The folders Templater has a folder-template row for. */
  templaterFolders: string[];
  /** The text of the template file of the matching row; null = no file. */
  rowTemplateText: string | null;
  /** The note was made a moment ago (a board stub is only filled when new: an old blank note is not asked about again). */
  fresh?: boolean;
  parseYaml: (yaml: string) => unknown;
}

/**
 * Should Lab Kit fill this note now? A note is only ever filled when it is open in the active editor on this device (so Sync never fills one
 * on two devices) and sits in a mapped folder. A raw `make: note` header is always filled there; an empty note only when Templater has no row
 * for its folder and the folder's template is a token template. A mixed note is never touched: Check setup lists it.
 */
export function shouldFill(i: FillInput): FillDecision {
  if (!i.active) return { action: "skip", reason: "not-open" };
  const kind = classify(i.text, i.parseYaml);
  if (kind === "other") return { action: "skip", reason: "other" };
  if (kind === "mixed") return { action: "skip", reason: "mixed" };
  const row = rowFor(i.rows, i.path);
  if (!row) return { action: "skip", reason: "unmapped" };
  if (kind === "raw-header") return { action: "fill", source: "raw-header" };
  const stub = kind === "board-stub" ? boardStub(i.text, i.parseYaml) : null;
  const templated = !!stub && /\bmake\s*:/.test(i.text.slice(0, 4000));   // Templater's row already wrote its header into the stub: its pass is over, ours is next
  if (stub && i.fresh === false) return { action: "skip", reason: "other" };
  if (!templated && rowFor(i.templaterFolders.map(folder => ({ folder })), i.path)) return { action: "skip", reason: "templater-row" };
  let parsed = null;
  try { parsed = i.rowTemplateText ? parseTemplate(i.rowTemplateText, i.parseYaml) : null; } catch { parsed = null; }
  if (parsed?.header.make !== "note") return { action: "skip", reason: "not-token-template" };
  return { action: "fill", source: "row-template", ...(stub ? { day: stub.day } : {}) };
}

/** Which template is filling which note, and the column a board's New wrote into it ("" = none). */
export interface FillContext { file: string; path: string; day: string; stub: boolean }

/** What the runner needs from Obsidian. */
export interface FillHost {
  rows: () => FolderRow[];
  templaterFolders: () => string[];
  /** The path of the file open in the active editor, or null. */
  activePath: () => string | null;
  read: (path: string) => Promise<string | null>;
  /** The text of a row's template file; null when it does not exist. */
  template: (file: string) => Promise<string | null>;
  /** Replaces the note only if it still holds `expected` (a Templater pass in between = no write). True = written. */
  write: (path: string, expected: string, text: string) => Promise<boolean>;
  /** Asks the header's fields; null = cancelled. `ctx` names the template file of the row, the note and the column a board stub carried. */
  ask: (header: TemplateHeader, name: string, ctx: FillContext) => Promise<Record<string, string> | null>;
  /** After the note was written (a to-do is renamed to its title here). */
  finish?: (ctx: FillContext, answers: Record<string, string>) => Promise<void>;
  /** The questions were cancelled; `text` is what the note held (a blank board stub goes to the trash). */
  cancelled?: (ctx: FillContext, text: string) => Promise<void>;
  /** The note was made a moment ago. */
  fresh?: (path: string) => boolean;
  env: (path: string) => NoteEnv;
  parseYaml: (yaml: string) => unknown;
  /** A note the runner could not fill (bad template, ...): one notice. */
  failed?(path: string, message: string): void;
}

/** Acts on `file-open` (any note) and `modify` (only the active one: a raw header arrives about 0.3-0.5 s after Templater's create). One fill per note. */
export class NoteFiller {
  private busy = new Set<string>();
  private done = new Set<string>();
  constructor(private host: FillHost) {}

  /** Called for `file-open` and `modify`. Resolves to what was decided (tests read it). */
  async check(path: string): Promise<FillDecision> {
    if (this.done.has(path)) return { action: "skip", reason: "done" };
    if (this.busy.has(path)) return { action: "skip", reason: "done" };
    this.busy.add(path);
    try {
      const text = await this.host.read(path);
      if (text === null) return { action: "skip", reason: "other" };
      const row = rowFor(this.host.rows(), path);
      const kind = classify(text, this.host.parseYaml);
      const d = shouldFill({ text, path, active: this.host.activePath() === path, rows: this.host.rows(), templaterFolders: this.host.templaterFolders(),
        rowTemplateText: row && (kind === "empty" || kind === "board-stub") ? await this.host.template(row.file) : null,
        fresh: kind === "board-stub" ? this.host.fresh?.(path) ?? true : undefined, parseYaml: this.host.parseYaml });
      if (d.action === "skip") return d;
      const source = d.source === "raw-header" ? text : (await this.host.template(row!.file)) ?? "";
      const header = parseTemplate(source, this.host.parseYaml)?.header;
      if (!header) return { action: "skip", reason: "not-token-template" };
      try {
        const ctx: FillContext = { file: row!.file, path, day: d.day ?? "", stub: kind === "board-stub" };
        const answers = header.fields.length ? await this.host.ask(header, path.split("/").pop()!.replace(/\.md$/, ""), ctx) : {};
        this.done.add(path);   // asked once, whatever the answer: a cancel leaves the note as it is (a blank board stub goes)
        if (!answers) { if (ctx.stub) await this.host.cancelled?.(ctx, text); return { action: "skip", reason: "done" }; }
        const made = noteFromTemplate(source, answers, this.host.env(path));
        if (!(await this.host.write(path, text, made.text))) this.done.delete(path);   // changed under us: look again at the next event
        else await this.host.finish?.(ctx, answers);
      } catch (e) {
        this.done.add(path);
        this.host.failed?.(path, e instanceof TemplateError ? e.message : "Could not fill this note.");
        return { action: "skip", reason: "other" };
      }
      return d;
    } finally { this.busy.delete(path); }
  }
}
