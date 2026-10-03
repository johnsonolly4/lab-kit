// Kit updater UI: the update window, the settings tab and the controller that wires them into the plugin.
// Ported from the v0.3 plain-JS plugin (see git history before the port) with no behaviour change.
import { Modal, Notice, Platform, PluginSettingTab, Setting, type App, type ButtonComponent, type Plugin, type SettingDefinitionItem, type SettingGroupItem } from "obsidian";
import {
  KIT_DEFAULTS, kitApply, kitCompare, kitDetectRoles, kitPlan, kitReadSource, kitScan,
  type Kit, type KitData, type PlanItem, type Roles
} from "./updater";
import type { HeaderStore } from "../header/settings";
import changelog from "../../docs/changelog.md";
import { WhatsNewModal, latestSection, sectionHeading } from "../whatsnew";
import { hasTemplater, reloadPlugin, setCssSnippets, setTemplaterUserScripts, templaterUserScriptsFolder } from "./obsidian-private";

class KitUpdateModal extends Modal {
  roles: Roles = {};
  items: PlanItem[] = [];
  setTemplater = true;
  enableCss = true;
  makeBackups = false;

  constructor(app: App, private ctl: KitController, private kit: Kit) { super(app); }

  async onOpen(): Promise<void> {
    const m = this.kit.manifest;
    this.titleEl.setText(`Update lab kit to v${m.version}`);
    this.roles = kitDetectRoles(this.app, this.ctl.plugin.manifest.dir as string, this.ctl.kit.installed, m);
    this.setTemplater = true;
    this.enableCss = true;
    this.makeBackups = !!this.ctl.kit.makeBackups;
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("lab-kit-modal");
    const m = this.kit.manifest;
    const installed = this.ctl.kit.installed?.version;
    contentEl.createEl("p", { cls: "setting-item-description",
      text: `${installed ? `Installed: v${installed}. ` : "No install recorded yet. "}From: ${this.kit.dir}` });
    if (m.notes?.length) {
      const ul = contentEl.createEl("ul", { cls: "lab-kit-notes" });
      m.notes.forEach(n => ul.createEl("li", { text: n }));
    }

    // ----- Locations -----
    new Setting(contentEl).setName("Where things go").setDesc("Detected from your vault. Edit a line if it's wrong, then press Recheck.").setHeading();
    const used = [...new Set([...m.files.map(f => f.role), ...(m.delete ?? []).map(d => d.role), ...(this.makeBackups ? ["backups"] : [])])];
    const labels: Record<string, string> = { plugin: "Lab Kit plugin", cssSnippets: "CSS snippets", scripts: "Shared scripts", userScripts: "Templater user scripts",
      templates: "Templates", docs: "Kit notes", backups: "Backups" };
    for (const r of used) {
      new Setting(contentEl).setName(labels[r] ?? r).addText(t => {
        t.setValue(this.roles[r] ?? "").onChange(v => { this.roles[r] = v.trim().replace(/^\/|\/$/g, ""); });
        t.inputEl.addClass("lab-kit-wide-input");
        if (r === "plugin" || r === "cssSnippets") t.setDisabled(true);
      }).controlEl.addClass("lab-kit-wide-control");
    }
    new Setting(contentEl).addButton(b => b.setButtonText("Recheck").onClick(() => void this.refresh()));

    // ----- Plan -----
    let items: PlanItem[];
    try { items = await kitPlan(this.app.vault.adapter, this.kit, this.roles, this.ctl.kit.installed, (src) => kitReadSource(this.kit, src)); }
    catch (e) { contentEl.createEl("p", { text: "Couldn't read the update: " + (e as Error).message, cls: "mod-warning" }); return; }
    this.items = items;
    const count = (s: string): number => items.filter(i => i.status === s).length;
    new Setting(contentEl).setName("Changes").setDesc(
      `${count("new")} new · ${count("replace")} replaced · ${count("edited")} edited by you · ${count("delete")} removed · ${count("keep")} kept · ${count("same")} unchanged`).setHeading();

    const order = ["edited", "replace", "new", "delete", "keep", "same"];
    const names: Record<string, string> = { edited: "Edited by you (kept unless ticked)", replace: "Replace", new: "New", delete: "Remove", keep: "Kept (your settings)", same: "Already up to date" };
    for (const s of order) {
      const group = items.filter(i => i.status === s);
      if (!group.length) continue;
      const det = contentEl.createEl("details", { cls: "lab-kit-group" });
      if (s === "edited") det.open = true;
      det.createEl("summary", { text: `${names[s]} (${group.length})` });
      const ul = det.createEl("ul");
      for (const it of group) {
        const li = ul.createEl("li");
        if (s === "edited") {
          const cb = li.createEl("input", { attr: { type: "checkbox" } });
          cb.checked = false; it.overwrite = false;
          cb.addEventListener("change", () => { it.overwrite = cb.checked; });
          li.appendText(" overwrite ");
        }
        li.createEl("code", { text: it.dest });
      }
    }

    // ----- Options -----
    const want = this.roles.userScripts;
    if (hasTemplater(this.app) && m.templater?.userScripts && templaterUserScriptsFolder(this.app) !== want) {
      new Setting(contentEl).setName("Set Templater's user script folder").setDesc(`to ${want} (needed for snippet forms)`)
        .addToggle(t => t.setValue(this.setTemplater).onChange(v => { this.setTemplater = v; }));
    }
    if (m.enableCss?.length) {
      new Setting(contentEl).setName("Turn on CSS snippets").setDesc(m.enableCss.join(", "))
        .addToggle(t => t.setValue(this.enableCss).onChange(v => { this.enableCss = v; }));
    }

    new Setting(contentEl).setName("Back up replaced files").setDesc(this.makeBackups ? `to ${this.roles.backups}` : "Off: files are replaced without a copy")
      .addToggle(t => t.setValue(this.makeBackups).onChange(v => { this.makeBackups = v; void this.refresh(); }));

    new Setting(contentEl)
      .addButton(b => b.setButtonText("Not now").onClick(() => this.close()))
      .addButton(b => b.setButtonText(`Install v${m.version}`).setCta().onClick(() => void this.install(b)));
  }

  async install(btn: ButtonComponent): Promise<void> {
    btn.setDisabled(true); btn.setButtonText("Installing…");
    const m = this.kit.manifest;
    const mom = (window as unknown as { moment?: () => { format(f: string): string } }).moment;
    const stamp = mom ? mom().format("YYYY-MM-DD HHmm") : new Date().toISOString().slice(0, 16).replace(/[T:]/g, " ");
    try {
      const res = await kitApply(this.app.vault.adapter, this.kit, this.roles, this.items, this.ctl.kit.installed, stamp, this.makeBackups);
      this.ctl.kit.installed = res.record;
      await this.ctl.save();

      if (this.setTemplater && hasTemplater(this.app) && m.templater?.userScripts) await setTemplaterUserScripts(this.app, this.roles.userScripts);
      if (this.enableCss && m.enableCss?.length) await setCssSnippets(this.app, m.enableCss, m.disableCss ?? []);

      const d = res.done;
      new Notice(`Lab kit v${m.version} installed: ${d.written} written, ${d.deleted} removed, ${d.skipped} kept.` +
        (res.backupRoot ? `\nBackup: ${res.backupRoot}` : ""), 10000);
      this.close();

      // The reloaded plugin shows the "What's new" popup itself (the running one still has the old changelog)
      const pluginChanged = this.items.some(i => i.role === "plugin" && i.kind === "file" && (i.status === "new" || i.status === "replace" || (i.status === "edited" && i.overwrite)));
      if (pluginChanged) {
        const id = this.ctl.plugin.manifest.id;
        window.setTimeout(() => void reloadPlugin(this.app, id), 1200);
      }
    } catch (e) {
      console.error(e);
      new Notice("Lab kit update stopped: " + (e as Error).message + (this.makeBackups ? "\nAnything already replaced is in the backups folder." : ""), 15000);
      btn.setDisabled(false); btn.setButtonText("Try again");
    }
  }

  onClose(): void { this.contentEl.empty(); }
}

class KitSettingTab extends PluginSettingTab {
  constructor(app: App, plugin: Plugin, private ctl: KitController, private header: HeaderStore) { super(app, plugin); }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const kit = this.ctl.kit;
    const inst = kit.installed;
    const notebook: SettingGroupItem[] = [
      { name: "Initials", desc: "Used in sample codes, for example ABC0014-A. Read by the Alt+S snippets.",
        render: b => { b.addText(t => t.setValue(kit.initials).onChange(async v => { kit.initials = v.trim(); await this.ctl.save(); })); } }
    ];
    const updates: SettingGroupItem[] = [
      { name: "Update folder", desc: "Folder on this computer where new kit versions arrive (each in its own subfolder with kit-manifest.json).",
        render: b => { b.addText(t => { t.setValue(kit.source).onChange(async v => { kit.source = v.trim(); await this.ctl.save(); }); t.inputEl.addClass("lab-kit-wide-input"); }); } },
      { name: "Check when Obsidian starts",
        render: b => { b.addToggle(t => t.setValue(kit.checkOnStartup).onChange(async v => { kit.checkOnStartup = v; await this.ctl.save(); })); } },
      { name: "Back up replaced files", desc: "Copy files to a kit-backups folder before an update replaces or removes them. Off by default.",
        render: b => { b.addToggle(t => t.setValue(!!kit.makeBackups).onChange(async v => { kit.makeBackups = v; await this.ctl.save(); })); } },
      { name: "Installed version",
        desc: inst ? `v${inst.version} · ${Object.keys(inst.files ?? {}).length} files tracked · ${inst.installedAt}` : "Nothing installed by the updater yet",
        render: b => {
          b.addButton(btn => btn.setButtonText("What's new").onClick(() => void this.ctl.showWhatsNew()))
            .addButton(btn => btn.setButtonText("Check now").setCta().onClick(() => this.ctl.check(true)));
        } }
    ];
    if (inst?.roles) {
      const roles = Object.entries(inst.roles);
      updates.push({ name: "Install locations", render: b => {
        const det = b.descEl.createEl("details");
        det.createEl("summary", { text: "Show" });
        const ul = det.createEl("ul");
        for (const [k, v] of roles) ul.createEl("li", { text: `${k}: ${v}` });
      } });
    }
    updates.push({ name: "Forget install record",
      desc: "Use if you moved things outside Obsidian. Next update re-detects locations; files you edited are then not recognised as edited.",
      render: b => {
        b.addButton(btn => btn.setButtonText("Forget").setDestructive()
          .onClick(async () => { kit.installed = null; await this.ctl.save(); this.update(); }));
      } });
    return [
      { type: "group", heading: "Lab notebook", items: notebook },
      { type: "group", heading: "Kit updates", items: updates },
      ...this.header.definitions()
    ];
  }
}

/** Owns the updater's saved state (the `kit` key of data.json) and registers its settings tab, command and events. */
export class KitController {
  kit: KitData = { ...KIT_DEFAULTS };

  constructor(readonly plugin: Plugin, private header: HeaderStore) {}

  get app(): App { return this.plugin.app; }

  async load(): Promise<void> {
    const saved = (await this.plugin.loadData()) as { kit?: Partial<KitData> } | null;
    this.kit = Object.assign({}, KIT_DEFAULTS, saved?.kit ?? {});
  }
  async save(): Promise<void> {
    const data = ((await this.plugin.loadData()) ?? {}) as Record<string, unknown>;
    data.kit = this.kit;
    await this.plugin.saveData(data);
  }

  setup(): void {
    const plugin = this.plugin;
    plugin.addSettingTab(new KitSettingTab(this.app, plugin, this, this.header));
    plugin.addCommand({ id: "kit-update", name: "Check for updates", callback: () => this.check(true) });
    plugin.addCommand({ id: "whats-new", name: "Show what's new", callback: () => this.showWhatsNew() });
    // First start after the plugin changed version: show what's new once
    this.app.workspace.onLayoutReady(() => {
      const section = latestSection(changelog);
      if (section && sectionHeading(section) !== this.kit.seenChangelog) window.setTimeout(() => void this.showWhatsNew(), 1500);
    });
    // Follow kit files the user moves or renames inside Obsidian
    plugin.registerEvent(this.app.vault.on("rename", async (file, oldPath) => {
      const rec = this.kit.installed?.files;
      if (!rec) return;
      let changed = false;
      for (const p of Object.keys(rec)) {
        if (p === oldPath || p.startsWith(oldPath + "/")) { rec[file.path + p.slice(oldPath.length)] = rec[p]; delete rec[p]; changed = true; }
      }
      const roles = this.kit.installed!.roles ?? {};
      for (const [k, v] of Object.entries(roles)) if (v === oldPath || v.startsWith(oldPath + "/")) { roles[k] = file.path + v.slice(oldPath.length); changed = true; }
      if (changed) await this.save();
    }));
    if (Platform.isDesktopApp && this.kit.checkOnStartup) {
      this.app.workspace.onLayoutReady(() => window.setTimeout(() => this.check(false), 4000));
    }
  }

  /** Opens the popup with the newest changelog section and remembers it was shown. */
  async showWhatsNew(): Promise<void> {
    const section = latestSection(changelog);
    if (!section) return;
    new WhatsNewModal(this.app, section).open();
    const heading = sectionHeading(section);
    if (this.kit.seenChangelog !== heading) { this.kit.seenChangelog = heading; await this.save(); }
  }

  check(manual: boolean): void {
    if (!Platform.isDesktopApp) { if (manual) new Notice("Kit updates work in the desktop app only."); return; }
    let kits: Kit[];
    try { kits = kitScan(this.kit.source); }
    catch { if (manual) new Notice(`Can't read the update folder:\n${this.kit.source}\nSet it in Settings → Lab Kit.`, 8000); return; }
    const latest = kits[0];
    const installed = this.kit.installed?.version ?? "0";
    if (!latest || kitCompare(latest.manifest.version, installed) <= 0) {
      if (manual) new Notice(`Lab kit is up to date${this.kit.installed ? ` (v${installed})` : ""}.`);
      return;
    }
    if (manual) { new KitUpdateModal(this.app, this, latest).open(); return; }
    const frag = createFragment(f => {
      f.createDiv({ text: `Lab kit v${latest.manifest.version} is ready.` });
      const b = f.createEl("button", { text: "Review & update", cls: "lab-kit-notice-btn" });
      b.addEventListener("click", () => { notice.hide(); new KitUpdateModal(this.app, this, latest).open(); });
    });
    const notice = new Notice(frag, 0);
  }
}
