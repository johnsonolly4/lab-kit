// Formula engine: block parsing, tokenizer, parser, evaluator. No Obsidian imports, so it runs under vitest.
// Ported from the v0.3 plain-JS plugin (see git history before the port) with no behaviour change.

/* ---- Types ---- */
export interface CalcError { err: string; msg?: string }
/** A cell value. Arrays are ranges that have not been reduced to one value yet. */
export type Value = number | string | boolean | null | CalcError | Value[];

export type Node =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "rel"; dc: number; dr: number }
  | { t: "ref"; block: string | null; c: number; r: number }
  | { t: "range"; block: string | null; c1: number; r1: number; c2: number; r2: number }
  | { t: "const"; name: string }
  | { t: "fn"; name: string; args: Node[] }
  | { t: "neg"; a: Node }
  | { t: "pct"; a: Node }
  | { t: "bin"; op: string; a: Node; b: Node };

export type Cell =
  | { raw: string; kind: "blank" }
  | { raw: string; kind: "text" }
  | { raw: string; kind: "number"; value: number }
  | { raw: string; kind: "formula"; ast?: Node; parseError?: string };

export interface ParsedBlock {
  opts: Record<string, string>;
  cells: Cell[][];
  rowLines: number[];
  name: string | null;
}

export interface FoundBlock { lineStart: number; lineEnd: number; prefix: string; source: string }

export interface FormatOpts { decimals?: string | number | null; sig?: string | number }

export interface Env {
  /** Reads a note property (MW, PROP). `isMW` only changes the error text. */
  prop?: (note: string, keys: string[], isMW: boolean) => Value;
}

interface Token { t: "rel" | "num" | "str" | "qual" | "ref" | "id" | "op"; v?: string | number; dc?: number; dr?: number; c?: number; r?: number }

export const ERR = (code: string, msg?: string): CalcError => ({ err: code, msg });
export const isErr = (v: unknown): v is CalcError => !!v && typeof v === "object" && "err" in v;

export function colToIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
export function indexToCol(i: number): string {
  let s = ""; i += 1;
  while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
  return s;
}
export const normName = (n: unknown): string => String(n).trim().toLowerCase();
/** "[[Lipoic Acid|LA]]" → "Lipoic Acid" */
export const cleanLink = (s: unknown): string => String(s ?? "").replace(/^\s*!?\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]\s*$/, "$1").replace(/\*\*/g, "").trim();
export const sameText = (a: unknown, b: unknown): boolean => cleanLink(a).toLowerCase() === cleanLink(b).toLowerCase();

/* ---- Block parsing ---- */
export function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells: string[] = []; let cur = ""; let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\" && s[i + 1] === "|") { cur += "|"; i++; continue; }
    if (c === "[" && s[i + 1] === "[") { depth++; cur += "[["; i++; continue; }
    if (c === "]" && s[i + 1] === "]") { depth = Math.max(0, depth - 1); cur += "]]"; i++; continue; }
    if (c === "|" && depth === 0) { cells.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  cells.push(cur.trim());
  return cells;
}
export const isSeparator = (line: string): boolean => /^[\s|:-]+$/.test(line) && line.includes("-");
/** Escape "|" in a cell, except inside [[link|alias]]. */
function escapeCell(s: string): string {
  let out = "", depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "[" && s[i + 1] === "[") { depth++; out += "[["; i++; continue; }
    if (s[i] === "]" && s[i + 1] === "]") { depth = Math.max(0, depth - 1); out += "]]"; i++; continue; }
    out += (s[i] === "|" && depth === 0) ? "\\|" : s[i];
  }
  return out;
}
export const joinRow = (cells: unknown[]): string => "| " + cells.map(c => escapeCell(String(c))).join(" | ") + " |";

const NUM_RE = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;

export function parseBlock(source: string): ParsedBlock {
  const opts: Record<string, string> = {}; const rows: string[][] = []; const rowLines: number[] = [];
  source.split(/\r?\n/).forEach((raw, idx) => {
    const line = raw.trim();
    if (!line || line.startsWith("//")) return;
    if (line.startsWith("|")) {
      if (isSeparator(line)) return;
      rows.push(splitRow(line)); rowLines.push(idx); return;
    }
    const m = line.match(/^([A-Za-z][\w ]*?)\s*:\s*(.*)$/);
    if (m) opts[m[1].trim().toLowerCase()] = m[2].trim();
  });
  const cells = rows.map(r => r.map(parseCell));
  return { opts, cells, rowLines, name: opts.name ? normName(opts.name) : null };
}
function parseCell(raw: string): Cell {
  if (raw === "") return { raw, kind: "blank" };
  if (raw.startsWith("=")) {
    try { return { raw, kind: "formula", ast: parseFormula(raw.slice(1)) }; }
    catch (e) { return { raw, kind: "formula", parseError: (e as Error).message }; }
  }
  if (NUM_RE.test(raw)) return { raw, kind: "number", value: parseFloat(raw) };
  return { raw, kind: "text" };
}

/* ---- Formula tokenizer ---- */
function tokenize(src: string): Token[] {
  const out: Token[] = []; let i = 0;
  const rx = {
    ws: /^\s+/,
    rel: /^\(\s*([+-]?\d+)\s*c\s*([+-]?\d+)\s*r\s*\)/i,          // CalcCraft (-1c-0r)
    num: /^(\d+\.?\d*|\.\d+)(e[-+]?\d+)?/i,
    str: /^"((?:[^"]|"")*)"/,
    qual: /^(?:'([^']+)'|([A-Za-z_][\w.-]*))!/,
    ref: /^\$?([A-Za-z]{1,3})\$?(\d+)(?![\w(])/,
    ident: /^[A-Za-z_][\w.]*/,
    op: /^(<=|>=|<>|[-+*/^&=<>(),:%;])/
  };
  while (i < src.length) {
    const rest = src.slice(i); let m;
    if ((m = rest.match(rx.ws))) { i += m[0].length; continue; }
    if ((m = rest.match(rx.rel))) { out.push({ t: "rel", dc: +m[1], dr: +m[2] }); i += m[0].length; continue; }
    if ((m = rest.match(rx.num))) { out.push({ t: "num", v: parseFloat(m[0]) }); i += m[0].length; continue; }
    if ((m = rest.match(rx.str))) { out.push({ t: "str", v: m[1].replace(/""/g, '"') }); i += m[0].length; continue; }
    if ((m = rest.match(rx.qual))) { out.push({ t: "qual", v: normName(m[1] ?? m[2]) }); i += m[0].length; continue; }
    if ((m = rest.match(rx.ref))) { out.push({ t: "ref", c: colToIndex(m[1]), r: parseInt(m[2], 10) - 1 }); i += m[0].length; continue; }
    if ((m = rest.match(rx.ident))) { out.push({ t: "id", v: m[0].toUpperCase() }); i += m[0].length; continue; }
    if ((m = rest.match(rx.op))) { out.push({ t: "op", v: m[0] === ";" ? "," : m[0] }); i += m[0].length; continue; }
    throw new Error(`Unexpected "${rest[0]}"`);
  }
  return out;
}

/* ---- Formula parser (Excel precedence) ---- */
export function parseFormula(src: string): Node {
  const toks = tokenize(src); let p = 0;
  const peek = (): Token | undefined => toks[p];
  const isOp = (v: string): boolean => !!peek() && peek()!.t === "op" && peek()!.v === v;
  const expect = (v: string): void => { if (!isOp(v)) throw new Error(`Expected "${v}"`); p++; };

  function cmp(): Node {
    let a = concat();
    while (peek() && peek()!.t === "op" && ["=", "<>", "<", ">", "<=", ">="].includes(peek()!.v as string)) {
      const op = toks[p++].v as string; a = { t: "bin", op, a, b: concat() };
    }
    return a;
  }
  function concat(): Node { let a = add(); while (isOp("&")) { p++; a = { t: "bin", op: "&", a, b: add() }; } return a; }
  function add(): Node { let a = mul(); while (isOp("+") || isOp("-")) { const op = toks[p++].v as string; a = { t: "bin", op, a, b: mul() }; } return a; }
  function mul(): Node { let a = pow(); while (isOp("*") || isOp("/")) { const op = toks[p++].v as string; a = { t: "bin", op, a, b: pow() }; } return a; }
  function pow(): Node { let a = unary(); while (isOp("^")) { p++; a = { t: "bin", op: "^", a, b: unary() }; } return a; }
  function unary(): Node {
    if (isOp("-")) { p++; return { t: "neg", a: unary() }; }
    if (isOp("+")) { p++; return unary(); }
    let a = primary();
    while (isOp("%")) { p++; a = { t: "pct", a }; }
    return a;
  }
  function refOrRange(block: string | null): Node {
    const r1 = toks[p++];
    if (!r1 || r1.t !== "ref") throw new Error("Expected a cell reference");
    const c1 = r1.c as number, row1 = r1.r as number;
    if (isOp(":")) {
      p++;
      if (peek() && peek()!.t === "qual") p++;
      const r2 = toks[p++];
      if (!r2 || r2.t !== "ref") throw new Error("Bad range");
      const c2 = r2.c as number, row2 = r2.r as number;
      return { t: "range", block, c1: Math.min(c1, c2), r1: Math.min(row1, row2), c2: Math.max(c1, c2), r2: Math.max(row1, row2) };
    }
    return { t: "ref", block, c: c1, r: row1 };
  }
  function primary(): Node {
    const tk = peek();
    if (!tk) throw new Error("Formula ends too early");
    if (tk.t === "num") { p++; return { t: "num", v: tk.v as number }; }
    if (tk.t === "str") { p++; return { t: "str", v: tk.v as string }; }
    if (tk.t === "rel") { p++; return { t: "rel", dc: tk.dc as number, dr: tk.dr as number }; }
    if (tk.t === "qual") { p++; return refOrRange(tk.v as string); }
    if (tk.t === "ref") return refOrRange(null);
    if (tk.t === "id") {
      p++;
      if (isOp("(")) {
        p++; const args: Node[] = [];
        if (!isOp(")")) { args.push(cmp()); while (isOp(",")) { p++; args.push(cmp()); } }
        expect(")");
        return { t: "fn", name: tk.v as string, args };
      }
      return { t: "const", name: tk.v as string };
    }
    if (isOp("(")) { p++; const e = cmp(); expect(")"); return e; }
    throw new Error(`Unexpected "${tk.v ?? tk.t}"`);
  }
  const ast = cmp();
  if (p < toks.length) throw new Error(`Unexpected "${toks[p].v ?? toks[p].t}"`);
  return ast;
}

/* ---- Evaluation ---- */
export function toNum(v: Value | undefined): number | CalcError {
  if (isErr(v)) return v;
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (NUM_RE.test(String(v).trim())) return parseFloat(String(v));
  return ERR("#VALUE!", `"${String(v)}" is not a number`);
}
const flat = (args: Value[]): Value[] => args.flatMap(a => Array.isArray(a) ? a : [a]);
const numsOnly = (vals: Value[]): number[] => vals.filter((v): v is number => typeof v === "number");
const firstErr = (vals: Value[]): CalcError | undefined => vals.find(isErr);
function num1(x: Value, f: (a: number) => Value): Value { const a = toNum(Array.isArray(x) ? x[0] : x); return isErr(a) ? a : f(a); }
function num2(x: Value, y: Value, f: (a: number, b: number) => Value): Value {
  const a = toNum(Array.isArray(x) ? x[0] : x), b = toNum(Array.isArray(y) ? y[0] : y);
  if (isErr(a)) return a; if (isErr(b)) return b; return f(a, b);
}
function parseClock(s: unknown): number | null {
  const m = String(s ?? "").trim().match(/^(\d{1,2})[:.](\d{2})$/);
  return m ? (+m[1]) * 60 + (+m[2]) : null;
}

const FUNCS: Record<string, (a: Value[]) => Value> = {
  SUM: (a) => { const v = flat(a); return firstErr(v) || numsOnly(v).reduce((s, x) => s + x, 0); },
  PRODUCT: (a) => { const v = flat(a); return firstErr(v) || numsOnly(v).reduce((s, x) => s * x, 1); },
  AVERAGE: (a) => { const v = flat(a); const e = firstErr(v); if (e) return e; const n = numsOnly(v); return n.length ? n.reduce((s, x) => s + x, 0) / n.length : ERR("#DIV/0!"); },
  MIN: (a) => { const v = flat(a); return firstErr(v) || (numsOnly(v).length ? Math.min(...numsOnly(v)) : 0); },
  MAX: (a) => { const v = flat(a); return firstErr(v) || (numsOnly(v).length ? Math.max(...numsOnly(v)) : 0); },
  COUNT: (a) => numsOnly(flat(a)).length,
  COUNTA: (a) => flat(a).filter(v => v != null && v !== "").length,
  SUMPRODUCT: (a) => {
    if (!a.length) return 0;
    const arrs = a.map(x => Array.isArray(x) ? x : [x]);
    const len = arrs[0].length;
    if (arrs.some(x => x.length !== len)) return ERR("#VALUE!", "ranges must be the same size");
    let s = 0;
    for (let i = 0; i < len; i++) {
      let prod = 1;
      for (const arr of arrs) { const v = arr[i]; if (isErr(v)) return v; prod *= typeof v === "number" ? v : 0; }
      s += prod;
    }
    return s;
  },
  ROUND: ([x, d]) => num2(x, d ?? 0, (a, b) => { const f = 10 ** b; return Math.round(a * f) / f; }),
  ROUNDUP: ([x, d]) => num2(x, d ?? 0, (a, b) => { const f = 10 ** b; return Math.sign(a) * Math.ceil(Math.abs(a) * f) / f; }),
  ROUNDDOWN: ([x, d]) => num2(x, d ?? 0, (a, b) => { const f = 10 ** b; return Math.sign(a) * Math.floor(Math.abs(a) * f) / f; }),
  INT: ([x]) => num1(x, Math.floor),
  ABS: ([x]) => num1(x, Math.abs),
  SQRT: ([x]) => num1(x, (a) => a < 0 ? ERR("#NUM!") : Math.sqrt(a)),
  EXP: ([x]) => num1(x, Math.exp),
  LN: ([x]) => num1(x, (a) => a <= 0 ? ERR("#NUM!") : Math.log(a)),
  LOG10: ([x]) => num1(x, (a) => a <= 0 ? ERR("#NUM!") : Math.log10(a)),
  LOG: ([x, b]) => num2(x, b ?? 10, (a, bb) => a <= 0 || bb <= 0 ? ERR("#NUM!") : Math.log(a) / Math.log(bb)),
  POWER: ([x, y]) => num2(x, y, (a, b) => a ** b),
  MOD: ([x, y]) => num2(x, y, (a, b) => b === 0 ? ERR("#DIV/0!") : a - b * Math.floor(a / b)),
  PI: () => Math.PI,
  IFERROR: ([v, alt]) => isErr(v) ? (alt ?? "") : v,
  AND: (a) => { const v = flat(a); return firstErr(v) || v.every(x => !!toNum(x)); },
  OR: (a) => { const v = flat(a); return firstErr(v) || v.some(x => !!toNum(x)); },
  NOT: ([x]) => { const n = toNum(x); return isErr(n) ? n : !n; },
  AVG: (a) => FUNCS.AVERAGE(a),
  CONCAT: (a) => { const v = flat(a); return firstErr(v) || v.map(x => x ?? "").join(""); },
  MATCH: ([v, range]) => {
    const arr = Array.isArray(range) ? range : [range];
    const i = arr.findIndex(x => typeof v === "number" ? x === v : sameText(x, v));
    return i < 0 ? ERR("#N/A", `"${cleanLink(v)}" not found`) : i + 1;
  },
  CLOCK: ([start, mins]) => {
    if (isErr(start)) return start;
    if (start == null || start === "") return ERR("#VALUE!", "start time is empty");
    const s = parseClock(start);
    if (s == null) return ERR("#VALUE!", `use hh:mm, not "${String(start)}"`);
    const m = toNum(mins); if (isErr(m)) return m;
    const t = ((Math.round(s + m) % 1440) + 1440) % 1440;
    return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  }
};
export const SUPPORTED_FUNCTIONS = [...Object.keys(FUNCS), "IF", "XLOOKUP", "INDEX", "MW", "PROP"];
const MW_KEYS = ["mw", "mr", "molecular weight", "molecular_weight", "molar mass", "molar_mass", "m_w"];

/** A workbook = every calc block in one note. env.prop(note, keys) reads note properties. */
export class Workbook {
  blocks: ParsedBlock[];
  env: Env;
  byName = new Map<string, number>();
  memo = new Map<string, Value>();
  deps = new Map<string, Set<string>>();       // key -> Set of blank cell keys it depends on
  stack = new Set<string>();
  collect: Set<string>[] = [];

  constructor(blocks: ParsedBlock[], env: Env = {}) {
    this.blocks = blocks;
    this.env = env;
    blocks.forEach((b, i) => { if (b.name && !this.byName.has(b.name)) this.byName.set(b.name, i); });
  }
  blockIndex(name: string | null, selfIdx: number): number {
    if (name == null) return selfIdx;
    return this.byName.has(name) ? this.byName.get(name)! : -1;
  }
  cell(bi: number, r: number, c: number): Value {
    const key = `${bi}|${r}|${c}`;
    const parent = this.collect[this.collect.length - 1];
    const block = this.blocks[bi];
    const cell = block?.cells[r]?.[c];
    let val: Value;
    if (this.memo.has(key)) val = this.memo.get(key)!;
    else if (!cell || cell.kind === "blank") val = null;
    else if (cell.kind === "number") val = cell.value;
    else if (cell.kind === "text") val = cell.raw;
    else if (cell.parseError) val = ERR("#ERROR!", cell.parseError);
    else {
      if (this.stack.has(key)) return ERR("#CIRC!", "formula refers to itself");
      const mine = new Set<string>();
      this.stack.add(key); this.collect.push(mine);
      try { val = this.evalNode(cell.ast!, bi, r, c); }
      finally { this.stack.delete(key); this.collect.pop(); }
      if (Array.isArray(val)) val = val.length === 1 ? val[0] : ERR("#VALUE!", "range where one value was expected");
      this.memo.set(key, val);
      this.deps.set(key, mine);
    }
    if (parent) {
      if (!cell || cell.kind === "blank") { if (block && r < block.cells.length) parent.add(key); }
      else this.deps.get(key)?.forEach(k => parent.add(k));
    }
    return val;
  }
  blanksOf(bi: number, r: number, c: number): Set<string> { return this.deps.get(`${bi}|${r}|${c}`) ?? new Set(); }
  label(key: string): { text: string; addr: string } {
    const [bi, r, c] = key.split("|").map(Number);
    const b = this.blocks[bi];
    const head = cleanLink(b?.cells[0]?.[c]?.raw ?? "");
    const hdr = (b?.cells[0] ?? []).map(x => cleanLink(x.raw).toLowerCase());
    let lc = hdr.findIndex(h => /^(name|reagent|chemical|sample|code|item|parameter|state|setting)/.test(h));
    if (lc < 0) lc = 0;
    const rowLabel = c !== lc ? cleanLink(b?.cells[r]?.[lc]?.raw ?? "") : "";
    const generic = /^(value|amount|)$/i.test(head);
    const text = generic ? (rowLabel || head || "a value") : (rowLabel ? `${head} · ${rowLabel}` : head);
    const addr = (bi > 0 && b?.name ? b.name + "!" : "") + indexToCol(c) + (r + 1);
    return { text, addr };
  }
  evalNode(n: Node, bi: number, r: number, c: number): Value {
    switch (n.t) {
      case "num": return n.v;
      case "str": return n.v;
      case "const":
        if (n.name === "PI") return Math.PI;
        if (n.name === "TRUE") return true;
        if (n.name === "FALSE") return false;
        return ERR("#NAME?", `unknown name ${n.name}`);
      case "rel": {
        const rr = r + n.dr, cc = c + n.dc;
        if (rr < 0 || cc < 0) return ERR("#REF!");
        return this.cell(bi, rr, cc);
      }
      case "ref": {
        const b = this.blockIndex(n.block, bi);
        if (b < 0) return ERR("#REF!", `no table named "${n.block}" in this note`);
        return this.cell(b, n.r, n.c);
      }
      case "range": {
        const b = this.blockIndex(n.block, bi);
        if (b < 0) return ERR("#REF!", `no table named "${n.block}" in this note`);
        const out: Value[] = [];
        for (let rr = n.r1; rr <= n.r2; rr++) for (let cc = n.c1; cc <= n.c2; cc++) out.push(this.cell(b, rr, cc));
        return out;
      }
      case "neg": { const v = toNum(this.scalar(n.a, bi, r, c)); return isErr(v) ? v : -v; }
      case "pct": { const v = toNum(this.scalar(n.a, bi, r, c)); return isErr(v) ? v : v / 100; }
      case "fn": return this.evalFn(n, bi, r, c);
      case "bin": {
        const a = this.scalar(n.a, bi, r, c), b = this.scalar(n.b, bi, r, c);
        if (n.op === "&") { if (isErr(a)) return a; if (isErr(b)) return b; return `${String(a ?? "")}${String(b ?? "")}`; }
        if (["=", "<>", "<", ">", "<=", ">="].includes(n.op)) {
          if (isErr(a)) return a; if (isErr(b)) return b;
          const str = typeof a === "string" || typeof b === "string";
          const x = (str ? cleanLink(a ?? "").toLowerCase() : toNum(a)) as string | number;
          const y = (str ? cleanLink(b ?? "").toLowerCase() : toNum(b)) as string | number;
          const res: Record<string, boolean> = { "=": x === y, "<>": x !== y, "<": x < y, ">": x > y, "<=": x <= y, ">=": x >= y };
          return res[n.op];
        }
        const x = toNum(a), y = toNum(b);
        if (isErr(x)) return x; if (isErr(y)) return y;
        switch (n.op) {
          case "+": return x + y;
          case "-": return x - y;
          case "*": return x * y;
          case "/": return y === 0 ? ERR("#DIV/0!", "dividing by zero or an empty cell") : x / y;
          case "^": return x ** y;
        }
      }
    }
    return ERR("#ERROR!");
  }
  evalFn(n: Extract<Node, { t: "fn" }>, bi: number, r: number, c: number): Value {
    const A = n.args;
    switch (n.name) {
      case "IF": {
        const cond = this.scalar(A[0], bi, r, c);
        if (isErr(cond)) return cond;
        const t = typeof cond === "string" ? cond !== "" : toNum(cond);
        if (isErr(t)) return t;
        const branch = t ? A[1] : A[2];
        return branch ? this.scalar(branch, bi, r, c) : !!t;
      }
      case "XLOOKUP": {                         // lazy: only evaluates the matching return cell
        const v = this.scalar(A[0], bi, r, c);
        if (isErr(v)) return v;
        if (v == null || v === "") return A[3] ? this.scalar(A[3], bi, r, c) : ERR("#N/A", "nothing to look up");
        const look = this.evalNode(A[1], bi, r, c);
        const arr = Array.isArray(look) ? look : [look];
        const i = arr.findIndex(x => typeof v === "number" ? x === v : sameText(x, v));
        if (i < 0) return A[3] ? this.scalar(A[3], bi, r, c) : ERR("#N/A", `"${cleanLink(v)}" not found`);
        return this.pick(A[2], i, bi, r, c);
      }
      case "INDEX": {
        const k = toNum(this.scalar(A[1], bi, r, c));
        if (isErr(k)) return k;
        return this.pick(A[0], Math.round(k) - 1, bi, r, c);
      }
      case "MW":
      case "PROP": {
        const target = this.scalar(A[0], bi, r, c);
        if (isErr(target)) return target;
        if (target == null || target === "") return ERR("#VALUE!", "no chemical name");
        const keys = n.name === "MW" ? MW_KEYS : [String(this.scalar(A[1], bi, r, c) ?? "")];
        if (!this.env.prop) return ERR("#NAME?", "note properties unavailable");
        return this.env.prop(cleanLink(target), keys, n.name === "MW");
      }
    }
    const f = FUNCS[n.name];
    if (!f) return ERR("#NAME?", `unknown function ${n.name}()`);
    return f(A.map(a => this.evalNode(a, bi, r, c)));
  }
  /** i-th cell of a range node without evaluating the others. */
  pick(node: Node, i: number, bi: number, r: number, c: number): Value {
    if (node.t !== "range") { const v = this.evalNode(node, bi, r, c); return Array.isArray(v) ? (v[i] ?? ERR("#REF!")) : (i === 0 ? v : ERR("#REF!")); }
    const b = this.blockIndex(node.block, bi);
    if (b < 0) return ERR("#REF!");
    const w = node.c2 - node.c1 + 1;
    const rr = node.r1 + Math.floor(i / w), cc = node.c1 + (i % w);
    if (rr > node.r2 || i < 0) return ERR("#REF!");
    return this.cell(b, rr, cc);
  }
  scalar(node: Node, bi: number, r: number, c: number): Value {
    const v = this.evalNode(node, bi, r, c);
    return Array.isArray(v) ? (v.length === 1 ? v[0] : ERR("#VALUE!", "range where one value was expected")) : v;
  }
}

/* ---- Number formatting ---- */
export function formatValue(v: Value | undefined, opts: FormatOpts): string {
  if (isErr(v)) return v.err;
  if (v == null) return "";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v !== "number") return String(v);
  if (!isFinite(v)) return "#NUM!";
  if (opts.decimals != null && opts.decimals !== "" && !isNaN(+opts.decimals)) return v.toFixed(+opts.decimals);
  if (v === 0) return "0";
  const sig = Math.max(1, Math.min(10, parseInt(String(opts.sig ?? "4"), 10) || 4));
  if (Math.abs(v) >= 1) return String(Number(v.toFixed(Math.max(0, sig))));
  return String(Number(v.toPrecision(sig)));
}

/* ---- Find all calc blocks in a note's text ---- */
export function extractBlocks(text: string): FoundBlock[] {
  const lines = text.split(/\r?\n/);
  const blocks: FoundBlock[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*(?:>\s*)*)(`{3,}|~{3,})\s*calc\s*$/);
    if (!m) continue;
    const prefix = m[1], fence = m[2];
    const body: string[] = []; let j = i + 1;
    for (; j < lines.length; j++) {
      const l = lines[j].startsWith(prefix) ? lines[j].slice(prefix.length) : lines[j];
      const t = l.trim();
      if (t.length >= fence.length && t === fence[0].repeat(t.length)) break;
      body.push(l);
    }
    blocks.push({ lineStart: i, lineEnd: j, prefix, source: body.join("\n") });
    i = j;
  }
  return blocks;
}
