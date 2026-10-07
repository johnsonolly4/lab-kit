// First install of the built-in kit (CSS snippet, Templater's user scripts folder) and the version compare behind the update notice.
import { describe, it, expect } from "vitest";
import {
  applyManaged, firstInstallOptions, planManaged, relocateRole, templaterScriptsAction, trackedRoles,
  type EmbeddedKit, type ManagedAdapter, type ManagedState
} from "../src/kit/managed";
import { kitCompare, kitDetectRoles } from "../src/kit/paths";
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

  it("(c) a fresh vault: Templater is offered the parent, the scripts go into <parent>/lab-kit", async () => {
    const v = memVault();
    const state = await install(v, {});
    const kitFolder = trackedRoles(kit, state).userScripts;
    expect(kitFolder).toBe("scripts/lab-kit");
    expect(v.files["scripts/lab-kit/labForm.js"]).toBe("form\n");
    expect(firstInstallOptions(real, { installed: true }, kitFolder).templaterFolder).toBe("scripts");
    expect(templaterScriptsAction("", kitFolder)).toEqual({ kind: "set", folder: "scripts" });
    expect(templaterScriptsAction("scripts", kitFolder)).toEqual({ kind: "ok" });
  });

  it("(d) an older install outside the folder: Set up installs new copies into <folder>/lab-kit; old copies untouched; cancel writes nothing", async () => {
    const v = memVault({ ...userFiles });
    const state = await install(v, {});                                       // older install: scripts/lab-kit, Templater then pointed elsewhere
    v.files["scripts/lab-kit/labForm.js"] = "form, edited\n";
    const before = { ...v.files };
    const action = templaterScriptsAction("My scripts", trackedRoles(kit, state).userScripts);
    expect(action).toEqual({ kind: "relocate", to: "My scripts/lab-kit" });
    if (action.kind !== "relocate") return;

    const moved = relocateRole(kit, state, "userScripts");
    expect(moved.old.sort()).toEqual(["scripts/lab-kit/labForm.js", "scripts/lab-kit/labMethods.js"]);
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
