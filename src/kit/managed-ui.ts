// Built-in kit: the glue between the plugin and src/kit/managed.ts, plus the review window, the report and the first-install question.
// Works on mobile: only the vault adapter and crypto.subtle.
import { Modal, Notice, Setting, type App, type Plugin } from "obsidian";
import {
  SAFE_ACTIONS, applyManaged, disableManaged, firstInstallOptions, forgetManaged, kitSha1, templaterScriptsNeedChange, templaterTemplatesTarget, planManaged, planRetired, resolveManaged, restoreManaged, setDetached, statusOf, trackedRoles,
  type ApplyOptions, type EmbeddedKit, type LegacyRecord, type ManagedAction, type ManagedFileState, type ManagedItem, type ManagedResult, type RetiredItem
} from "./managed";
import { KitMergeModal } from "./merge-ui";
import { addTemplaterHotkey, cssSnippetsSupported, hasTemplater, isCssSnippetEnabled, setCssSnippets, setTemplaterTemplatesFolder, setTemplaterUserScripts, templaterTemplatesFolder, templaterUserScriptsFolder } from "./obsidian-private";
import { kitCompare, kitDetectRoles, kitInBackup, kitJoin, type KitData, type KitRecord, type Roles } from "./paths";

/** Id of the Alt+S menu template in kit-manifest.json. */
const MENU_ID = "tpl-insert-snippet-md";

export interface ManagedHost { kit: KitData; save(): Promise<void> }

export class KitManaged {
  constructor(private plugin: Plugin, private host: ManagedHost, readonly bundle: EmbeddedKit) {}

  get app(): App { return this.plugin.app; }
  get version(): string { return this.bundle.manifest.kitVersion; }
  stateOf(id: string): ManagedFileState | undefined { return this.host.kit.managed?.files[id]; }
  get installedVersion(): string | null { return this.host.kit.managed?.installedKitVersion ?? null; }
  updateAvailable(): boolean { const i = this.installedVersion; return i !== null && kitCompare(this.version, i) > 0; }

  /** Folders: detected from your vault and Templater, then your own entries from settings on top. */
  roles(): Roles {
    const kit = this.host.kit;
    const own: Roles = Object.fromEntries(Object.entries(kit.paths).filter(([, v]) => v && !kitInBackup(v)));
    const old = kit.installed;
    const record: KitRecord = { version: old?.version ?? "0", files: old?.files ?? {}, installedAt: old?.installedAt ?? "", roles: { ...(old?.roles ?? {}), ...own } };
    return { ...kitDetectRoles(this.app, record, trackedRoles(this.bundle, kit.managed)), ...own };
  }

  /** Where the templates (Insert snippet.md, Snippets/) are: the Alt+S menu scans the Snippets folder next to it. */
  templatesFolder(): string { return this.roles().templates; }

  isOff(id: string): boolean { return !!this.host.kit.off[id]; }

  private baseDir(): string { return kitJoin(this.app.vault.configDir, "plugins", this.plugin.manifest.id, "kit-base"); }

  /** Files the old folder updater wrote, so they aren't mistaken for your edits. */
  private legacy(): LegacyRecord | null {
    const old = this.host.kit.installed;
    return old ? { files: old.files, hash: kitSha1 } : null;
  }

  plan(): Promise<ManagedItem[]> {
    return planManaged(this.app.vault.adapter, this.bundle, this.host.kit.managed, this.roles(), this.legacy(), this.baseDir(), new Set(Object.keys(this.host.kit.off)));
  }

  private applyOptions(extra: Partial<ApplyOptions> = {}): ApplyOptions {
    return { baseDir: this.baseDir(), backups: this.roles().backups, stamp: new Date().toISOString(), debug: this.host.kit.debug, ...extra };
  }

  async apply(items: ManagedItem[], select: (it: ManagedItem) => boolean): Promise<ManagedResult[]> {
    const kit = this.host.kit;
    const out = await applyManaged(this.app.vault.adapter, this.bundle, items, kit.managed, this.applyOptions({ select }));
    kit.managed = out.state;
    await this.host.save();
    await this.templaterHotkey(out.results);
    return out.results;
  }

  /** When the Alt+S menu template was written, it also goes into Templater's Template hotkeys (nothing is added twice, nothing is ever removed). */
  private async templaterHotkey(results: ManagedResult[]): Promise<void> {
    const menu = results.find(r => r.id === MENU_ID && r.outcome !== "skipped");
    if (!menu || !hasTemplater(this.app)) return;
    try {
      if (await addTemplaterHotkey(this.app, menu.dest)) new Notice("Added Insert snippet to Templater's Template hotkeys. Now set Alt+S for it in Obsidian → Hotkeys.", 12000);
    } catch (e) { console.error(e); }
  }

  /** Once nothing is left to create or update, the whole kit counts as installed (a single-file action doesn't bump the version). */
  private async settleVersion(): Promise<void> {
    const m = this.host.kit.managed;
    if (!m) return;
    const left = (await this.plan()).some(i => i.action === "create" || i.action === "fast-forward");
    if (!left) m.installedKitVersion = this.version;
  }

  /** Install / update / recreate / merge ONE file. */
  async updateOne(id: string): Promise<ManagedResult[]> {
    const kit = this.host.kit;
    const items = await this.plan();
    const go = (it: ManagedItem): boolean => it.file.id === id && (it.action === "create" || it.action === "fast-forward" || it.action === "missing" || it.action === "merge");
    const out = await applyManaged(this.app.vault.adapter, this.bundle, items, kit.managed, this.applyOptions({ select: go, keepVersion: true }));
    kit.managed = out.state;
    await this.settleVersion();
    await this.host.save();
    await this.templaterHotkey(out.results);
    return out.results.filter(r => r.id === id);
  }

  /**
   * Use ON: the file is installed again. Use OFF: your copy is backed up, then moved to the trash, and the kit stops installing it.
   * `done` runs afterwards, also when the user cancels, so the window can redraw.
   */
  async setUse(id: string, on: boolean, done: () => void): Promise<void> {
    const kit = this.host.kit;
    if (on) {
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
    const kit = this.host.kit;
    const item = (await this.plan()).find(i => i.file.id === id);
    if (!item) return null;
    const out = await restoreManaged(this.app.vault.adapter, item, kit.managed, this.applyOptions());
    kit.managed = out.state;
    await this.settleVersion();
    await this.host.save();
    return out.result;
  }

  /** Settles ONE conflict: write `text` (after a backup), or keep your file when `text` is null. Throws after telling the user, so the merge window stays open. */
  async resolveOne(id: string, text: string | null): Promise<void> {
    try {
      const kit = this.host.kit;
      const item = (await this.plan()).find(i => i.file.id === id);
      if (!item) throw new Error("kit file not found");
      const out = await resolveManaged(this.app.vault.adapter, item, text, kit.managed, this.applyOptions());
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
  retired(): Promise<RetiredItem[]> { return planRetired(this.app.vault.adapter, this.bundle, this.host.kit.managed); }

  /** Stops tracking a retired file; your copy stays in the vault. */
  async forget(id: string): Promise<void> {
    const kit = this.host.kit;
    kit.managed = await forgetManaged(this.app.vault.adapter, kit.managed, id, this.baseDir());
    await this.host.save();
  }

  async detach(id: string, on: boolean): Promise<boolean> {
    const ok = setDetached(this.host.kit.managed, id, on);
    if (ok) await this.host.save();
    return ok;
  }

  /** "Update all safe files": new files and unmodified files only. Asks first on the very first install. */
  async updateSafe(): Promise<void> {
    try {
      const items = await this.plan();
      const writes = items.filter(i => i.action === "create" || i.action === "fast-forward").length;
      const go = async (): Promise<void> => {
        try { new KitReportModal(this.app, await this.apply(items, it => SAFE_ACTIONS.includes(it.action))).open(); }
        catch (e) { this.failed(e); }
      };
      if (!this.host.kit.managed && writes) {
        const opts = firstInstallOptions(this.bundle, { installed: hasTemplater(this.app), folder: templaterUserScriptsFolder(this.app) }, this.roles().userScripts);
        const choice = { css: !!opts.css, templater: !!opts.templaterFolder };
        const ticks: ConfirmTick[] = [];
        if (opts.css) ticks.push({ name: "Turn on the CSS snippet", desc: opts.css.enable.join(", "), value: true, onChange: v => { choice.css = v; } });
        if (opts.templaterFolder) ticks.push({ name: "Set Templater's user scripts folder", desc: `To ${opts.templaterFolder}. Templater has none yet; the snippet forms need it.`, value: true, onChange: v => { choice.templater = v; } });
        const first = async (): Promise<void> => {
          await go();
          try {
            if (choice.css && opts.css) await setCssSnippets(this.app, opts.css.enable, opts.css.disable);
            if (choice.templater && opts.templaterFolder) await setTemplaterUserScripts(this.app, opts.templaterFolder);
          } catch (e) { console.error(e); }
        };
        new ConfirmModal(this.app, `Create ${writes} kit files?`,
          "Templates, scripts and the CSS snippet are added to your vault. A file that already exists and differs is never overwritten.", `Create ${writes} files`, first, undefined, ticks).open();
      } else await go();
    } catch (e) { this.failed(e); }
  }

  /** The "Set up Templater" button: points Templater's user scripts folder at the kit's scripts (only when it can't find them now) and adds Insert snippet to its Template hotkeys. */
  async setupTemplater(): Promise<void> {
    if (!hasTemplater(this.app)) { new Notice("Templater isn't installed or turned on. Install and enable it first."); return; }
    try {
      const roles = this.roles();
      const menu = kitJoin(roles.templates, "Insert snippet.md");
      if (!this.app.vault.getFileByPath(menu)) { new Notice("The kit isn't installed yet. Install it first."); return; }
      const done: string[] = [];
      const current = kitInBackup(templaterUserScriptsFolder(this.app) ?? "") ? "" : templaterUserScriptsFolder(this.app);   // a folder inside a backup is a leftover mistake
      if (templaterScriptsNeedChange(current, roles.userScripts)) {
        await setTemplaterUserScripts(this.app, roles.userScripts);
        done.push(`User scripts folder set to ${roles.userScripts}${current?.trim() ? ` (was ${current})` : ""}.`);
      }
      // The template folder is only filled in when Templater has none; one that is set is never changed
      const tplFolder = kitInBackup(templaterTemplatesFolder(this.app) ?? "") ? "" : templaterTemplatesFolder(this.app)?.trim();
      const target = templaterTemplatesTarget(roles.templates);
      if (!tplFolder && target) { await setTemplaterTemplatesFolder(this.app, target); done.push(`Template folder set to ${target}.`); }
      else if (tplFolder && templaterScriptsNeedChange(tplFolder, roles.templates)) done.push(`Template folder left as ${tplFolder} (the kit's templates are in ${roles.templates}).`);
      if (await addTemplaterHotkey(this.app, menu)) done.push("Insert snippet added to Template hotkeys.");
      new Notice((done.length ? done.join("\n") : "Templater was already set up.") + "\nLast step: set Alt+S for Insert snippet in Obsidian → Hotkeys.", 15000);
    } catch (e) { this.failed(e); }
  }

  review(): void { new KitManagedModal(this.app, this).open(); }
  manage(): void { new KitFilesModal(this.app, this).open(); }

  failed(e: unknown): void {
    console.error(e);
    new Notice("Kit update stopped: " + (e as Error).message + "\nAnything it replaced is in the backups folder.", 15000);
  }
}

const GROUPS: { action: ManagedAction; title: string; open?: boolean }[] = [
  { action: "needs-merge", title: "Conflict: you and the kit changed the same lines (left untouched; resolve in Manage kit files)", open: true },
  { action: "merge", title: "Changed by you and by the kit, merges cleanly (tick to merge; your copy is backed up first)", open: true },
  { action: "user-modified", title: "Changed by you (left untouched)" },
  { action: "missing", title: "Deleted by you (tick to recreate)", open: true },
  { action: "create", title: "New files", open: true },
  { action: "fast-forward", title: "Updated (the old copy is backed up first)", open: true },
  { action: "up-to-date", title: "Already up to date" },
  { action: "keep", title: "Kept (your settings)" },
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
        li.createEl("code", { text: it.dest });
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
    try {
      const results = await this.managed.apply(this.items, this.select);
      this.close();
      new KitReportModal(this.app, results, new Set(this.items.filter(i => i.file.kind === "script").map(i => i.file.id))).open();
    } catch (e) { this.managed.failed(e); }
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
    const ordered = [...this.items].sort((a, b) => a.dest.localeCompare(b.dest, undefined, { numeric: true }));
    for (const it of ordered) {
      const id = it.file.id;
      const status = statusOf(it, this.managed.stateOf(id));
      const row = new Setting(contentEl).setName(it.dest);
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
      const file = this.app.vault.getFileByPath(it.dest);
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

/** A tick box in a ConfirmModal. */
interface ConfirmTick { name: string; desc: string; value: boolean; onChange: (v: boolean) => void }

class ConfirmModal extends Modal {
  private confirmed = false;
  constructor(app: App, private title: string, private text: string, private yes: string, private onYes: () => Promise<void>, private onCancel?: () => void, private ticks: ConfirmTick[] = []) { super(app); }

  onOpen(): void {
    this.titleEl.setText(this.title);
    this.contentEl.createEl("p", { text: this.text });
    for (const t of this.ticks) new Setting(this.contentEl).setName(t.name).setDesc(t.desc).addToggle(g => g.setValue(t.value).onChange(t.onChange));
    new Setting(this.contentEl)
      .addButton(b => b.setButtonText("Cancel").onClick(() => this.close()))
      .addButton(b => b.setButtonText(this.yes).setCta().onClick(() => { this.confirmed = true; this.close(); void this.onYes(); }));
  }

  onClose(): void { this.contentEl.empty(); if (!this.confirmed) this.onCancel?.(); }
}
