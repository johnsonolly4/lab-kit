// Alt+S for token templates: read a snippet note's header, ask its questions with the kit's form (labForm.js), fill the body.
// Insert snippet.md calls this through the plugin (`plugin.snippets`); plain snippets never come here. See docs/plans/snippet-token-templates.md.
import { Notice, TFile, TFolder, parseYaml, type App } from "obsidian";
import { text } from "../calc/engine";
import { prop, toList } from "../frontmatter";
import { classFilter, codeFormParts, codeSources, makeEnv, resolveCodes, type Chem } from "./snippet-env";
import { TemplateError, codesFromKey, defaultAnswers, fillParts, fillTemplate, isCancelled, parseTemplate, type ParsedTemplate, type TemplateField } from "./snippet-template";
import { noteEdits } from "./snippet-note";
import type { KitData } from "./paths";

/** What a snippet needs from Templater's `tp`: the note being written and the form. */
export interface SnippetTp {
  config?: { target_file?: { basename?: string } };
  file?: { title?: string };
  user: { labForm?: (tp: unknown, title: string, fields: FormField[], opts?: unknown) => Promise<Record<string, unknown> | null> };
}
interface FormField { key: string; label: string; hint?: string; placeholder?: string; type: string; value: string; suggest?: { name: string; aliases: string[] }[] }

/** Title, icon and description for the Alt+S menu. */
export interface SnippetMeta { title?: string; icon?: string; desc?: string }

const plain = (name: string): string => name.replace(/^\[\[|\]\]$/g, "").split("|")[0].trim();

/** The folder settings a `suggest: notes` field may name in `folder:`, with the name the settings tab shows. */
const NOTE_FOLDERS: Record<string, string> = { rigsFolder: "Rigs folder", methodsFolder: "Methods folder", chemicalFolder: "Chemical folder", labFolder: "Lab notes folder" };

export class SnippetTemplates {
  constructor(private app: App, private kit: () => KitData) {}

  private async parse(file: TFile): Promise<ParsedTemplate | null> {
    return parseTemplate(await this.app.vault.cachedRead(file), parseYaml);
  }

  /** null = a plain snippet (inserted as it is). A token template with a bad header is still listed (empty meta); picking it shows the error. */
  async meta(file: TFile): Promise<SnippetMeta | null> {
    try {
      const p = await this.parse(file);
      return p ? { title: p.header.title, icon: p.header.icon, desc: p.header.desc } : null;
    } catch (e) {
      if (e instanceof TemplateError) return {};
      throw e;
    }
  }

  /** The chemical notes as the forms list them (empty without a Chemical folder). */
  private chemicals(): Chem[] {
    const path = this.kit().chemicalFolder.trim().replace(/^\/+|\/+$/g, "");
    const root = path ? this.app.vault.getFolderByPath(path) : null;
    if (!root) return [];
    const out: Chem[] = [];
    const walk = (folder: TFolder) => {
      for (const c of folder.children) {
        if (c instanceof TFolder) walk(c);
        else if (c instanceof TFile && c.extension === "md") {
          const fm = this.app.metadataCache.getFileCache(c)?.frontmatter;
          const aliases = toList(prop(fm, "names")).map(a => a.trim()).filter(a => a && a.toLowerCase() !== c.basename.toLowerCase());
          out.push({ name: c.basename, aliases, classes: toList(prop(fm, "Chemical class")) });
        }
      }
    };
    walk(root);
    return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  }

  /** The notes a `suggest: notes` field lists: every note in its settings folder and below, by name. */
  private notesFor(f: TemplateField): TFile[] {
    const key = f.folder ?? "";
    if (!(key in NOTE_FOLDERS)) throw new TemplateError(`Field "${f.key}": "${key}" is not a folder setting (use ${Object.keys(NOTE_FOLDERS).join(", ")}).`);
    const setting = (this.kit() as unknown as Record<string, unknown>)[key];
    const path = (typeof setting === "string" ? setting : "").trim().replace(/^\/+|\/+$/g, "");
    if (!path) throw new TemplateError(`Set the ${NOTE_FOLDERS[key]} in Settings → Lab Kit first.`);
    const root = this.app.vault.getFolderByPath(path);
    const out: TFile[] = [];
    const walk = (folder: TFolder) => {
      for (const c of folder.children) {
        if (c instanceof TFolder) walk(c);
        else if (c instanceof TFile && c.extension === "md") out.push(c);
      }
    };
    if (root) walk(root);
    if (!out.length) throw new TemplateError(`There are no notes in the ${NOTE_FOLDERS[key]} (${path}) yet.`);
    return out.sort((a, b) => a.basename.localeCompare(b.basename, undefined, { numeric: true, sensitivity: "base" }));
  }

  /** Ask the template's questions and return the text to insert; "" when cancelled, when a required list is empty, or on an error (a Notice says which). */
  async run(tp: SnippetTp, file: TFile): Promise<string> {
    let parsed: ParsedTemplate | null;
    try { parsed = await this.parse(file); } catch (e) { return this.fail(file, e); }
    if (!parsed) return await this.app.vault.cachedRead(file);
    const { header, body } = parsed;
    const kit = this.kit();
    try {
      const target = tp.config?.target_file;
      const editor = this.app.workspace.activeEditor?.editor;
      const note = editor?.getValue() ?? "";
      const initials = kit.initials.trim() || "XX";
      const num = (target?.basename ?? tp.file?.title ?? "").match(/^[A-Za-z]*(\d+)/)?.[1] ?? "XXXX";
      if (!kit.initials.trim() && /\{\{\s*(?:#\w+\s+\S+\s+)?(?:prefix|code)\b/.test(body)) new Notice("Set your initials in Settings → Lab Kit → Initials. Using XX for now.");
      const sourcePath = this.app.workspace.getActiveFile()?.path ?? "";
      // suggest: notes: the notes of each such field's folder, and the ones picked (read once the form is answered)
      const listed = new Map(header.fields.filter(f => f.suggest === "notes").map(f => [f.key, this.notesFor(f)]));
      const picked = new Map<string, { text: string; fm: Record<string, unknown> | undefined }>();
      const env = makeEnv(note, `${initials}${num}-`, (name, property) => {
        const n = this.app.metadataCache.getFirstLinkpathDest(plain(name), sourcePath);
        const v = n ? prop(this.app.metadataCache.getFileCache(n)?.frontmatter, property) : undefined;
        const x = v === undefined ? NaN : parseFloat(text(v).replace(",", "."));
        return isNaN(x) ? "" : String(x);
      }, {
        text: name => picked.get(name.toLowerCase())?.text ?? null,
        prop: (name, property) => toList(prop(picked.get(name.toLowerCase())?.fm, property)).join(", "),
      });
      const defaults = defaultAnswers(header, env);
      const chems = header.fields.some(f => f.suggest === "chemicals") ? this.chemicals() : [];
      // suggest: codes: the box holds the note's sample codes and, with several tables, a "Codes from" choice follows it
      const sources = header.fields.some(f => f.suggest === "codes") ? codeSources(note) : [];
      const parts = codeFormParts(sources);
      if (!tp.user.labForm) throw new TemplateError("The form script labForm.js was not found. Run Check setup.");
      const title = header.title ?? file.basename.replace(/^\d+\s*[-.]?\s*/, "");
      const got = await tp.user.labForm(tp, title, header.fields.flatMap(f => {
        const isCodes = f.suggest === "codes";
        const field = { key: f.key, label: f.label, hint: f.hint, placeholder: f.placeholder, type: f.type, value: isCodes && parts.prefill ? parts.prefill : defaults[f.key],
          ...(f.suggest === "chemicals" ? { suggest: classFilter(chems, f.classes, kit.chemClassOnly) } : {}),
          ...(f.suggest === "notes" ? { suggest: listed.get(f.key)!.map(n => ({ name: n.basename, aliases: [] })) } : {}) };
        return isCodes && parts.options.length
          ? [field, { key: codesFromKey(f.key), label: "Codes from", type: "select", options: parts.options, value: "all" }] : [field];
      }));
      if (!got) return "";
      const answers: Record<string, string> = {};
      for (const f of header.fields) {
        const box = text(got[f.key]).trim();
        answers[f.key] = f.suggest === "codes" ? resolveCodes(sources, parts.prefill, box, text(got[codesFromKey(f.key)]) || undefined) : box;
      }
      if (isCancelled(header, answers)) return "";
      for (const [key, files] of listed) {
        const name = plain(answers[key]);
        if (!name) continue;
        const hit = files.find(n => n.basename.toLowerCase() === name.toLowerCase());
        if (!hit) throw new TemplateError(`No note called "${name}" in the ${NOTE_FOLDERS[header.fields.find(f => f.key === key)!.folder!]}.`);
        answers[key] = hit.basename;
        picked.set(hit.basename.toLowerCase(), { text: await this.app.vault.cachedRead(hit), fm: this.app.metadataCache.getFileCache(hit)?.frontmatter });
      }
      const out = fillParts(body, answers, env);
      const props = (header.set ?? []).map(p => ({ name: p.name, value: fillTemplate(p.value, answers, env).trim() })).filter(p => p.value);
      // Properties and {{#append}} parts go in through the editor, bottom of the note first: the cursor stays where the text is inserted
      const edits = noteEdits(note, props, out.appends);
      if (edits.length && !editor) throw new TemplateError("Open the note in the editor first: this snippet also writes outside the cursor.");
      for (const e of edits) editor!.replaceRange(e.text, editor!.offsetToPos(e.from), editor!.offsetToPos(e.to));
      return out.text;
    } catch (e) { return this.fail(file, e); }
  }

  private fail(file: TFile, e: unknown): string {
    if (!(e instanceof TemplateError)) throw e;
    new Notice(`${file.basename}: ${e.message}`);
    return "";
  }
}
