// Snippet token templates: a snippet note with a YAML header (the questions) and {{tokens}} in the body.
// Pure: no Obsidian or Node imports (works on mobile); the YAML parser and the note are passed in. See docs/plans/snippet-token-templates.md.

/** Any problem with a template: bad header, unknown token, unclosed block. Nothing is inserted when one is thrown. */
export class TemplateError extends Error {
  constructor(message: string) { super(message); this.name = "TemplateError"; }
}

export interface TemplateField {
  key: string;
  label: string;
  hint?: string;
  /** REMOVING: see docs/decisions.md, "Removing experimental features". `mandatory: true`: the form marks the field with * and does not close while it is empty. Only the form checks it; `required` in the header is a different rule. */
  mandatory?: boolean;
  placeholder?: string;
  type: "text" | "number" | "textarea";
  /** The default answer; may hold computed tokens such as {{next-letter:sampling}}. */
  value: string;
  /** `suggest: chemicals` = the field suggests the chemical notes while typing. `suggest: codes` = the box is filled with the sample codes of the note's tables, with a "Codes from" choice when there are several. `suggest: notes` = the field lists the notes of a settings folder (`folder`). */
  suggest?: "chemicals" | "codes" | "notes";
  /** With `suggest: notes`: the Lab Kit folder setting whose notes the field lists, e.g. `folder: rigsFolder`. */
  folder?: string;
  /** `class: monomer` or `class: [a, b]`: suggest chemicals of these Chemical classes (any text, never checked against a list). Needs `suggest: chemicals`. */
  classes?: string[];
}

export interface TemplateHeader {
  title?: string;
  icon?: string;
  desc?: string;
  /** Key of a field that must hold at least one list item, else nothing is inserted. */
  required?: string;
  /** `set:` properties written on the note after the insert: name and value (the value may hold tokens; an empty one is not written). */
  set?: { name: string; value: string }[];
  /** The Alt+S menu section (`Make up`, `Samples`, …). Anything else is listed under My snippets. */
  group?: string;
  /** `run: solution` = a calculator: Lab Kit runs that key of labSnippets.js, which asks its own questions, so the header has no `fields` and the note has no body. */
  run?: string;
  fields: TemplateField[];
}

/** A part of the body that goes under a heading at the end of the note, not at the cursor. `level` = the heading's level when it has to be added. */
export interface TemplateAppend { heading: string; level: number; text: string }

export interface ParsedTemplate { header: TemplateHeader; body: string }

/** What the engine needs from the note and the vault. Injected, so the engine stays pure. */
export interface TemplateEnv {
  /** Initials + note number + "-", e.g. "ABC0016-". */
  prefix: string;
  /** Index of the first sample letter not used yet: in the whole note, or in the calc tables with this name. */
  nextFreeIndex(table?: string): number;
  /** A table id not used in the note yet (base, base2…); the caller keeps ids it handed out. */
  uniqueTable(base: string): string;
  /** Number of body rows in the calc table with this name, or 0. */
  tableRows(name: string): number;
  /** A number from a property of the note called `note`, or "" when there is no such note, property or number. */
  noteProperty(note: string, property: string): string;
  /** A property of the note called `note` as text (a list joined with ", "), or "". */
  noteText(note: string, property: string): string;
  /** The parts tables of the rig note called `note` as Markdown, each under its heading (`hashes`, e.g. "##"). Throws a TemplateError when it has none. */
  rigTables(note: string, hashes: string): string;
  /** The diagram of the rig note called `note` as a Mermaid code block. Throws a TemplateError when it has no parts table. */
  rigDiagram(note: string): string;
  /** The Summary table of the rig note called `note`, or "" when it has none. */
  rigSummary(note: string): string;
}

/** The key of the "Codes from" choice the form adds after a `suggest: codes` field (not a template field, so templates never see it). */
export const codesFromKey = (key: string): string => `${key}_from`;

const RESERVED = ["prefix", "code"];
const NAME = /^[A-Za-z_][\w-]*$/;

/** "a, b\nc" → ["a", "b", "c"]. */
export function listOf(s: string | undefined): string[] {
  return String(s ?? "").split(/[,\n]/).map(x => x.trim()).filter(Boolean);
}

/** 0 → A, 25 → Z, 26 → AA. */
export function letter(i: number): string {
  let s = "";
  let n = i + 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/* ---------- header ---------- */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const asText = (v: unknown): string | undefined => typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : undefined;

/**
 * Splits a snippet note into its header and body. null = a plain snippet (no header between `---` lines, or a header
 * with neither `fields` nor `run`), which is inserted as it is. A header that is not valid throws a TemplateError.
 */
export function parseTemplate(text: string, parseYaml: (yaml: string) => unknown): ParsedTemplate | null {
  const m = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!m) return null;
  let raw: unknown;
  try { raw = parseYaml(m[1]); } catch (e) { throw new TemplateError(`The header is not valid YAML: ${e instanceof Error ? e.message : "unreadable"}`); }
  if (!isRecord(raw) || !("fields" in raw || "run" in raw)) return null;
  return { header: readHeader(raw), body: text.slice(m[0].length) };
}

function readHeader(raw: Record<string, unknown>): TemplateHeader {
  const group = asText(raw.group)?.trim() || undefined;
  if ("run" in raw) {
    const run = asText(raw.run)?.trim();
    if (!run) throw new TemplateError("run: needs the name of a Lab Kit calculator, for example run: solution.");
    if ("fields" in raw) throw new TemplateError("A header with run: has no fields: the calculator asks its own questions.");
    return { title: asText(raw.title), icon: asText(raw.icon), desc: asText(raw.desc), group, run, fields: [] };
  }
  if (!Array.isArray(raw.fields)) throw new TemplateError("The header's fields must be a list.");
  const fields: TemplateField[] = [];
  for (const [n, f] of (raw.fields as unknown[]).entries()) {
    if (!isRecord(f)) throw new TemplateError(`Field ${n + 1} is not a key with a label.`);
    const key = asText(f.key)?.trim() ?? "";
    if (!NAME.test(key)) throw new TemplateError(`Field ${n + 1} needs a key made of letters, digits, - and _.`);
    if (RESERVED.includes(key)) throw new TemplateError(`The field key "${key}" is reserved.`);
    if (fields.some(x => x.key === key)) throw new TemplateError(`The field key "${key}" is used twice.`);
    const type = asText(f.type) ?? "text";
    if (type !== "text" && type !== "number" && type !== "textarea") throw new TemplateError(`Field "${key}" has an unknown type "${type}".`);
    const suggest = asText(f.suggest)?.trim();
    if (suggest && suggest !== "chemicals" && suggest !== "codes" && suggest !== "notes") throw new TemplateError(`Field "${key}" has an unknown suggest "${suggest}" (only "chemicals", "codes" or "notes").`);
    const folder = asText(f.folder)?.trim();
    if (suggest === "notes" && !folder) throw new TemplateError(`Field "${key}": suggest: notes needs folder: with the name of a Lab Kit folder setting, for example rigsFolder.`);
    if (folder && suggest !== "notes") throw new TemplateError(`Field "${key}": folder needs suggest: notes.`);
    const classes = (Array.isArray(f.class) ? f.class : f.class === undefined ? [] : [f.class]).map(c => asText(c)?.trim() ?? "");
    if (classes.some(c => !c)) throw new TemplateError(`Field "${key}": class must be text or a list of texts.`);
    if (classes.length && suggest !== "chemicals") throw new TemplateError(`Field "${key}": class needs suggest: chemicals.`);
    if (f.mandatory !== undefined && typeof f.mandatory !== "boolean") throw new TemplateError(`Field "${key}": mandatory must be true or false.`);
    fields.push({ key, label: asText(f.label) ?? key, hint: asText(f.hint), placeholder: asText(f.placeholder), type, value: asText(f.value) ?? "",
      ...(f.mandatory ? { mandatory: true } : {}),
      ...(suggest === "chemicals" || suggest === "codes" || suggest === "notes" ? { suggest } : {}), ...(classes.length ? { classes } : {}), ...(folder ? { folder } : {}) });
  }
  for (const f of fields.filter(x => x.suggest === "codes")) {
    if (fields.some(x => x.key === codesFromKey(f.key))) throw new TemplateError(`The field key "${codesFromKey(f.key)}" is reserved: the "Codes from" choice of "${f.key}" uses it.`);
  }
  const required = asText(raw.required)?.trim() || undefined;
  if (required && !fields.some(f => f.key === required)) throw new TemplateError(`required: "${required}" is not one of the fields.`);
  let set: { name: string; value: string }[] | undefined;
  if (raw.set !== undefined) {
    if (!isRecord(raw.set)) throw new TemplateError("The header's set must be a list of property: value lines.");
    set = Object.entries(raw.set).map(([name, v]) => {
      const value = asText(v);
      if (!/^[A-Za-z][\w .-]*$/.test(name) || value === undefined) throw new TemplateError(`set: "${name}" must be a property name with a text value.`);
      return { name, value };
    });
  }
  return { title: asText(raw.title), icon: asText(raw.icon), desc: asText(raw.desc), group, required, ...(set ? { set } : {}), fields };
}

/** True when the required field has no list item: nothing is inserted. */
export function isCancelled(header: TemplateHeader, answers: Record<string, string>): boolean {
  return !!header.required && listOf(answers[header.required]).length === 0;
}

/** Each field's default answer, with the computed tokens in it filled. */
export function defaultAnswers(header: TemplateHeader, env: TemplateEnv): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of header.fields) out[f.key] = fillTemplate(f.value, out, env).trim();
  return out;
}

/* ---------- body: tokens → tree ---------- */

type Alt =
  | { k: "lit"; s: string }
  | { k: "ref"; name: string }
  | { k: "item" }
  | { k: "idx"; of: "i" | "n" | "seq"; add: number }
  | { k: "prefix" }
  | { k: "code" }
  | { k: "table"; bases: Alt[]; suffix: string }
  | { k: "linked"; table: string; ref: string }
  | { k: "nextLetter"; table: string }
  | { k: "noteNumber"; field: string; property: string }
  | { k: "liveProp"; field: string; property: string; cell: string }
  | { k: "noteProp"; field: string; property: string }
  | { k: "noteLine"; field: string; property: string }
  | { k: "rigTables"; field: string; hashes: string }
  | { k: "rigDiagram"; field: string }
  | { k: "rigSummary"; field: string };

type Node =
  | { t: "text"; s: string }
  | { t: "expr"; alts: Alt[] }
  | { t: "each"; key: string; as?: string; or?: string; sep?: string; body: Node[] }
  | { t: "repeat"; key: string; fallback: number; body: Node[] }
  | { t: "if"; key: string; starts?: string; yes: Node[]; no: Node[] }
  | { t: "append"; heading: string; level: number; from?: { field: string; property: string }; body: Node[] };

type Tok = { text: string } | { tag: string };

const BLOCK = /^(?:#each\s|#repeat\s|#if\s|#append\s|\/each$|\/repeat$|\/if$|\/append$|else$)/;

/** Text and `{{tags}}`. A block tag alone on its line takes the whole line (and its line break) with it; `\{{` is a literal `{{`. */
function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  const re = /\\\{\{|\{\{([\s\S]*?)\}\}/g;
  let buf = "";
  let pos = 0;
  const plain = (s: string) => {
    if (s.includes("{{")) throw new TemplateError("A {{ is never closed. Write \\{{ for a literal {{.");
    buf += s;
  };
  const flush = () => { if (buf) { toks.push({ text: buf }); buf = ""; } };
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m[0] === "\\{{") { plain(src.slice(pos, m.index)); buf += "{{"; pos = re.lastIndex; continue; }
    const inner = m[1].trim();
    let start = m.index, end = re.lastIndex;
    if (BLOCK.test(inner)) {
      const ls = start === 0 ? 0 : src.lastIndexOf("\n", start - 1) + 1;
      const le = src.indexOf("\n", end) < 0 ? src.length : src.indexOf("\n", end);
      if (ls >= pos && src.slice(ls, start).trim() === "" && src.slice(end, le).trim() === "") { start = ls; end = Math.min(le + 1, src.length); }
    }
    plain(src.slice(pos, start));
    flush();
    toks.push({ tag: inner });
    pos = end;
    re.lastIndex = end;
  }
  plain(src.slice(pos));
  flush();
  return toks;
}

/** Split on `|` outside double quotes. */
function splitTop(s: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (const ch of s) {
    if (ch === '"') q = !q;
    if (ch === "|" && !q) { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out.map(x => x.trim());
}

function parseAlt(src: string): Alt {
  const s = src.trim();
  let m: RegExpExecArray | null;
  if ((m = /^"([\s\S]*)"$/.exec(s))) return { k: "lit", s: m[1] };
  if ((m = /^@(i|n|seq)\s*(?:([+-])\s*(\d+))?$/.exec(s))) return { k: "idx", of: m[1] as "i" | "n" | "seq", add: m[2] ? (m[2] === "-" ? -1 : 1) * Number(m[3]) : 0 };
  if (s === ".") return { k: "item" };
  if (s === "prefix") return { k: "prefix" };
  if (s === "code") return { k: "code" };
  if ((m = /^linked:([^!\s]+)!(\S+)$/.exec(s))) return { k: "linked", table: m[1], ref: m[2] };
  if ((m = /^next-letter:(\S+)$/.exec(s))) return { k: "nextLetter", table: m[1] };
  if ((m = /^note-number:([A-Za-z_][\w-]*)\.(.+)$/.exec(s))) return { k: "noteNumber", field: m[1], property: m[2].trim() };
  if ((m = /^live-prop:([A-Za-z_][\w-]*)\.([^@"]+)@([A-Za-z]{1,3}\d+)$/.exec(s))) return { k: "liveProp", field: m[1], property: m[2].trim(), cell: m[3].toUpperCase() };
  if ((m = /^note-prop:([A-Za-z_][\w-]*)\.(.+)$/.exec(s))) return { k: "noteProp", field: m[1], property: m[2].trim() };
  if ((m = /^note-line:([A-Za-z_][\w-]*)\.(.+)$/.exec(s))) return { k: "noteLine", field: m[1], property: m[2].trim() };
  if ((m = /^rig-tables:([A-Za-z_][\w-]*)(?:\s+(#{1,6}))?$/.exec(s))) return { k: "rigTables", field: m[1], hashes: m[2] ?? "##" };
  if ((m = /^rig-diagram:([A-Za-z_][\w-]*)$/.exec(s))) return { k: "rigDiagram", field: m[1] };
  if ((m = /^rig-summary:([A-Za-z_][\w-]*)$/.exec(s))) return { k: "rigSummary", field: m[1] };
  if (NAME.test(s)) return { k: "ref", name: s };
  throw new TemplateError(`Unknown token {{${s}}}.`);
}

function parseExpr(src: string): Alt[] {
  if (src.startsWith("table:")) {
    const bases = splitTop(src.slice(6)).map((b): Alt => {
      if (b.startsWith("$")) return { k: "ref", name: b.slice(1) };
      const q = /^"([\s\S]*)"$/.exec(b);
      return { k: "lit", s: q ? q[1] : b };
    });
    // sampling>_start = the id of sampling plus _start, made unique
    const first = bases[0];
    if (first.k === "lit" && first.s.includes(">")) {
      const [base, suffix] = first.s.split(">");
      if (!base || !suffix || bases.length > 1) throw new TemplateError(`Unknown token {{${src}}}.`);
      return [{ k: "table", bases: [{ k: "lit", s: base }], suffix }];
    }
    return [{ k: "table", bases, suffix: "" }];
  }
  return splitTop(src).map(parseAlt);
}

function parseBody(src: string, known: Set<string>): Node[] {
  const root: Node[] = [];
  type Open = { node: Node & { t: "each" | "repeat" | "if" | "append" }; tag: string; inElse: boolean };
  const open: Open[] = [];
  const vars: string[] = [];
  const list = (): Node[] => {
    const o = open[open.length - 1];
    if (!o) return root;
    return o.node.t === "if" ? (o.inElse ? o.node.no : o.node.yes) : o.node.body;
  };
  const field = (name: string, tag: string) => {
    if (!known.has(name)) throw new TemplateError(`{{${tag}}} uses "${name}", which is not a field of this snippet.`);
  };
  const check = (a: Alt, tag: string) => {
    if (a.k === "ref" && !known.has(a.name) && !vars.includes(a.name)) throw new TemplateError(`{{${tag}}} uses "${a.name}", which is not a field of this snippet.`);
    if ((a.k === "item" || a.k === "idx") && !vars.length) throw new TemplateError(`{{${tag}}} only works inside {{#each}} or {{#repeat}}.`);
    if (a.k === "noteNumber" || a.k === "liveProp" || a.k === "noteProp" || a.k === "noteLine" || a.k === "rigTables" || a.k === "rigDiagram" || a.k === "rigSummary") field(a.field, tag);
    if (a.k === "table") a.bases.forEach(b => check(b, tag));
  };
  for (const tok of tokenize(src)) {
    if ("text" in tok) { list().push({ t: "text", s: tok.text }); continue; }
    const tag = tok.tag;
    let m: RegExpExecArray | null;
    if ((m = /^#each\s+(\S+?)(?:\s+as\s+([A-Za-z_]\w*))?(?:\s+or\s+"([^"]*)")?(?:\s*\|\s*"([^"]*)")?$/.exec(tag))) {
      field(m[1], tag);
      const node = { t: "each" as const, key: m[1], as: m[2], or: m[3], sep: m[4], body: [] as Node[] };
      list().push(node); open.push({ node, tag, inElse: false }); vars.push(m[2] ?? "");
    } else if ((m = /^#repeat\s+([A-Za-z_][\w-]*)\s*(?:\|\s*(\d+))?$/.exec(tag))) {
      field(m[1], tag);
      const node = { t: "repeat" as const, key: m[1], fallback: m[2] ? Number(m[2]) : 1, body: [] as Node[] };
      list().push(node); open.push({ node, tag, inElse: false }); vars.push("");
    } else if ((m = /^#if\s+([A-Za-z_][\w-]*)(?:\s*\^=\s*"([^"]*)")?$/.exec(tag))) {
      field(m[1], tag);
      const node = { t: "if" as const, key: m[1], starts: m[2], yes: [] as Node[], no: [] as Node[] };
      list().push(node); open.push({ node, tag, inElse: false });
    } else if ((m = /^#append\s+"\s*(#{1,6})?\s*([^"#][^"]*?)\s*"(?:\s+from\s+([A-Za-z_][\w-]*)\.(.+?))?$/.exec(tag))) {
      if (open.length) throw new TemplateError("{{#append}} cannot be inside another block.");
      if (m[3]) field(m[3], tag);
      const node = { t: "append" as const, heading: m[2], level: m[1]?.length ?? 2, from: m[3] ? { field: m[3], property: m[4].trim() } : undefined, body: [] as Node[] };
      list().push(node); open.push({ node, tag, inElse: false });
    } else if (tag === "else") {
      const o = open[open.length - 1];
      if (!o || o.node.t !== "if" || o.inElse) throw new TemplateError("{{else}} without a matching {{#if}}.");
      o.inElse = true;
    } else if (tag === "/each" || tag === "/repeat" || tag === "/if" || tag === "/append") {
      const o = open[open.length - 1];
      const want = tag === "/if" ? "if" : tag.slice(1);
      if (!o || o.node.t !== want) throw new TemplateError(`{{${tag}}} without a matching {{#${want}}}.`);
      open.pop();
      if (want === "each" || want === "repeat") vars.pop();
    } else if (tag.startsWith("#")) {
      throw new TemplateError(`Unknown block {{${tag}}}.`);
    } else {
      const alts = parseExpr(tag);
      alts.forEach(a => check(a, tag));
      list().push({ t: "expr", alts });
    }
  }
  if (open.length) throw new TemplateError(`{{${open[open.length - 1].tag}}} is never closed.`);
  return root;
}

/* ---------- tree → text ---------- */

interface Frame { name?: string; item: string; i: number; seq: number }

class Filler {
  private frames: Frame[] = [];
  private seq = new Map<Node, number>();
  private codeNext: number | null = null;
  private ids = new Map<string, string>();
  /** The {{#append}} parts, in order; their text is left out of what render returns. */
  readonly appends: TemplateAppend[] = [];

  constructor(private answers: Record<string, string>, private env: TemplateEnv) {}

  /** The heading of an {{#append}} part: the picked note's property when the tag says `from key.Property` and it is filled in, else the written heading. */
  private appendHeading(n: Extract<Node, { t: "append" }>): string {
    const note = n.from ? this.answers[n.from.field] ?? "" : "";
    return (note && n.from && this.env.noteText(note, n.from.property).trim()) || n.heading;
  }

  render(nodes: Node[]): string {
    let out = "";
    let dropBreak = false;   // an empty {{note-line}} or {{rig-summary}} on a line of its own leaves no blank line
    for (const n of nodes) {
      if (n.t === "text") { out += dropBreak ? n.s.replace(/^\r?\n/, "") : n.s; dropBreak = false; continue; }
      dropBreak = false;
      if (n.t === "expr") { const v = this.expr(n.alts); out += v; dropBreak = !v && n.alts.length === 1 && (n.alts[0].k === "noteLine" || n.alts[0].k === "rigSummary");
        if (dropBreak && n.alts[0].k === "rigSummary") out = out.replace(/\r?\n$/, "");   // its blank line above goes too
      }
      else if (n.t === "append") this.appends.push({ heading: this.appendHeading(n), level: n.level, text: this.render(n.body) });
      else if (n.t === "if") {
        const v = this.answers[n.key] ?? "";
        const yes = n.starts !== undefined ? v !== "" && v.toLowerCase().startsWith(n.starts.toLowerCase()) : listOf(v).length > 0;
        out += this.render(yes ? n.yes : n.no);
      } else if (n.t === "each") {
        let items = listOf(this.answers[n.key]);
        if (!items.length && n.or !== undefined) items = [n.or];
        out += items.map((item, i) => this.run(n, n.body, { name: n.as, item, i, seq: 0 })).join(n.sep ?? "");
      } else {
        let count = parseInt(this.answers[n.key] ?? "", 10);
        if (!(count > 0)) count = n.fallback;
        let rep = "";
        for (let i = 0; i < count; i++) rep += this.run(n, n.body, { item: "", i, seq: 0 });
        out += rep;
      }
    }
    return out;
  }

  /** One pass of a loop body; seq keeps counting over every pass of this block, also across outer passes. */
  private run(block: Node, body: Node[], frame: Frame): string {
    frame.seq = this.seq.get(block) ?? 0;
    this.seq.set(block, frame.seq + 1);
    this.frames.push(frame);
    try { return this.render(body); } finally { this.frames.pop(); }
  }

  /** The first alternative that is not empty. */
  private expr(alts: Alt[]): string {
    for (const a of alts) { const v = this.alt(a).trim(); if (v) return v; }
    return "";
  }

  private alt(a: Alt): string {
    switch (a.k) {
      case "lit": return a.s;
      case "ref": {
        for (let i = this.frames.length - 1; i >= 0; i--) if (this.frames[i].name === a.name) return this.frames[i].item;
        return this.answers[a.name] ?? "";
      }
      case "item": return this.frames[this.frames.length - 1].item;
      case "idx": {
        const f = this.frames[this.frames.length - 1];
        return String((a.of === "i" ? f.i : a.of === "n" ? f.i + 1 : f.seq) + a.add);
      }
      case "prefix": return this.env.prefix;
      case "code": {
        this.codeNext ??= this.env.nextFreeIndex();
        return this.env.prefix + letter(this.codeNext++);
      }
      case "table": return this.tableId(this.expr(a.bases), a.suffix);
      case "linked": return this.env.tableRows(a.table) > 0 ? `=${a.table}!${a.ref}` : "";
      case "nextLetter": return letter(this.env.nextFreeIndex(a.table));
      case "noteNumber": {
        const note = this.answers[a.field] ?? "";
        return note ? this.env.noteProperty(note, a.property) : "";
      }
      case "liveProp": {   // a formula that reads the property again whenever the note changes; empty when the note has no such number now
        const note = this.answers[a.field] ?? "";
        return note && this.env.noteProperty(note, a.property) ? `=PROP(${a.cell},"${a.property}")` : "";
      }
      case "noteLine": { const note = this.answers[a.field] ?? "", v = note ? this.env.noteText(note, a.property) : ""; return v ? `${a.property}: ${v}` : ""; }
      case "noteProp": { const note = this.answers[a.field] ?? ""; return note ? this.env.noteText(note, a.property) : ""; }
      case "rigTables": { const note = this.answers[a.field] ?? ""; return note ? this.env.rigTables(note, a.hashes) : ""; }
      case "rigDiagram": { const note = this.answers[a.field] ?? ""; return note ? this.env.rigDiagram(note) : ""; }
      case "rigSummary": { const note = this.answers[a.field] ?? ""; const v = note ? this.env.rigSummary(note) : ""; return v; }
    }
  }

  /** The same base gives the same id again within one insert; base + suffix is made unique after the base's own id. */
  private tableId(base: string, suffix: string): string {
    const key = base + ">" + suffix;
    let id = this.ids.get(key);
    if (id === undefined) {
      id = this.env.uniqueTable(suffix ? this.tableId(base, "") + suffix : base);
      this.ids.set(key, id);
    }
    return id;
  }
}

/**
 * The body with the answers filled in: `text` goes at the cursor, each `{{#append "Heading"}}` part under its heading at the end of the note.
 * Throws a TemplateError (unknown token, unknown field, unclosed block) before anything is returned.
 */
export function fillParts(body: string, answers: Record<string, string>, env: TemplateEnv): { text: string; appends: TemplateAppend[] } {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(answers)) clean[k] = String(v ?? "").trim();
  const filler = new Filler(clean, env);
  const text = filler.render(parseBody(body, new Set(Object.keys(clean))));
  return { text, appends: filler.appends };
}

/** The text that goes at the cursor (see fillParts; `{{#append}}` parts are left out). */
export function fillTemplate(body: string, answers: Record<string, string>, env: TemplateEnv): string {
  return fillParts(body, answers, env).text;
}
