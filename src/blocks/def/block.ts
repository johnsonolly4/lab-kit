// The text of a block made from a definition: the answers as lines, the rows' names for `used:`, the model that works every row out, the `#` worked-out lines, and
// the Edit set-up changes. Pure (no Obsidian runtime). Plan: docs/plans/custom-live-blocks.md, Target design §4, Phase C4; the stored text is set by the plugin,
// not by the definition (docs/live-block-format.md). The built-in RAFT block (../raft/text.ts) is the reference: same lines, byte for byte.
import { evaluate, isErr, ERR, type Value } from "../../calc/engine";
import { massToGrams, parseQuantity, type Block } from "../core";
import { reagentName } from "../../solution/view";
import { fmtMw } from "../raft/format";
import { checkFormula } from "./formula";
import { norm, type Definition } from "./definition";
import { fillText, type FillHost } from "./text";

/** A question of the snippet header, as far as the block text needs it. */
export interface BlockField { key: string; type: string; unit?: string; weights?: "fraction"; suggest?: string; when?: string }
export interface ListItem { name: string; fraction: string }
/** The answers as the block stores them, by field key: text without a link, a number with its unit (`2.5 g`), a list as items. An empty answer is `""` / `[]`. */
export type Answers = Record<string, string | ListItem[]>;
/** A property of a chemical note by name (`MW`): null when there is no note, property or usable number. */
export type Lookup = (name: string, property: string) => number | null;
export type LineOp = { set: [section: string | null, key: string, value: string] } | { remove: [section: string | null, key: string] };

const link = (name: string): string => `"[[${name}]]"`;
const isLink = (f: BlockField): boolean => f.suggest === "chemicals" || f.suggest === "notes";
const filled = (a: string | ListItem[] | undefined): boolean => Array.isArray(a) ? a.length > 0 : (a ?? "").trim() !== "";
const stored = (a: Answers, key: string): string | ListItem[] => a[key] ?? "";

/** The answers a field stores: its value when filled and, with `when:`, only while the other question is filled. */
function effective(f: BlockField, a: Answers): string | ListItem[] | null {
  const v = stored(a, f.key);
  if (!filled(v)) return null;
  if (f.when !== undefined && !filled(a[f.when])) return null;
  return v;
}

/** `A, B` or `A: 0.7, B: 0.3` as items; null for an empty or unusable text (a name twice, a share that is not a positive number). */
export function parseList(text: string, weights: boolean): ListItem[] | null {
  const parts = text.split(",").map(s => s.trim()).filter(Boolean);
  if (!parts.length) return null;
  const out: ListItem[] = [];
  for (const p of parts) {
    const i = weights ? p.lastIndexOf(":") : -1;
    const name = reagentName(i < 0 ? p : p.slice(0, i)), share = i < 0 ? "1" : p.slice(i + 1).trim();
    const q = parseQuantity(share);
    if (!name || !q || q.unit !== "" || !(q.value > 0)) return null;
    if (out.some(m => m.name.toLowerCase() === name.toLowerCase())) return null;
    out.push({ name, fraction: share });
  }
  return out;
}

/** A number box as the block stores it (`2.5 g`, `20 %`, `105`), or null when it is not a usable number in this field's unit. */
export function numberText(f: BlockField, text: string): string | null {
  const q = parseQuantity(text);
  if (!q || !(q.value >= 0)) return null;
  if (f.unit) {
    if (q.unit !== "" && q.unit !== f.unit && !(massToGrams({ value: 1, unit: f.unit }) !== null && massToGrams(q) !== null)) return null;
  } else if (q.unit !== "") return null;
  const t = text.trim();
  return `${t.slice(0, t.length - q.unit.length).trim()}${f.unit ? ` ${q.unit || f.unit}` : ""}`;
}

/** The window's boxes (what was typed) as stored answers, or the first question that is not usable. */
export function readAnswers(fields: readonly BlockField[], boxes: Record<string, string>): { answers: Answers } | { problem: string; key: string } {
  const answers: Answers = {};
  for (const f of fields) {
    const box = (boxes[f.key] ?? "").trim();
    if (f.type === "list") {
      if (!box) { answers[f.key] = []; continue; }
      const items = parseList(box, f.weights === "fraction");
      if (!items) return { problem: `${f.key}: not a usable list.`, key: f.key };
      answers[f.key] = items;
    } else if (f.type === "number") {
      if (!box) { answers[f.key] = ""; continue; }
      const t = numberText(f, box);
      if (t === null) return { problem: `${f.key}: not a usable number.`, key: f.key };
      answers[f.key] = t;
    } else answers[f.key] = isLink(f) ? reagentName(box) : box;
  }
  return { answers };
}

/** What a block says, as stored answers (the reverse of `setupLines`). */
export function answersFromBlock(fields: readonly BlockField[], block: Block): Answers {
  const out: Answers = {};
  for (const f of fields) {
    const raw = block.setup[f.key];
    if (f.type === "list") {
      const sec = block.steps.find(s => s.name === f.key);
      out[f.key] = sec ? Object.entries(sec.values).map(([k, v]) => ({ name: reagentName(k), fraction: v || "1" })).filter(m => m.name)
        : raw ? [{ name: reagentName(raw), fraction: "1" }].filter(m => m.name) : [];
    } else out[f.key] = raw === undefined ? "" : isLink(f) ? reagentName(raw) : raw;
  }
  return out;
}

const lineValue = (f: BlockField, v: string): string => isLink(f) ? link(v) : v;

/** The set-up lines of the block: `format`, `use`, then one line per filled answer in the header's order (a list as a section). */
export function setupLines(def: Pick<Definition, "name">, fields: readonly BlockField[], a: Answers): string[] {
  const out = ["format: 1", `use: ${def.name}`];
  for (const f of fields) {
    const v = effective(f, a);
    if (v === null) continue;
    if (Array.isArray(v)) out.push(`${f.key}:`, ...v.map(m => `  ${isLink(f) ? link(m.name) : m.name}:${f.weights ? ` ${m.fraction}` : ""}`));
    else out.push(`${f.key}: ${lineValue(f, v)}`);
  }
  return out;
}

/** What Edit set-up has to change in the lines, from the answers before and after: only what differs. */
export function changes(fields: readonly BlockField[], before: Answers, after: Answers): LineOp[] {
  const ops: LineOp[] = [];
  for (const f of fields) {
    const b = effective(f, before), a = effective(f, after);
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    if (a === null) { ops.push({ remove: [null, f.key] }); continue; }
    if (Array.isArray(a)) {
      const key = (m: ListItem): string => isLink(f) ? link(m.name) : m.name;
      for (const o of Array.isArray(b) ? b : []) if (!a.some(m => m.name === o.name)) ops.push({ remove: [f.key, key(o)] });
      for (const m of a) ops.push({ set: [f.key, key(m), f.weights ? m.fraction : ""] });
    } else ops.push({ set: [null, f.key, lineValue(f, a)] });
  }
  return ops;
}

/** Short fingerprint of a definition's text for the head line (FNV-1a, 6 hex digits). */
export function shortHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0").slice(0, 6);
}

/** The head line of the worked-out `#` lines. `replaceWorkedOut` (../raft/text.ts) finds a group by its first words. */
export const workedHead = (name: string, hash = ""): string => `# worked out by Lab Kit (${name}${hash ? `, ${hash}` : ""}), rewritten when the set-up changes`;

/** Where a name is read: in a row (`row`), for one item of its list (`item`), inside a loop over a list (`list`, upper case). */
interface Ctx { row?: number; item?: number; list?: string }
interface Instance { row: number; item?: number; name: string }

const ROW_QTY = ["MOL", "TARGET", "ACTUAL", "AMOUNT"];
const truthy = (v: Value): boolean => {
  const x = Array.isArray(v) ? v[0] : v;
  return isErr(x) || x === null || x === undefined ? false : typeof x === "string" ? x !== "" : typeof x === "boolean" ? x : x !== 0;
};

/** The numbers behind one block: every row worked out from the answers, the chemical notes' properties and the typed `used:` values. */
export class BlockModel {
  private memo = new Map<string, Value>();
  private running = new Set<string>();
  private nodes = new Map<string, ReturnType<typeof checkFormula>>();
  private fieldBy = new Map<string, BlockField>();
  private lists = new Set<string>();

  constructor(readonly def: Definition, readonly fields: readonly BlockField[], readonly answers: Answers, readonly used: Record<string, string>, private lookup: Lookup) {
    for (const f of fields) { this.fieldBy.set(norm(f.key), f); if (f.type === "list") this.lists.add(norm(f.key)); }
  }

  private items(list: string): ListItem[] {
    const f = this.fieldBy.get(list), v = f ? effective(f, this.answers) : null;
    return Array.isArray(v) ? v : [];
  }
  private rowKey(i: number): string { const r = this.def.rows[i]; return r.id !== undefined ? r.id.toUpperCase() : norm(r.each ?? ""); }
  private rowIndex(name: string): number { return this.def.rows.findIndex((_, i) => this.rowKey(i) === name); }

  private formula(src: string, ctx: Ctx): Value {
    let c = this.nodes.get(src);
    if (!c) { c = checkFormula(src, new Set([...this.lists].flatMap(l => [l, `${l}.FRACTION`, ...this.def.rows.flatMap((_, i) => this.def.rows[i].each && this.rowKey(i) === l ? [...ROW_QTY, ...Object.keys(this.def.rows[i].lookup)].map(n => `${l}.${n.toUpperCase()}`) : [])]))); this.nodes.set(src, c); }
    if ("problem" in c) return ERR("#ERROR!", c.problem);
    return evaluate(c.node, n => this.resolve(n, ctx));
  }

  /** The grams typed for an instance in `used:`, or null. */
  private typed(i: Instance): number | null {
    const q = parseQuantity(this.used[i.name] ?? "");
    return q ? massToGrams(q) : null;
  }

  /** A row's own quantity for one item. */
  private qty(row: number, item: number | undefined, name: string): Value | undefined {
    const r = this.def.rows[row];
    const inst = this.instanceName(row, item);
    const key = `Q/${row}/${item}/${name}`;
    const hit = this.memo.get(key);
    if (hit !== undefined) return hit;
    if (this.running.has(key)) return ERR("#CIRC!", `${name.toLowerCase()} refers to itself`);
    this.running.add(key);
    const ctx: Ctx = { row, item, list: r.each ? norm(r.each) : undefined };
    let v: Value | undefined;
    if (name === "MOL") v = r.mol === undefined ? undefined : this.formula(r.mol, ctx);
    else if (name === "TARGET") v = this.formula(r.target, ctx);
    else if (name === "ACTUAL") { const g = this.typed({ row, item, name: inst }); v = g === null ? "" : g; }
    else if (name === "AMOUNT") { const a = this.qty(row, item, "ACTUAL"); v = typeof a === "number" ? a : this.qty(row, item, "TARGET"); }
    else if (name === "FRACTION" && r.each) v = Number(this.items(norm(r.each))[item ?? 0]?.fraction);
    else {
      const prop = Object.entries(r.lookup).find(([k]) => k.toUpperCase() === name)?.[1];
      if (prop !== undefined) {
        const x = this.lookup(inst, prop);
        v = x !== null && Number.isFinite(x) && x > 0 ? x : ERR("#N/A", `no ${prop} for ${inst}`);
      }
    }
    this.running.delete(key);
    if (v !== undefined) this.memo.set(key, v);
    return v;
  }

  private rowOn(row: number): boolean {
    const r = this.def.rows[row];
    return r.when === undefined || truthy(this.formula(r.when, { row, item: r.each ? 0 : undefined, list: r.each ? norm(r.each) : undefined }));
  }

  /** The rows that are on the block now, one instance per item of a repeated row. */
  instances(): Instance[] {
    const out: Instance[] = [];
    this.def.rows.forEach((r, row) => {
      if (r.each) { if (this.rowOn(row)) this.items(norm(r.each)).forEach((m, item) => out.push({ row, item, name: m.name })); }
      else if (this.rowOn(row)) out.push({ row, name: this.instanceName(row, undefined) });
    });
    return out;
  }

  private instanceName(row: number, item: number | undefined): string {
    const r = this.def.rows[row];
    if (r.each) return this.items(norm(r.each))[item ?? 0]?.name ?? "";
    return r.name !== undefined ? this.fill(r.name, {}) : r.id ?? "";
  }

  private resolve(name: string, ctx: Ctx): Value | undefined {
    if (ctx.row !== undefined) {
      const v = this.qty(ctx.row, ctx.item, name);
      if (v !== undefined) return v;
    }
    if (ctx.list && name === "FRACTION") return Number(this.items(ctx.list)[ctx.item ?? 0]?.fraction);
    if (name === "ROWS") return this.instances().length;
    if (name === "WEIGHED") return this.instances().filter(i => this.def.rows[i.row].actual === "mass" && this.typed(i) !== null).length;
    const dot = name.indexOf(".");
    if (dot > 0) {
      const head = name.slice(0, dot), prop = name.slice(dot + 1);
      const row = this.rowIndex(head);
      if (row >= 0) {
        const r = this.def.rows[row];
        if (r.each) return this.items(head).map((_, i) => this.qty(row, i, prop) as Value);
        return this.rowOn(row) ? this.qty(row, undefined, prop) : ERR("#N/A", `${head.toLowerCase()} is not in this block`);
      }
      if (this.lists.has(head) && prop === "FRACTION") return this.items(head).map(m => Number(m.fraction));
      return undefined;
    }
    const f = this.fieldBy.get(name);
    if (f) {
      if (f.type === "list") return this.items(name).map(m => Number(m.fraction));
      const v = effective(f, this.answers);
      if (typeof v !== "string") return "";
      if (f.type === "number") {
        const q = parseQuantity(v), g = q ? massToGrams(q) : null;
        return q ? (g ?? q.value) : ERR("#VALUE!", `${f.key} is not a number`);
      }
      return v;
    }
    const src = Object.entries(this.def.values).find(([k]) => k.toUpperCase() === name)?.[1];
    if (src === undefined) return undefined;
    const key = `V/${name}`;
    const hit = this.memo.get(key);
    if (hit !== undefined) return hit;
    if (this.running.has(key)) return ERR("#CIRC!", `${name.toLowerCase()} refers to itself`);
    this.running.add(key);
    const v = this.formula(src, {});
    this.running.delete(key);
    this.memo.set(key, v);
    return v;
  }

  private host: FillHost<Ctx> = {
    value: (formula, ctx) => this.formula(formula, ctx),
    word: (key, ctx) => {
      if (key === "name" && ctx.list) return this.items(ctx.list)[ctx.item ?? 0]?.name;
      const f = this.fieldBy.get(norm(key)), v = f ? effective(f, this.answers) : null;
      return typeof v === "string" ? v : undefined;
    },
    items: (list, ctx) => {
      const l = norm(list);
      if (!this.lists.has(l)) return null;
      const row = this.def.rows.findIndex(r => r.each !== undefined && norm(r.each) === l);
      return this.items(l).map((_, item) => ({ row: row >= 0 ? row : undefined, item, list: l, ...(ctx.row === undefined ? {} : {}) }));
    },
  };

  /** A text with its tokens filled (title, summary, row names, labels, worked-out lines). */
  fill(text: string, ctx: Ctx = {}): string { return fillText(text, ctx, this.host); }

  /** The `used:` keys in row order. */
  usedNames(): string[] { return this.instances().map(i => i.name); }

  /** True when every row's target is a usable number (a missing MW, a division by zero or a name that is not known gives false). */
  computable(): boolean {
    return this.instances().every(i => { const t = this.qty(i.row, i.item, "TARGET"); return typeof t === "number" && Number.isFinite(t); });
  }

  /** A value of the definition (`mn`) by name, for the proof and for the view later. */
  value(name: string): Value | undefined { return this.resolve(name.toUpperCase(), {}); }

  /** The worked-out `#` lines for the definition's `worked:`, or none when something cannot be worked out (nothing is guessed). */
  worked(hash = ""): string[] {
    if (!this.computable()) return [];
    const rows: { label: string; text: string }[] = [];
    for (const w of this.def.worked) {
      if (w.when !== undefined && !truthy(this.formula(w.when, {}))) continue;
      if (w.each) {
        const row = this.def.rows.findIndex(r => r.each !== undefined && norm(r.each) === norm(w.each!));
        const list = norm(w.each);
        this.items(list).forEach((m, item) => {
          const ctx: Ctx = { row: row >= 0 ? row : undefined, item, list };
          rows.push({ label: w.label !== undefined ? this.fill(w.label, ctx) : m.name, text: this.fill(w.text, ctx) });
        });
      } else rows.push({ label: this.fill(w.label ?? "", {}), text: this.fill(w.text, {}) });
    }
    // columns line up on the reagents' names; a longer label (Monomers) is followed by one space, never run into its text
    const width = Math.max(0, ...this.instances().map(i => i.name.length)) + 2;
    const pad = (label: string): string => label.length >= width ? `${label} ` : label.padEnd(width);
    const mws = this.instances().filter(i => Object.keys(this.def.rows[i.row].lookup).some(k => k.toUpperCase() === "MW"))
      .map(i => `${i.name} ${fmtMw(this.qty(i.row, i.item, "MW") as number)}`);
    return [workedHead(this.def.name, hash), ...(mws.length ? [`# MW from the chemical notes: ${mws.join(", ")}`] : []), ...rows.map(r => `# ${pad(r.label)}${r.text}`)];
  }
}

/** The block text between the fences: the set-up, empty `used:` lines (or the typed ones) and the worked-out lines when given. */
export function blockSource(model: BlockModel, worked: string[] = []): string {
  const names = model.usedNames();
  return [
    ...setupLines(model.def, model.fields, model.answers),
    ...(names.length ? ["used:", ...names.map(n => `  ${n}:${model.used[n] ? ` ${model.used[n]}` : ""}`)] : []),
    ...worked,
  ].join("\n");
}

/** The block as inserted: the shared tag and fences included. */
export const blockText = (source: string): string => "```lk-block\n" + source + "\n```\n";
