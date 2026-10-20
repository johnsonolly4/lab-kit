// Check setup window (Phase 6): reads the vault and Obsidian into a SetupState, lists checkSetup's items, and runs each Fix after a confirmation.
import { Modal, Notice, Platform, type App, type EventRef } from "obsidian";
import { kitJoin, type KitData, type PlanningRole } from "./paths";
import type { ClosingModal, KitManaged, SettingChange } from "./managed-ui";
import { ensureFolder } from "./ensure-folder";
import { addMetaBindButtons, metaBindButtons, resetMetaBindActions, hidePropertiesInDocument, alwaysUpdateLinks, setAlwaysUpdateLinks, navigatorHomepage, setNavigatorHomepage, propertiesInDocument, addTemplaterFolderTemplate,
  isCssSnippetEnabled, loadedPlugins, metaBindButtonIds, openPluginSettings, removeTemplaterStartup, setCssSnippets, setTemplaterFolderMode, templaterFolderTemplates,
  templaterMatchingMode, templaterStartupTemplates, templaterTemplatesFolder, templaterUserScriptsFolder, readZotlitData, writeZotlitData,
  corePluginsOn, dailyNotesOptions, dataviewInlineQueries, propertyTypes, setPropertyType } from "./obsidian-private";
import { zotlitApply, zotlitScan, type ZotlitScan } from "./zotlit";
import { deckPath } from "../planning/actions";
import { PLANNING_BUTTONS } from "../planning/buttons";
import { inFolder } from "../planning/lists";
import { parseSeries } from "../planning/meetings";
import type { HeaderSettings } from "../header/settings";
import { hasNode } from "../platform";
import { closeHostFor, scanLabNotes } from "../close/ui";
import { closeExperiment, makeClosedPdf } from "../close/commands";
import type { ClosedScan } from "../close/scan";
import { cardWindow, winFoot, winIntro, winRow, winSummary } from "./window-look";
import { CORE_PLUGINS, PROPERTY_TYPES, checkSetup, differingButtons, orderSetupItems, setupRowState, setupSummary, labFolderTemplates, planningFolderTemplates, type SetupFix, type SetupItem, type SetupState } from "./setup-check";

/** What the check-setup window needs from the plugin. */
export interface SetupHost { kit: KitData; managed: KitManaged; planning: KitManaged | null; header: HeaderSettings; pluginId: string; save(): Promise<void>; findMoved(): ClosingModal | void; /** Review update… and Manage files…: one window for both kits when the planning kit is on. */ review(): ClosingModal; manage(): ClosingModal }

/** Reads the vault, Templater and Obsidian into the plain state checkSetup works on. */
export function readSetupState(app: App, host: SetupHost): SetupState {
  const lab = host.managed, planning = host.planning, planningOn = !!planning?.slot.enabled;
  const menu = kitJoin(lab.templatesFolder(), "Insert snippet.md");
  const menuFile = app.vault.getFileByPath(menu) ? menu : null;
  const css = [...(lab.bundle.manifest.enableCss ?? []), ...(planningOn ? planning?.bundle.manifest.enableCss ?? [] : [])]
    .map(name => ({ name: name.replace(/\.css$/, ""), enabled: isCssSnippetEnabled(app, name) }));
  const pf = host.kit.planningFolders, folderTemplates = planningFolderTemplates(pf);
  const zotlit = loadedPlugins(app).has("zotlit");
  // Folders named in a setting; the archive is made when first needed, Literature only with ZotLit
  const settingFolders = [host.kit.labFolder, host.kit.chemicalFolder,
    ...(planningOn ? (Object.keys(pf) as PlanningRole[]).filter(r => r !== "archive" && (r !== "literature" || zotlit)).map(r => pf[r]) : [])].filter(f => f);
  const labTemplates = labFolderTemplates(host.kit.labFolder, host.kit.chemicalFolder);
  const folders = [...settingFolders, ...(planningOn ? folderTemplates.map(f => f.folder) : [])];
  const meetings = !planningOn ? [] : app.vault.getMarkdownFiles().filter(f => inFolder(f.path, pf.meetings)).flatMap(f => {
    const cache = app.metadataCache.getFileCache(f), fm = cache?.frontmatter ?? {};
    if (fm.kind !== "meeting-series") return [];
    const read = parseSeries({ path: f.path, name: f.basename, folder: f.parent?.path ?? "", fm, ctime: f.stat.ctime, mtime: f.stat.mtime });
    return [{ name: f.basename, path: f.path, error: "error" in read ? read.error : undefined, deck: !!deckPath(fm, Platform.isMacOS) }];
  }).sort((a, b) => a.name.localeCompare(b.name));
  const mbIds = metaBindButtonIds(app);
  const scripts = [lab, ...(planningOn && planning ? [planning] : [])].flatMap(k => k.bundle.manifest.files.filter(f => f.role === "userScripts" && !f.optional).map(f => {
    const path = k.stateOf(f.id)?.path;
    return { name: f.dest.split("/").pop()!.replace(/\.js$/, ""), kit: k.bundle.manifest.id as "lab" | "planning", exists: !!path && !!app.vault.getFileByPath(path) };
  }));
  const homePath = planning?.stateOf("note-00-home-md")?.path ?? "00 Home.md";
  const homeFile = app.vault.getFileByPath(homePath);
  const homepageMode = homeFile ? String(app.metadataCache.getFileCache(homeFile)?.frontmatter?.obsidianUIMode ?? "") : null;
  const guideId = "note-obsidian-set-up-zotlit-md";
  const guide = planning?.stateOf(guideId)?.path ?? null;
  return {
    lab: { initials: host.kit.initials, dataRoot: !!(host.header.dataRootWindows.trim() || host.header.dataRootMac.trim()), methodsFolder: host.kit.methodsFolder, rigsFolder: host.kit.rigsFolder, rigsFolderMissing: !!host.kit.rigsFolder && !app.vault.getFolderByPath(host.kit.rigsFolder),
      labFolder: host.kit.labFolder, chemicalFolder: host.kit.chemicalFolder },
    scripts, homepageMode,
    metaBindDiffers: mbIds ? differingButtons(PLANNING_BUTTONS, metaBindButtons(app) ?? []) : undefined,
    metaBind: mbIds ? { missing: PLANNING_BUTTONS.filter(b => !mbIds.includes(b.id)).length, total: PLANNING_BUTTONS.length, names: PLANNING_BUTTONS.filter(b => !mbIds.includes(b.id)).map(b => b.id) } : null,
    zotlitGuide: guide && app.vault.getFileByPath(guide) ? guide : null,
    propertiesView: propertiesInDocument(app),
    updateLinks: alwaysUpdateLinks(app),
    corePlugins: corePluginsOn(app, CORE_PLUGINS.map(c => c.id)),
    dailyNotes: planningOn ? (d => d ? { ...d, want: pf.daily } : null)(dailyNotesOptions(app)) : undefined,
    dataviewInline: planningOn ? dataviewInlineQueries(app) : undefined,
    navigator: { homepage: navigatorHomepage(app), home: planning?.stateOf("note-00-home-md")?.path ?? "00 Home.md" },
    plugins: loadedPlugins(app),
    planning: planningOn,
    templater: {
      templatesFolder: templaterTemplatesFolder(app) ?? "", userScriptsFolder: templaterUserScriptsFolder(app) ?? "",
      folderTemplates: templaterFolderTemplates(app),
      matchingMode: templaterMatchingMode(app), startupTemplates: templaterStartupTemplates(app),
    },
    menu: menuFile,
    installed: { lab: !!lab.installedVersion, planning: !!planning?.installedVersion },
    css,
    folders: [...new Set(folders)].map(path => ({ path, exists: !!app.vault.getFolderByPath(path), setting: settingFolders.includes(path) })),
    meetings,
    folderTemplates: [
      ...labTemplates.map(f => ({ folder: f.folder, template: kitJoin(lab.templatesFolder(), f.file), kit: "lab" as const })),
      ...(planning ? folderTemplates.map(f => ({ folder: f.folder, template: kitJoin(planning.templatesFolder(), f.file) })) : []),
    ],
  };
}

/** Green / red list of what the kits need, each red item with a Fix button. Re-checks after every fix. */
export class SetupCheckModal extends Modal {
  constructor(app: App, private host: SetupHost) { super(app); }

  private newerKit: string[] | undefined;
  private kitFiles: SetupState["kitFiles"];
  private types: SetupState["propertyTypes"];
  private zotlit: ZotlitScan | null = null;
  private closed: ClosedScan | undefined;
  /** Notes Close / Make PDF is writing: Obsidian updates its copy of their properties a moment after the write, so the list redraws when it has. */
  private writing = new Set<string>();
  private changed: EventRef | null = null;

  onOpen(): void {
    this.changed = this.app.metadataCache.on("changed", f => { if (this.writing.delete(f.path) && !this.writing.size) void this.refresh(); });
    this.render();
    void this.refresh();
  }

  /** Reads again what needs files read (kept files, kit files, ZotLit's settings), then redraws. */
  private async refresh(): Promise<void> {
    await Promise.all([this.countNewer(), this.countKitFiles(), this.loadZotlit(), this.loadClosed(),
      (async () => { this.types = this.host.planning?.slot.enabled ? await propertyTypes(this.app, PROPERTY_TYPES.map(p => p.name)) : undefined; })()]);
    if (this.contentEl.isConnected) this.render();
  }

  /** A window opened from here (Review update…, Manage files…, Find moved folders) sits on top; this list redraws when it closes. */
  private after(opened: ClosingModal | void): void {
    if (!opened) return;
    opened.onClosed = () => void this.refresh();
  }

  /** Per installed kit: the files with an update waiting, missing or in conflict (from the same plan Review update… shows). */
  private async countKitFiles(): Promise<void> {
    try {
      const kits: ["lab" | "planning", KitManaged][] = [["lab", this.host.managed], ...(this.host.planning?.slot.enabled ? [["planning", this.host.planning] as ["planning", KitManaged]] : [])];
      this.kitFiles = await Promise.all(kits.filter(([, k]) => !!k.installedVersion).map(async ([kit, k]) => {
        const items = await k.plan(), names = (...actions: string[]): string[] => items.filter(i => actions.includes(i.action)).map(i => i.dest.slice(i.dest.lastIndexOf("/") + 1));
        return { kit, update: names("create", "fast-forward", "merge"), missing: names("missing"), conflict: names("needs-merge") };
      }));
    } catch (e) { console.error(e); }
  }

  /** The lab notes closed with Close experiment, sorted into the cases the rows report (reads each closed note to compare its hash). */
  private async loadClosed(): Promise<void> {
    try { this.closed = await scanLabNotes(this.app, this.host.kit); } catch (e) { console.error(e); }
  }

  /** The folders the kit's Set up ZotLit checklist names, from the planning folders setting and the templates folder. */
  private zotlitWanted(): { literature: string; templates: string } {
    return { literature: kitJoin(this.host.kit.planningFolders.literature, "ZotLit Imports"), templates: kitJoin(this.host.planning?.templatesFolder() ?? "", "ZotLit") };
  }

  /** ZotLit's settings file read and compared with the kit's fields (only when the planning kit is on and ZotLit is loaded). */
  private async loadZotlit(): Promise<void> {
    this.zotlit = null;
    if (!this.host.planning?.slot.enabled || !loadedPlugins(this.app).has("zotlit")) return;
    const data = await readZotlitData(this.app);
    if (data && data !== "unreadable") this.zotlit = zotlitScan(data, this.zotlitWanted());
  }

  /** The count needs the files read, so the list shows first and the row appears when it is ready. */
  private async countNewer(): Promise<void> {
    try {
      const kits = [this.host.managed, ...(this.host.planning?.slot.enabled ? [this.host.planning] : [])];
      this.newerKit = (await Promise.all(kits.map(k => k.newerKitFiles()))).flat();
    } catch (e) { console.error(e); }
  }
  onClose(): void { if (this.changed) this.app.metadataCache.offref(this.changed); this.contentEl.empty(); }

  private render(): void {
    const el = this.contentEl;
    el.empty();
    el.addClass("lab-kit-win");
    cardWindow(this);
    this.setTitle("Check setup");
    const items = checkSetup({ ...readSetupState(this.app, this.host), newerKit: this.newerKit, kitFiles: this.kitFiles, propertyTypes: this.types, zotlitData: this.zotlit, closed: this.closed && { ...this.closed, canPdf: hasNode() } });
    winIntro(el, "What the kits need, and whether it is there. Nothing changes until you press a button and confirm; the list checks again after each one.");
    winSummary(el, setupSummary(items));
    for (const it of orderSetupItems(items)) {
      const { row } = winRow(el, { state: setupRowState(it), title: it.label, detail: it.detail, group: it.group });
      const fix = it.fix;
      if (fix) row.createEl("button", { text: ["plugin", "settings", "open-note", "manage"].includes(fix.kind) ? "Open" : fix.kind === "find-moved" ? "Find" : fix.kind === "close-notes" ? "Close" : fix.kind === "make-pdfs" ? "Make PDF" : "Fix" }).addEventListener("click", () => void this.fix(it, fix));
    }
    const foot = winFoot(el);
    foot.createEl("button", { text: "Check again" }).addEventListener("click", () => void this.refresh());
  }

  /** Runs one fix. Settings and folders go through the kit's confirmation dialog; plugin pages, kit install and Templater set up have their own. */
  private async fix(it: SetupItem, fix: SetupFix): Promise<void> {
    const lab = this.host.managed;
    const confirm = async (change: SettingChange): Promise<void> => {
      await lab.confirmThen({ title: `Fix: ${it.label}?`, yes: "Fix", ask: true, items: [], select: () => false, settings: [change], run: async () => {} });
    };
    switch (fix.kind) {
      case "methods-folder": await confirm({ name: `Create ${fix.path} and use it as the Methods folder`, desc: "Put one note per analysis method there; the Alt+S analysis snippets then offer them.",
        apply: async () => { await ensureFolder(this.app.vault, fix.path); this.host.kit.methodsFolder = fix.path; await this.host.save(); } }); break;
      case "rigs-folder": await confirm({ name: `Create ${fix.path} and use it as the Rigs folder`, desc: "New rig then makes one note per flow rig there, from the Rig template.",
        apply: async () => { await ensureFolder(this.app.vault, fix.path); this.host.kit.rigsFolder = fix.path; await this.host.save(); } }); break;
      case "navigator-home": await confirm({ name: "Set Notebook Navigator's homepage", desc: `To ${fix.path}. It opens when Obsidian starts.`,
        apply: () => setNavigatorHomepage(this.app, fix.path) }); break;
      case "hide-properties": await confirm({ name: "Set Properties in document to Hidden", desc: "Settings → Editor. Properties stay in the note; open them from the note's menu.",
        apply: async () => { if (!hidePropertiesInDocument(this.app)) new Notice("Couldn't change it here. Set it in the editor settings."); } }); break;
      case "update-links": await confirm({ name: "Switch on Automatically update internal links", desc: "Settings → Files & links. Obsidian then rewrites the after, sub and project links when you rename a to-do or hub, without asking.",
        apply: async () => { if (!setAlwaysUpdateLinks(this.app)) new Notice("Couldn't change it here. Set it in the files and links settings."); } }); break;
      case "settings": this.close(); if (!openPluginSettings(this.app, this.host.pluginId)) new Notice("Couldn't open the settings: open them from the gear icon."); return;
      case "manage": this.after(this.host.manage()); return;
      case "open-note": this.close(); void this.app.workspace.openLinkText(fix.path, "", false); return;
      case "matching-mode": await confirm({ name: "Set Templater's matching mode to Folder templates", desc: "It is None now, so folder templates never run.", apply: () => setTemplaterFolderMode(this.app) }); break;
      case "startup-remove": await confirm({ name: "Remove the old roll-over from Templater's startup templates", desc: `${fix.template}. Lab Kit's to-do engine does the roll-over now. The file itself stays.`,
        apply: () => removeTemplaterStartup(this.app, fix.template) }); break;
      case "zotlit-fields": await confirm({ name: "Add the kit's fields to ZotLit's Frontmatter settings", desc: "Only the missing ones, and the two folders if they are empty. Fields you already have are never changed. Lab Kit then turns ZotLit off and on so it reads them.",
        apply: async () => {
          const data = await readZotlitData(this.app);
          if (!data || data === "unreadable") { new Notice("Couldn't read the settings file: nothing was changed."); return; }
          const want = this.zotlitWanted(), scan = zotlitScan(data, want);
          if (!scan.readable) { new Notice("The field list is not in the expected form: nothing was changed."); return; }
          await writeZotlitData(this.app, zotlitApply(data, scan, want));
          new Notice(`ZotLit settings updated (${scan.missing.length} field${scan.missing.length === 1 ? "" : "s"} added).`, 8000);
          await this.loadZotlit();
        } }); break;
      case "meta-bind": await confirm({ name: "Add the planning buttons to Meta Bind", desc: "Only the ones missing (by id). Buttons you already have are never changed.",
        apply: async () => { if (await addMetaBindButtons(this.app, PLANNING_BUTTONS)) new Notice("Buttons added. Restart Obsidian so they load.", 10000); } }); break;
      case "meta-bind-reset": await confirm({ name: "Put the kit's action on these Meta Bind buttons", desc: `${fix.ids.join(", ")}. Their old action is replaced (label and look stay). Restart Obsidian afterwards.`,
        apply: async () => { if (await resetMetaBindActions(this.app, PLANNING_BUTTONS.filter(b => fix.ids.includes(b.id)))) new Notice("Buttons changed. Restart Obsidian so they load.", 10000); } }); break;
      case "plugin": window.open(`obsidian://show-plugin?id=${encodeURIComponent(fix.id)}`); return;
      case "install": this.after(fix.kit === "planning" && !this.host.planning?.slot.enabled ? (this.host.planning ?? lab).review() : this.host.review()); return;   // both kits on: one window
      case "templater": await lab.setupTemplater(); break;
      case "css": await confirm({ name: "Turn on the CSS snippet", desc: fix.names.join(", "), apply: () => setCssSnippets(this.app, fix.names, []) }); break;
      case "find-moved": this.after(this.host.findMoved()); return;
      case "property-type": await confirm({ name: `Make ${fix.name} a ${fix.type} property`, desc: "Obsidian's property type (Settings → Properties). Values already typed in notes are not changed.",
        apply: async () => { if (!(await setPropertyType(this.app, fix.name, fix.type))) new Notice("Couldn't set it here. Set the type in a note's properties (click the property's icon)."); } });
        await this.refresh(); return;
      case "close-notes":
        // each note asks in its own window (the Close experiment command's), one after the other
        this.writing = new Set(fix.paths);
        for (const path of fix.paths) { const file = this.app.vault.getFileByPath(path); if (file) await closeExperiment(closeHostFor(this.app, this.host.kit, file)); }
        await this.refresh(); return;
      case "make-pdfs": await confirm({ name: `Make the PDF of ${fix.paths.length} closed ${fix.paths.length === 1 ? "note" : "notes"}`, desc: "Saved in the PDF folders (Close experiment: PDF folders). Each note's closed_pdf is set to the file names.",
        apply: async () => { this.writing = new Set(fix.paths); for (const path of fix.paths) { const file = this.app.vault.getFileByPath(path); if (file) await makeClosedPdf(closeHostFor(this.app, this.host.kit, file)); } } });
        await this.refresh(); return;
      case "folder": await confirm({ name: "Create the folder", desc: fix.path, apply: () => ensureFolder(this.app.vault, fix.path) }); break;
      case "folder-template": await confirm({ name: "Add a Templater folder template", desc: `${fix.folder} → ${fix.template}. Folder templates only run with Templater's "Trigger Templater on new file creation" on (Templater keeps that per device: turn it on in its settings).`,
        apply: () => addTemplaterFolderTemplate(this.app, fix.folder, fix.template) }); break;
    }
    this.render();
  }
}
