// Built-in kit: the glue between the plugin and src/kit/managed.ts, plus the review window, the report and the first-install question.
// Works on mobile: only the vault adapter and crypto.subtle.
import { Modal, Notice, Setting, parseYaml, type App, type Plugin } from "obsidian";
import {
  SAFE_ACTIONS, applyManaged, disableManaged, firstInstallOptions, forgetManaged, inFolders, kitSha1, patchFolders, patchManagedFolders, planFolderReapply, previewInstall, relocateRole, templaterScriptsAction, templaterScriptsNeedChange, templaterTemplatesTarget, planManaged, planRetired, offIds, resolveManaged, restoreManaged, setDetached, sortByAttention, statusOf, actionLook, trackedRoles,
  kitBackupPath, type ApplyOptions, type EmbeddedKit, type InstallPreview, type LegacyRecord, type ManagedAction, type ManagedFileState, type ManagedItem, type ManagedResult, type RetiredItem
} from "./managed";
import { KitMergeModal } from "./merge-ui";
import { addTemplaterHotkey, withoutTemplaterTrigger, cssSnippetsSupported, hasTemplater, hasTemplaterHotkey, isCssSnippetEnabled, loadedPlugins, setCssSnippets, setTemplaterTemplatesFolder, setTemplaterUserScripts, templaterTemplatesFolder, templaterUserScriptsFolder } from "./obsidian-private";
import { ensureFolder } from "./ensure-folder";
import { makeMyCopy } from "./snippet-copy-ui";
import { canCopy, isStubSnippet, isTokenTemplate, snippetKey } from "./snippet-copy";
import { LAB_KIT, PLANNING_KIT, kitCompare, kitDetectRoles, kitFolderRoles, kitInBackup, kitJoin, kitSlot, labFolders, planningFolders, planningRoles, type KitFolder, type KitData, type KitRecord, type KitSlot, type Roles } from "./paths";

/** Id of the Alt+S menu template in kit-manifest.json. */
const MENU_ID = "tpl-insert-snippet-md";

/** Names of the settings a kit file can need (`needs` in kit-manifest.json), as the settings tab shows them. */
const NEEDS_NAME: Record<string, string> = { chemicalFolder: "Chemical folder", labFolder: "Lab notes folder" };

export interface ManagedHost { kit: KitData; save(): Promise<void>; /** Called after a kit's files were written (e.g. to start the planning commands without a reload). */ installed?(): void }

export class KitManaged {
  constructor(private plugin: Plugin, private host: ManagedHost, readonly bundle: EmbeddedKit) {}

  get app(): App { return this.plugin.app; }
  get version(): string { return this.bundle.manifest.kitVersion; }
  /** This kit's saved state (installed files, folders, files switched off). */
  get slot(): KitSlot { return kitSlot(this.host.kit, this.bundle.manifest.id); }
  stateOf(id: string): ManagedFileState | undefined { return this.slot.managed?.files[id]; }
  get installedVersion(): string | null { return this.slot.managed?.installedKitVersion ?? null; }
  updateAvailable(): boolean { const i = this.installedVersion; return i !== null && kitCompare(this.version, i) > 0; }

  /** Folders: detected from your vault and Templater, then your own entries from settings on top. */
  roles(): Roles {
    const slot = this.slot;
    const own: Roles = Object.fromEntries(Object.entries(slot.paths).filter(([, v]) => v && !kitInBackup(v)));
    const old = this.oldRecord();
    const record: KitRecord = { version: old?.version ?? "0", files: old?.files ?? {}, installedAt: old?.installedAt ?? "", roles: { ...(old?.roles ?? {}), ...own } };
    const tracked = trackedRoles(this.bundle, slot.managed);
    // Planning note folders: Settings → Planning folders win over a per-kit override (kitLoad copied an old override into the setting once)
    if (this.bundle.manifest.id === PLANNING_KIT) {
      const pf = this.host.kit.planningFolders;
      const ownOther = Object.fromEntries(Object.entries(own).filter(([k]) => !(k in pf)));
      return { ...planningRoles(this.app, tracked, pf, this.host.kit.labFolder), ...ownOther };
    }
    // Lab notes / chemical folders from the Lab notebook settings; a .base already installed stays where it is
    return { ...kitFolderRoles(this.host.kit), ...tracked, ...kitDetectRoles(this.app, record, tracked), ...own };
  }

  /** Where the templates (Insert snippet.md, Snippets/) are: the Alt+S menu scans the Snippets folder next to it. */
  templatesFolder(): string { return this.roles().templates; }

  isOff(id: string): boolean { return this.offIds().has(id); }
  /** Switched off by you, or waiting for a folder setting (`needs`) that is empty. */
  private offIds(): Set<string> { return offIds(this.bundle, this.slot.off, this.host.kit, loadedPlugins(this.app)); }

  private baseDir(): string { return kitJoin(this.app.vault.configDir, "plugins", this.plugin.manifest.id, "kit-base"); }

  /** The old folder updater's install record (it only ever installed the lab kit). */
  private oldRecord(): KitRecord | null { return this.bundle.manifest.id === LAB_KIT ? this.host.kit.installed : null; }

  /** Files the old folder updater wrote, so they aren't mistaken for your edits. */
  private legacy(): LegacyRecord | null {
    const old = this.oldRecord();
    return old ? { files: old.files, hash: kitSha1 } : null;
  }

  /** Writes kit files while Templater's "Trigger on new file creation" leaves them alone: a template must land as text, not be run. */
  private quietly<T>(items: ManagedItem[], opts: ApplyOptions, write: (opts: ApplyOptions) => Promise<T>): Promise<T> {
    const paths = items.flatMap(i => [i.dest, kitBackupPath(opts, i.dest)]);   // backup copies are new notes too
    return withoutTemplaterTrigger(this.app, paths, () => write(opts));
  }

  plan(): Promise<ManagedItem[]> {
    return planManaged(this.app.vault.adapter, this.bundle, this.slot.managed, this.roles(), this.legacy(), this.baseDir(), this.offIds());
  }

  private applyOptions(extra: Partial<ApplyOptions> = {}): ApplyOptions {
    return { baseDir: this.baseDir(), backups: this.roles().backups, stamp: new Date().toISOString(), debug: this.host.kit.debug, ...extra };
  }

  async apply(items: ManagedItem[], select: (it: ManagedItem) => boolean): Promise<ManagedResult[]> {
    const kit = this.slot;
    const out = await this.quietly(items, this.applyOptions({ select }), o => applyManaged(this.app.vault.adapter, this.bundle, items, kit.managed, o));
    kit.managed = out.state;
    await this.host.save();
    this.host.installed?.();
    return out.results;
  }

  /**
   * Lists everything a write would touch (files created or updated, files left alone because they exist, folders, settings) and carries it
   * out only after the user confirms; Cancel writes nothing. Asks on a kit's first install (`ask`), when a folder would be created, or when
   * a setting would change; otherwise runs straight away. Resolves once it ran or was cancelled.
   */
  confirmThen(o: { title: string; yes: string; items: ManagedItem[]; select: (it: ManagedItem) => boolean; settings?: SettingChange[]; notes?: PreviewNote[]; folders?: KitFolder[]; ask?: boolean; run: () => Promise<void> }): Promise<void> {
    return new Promise<void>(resolve => {
      const settings = o.settings ?? [];
      let extra: string[] = [];
      const go = async (chosen: SettingChange[]): Promise<void> => {
        try {
          for (const path of extra) await ensureFolder(this.app.vault, path);   // the layout's empty folders (files make their own)
          await o.run();
          for (const c of chosen) await c.apply();
        } catch (e) { this.failed(e); }
        resolve();
      };
      void previewInstall(this.app.vault.adapter, o.items, o.select, o.folders).then(preview => {
        extra = (o.folders ?? []).map(f => f.path).filter(p => preview.folders.includes(p));
        if (!o.ask && !preview.folders.length && !settings.length) return go([]);
        new KitInstallModal(this.app, o.title, o.yes, preview, settings, o.notes ?? [], go, resolve).open();
      }, e => { this.failed(e); resolve(); });
    });
  }

  /** Folders this kit makes empty at its first install so the layout is complete (the planning kit's folder contract; the lab kit's note folders). */
  kitFolders(): KitFolder[] {
    return this.bundle.manifest.id === PLANNING_KIT ? planningFolders(this.roles(), loadedPlugins(this.app).has("zotlit")) : labFolders(this.host.kit);
  }

  /** Settings a kit's first install offers to change: its CSS snippet, and Templater's user scripts folder when Templater has none. */
  private firstInstallSettings(): SettingChange[] {
    const opts = firstInstallOptions(this.bundle, { installed: hasTemplater(this.app), folder: templaterUserScriptsFolder(this.app) }, this.roles().userScripts);
    const out: SettingChange[] = [];
    const css = opts.css, folder = opts.templaterFolder;
    if (css) out.push({ name: "Turn on the CSS snippet", desc: css.enable.join(", "), apply: () => setCssSnippets(this.app, css.enable, css.disable) });
    // The folder above the kit's own subfolder (templaterScriptsTarget), so it covers lab-kit/ and vault/ alike
    if (folder) out.push({ name: "Set Templater's user scripts folder", desc: `To ${folder}. Templater has none yet; the kit's templates need it.`, apply: () => setTemplaterUserScripts(this.app, folder) });
    return out;
  }

  /** The Alt+S menu template goes into Templater's Template hotkeys when it is written and isn't listed there yet (nothing is ever removed). */
  private hotkeySetting(items: ManagedItem[], select: (it: ManagedItem) => boolean): SettingChange[] {
    const menu = items.find(i => i.file.id === MENU_ID && select(i));
    if (!menu || !hasTemplater(this.app) || hasTemplaterHotkey(this.app, menu.dest)) return [];
    return [{ name: "Add Insert snippet to Templater's Template hotkeys", desc: `${menu.dest}. Then set Alt+S for it in Obsidian → Hotkeys.`,
      apply: async () => { await addTemplaterHotkey(this.app, menu.dest); } }];
  }

  /** Once nothing is left to create or update, the whole kit counts as installed (a single-file action doesn't bump the version). */
  private async settleVersion(): Promise<void> {
    const m = this.slot.managed;
    if (!m) return;
    const left = (await this.plan()).some(i => i.action === "create" || i.action === "fast-forward");
    if (!left) m.installedKitVersion = this.version;
  }

  /**
   * A folder setting changed: writes the new folder names into installed kit files you have not edited (each backed up first).
   * Returns what was rewritten and which edited files were left on the old folders. A .base among those (edited, or re-saved by Obsidian
   * with its keys in another order) is listed in `patchable` when only its folder filter needs changing; `patch()` does that after a backup.
   */
  async reapplyFolders(): Promise<{ rewritten: string[]; kept: string[]; skipped: string[]; patchable: string[]; patch: () => Promise<void> }> {
    const kit = this.slot;
    const none = { rewritten: [], kept: [], skipped: [], patchable: [], patch: async () => {} };
    if (!kit.managed) return none;
    const items = await this.plan();
    const { rewrite, kept, skipped } = await planFolderReapply(this.app.vault.adapter, items, kit.managed, this.baseDir());
    if (rewrite.length) {
      const out = await this.quietly(rewrite, this.applyOptions({ keepVersion: true, select: () => true }), o => applyManaged(this.app.vault.adapter, this.bundle, rewrite, kit.managed, o));
      kit.managed = out.state;
      await this.host.save();
    }
    // A .base whose filters already show the new folders needs nothing; one that only differs there can be patched
    const patches: { item: ManagedItem; text: string }[] = [], rest = { kept: [] as ManagedItem[], skipped: [] as ManagedItem[] };
    for (const [list, into] of [[kept, rest.kept], [skipped, rest.skipped]] as const) {
      for (const it of list) {
        if (!it.dest.endsWith(".base")) { into.push(it); continue; }
        const cur = await this.app.vault.adapter.read(it.dest);
        const text = patchFolders(cur, it.text);
        if (text !== null) patches.push({ item: it, text });
        else if (inFolders(cur).join("\n") !== inFolders(it.text).join("\n")) into.push(it);
      }
    }
    const patch = async (): Promise<void> => {
      await this.quietly(patches.map(p => p.item), this.applyOptions(), o => patchManagedFolders(this.app.vault.adapter, patches, o));
    };
    return { rewritten: rewrite.map(i => i.dest), kept: rest.kept.map(i => i.dest), skipped: rest.skipped.map(i => i.dest), patchable: patches.map(p => p.item.dest), patch };
  }

  /** Install / update / recreate / merge ONE file (asks first when it needs a new folder or a settings change). */
  async updateOne(id: string): Promise<ManagedResult[]> {
    const kit = this.slot;
    const items = await this.plan();
    const go = (it: ManagedItem): boolean => it.file.id === id && (it.action === "create" || it.action === "fast-forward" || it.action === "missing" || it.action === "merge");
    let results: ManagedResult[] = [];
    const item = items.find(go);
    await this.confirmThen({ title: `Install ${item?.dest ?? id}?`, yes: "Install", items, select: go, settings: this.hotkeySetting(items, go), run: async () => {
      const out = await this.quietly(items, this.applyOptions({ select: go, keepVersion: true }), o => applyManaged(this.app.vault.adapter, this.bundle, items, kit.managed, o));
      kit.managed = out.state;
      await this.settleVersion();
      await this.host.save();
      results = out.results.filter(r => r.id === id);
    } });
    return results;
  }

  /**
   * Use ON: the file is installed again. Use OFF: your copy is backed up, then moved to the trash, and the kit stops installing it.
   * `done` runs afterwards, also when the user cancels, so the window can redraw.
   */
  async setUse(id: string, on: boolean, done: () => void): Promise<void> {
    const kit = this.slot;
    if (on) {
      // A file that goes next to a folder from the Lab notebook settings waits until that folder is set
      const needs = this.bundle.manifest.files.find(f => f.id === id)?.needs;
      if (needs && offIds(this.bundle, {}, this.host.kit).has(id)) {
        new Notice(`Set the ${NEEDS_NAME[needs] ?? needs} in Lab Kit settings first.`);
        done();
        return;
      }
      delete kit.off[id];
      await this.host.save();
      try { await this.updateOne(id); } catch (e) { this.failed(e); }
      done();
      return;
    }
    const item = (await this.plan()).find(i => i.file.id === id);
    if (!item) { done(); return; }
    const adapter = this.app.vault.adapter;
    const apply = async (): Promise<void> => {
      const remove = async (path: string): Promise<void> => {
        const f = this.app.vault.getFileByPath(path);
        if (f) await this.app.fileManager.trashFile(f); else await adapter.remove(path);
      };
      const out = await disableManaged(adapter, item, kit.managed, this.applyOptions(), remove);
      kit.managed = out.state;
      kit.off[id] = true;
      await this.settleVersion();
      await this.host.save();
      if (out.backup) new Notice(`Switched off ${item.dest}. A copy is in ${out.backup}`, 8000);
    };
    const go = async (): Promise<void> => { try { await apply(); } catch (e) { this.failed(e); } done(); };
    if (!(await adapter.exists(item.dest))) { await go(); return; }
    new ConfirmModal(this.app, `Remove ${item.dest.split("/").pop() ?? item.dest}?`,
      "It leaves the Alt+S menu. A copy goes to the backup folder first and the file moves to your trash. Switch it on again to get it back.", "Remove", go, done).open();
  }

  /** Put the kit's copy of ONE file back (your copy is backed up first). */
  async restoreOne(id: string): Promise<ManagedResult | null> {
    const kit = this.slot;
    const item = (await this.plan()).find(i => i.file.id === id);
    if (!item) return null;
    const out = await this.quietly([item], this.applyOptions(), o => restoreManaged(this.app.vault.adapter, item, kit.managed, o));
    kit.managed = out.state;
    await this.settleVersion();
    await this.host.save();
    return out.result;
  }

  /** Settles ONE conflict: write `text` (after a backup), or keep your file when `text` is null. Throws after telling the user, so the merge window stays open. */
  async resolveOne(id: string, text: string | null): Promise<void> {
    try {
      const kit = this.slot;
      const item = (await this.plan()).find(i => i.file.id === id);
      if (!item) throw new Error("kit file not found");
      const out = await this.quietly([item], this.applyOptions(), o => resolveManaged(this.app.vault.adapter, item, text, kit.managed, o));
      kit.managed = out.state;
      await this.settleVersion();
      await this.host.save();
      const r = out.result;
      if (r.outcome === "skipped") new Notice(`${item.dest} is no longer in conflict, nothing changed.`);
      else new Notice(r.backup ? `Merged ${item.dest}. Your old copy: ${r.backup}` : `Kept your ${item.dest}.`, 8000);
    } catch (e) { this.failed(e); throw e; }
  }

  /** Opens the merge window for ONE conflict; `onDone` runs when it closes (the caller redraws). */
  async resolve(id: string, onDone: () => void): Promise<void> {
    try {
      const item = (await this.plan()).find(i => i.file.id === id);
      if (!item || item.action !== "needs-merge") { new Notice("This file isn't in conflict."); onDone(); return; }
      const adapter = this.app.vault.adapter;
      const baseFile = kitJoin(this.baseDir(), `${id}.txt`);
      const base = item.conflicts !== undefined && await adapter.exists(baseFile) ? await adapter.read(baseFile) : null;
      const modal = new KitMergeModal(this.app,
        { dest: item.dest, isScript: item.file.kind === "script", base, ours: await adapter.read(item.dest), theirs: item.text },
        {
          apply: text => this.resolveOne(id, text),
          takeKit: () => new ConfirmModal(this.app, "Restore the kit's copy?", `${item.dest} goes back to the kit's version. Your copy is saved in the backup folder first.`, "Restore", async () => {
            try { await this.restoreOne(id); modal.close(); } catch (e) { this.failed(e); }
          }).open(),
          done: onDone
        });
      modal.open();
    } catch (e) { this.failed(e); onDone(); }
  }

  /** Files you have installed that the kit no longer ships (left in place). */
  retired(): Promise<RetiredItem[]> { return planRetired(this.app.vault.adapter, this.bundle, this.slot.managed); }

  /** Stops tracking a retired file; your copy stays in the vault. */
  async forget(id: string): Promise<void> {
    const kit = this.slot;
    kit.managed = await forgetManaged(this.app.vault.adapter, kit.managed, id, this.baseDir());
    await this.host.save();
  }

  async detach(id: string, on: boolean): Promise<boolean> {
    const ok = setDetached(this.slot.managed, id, on);
    if (ok) await this.host.save();
    return ok;
  }

  /** "Update all safe files": new files and unmodified files only. Asks first on the kit's first install, and before any new folder or settings change. */
  async updateSafe(): Promise<void> {
    try {
      const items = await this.plan();
      const select = (it: ManagedItem): boolean => SAFE_ACTIONS.includes(it.action);
      const writes = items.filter(i => i.action === "create" || i.action === "fast-forward").length;
      const first = !this.slot.managed && writes > 0;
      await this.confirmThen({
        title: first ? `Create ${writes} kit files?` : writes ? `Update ${writes} kit files?` : "Change these settings?", yes: first ? `Create ${writes} files` : "Update", ask: first,
        items, select, settings: [...(first ? this.firstInstallSettings() : []), ...this.hotkeySetting(items, select)], folders: first ? this.kitFolders() : [],
        run: async () => { new KitReportModal(this.app, await this.apply(items, select)).open(); },
      });
    } catch (e) { this.failed(e); }
  }

  /** Called by the review window's Apply: the same confirmation as "Update all safe files", for the files ticked there. */
  async applyReviewed(items: ManagedItem[], select: (it: ManagedItem) => boolean, report: (results: ManagedResult[]) => void): Promise<void> {
    const first = !this.slot.managed;
    await this.confirmThen({
      title: first ? "Install the kit?" : "Apply these changes?", yes: "Apply", ask: first,
      items, select, settings: [...(first ? this.firstInstallSettings() : []), ...this.hotkeySetting(items, select)], folders: first ? this.kitFolders() : [],
      run: async () => report(await this.apply(items, select)),
    });
  }

  /**
   * The "Set up Templater" button. Lists every change first and makes them only when confirmed: Templater's user scripts folder (only when
   * it has none; a folder that is set is never changed, issue #34: when the kit's scripts are outside it, fresh copies go into a lab-kit folder
   * inside it and the old copies stay), its template folder (only when empty), and Insert snippet in its Template hotkeys.
   */
  async setupTemplater(): Promise<void> {
    if (!hasTemplater(this.app)) { new Notice("Templater isn't installed or turned on. Install and enable it first."); return; }
    try {
      const roles = this.roles();
      const menu = kitJoin(roles.templates, "Insert snippet.md");
      if (!this.app.vault.getFileByPath(menu)) { new Notice("The kit isn't installed yet. Install it first."); return; }
      const done: string[] = [];
      const settings: SettingChange[] = [];
      const current = kitInBackup(templaterUserScriptsFolder(this.app) ?? "") ? "" : templaterUserScriptsFolder(this.app);   // a folder inside a backup is a leftover mistake
      const scripts = templaterScriptsAction(current, roles.userScripts);
      if (scripts.kind === "set") settings.push({ name: "Set Templater's user scripts folder", desc: `To ${scripts.folder}. Templater has none yet; the snippet forms need it.`,
        apply: async () => { await setTemplaterUserScripts(this.app, scripts.folder); done.push(`User scripts folder set to ${scripts.folder}.`); } });
      // The template folder is only filled in when Templater has none; one that is set is never changed
      const tplFolder = kitInBackup(templaterTemplatesFolder(this.app) ?? "") ? "" : templaterTemplatesFolder(this.app)?.trim();
      const target = templaterTemplatesTarget(roles.templates);
      if (!tplFolder && target) settings.push({ name: "Set Templater's template folder", desc: `To ${target}. Templater has none yet.`,
        apply: async () => { await setTemplaterTemplatesFolder(this.app, target); done.push(`Template folder set to ${target}.`); } });
      else if (tplFolder && templaterScriptsNeedChange(tplFolder, roles.templates)) done.push(`Template folder left as ${tplFolder} (the kit's templates are in ${roles.templates}).`);
      if (!hasTemplaterHotkey(this.app, menu)) settings.push({ name: "Add Insert snippet to Templater's Template hotkeys", desc: menu,
        apply: async () => { if (await addTemplaterHotkey(this.app, menu)) done.push("Insert snippet added to Template hotkeys."); } });

      // The kit's scripts are outside the folder Templater reads (an older install): fresh copies into <folder>/lab-kit, tracked there
      const kit = this.slot;
      const moved = scripts.kind === "relocate" ? relocateRole(this.bundle, kit.managed, "userScripts") : null;
      const items = moved && scripts.kind === "relocate"
        ? (await planManaged(this.app.vault.adapter, this.bundle, moved.state, { ...roles, userScripts: scripts.to }, this.legacy(), this.baseDir(), this.offIds()))
          .filter(it => it.file.role === "userScripts")
        : [];
      const select = (it: ManagedItem): boolean => it.action === "create" || it.action === "up-to-date";
      if (!settings.length && !items.length) { new Notice(done.concat("Templater was already set up.").join("\n"), 10000); return; }
      const notes: PreviewNote[] = moved?.old.length
        ? [{ heading: "Old copies, left in place (delete them when you like)", paths: moved.old, text: `Templater loads scripts from ${current}, which is left as it is.` }]
        : [];
      let report: ManagedResult[] | null = null, ran = false;
      await this.confirmThen({
        title: "Set up Templater?", yes: "Set up", ask: true, items, select, settings, notes,
        run: async () => {
          ran = true;
          if (!moved || scripts.kind !== "relocate") return;
          const out = await this.quietly(items, this.applyOptions({ select, keepVersion: true }), o => applyManaged(this.app.vault.adapter, this.bundle, items, moved.state, o));
          kit.managed = out.state;
          kit.paths.userScripts = scripts.to;
          await this.host.save();
          report = out.results;
        },
      });
      if (report) new KitReportModal(this.app, report).open();
      if (ran && done.length) new Notice(done.join("\n") + "\nLast step: set Alt+S for Insert snippet in Obsidian → Hotkeys.", 15000);
    } catch (e) { this.failed(e); }
  }

  review(): void { new KitManagedModal(this.app, this).open(); }
  manage(): void { new KitFilesModal(this.app, this).open(); }

  failed(e: unknown): void {
    console.error(e);
    new Notice("Kit update stopped: " + (e as Error).message + "\nAnything it replaced is in the backups folder.", 15000);
  }
}

/** The symbol + word for what Apply does with a file, coloured (src/kit/managed.ts `actionLook`). */
function actionChip(parent: HTMLElement, action: ManagedAction): void {
  const look = actionLook(action);
  const chip = parent.createSpan({ cls: `lab-kit-act is-${look.tone}` });
  chip.createSpan({ cls: "lab-kit-act-symbol", text: look.symbol });
  chip.appendText(" " + look.word);
}

const GROUPS: { action: ManagedAction; title: string; open?: boolean }[] = [
  { action: "needs-merge", title: "Conflict: you and the kit changed the same lines (left untouched; resolve in Manage kit files)", open: true },
  { action: "merge", title: "Changed by you and by the kit, merges cleanly (tick to merge; your copy is backed up first)", open: true },
  { action: "missing", title: "Deleted by you (tick to recreate)", open: true },
  { action: "create", title: "New files", open: true },
  { action: "fast-forward", title: "Updated (the old copy is backed up first)", open: true },
  { action: "user-modified", title: "Changed by you (left untouched)" },
  { action: "up-to-date", title: "Already up to date" },
  { action: "keep", title: "Kept: files you are meant to edit (your settings); the kit never updates them" },
  { action: "detached", title: "Detached (not managed)" },
  { action: "off", title: "Switched off (not installed)" }
];

/** Dry run: what would happen to every kit file, then Apply. */
class KitManagedModal extends Modal {
  private items: ManagedItem[] = [];
  private retired: RetiredItem[] = [];
  private recreate = new Set<string>();
  /** Clean merges are ticked by default; ids here were unticked. */
  private noMerge = new Set<string>();

  constructor(app: App, private managed: KitManaged) { super(app); }

  async onOpen(): Promise<void> {
    this.titleEl.setText(`Kit files, v${this.managed.version}`);
    try { this.items = await this.managed.plan(); this.retired = await this.managed.retired(); }
    catch (e) { this.contentEl.createEl("p", { text: "Couldn't read your vault: " + (e as Error).message, cls: "mod-warning" }); return; }
    this.render();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("lab-kit-modal");
    const inst = this.managed.installedVersion;
    contentEl.createEl("p", { cls: "setting-item-description",
      text: inst ? `Installed: v${inst}. Nothing is written until you press Apply.` : "Nothing installed by the built-in kit yet. Nothing is written until you press Apply." });
    const count = (a: ManagedAction): number => this.items.filter(i => i.action === a).length;
    new Setting(contentEl).setName("Changes").setDesc(
      `${count("create")} new · ${count("fast-forward")} updated · ${count("merge")} to merge · ${count("needs-merge")} conflicts · ${count("user-modified")} changed by you · ${count("missing")} missing · ${count("up-to-date")} up to date`).setHeading();

    // One click ticks every file with a box (recreate / merge); nothing is written until Apply
    const boxed = this.items.filter(i => i.action === "missing" || i.action === "merge");
    if (boxed.length) {
      new Setting(contentEl).setName(`Tick or untick all ${boxed.length} files with a box`)
        .addButton(b => b.setButtonText("Tick all").setCta().onClick(() => this.tick(boxed, true)))
        .addButton(b => b.setButtonText("Untick all").onClick(() => this.tick(boxed, false)));
    }

    for (const g of GROUPS) {
      const group = this.items.filter(i => i.action === g.action);
      if (!group.length) continue;
      const det = contentEl.createEl("details", { cls: "lab-kit-group" });
      det.open = !!g.open;
      det.createEl("summary", { text: `${g.title} (${group.length})` });
      const ul = det.createEl("ul");
      for (const it of group) {
        const li = ul.createEl("li");
        if (g.action === "missing") {
          const cb = li.createEl("input", { attr: { type: "checkbox" } });
          cb.checked = this.recreate.has(it.file.id);
          cb.addEventListener("change", () => { if (cb.checked) this.recreate.add(it.file.id); else this.recreate.delete(it.file.id); this.render(); });
          li.appendText(" recreate ");
        }
        if (g.action === "merge") {
          const cb = li.createEl("input", { attr: { type: "checkbox" } });
          cb.checked = !this.noMerge.has(it.file.id);
          cb.addEventListener("change", () => { if (cb.checked) this.noMerge.delete(it.file.id); else this.noMerge.add(it.file.id); this.render(); });
          li.appendText(" merge ");
        }
        li.addClass("lab-kit-review-row");
        actionChip(li, g.action);
        li.appendText(" ");
        li.createSpan({ cls: "lab-kit-install-name", text: it.dest.slice(it.dest.lastIndexOf("/") + 1) });
        if (it.file.desc) li.createDiv({ cls: "setting-item-description", text: it.file.desc });
        li.createEl("code", { cls: "lab-kit-install-path", text: it.dest });
        if (it.untracked && (g.action === "user-modified")) li.appendText(" (not installed by the kit, no original to compare with)");
        if (g.action === "needs-merge" && it.conflicts === undefined) li.appendText(" (no original copy to merge with)");
        if (g.action === "merge" && it.file.kind === "script") li.appendText(" (merged code: please test it)");
      }
    }

    if (this.retired.length) {
      const det = contentEl.createEl("details", { cls: "lab-kit-group" });
      det.open = true;
      det.createEl("summary", { text: `Retired by the kit (left in place, never deleted) (${this.retired.length})` });
      const ul = det.createEl("ul");
      for (const r of this.retired) {
        const li = ul.createEl("li");
        li.createSpan({ cls: "lab-kit-act is-leave", text: "– Left in place, not deleted " });
        li.createEl("code", { text: r.path });
        if (!r.exists) li.appendText(" (already deleted)");
      }
    }

    const todo = this.writes();
    new Setting(contentEl).setClass("lab-kit-sticky-foot")
      .addButton(b => b.setButtonText("Close").onClick(() => this.close()))
      .addButton(b => b.setButtonText(todo ? `Apply (${todo} files)` : "Apply").setCta().setDisabled(!todo && !count("up-to-date"))
        .onClick(() => void this.apply()));
  }

  /** Ticks or unticks every recreate / merge box at once. */
  private tick(items: ManagedItem[], on: boolean): void {
    for (const it of items) {
      if (it.action === "missing") { if (on) this.recreate.add(it.file.id); else this.recreate.delete(it.file.id); }
      else if (on) this.noMerge.delete(it.file.id); else this.noMerge.add(it.file.id);
    }
    this.render();
  }

  private select = (it: ManagedItem): boolean => SAFE_ACTIONS.includes(it.action)
    || (it.action === "missing" && this.recreate.has(it.file.id))
    || (it.action === "merge" && !this.noMerge.has(it.file.id));
  private writes(): number { return this.items.filter(i => this.select(i) && i.action !== "up-to-date").length; }

  private async apply(): Promise<void> {
    const scripts = new Set(this.items.filter(i => i.file.kind === "script").map(i => i.file.id));
    this.close();
    await this.managed.applyReviewed(this.items, this.select, results => new KitReportModal(this.app, results, scripts).open());
  }

  onClose(): void { this.contentEl.empty(); }
}

/** One row per kit file with a status label and its own buttons, plus the CSS snippet switch. */
class KitFilesModal extends Modal {
  private items: ManagedItem[] = [];
  private retired: RetiredItem[] = [];

  constructor(app: App, private managed: KitManaged) { super(app); }

  async onOpen(): Promise<void> {
    this.titleEl.setText(`Manage kit files, v${this.managed.version}`);
    this.contentEl.addClass("lab-kit-modal");
    await this.refresh();
  }

  /** Re-reads the vault and redraws; the window stays open after every action. */
  private async refresh(): Promise<void> {
    const top = this.contentEl.scrollTop;   // the window scrolls its own content: keep the place after the redraw
    try { this.items = await this.managed.plan(); this.retired = await this.managed.retired(); }
    catch (e) { this.contentEl.empty(); this.contentEl.createEl("p", { text: "Couldn't read your vault: " + (e as Error).message, cls: "mod-warning" }); return; }
    this.render();
    this.contentEl.scrollTop = top;
  }

  private async run(action: () => Promise<unknown>): Promise<void> {
    try { await action(); } catch (e) { this.managed.failed(e); }
    await this.refresh();
  }

  private snippetSwitch(contentEl: HTMLElement): void {
    const installed = this.items.filter(i => i.file.kind === "snippet" && i.curHash !== null);
    if (!installed.length) return;
    const names = installed.map(i => i.dest.split("/").pop() ?? i.dest);
    if (!cssSnippetsSupported(this.app)) {
      new Setting(contentEl).setName("CSS snippet").setDesc(`This version of Obsidian doesn't let Lab Kit switch snippets. Turn on ${names.join(", ")} in Settings → Appearance → CSS snippets.`);
      return;
    }
    new Setting(contentEl).setName("CSS snippet").setDesc(names.join(", "))
      .addToggle(t => t.setValue(names.every(n => isCssSnippetEnabled(this.app, n) === true)).onChange(async v => {
        try { await (v ? setCssSnippets(this.app, names, []) : setCssSnippets(this.app, [], names)); }
        catch (e) { this.managed.failed(e); }
      }));
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.snippetSwitch(contentEl);
    const ordered = sortByAttention(this.items, (id) => this.managed.stateOf(id));
    for (const it of ordered) {
      const id = it.file.id;
      const status = statusOf(it, this.managed.stateOf(id));
      const row = new Setting(contentEl).setName(it.dest);
      actionChip(row.nameEl, it.action);
      row.nameEl.createSpan({ cls: `lab-kit-badge is-${status.tone}`, text: status.label });
      const note = it.action === "merge" && it.file.kind === "script" ? "Merged code: please test it. Your copy is backed up first."
        : it.action === "needs-merge" && it.file.kind === "script" ? "Code: after merging, please test it." : "";
      row.setDesc([it.file.desc, note].filter(Boolean).join(" · "));
      if (it.file.optional) {
        row.addToggle(t => t.setTooltip("Use this file").setValue(it.action !== "off")
          .onChange(on => void this.managed.setUse(id, on, () => void this.refresh())));
      }
      if (it.action === "create" || it.action === "fast-forward" || it.action === "missing" || it.action === "merge") {
        const text = it.action === "create" ? "Install" : it.action === "fast-forward" ? "Update" : it.action === "merge" ? "Merge" : "Recreate";
        row.addButton(b => b.setButtonText(text).setCta().onClick(() => void this.run(() => this.managed.updateOne(id))));
      }
      if (it.action === "needs-merge") {
        row.addButton(b => b.setButtonText("Resolve…").setCta().onClick(() => void this.managed.resolve(id, () => void this.refresh())));
      }
      if (it.action === "user-modified" || it.action === "merge" || it.action === "needs-merge") {
        row.addButton(b => b.setButtonText("Restore kit original").onClick(() => {
          new ConfirmModal(this.app, "Restore the kit's copy?", `${it.dest} goes back to the kit's version. Your copy is saved in the backup folder first.`,
            "Restore", async () => { await this.run(() => this.managed.restoreOne(id)); }).open();
        }));
      }
      if (it.action === "detached") row.addButton(b => b.setButtonText("Re-attach").onClick(() => void this.run(() => this.managed.detach(id, false))));
      else if (!it.untracked && it.action !== "off") row.addButton(b => b.setButtonText("Detach").onClick(() => void this.run(() => this.managed.detach(id, true))));
      // A code snippet's .md is only a stub that calls labSnippets.js: opening it is no use, so those rows have no Open button (token templates do)
      const isSnippet = it.file.dest.startsWith("Snippets/");
      if (isSnippet && (canCopy(snippetKey(it.text)) || isTokenTemplate(it.text, parseYaml)) && this.app.vault.getFileByPath(it.dest)) {
        row.addButton(b => b.setButtonText("Make my own copy").onClick(() => void makeMyCopy(this.app, it.dest).then(() => this.refresh())));
      }
      const file = isSnippet && isStubSnippet(it.text) ? null : this.app.vault.getFileByPath(it.dest);
      if (file) row.addExtraButton(b => b.setIcon("file-text").setTooltip("Open").onClick(() => {
        this.close();
        void this.app.workspace.getLeaf(false).openFile(file);
      }));
    }
    for (const r of this.retired) {
      const row = new Setting(contentEl).setName(r.path).setDesc("The kit no longer ships this file. Yours is left as it is; forget it to stop listing it here.");
      row.nameEl.createSpan({ cls: "lab-kit-badge is-muted", text: "Retired" });
      row.addButton(b => b.setButtonText("Forget").onClick(() => void this.run(() => this.managed.forget(r.id))));
      const file = this.app.vault.getFileByPath(r.path);
      if (file) row.addExtraButton(b => b.setIcon("file-text").setTooltip("Open").onClick(() => {
        this.close();
        void this.app.workspace.getLeaf(false).openFile(file);
      }));
    }
    new Setting(contentEl).addButton(b => b.setButtonText("Close").setCta().onClick(() => this.close()));
  }

  onClose(): void { this.contentEl.empty(); }
}

/** What a run did: counts and a file list. */
class KitReportModal extends Modal {
  constructor(app: App, private results: ManagedResult[], private scripts: Set<string> = new Set()) { super(app); }

  onOpen(): void {
    const { contentEl, results } = this;
    this.titleEl.setText("Kit update report");
    contentEl.addClass("lab-kit-modal");
    const n = (o: ManagedResult["outcome"]): number => results.filter(r => r.outcome === o).length;
    contentEl.createEl("p", { text: `${n("created")} created · ${n("updated")} updated · ${n("merged")} merged · ${n("adopted")} already up to date · ${n("skipped")} left alone` });
    if (results.some(r => r.outcome === "merged" && this.scripts.has(r.id))) {
      contentEl.createEl("p", { text: "Merged scripts combine your edits with the kit's code. Please test them.", cls: "mod-warning" });
    }
    const order: ManagedResult["outcome"][] = ["created", "updated", "merged", "adopted", "skipped"];
    const names = { created: "Created", updated: "Updated", merged: "Merged", adopted: "Already up to date", skipped: "Left alone" };
    for (const o of order) {
      const group = results.filter(r => r.outcome === o);
      if (!group.length) continue;
      const det = contentEl.createEl("details", { cls: "lab-kit-group" });
      det.open = o === "created" || o === "updated" || o === "merged" || (o === "skipped" && group.some(r => r.action !== "up-to-date"));
      det.createEl("summary", { text: `${names[o]} (${group.length})` });
      const ul = det.createEl("ul");
      for (const r of group) {
        const li = ul.createEl("li");
        li.createEl("code", { text: r.dest });
        if (r.backup) li.appendText(` (old copy: ${r.backup})`);
        else if (o === "skipped") li.appendText(` (${r.action})`);
      }
    }
    new Setting(contentEl).addButton(b => b.setButtonText("Close").setCta().onClick(() => this.close()));
  }

  onClose(): void { this.contentEl.empty(); }
}

/** A change to Obsidian's or another plugin's settings: listed with a switch (on) in the confirmation dialog, made only when confirmed. */
export interface SettingChange { name: string; desc: string; apply: () => Promise<unknown> }
/** An extra list in the confirmation dialog (e.g. old copies that are left in place). */
interface PreviewNote { heading: string; paths: string[]; text?: string }

/** The confirmation before a kit writes anything new: grouped lists with counts, a switch per settings change; Cancel writes nothing. */
class KitInstallModal extends Modal {
  private confirmed = false;
  private on: boolean[];
  constructor(app: App, private title: string, private yes: string, private preview: InstallPreview, private settings: SettingChange[], private notes: PreviewNote[],
    private onYes: (chosen: SettingChange[]) => Promise<void>, private onCancel: () => void) { super(app); this.on = settings.map(() => true); }

  onOpen(): void {
    const { contentEl, preview } = this;
    this.titleEl.setText(this.title);
    contentEl.addClass("lab-kit-modal");
    contentEl.createEl("p", { text: `Nothing is written until you press ${this.yes}. A file that is already there is never overwritten.` });
    // One row per file or folder, like the Check setup list: its name, what it is for, then where it goes
    const group = (heading: string, paths: string[], text?: string): void => {
      if (!paths.length) return;
      const det = contentEl.createEl("details", { cls: "lab-kit-group" });
      det.open = paths.length <= 8;
      det.createEl("summary", { text: `${heading} (${paths.length})` });
      if (text) det.createEl("p", { cls: "setting-item-description", text });
      for (const p of paths) {
        const row = det.createDiv({ cls: "lab-kit-install-row" });
        row.createDiv({ cls: "lab-kit-install-name", text: p.slice(p.lastIndexOf("/") + 1) });
        const about = preview.about?.[p];
        if (about) row.createDiv({ cls: "setting-item-description", text: about });
        row.createEl("code", { cls: "lab-kit-install-path", text: p });
      }
    };
    group("Files to create", preview.create, "New files, written now.");
    group("Files to update", preview.update, "Kit files you haven't changed. The old copy is backed up first.");
    group("Files left alone", preview.leftAlone, "A file with this name is already there. It is never changed.");
    group("Folders to create", preview.folders, "Made empty where needed, so the layout is complete.");
    for (const n of this.notes) group(n.heading, n.paths, n.text);
    if (this.settings.length) {
      new Setting(contentEl).setName(`Settings to change (${this.settings.length})`).setHeading();
      this.settings.forEach((c, i) => { new Setting(contentEl).setName(c.name).setDesc(c.desc).addToggle(g => g.setValue(true).onChange(v => { this.on[i] = v; })); });
    }
    new Setting(contentEl)
      .addButton(b => b.setButtonText("Cancel").onClick(() => this.close()))
      .addButton(b => b.setButtonText(this.yes).setCta().onClick(() => {
        this.confirmed = true;
        this.close();
        void this.onYes(this.settings.filter((_, i) => this.on[i]));
      }));
  }

  onClose(): void { this.contentEl.empty(); if (!this.confirmed) this.onCancel(); }
}

class ConfirmModal extends Modal {
  private confirmed = false;
  constructor(app: App, private title: string, private text: string, private yes: string, private onYes: () => Promise<void>, private onCancel?: () => void) { super(app); }

  onOpen(): void {
    this.titleEl.setText(this.title);
    this.contentEl.createEl("p", { text: this.text });
    new Setting(this.contentEl)
      .addButton(b => b.setButtonText("Cancel").onClick(() => this.close()))
      .addButton(b => b.setButtonText(this.yes).setCta().onClick(() => { this.confirmed = true; this.close(); void this.onYes(); }));
  }

  onClose(): void { this.contentEl.empty(); if (!this.confirmed) this.onCancel?.(); }
}
