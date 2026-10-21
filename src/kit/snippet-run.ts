// Alt+S for token templates: read a snippet note's header, ask its questions with the kit's form (labForm.js), fill the body.
// Insert snippet.md calls this through the plugin (`plugin.snippets`); plain snippets never come here. See docs/plans/snippet-token-templates.md.
import { Notice, TFile, TFolder, parseYaml, type App } from "obsidian";
import { text } from "../calc/engine";
import { prop, toList } from "../frontmatter";
import { classFilter, codeFormParts, codeSources, makeEnv, resolveCodes, type Chem } from "./snippet-env";
import { TemplateError, codesFromKey, answerOf, defaultAnswers, fillParts, formValue, fillTemplate, isCancelled, oldStub, parseTemplate, rigSnapshotFields, type ParsedTemplate, type TemplateField } from "./snippet-template";
import { saveSnapshot } from "../rig/snapshot-io";
import { readSnapshotMeta } from "../rig/snapshot";
import { noteEdits } from "./snippet-note";
import type { KitData } from "./paths";
import { hideShadowedStubs, pushRecent, visibleItems, type MenuItem } from "./snippet-menu";
import { openSnippetMenu, type MenuIcons } from "./snippet-menu-ui";
import type { FormField, FormFn } from "./snippet-form";
import { openSetup, reagentChoices, setupAnchor, SETUP_HINT, type SetupFn } from "../solution/setup";
import { DEFAULT_SETUP, solutionBlock } from "../solution/setup-text";
import { lookupMw } from "../blocks/raft/render";
import { openRaftSetup, type RaftSetupFn } from "../blocks/raft/setup";
import { DEFAULT_RAFT, raftBlock, workedFor } from "../blocks/raft/text";

/** What a snippet needs from Templater's `tp`: the note being written and the form. */
export interface SnippetTp {
  config?: { target_file?: { basename?: string } };
  file?: { title?: string };
  user: {
    labForm?: (tp: unknown, title: string, fields: FormField[], opts?: unknown) => Promise<Record<string, unknown> | null>;
    labSnippets?: (tp: unknown, key: string) => Promise<string>;
  };
}

/** Title, icon, description and group for the Alt+S menu. */
export interface SnippetMeta { title?: string; icon?: string; desc?: string; group?: string; /** An old-form stub file (`<%*` … `labSnippets(tp, "nmr")`): the key it runs. */ oldStub?: string }

/** The keys a header's `run:` may name. `solution` is the live ```solution block (N4: Solution prep IS the block, its own set-up window); the old volume tables run on as `solution-volume` (labSnippets.js `solution`). The rest are labSnippets.js keys. */
export const CALCULATORS = ["solution", "solution-volume", "recipe", "raft", "raft-table", "results", "nmr", "gpc", "dls"];

const plain = (name: string): string => name.replace(/^\[\[|\]\]$/g, "").split("|")[0].trim();

/** The folder settings a `suggest: notes` field may name in `folder:`, with the name the settings tab shows. */
const NOTE_FOLDERS: Record<string, string> = { rigsFolder: "Rigs folder", methodsFolder: "Methods folder", chemicalFolder: "Chemical folder", labFolder: "Lab notes folder" };

export class SnippetTemplates {
  /** `form` = the plugin's question window (main.ts); without it the answers come from Templater's labForm.js on `tp` (tests, old setups). */
  constructor(private app: App, private kit: () => KitData, private save: () => Promise<void> = async () => {}, private form?: FormFn, private setup: SetupFn = openSetup, private version: () => string = () => "", private raftSetup: RaftSetupFn = openRaftSetup) {}

  /** Right-click → Change icon… in the menu (set by the kit controller; without it the menu has no right-click). */
  icons: MenuIcons | null = null;

  /** The Alt+S menu (Insert snippet.md calls it in place of labPick.js): the picked entry's `value`, or null. Remembers the pick for Recent. */
  async menu(all: MenuItem[]): Promise<unknown> {
    const items = visibleItems(hideShadowedStubs(all), this.kit().snippetGroupsOff ?? []);
    const kit = this.kit();
    const names = new Set(items.map(it => it.name));
    const recent = (kit.snippetRecent ?? []).filter(n => names.has(n));
    const it = await openSnippetMenu(this.app, items, recent, this.icons);
    if (!it) return null;
    kit.snippetRecent = pushRecent(recent, it.name);
    await this.save();
    return it.value;
  }

  private async parse(file: TFile): Promise<ParsedTemplate | null> {
    return parseTemplate(await this.app.vault.cachedRead(file), parseYaml);
  }

  /** null = a plain snippet (inserted as it is). A token template with a bad header is still listed (empty meta); picking it shows the error. An old-form calculator stub counts as `run: <key>` with its own icon and description. */
  async meta(file: TFile): Promise<SnippetMeta | null> {
    try {
      const p = await this.parse(file);
      if (p) return { title: p.header.title, icon: p.header.icon, desc: p.header.desc, group: p.header.group };
      const stub = oldStub(await this.app.vault.cachedRead(file));
      return stub ? { icon: stub.icon, desc: stub.desc, oldStub: stub.run } : null;
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
    if (!parsed) {
      const text = await this.app.vault.cachedRead(file);
      const stub = oldStub(text);
      return stub ? await this.calculator(tp, file, undefined, stub.run) : text;
    }
    const { header, body } = parsed;
    if (header.run) return await this.calculator(tp, file, header.title, header.run);
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
      const picked = new Map<string, { file: TFile; text: string; fm: Record<string, unknown> | undefined }>();
      const snapshots = new Map<string, { link: string; date: string }>();
      const env = makeEnv(note, `${initials}${num}-`, (name, property) => {
        const n = this.app.metadataCache.getFirstLinkpathDest(plain(name), sourcePath);
        const v = n ? prop(this.app.metadataCache.getFileCache(n)?.frontmatter, property) : undefined;
        const x = v === undefined ? NaN : parseFloat(text(v).replace(",", "."));
        return isNaN(x) ? "" : String(x);
      }, {
        text: name => picked.get(name.toLowerCase())?.text ?? null,
        prop: (name, property) => toList(prop(picked.get(name.toLowerCase())?.fm, property)).join(", "),
        snapshot: name => snapshots.get(name.toLowerCase()) ?? null,
      });
      const defaults = defaultAnswers(header, env);
      const chems = header.fields.some(f => f.suggest === "chemicals") ? this.chemicals() : [];
      // suggest: codes: the box holds the note's sample codes and, with several tables, a "Codes from" choice follows it
      const sources = header.fields.some(f => f.suggest === "codes") ? codeSources(note) : [];
      const parts = codeFormParts(sources);
      const labForm = tp.user.labForm;
      if (!this.form && !labForm) throw new TemplateError("The form script labForm.js was not found. Run Check setup.");
      const ask: FormFn = this.form ?? ((t, f, o) => labForm!(tp, t, f, o));
      const title = header.title ?? file.basename.replace(/^\d+\s*[-.]?\s*/, "");
      const got = await ask(title, header.fields.flatMap(f => {
        const isCodes = f.suggest === "codes";
        const field = { key: f.key, label: f.label, hint: f.hint, placeholder: f.placeholder, type: f.type === "list" ? "text" : f.type, value: formValue(f, isCodes && parts.prefill ? parts.prefill : defaults[f.key]),
          ...(f.options ? { options: f.options } : {}),
          ...(f.mandatory ? { required: true } : {}),
          ...(f.suggest === "chemicals" ? { suggest: classFilter(chems, f.classes, kit.chemClassOnly) } : {}),
          ...(f.suggest === "notes" ? { suggest: listed.get(f.key)!.map(n => ({ name: n.basename, aliases: [] })) } : {}) };
        return isCodes && parts.options.length
          ? [field, { key: codesFromKey(f.key), label: "Codes from", type: "select", options: parts.options, value: "all" }] : [field];
      }));
      if (!got) return "";
      const answers: Record<string, string> = {};
      for (const f of header.fields) {
        const box = answerOf(f, got[f.key]);
        answers[f.key] = f.suggest === "codes" ? resolveCodes(sources, parts.prefill, box, text(got[codesFromKey(f.key)]) || undefined) : box;
      }
      if (isCancelled(header, answers)) return "";
      for (const [key, files] of listed) {
        const name = plain(answers[key]);
        if (!name) continue;
        const hit = files.find(n => n.basename.toLowerCase() === name.toLowerCase());
        if (!hit) throw new TemplateError(`No note called "${name}" in the ${NOTE_FOLDERS[header.fields.find(f => f.key === key)!.folder!]}.`);
        answers[key] = hit.basename;
        picked.set(hit.basename.toLowerCase(), { file: hit, text: await this.app.vault.cachedRead(hit), fm: this.app.metadataCache.getFileCache(hit)?.frontmatter });
      }
      // {{rig-snapshot:key}}: the snapshot is written (or the latest equal one reused) before filling in, once per rig
      for (const key of rigSnapshotFields([body, ...(header.set ?? []).map(p => p.value)])) {
        const rig = picked.get((answers[key] ?? "").toLowerCase());
        if (rig && !snapshots.has(rig.file.basename.toLowerCase())) {
          const snap = await this.rigSnapshot(rig.file, sourcePath);
          if (snap) snapshots.set(rig.file.basename.toLowerCase(), snap);
        }
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

  /** `run: <key>`: the calculator of that name in labSnippets.js asks its questions and builds the text, exactly as the stub files did. */
  private async calculator(tp: SnippetTp, file: TFile, title: string | undefined, key: string): Promise<string> {
    if (key === "solution") return await this.solutionBlock(tp, file, title);
    if (key === "raft") return await this.raftBlock();
    if (!CALCULATORS.includes(key)) {
      new Notice(`“${title ?? file.basename.replace(/^\d+\s*[-.]?\s*/, "")}”: Lab Kit has no calculator called “${key}”.`);
      return "";
    }
    if (!tp.user.labSnippets) {
      new Notice("Lab snippets need Templater → User script functions folder = the folder that holds labSnippets.js (or a folder above it)");
      return "";
    }
    return await tp.user.labSnippets(tp, key === "solution-volume" ? "solution" : key === "raft-table" ? "raft" : key);
  }

  /** `run: solution`: the set-up window at the cursor, then the live block (set-up filled in, actuals empty). "" when it was closed. */
  private async solutionBlock(tp: SnippetTp, file: TFile, title: string | undefined): Promise<string> {
    const kit = this.kit();
    const got = await this.setup(this.app, { values: DEFAULT_SETUP, choices: reagentChoices(this.app, kit.chemicalFolder, kit.mwProperty), anchor: setupAnchor(this.app, kit.snippetFormsAtCursor !== false), submit: "Insert", hint: SETUP_HINT.insert, methods: true });
    if (!got) return "";
    if (got.method === "volume") return await this.calculator(tp, file, title, "solution-volume");   // Method: by volume = the old volume form, as before
    const at = this.app.workspace.activeEditor?.editor?.getCursor("from");
    return (at && at.ch > 0 ? "\n" : "") + solutionBlock(got.lines);   // a fence starts on a line of its own
  }

  /** `run: raft` / `block: raft`: the set-up window at the cursor, then the live ```raft block (set-up filled in, `used:` empty, the worked-out `#` lines written). "" when it was closed.
   *  The old calc-table generator runs on as `run: raft-table`. */
  private async raftBlock(): Promise<string> {
    const kit = this.kit();
    const got = await this.raftSetup(this.app, { values: DEFAULT_RAFT, names: reagentChoices(this.app, kit.chemicalFolder, kit.mwProperty).map(c => c.name), anchor: setupAnchor(this.app, kit.snippetFormsAtCursor !== false), submit: "Insert", hint: SETUP_HINT.insert });
    if (!got) return "";
    const sourcePath = this.app.workspace.getActiveFile()?.path ?? "";
    const worked = workedFor(got.lines, n => lookupMw(this.app, kit.mwProperty, n, sourcePath).mw);
    const at = this.app.workspace.activeEditor?.editor?.getCursor("from");
    return (at && at.ch > 0 ? "\n" : "") + raftBlock(got.lines, worked);   // a fence starts on a line of its own
  }

  /** A snapshot of the rig for this lab note (a new file and history row, or the latest equal one): its link from the lab note and its date. null when the rig has no parts to draw. */
  private async rigSnapshot(rig: TFile, sourcePath: string): Promise<{ link: string; date: string } | null> {
    let saved;
    try { saved = await saveSnapshot(this.app, rig, this.version(), ""); } catch (e) { throw new TemplateError(`Could not save the snapshot of ${rig.basename}: ${e instanceof Error ? e.message : String(e)}`); }
    if (!saved) return null;
    if (saved.rowNote) new Notice(saved.rowNote, 10000);
    const read = readSnapshotMeta(await this.app.vault.cachedRead(saved.file));
    return { link: this.app.fileManager.generateMarkdownLink(saved.file, sourcePath), date: read.status === "ok" ? read.meta.date : "" };
  }

  private fail(file: TFile, e: unknown): string {
    if (!(e instanceof TemplateError)) throw e;
    new Notice(`${file.basename}: ${e.message}`);
    return "";
  }
}
