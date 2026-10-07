// First install of the built-in kit (CSS snippet, Templater's user scripts folder) and the version compare behind the update notice.
import { describe, it, expect } from "vitest";
import {
  applyManaged, firstInstallOptions, offIds, planManaged, previewInstall, relocateRole, templaterScriptsAction, trackedRoles,
  type EmbeddedKit, type ManagedAdapter, type ManagedState
} from "../src/kit/managed";
import { readFileSync } from "fs";
import { KIT_DEFAULTS, kitCompare, kitDetectRoles, kitFolderRoles, kitLoad, kitSlot, newLabEntryTarget } from "../src/kit/paths";
// @ts-expect-error plain .mjs build helper
import { embeddedKit } from "../scripts/embed-kit.mjs";

const real = embeddedKit() as EmbeddedKit;
const bare: EmbeddedKit = { manifest: { schema: 1, kitVersion: "1.0.0", files: [], removed: [] }, contents: {} };

describe("first install options", () => {
  it("the real kit carries its CSS snippet and Templater settings into main.js", () => {
    expect(real.manifest.enableCss).toContain("scrolling-mermaid.css");
    expect(real.manifest.templater?.userScripts).toBe(true);
  });

  it("offers the CSS snippet from the kit", () => {
    const o = firstInstallOptions(real, { installed: false }, "Scripts/lab-kit");
    expect(o.css?.enable).toEqual(real.manifest.enableCss);
    expect(o.css?.disable).toEqual(real.manifest.disableCss ?? []);
  });

  it("offers Templater's folder only when Templater is installed and has none: the folder above lab-kit", () => {
    expect(firstInstallOptions(real, { installed: true }, "Scripts/lab-kit").templaterFolder).toBe("Scripts");
    expect(firstInstallOptions(real, { installed: true, folder: "  " }, "Scripts/lab-kit").templaterFolder).toBe("Scripts");
    expect(firstInstallOptions(real, { installed: true }, "Mine/js").templaterFolder).toBe("Mine/js");
  });

  it("never replaces a folder Templater already has", () => {
    expect(firstInstallOptions(real, { installed: true, folder: "My scripts" }, "Scripts/lab-kit").templaterFolder).toBeNull();
  });

  it("offers nothing without Templater, or for a kit that asks for nothing", () => {
    expect(firstInstallOptions(real, { installed: false }, "Scripts/lab-kit").templaterFolder).toBeNull();
    expect(firstInstallOptions(bare, { installed: true }, "Scripts/lab-kit")).toEqual({ css: null, templaterFolder: null });
  });
});

// Issue #34: a Templater user scripts folder that is set is never changed; the lab scripts go into <folder>/lab-kit
describe("Templater's user scripts folder (issue #34)", () => {
  const kit: EmbeddedKit = {
    manifest: { schema: 1, kitVersion: "0.1.0", removed: [], files: [
      { id: "tpl-menu", kind: "template", role: "templates", src: "Menu.md", dest: "Menu.md", version: "0.1.0", sha256: "", renamedFrom: [] },
      { id: "script-form", kind: "script", role: "userScripts", src: "labForm.js", dest: "labForm.js", version: "0.1.0", sha256: "", renamedFrom: [] },
      { id: "script-methods", kind: "script", role: "userScripts", src: "labMethods.js", dest: "labMethods.js", version: "0.1.0", sha256: "", renamedFrom: [] },
    ] },
    contents: { "tpl-menu": "menu\n", "script-form": "form\n", "script-methods": "methods\n" },
  };
  const opts = { baseDir: ".obsidian/plugins/lab-kit/kit-base", backups: "Backups", stamp: "2026-10-07T12:00:00.000Z" };
  const memVault = (files: Record<string, string> = {}): ManagedAdapter & { files: Record<string, string> } => ({
    files,
    exists: async (p: string) => p in files,
    read: async (p: string) => { if (!(p in files)) throw new Error("ENOENT " + p); return files[p]; },
    write: async (p: string, d: string) => { files[p] = d; },
    mkdir: async () => {},
  }) as unknown as ManagedAdapter & { files: Record<string, string> };
  const app = (v: { files: Record<string, string> }, tpl: object): any => ({
    vault: { configDir: ".obsidian", getAbstractFileByPath: () => null,
      getFiles: () => Object.keys(v.files).map(p => ({ name: p.split("/").pop(), path: p, parent: { path: p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "" } })) },
    plugins: { plugins: { "templater-obsidian": { settings: tpl } } },
  });
  /** Plans and applies "update all safe files", the way the plugin does on first install. */
  async function install(v: ReturnType<typeof memVault>, tpl: object, state: ManagedState | null = null): Promise<ManagedState> {
    const roles = kitDetectRoles(app(v, tpl), null, trackedRoles(kit, state));
    return (await applyManaged(v, kit, await planManaged(v, kit, state, roles), state, opts)).state;
  }
  const userFiles = { "My scripts/mine.js": "mine\n" };

  it("(a)(b) a set folder is unchanged after first install and Set up; the lab scripts land in <folder>/lab-kit", async () => {
    const tpl = { user_scripts_folder: "My scripts" };
    const v = memVault({ ...userFiles });
    const state = await install(v, tpl);
    expect(firstInstallOptions(real, { installed: true, folder: tpl.user_scripts_folder }, trackedRoles(kit, state).userScripts).templaterFolder).toBeNull();
    expect(templaterScriptsAction(tpl.user_scripts_folder, trackedRoles(kit, state).userScripts)).toEqual({ kind: "ok" });
    expect(v.files["My scripts/lab-kit/labForm.js"]).toBe("form\n");
    expect(v.files["My scripts/lab-kit/labMethods.js"]).toBe("methods\n");
    expect(v.files["My scripts/mine.js"]).toBe("mine\n");
    expect(v.files["My scripts/labForm.js"]).toBeUndefined();
  });

  it("(c) a fresh vault: Templater is offered the parent (Extras/scripts/templater, Phase 1b), the scripts go into <parent>/lab-kit", async () => {
    const v = memVault();
    const state = await install(v, {});
    const kitFolder = trackedRoles(kit, state).userScripts;
    expect(kitFolder).toBe("Extras/scripts/templater/lab-kit");
    expect(v.files["Extras/scripts/templater/lab-kit/labForm.js"]).toBe("form\n");
    expect(firstInstallOptions(real, { installed: true }, kitFolder).templaterFolder).toBe("Extras/scripts/templater");
    expect(templaterScriptsAction("", kitFolder)).toEqual({ kind: "set", folder: "Extras/scripts/templater" });
    expect(templaterScriptsAction("Extras/scripts/templater", kitFolder)).toEqual({ kind: "ok" });
  });

  it("(d) an older install outside the folder: Set up installs new copies into <folder>/lab-kit; old copies untouched; cancel writes nothing", async () => {
    const v = memVault({ ...userFiles });
    const state = await install(v, {});                                       // older install: Extras/scripts/templater/lab-kit, Templater then pointed elsewhere
    v.files["Extras/scripts/templater/lab-kit/labForm.js"] = "form, edited\n";
    const before = { ...v.files };
    const action = templaterScriptsAction("My scripts", trackedRoles(kit, state).userScripts);
    expect(action).toEqual({ kind: "relocate", to: "My scripts/lab-kit" });
    if (action.kind !== "relocate") return;

    const moved = relocateRole(kit, state, "userScripts");
    expect(moved.old.sort()).toEqual(["Extras/scripts/templater/lab-kit/labForm.js", "Extras/scripts/templater/lab-kit/labMethods.js"]);
    expect(state.files["script-form"]).toBeDefined();                         // the saved state is not changed until confirmed
    const roles = { ...kitDetectRoles(app(v, { user_scripts_folder: "My scripts" }), null, trackedRoles(kit, moved.state)), userScripts: action.to };
    const items = (await planManaged(v, kit, moved.state, roles)).filter(i => i.file.role === "userScripts");
    expect(v.files).toEqual(before);                                          // cancel: planning alone wrote nothing

    const out = await applyManaged(v, kit, items, moved.state, { ...opts, keepVersion: true });
    expect(v.files["My scripts/lab-kit/labForm.js"]).toBe("form\n");
    expect(v.files["My scripts/lab-kit/labMethods.js"]).toBe("methods\n");
    for (const [p, text] of Object.entries(before)) expect(v.files[p]).toBe(text);   // old copies and the user's script unchanged
    expect(trackedRoles(kit, out.state).userScripts).toBe("My scripts/lab-kit");
    expect(out.state.files["tpl-menu"]).toEqual(state.files["tpl-menu"]);     // other kit files keep their tracking
  });

  it("(e) kit scripts already under the set folder, flat or in a subfolder: nothing moves", async () => {
    for (const folder of ["My scripts", "My scripts/js"]) {
      const v = memVault({ ...userFiles });
      const state = await install(v, {});
      const placed: ManagedState = { ...state, files: { ...state.files } };
      for (const id of ["script-form", "script-methods"]) {                   // as if installed there by an older version
        const name = kit.manifest.files.find(f => f.id === id)!.dest;
        v.files[`${folder}/${name}`] = v.files[placed.files[id].path];
        delete v.files[placed.files[id].path];
        placed.files[id] = { ...placed.files[id], path: `${folder}/${name}` };
      }
      const before = { ...v.files };
      expect(templaterScriptsAction("My scripts", trackedRoles(kit, placed).userScripts)).toEqual({ kind: "ok" });
      const roles = kitDetectRoles(app(v, { user_scripts_folder: "My scripts" }), null, trackedRoles(kit, placed));
      const plan = await planManaged(v, kit, placed, roles);
      expect(plan.filter(i => i.action !== "up-to-date")).toEqual([]);
      await applyManaged(v, kit, plan, placed, opts);
      expect(v.files).toEqual(before);
    }
  });
});

describe("kitCompare (update notice)", () => {
  it("compares versions number by number", () => {
    expect(kitCompare("0.3.0", "0.2.9")).toBeGreaterThan(0);
    expect(kitCompare("0.10.0", "0.9.1")).toBeGreaterThan(0);
    expect(kitCompare("1.0", "1.0.0")).toBe(0);
    expect(kitCompare("0.4.8", "0.4.9")).toBeLessThan(0);
  });
});

// Phase 1a: several kits (kits/<id>/), each with its own state in data.json
describe("multi-kit manifest (schema 2)", () => {
  it("embeds every kit under kits/, the lab kit with id 'lab' and the same files as before", async () => {
    // @ts-expect-error plain .mjs build helper
    const { embeddedKits } = await import("../scripts/embed-kit.mjs");
    const all = embeddedKits();
    expect(all.schema).toBe(2);
    expect(all.kits.map((k: EmbeddedKit) => k.manifest.id)).toContain("lab");
    const lab = all.kits.find((k: EmbeddedKit) => k.manifest.id === "lab");
    expect(lab.manifest.files).toEqual(real.manifest.files);
    expect(lab.contents).toEqual(real.contents);
    expect(lab.manifest.schema).toBe(2);
  });

  it("a v0.5.2 data.json loads with the same managed state (hashes, folders, files switched off), now under kits.lab", () => {
    const saved = JSON.parse(readFileSync("tests/fixtures/data-0.5.2.json", "utf8")).kit;
    const kit = kitLoad(saved);
    expect(kit.kits.lab.managed).toEqual(saved.managed);
    expect(kit.kits.lab.paths).toEqual(saved.paths);
    expect(kit.kits.lab.off).toEqual(saved.off);
    expect(kit.kits.lab.enabled).toBe(true);
    expect(trackedRoles(real, kit.kits.lab.managed)).toEqual(trackedRoles(real, saved.managed));
    for (const k of ["managed", "paths", "off"]) expect(k in kit).toBe(false);
    for (const k of ["seenChangelog", "snippetIcons", "notifyKitUpdate", "chemicalFolder", "mwProperty", "methodsFolder"]) expect((kit as any)[k]).toEqual(saved[k]);
  });

  it("loading is stable (schema 2 saved and loaded again), and an empty data.json gives no kit state", () => {
    const once = kitLoad(JSON.parse(readFileSync("tests/fixtures/data-0.5.2.json", "utf8")).kit);
    expect(kitLoad(JSON.parse(JSON.stringify(once)))).toEqual(once);
    const fresh = kitLoad(undefined);
    expect(fresh.kits).toEqual({});
    expect(kitSlot(fresh, "lab")).toEqual({ enabled: true, managed: null, paths: {}, off: {} });
    expect(fresh.kits.lab).toBeDefined();
  });

  it("drops the removed folder updater's settings; 'don't check at startup' turns the update notice off", () => {
    const kit = kitLoad({ source: "x", checkOnStartup: false, makeBackups: true }) as any;
    expect(kit.notifyKitUpdate).toBe(false);
    expect("source" in kit || "checkOnStartup" in kit || "makeBackups" in kit).toBe(false);
  });
});

// Phase 1b: folder-contract defaults, the confirmation preview, policy "keep", kits installed on their own
describe("install preview and folder contract (Phase 1b)", () => {
  const lab: EmbeddedKit = {
    manifest: { schema: 2, id: "lab", kitVersion: "0.1.0", removed: [], files: [
      { id: "tpl-menu", kind: "template", role: "templates", src: "Templates/Insert snippet.md", dest: "Insert snippet.md", version: "0.1.0", sha256: "", renamedFrom: [] },
      { id: "script-form", kind: "script", role: "userScripts", src: "labForm.js", dest: "labForm.js", version: "0.1.0", sha256: "", renamedFrom: [] },
      { id: "script-xl", kind: "script", role: "scripts", src: "excel_to_calc.py", dest: "excel_to_calc.py", version: "0.1.0", sha256: "", renamedFrom: [] },
    ] },
    contents: { "tpl-menu": "menu\n", "script-form": "form\n", "script-xl": "xl\n" },
  };
  // Until Phase 3: a two-file stand-in for the planning kit, with its own roles
  const planning: EmbeddedKit = {
    manifest: { schema: 2, id: "planning", kitVersion: "0.1.0", removed: [], files: [
      { id: "home", kind: "template", role: "home", src: "00 Home.md", dest: "00 Home.md", version: "0.1.0", sha256: "", renamedFrom: [], policy: "keep" },
      { id: "board", kind: "template", role: "planning", src: "To-do board.base", dest: "To-do board.base", version: "0.1.0", sha256: "", renamedFrom: [] },
    ] },
    contents: { home: "home\n", board: "board\n" },
  };
  const planningRoles = { home: "", planning: "00 Planning", backups: "Backups" };
  const opts = { baseDir: ".obsidian/plugins/lab-kit/kit-base", backups: "Backups", stamp: "2026-10-07T12:00:00.000Z" };
  const memVault = (files: Record<string, string> = {}, dirs: string[] = []) => {
    const d = new Set(dirs);
    for (const p of Object.keys(files)) for (let x = p.slice(0, p.lastIndexOf("/")); x; x = x.includes("/") ? x.slice(0, x.lastIndexOf("/")) : "") d.add(x);
    return {
      files, dirs: d,
      exists: async (p: string) => p in files || d.has(p),
      read: async (p: string) => { if (!(p in files)) throw new Error("ENOENT " + p); return files[p]; },
      write: async (p: string, t: string) => { files[p] = t; },
      mkdir: async (p: string) => { d.add(p); },
    } as unknown as ManagedAdapter & { files: Record<string, string>; dirs: Set<string> };
  };
  const app = (v: { files: Record<string, string> }, tpl: object = {}): any => ({
    vault: { configDir: ".obsidian", getAbstractFileByPath: () => null,
      getFiles: () => Object.keys(v.files).map(p => ({ name: p.split("/").pop(), path: p, parent: { path: p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "" } })) },
    plugins: { plugins: { "templater-obsidian": { settings: tpl } } },
  });
  /** An adapter that fails on any write: planning and previewing must only read. */
  const readOnly = (v: ManagedAdapter): ManagedAdapter => ({ ...v, write: async () => { throw new Error("wrote"); }, mkdir: async () => { throw new Error("made a folder"); } }) as ManagedAdapter;

  it("(a) empty vault: the folder contract under Extras/, and only the planned files and folders are created", async () => {
    const v = memVault();
    const roles = kitDetectRoles(app(v), null, {});
    const items = await planManaged(readOnly(v), lab, null, roles);
    const preview = await previewInstall(readOnly(v), items);
    expect(preview.create.sort()).toEqual(["Extras/Templates/Lab Kit/Insert snippet.md", "Extras/scripts/lab-kit/excel_to_calc.py", "Extras/scripts/templater/lab-kit/labForm.js"]);
    expect(preview.leftAlone).toEqual([]);
    expect(preview.folders).toEqual(["Extras", "Extras/Templates", "Extras/Templates/Lab Kit", "Extras/scripts", "Extras/scripts/lab-kit", "Extras/scripts/templater", "Extras/scripts/templater/lab-kit"]);
    await applyManaged(v, lab, items, null, opts);
    const written = Object.keys(v.files).filter(p => !p.startsWith(".obsidian/"));
    expect(written.sort()).toEqual(preview.create.sort());
  });

  it("(b) files with the same names already there: none overwritten, listed as left alone", async () => {
    const mine = { "Extras/Templates/Lab Kit/Insert snippet.md": "my menu\n", "Extras/scripts/templater/lab-kit/labForm.js": "form\n" };
    const v = memVault({ ...mine });
    const roles = kitDetectRoles(app(v), null, {});
    const items = await planManaged(v, lab, null, roles);
    const preview = await previewInstall(v, items);
    expect(preview.leftAlone.sort()).toEqual(Object.keys(mine).sort());   // the identical one is adopted, not written
    expect(preview.create).toEqual(["Extras/scripts/lab-kit/excel_to_calc.py"]);
    expect(preview.folders).toEqual(["Extras/scripts/lab-kit"]);
    await applyManaged(v, lab, items, null, opts);
    for (const [p, text] of Object.entries(mine)) expect(v.files[p]).toBe(text);
  });

  it("(c) cancel writes nothing: planning and the preview only read", async () => {
    const v = memVault({ "notes/a.md": "a\n" });
    const before = JSON.stringify(v.files);
    const items = await planManaged(readOnly(v), lab, null, kitDetectRoles(app(v), null, {}));
    await previewInstall(readOnly(v), items);
    expect(JSON.stringify(v.files)).toBe(before);
  });

  it("(d) the lab kit alone and the planning kit alone each install cleanly, each into its own state", async () => {
    for (const only of [lab, planning]) {
      const v = memVault();
      const data = kitLoad(undefined);
      const slot = kitSlot(data, only.manifest.id);
      const roles = only === lab ? kitDetectRoles(app(v), null, {}) : planningRoles;
      const items = await planManaged(v, only, slot.managed, roles);
      expect(items.every(i => i.action === "create")).toBe(true);
      slot.managed = (await applyManaged(v, only, items, slot.managed, opts)).state;
      expect(Object.keys(data.kits)).toEqual([only.manifest.id]);
      expect(Object.keys(slot.managed.files).sort()).toEqual(only.manifest.files.map(f => f.id).sort());
      expect((await planManaged(v, only, slot.managed, roles)).every(i => i.action === "up-to-date")).toBe(true);
    }
  });

  it("(e) an existing install keeps its folders (vault root Templates/ and scripts/): nothing new under Extras/", async () => {
    const v = memVault({ "Templates/Insert snippet.md": "menu\n", "scripts/labForm.js": "form\n", "scripts/excel_to_calc.py": "xl\n" });
    const first = await applyManaged(v, lab, await planManaged(v, lab, null, { templates: "Templates", userScripts: "scripts", scripts: "scripts", backups: "Backups" }), null, opts);
    const roles = kitDetectRoles(app(v, { user_scripts_folder: "scripts" }), null, trackedRoles(lab, first.state));
    expect([roles.templates, roles.userScripts, roles.scripts]).toEqual(["Templates", "scripts", "scripts"]);
    const items = await planManaged(v, lab, first.state, roles);
    const preview = await previewInstall(v, items);
    expect(preview.create).toEqual([]);
    expect(preview.folders).toEqual([]);
  });

  it("policy keep: installed once, never updated, even when untouched and the kit changes it", async () => {
    const v = memVault();
    const first = await applyManaged(v, planning, await planManaged(v, planning, null, planningRoles), null, opts);
    const newer: EmbeddedKit = { manifest: { ...planning.manifest, kitVersion: "0.2.0" }, contents: { home: "home v2\n", board: "board v2\n" } };
    const items = await planManaged(v, newer, first.state, planningRoles);
    expect(items.find(i => i.file.id === "home")!.action).toBe("keep");
    expect(items.find(i => i.file.id === "board")!.action).toBe("fast-forward");
    await applyManaged(v, newer, items, first.state, opts);
    expect(v.files["00 Home.md"]).toBe("home\n");
    expect(v.files["00 Planning/To-do board.base"]).toBe("board v2\n");
  });
});

// Phase 2: chemical database and lab book base, placed by the Lab notebook folder settings; New lab entry
describe("lab kit completion (Phase 2)", () => {
  const opts = { baseDir: ".obsidian/plugins/lab-kit/kit-base", backups: "Backups", stamp: "2026-10-07T12:00:00.000Z" };
  const memVault = (files: Record<string, string> = {}): ManagedAdapter & { files: Record<string, string> } => ({
    files,
    exists: async (p: string) => p in files,
    read: async (p: string) => { if (!(p in files)) throw new Error("ENOENT " + p); return files[p]; },
    write: async (p: string, d: string) => { files[p] = d; },
    mkdir: async () => {},
  }) as unknown as ManagedAdapter & { files: Record<string, string> };
  const base = { templates: "Extras/Templates/Lab Kit", userScripts: "Extras/scripts/templater/lab-kit", scripts: "Extras/scripts/lab-kit", cssSnippets: ".obsidian/snippets", backups: "Backups" };
  const NEW = ["tpl-chemical-database-template-md", "note-chemical-database-base", "note-lab-book-base-base"];
  const byId = (items: { file: { id: string } }[], id: string) => items.find(i => i.file.id === id) as any;

  it("Lab Book Template: Status is text (issue #32) and the title box uses vtAsk with Templater's prompt as fallback", () => {
    const text = real.contents["tpl-lab-book-template-md"];
    expect(text).toMatch(/^Status: Planned$/m);
    expect(text).toContain('tp.user.vtAsk ? tp.user.vtAsk(tp, "Experiment title") : tp.system.prompt("Experiment title")');
  });

  it("a fresh vault (default folders) installs the chemical template and both bases next to the default folders", async () => {
    const data = kitLoad(undefined);
    expect([data.labFolder, data.chemicalFolder]).toEqual(["03 Lab Book/Notes", "05 Chemicals/Chemicals"]);
    const v = memVault();
    const items = await planManaged(v, real, null, { ...kitFolderRoles(data), ...base }, null, null, offIds(real, {}, data));
    for (const id of NEW) expect(byId(items, id).action).toBe("create");
    expect(byId(items, "note-chemical-database-base").dest).toBe("05 Chemicals/Chemical database.base");
    expect(byId(items, "note-lab-book-base-base").dest).toBe("03 Lab Book/Lab book base.base");
    expect(byId(items, "tpl-chemical-database-template-md").dest).toBe("Extras/Templates/Lab Kit/Chemical database template.md");
  });

  it("the bases' filters follow the folder settings", async () => {
    const roles = { ...kitFolderRoles({ labFolder: "Lab/Entries", chemicalFolder: "Chem" }), ...base };
    const items = await planManaged(memVault(), real, null, roles);
    const chem = byId(items, "note-chemical-database-base"), lab = byId(items, "note-lab-book-base-base");
    expect(chem.dest).toBe("Chemical database.base");                // folder at the vault root: the base goes at the root
    expect(chem.text).toContain('file.inFolder("Chem")');
    expect(lab.dest).toBe("Lab/Lab book base.base");
    expect(lab.text).toContain('file.inFolder("Lab/Entries")');
    expect(lab.text).not.toContain("03 Lab Book");
  });

  it("an existing install (saved before this version, no chemical folder) gets none of the new files", async () => {
    const saved = JSON.parse(readFileSync("tests/fixtures/data-0.5.2.json", "utf8")).kit;
    const data = kitLoad({ ...saved, chemicalFolder: "" });
    expect(data.labFolder).toBe("");
    const off = offIds(real, kitSlot(data, "lab").off, data);
    for (const id of NEW) expect(off.has(id), id).toBe(true);
    const v = memVault();
    const items = await planManaged(v, real, null, { ...kitFolderRoles(data), ...base }, null, null, off);
    for (const id of NEW) expect(byId(items, id).action).toBe("off");
    await applyManaged(v, real, items, null, opts);
    expect(Object.keys(v.files).some(p => p.endsWith(".base") || p.endsWith("Chemical database template.md"))).toBe(false);
  });

  it("setting the folders later switches them on; a same-named base already there is left alone", async () => {
    const data = { ...KIT_DEFAULTS, labFolder: "", chemicalFolder: "" };
    expect(offIds(real, {}, data).has("note-lab-book-base-base")).toBe(true);
    data.labFolder = "03 Lab Book/Notes"; data.chemicalFolder = "05 Chemicals/Chemicals";
    const off = offIds(real, {}, data);
    for (const id of NEW) expect(off.has(id)).toBe(false);
    const mine = "views:\n  - type: table\n";
    const v = memVault({ "03 Lab Book/Lab book base.base": mine });
    const items = await planManaged(v, real, null, { ...kitFolderRoles(data), ...base }, null, null, off);
    expect(byId(items, "note-lab-book-base-base").action).toBe("keep");
    expect(byId(items, "note-chemical-database-base").action).toBe("create");
    await applyManaged(v, real, items, null, opts);
    expect(v.files["03 Lab Book/Lab book base.base"]).toBe(mine);
    expect(v.files["05 Chemicals/Chemical database.base"]).toContain('file.inFolder("05 Chemicals/Chemicals")');
  });

  it("files you switch off stay off even with the folder set", () => {
    expect(offIds(real, { "note-chemical-database-base": true }, KIT_DEFAULTS).has("note-chemical-database-base")).toBe(true);
    expect(offIds(real, {}, KIT_DEFAULTS).size).toBe(0);
  });

  it("New lab entry: says what is missing, else gives the template and folder", () => {
    const ok = { templater: true, template: "Extras/Templates/Lab Kit/Lab Book Template.md", labFolder: " 03 Lab Book/Notes/ " };
    expect(newLabEntryTarget(ok)).toEqual({ template: ok.template, folder: "03 Lab Book/Notes" });
    expect(newLabEntryTarget({ ...ok, templater: false })).toHaveProperty("error", expect.stringContaining("Templater"));
    expect(newLabEntryTarget({ ...ok, labFolder: "" })).toHaveProperty("error", expect.stringContaining("Lab notes folder"));
    expect(newLabEntryTarget({ ...ok, template: null })).toHaveProperty("error", expect.stringContaining("Lab Book Template"));
  });
});
