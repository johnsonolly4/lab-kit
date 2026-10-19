// New-vault starter (Phase 8): the Obsidian settings a fresh vault needs for the kits, generated from the kit manifests and the setup check's own lists so they can't drift.
// Pure (no Node): `npm run starter` writes the result to dist/starter/ (scripts/make-starter.mjs). Settings and plugin list only, no notes: the plugin installs the kit files.
import { LAB_LAYOUT, PLANNING_FOLDER_DEFAULTS, KIT_DEFAULTS, kitJoin, todoFolder } from "./paths";
import { SETUP_PLUGINS, labFolderTemplates, planningFolderTemplates } from "./setup-check";
import type { EmbeddedKit } from "./managed";

/** Id of this plugin in the community store (manifest.json). */
export const PLUGIN_ID = "lab-kit";

export interface Starter {
  /** Vault-relative path → file text. */
  files: Record<string, string>;
  /** Empty folders the folder contract expects. */
  folders: string[];
}

const json = (v: unknown): string => JSON.stringify(v, null, 2) + "\n";

/** Plugin ids the starter installs and turns on: Lab Kit itself, then every plugin the setup check needs (optional ones are left to the user). */
export const starterPlugins = (): string[] => [PLUGIN_ID, ...SETUP_PLUGINS.filter(p => !p.optional).map(p => p.id)];

/** The Insert snippet template's vault path (the lab kit's default layout). */
export function starterMenu(lab: EmbeddedKit): string {
  const f = lab.manifest.files.find(x => x.dest.endsWith("Insert snippet.md"));
  if (!f) throw new Error("lab kit has no Insert snippet.md");
  return kitJoin(LAB_LAYOUT.templates, LAB_LAYOUT.templatesSub, f.dest);
}

/** `CONFIG`: the new vault's configuration folder (Obsidian's default is `.obsidian`). */
export function buildStarter(kits: EmbeddedKit[], CONFIG: string): Starter {
  const lab = kits.find(k => k.manifest.id === "lab"), planning = kits.find(k => k.manifest.id === "planning");
  if (!lab || !planning) throw new Error("the starter needs the lab and planning kits");
  const menu = starterMenu(lab);
  const pf = PLANNING_FOLDER_DEFAULTS;
  const templates = kitJoin(LAB_LAYOUT.templates);
  const snippets = kits.flatMap(k => k.manifest.enableCss ?? []).map(n => n.replace(/\.css$/, ""));

  const files: Record<string, string> = {
    [`${CONFIG}/community-plugins.json`]: json(starterPlugins()),
    [`${CONFIG}/app.json`]: json({ propertiesInDocument: "hidden", alwaysUpdateLinks: true }),
    [`${CONFIG}/appearance.json`]: json({ enabledCssSnippets: snippets }),
    [`${CONFIG}/plugins/templater-obsidian/data.json`]: json({
      templates_folder: templates,
      user_scripts_folder: LAB_LAYOUT.userScripts,
      enabled_templates_hotkeys: [menu],
      folder_templates: [
        ...labFolderTemplates(KIT_DEFAULTS.labFolder, KIT_DEFAULTS.chemicalFolder).map(f => ({ folder: f.folder, template: kitJoin(templates, LAB_LAYOUT.templatesSub, f.file) })),   // the lab kit's templates sit in a Lab Kit subfolder
        ...planningFolderTemplates(pf).map(f => ({ folder: f.folder, template: kitJoin(templates, f.file) })),
      ],
      trigger_on_file_creation_mode: "folder",
      startup_templates: [],
    }),
    "install-plugins.sh": ["#!/bin/sh", "# Installs and turns on the plugins this vault needs (Obsidian must be running; Settings → General → Command line interface on).",
      ...starterPlugins().map(id => `obsidian plugin:install id=${id} enable`), ""].join("\n"),
    "install-plugins.ps1": ["# Installs and turns on the plugins this vault needs (Obsidian must be running; Settings → General → Command line interface on).",
      ...starterPlugins().map(id => `obsidian plugin:install id=${id} enable`), ""].join("\r\n"),
  };

  const folders = [KIT_DEFAULTS.labFolder, KIT_DEFAULTS.chemicalFolder, ...(Object.keys(pf) as (keyof typeof pf)[]).filter(r => r !== "archive").map(r => pf[r]), todoFolder(pf)];
  return { files, folders: [...new Set(folders)] };
}
