// Kit picker: switching optional kit files off, and the folder layout for new vaults.
import { describe, it, expect } from "vitest";
import {
  SAFE_ACTIONS, applyManaged, disableManaged, planManaged, statusOf, trackedRoles,
  type EmbeddedKit, type ManagedAdapter, type ManagedItem
} from "../src/kit/managed";
import { kitDetectRoles } from "../src/kit/paths";
// @ts-expect-error plain .mjs build helper
import { embeddedKit } from "../scripts/embed-kit.mjs";

const roles = { templates: "Templates", userScripts: "Scripts/templater", scripts: "Scripts", cssSnippets: ".obsidian/snippets", backups: "Backups" };
const opts = { baseDir: ".obsidian/plugins/lab-kit/kit-base", backups: "Backups", stamp: "2026-10-04T12:00:00.000Z" };

function memVault(files: Record<string, string> = {}): ManagedAdapter & { files: Record<string, string> } {
  const dirs = new Set<string>();
  const v = {
    files,
    exists: async (p: string) => p in files || dirs.has(p),
    read: async (p: string) => { if (!(p in files)) throw new Error("ENOENT " + p); return files[p]; },
    write: async (p: string, d: string) => { files[p] = d; },
    remove: async (p: string) => { delete files[p]; },
    mkdir: async (p: string) => { dirs.add(p); },
  };
  return v as unknown as ManagedAdapter & { files: Record<string, string> };
}

const kit: EmbeddedKit = {
  manifest: {
    schema: 1, kitVersion: "0.1.0", removed: [], rewrite: {},
    files: [
      { id: "tpl-menu", kind: "template", role: "templates", src: "Menu.md", dest: "Menu.md", version: "0.1.0", sha256: "", renamedFrom: [] },
      { id: "tpl-snip-a", kind: "template", role: "templates", src: "Snippets/A.md", dest: "Snippets/A.md", version: "0.1.0", sha256: "", renamedFrom: [], optional: true },
      { id: "tpl-snip-b", kind: "template", role: "templates", src: "Snippets/B.md", dest: "Snippets/B.md", version: "0.1.0", sha256: "", renamedFrom: [], optional: true },
      { id: "script-form", kind: "script", role: "userScripts", src: "form.js", dest: "form.js", version: "0.1.0", sha256: "", renamedFrom: [] },
    ],
  },
  contents: { "tpl-menu": "menu\n", "tpl-snip-a": "snippet a\n", "tpl-snip-b": "snippet b\n", "script-form": "form\n" },
};
const by = (items: ManagedItem[], id: string): ManagedItem => items.find(i => i.file.id === id)!;
const trash = (v: { files: Record<string, string> }) => async (p: string): Promise<void> => { delete v.files[p]; };

describe("switched-off files", () => {
  it("are planned as off, whether installed or not, and never written by 'update all safe files'", async () => {
    const v = memVault();
    const plan = await planManaged(v, kit, null, roles, null, null, new Set(["tpl-snip-a"]));
    expect(by(plan, "tpl-snip-a").action).toBe("off");
    expect(by(plan, "tpl-snip-b").action).toBe("create");
    expect(SAFE_ACTIONS).not.toContain("off");
    await applyManaged(v, kit, plan, null, opts);
    expect(Object.keys(v.files).filter(f => f.startsWith("Templates/Snippets"))).toEqual(["Templates/Snippets/B.md"]);
    expect(statusOf(by(plan, "tpl-snip-a")).label).toBe("Off");
  });

  it("ignore a core (non-optional) id in the off list", async () => {
    const plan = await planManaged(memVault(), kit, null, roles, null, null, new Set(["tpl-menu", "script-form"]));
    expect(by(plan, "tpl-menu").action).toBe("create");
    expect(by(plan, "script-form").action).toBe("create");
  });

  it("an installed file is backed up and removed, and the kit forgets it", async () => {
    const v = memVault();
    const first = await applyManaged(v, kit, await planManaged(v, kit, null, roles), null, opts);
    expect(v.files["Templates/Snippets/A.md"]).toBe("snippet a\n");
    const item = by(await planManaged(v, kit, first.state, roles), "tpl-snip-a");
    const out = await disableManaged(v, item, first.state, opts, trash(v));
    expect(v.files["Templates/Snippets/A.md"]).toBeUndefined();
    expect(out.backup).toBe("Backups/2026-10-04T12-00-00-000Z/Templates/Snippets/A.md");
    expect(v.files[out.backup!]).toBe("snippet a\n");
    expect(out.state.files["tpl-snip-a"]).toBeUndefined();
    expect(v.files[`${opts.baseDir}/tpl-snip-a.txt`]).toBeUndefined();
    expect(out.state.files["tpl-snip-b"]).toBeDefined();                    // the others are untouched
  });

  it("an edited file is backed up too, so your edits are never lost", async () => {
    const v = memVault();
    const first = await applyManaged(v, kit, await planManaged(v, kit, null, roles), null, opts);
    v.files["Templates/Snippets/A.md"] = "my own snippet\n";
    const item = by(await planManaged(v, kit, first.state, roles), "tpl-snip-a");
    const out = await disableManaged(v, item, first.state, opts, trash(v));
    expect(v.files[out.backup!]).toBe("my own snippet\n");
  });

  it("a file that was never installed just switches off (no backup, no error)", async () => {
    const v = memVault();
    const item = by(await planManaged(v, kit, null, roles, null, null, new Set(["tpl-snip-a"])), "tpl-snip-a");
    const out = await disableManaged(v, item, null, opts, async () => { throw new Error("must not remove"); });
    expect(out.backup).toBeUndefined();
  });

  it("switching on again installs it as new", async () => {
    const v = memVault();
    const first = await applyManaged(v, kit, await planManaged(v, kit, null, roles), null, opts);
    const item = by(await planManaged(v, kit, first.state, roles), "tpl-snip-a");
    const out = await disableManaged(v, item, first.state, opts, trash(v));
    const again = await planManaged(v, kit, out.state, roles);                // off list is empty again
    expect(by(again, "tpl-snip-a").action).toBe("create");
    await applyManaged(v, kit, again, out.state, { ...opts, select: it => it.file.id === "tpl-snip-a" });
    expect(v.files["Templates/Snippets/A.md"]).toBe("snippet a\n");
  });
});

describe("real kit manifest", () => {
  const real = embeddedKit() as EmbeddedKit;
  const legacy = ["excel_to_calc.py"];
  it("describes every file, and only the 13 snippets and the Excel converter can be switched off", () => {
    for (const f of real.manifest.files) expect(f.desc?.length ?? 0, f.src).toBeGreaterThan(5);
    const optional = real.manifest.files.filter(f => f.optional).map(f => f.dest);
    expect(optional).toHaveLength(14);
    expect(optional.filter(d => d.startsWith("Snippets/"))).toHaveLength(13);
    expect(optional.filter(d => !d.startsWith("Snippets/")).sort()).toEqual([...legacy].sort());
  });
  it("planning with every optional file off installs the core and none of the snippets or older files", async () => {
    const v = memVault();
    const off = new Set(real.manifest.files.filter(f => f.optional).map(f => f.id));
    const plan = await planManaged(v, real, null, roles, null, null, off);
    expect(plan.filter(p => p.action === "off")).toHaveLength(14);
    await applyManaged(v, real, plan, null, opts);
    expect(v.files["Templates/Insert snippet.md"]).toBeDefined();
    expect(Object.keys(v.files).some(f => f.startsWith("Templates/Snippets/"))).toBe(false);
  });
});

describe("folder layout", () => {
  const vault = (paths: string[], tpl: object): any => ({
    vault: {
      configDir: ".obsidian",
      getFiles: () => paths.map(p => ({ name: p.split("/").pop(), path: p, parent: { path: p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "" } })),
      getAbstractFileByPath: () => null,
    },
    plugins: { plugins: { "templater-obsidian": { settings: tpl } } },
  });
  const tplSettings = { templates_folder: "Templater/Templates", user_scripts_folder: "Templater/Scripts" };

  it("a new vault gets Lab Kit folders inside Templater's own folders", () => {
    const r = kitDetectRoles(vault([], tplSettings), null, {});
    expect(r.templates).toBe("Templater/Templates/Lab Kit");
    expect(r.userScripts).toBe("Templater/Scripts/lab-kit");
    expect(r.scripts).toBe("Extras/scripts");                               // shared scripts stay where they were
  });

  it("without Templater folders: Templates/Lab Kit, and the scripts keep the old default", () => {
    const r = kitDetectRoles(vault([], {}), null, {});
    expect(r.templates).toBe("Templates/Lab Kit");
    expect(r.userScripts).toBe("Extras/scripts/templater");
  });

  it("follows the files the kit already installed, not Templater's folders", () => {
    const r = kitDetectRoles(vault([], tplSettings), null, { templates: "Old/Place", userScripts: "Old/Scripts" });
    expect(r.templates).toBe("Old/Place");
    expect(r.userScripts).toBe("Old/Scripts");
  });

  it("follows an existing Insert snippet.md / labForm.js (hand-installed or from the folder updater)", () => {
    const r = kitDetectRoles(vault(["Mine/Insert snippet.md", "Mine/js/labForm.js"], tplSettings), null, {});
    expect(r.templates).toBe("Mine");
    expect(r.userScripts).toBe("Mine/js");
  });

  it("the old folder updater's record still gives the scripts and backup folders", () => {
    const record = { version: "0.4.5", files: {}, installedAt: "", roles: { scripts: "Lab/scripts", backups: "Lab/kit-backups" } };
    const r = kitDetectRoles(vault([], tplSettings), record, {});
    expect(r.scripts).toBe("Lab/scripts");
    expect(r.backups).toBe("Lab/kit-backups");
  });

  it("trackedRoles reads each role's folder back from the installed paths and skips moved files", async () => {
    const v = memVault();
    const { state } = await applyManaged(v, kit, await planManaged(v, kit, null, { ...roles, templates: "Lab Kit", userScripts: "S/lab-kit" }), null, opts);
    expect(trackedRoles(kit, state)).toMatchObject({ templates: "Lab Kit", userScripts: "S/lab-kit" });
    state.files["tpl-menu"].path = "Elsewhere/Renamed.md";                    // moved by hand: its folder says nothing
    expect(trackedRoles(kit, state).templates).toBe("Lab Kit");              // the snippets still say it
    expect(trackedRoles(kit, null)).toEqual({});
  });

  it("a kit file added later lands beside the existing menu (the next plan uses the tracked folders)", async () => {
    const v = memVault();
    const first = await applyManaged(v, kit, await planManaged(v, kit, null, { ...roles, templates: "T/Lab Kit" }), null, opts);
    const r = kitDetectRoles(vault([], tplSettings), null, trackedRoles(kit, first.state));
    expect(r.templates).toBe("T/Lab Kit");
  });
});

describe("backup copies are not kit files", () => {
  const files = ["Extras/kit-backups/2026-10-04T17-21-03-991Z/Extras/scripts/templater/labForm.js", "Extras/scripts/templater/labForm.js",
    "Extras/kit-backups/2026-10-04T17-21-03-991Z/Templates/Insert snippet.md", "Templates/Lab Kit/Insert snippet.md"];
  const app: any = {
    vault: { configDir: ".obsidian", getAbstractFileByPath: () => null,
      getFiles: () => files.map(p => ({ name: p.split("/").pop(), path: p, parent: { path: p.slice(0, p.lastIndexOf("/")) } })) },
    plugins: { plugins: {} },
  };

  it("roles are detected from the real files, not an old backup", () => {
    const r = kitDetectRoles(app, null, {});
    expect(r.userScripts).toBe("Extras/scripts/templater");
    expect(r.templates).toBe("Templates/Lab Kit");
  });

  it("a Templater folder that points into a backup is ignored", () => {
    const bad = "Extras/kit-backups/2026-10-04T17-21-03-991Z/Extras/scripts/templater";
    const none: any = { vault: { configDir: ".obsidian", getAbstractFileByPath: () => null, getFiles: () => [] },
      plugins: { plugins: { "templater-obsidian": { settings: { user_scripts_folder: bad, templates_folder: "Extras/kit-backups/2026-10-04T17-21-03-991Z/Templates" } } } } };
    const r = kitDetectRoles(none, null, {});
    expect(r.userScripts).toBe("Extras/scripts/templater");
    expect(r.templates).toBe("Templates/Lab Kit");
  });

  it("a path an older version recorded inside a backup is not trusted", () => {
    const r = trackedRoles({ manifest: { files: [{ id: "a", role: "userScripts", dest: "labForm.js" }] } } as any,
      { installedKitVersion: "0.4.9", files: { a: { path: "Extras/kit-backups/2026-10-04T17-21-03-991Z/Extras/scripts/templater/labForm.js" } } } as any);
    expect(r.userScripts).toBeUndefined();
  });
});

describe("a file recorded inside a backup folder", () => {
  it("is planned as not installed (create) at its real place, not as deleted", async () => {
    const bad = "Backups/2026-10-04T17-21-03-991Z/Templates/Menu.md";
    const v = memVault({ [bad]: "menu\n" });
    const state: any = { installedKitVersion: "0.1.0", files: { "tpl-menu": { path: bad, version: "0.1.0", hash: "x" } } };
    const plan = await planManaged(v, kit, state, roles, null, null, new Set());
    expect(by(plan, "tpl-menu").action).toBe("create");
    expect(by(plan, "tpl-menu").dest).toBe("Templates/Menu.md");
  });
});
