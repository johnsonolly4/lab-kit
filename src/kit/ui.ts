// Kit settings tab and the controller that wires the built-in kit into the plugin (commands, startup notice, renames).
import { Notice, PluginSettingTab, TFile, normalizePath, setIcon, getIcon, type App, type Plugin, type SettingDefinitionItem, type SettingGroupItem } from "obsidian";
import { KIT_DEFAULTS, LAB_KIT, CHEMICAL_TEMPLATE_ID, INSILICO_TEMPLATE_ID, LAB_TEMPLATE_ID, PLANNING_KIT, PLANNING_FOLDER_DEFAULTS, followFolderRename, kitJoin, kitLoad, newChemicalTarget, newLabEntryTarget, type KitData, type PlanningRole } from "./paths";
import { ask, pick } from "../planning/ask";
import { chemicalClasses } from "./snippet-env";
import { prop, toList } from "../frontmatter";
import { hasTemplater, openPluginSettings, templaterCreateNote } from "./obsidian-private";
import type { FolderGuardActions } from "./folder-guard";
import { MovedFoldersModal } from "./moved-folders-ui";
import type { HeaderStore } from "../header/settings";
import changelog from "../../docs/changelog.md";
import embedded from "lab-kit-embedded";
import { KitManaged } from "./managed-ui";
import { SetupCheckModal } from "./setup-check-ui";
import { HotkeyCheckModal } from "./hotkey-check-ui";
import { ClearBackupsModal } from "./backups-ui";
import { BOARD_STATUSES } from "./board-colours";
import { TidyNotesModal } from "./tidy-ui";
import { wideBox } from "./settings-box";
import { firstIcon, headerIcon } from "./icon-list";
import { IconPickerModal } from "./icon-picker-ui";
import { ensureFolder } from "./ensure-folder";
import { followRename } from "./managed";
import { WhatsNewModal, latestSection, sectionHeading } from "../whatsnew";

class KitSettingTab extends PluginSettingTab {
  constructor(app: App, plugin: Plugin, private ctl: KitController, private header: HeaderStore) {
    super(app, plugin);
    this.containerEl.addClass("lab-kit-settings");   // scopes the phone-width rules in styles.css to this tab
    ctl.redrawSettings = () => this.update();
  }

  /** Built-in icon of each snippet (from its `// icon:` line, or the `icon:` header of a token template), read before the rows are drawn so no row changes after it is shown. */
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
      this.builtInIcons.set(f.path, headerIcon(text));
    }
    this.update();
  }

  /** One icon row per snippet in the Snippets folder next to the menu template (the name is what the Alt+S menu shows). */
  private snippetRows(): SettingGroupItem[] {
    const files = this.snippetFiles();
    const icons = this.ctl.kit.snippetIcons;
    if (!files.length) return [];
    const rows: SettingGroupItem[] = [{ name: "Icons", desc: "Press Choose to pick an icon for each snippet from Obsidian's icons, or type a Lucide icon name, e.g. flask-round (see lucide.dev). Empty keeps the snippet's own icon, shown in grey. The colour is always your Obsidian accent colour." }];
    for (const f of files) {
      const name = f.basename.replace(/^\d+\s*[-.]?\s*/, "");
      rows.push({
        name,
        render: b => {
          const own = firstIcon(this.builtInIcons.get(f.path) ?? "", n => !!getIcon(n));
          const preview = b.controlEl.createSpan({ cls: "lab-kit-icon-preview" });
          const show = (typed: string): void => {
            preview.empty();
            const shown = [typed, own].map(n => n.trim()).find(n => n && getIcon(n));
            if (shown) setIcon(preview, shown);
            preview.toggleClass("is-default", !typed.trim());
          };
          show(icons[name] ?? "");
          b.addText(t => {
            wideBox(b, t);
            t.setPlaceholder(own).setValue(icons[name] ?? "").onChange(async v => {
              if (v.trim()) icons[name] = v.trim(); else delete icons[name];
              show(v);
              await this.ctl.save();
            });
            b.addButton(btn => btn.setButtonText("Choose…").onClick(() => new IconPickerModal(this.app, icons[name] ?? own, picked => {
              icons[name] = picked;
              t.setValue(picked);
              show(picked);
              void this.ctl.save();
            }).open()));
          });
        }
      });
    }
    return rows;
  }

  /** The kit files built into the plugin, as two groups: the update rows, then setup (Templater and the folders the kit's files go to). */
  private builtInGroups(): { updates: SettingGroupItem[]; setup: SettingGroupItem[] } {
    const kit = this.ctl.kit, managed = this.ctl.managed, slot = managed.slot, roles = managed.roles();
    const inst = managed.installedVersion;
    const isHidden = (path: string): boolean => path.split("/").some(p => p.startsWith("."));
    const folder = (key: string, name: string, desc: string, noHidden = false): SettingGroupItem => ({
      name, desc,
      render: b => {
        b.addText(t => {
          wideBox(b, t, this.app);
          t.setPlaceholder(roles[key] ?? "").setValue(slot.paths[key] ?? "").onChange(async v => {
            const path = v.trim() ? normalizePath(v.trim()) : "";
            if (noHidden && isHidden(path)) return;                 // not saved, the blur check below says why
            if (path) slot.paths[key] = path; else delete slot.paths[key];
            await this.ctl.save();
          });
          if (noHidden) t.inputEl.addEventListener("blur", () => {
            if (isHidden(t.getValue().trim())) new Notice("Not saved: scripts can't live in a hidden folder (one starting with a dot).", 8000);
          });
        });
      }
    });
    const updates: SettingGroupItem[] = [];
    if (managed.updateAvailable()) updates.push({ name: "Update available", desc: `Kit v${inst} → v${managed.version}. Review it first, or update only the files you haven't changed.` });
    const newer = [...this.ctl.newerKit.lab, ...this.ctl.newerKit.planning];
    if (newer.length) updates.push({ name: "Kept files with a newer kit version", desc: `${newer.length} ${newer.length === 1 ? "file" : "files"} you keep as your own (${newer.join(", ")}). Manage files has Compare… and Use kit version… on each.` });
    updates.push({
      name: "Kit version",
      desc: `Bundled v${managed.version} · ${inst ? `installed v${inst}, ${Object.keys(slot.managed?.files ?? {}).length} files tracked` : "not installed yet"}`,
      render: b => {
        b.addButton(btn => btn.setButtonText("Manage files…").onClick(() => managed.manage()))
          .addButton(btn => btn.setButtonText("Review update…").onClick(() => managed.review()))
          .addButton(btn => btn.setButtonText("Update all safe files").setCta().onClick(() => void managed.updateSafe()));
      }
    });
    const planning = this.ctl.planning;
    if (planning) {
      const pSlot = planning.slot, pInst = planning.installedVersion;
      updates.push({ name: "Planning kit (preview)", desc: "Homepage, to-do board, planning notes and templates, with their own commands. Switching it off removes nothing.",
        render: b => {
          b.addToggle(t => t.setValue(pSlot.enabled).onChange(async v => {
            pSlot.enabled = v;
            await this.ctl.save();
            new Notice(v ? "Planning kit on. Install its files with Review update…; its commands start once they are installed." : "Planning kit off. Reload Lab Kit to stop its commands; its files stay.", 10000);
            if (v) this.ctl.installed();
            this.update();
          }));
        } });
      if (pSlot.enabled) updates.push({
        name: "Planning kit files",
        desc: `Bundled v${planning.version} · ${pInst ? `installed v${pInst}, ${Object.keys(pSlot.managed?.files ?? {}).length} files tracked` : "not installed yet"}`,
        render: b => {
          b.addButton(btn => btn.setButtonText("Manage files…").onClick(() => planning.manage()))
            .addButton(btn => btn.setButtonText("Review update…").onClick(() => planning.review()))
            .addButton(btn => btn.setButtonText("Update all safe files").setCta().onClick(() => void planning.updateSafe()));
        }
      });
    }
    const setup: SettingGroupItem[] = [];
    setup.push({ name: "Check setup", desc: "Lists what the kits need (plugins, Templater and its folders and hotkey, CSS snippets, folders) and what is missing, with a Fix for each. Nothing changes until you confirm.",
      render: b => { b.addButton(btn => btn.setButtonText("Check setup…").onClick(() => this.ctl.checkSetup())); } });
    setup.push({ name: "Check hotkeys", desc: "Reports the keys the Hotkeys note recommends for the kit's functions and what Obsidian has now. Changes nothing: set keys in Obsidian's Hotkeys settings.",
      render: b => { b.addButton(btn => btn.setButtonText("Check hotkeys…").onClick(() => this.ctl.checkHotkeys())); } });
    updates.push({ name: "What's new", desc: "The changes in this version of Lab Kit.",
      render: b => { b.addButton(btn => btn.setButtonText("What's new").onClick(() => void this.ctl.showWhatsNew())); } });
    updates.push({ name: "Tell me when a kit update is ready", desc: "A notice when Obsidian starts, after the plugin brought a newer kit.",
      render: b => { b.addToggle(t => t.setValue(kit.notifyKitUpdate).onChange(async v => { kit.notifyKitUpdate = v; await this.ctl.save(); })); } });
    updates.push({ name: "Old backups", desc: "Every update copies the files it replaces into the backup folder and never removes them. Pick how old, then move those backups to the trash.",
      render: b => { b.addButton(btn => btn.setButtonText("Clear old backups…").onClick(() => new ClearBackupsModal(this.app, managed.roles().backups).open())); } });
    setup.push(folder("templates", "Templates folder", "Where the kit's templates go. Empty: where the kit's files already are; in a new vault Templater's template folder, or Templates."));
    setup.push(folder("scripts", "Scripts folder", "Where the kit's scripts go. Must not be a hidden (dot) folder. Empty: where the kit's files already are; in a new vault Templater's scripts folder, or scripts.", true));
    updates.push(folder("backups", "Backup folder", "Every file the update replaces is copied here first, in a folder named by date and time. Empty: inside Lab Kit's plugin folder, so it stays out of your file list."));
    setup.push({ name: "Snippets folder", desc: "Fixed by Obsidian.",
      render: b => { b.addText(t => { wideBox(b, t).setValue(kitJoin(this.app.vault.configDir, "snippets")).setDisabled(true); }); } });
    const bc = kit.boardColours;
    setup.push({ name: "Colour board columns", desc: "Colours the columns of kanban boards by status (Planned, Started, Processing results, Closed), so the Lab book board has them without the planning kit.",
      render: b => { b.addToggle(t => t.setValue(bc.enabled).onChange(async v => { bc.enabled = v; await this.ctl.save(); this.ctl.boardColoursChanged?.(); })); } });
    for (const [name, key, hex] of BOARD_STATUSES) {
      setup.push({ name: `Board colour: ${name}`, desc: "Pick another colour for this status.",
        render: b => {
          b.addColorPicker(c => c.setValue(bc.colours[key] ?? hex).onChange(async v => { bc.colours[key] = v; await this.ctl.save(); this.ctl.boardColoursChanged?.(); }));
          b.addExtraButton(x => x.setIcon("rotate-ccw").setTooltip("Back to the default").onClick(async () => { delete bc.colours[key]; await this.ctl.save(); this.ctl.boardColoursChanged?.(); this.update(); }));
        } });
    }
    setup.push({ name: "Log kit actions to the console", desc: "For troubleshooting only.",
      render: b => { b.addToggle(t => t.setValue(kit.debug).onChange(async v => { kit.debug = v; await this.ctl.save(); })); } });
    return { updates, setup };
  }

  /** One folder box per planning role. Empty = the default; a folder that doesn't exist is outlined (moved outside Obsidian?). */
  private planningFolderRows(): SettingGroupItem[] {
    const pf = this.ctl.kit.planningFolders;
    const rows: [PlanningRole, string, string][] = [
      ["inbox", "Inbox", "Quick capture puts notes here; Sort inbox empties it."],
      ["daily", "Daily notes", "Daily notes (Templater's folder template for this folder)."],
      ["planning", "Planning", "To-dos (in its To-dos folder), the to-do board, weekly review and shopping list."],
      ["projects", "Projects", "One folder per project, with its hub note."],
      ["literature", "Literature", "Literature notes from ZotLit."],
      ["knowledge", "Knowledge", "Concept notes, one folder per topic."],
      ["howtos", "How-tos", "How-to notes, one folder per topic."],
      ["meetings", "Meetings", "Meeting series and their notes."],
      ["archive", "Archive", "Old to-dos and archived inbox notes (made when first needed)."],
    ];
    const intro: SettingGroupItem = { name: "Where the planning kit's notes go", desc: "And what its lists read. Changing a folder here doesn't move notes: rename the folder in Obsidian and the setting follows. Moved it outside Obsidian? Use Find moved folders.",
      render: b => { b.addButton(btn => btn.setButtonText("Find moved folders…").onClick(() => this.ctl.findMovedFolders())); } };
    const countdown: SettingGroupItem = { name: "Due-date countdown", desc: "A badge on the to-do board card with the days left until its due property (for example 3d, Today, 2d late). Only to-dos with countdown: true shows it for the notes you pick; every to-do shows it for any note with a due date. Done cards show none.",
      render: b => {
        b.addDropdown(d => d.addOption("off", "Off").addOption("marked", "Only to-dos with countdown: true").addOption("all", "Every to-do with a due date")
          .setValue(this.ctl.kit.dueCountdown).onChange(async v => {
            this.ctl.kit.dueCountdown = v === "marked" || v === "all" ? v : "off";
            await this.ctl.save();
            this.ctl.dueCountdownChanged?.();
          }));
      } };
    const progress: SettingGroupItem = { name: "Checklist progress", desc: "Writes progress (for example 3/7: ticked check boxes out of all) into the properties of lab notes and the Shopping list as you tick, so a kanban card can show it. It edits those notes' properties. Off: nothing is written.",
      render: b => { b.addToggle(t => t.setValue(this.ctl.kit.checklistProgress).onChange(async v => { this.ctl.kit.checklistProgress = v; await this.ctl.save(); })); } };
    return [intro, countdown, progress, ...rows.map(([role, name, desc]): SettingGroupItem => ({ name, desc: `${desc} Empty: ${PLANNING_FOLDER_DEFAULTS[role]}.`,
      render: b => {
        b.addText(t => {
          wideBox(b, t, this.app);
          const mark = (): void => { t.inputEl.toggleClass("lab-kit-folder-missing", role !== "archive" && !this.app.vault.getFolderByPath(pf[role])); };
          t.setPlaceholder(PLANNING_FOLDER_DEFAULTS[role]).setValue(pf[role] === PLANNING_FOLDER_DEFAULTS[role] ? "" : pf[role]).onChange(async v => {
            pf[role] = v.trim() ? normalizePath(v.trim()) : PLANNING_FOLDER_DEFAULTS[role];
            mark();
            await this.ctl.save();
          });
          mark();
          // once the box is left (not on every key): the kit files get the new folder
          t.inputEl.addEventListener("change", () => void this.ctl.foldersChanged(false));
        });
      } }))];
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
      { name: "Only suggest chemicals of the asked class", desc: "A form field can ask for one Chemical class, for example solvent. On: it lists only chemicals whose Chemical class property has that class. Off: those chemicals come first, then all the others.",
        render: b => { b.addToggle(t => t.setValue(kit.chemClassOnly).onChange(async v => { kit.chemClassOnly = v; await this.ctl.save(); })); } },
      { name: "Lab notes folder", desc: "The folder of your experiment notes. New lab entry creates notes here, and the kit's Lab book base (a board of your experiments by Status) goes in the folder above it. Empty: neither is used.",
        render: b => {
          b.addText(t => {
            wideBox(b, t, this.app);
            t.setValue(kit.labFolder).onChange(async v => { kit.labFolder = v.trim() ? normalizePath(v.trim()) : ""; await this.ctl.save(); });
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
    notebook.push({ name: "In-silico experiments", desc: "For computational work. On: the kit installs the In-silico Lab Book Template (press Review update afterwards) and the command New in-silico entry makes a numbered lab note with Environment, Inputs, Method and Runs sections. Off: neither is offered.",
      render: b => { b.addToggle(t => t.setValue(kit.inSilico).onChange(async v => { kit.inSilico = v; await this.ctl.save(); })); } });
    const snippets = this.snippetRows();
    const builtIn = this.builtInGroups();
    const planningOn = !!kit.kits[PLANNING_KIT]?.enabled;
    return [
      { type: "group", heading: "Built-in kit", items: builtIn.updates },
      { type: "group", heading: "Kit folders and setup", items: builtIn.setup },
      { type: "group", heading: "Lab notebook", items: notebook },
      ...(planningOn ? [{ type: "group" as const, heading: "Planning folders", items: this.planningFolderRows() }] : []),
      ...(snippets.length ? [{ type: "group" as const, heading: "Snippet menu", items: [{ type: "page" as const, name: "Snippet icons", items: snippets }] }] : []),
      ...this.header.definitions()
    ];
  }
}

/** Owns the kit's saved state (the `kit` key of data.json) and registers its settings tab, commands and events. */
/** A kind of lab entry: the kit template it is made from (file id and name) and its command's name, for the messages. */
interface LabEntryKind { id: string; template: string; command: string }
const LAB_ENTRY: LabEntryKind = { id: LAB_TEMPLATE_ID, template: "Lab Book Template", command: "New lab entry" };
const IN_SILICO: LabEntryKind = { id: INSILICO_TEMPLATE_ID, template: "In-silico Lab Book Template", command: "New in-silico entry" };

export class KitController {
  kit: KitData = { ...KIT_DEFAULTS };
  readonly managed: KitManaged;
  /** Set by the plugin: runs after a kit's files were written. */
  onInstalled: (() => void) | null = null;
  installed(): void { this.onInstalled?.(); }
  /** The planning kit (switched off until the user turns it on in settings); null if main.js has none. */
  readonly planning: KitManaged | null;

  constructor(readonly plugin: Plugin, private header: HeaderStore) {
    const lab = embedded.kits.find(k => k.manifest.id === LAB_KIT);
    if (!lab) throw new Error("Lab Kit: the lab kit is missing from main.js");
    this.managed = new KitManaged(plugin, this, lab);
    const planning = embedded.kits.find(k => k.manifest.id === PLANNING_KIT);
    this.planning = planning ? new KitManaged(plugin, this, planning) : null;
  }

  get app(): App { return this.plugin.app; }

  /** What the "folder not found" notice's buttons do. */
  readonly folderGuard: FolderGuardActions = {
    openSettings: () => { openPluginSettings(this.app, this.plugin.manifest.id); },
    findMoved: () => this.findMovedFolders(),
  };
  findMovedFolders(): void { new MovedFoldersModal(this.app, this).open(); }

  /** Set by the plugin when the to-do engine runs: redraws the board's countdown badges. */
  dueCountdownChanged: (() => void) | null = null;
  boardColoursChanged: (() => void) | null = null;

  /** Set by the settings tab: redraws it (after settings changed on disk). */
  redrawSettings: (() => void) | null = null;

  async load(): Promise<void> {
    const saved = (await this.plugin.loadData()) as { kit?: unknown } | null;
    this.kit = kitLoad(saved?.kit);   // a v0.5.2 single-kit state moves into kits.lab
  }
  async save(): Promise<void> {
    const data = ((await this.plugin.loadData()) ?? {}) as Record<string, unknown>;
    data.kit = this.kit;
    await this.plugin.saveData(data);
    this.onChanged?.();
  }
  /** Set by the plugin: runs after the settings were saved or reloaded (open blocks redraw). */
  onChanged: (() => void) | null = null;

  setup(): void {
    const plugin = this.plugin;
    const tab = new KitSettingTab(this.app, plugin, this, this.header);
    plugin.addSettingTab(tab);
    // The snippet rows need the vault index, which is not ready yet when the tab is registered
    this.app.workspace.onLayoutReady(() => void tab.refreshSnippets());
    plugin.addCommand({ id: "kit-review", name: "Review kit files", callback: () => this.managed.review() });
    plugin.addCommand({ id: "kit-manage", name: "Manage kit files", callback: () => this.managed.manage() });
    plugin.addCommand({ id: "whats-new", name: "Show what's new", callback: () => this.showWhatsNew() });
    plugin.addCommand({ id: "check-setup", name: "Check setup", callback: () => this.checkSetup() });
    plugin.addCommand({ id: "check-hotkeys", name: "Check hotkeys", callback: () => this.checkHotkeys() });
    plugin.addCommand({ id: "new-lab-entry", name: "New lab entry", callback: () => void this.newLabEntry() });
    plugin.addCommand({ id: "new-chemical", name: "New chemical", callback: () => void this.newChemical() });
    // Offered only while Settings → Lab notebook → In-silico experiments is on
    plugin.addCommand({ id: "new-in-silico-entry", name: "New in-silico entry", checkCallback: (checking) => {
      if (!this.kit.inSilico) return false;
      if (!checking) void this.newLabEntry(IN_SILICO);
      return true;
    } });
    plugin.addCommand({ id: "find-moved-folders", name: "Find moved folders", callback: () => this.findMovedFolders() });
    plugin.addCommand({ id: "tidy-notes", name: "Tidy up notes", callback: () => this.tidyNotes() });
    // First start after the plugin changed version: show what's new once
    this.app.workspace.onLayoutReady(() => {
      const section = latestSection(changelog);
      if (section && sectionHeading(section) !== this.kit.seenChangelog) window.setTimeout(() => void this.showWhatsNew(), 1500);
    });
    // Follow kit files the user moves or renames inside Obsidian
    plugin.registerEvent(this.app.vault.on("rename", async (file, oldPath) => {
      let changed = false, foldersMoved = false;
      for (const slot of Object.values(this.kit.kits)) changed = followRename(slot.managed, oldPath, file.path) || changed;
      // Folder settings follow a folder renamed or moved inside Obsidian (moved outside it: Find moved folders)
      const pf = this.kit.planningFolders;
      for (const role of Object.keys(pf) as PlanningRole[]) {
        const to = followFolderRename(pf[role], oldPath, file.path);
        if (to) { pf[role] = to; changed = foldersMoved = true; }
      }
      for (const key of ["labFolder", "chemicalFolder", "methodsFolder"] as const) {
        const to = this.kit[key] ? followFolderRename(this.kit[key], oldPath, file.path) : null;
        if (to) { this.kit[key] = to; changed = foldersMoved = true; }
      }
      const rec = this.kit.installed?.files;
      if (rec) {
        for (const p of Object.keys(rec)) {
          if (p === oldPath || p.startsWith(oldPath + "/")) { rec[file.path + p.slice(oldPath.length)] = rec[p]; delete rec[p]; changed = true; }
        }
        const roles = this.kit.installed!.roles ?? {};
        for (const [k, v] of Object.entries(roles)) if (v === oldPath || v.startsWith(oldPath + "/")) { roles[k] = file.path + v.slice(oldPath.length); changed = true; }
      }
      if (changed) await this.save();
      if (foldersMoved) await this.foldersChanged();
    }));
    // The plugin brought a newer kit: say so once per start, with a button to the review window
    this.app.workspace.onLayoutReady(() => window.setTimeout(() => void this.notifyUpdate(), 4000));
  }

  /**
   * A folder setting changed (renamed in Obsidian, picked in Find moved folders, or typed in a Planning folders box): the installed kit files
   * you have not edited get the new folder names, and the settings tab shows the new values. Edited files are named in a notice.
   */
  async foldersChanged(redraw = true): Promise<void> {
    if (redraw) this.redrawSettings?.();
    try {
      const rewritten: string[] = [], kept: string[] = [], skipped: string[] = [], patchable: string[] = [], patches: (() => Promise<void>)[] = [];
      for (const kit of [this.managed, this.planning]) {
        if (!kit) continue;
        const r = await kit.reapplyFolders();
        rewritten.push(...r.rewritten); kept.push(...r.kept); skipped.push(...r.skipped); patchable.push(...r.patchable); patches.push(r.patch);
      }
      if (rewritten.length) new Notice(`Updated ${rewritten.length} kit file${rewritten.length === 1 ? "" : "s"} to the new folders. The old copies are in the backup folder.`, 8000);
      if (kept.length) new Notice(`Your edits were kept, so these still use the old folders: ${kept.join(", ")}. Restore kit original in Manage files writes the new ones.`, 12000);
      if (skipped.length) new Notice(`These come from another kit version, so they still use the old folders: ${skipped.join(", ")}. Update all safe files in Manage files first.`, 12000);
      if (patchable.length) {
        // A board you edited, or that Obsidian re-saved, keeps its old folder filter: offer to change only that line
        const frag = createFragment(f => {
          f.createDiv({ text: `These boards still look in the old folder, so they show nothing: ${patchable.join(", ")}.` });
          const b = f.createEl("button", { text: "Patch folder only", cls: "lab-kit-notice-btn" });
          b.addEventListener("click", () => {
            notice.hide();
            void Promise.all(patches.map(run => run())).then(() => new Notice("Changed the folder in the board filters. The old copies are in the backup folder.", 8000), e => { console.error(e); new Notice("Could not patch the boards. See the developer console for details."); });
          });
        });
        const notice = new Notice(frag, 0);
      }
    } catch (e) { console.error(e); new Notice("Could not update the kit files to the new folders. See the developer console for details."); }
  }

  /** New lab entry: a note from the Lab Book Template in the Lab notes folder (created if missing), made and opened by Templater. */
  async newLabEntry(kind: LabEntryKind = LAB_ENTRY): Promise<void> {
    const tracked = this.managed.stateOf(kind.id)?.path;
    const template = [tracked, kitJoin(this.managed.templatesFolder(), `${kind.template}.md`)]
      .map(p => (p ? this.app.vault.getFileByPath(p) : null)).find(f => f) ?? null;
    const target = newLabEntryTarget({ templater: hasTemplater(this.app), template: template?.path ?? null, labFolder: this.kit.labFolder, initials: this.kit.initials, command: kind.command, templateName: kind.template });
    if ("error" in target) { new Notice(target.error); return; }
    const title = await ask(this.app, "Experiment title (Esc to cancel, Enter on empty = Untitled)");
    if (title === null) return;
    const w = window as unknown as { labKitPresetTitle?: string };
    try {
      await ensureFolder(this.app.vault, target.folder);
      const folder = this.app.vault.getFolderByPath(target.folder);
      if (!template || !folder) { new Notice(`Could not use the folder ${target.folder}.`); return; }
      w.labKitPresetTitle = title;   // the template reads and clears it (as the to-do template does for projects)
      if (!(await templaterCreateNote(this.app, template, folder))) new Notice("Templater couldn't create the note. Update it to the latest version, then try again.");
    } catch (e) { console.error(e); new Notice(`${kind.command} failed. See the developer console for details.`); }
    finally { delete w.labKitPresetTitle; }
  }

  /** New chemical: a note from the Chemical database template in the Chemical folder (created if missing), made and opened by Templater. */
  async newChemical(): Promise<void> {
    const tracked = this.managed.stateOf(CHEMICAL_TEMPLATE_ID)?.path;
    const template = [tracked, kitJoin(this.managed.templatesFolder(), "Chemical database template.md")]
      .map(p => (p ? this.app.vault.getFileByPath(p) : null)).find(f => f) ?? null;
    const target = newChemicalTarget({ templater: hasTemplater(this.app), template: template?.path ?? null, chemicalFolder: this.kit.chemicalFolder });
    if ("error" in target) { new Notice(target.error); return; }
    try {
      await ensureFolder(this.app.vault, target.folder);
      const folder = this.app.vault.getFolderByPath(target.folder);
      if (!template || !folder) { new Notice(`Could not use the folder ${target.folder}.`); return; }
      const typed = await ask(this.app, "Chemical name (Esc cancels)");
      const name = typed?.replace(/[\\/:*?"<>|#^[\]]/g, "-").trim();
      if (!name) return;   // Esc or empty cancels
      if (this.app.vault.getAbstractFileByPath(`${target.folder}/${name}.md`)) { new Notice(`${target.folder}/${name}.md already exists.`); return; }
      const cls = await this.askChemicalClass(target.folder);
      if (cls === null) return;   // Esc cancels
      if (!(await templaterCreateNote(this.app, template, folder, true, name))) { new Notice("Templater couldn't create the note. Update it to the latest version, then try again."); return; }
      if (cls) await this.setChemicalClass(target.folder, cls);
    } catch (e) { console.error(e); new Notice("New chemical failed. See the developer console for details."); }
  }

  /** Pick a Chemical class from the ones the existing chemical notes use, type another, or skip it. The class text ("" = skip), or null when Esc was pressed. */
  private async askChemicalClass(folder: string): Promise<string | null> {
    const used = chemicalClasses(this.app.vault.getMarkdownFiles().filter(f => f.path.startsWith(folder + "/"))
      .map(f => toList(prop(this.app.metadataCache.getFileCache(f)?.frontmatter, "Chemical class"))));
    // Typing a class that is not in the list and pressing Enter uses it as the new class
    return pick<string>(this.app, [...used, "No class (fill in later)"], [...used, ""], "Chemical class: pick one or type a new one (Esc cancels)", false, { prefix: "+ New class: ", make: text => text });
  }

  /** Makes "Chemical class" a list property, so the Properties pane offers the classes already in use. Private API, kept in this one function; an older Obsidian keeps it as text. */
  private async makeClassAList(): Promise<void> {
    const types = (this.app as unknown as { metadataTypeManager?: { getAssignedType?: (p: string) => string | null; setType?: (p: string, t: string) => Promise<void> } }).metadataTypeManager;
    try { if (types?.getAssignedType?.("Chemical class") !== "multitext") await types?.setType?.("Chemical class", "multitext"); } catch (e) { console.error(e); }
  }

  /** Writes the class into the note Templater just made and opened (only if it is in the Chemical folder and has no class yet). */
  private async setChemicalClass(folder: string, cls: string): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md" || !file.path.startsWith(folder + "/")) return;
    await this.makeClassAList();
    await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => { if (!toList(prop(fm, "Chemical class")).length) fm["Chemical class"] = [cls]; });
  }

  /** Opens the Check setup window. */
  tidyNotes(): void { new TidyNotesModal(this.app, { kit: this.kit, managed: this.managed, planning: this.planning }).open(); }
  checkHotkeys(): void { new HotkeyCheckModal(this.app, this.planning?.slot.enabled === true).open(); }
  checkSetup(): void { new SetupCheckModal(this.app, { kit: this.kit, managed: this.managed, planning: this.planning, header: this.header.settings, pluginId: this.plugin.manifest.id, save: () => this.save(), findMoved: () => this.findMovedFolders() }).open(); }

  /** Opens the popup with the newest changelog section and remembers it was shown. */
  async showWhatsNew(): Promise<void> {
    const section = latestSection(changelog);
    if (!section) return;
    new WhatsNewModal(this.app, section).open();
    const heading = sectionHeading(section);
    if (this.kit.seenChangelog !== heading) { this.kit.seenChangelog = heading; await this.save(); }
  }

  /** Kit files you keep as your own that the kit has a newer text for, counted at start-up per kit (the settings tab shows them). */
  newerKit: { lab: string[]; planning: string[] } = { lab: [], planning: [] };

  /** Startup notice: the plugin brought a newer kit than the one installed, or kept files have a newer kit version. It closes by itself after 15 seconds. */
  async notifyUpdate(): Promise<void> {
    try {
      const planning = this.planning?.slot.enabled ? await this.planning.newerKitFiles() : [];
      this.newerKit = { lab: await this.managed.newerKitFiles(), planning };
    } catch (e) { console.error(e); }
    if (!this.kit.notifyKitUpdate) return;
    const version = this.managed.updateAvailable();
    const { lab, planning } = this.newerKit;
    if (!version && !lab.length && !planning.length) return;
    const frag = createFragment(f => {
      if (version) {
        f.createDiv({ text: `Lab kit v${this.managed.version} is ready.` });
        const b = f.createEl("button", { text: "Review", cls: "lab-kit-notice-btn" });
        b.addEventListener("click", () => { notice.hide(); this.managed.review(); });
        return;
      }
      for (const [name, files, kit] of [["lab kit", lab, this.managed], ["planning kit", planning, this.planning]] as const) {
        if (!files.length || !kit) continue;
        f.createDiv({ text: `${files.length} kept ${name} ${files.length === 1 ? "file has" : "files have"} a newer version than your copy.` });
        const b = f.createEl("button", { text: `Manage ${name} files`, cls: "lab-kit-notice-btn" });
        b.addEventListener("click", () => { notice.hide(); kit.manage(); });
      }
    });
    const notice = new Notice(frag, 15000);
  }
}
