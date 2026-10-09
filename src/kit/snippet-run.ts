// Alt+S for token templates: read a snippet note's header, ask its questions with the kit's form (labForm.js), fill the body.
// Insert snippet.md calls this through the plugin (`plugin.snippets`); plain snippets never come here. See docs/plans/snippet-token-templates.md.
import { Notice, TFile, TFolder, parseYaml, type App } from "obsidian";
import { text } from "../calc/engine";
import { prop, toList } from "../frontmatter";
import { classFilter, makeEnv, type Chem } from "./snippet-env";
import { TemplateError, defaultAnswers, fillTemplate, isCancelled, parseTemplate, type ParsedTemplate } from "./snippet-template";
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

  /** Ask the template's questions and return the text to insert; "" when cancelled, when a required list is empty, or on an error (a Notice says which). */
  async run(tp: SnippetTp, file: TFile): Promise<string> {
    let parsed: ParsedTemplate | null;
    try { parsed = await this.parse(file); } catch (e) { return this.fail(file, e); }
    if (!parsed) return await this.app.vault.cachedRead(file);
    const { header, body } = parsed;
    const kit = this.kit();
    try {
      const target = tp.config?.target_file;
      const note = this.app.workspace.activeEditor?.editor?.getValue() ?? "";
      const initials = kit.initials.trim() || "XX";
      const num = (target?.basename ?? tp.file?.title ?? "").match(/^[A-Za-z]*(\d+)/)?.[1] ?? "XXXX";
      if (!kit.initials.trim() && /\{\{\s*(?:#\w+\s+\S+\s+)?(?:prefix|code)\b/.test(body)) new Notice("Set your initials in Settings → Lab Kit → Initials. Using XX for now.");
      const sourcePath = this.app.workspace.getActiveFile()?.path ?? "";
      const env = makeEnv(note, `${initials}${num}-`, (name, property) => {
        const n = this.app.metadataCache.getFirstLinkpathDest(plain(name), sourcePath);
        const v = n ? prop(this.app.metadataCache.getFileCache(n)?.frontmatter, property) : undefined;
        const x = v === undefined ? NaN : parseFloat(text(v).replace(",", "."));
        return isNaN(x) ? "" : String(x);
      });
      const defaults = defaultAnswers(header, env);
      const chems = header.fields.some(f => f.suggest) ? this.chemicals() : [];
      if (!tp.user.labForm) throw new TemplateError("The form script labForm.js was not found. Run Check setup.");
      const title = header.title ?? file.basename.replace(/^\d+\s*[-.]?\s*/, "");
      const got = await tp.user.labForm(tp, title, header.fields.map(f => ({
        key: f.key, label: f.label, hint: f.hint, placeholder: f.placeholder, type: f.type, value: defaults[f.key],
        ...(f.suggest ? { suggest: classFilter(chems, f.classes, kit.chemClassOnly) } : {}),
      })));
      if (!got) return "";
      const answers: Record<string, string> = {};
      for (const f of header.fields) answers[f.key] = text(got[f.key]).trim();
      if (isCancelled(header, answers)) return "";
      return fillTemplate(body, answers, env);
    } catch (e) { return this.fail(file, e); }
  }

  private fail(file: TFile, e: unknown): string {
    if (!(e instanceof TemplateError)) throw e;
    new Notice(`${file.basename}: ${e.message}`);
    return "";
  }
}
