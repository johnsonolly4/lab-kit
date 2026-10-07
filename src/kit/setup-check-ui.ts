// Check setup window (Phase 6): reads the vault and Obsidian into a SetupState, lists checkSetup's items, and runs each Fix after a confirmation.
import { Modal, Notice, type App } from "obsidian";
import { PLANNING_LAYOUT, kitJoin, type KitData } from "./paths";
import type { KitManaged, SettingChange } from "./managed-ui";
import { ensureFolder } from "./ensure-folder";
import { addHotkey, addMetaBindButtons, addTemplaterFolderTemplate, commandNames, dataviewJsEnabled, enableDataviewJs, hasTemplaterHotkey, hotkeysInUse, hotkeysSupported,
  isCssSnippetEnabled, loadedPlugins, metaBindButtonIds, openPluginSettings, removeTemplaterStartup, setCssSnippets, setTemplaterFolderMode, templaterFolderTemplates,
  templaterMatchingMode, templaterStartupTemplates, templaterTemplatesFolder, templaterUserScriptsFolder } from "./obsidian-private";
import { PLANNING_BUTTONS } from "../planning/buttons";
import type { HeaderSettings } from "../header/settings";
import { checkSetup, hotkeyText, type SetupFix, type SetupItem, type SetupState } from "./setup-check";

/** What the check-setup window needs from the plugin. */
export interface SetupHost { kit: KitData; managed: KitManaged; planning: KitManaged | null; header: HeaderSettings; pluginId: string }

/** Planning folder templates (folder → template file name in the kit's templates folder), from the planning kit's Templater settings. */
const PLANNING_FOLDER_TEMPLATES = [
  { folder: "01 Daily Notes", file: "Daily note.md" },
  { folder: kitJoin(PLANNING_LAYOUT.planning, "To-dos"), file: "To-do.md" },
];

/** Reads the vault, Templater and Obsidian into the plain state checkSetup works on. */
export function readSetupState(app: App, host: SetupHost): SetupState {
  const lab = host.managed, planning = host.planning, planningOn = !!planning?.slot.enabled;
  const menu = kitJoin(lab.templatesFolder(), "Insert snippet.md");
  const menuFile = app.vault.getFileByPath(menu) ? menu : null;
  const css = [...(lab.bundle.manifest.enableCss ?? []), ...(planningOn ? planning?.bundle.manifest.enableCss ?? [] : [])]
    .map(name => ({ name: name.replace(/\.css$/, ""), enabled: isCssSnippetEnabled(app, name) }));
  const folders = [host.kit.labFolder, host.kit.chemicalFolder].filter(f => f);
  if (planningOn) folders.push(PLANNING_LAYOUT.planning, PLANNING_LAYOUT.projects, PLANNING_LAYOUT.meetings, ...PLANNING_FOLDER_TEMPLATES.map(f => f.folder));
  const names = commandNames(app);
  const mbIds = metaBindButtonIds(app);
  const guideId = "note-obsidian-set-up-zotlit-md";
  const guide = planning?.stateOf(guideId)?.path ?? null;
  return {
    lab: { initials: host.kit.initials, dataRoot: !!(host.header.dataRootWindows.trim() || host.header.dataRootMac.trim()), methodsFolder: host.kit.methodsFolder,
      labFolder: host.kit.labFolder, chemicalFolder: host.kit.chemicalFolder },
    dataviewJs: dataviewJsEnabled(app),
    metaBind: mbIds ? { missing: PLANNING_BUTTONS.filter(b => !mbIds.includes(b.id)).length, total: PLANNING_BUTTONS.length } : null,
    zotlitGuide: guide && app.vault.getFileByPath(guide) ? guide : null,
    plugins: loadedPlugins(app),
    planning: planningOn,
    templater: {
      templatesFolder: templaterTemplatesFolder(app) ?? "", userScriptsFolder: templaterUserScriptsFolder(app) ?? "",
      menuHotkey: menuFile ? hasTemplaterHotkey(app, menuFile) : true, folderTemplates: templaterFolderTemplates(app),
      matchingMode: templaterMatchingMode(app), startupTemplates: templaterStartupTemplates(app),
    },
    menu: menuFile,
    installed: { lab: !!lab.installedVersion, planning: !!planning?.installedVersion },
    css,
    folders: [...new Set(folders)].map(path => ({ path, exists: !!app.vault.getFolderByPath(path) })),
    folderTemplates: planning ? PLANNING_FOLDER_TEMPLATES.map(f => ({ folder: f.folder, template: kitJoin(planning.templatesFolder(), f.file) })) : [],
    // Templater names a template hotkey command `templater-obsidian:<template path>` (not checked against Templater's source)
    hotkeyCommands: { "Insert snippet": menuFile && names[`templater-obsidian:${menuFile}`] ? `templater-obsidian:${menuFile}` : null },
    hotkeys: hotkeysSupported(app) ? hotkeysInUse(app) : null,
    commandNames: names,
  };
}

/** Green / red list of what the kits need, each red item with a Fix button. Re-checks after every fix. */
export class SetupCheckModal extends Modal {
  constructor(app: App, private host: SetupHost) { super(app); }

  onOpen(): void { this.render(); }
  onClose(): void { this.contentEl.empty(); }

  private render(): void {
    const el = this.contentEl;
    el.empty();
    el.addClass("lab-kit-setup-check");
    this.setTitle("Check setup");
    const items = checkSetup(readSetupState(this.app, this.host));
    const missing = items.filter(i => !i.ok && !i.optional).length;
    el.createEl("p", { text: missing ? `${missing} to fix. Nothing changes until you press Fix and confirm.` : "Everything the kits need is in place." });
    let group = "";
    for (const it of items) {
      if (it.group !== group) { group = it.group; el.createEl("h4", { text: group }); }
      const row = el.createDiv({ cls: `lab-kit-setup-row ${it.ok ? "is-ok" : it.optional ? "is-optional" : "is-missing"}` });
      row.createSpan({ cls: "lab-kit-setup-mark", text: it.ok ? "✓" : it.optional ? "–" : "✗" });
      const text = row.createDiv({ cls: "lab-kit-setup-text" });
      text.createDiv({ text: it.label });
      text.createDiv({ cls: "setting-item-description", text: it.detail });
      const fix = it.fix;
      if (fix) row.createEl("button", { text: ["plugin", "settings", "open-note"].includes(fix.kind) ? "Open" : "Fix" }).addEventListener("click", () => void this.fix(it, fix));
    }
  }

  /** Runs one fix. Settings and folders go through the kit's confirmation dialog; plugin pages, kit install and Templater set up have their own. */
  private async fix(it: SetupItem, fix: SetupFix): Promise<void> {
    const lab = this.host.managed;
    const confirm = async (change: SettingChange): Promise<void> => {
      await lab.confirmThen({ title: `Fix: ${it.label}?`, yes: "Fix", ask: true, items: [], select: () => false, settings: [change], run: async () => {} });
    };
    switch (fix.kind) {
      case "settings": this.close(); if (!openPluginSettings(this.app, this.host.pluginId)) new Notice("Couldn't open the settings: open them from the gear icon."); return;
      case "open-note": this.close(); void this.app.workspace.openLinkText(fix.path, "", false); return;
      case "matching-mode": await confirm({ name: "Set Templater's matching mode to Folder templates", desc: "It is None now, so folder templates never run.", apply: () => setTemplaterFolderMode(this.app) }); break;
      case "startup-remove": await confirm({ name: "Remove the old roll-over from Templater's startup templates", desc: `${fix.template}. Lab Kit's to-do engine does the roll-over now. The file itself stays.`,
        apply: () => removeTemplaterStartup(this.app, fix.template) }); break;
      case "dataview-js": await confirm({ name: "Turn on Dataview's JavaScript queries", desc: "Projects overview uses a DataviewJS block.", apply: () => enableDataviewJs(this.app) }); break;
      case "meta-bind": await confirm({ name: "Add the planning buttons to Meta Bind", desc: "Only the ones missing (by id). Buttons you already have are never changed.",
        apply: () => addMetaBindButtons(this.app, PLANNING_BUTTONS) }); break;
      case "plugin": window.open(`obsidian://show-plugin?id=${encodeURIComponent(fix.id)}`); return;
      case "install": this.close(); (fix.kit === "planning" ? this.host.planning ?? lab : lab).review(); return;
      case "templater": this.close(); await lab.setupTemplater(); return;
      case "css": await confirm({ name: "Turn on the CSS snippet", desc: fix.names.join(", "), apply: () => setCssSnippets(this.app, fix.names, []) }); break;
      case "folder": await confirm({ name: "Create the folder", desc: fix.path, apply: () => ensureFolder(this.app.vault, fix.path) }); break;
      case "folder-template": await confirm({ name: "Add a Templater folder template", desc: `${fix.folder} → ${fix.template}. Folder templates only run with Templater's "Trigger Templater on new file creation" on (Templater keeps that per device: turn it on in its settings).`,
        apply: () => addTemplaterFolderTemplate(this.app, fix.folder, fix.template) }); break;
      case "hotkey": await confirm({ name: `Set ${hotkeyText(fix.key)}`, desc: `For ${it.label.split(":")[0]} (Settings → Hotkeys shows it afterwards).`,
        apply: async () => { if (!(await addHotkey(this.app, fix.command, fix.key))) new Notice("Couldn't set it here. Set it in the hotkeys settings."); } }); break;
    }
    this.render();
  }
}
