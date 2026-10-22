// What the Alt+S calculators share (solution-volume, recipe, raft-table, results, the methods): the questions, the note's tables, the chemical list.
// A port of the helpers inside the old labSnippets.js Templater script, with the same output (tests/snippet-port.test.ts).
import { Notice, type App, type TFile } from "obsidian";
import type { FormFn, FormField, FormOpts } from "../kit/snippet-form";
import type { KitData } from "../kit/paths";
import { calcTables, codeFormParts, codeSources, resolveCodes, type CodeSource } from "../kit/snippet-env";
import { loadMethods, type Method } from "./methods";
import { list, plain, str } from "./util";

/** What a calculator needs from the plugin: the vault, the settings, the plugin's question window, the note being written and the date. */
export interface SnippetCtx {
  app: App;
  kit: Pick<KitData, "chemicalFolder" | "chemClassOnly" | "methodsFolder">;
  form: FormFn;
  /** The note the text goes into (its path resolves links; method tags are written to it). */
  file: TFile | null;
  /** Today as YYYY-MM-DD. */
  today: () => string;
  /** false: do not add method tags to `file` (a copy made without a note). Default true. */
  tags?: boolean;
}

export interface SuggestChem { name: string; aliases: string[] }
interface ChemEntry extends SuggestChem { classes: string[] }

type Node = { children?: Node[]; extension?: string; basename: string; path: string };
type CacheFile = Parameters<App["metadataCache"]["getFileCache"]>[0];
const fmOf = (app: App, f: unknown): Record<string, unknown> => app.metadataCache.getFileCache(f as CacheFile)?.frontmatter ?? {};

/** One run of a calculator: the questions go through ctx.form, table names stay unique within this run. */
export class SnippetRun {
  private taken = new Set<string>();
  private chemCache: ChemEntry[] | null | undefined;
  private methodCache: Method[] | undefined;
  constructor(readonly ctx: SnippetCtx) {}

  get app(): App { return this.ctx.app; }
  get path(): string { return this.ctx.file?.path ?? ""; }
  get noteText(): string { return this.app.workspace.activeEditor?.editor?.getValue() ?? ""; }

  form(title: string, fields: Partial<FormField>[], opts?: FormOpts): Promise<Record<string, unknown> | null> {
    return this.ctx.form(title, fields as FormField[], opts);
  }

  /** NMR / GPC / DLS and the notes of the Methods folder. */
  get methods(): Method[] { return this.methodCache ??= loadMethods(this.app, this.ctx.kit.methodsFolder, this.path); }

  /** The chemical notes (Settings → Lab Kit → Chemical folder) as { name, aliases, classes } for the forms' suggestions; undefined when no folder is set. */
  private chemAll(): ChemEntry[] | undefined {
    if (this.chemCache !== undefined) return this.chemCache ?? undefined;
    const path = String(this.ctx.kit.chemicalFolder ?? "").trim().replace(/^\/+|\/+$/g, "");
    const root = (path ? this.app.vault.getFolderByPath(path) : null) as Node | null;
    if (!root) { this.chemCache = null; return undefined; }
    const out: ChemEntry[] = [];
    const walk = (children: Node[] | undefined): void => {
      for (const c of children ?? []) {
        if (Array.isArray(c.children)) walk(c.children);
        else if (c.extension === "md") {
          const fm = fmOf(this.app, c);
          const key = Object.keys(fm).find(k => k.trim().toLowerCase() === "names");
          const raw = key === undefined ? [] : [fm[key]].flat(Infinity);
          const aliases = raw.filter(a => a != null && a !== "").map(a => String(a).trim()).filter(a => a && a.toLowerCase() !== c.basename.toLowerCase());
          const ckey = Object.keys(fm).find(k => k.replace(/\s+/g, " ").trim().toLowerCase() === "chemical class");
          const classes = ckey === undefined ? [] : [fm[ckey]].flat(Infinity).filter(a => a != null && a !== "").map(a => String(a).trim()).filter(Boolean);
          out.push({ name: c.basename, aliases, classes });
        }
      }
    };
    walk(root.children);
    out.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
    this.chemCache = out;
    return out;
  }

  /** The suggestions of a field with no class: every chemical (undefined without a Chemical folder). */
  get chems(): SuggestChem[] | undefined { return this.chemAll()?.map(({ name, aliases }) => ({ name, aliases })); }

  /** The suggestions for a field that asks for Chemical classes (any text, case-insensitive): those chemicals only (Settings → "Only suggest chemicals of the asked class") or first, then the rest. No class asked = all. */
  chemsFor(...want: string[]): SuggestChem[] | undefined {
    const all = this.chemAll();
    if (!all || !want.length) return this.chems;
    const w = new Set(want.map(c => c.trim().toLowerCase()));
    const hit = (c: ChemEntry): boolean => c.classes.some(x => w.has(x.toLowerCase()));
    const bare = (l: ChemEntry[]): SuggestChem[] => l.map(({ name, aliases }) => ({ name, aliases }));
    return this.ctx.kit.chemClassOnly === true ? bare(all.filter(hit)) : bare([...all.filter(hit), ...all.filter(c => !hit(c))]);
  }

  /** Wrap in [[ ]] when a note with that name exists, so MW() and links work. */
  link(name: unknown): string {
    const n = String(name).replace(/^\[\[|\]\]$/g, "").trim();
    return this.app.metadataCache.getFirstLinkpathDest(n, this.path) ? `[[${n}]]` : n;
  }

  /** A number from a property of the note called name (case and spacing ignored), or "" when there is no such note, property or number. */
  noteNumber(name: string, property: string): string {
    const note = this.app.metadataCache.getFirstLinkpathDest(plain(name), this.path);
    const fm = note ? fmOf(this.app, note) : {};
    const want = property.toLowerCase();
    const key = Object.keys(fm).find(k => k.trim().toLowerCase() === want);
    const n = key === undefined ? NaN : parseFloat(String(fm[key]).replace(",", "."));
    return isNaN(n) ? "" : String(n);
  }

  /** Table names must be unique within the note: nmr, nmr2, nmr3… */
  unique(base: string): string {
    const text = this.noteText;
    const exists = (n: string): boolean => this.taken.has(n) || new RegExp(`^\\s*(?:>\\s*)*name:\\s*${n}\\s*$`, "mi").test(text);
    let n = base, k = 2;
    while (exists(n)) n = `${base}${k++}`;
    this.taken.add(n);
    return n;
  }

  /** Tables called base, base2, base3… A base ending in "s" also matches the singular: samples → sample, sample2. */
  tablesNamed(base: string): ReturnType<typeof calcTables> {
    const rx = new RegExp(`^${base.replace(/s$/, "s?")}\\d*$`, "i");
    return calcTables(this.noteText).filter(t => rx.test(t.name));
  }

  /** Codes from the first column of the note's tables: the first name in the list that has any, taken from all of its numbered copies. */
  private codesFrom(names: string[]): string[] {
    for (const nm of names) {
      const codes = [...new Set(this.tablesNamed(nm).flatMap(t => t.rows.slice(1).map(r => r[0]).filter(Boolean)))];
      if (codes.length) return codes;
    }
    return [];
  }

  /** The "Sample codes" box and, when the note has several code tables, a "Codes from" choice. resolve(answers) = the codes to use. `fallback` = method table names to read when no table has a `codes:` option. */
  codeField(fallback: string[] = []): { fields: Partial<FormField>[]; resolve: (v: Record<string, unknown>) => string[] } {
    let src: CodeSource[] = codeSources(this.noteText);
    if (!src.length) { const c = this.codesFrom(fallback); if (c.length) src = [{ label: "This note", codes: c }]; }
    const parts = codeFormParts(src);
    const fields: Partial<FormField>[] = [{ key: "codes", label: "Sample codes", type: "textarea", hint: src.length > 1 ? "every table in this note that holds sample codes · pick one in Codes from, or edit here" : "from this note's sample table · edit if needed", value: parts.prefill }];
    if (src.length > 1) fields.push({ key: "codesFrom", label: "Codes from", type: "select", options: parts.options, value: "all" });
    const resolve = (v: Record<string, unknown>): string[] => list(resolveCodes(src, parts.prefill, str(v.codes), v.codesFrom ? str(v.codesFrom) : undefined));
    return { fields, resolve };
  }

  /** A method's tables in the note (nmr, nmr2…) with their sample counts and headers, for the results table to read. */
  techTables(base: string): { id: string; n: number; header: string[] }[] {
    return this.tablesNamed(base).map(t => ({ id: t.name, n: t.rows.length - 1, header: t.rows[0] ?? [] })).filter(t => t.n > 0);
  }

  /** Add method tags (NMR, GPC, DLS…) to the note's tags property, after the snippet is inserted. */
  tag(...tags: string[]): void {
    const file = this.ctx.file;
    if (!file || !tags.length || this.ctx.tags === false) return;
    window.setTimeout(() => { void this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      const cur: unknown[] = fm.tags == null ? [] : Array.isArray(fm.tags) ? fm.tags as unknown[] : str(fm.tags).split(/[,\s]+/);
      fm.tags = [...new Set([...cur.filter(Boolean), ...tags])];
    }).catch(() => { /* the note may be gone */ }); }, 800);
  }

  notice(message: string): void { new Notice(message); }
}
