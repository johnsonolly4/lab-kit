// Kit settings tab and the controller that wires the built-in kit into the plugin (commands, startup notice, renames).
import { Notice, PluginSettingTab, TFile, normalizePath, type App, type Plugin, type SettingDefinitionItem, type SettingGroupItem } from "obsidian";
import { KIT_DEFAULTS, kitJoin, type KitData } from "./paths";
import type { HeaderStore } from "../header/settings";
import changelog from "../../docs/changelog.md";
import embedded from "lab-kit-embedded";
import { KitManaged } from "./managed-ui";
import { wideBox } from "./settings-box";
import { ensureFolder } from "./ensure-folder";
import { followRename } from "./managed";
import { WhatsNewModal, latestSection, sectionHeading } from "../whatsnew";

class KitSettingTab extends PluginSettingTab {
  constructor(app: App, plugin: Plugin, private ctl: KitController, private header: HeaderStore) { super(app, plugin); }

  /** Built-in icon of each snippet (from its `// icon:` line), read before the rows are drawn so no row changes after it is shown. */
  private builtInIcons = new Map<string, string>();

  private snippetFiles(): TFile[] {
    const folder = this.app.vault.getFolderByPath(normalizePath(`${this.ctl.managed.templatesFolder()}/Snippets`));
    return (folder?.children ?? []).filter((f): f is TFile => f instanceof TFile && f.extension === "md")
      .sort((a, b) => a.basename.localeCompare(b.basename, undefined, { numeric: true }));
  }

  /** Reads the built-in icon names, then redraws the tab. Call once the vault index is ready. */
  async refreshSnippets(): Promise<void> {
    for (const f of this.snippetFiles()) {
      const text = await this.app.vault.cachedRead(f);
      this.builtInIcons.set(f.path, text.match(/^\/\/\s*icon:\s*(.+)$/m)?.[1]?.trim() ?? "");
    }
    this.update();
  }

  /** One icon row per snippet in the Snippets folder next to the menu template (the name is what the Alt+S menu shows). */
  private snippetRows(): SettingGroupItem[] {
    const files = this.snippetFiles();
    const icons = this.ctl.kit.snippetIcons;
    if (!files.length) return [];
    const rows: SettingGroupItem[] = [{ name: "Icons", desc: "A Lucide icon name for each snippet, e.g. flask-round (see lucide.dev). Empty keeps the built-in icon. The colour is always your Obsidian accent colour." }];
    for (const f of files) {
      const name = f.basename.replace(/^\d+\s*[-.]?\s*/, "");
      rows.push({
        name,
        render: b => {
          b.addText(t => {
            wideBox(b, t);
            t.setPlaceholder(this.builtInIcons.get(f.path) ?? "").setValue(icons[name] ?? "").onChange(async v => {
              if (v.trim()) icons[name] = v.trim(); else delete icons[name];
              await this.ctl.save();
            });
          });
        }
      });
    }
    return rows;
  }

  /** The kit files built into the plugin: version, update buttons and the folders they go to. */
  private builtInRows(): SettingGroupItem[] {
    const kit = this.ctl.kit, managed = this.ctl.managed, roles = managed.roles();
    const inst = managed.installedVersion;
    const isHidden = (path: string): boolean => path.split("/").some(p => p.startsWith("."));
    const folder = (key: string, name: string, desc: string, noHidden = false): SettingGroupItem => ({
      name, desc,
      render: b => {
        b.addText(t => {
          wideBox(b, t, this.app);
          t.setPlaceholder(roles[key] ?? "").setValue(kit.paths[key] ?? "").onChange(async v => {
            const path = v.trim() ? normalizePath(v.trim()) : "";
            if (noHidden && isHidden(path)) return;                 // not saved, the blur check below says why
            if (path) kit.paths[key] = path; else delete kit.paths[key];
            await this.ctl.save();
          });
          if (noHidden) t.inputEl.addEventListener("blur", () => {
            if (isHidden(t.getValue().trim())) new Notice("Not saved: scripts can't live in a hidden folder (one starting with a dot).", 8000);
          });
        });
      }
    });
    const rows: SettingGroupItem[] = [];
    if (managed.updateAvailable()) rows.push({ name: "Update available", desc: `Kit v${inst} → v${managed.version}. Review it first, or update only the files you haven't changed.` });
    rows.push({
      name: "Kit version",
      desc: `Bundled v${managed.version} · ${inst ? `installed v${inst}, ${Object.keys(kit.managed?.files ?? {}).length} files tracked` : "not installed yet"}`,
      render: b => {
        b.addButton(btn => btn.setButtonText("Manage files…").onClick(() => managed.manage()))
          .addButton(btn => btn.setButtonText("Review update…").onClick(() => managed.review()))
          .addButton(btn => btn.setButtonText("Update all safe files").setCta().onClick(() => void managed.updateSafe()));
      }
    });
    rows.push({ name: "Templater", desc: "Points Templater's user scripts folder at the kit's scripts, fills in its template folder if empty (a folder you set is never changed) and adds Insert snippet to its template hotkeys. Run it after installing the kit. You still set the Alt+S key in Obsidian's hotkeys.",
      render: b => { b.addButton(btn => btn.setButtonText("Set up").onClick(() => void managed.setupTemplater())); } });
    rows.push({ name: "What's new", desc: "The changes in this version of Lab Kit.",
      render: b => { b.addButton(btn => btn.setButtonText("What's new").onClick(() => void this.ctl.showWhatsNew())); } });
    rows.push({ name: "Tell me when a kit update is ready", desc: "A notice when Obsidian starts, after the plugin brought a newer kit.",
      render: b => { b.addToggle(t => t.setValue(kit.notifyKitUpdate).onChange(async v => { kit.notifyKitUpdate = v; await this.ctl.save(); })); } });
    rows.push(folder("templates", "Templates folder", "Where the kit's templates go. Empty: where the kit's files already are; in a new vault Templater's template folder, or Templates."));
    rows.push(folder("scripts", "Scripts folder", "Where the kit's scripts go. Must not be a hidden (dot) folder. Empty: where the kit's files already are; in a new vault Templater's scripts folder, or scripts.", true));
    rows.push(folder("backups", "Backup folder", "Every file the update replaces is copied here first, in a folder named by date and time. Empty: inside Lab Kit's plugin folder, so it stays out of your file list."));
    rows.push({ name: "Snippets folder", desc: "Fixed by Obsidian.",
      render: b => { b.addText(t => { wideBox(b, t).setValue(kitJoin(this.app.vault.configDir, "snippets")).setDisabled(true); }); } });
    rows.push({ name: "Log kit actions to the console", desc: "For troubleshooting only.",
      render: b => { b.addToggle(t => t.setValue(kit.debug).onChange(async v => { kit.debug = v; await this.ctl.save(); })); } });
    return rows;
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const kit = this.ctl.kit;
    const notebook: SettingGroupItem[] = [
      { name: "Initials", desc: "Used in sample codes, for example ABC0014-A. Read by the Alt+S snippets.",
        render: b => { b.addText(t => wideBox(b, t).setValue(kit.initials).onChange(async v => { kit.initials = v.trim(); await this.ctl.save(); })); } },
      { name: "Chemical folder", desc: "The folder of your chemical notes. Typing [[ in a calc cell, and the reagent and solvent fields of the Alt+S forms, then suggest them by note name or by the names in their Names property. Empty: no suggestions.",
        render: b => {
          b.addText(t => {
            wideBox(b, t, this.app);
            t.setValue(kit.chemicalFolder).onChange(async v => { kit.chemicalFolder = v.trim() ? normalizePath(v.trim()) : ""; await this.ctl.save(); });
          });
        } },
      { name: "Molecular weight property", desc: "The property in a chemical note that holds its molecular weight, used by MW(). Empty: MW, Mr, Molecular weight and a few similar names are tried.",
        render: b => { b.addText(t => wideBox(b, t).setValue(kit.mwProperty).onChange(async v => { kit.mwProperty = v.trim(); await this.ctl.save(); })); } },
      { name: "Methods folder", desc: "The folder of your analysis method notes (one note per method, with its columns and machines). The Alt+S analysis snippets then offer them next to the built-in NMR, GPC and DLS. Empty: only the built-in methods. A folder that does not exist yet is created.",
        render: b => {
          b.addText(t => {
            wideBox(b, t, this.app);
            t.setValue(kit.methodsFolder).onChange(async v => { kit.methodsFolder = v.trim() ? normalizePath(v.trim()) : ""; await this.ctl.save(); });
            // once the box is left (not on every key): a folder that does not exist yet is created
            t.inputEl.addEventListener("change", () => {
              const path = kit.methodsFolder;
              if (path) void ensureFolder(this.app.vault, path).then(made => { if (made) new Notice(`Created the folder ${path}`); }).catch(() => new Notice(`Could not create the folder ${path}`));
            });
          });
        } }
    ];
    const snippets = this.snippetRows();
    const builtIn = this.builtInRows();
    return [
      { type: "group", heading: "Built-in kit", items: builtIn },
      { type: "group", heading: "Lab notebook", items: notebook },
      ...(snippets.length ? [{ type: "group" as const, heading: "Snippet menu", items: snippets }] : []),
      ...this.header.definitions()
    ];
  }
}

/** Owns the kit's saved state (the `kit` key of data.json) and registers its settings tab, commands and events. */
export class KitController {
  kit: KitData = { ...KIT_DEFAULTS };
  readonly managed: KitManaged;

  constructor(readonly plugin: Plugin, private header: HeaderStore) { this.managed = new KitManaged(plugin, this, embedded); }

  get app(): App { return this.plugin.app; }

  async load(): Promise<void> {
    const saved = (await this.plugin.loadData()) as { kit?: Partial<KitData> } | null;
    const old = (saved?.kit ?? {}) as Partial<KitData> & { source?: unknown; checkOnStartup?: unknown; makeBackups?: unknown };
    // Settings of the removed folder updater: "don't check at startup" carries over to the kit update notice
    if (old.checkOnStartup === false && old.notifyKitUpdate === undefined) old.notifyKitUpdate = false;
    delete old.source; delete old.checkOnStartup; delete old.makeBackups;
    this.kit = Object.assign({}, KIT_DEFAULTS, old);
    this.kit.snippetIcons = { ...this.kit.snippetIcons };
    this.kit.paths = { ...this.kit.paths };
    this.kit.off = { ...this.kit.off };
  }
  async save(): Promise<void> {
    const data = ((await this.plugin.loadData()) ?? {}) as Record<string, unknown>;
    data.kit = this.kit;
    await this.plugin.saveData(data);
  }

  setup(): void {
    const plugin = this.plugin;
    const tab = new KitSettingTab(this.app, plugin, this, this.header);
    plugin.addSettingTab(tab);
    // The snippet rows need the vault index, which is not ready yet when the tab is registered
    this.app.workspace.onLayoutReady(() => void tab.refreshSnippets());
    plugin.addCommand({ id: "kit-review", name: "Review kit files", callback: () => this.managed.review() });
    plugin.addCommand({ id: "kit-manage", name: "Manage kit files", callback: () => this.managed.manage() });
    plugin.addCommand({ id: "whats-new", name: "Show what's new", callback: () => this.showWhatsNew() });
    // First start after the plugin changed version: show what's new once
    this.app.workspace.onLayoutReady(() => {
      const section = latestSection(changelog);
      if (section && sectionHeading(section) !== this.kit.seenChangelog) window.setTimeout(() => void this.showWhatsNew(), 1500);
    });
    // Follow kit files the user moves or renames inside Obsidian
    plugin.registerEvent(this.app.vault.on("rename", async (file, oldPath) => {
      let changed = followRename(this.kit.managed, oldPath, file.path);
      const rec = this.kit.installed?.files;
      if (rec) {
        for (const p of Object.keys(rec)) {
          if (p === oldPath || p.startsWith(oldPath + "/")) { rec[file.path + p.slice(oldPath.length)] = rec[p]; delete rec[p]; changed = true; }
        }
        const roles = this.kit.installed!.roles ?? {};
        for (const [k, v] of Object.entries(roles)) if (v === oldPath || v.startsWith(oldPath + "/")) { roles[k] = file.path + v.slice(oldPath.length); changed = true; }
      }
      if (changed) await this.save();
    }));
    // The plugin brought a newer kit: say so once per start, with a button to the review window
    this.app.workspace.onLayoutReady(() => window.setTimeout(() => this.notifyUpdate(), 4000));
  }

  /** Opens the popup with the newest changelog section and remembers it was shown. */
  async showWhatsNew(): Promise<void> {
    const section = latestSection(changelog);
    if (!section) return;
    new WhatsNewModal(this.app, section).open();
    const heading = sectionHeading(section);
    if (this.kit.seenChangelog !== heading) { this.kit.seenChangelog = heading; await this.save(); }
  }

  /** Startup notice: the plugin brought a newer kit than the one installed. */
  notifyUpdate(): void {
    if (!this.kit.notifyKitUpdate || !this.managed.updateAvailable()) return;
    const frag = createFragment(f => {
      f.createDiv({ text: `Lab kit v${this.managed.version} is ready.` });
      const b = f.createEl("button", { text: "Review", cls: "lab-kit-notice-btn" });
      b.addEventListener("click", () => { notice.hide(); this.managed.review(); });
    });
    const notice = new Notice(frag, 0);
  }
}
