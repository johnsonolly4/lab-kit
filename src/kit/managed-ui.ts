// Built-in kit: the glue between the plugin and src/kit/managed.ts, plus the review window, the report and the first-install question.
// Works on mobile: only the vault adapter and crypto.subtle.
import { Modal, Notice, Setting, parseYaml, setIcon, type App, type Plugin, type TFile } from "obsidian";
import {
  SAFE_ACTIONS, applyManaged, disableManaged, firstInstallOptions, forgetManaged, inFolders, kitSha1, patchFolders, patchManagedFolders, planFolderReapply, previewInstall, relocateRole, templaterScriptsAction, templaterScriptsNeedChange, templaterTemplatesTarget, planManaged, planRetired, offIds, resolveManaged, restoreManaged, setDetached, sortByAttention, statusOf, trackedRoles,
  kitBackupPath, kitHasNewer, kitKept, newerKitItems, type ApplyOptions, type EmbeddedKit, type InstallPreview, type LegacyRecord, type ManagedAction, type ManagedFileState, type ManagedItem, type ManagedResult, type RetiredItem
} from "./managed";
import { KitMergeModal } from "./merge-ui";
import { actionWinState, installSummary, outcomeWinState, reportSummary, reviewSummary } from "./managed-look";
import { winFold, winFoot, winIntro, winRow, winSummary } from "./window-look";
import { kitStatusLine, orderKits, type SafeKit } from "./kit-set";
import { addTemplaterHotkey, withoutTemplaterTrigger, cssSnippetsSupported, hasTemplater, hasTemplaterHotkey, isCssSnippetEnabled, loadedPlugins, setCssSnippets, setTemplaterTemplatesFolder, setTemplaterUserScripts, templaterTemplatesFolder, templaterUserScriptsFolder } from "./obsidian-private";
import { ensureFolder } from "./ensure-folder";
import { makeMyCopy } from "./snippet-copy-ui";
import { canCopy, isStubSnippet, isTokenTemplate, snippetKey } from "./snippet-copy";
import { LAB_KIT, PLANNING_KIT, kitCompare, kitDetectRoles, kitFolderRoles, kitInBackup, kitJoin, kitSlot, labFolders, planningFolders, planningRoles, type KitFolder, type KitData, type KitRecord, type KitSlot, type Roles } from "./paths";

/** Id of the Alt+S menu template in kit-manifest.json. */
const MENU_ID = "tpl-insert-snippet-md";

/** Names of the settings a kit file can need (`needs` in kit-manifest.json), as the settings tab shows them. */
const NEEDS_NAME: Record<string, string> = { chemicalFolder: "Chemical folder", labFolder: "Lab notes folder", rigsFolder: "Rigs folder" };

export interface ManagedHost { kit: KitData; save(): Promise<void>; /** Called after a kit's files were written (e.g. to start the planning commands without a reload). */ installed?(): void }

/** A window that tells whoever opened it when it has closed. */
export type ClosingModal = Modal & { onClosed?: () => void };

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

  /** Paths of the files you keep as your own that the kit has a newer text for (the count the start-up notice, Check setup and the settings tab show). */
  async newerKitFiles(): Promise<string[]> {
    if (!this.installedVersion) return [];
    return newerKitItems(await this.plan(), id => this.stateOf(id)).map(i => i.dest);
  }

  plan(): Promise<ManagedItem[]> {
    return planManaged(this.app.vault.adapter, this.bundle, this.slot.managed, this.roles(), this.legacy(), this.baseDir(), this.offIds());
  }

  /** To the trash like the plugin's other removals (a copy was backed up first). */
  private async trash(path: string): Promise<void> {
    const f = this.app.vault.getFileByPath(path);
    if (f) await this.app.fileManager.trashFile(f); else await this.app.vault.adapter.remove(path);
  }

  private applyOptions(extra: Partial<ApplyOptions> = {}): ApplyOptions {
    return { baseDir: this.baseDir(), backups: this.roles().backups, stamp: new Date().toISOString(), debug: this.host.kit.debug, remove: p => this.trash(p), ...extra };
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
      const kept = !!item && kitHasNewer(item, this.slot.managed?.files[id]);   // a kept file with a newer kit version: Compare
      if (!item || (item.action !== "needs-merge" && !kept)) { new Notice("This file isn't in conflict."); onDone(); return; }
      const adapter = this.app.vault.adapter;
      const baseFile = kitJoin(this.baseDir(), `${id}.txt`);
      const base = (item.conflicts !== undefined || kept) && await adapter.exists(baseFile) ? await adapter.read(baseFile) : null;
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
      const { items, select, writes, first, settings, folders } = await this.safeSpec();
      await this.confirmThen({
        title: first ? `Create ${writes} kit files?` : writes ? `Update ${writes} kit files?` : "Change these settings?", yes: first ? `Create ${writes} files` : "Update", ask: first,
        items, select, settings, folders,
        run: async () => { new KitReportModal(this.app, await this.apply(items, select)).open(); },
      });
    } catch (e) { this.failed(e); }
  }

  /** What "Update all safe files" does for this kit: the files, how many are written, whether it is the first install, and the settings and folders that come with it. */
  private async safeSpec(): Promise<{ items: ManagedItem[]; select: (it: ManagedItem) => boolean; writes: number; first: boolean; settings: SettingChange[]; folders: KitFolder[] }> {
    const items = await this.plan();
    const select = (it: ManagedItem): boolean => SAFE_ACTIONS.includes(it.action);
    const writes = items.filter(i => i.action === "create" || i.action === "fast-forward").length;
    const first = !this.slot.managed && writes > 0;
    return { items, select, writes, first, settings: [...(first ? this.firstInstallSettings() : []), ...this.hotkeySetting(items, select)], folders: first ? this.kitFolders() : [] };
  }

  /** The same for the files the review window has ticked. */
  private pickedSpec(items: ManagedItem[], select: (it: ManagedItem) => boolean): Promise<{ items: ManagedItem[]; select: (it: ManagedItem) => boolean; first: boolean; settings: SettingChange[]; folders: KitFolder[] }> {
    const first = !this.slot.managed;
    return Promise.resolve({ items, select, first, settings: [...(first ? this.firstInstallSettings() : []), ...this.hotkeySetting(items, select)], folders: first ? this.kitFolders() : [] });
  }

  /** This kit for "Update all safe files" across both kits (src/kit/kit-set.ts `runSafeUpdate`). */
  asSafeKit(picked?: { items: ManagedItem[]; select: (it: ManagedItem) => boolean }): SafeKit {
    const id = this.bundle.manifest.id, name = id === PLANNING_KIT ? "Planning kit" : "Lab kit";
    return { id, name, plan: async () => {
      // The review window's own pick (`picked`): the same confirmation as its Apply has for one kit
      const spec = picked ? await this.pickedSpec(picked.items, picked.select) : await this.safeSpec();
      const { items, select, first, settings, folders } = spec;
      const preview = await previewInstall(this.app.vault.adapter, items, select, folders);
      const extra = folders.map(f => f.path).filter(p => preview.folders.includes(p));
      return { part: { id, name, preview, settings, notes: [], ask: first, folders: extra },
        ensure: async () => { for (const p of extra) await ensureFolder(this.app.vault, p); },
        run: () => this.apply(items, select) };
    } };
  }

  /** Called by the review window's Apply: the same confirmation as "Update all safe files", for the files ticked there. */
  async applyReviewed(items: ManagedItem[], select: (it: ManagedItem) => boolean, report: (results: ManagedResult[]) => void): Promise<void> {
    const first = !this.slot.managed;
    await this.confirmThen({
      title: first ? "Install the kit?" : "Update these files?", yes: "Update", ask: first,
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

  /** Both return their window, so a window that opened one (Check setup) can redraw itself when it closes. */
  review(): ClosingModal { const m = new KitManagedModal(this.app, [this]); m.open(); return m; }
  manage(): ClosingModal { const m = new KitFilesModal(this.app, [this]); m.open(); return m; }

  failed(e: unknown): void {
    console.error(e);
    new Notice("Kit update stopped: " + (e as Error).message + "\nAnything it replaced is in the backups folder.", 15000);
  }
}

const GROUPS: { action: ManagedAction; title: string; open?: boolean }[] = [
  { action: "fast-forward", title: "Updated (the old copy is backed up first)", open: true },
  { action: "create", title: "New files", open: true },
  { action: "merge", title: "Changed by you and by the kit, merges cleanly (tick to merge; your copy is backed up first)", open: true },
  { action: "needs-merge", title: "Conflict: you and the kit changed the same lines (left untouched; resolve in Manage kit files)", open: true },
  { action: "missing", title: "Deleted by you (tick to recreate)", open: true },
  { action: "user-modified", title: "Changed by you (left untouched)" },
  { action: "up-to-date", title: "Already up to date" },
  { action: "keep", title: "Kept: files you are meant to edit (your settings); the kit never updates them. If the kit has a newer version, Manage kit files offers to replace yours" },
  { action: "detached", title: "Detached (not managed)" },
  { action: "off", title: "Switched off (not installed)" }
];

/** The actions listed in the review window's top box (across kits); every other group stays in its kit's fold. */
const TOP_ACTIONS: ManagedAction[] = ["fast-forward", "create", "merge", "needs-merge", "missing"];
/** What each top-box row says it will do (the long group titles do not fit one row). */
const TOP_LINES: Partial<Record<ManagedAction, string>> = {
  "fast-forward": "Updated, the old copy is backed up first",
  create: "New file",
  merge: "Changed by you and by the kit, merges cleanly; your copy is backed up first",
  "needs-merge": "Conflict: you and the kit changed the same lines. Left untouched; resolve in Manage kit files",
  missing: "Deleted by you; tick to recreate"
};

/** One kit's part of the review window: what would happen to each of its files, with the boxes. Drawn into `root`; `changed` runs after every redraw so the window's Apply button follows the ticks. */
class KitReviewSection {
  items: ManagedItem[] = [];
  retired: RetiredItem[] = [];
  private recreate = new Set<string>();
  /** Clean merges are ticked by default; ids here were unticked. */
  private noMerge = new Set<string>();
  /** New and updated files are ticked by default; ids here were unticked and are left as they are. */
  private skip = new Set<string>();
  /** Which groups the user opened or closed, so ticking a box does not fold them back. */
  private folds = new Map<string, boolean>();

  constructor(readonly managed: KitManaged, private root: HTMLElement, private changed: () => void, private ticked: () => void = () => {}) {}

  async load(): Promise<void> { this.items = await this.managed.plan(); this.retired = await this.managed.retired(); }

  render(): void {
    const contentEl = this.root;
    contentEl.empty();
    const inst = this.managed.installedVersion;
    winIntro(contentEl, inst ? `Installed: v${inst}.` : "Nothing installed by the built-in kit yet.");
    winSummary(contentEl, reviewSummary(this.items));
    const count = (a: ManagedAction): number => this.items.filter(i => i.action === a).length;
    contentEl.createDiv({ cls: "setting-item-description",
      text: `${count("create")} new · ${count("fast-forward")} updated · ${count("merge")} to merge · ${count("needs-merge")} conflicts · ${count("user-modified")} changed by you · ${count("missing")} missing · ${count("up-to-date")} up to date` });

    for (const g of GROUPS) {
      if (TOP_ACTIONS.includes(g.action)) continue;   // listed in the window's top box
      const group = this.items.filter(i => i.action === g.action);
      if (!group.length) continue;
      const det = winFold(contentEl, { title: g.title, count: group.length, open: this.folds.get(g.action) ?? !!g.open, onToggle: open => this.folds.set(g.action, open) }).body;
      for (const it of group) {
        const note = [it.untracked && g.action === "user-modified" ? "Not installed by the kit, no original to compare with." : ""].filter(Boolean);
        winRow(det, { state: actionWinState(g.action), title: it.dest, detail: [it.file.desc, ...note].filter(Boolean).join(" · ") });
      }
    }

    if (this.retired.length) {
      const det = winFold(contentEl, { title: "Retired by the kit (left in place, never deleted)", count: this.retired.length, open: this.folds.get("retired") ?? true, onToggle: open => this.folds.set("retired", open) }).body;
      for (const r of this.retired) winRow(det, { state: "info", title: r.path, detail: r.exists ? "Left in place, not deleted." : "Already deleted." });
    }
    this.changed();
  }

  /** The files in the top box (updated, new, merges, conflicts, deleted), in the order of GROUPS. */
  topItems(): ManagedItem[] { return GROUPS.flatMap(g => TOP_ACTIONS.includes(g.action) ? this.items.filter(i => i.action === g.action) : []); }

  /** Draws one top-box row for `it`: the same boxes as before (recreate / merge / add / update), at the row's right end, centred. `tag` is the kit's name when there are several kits. */
  drawTopRow(parent: HTMLElement, it: ManagedItem, tag: string): void {
    const note = it.action === "needs-merge" && it.conflicts === undefined ? "No original copy to merge with." : it.action === "merge" && it.file.kind === "script" ? "Merged code: please test it." : "";
    const { row, text } = winRow(parent, { state: actionWinState(it.action), title: it.dest, detail: [TOP_LINES[it.action], it.file.desc, note].filter(Boolean).join(" · ") });
    if (tag) text.querySelector(".lab-kit-win-title")?.createSpan({ cls: "lab-kit-badge", text: tag });
    const box = (word: string, on: boolean, set: (on: boolean) => void): void => {
      const label = row.createEl("label", { cls: "lab-kit-win-tick" });
      const cb = label.createEl("input", { attr: { type: "checkbox" } });
      cb.checked = on;
      cb.addEventListener("change", () => { set(cb.checked); this.ticked(); });
      label.appendText(word);
    };
    const id = it.file.id;
    if (it.action === "missing") box("recreate", this.recreate.has(id), on => { if (on) this.recreate.add(id); else this.recreate.delete(id); });
    if (it.action === "merge") box("merge", !this.noMerge.has(id), on => { if (on) this.noMerge.delete(id); else this.noMerge.add(id); });
    if (it.action === "create" || it.action === "fast-forward") box(it.action === "create" ? "add" : "update", !this.skip.has(id), on => { if (on) this.skip.delete(id); else this.skip.add(id); });
  }

  /** Ticks or unticks every recreate / merge / add / update box at once (the top box's buttons). */
  tickAll(on: boolean): void {
    for (const it of this.items) {
      if (it.action === "missing") { if (on) this.recreate.add(it.file.id); else this.recreate.delete(it.file.id); }
      else if (it.action === "create" || it.action === "fast-forward") { if (on) this.skip.delete(it.file.id); else this.skip.add(it.file.id); }
      else if (it.action === "merge") { if (on) this.noMerge.delete(it.file.id); else this.noMerge.add(it.file.id); }
    }
  }
  /** How many files have a box. */
  boxed(): number { return this.items.filter(i => i.action === "missing" || i.action === "merge" || i.action === "create" || i.action === "fast-forward").length; }

  select = (it: ManagedItem): boolean => (SAFE_ACTIONS.includes(it.action) && !this.skip.has(it.file.id))
    || (it.action === "missing" && this.recreate.has(it.file.id))
    || (it.action === "merge" && !this.noMerge.has(it.file.id));
  writes(): number { return this.items.filter(i => this.select(i) && i.action !== "up-to-date").length; }

  /** How many of its files are already up to date (Apply stays pressable then: it only records them). */
  upToDate(): number { return this.items.filter(i => i.action === "up-to-date").length; }
  /** Ids of its scripts, for the "please test" line of the report. */
  scripts(): Set<string> { return new Set(this.items.filter(i => i.file.kind === "script").map(i => i.file.id)); }
}

/** Dry run: what would happen to every kit file, then Apply. One kit, or both kits stacked (a section each, the one with something waiting first and open). */
export class KitManagedModal extends Modal {
  private sections: KitReviewSection[] = [];
  private foot: HTMLElement | null = null;
  private top: HTMLElement | null = null;
  private topOpen = true;
  /** `applyMany`: writes the ticked files of several kits with one confirmation (src/kit/kit-set-ui.ts); needed when there is more than one kit. */
  constructor(app: App, private kits: KitManaged[], private applyMany?: (picks: { kit: KitManaged; items: ManagedItem[]; select: (it: ManagedItem) => boolean }[], scripts: Set<string>) => Promise<void>) { super(app); }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.addClass("lab-kit-modal");
    const many = this.kits.length > 1;
    this.titleEl.setText(many ? "Kit files" : `Kit files, v${this.kits[0].version}`);
    const holders = this.kits.map(() => createDiv());
    const loaded = this.kits.map((k, n) => new KitReviewSection(k, holders[n], () => this.drawFoot(), () => { this.drawTop(); this.drawFoot(); }));
    try { await Promise.all(loaded.map(sec => sec.load())); }
    catch (e) { contentEl.createEl("p", { text: "Couldn't read your vault: " + (e as Error).message, cls: "mod-warning" }); return; }
    const order = many ? orderKits(loaded.map(sec => ({ id: sec.managed.bundle.manifest.id, name: kitName(sec.managed), installed: sec.managed.installedVersion !== null, items: sec.items, sec }))) : loaded.map(sec => ({ sec, waiting: 0, open: true, name: "" }));
    this.sections = order.map(o => o.sec);
    winIntro(contentEl, "Nothing is written until you press Update.");
    this.top = contentEl.createDiv();
    this.drawTop();
    for (const o of order) {
      if (!many) { contentEl.appendChild(holders[loaded.indexOf(o.sec)]); continue; }
      const fold = winFold(contentEl, { title: o.name, sub: kitStatusLine({ bundled: o.sec.managed.version, installed: o.sec.managed.installedVersion, tracked: Object.keys(o.sec.managed.slot.managed?.files ?? {}).length, waiting: o.waiting }), count: o.waiting ? `${o.waiting} waiting` : "up to date", open: o.open });
      fold.body.appendChild(holders[loaded.indexOf(o.sec)]);
    }
    this.foot = contentEl.createDiv();
    for (const sec of this.sections) sec.render();
  }

  /** One box at the top with every file that needs an update, across kits (each row tagged with its kit when there are several), and the Tick all / Untick all buttons. */
  private drawTop(): void {
    if (!this.top) return;
    this.top.empty();
    const many = this.sections.length > 1;
    const rows = this.sections.flatMap(sec => sec.topItems().map(it => ({ sec, it })));
    if (!rows.length) return;
    const boxed = this.sections.reduce((n, sec) => n + sec.boxed(), 0);
    const body = winFold(this.top, { title: "To update", count: rows.length, open: this.topOpen, onToggle: open => { this.topOpen = open; } }).body;
    if (boxed) {
      const bar = body.createDiv({ cls: "lab-kit-win-bar" });
      bar.createSpan({ text: `Tick or untick all ${boxed} files with a box` });
      const buttons = bar.createDiv({ cls: "lab-kit-win-actions" });
      const all = (on: boolean): void => { for (const sec of this.sections) sec.tickAll(on); this.drawTop(); this.drawFoot(); };
      buttons.createEl("button", { text: "Tick all", cls: "mod-cta" }).addEventListener("click", () => all(true));
      buttons.createEl("button", { text: "Untick all" }).addEventListener("click", () => all(false));
    }
    for (const g of GROUPS) for (const { sec, it } of rows) if (it.action === g.action) sec.drawTopRow(body, it, many ? kitName(sec.managed) : "");
  }

  private drawFoot(): void {
    if (!this.foot) return;
    this.foot.empty();
    const todo = this.sections.reduce((n, sec) => n + sec.writes(), 0), any = this.sections.some(sec => sec.upToDate() > 0);
    this.foot.addClass("lab-kit-sticky-foot");   // the wrapper sticks, not the row inside it (a sticky child cannot leave a wrapper that is only as tall as itself)
    const foot = winFoot(this.foot);
    foot.createEl("button", { text: "Close" }).addEventListener("click", () => this.close());
    const apply = foot.createEl("button", { text: todo ? `Update (${todo} files)` : "Update", cls: "mod-cta" });
    apply.disabled = !todo && !any;
    apply.addEventListener("click", () => void this.apply());
  }

  private async apply(): Promise<void> {
    const scripts = new Set(this.sections.flatMap(sec => [...sec.scripts()]));
    this.close();
    if (this.sections.length === 1 || !this.applyMany) {
      const sec = this.sections[0];
      await sec.managed.applyReviewed(sec.items, sec.select, results => new KitReportModal(this.app, results, scripts).open());
      return;
    }
    await this.applyMany(this.sections.map(sec => ({ kit: sec.managed, items: sec.items, select: sec.select })), scripts);
  }

  /** Set by a window that opened this one (Check setup), to redraw itself afterwards. */
  onClosed?: () => void;
  onClose(): void { this.contentEl.empty(); this.onClosed?.(); }
}

/** The name of a kit in the windows. */
export const kitName = (k: KitManaged): string => (k.bundle.manifest.id === PLANNING_KIT ? "Planning kit" : "Lab kit");

/** One kit's rows in the Manage window: a row per file with a status label and its own buttons, plus the CSS snippet switch. Drawn into `root`; every action redraws only this part. */
class KitFilesSection {
  /** Which folds the user opened or closed, kept across redraws. */
  private folds = new Map<string, boolean>();
  private items: ManagedItem[] = [];
  private retired: RetiredItem[] = [];

  /** `scroller`: the window's scrolling element (the place is kept after a redraw). `closeWindow`: closes the whole window (opening a file does). */
  constructor(private app: App, private managed: KitManaged, private root: HTMLElement, private scroller: HTMLElement, private closeWindow: () => void) {}

  /** Re-reads the vault and redraws; the window stays open after every action. */
  async refresh(): Promise<void> {
    const top = this.scroller.scrollTop;   // the window scrolls its own content: keep the place after the redraw
    try { this.items = await this.managed.plan(); this.retired = await this.managed.retired(); }
    catch (e) { this.root.empty(); this.root.createEl("p", { text: "Couldn't read your vault: " + (e as Error).message, cls: "mod-warning" }); return; }
    this.render();
    this.scroller.scrollTop = top;
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

  render(): void {
    const contentEl = this.root;
    contentEl.empty();
    this.snippetSwitch(contentEl);
    winSummary(contentEl, reviewSummary(this.items));
    const ordered = sortByAttention(this.items, (id) => this.managed.stateOf(id));
    // Two folds, what needs an update first and open; the rest folded away behind it (when nothing needs one, the rest is open)
    const needs = (i: ManagedItem): boolean => ["create", "fast-forward", "missing", "merge", "needs-merge"].includes(i.action) || kitHasNewer(i, this.managed.stateOf(i.file.id));
    const nNeeds = ordered.filter(needs).length;
    const folds: Record<string, HTMLElement> = {};
    const bodyFor = (key: "needs" | "rest"): HTMLElement => folds[key] ??= winFold(contentEl, key === "needs"
      ? { title: "Needs an update", count: nNeeds, open: this.folds.get("needs") ?? true, onToggle: o => this.folds.set("needs", o) }
      : { title: nNeeds ? "Up to date, kept and yours" : "All files", count: ordered.length - nNeeds, open: this.folds.get("rest") ?? !nNeeds, onToggle: o => this.folds.set("rest", o) }).body;
    for (const it of ordered) {
      const id = it.file.id;
      const place = bodyFor(needs(it) ? "needs" : "rest");
      const status = statusOf(it, this.managed.stateOf(id));
      const note = it.action === "merge" && it.file.kind === "script" ? "Merged code: please test it. Your copy is backed up first."
        : it.action === "needs-merge" && it.file.kind === "script" ? "Code: after merging, please test it." : "";
      const newer = kitHasNewer(it, this.managed.stateOf(id));
      const { text } = winRow(place, { state: newer ? "todo" : actionWinState(it.action), title: it.dest, detail: [it.file.desc, note].filter(Boolean).join(" · ") });
      // A kept note with no record has nothing to compare: its mark says all there is. Every other row says whether it is up to date
      if (it.action !== "keep" || this.managed.stateOf(id)) text.querySelector(".lab-kit-win-title")?.createSpan({ cls: `lab-kit-badge is-${status.tone}`, text: status.label });
      const actions = text.createDiv({ cls: "lab-kit-win-actions" });
      const button = (label: string, onClick: () => void, cta = false, tip = ""): void => {
        const b = actions.createEl("button", { text: label, cls: cta ? "mod-cta" : "" });
        if (tip) b.setAttribute("title", tip);
        b.addEventListener("click", onClick);
      };
      if (it.file.optional) {
        const use = actions.createEl("label", { cls: "lab-kit-win-tick" });
        const cb = use.createEl("input", { attr: { type: "checkbox", title: "Use this file" } });
        cb.checked = it.action !== "off";
        cb.addEventListener("change", () => void this.managed.setUse(id, cb.checked, () => void this.refresh()));
        use.appendText("use this file");
      }
      if (it.action === "create" || it.action === "fast-forward" || it.action === "missing" || it.action === "merge") {
        const label = it.action === "create" ? "Install" : it.action === "fast-forward" ? "Update" : it.action === "merge" ? "Merge" : "Recreate";
        button(label, () => void this.run(() => this.managed.updateOne(id)), true);
      }
      if (it.action === "needs-merge") button("Resolve…", () => void this.managed.resolve(id, () => void this.refresh()), true);
      if (it.action === "user-modified" || it.action === "merge" || it.action === "needs-merge") {
        button("Restore kit original", () => {
          new ConfirmModal(this.app, "Restore the kit's copy?", `${it.dest} goes back to the kit's version. Your copy is saved in the backup folder first.`,
            "Restore", async () => { await this.run(() => this.managed.restoreOne(id)); }).open();
        });
      }
      if (newer) {
        button("Compare…", () => void this.managed.resolve(id, () => void this.refresh()));
        button("Use kit version…", () => {
          new ConfirmModal(this.app, "Replace your copy with the kit's version?", `Your copy of ${it.dest} will be replaced by the kit's new version. A backup is saved first.`,
            "Replace", async () => { await this.run(() => this.managed.restoreOne(id)); }).open();
        }, true);
        if (!kitKept(it, this.managed.stateOf(id))) button("Keep mine", () => void this.run(() => this.managed.resolveOne(id, null)), false, "Leave your copy as it is. The newer kit version stays listed here if you want it later");
      }
      if (it.action === "detached") button("Re-attach", () => void this.run(() => this.managed.detach(id, false)));
      else if (!it.untracked && it.action !== "off") button("Detach", () => void this.run(() => this.managed.detach(id, true)));
      // A code snippet's .md is only a stub that calls labSnippets.js: opening it is no use, so those rows have no Open button (token templates do)
      const isSnippet = it.file.dest.startsWith("Snippets/");
      if (isSnippet && (canCopy(snippetKey(it.text)) || isTokenTemplate(it.text, parseYaml)) && this.app.vault.getFileByPath(it.dest)) {
        button("Make my own copy", () => void makeMyCopy(this.app, it.dest).then(() => this.refresh()));
      }
      const file = isSnippet && isStubSnippet(it.text) ? null : this.app.vault.getFileByPath(it.dest);
      if (file) this.openButton(actions, file);
      if (!actions.childElementCount) actions.remove();
    }
    const retiredBody = this.retired.length ? winFold(contentEl, { title: "Retired by the kit", count: this.retired.length, open: this.folds.get("retired") ?? true, onToggle: o => this.folds.set("retired", o) }).body : contentEl;
    for (const r of this.retired) {
      const { text } = winRow(retiredBody, { state: "info", title: r.path, detail: "The kit no longer ships this file. Yours is left as it is; forget it to stop listing it here." });
      text.querySelector(".lab-kit-win-title")?.createSpan({ cls: "lab-kit-badge is-muted", text: "Retired" });
      const actions = text.createDiv({ cls: "lab-kit-win-actions" });
      actions.createEl("button", { text: "Forget" }).addEventListener("click", () => void this.run(() => this.managed.forget(r.id)));
      const file = this.app.vault.getFileByPath(r.path);
      if (file) this.openButton(actions, file);
    }
  }

  private openButton(into: HTMLElement, file: TFile): void {
    const b = into.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Open" } });
    setIcon(b, "file-text");
    b.addEventListener("click", () => {
      this.closeWindow();
      void this.app.workspace.getLeaf(false).openFile(file);
    });
  }
}

/** One row per kit file with a status label and its own buttons, plus the CSS snippet switch. One kit, or both kits stacked (a section each, the one with something waiting first and open). */
export class KitFilesModal extends Modal {
  constructor(app: App, private kits: KitManaged[]) { super(app); }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.addClass("lab-kit-modal");
    const many = this.kits.length > 1;
    this.titleEl.setText(many ? "Manage kit files" : `Manage kit files, v${this.kits[0].version}`);
    const holders = this.kits.map(() => createDiv());
    const sections = this.kits.map((k, n) => new KitFilesSection(this.app, k, holders[n], contentEl, () => this.close()));
    if (!many) { contentEl.appendChild(holders[0]); await sections[0].refresh(); }
    else {
      const plans = await Promise.all(this.kits.map(async k => ({ id: k.bundle.manifest.id, name: kitName(k), installed: k.installedVersion !== null, items: await k.plan(), kit: k })));
      for (const o of orderKits(plans)) {
        const fold = winFold(contentEl, { title: o.name, sub: kitStatusLine({ bundled: o.kit.version, installed: o.kit.installedVersion, tracked: Object.keys(o.kit.slot.managed?.files ?? {}).length, waiting: o.waiting }), count: o.waiting ? `${o.waiting} waiting` : "up to date", open: o.open });
        fold.body.appendChild(holders[this.kits.indexOf(o.kit)]);
      }
      await Promise.all(sections.map(sec => sec.refresh()));
    }
    const foot = winFoot(contentEl);
    foot.addClass("lab-kit-sticky-foot");   // Close stays on screen without scrolling to the end
    foot.createEl("button", { text: "Close", cls: "mod-cta" }).addEventListener("click", () => this.close());
  }

  /** Set by a window that opened this one (Check setup), to redraw itself afterwards. */
  onClosed?: () => void;
  onClose(): void { this.contentEl.empty(); this.onClosed?.(); }
}

/** What a run did: counts and a file list. */
export class KitReportModal extends Modal {
  constructor(app: App, private results: ManagedResult[], private scripts: Set<string> = new Set()) { super(app); }

  onOpen(): void {
    const { contentEl, results } = this;
    this.titleEl.setText("Kit update report");
    contentEl.addClass("lab-kit-modal");
    const n = (o: ManagedResult["outcome"]): number => results.filter(r => r.outcome === o).length;
    winSummary(contentEl, reportSummary(results));
    contentEl.createDiv({ cls: "setting-item-description", text: `${n("created")} created · ${n("updated")} updated · ${n("merged")} merged · ${n("moved")} renamed · ${n("adopted")} already up to date · ${n("skipped")} left alone` });
    if (results.some(r => r.outcome === "merged" && this.scripts.has(r.id))) {
      contentEl.createEl("p", { text: "Merged scripts combine your edits with the kit's code. Please test them.", cls: "mod-warning" });
    }
    const order: ManagedResult["outcome"][] = ["created", "updated", "merged", "moved", "adopted", "skipped"];
    const names = { created: "Created", updated: "Updated", merged: "Merged", moved: "Renamed", adopted: "Already up to date", skipped: "Left alone" };
    for (const o of order) {
      const group = results.filter(r => r.outcome === o);
      if (!group.length) continue;
      const open = o === "created" || o === "updated" || o === "merged" || o === "moved" || (o === "skipped" && group.some(r => r.action !== "up-to-date"));
      const det = winFold(contentEl, { title: names[o], count: group.length, open }).body;
      for (const r of group) winRow(det, { state: outcomeWinState(o), title: r.dest, detail: r.backup ? `Old copy: ${r.backup}` : o === "skipped" ? r.action : undefined });
    }
    const foot = winFoot(contentEl);
    foot.addClass("lab-kit-sticky-foot");   // Close stays on screen, as in the Kit files window
    foot.createEl("button", { text: "Close", cls: "mod-cta" }).addEventListener("click", () => this.close());
  }

  onClose(): void { this.contentEl.empty(); }
}

/** A change to Obsidian's or another plugin's settings: listed with a switch (on) in the confirmation dialog, made only when confirmed. */
export interface SettingChange { name: string; desc: string; apply: () => Promise<unknown> }
/** An extra list in the confirmation dialog (e.g. old copies that are left in place). */
export interface PreviewNote { heading: string; paths: string[]; text?: string }

/** The confirmation before a kit writes anything new: grouped lists with counts, a switch per settings change; Cancel writes nothing. */
export class KitInstallModal extends Modal {
  private confirmed = false;
  private on: boolean[];
  constructor(app: App, private title: string, private yes: string, private preview: InstallPreview, private settings: SettingChange[], private notes: PreviewNote[],
    private onYes: (chosen: SettingChange[]) => Promise<void>, private onCancel: () => void) { super(app); this.on = settings.map(() => true); }

  onOpen(): void {
    const { contentEl, preview } = this;
    this.titleEl.setText(this.title);
    contentEl.addClass("lab-kit-modal");
    winIntro(contentEl, `Nothing is written until you press ${this.yes}. A file that is already there is never overwritten.`);
    winSummary(contentEl, installSummary(preview, this.settings.length));
    // One row per file or folder, like the Check setup list: its name, what it is for, then where it goes
    const group = (heading: string, paths: string[], text?: string, state: "todo" | "info" = "todo"): void => {
      if (!paths.length) return;
      const det = contentEl.createEl("details", { cls: "lab-kit-group" });
      det.open = paths.length <= 8;
      det.createEl("summary", { text: `${heading} (${paths.length})` });
      if (text) det.createEl("p", { cls: "setting-item-description", text });
      for (const p of paths) {
        const { text: body } = winRow(det, { state, title: p.slice(p.lastIndexOf("/") + 1), detail: preview.about?.[p] });
        body.createEl("code", { cls: "lab-kit-win-path", text: p });
      }
    };
    group("Files to create", preview.create, "New files, written now.");
    group("Files to update", preview.update, "Kit files you haven't changed. The old copy is backed up first.");
    group("Files left alone", preview.leftAlone, "A file with this name is already there. It is never changed.", "info");
    group("Folders to create", preview.folders, "Made empty where needed, so the layout is complete.");
    for (const n of this.notes) group(n.heading, n.paths, n.text, "info");
    if (this.settings.length) {
      contentEl.createEl("h4", { text: `Settings to change (${this.settings.length})` });
      this.settings.forEach((c, i) => {
        const { row } = winRow(contentEl, { state: "todo", title: c.name, detail: c.desc });
        const label = row.createEl("label", { cls: "lab-kit-win-tick" });
        const box = label.createEl("input", { attr: { type: "checkbox" } });
        box.checked = true;
        box.addEventListener("change", () => { this.on[i] = box.checked; });
        label.appendText("change");
      });
    }
    const foot = winFoot(contentEl);
    foot.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    foot.createEl("button", { text: this.yes, cls: "mod-cta" }).addEventListener("click", () => {
      this.confirmed = true;
      this.close();
      void this.onYes(this.settings.filter((_, i) => this.on[i]));
    });
  }

  onClose(): void { this.contentEl.empty(); if (!this.confirmed) this.onCancel(); }
}

class ConfirmModal extends Modal {
  private confirmed = false;
  constructor(app: App, private title: string, private text: string, private yes: string, private onYes: () => Promise<void>, private onCancel?: () => void) { super(app); }

  onOpen(): void {
    this.titleEl.setText(this.title);
    winIntro(this.contentEl, this.text);
    const foot = winFoot(this.contentEl);
    foot.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    foot.createEl("button", { text: this.yes, cls: "mod-cta" }).addEventListener("click", () => { this.confirmed = true; this.close(); void this.onYes(); });
  }

  onClose(): void { this.contentEl.empty(); if (!this.confirmed) this.onCancel?.(); }
}
