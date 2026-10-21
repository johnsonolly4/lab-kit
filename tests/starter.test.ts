// Phase 8: the new-vault starter (src/kit/starter.ts) plus both kits passes the setup check, for everything a starter can set.
import { describe, it, expect } from "vitest";
import { applyManaged, offIds, planManaged, trackedRoles, type EmbeddedKit, type ManagedAdapter } from "../src/kit/managed";
import { KIT_DEFAULTS, LAB_LAYOUT, PLANNING_FOLDER_DEFAULTS, kitDetectRoles, kitFolderRoles, kitJoin, planningRoles, todoFolder } from "../src/kit/paths";
import { SETUP_PLUGINS, checkSetup, labFolderTemplates, planningFolderTemplates, type SetupState } from "../src/kit/setup-check";
import { buildStarter, starterPlugins } from "../src/kit/starter";
// @ts-expect-error plain .mjs build helper
import { embeddedKits } from "../scripts/embed-kit.mjs";

const kits = (embeddedKits() as { kits: EmbeddedKit[] }).kits;
const lab = kits.find(k => k.manifest.id === "lab")!, planning = kits.find(k => k.manifest.id === "planning")!;
const opts = { baseDir: ".obsidian/plugins/lab-kit/kit-base", backups: "Backups", stamp: "2026-10-08T12:00:00.000Z" };
const memVault = (files: Record<string, string> = {}): ManagedAdapter & { files: Record<string, string> } => ({
  files,
  exists: async (p: string) => p in files,
  read: async (p: string) => { if (!(p in files)) throw new Error("ENOENT " + p); return files[p]; },
  write: async (p: string, d: string) => { files[p] = d; },
  mkdir: async () => {},
}) as unknown as ManagedAdapter & { files: Record<string, string> };

describe("new-vault starter (Phase 8)", () => {
  const starter = buildStarter(kits, ".obsidian");
  const read = (p: string): any => JSON.parse(starter.files[p]);
  const tpl = read(".obsidian/plugins/templater-obsidian/data.json");

  it("lists the plugins the setup check needs (not the optional ones) and Lab Kit itself", () => {
    const ids = read(".obsidian/community-plugins.json") as string[];
    expect(ids[0]).toBe("lab-kit");
    expect(ids).toEqual(starterPlugins());
    for (const p of SETUP_PLUGINS) expect(ids.includes(p.id), p.id).toBe(!p.optional);
    for (const id of ids) {
      expect(starter.files["install-plugins.sh"]).toContain(`obsidian plugin:install id=${id} enable\n`);
      expect(starter.files["install-plugins.ps1"]).toContain(`obsidian plugin:install id=${id} enable\r\n`);
    }
  });

  it("a vault from the starter + both kits has no red item the starter could have set", async () => {
    // Install both kits over the starter's Templater folders, the way the plugin does
    const v = memVault();
    const app: any = { vault: { configDir: ".obsidian", getFiles: () => [] }, plugins: { plugins: { "templater-obsidian": { settings: tpl } } } };
    const labFolders = kitFolderRoles(KIT_DEFAULTS);
    const labRoles = { ...kitDetectRoles(app, null, {}), ...labFolders };
    const labItems = await planManaged(v, lab, null, labRoles, null, null, offIds(lab, {}, {}));
    const labOut = await applyManaged(v, lab, labItems, null, opts);
    const planRoles = planningRoles(app, trackedRoles(planning, null), PLANNING_FOLDER_DEFAULTS, KIT_DEFAULTS.labFolder);
    const planItems = await planManaged(v, planning, null, planRoles, null, null, offIds(planning, {}, {}));
    await applyManaged(v, planning, planItems, null, opts);

    expect(Object.keys(labOut.state.files).length).toBeGreaterThan(0);
    for (const f of labFolderTemplates(KIT_DEFAULTS.labFolder)) expect(v.files[kitJoin(tpl.templates_folder, LAB_LAYOUT.templatesSub, f.file)], f.file).toBeDefined();
    for (const f of planningFolderTemplates(PLANNING_FOLDER_DEFAULTS)) expect(v.files[kitJoin(tpl.templates_folder, f.file)], f.file).toBeDefined();

    const exists = new Set(starter.folders);
    const css = [...(lab.manifest.enableCss ?? []), ...(planning.manifest.enableCss ?? [])].map(n => n.replace(/\.css$/, ""));
    const state: SetupState = {
      // Personal values the starter can't know: the user fills these in (Lab Kit settings)
      lab: { initials: "ABC", dataRoot: true, methodsFolder: "", rigsFolder: "", labFolder: KIT_DEFAULTS.labFolder, chemicalFolder: KIT_DEFAULTS.chemicalFolder },
      metaBind: null, zotlitGuide: null,   // Meta Bind buttons are added by the plugin's Fix, not by a settings file
      propertiesView: read(".obsidian/app.json").propertiesInDocument,
      updateLinks: read(".obsidian/app.json").alwaysUpdateLinks === true,
      plugins: new Set(read(".obsidian/community-plugins.json") as string[]),
      planning: true,
      templater: { templatesFolder: tpl.templates_folder, userScriptsFolder: tpl.user_scripts_folder,
        folderTemplates: tpl.folder_templates, matchingMode: tpl.trigger_on_file_creation_mode, startupTemplates: tpl.startup_templates },
      scripts: [lab, planning].flatMap(k => k.manifest.files.filter(f => f.role === "userScripts" && !f.optional).map(f => {
        const name = f.dest.split("/").pop()!.replace(/\.js$/, "");
        return { name, kit: k.manifest.id as "lab" | "planning", exists: Object.keys(v.files).some(p => p.endsWith(`/${name}.js`)) };
      })),
      installed: { lab: true, planning: true },
      css: css.map(name => ({ name, enabled: (read(".obsidian/appearance.json").enabledCssSnippets as string[]).includes(name) })),
      folders: [KIT_DEFAULTS.labFolder, KIT_DEFAULTS.chemicalFolder, ...Object.entries(PLANNING_FOLDER_DEFAULTS).filter(([r]) => r !== "archive").map(([, f]) => f),
        ...planningFolderTemplates(PLANNING_FOLDER_DEFAULTS).map(f => f.folder)].map(path => ({ path, exists: exists.has(path) })),
      folderTemplates: [
        ...labFolderTemplates(KIT_DEFAULTS.labFolder).map(f => ({ folder: f.folder, template: kitJoin(tpl.templates_folder, LAB_LAYOUT.templatesSub, f.file), kit: "lab" as const })),
        ...planningFolderTemplates(PLANNING_FOLDER_DEFAULTS).map(f => ({ folder: f.folder, template: kitJoin(tpl.templates_folder, f.file) })),
      ],
    };
    const items = checkSetup(state);
    expect(items.filter(i => i.id.startsWith("script:")).length).toBe(1);   // vtAsk.js; the lab kit ships no Templater script (2026-10-21)
    expect(items.length).toBeGreaterThan(25);
    const red = items.filter(i => !i.ok && !i.optional && !i.warn);
    expect(red.map(i => `${i.id}: ${i.detail}`)).toEqual([]);
    // The check can fail: without the starter's snippets and folders it does
    const bare = checkSetup({ ...state, css: state.css.map(c => ({ ...c, enabled: false })), folders: state.folders.map(f => ({ ...f, exists: false })) });
    expect(bare.some(i => !i.ok && i.group === "Appearance")).toBe(true);
    expect(bare.some(i => !i.ok && i.group === "Folders")).toBe(true);
    expect(exists.has(todoFolder(PLANNING_FOLDER_DEFAULTS))).toBe(true);
  });

  it("settings only: no notes, no personal values, no hotkeys", () => {
    expect(starter.files[".obsidian/hotkeys.json"]).toBeUndefined();
    expect(JSON.parse(starter.files[".obsidian/plugins/templater-obsidian/data.json"]).enabled_templates_hotkeys).toBeUndefined();   // Alt+S is a Lab Kit command, no Templater hotkey
    expect(Object.keys(starter.files).filter(p => p.endsWith(".md"))).toEqual([]);
    expect(JSON.stringify(starter.files)).not.toMatch(/[A-Za-z]:\\|\/Users\/|\/home\//);
  });
});
