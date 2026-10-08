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
  placeholder?: string;
  type: "text" | "number" | "textarea";
  /** The default answer; may hold computed tokens such as {{next-letter:sampling}}. */
  value: string;
}

export interface TemplateHeader {
  title?: string;
  icon?: string;
  desc?: string;
  /** Key of a field that must hold at least one list item, else nothing is inserted. */
  required?: string;
  fields: TemplateField[];
}

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
}

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
 * without `fields`), which is inserted as it is. A header that is not valid throws a TemplateError.
 */
export function parseTemplate(text: string, parseYaml: (yaml: string) => unknown): ParsedTemplate | null {
  const m = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  if (!m) return null;
  let raw: unknown;
  try { raw = parseYaml(m[1]); } catch (e) { throw new TemplateError(`The header is not valid YAML: ${e instanceof Error ? e.message : "unreadable"}`); }
  if (!isRecord(raw) || !("fields" in raw)) return null;
  return { header: readHeader(raw), body: text.slice(m[0].length) };
}

function readHeader(raw: Record<string, unknown>): TemplateHeader {
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
    fields.push({ key, label: asText(f.label) ?? key, hint: asText(f.hint), placeholder: asText(f.placeholder), type, value: asText(f.value) ?? "" });
  }
  const required = asText(raw.required)?.trim() || undefined;
  if (required && !fields.some(f => f.key === required)) throw new TemplateError(`required: "${required}" is not one of the fields.`);
  return { title: asText(raw.title), icon: asText(raw.icon), desc: asText(raw.desc), required, fields };
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
  | { k: "noteNumber"; field: string; property: string };

type Node =
  | { t: "text"; s: string }
  | { t: "expr"; alts: Alt[] }
  | { t: "each"; key: string; as?: string; or?: string; sep?: string; body: Node[] }
  | { t: "repeat"; key: string; fallback: number; body: Node[] }
  | { t: "if"; key: string; starts?: string; yes: Node[]; no: Node[] };

type Tok = { text: string } | { tag: string };

const BLOCK = /^(?:#each\s|#repeat\s|#if\s|\/each$|\/repeat$|\/if$|else$)/;

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
  type Open = { node: Node & { t: "each" | "repeat" | "if" }; tag: string; inElse: boolean };
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
    if (a.k === "noteNumber") field(a.field, tag);
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
    } else if (tag === "else") {
      const o = open[open.length - 1];
      if (!o || o.node.t !== "if" || o.inElse) throw new TemplateError("{{else}} without a matching {{#if}}.");
      o.inElse = true;
    } else if (tag === "/each" || tag === "/repeat" || tag === "/if") {
      const o = open[open.length - 1];
      const want = tag === "/if" ? "if" : tag.slice(1);
      if (!o || o.node.t !== want) throw new TemplateError(`{{${tag}}} without a matching {{#${want}}}.`);
      open.pop();
      if (want !== "if") vars.pop();
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

  constructor(private answers: Record<string, string>, private env: TemplateEnv) {}

  render(nodes: Node[]): string {
    let out = "";
    for (const n of nodes) {
      if (n.t === "text") out += n.s;
      else if (n.t === "expr") out += this.expr(n.alts);
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

/** The body with the answers filled in. Throws a TemplateError (unknown token, unknown field, unclosed block) before any text is returned. */
export function fillTemplate(body: string, answers: Record<string, string>, env: TemplateEnv): string {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(answers)) clean[k] = String(v ?? "").trim();
  return new Filler(clean, env).render(parseBody(body, new Set(Object.keys(clean))));
}
