// Phase 3: the planning kit's files (kits/planning): roles, policies, installs next to an old copy of the suite without overwriting it.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { applyManaged, kitText, offIds, planManaged, previewInstall, trackedRoles, type EmbeddedKit, type ManagedAdapter } from "../src/kit/managed";
import { PLANNING_FOLDER_DEFAULTS, kitJoin, kitLoad, kitSlot, labFolders, planningFolders, planningRoles } from "../src/kit/paths";
import { addMetaBindButtons, loadedPlugins, metaBindButtonIds, navigatorHomepage, setNavigatorHomepage } from "../src/kit/obsidian-private";
import { PLANNING_BUTTONS } from "../src/planning/buttons";
// @ts-expect-error plain .mjs build helper
import { embeddedKit, embeddedKits } from "../scripts/embed-kit.mjs";

const planning = embeddedKit("kits/planning") as EmbeddedKit;
const lab = embeddedKit("kits/lab") as EmbeddedKit;
const opts = { baseDir: ".obsidian/plugins/lab-kit/kit-base", backups: "Backups", stamp: "2026-10-07T12:00:00.000Z" };
const memVault = (files: Record<string, string> = {}): ManagedAdapter & { files: Record<string, string> } => ({
  files,
  exists: async (p: string) => p in files,
  read: async (p: string) => { if (!(p in files)) throw new Error("ENOENT " + p); return files[p]; },
  write: async (p: string, d: string) => { files[p] = d; },
  mkdir: async () => {},
}) as unknown as ManagedAdapter & { files: Record<string, string> };
const app = (tpl: object = {}): any => ({ vault: { configDir: ".obsidian" }, plugins: { plugins: { "templater-obsidian": { settings: tpl } } } });
const ZOTLIT = new Set(["zotlit"]);
const dests = (kit: EmbeddedKit, roles: Record<string, string>) => kit.manifest.files.map(f => kitJoin(roles[f.role], f.dest));

describe("planning kit files (Phase 3)", () => {
  const roles = planningRoles(app(), {}, PLANNING_FOLDER_DEFAULTS);

  it("is embedded next to the lab kit, at the same version", () => {
    const all = embeddedKits() as { kits: EmbeddedKit[] };
    expect(all.kits.map(k => k.manifest.id)).toEqual(["lab", "planning"]);
    expect(planning.manifest.kitVersion).toBe(lab.manifest.kitVersion);
    expect(planning.manifest.templater?.userScripts).toBe(true);
    expect(planning.manifest.enableCss).toEqual(["vault-colours.css", "vault-theme.css"]);
  });

  it("every file has a role, a kind and a description; notes are kept, templates / scripts / CSS are updated", () => {
    for (const f of planning.manifest.files) {
      expect(roles[f.role], f.src).toBeDefined();
      expect(f.desc?.length ?? 0, f.src).toBeGreaterThan(5);
      expect(f.policy === "keep", f.src).toBe(!f.src.startsWith("Extras/") && !f.src.startsWith(".obsidian/"));
    }
    expect(planning.manifest.files.find(f => f.src === "00 Home.md")).toMatchObject({ role: "home", dest: "00 Home.md", kind: "note" });
  });

  it("ships only what Phase 3 lists: no settings data, roll-over, Thursday deck, fonts or Finder files", () => {
    const walk = (d: string): string[] => readdirSync(d).flatMap(n => statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]);
    const onDisk = walk("kits/planning").map(p => p.slice("kits/planning/".length)).filter(p => p !== "kit-manifest.json").sort();
    expect(onDisk).toEqual(planning.manifest.files.map(f => f.src).sort());
    for (const p of onDisk) expect(p).not.toMatch(/^settings\/|To-do roll-over|Open Thursday deck|vault-fonts|\.DS_Store/);
  });

  it("holds no personal paths", () => {
    for (const f of planning.manifest.files) expect(planning.contents[f.id], f.src).not.toMatch(/\/Users\/|C:\\\\Users|\\\\Users\\\\|@gmail|johnsonolly4/);
  });

  it("goes to the folder contract in a new vault; ZotLit files only with ZotLit", async () => {
    expect(roles.templates).toBe("Extras/Templates");
    expect(roles.userScripts).toBe("Extras/scripts/templater/vault");
    const without = await planManaged(memVault(), planning, null, roles, null, null, offIds(planning, {}, {}));
    const off = without.filter(i => i.action === "off").map(i => i.file.src).sort();
    expect(off).toEqual(["04 Literature/Literature.md", "07 How-tos/Obsidian/Set up ZotLit.md", "Extras/Templates/ZotLit/zotlit-content.liquid.md", "Extras/Templates/ZotLit/zotlit-lititem.liquid.md", "Extras/Templates/ZotLit/zotlit-note.liquid.md"]);
    const v = memVault();
    const items = await planManaged(v, planning, null, roles, null, null, offIds(planning, {}, {}, ZOTLIT));
    expect(items.every(i => i.action === "create")).toBe(true);
    expect(Object.keys(v.files)).toEqual([]);
    const out = await applyManaged(v, planning, items, null, opts);
    for (const d of ["00 Home.md", "00 Planning/To-do board.base", "Extras/Templates/ZotLit/zotlit-note.liquid.md", "Extras/scripts/templater/vault/vtAsk.js", ".obsidian/snippets/vault-theme.css", "08 Meetings/Weekly meetings/Weekly meetings.md"]) expect(v.files[d], d).toBeDefined();
    const again = await planManaged(v, planning, out.state, planningRoles(app(), trackedRoles(planning, out.state), PLANNING_FOLDER_DEFAULTS), null, null, offIds(planning, {}, {}, ZOTLIT));
    expect(again.every(i => i.action === "up-to-date")).toBe(true);
  });

  it("a vault with the old suite files: none is overwritten, each is listed as left alone", async () => {
    const old: Record<string, string> = {};
    for (const d of dests(planning, roles)) old[d] = `my own ${d}\n`;
    const v = memVault({ ...old });
    const items = await planManaged(v, planning, null, roles, null, null, offIds(planning, {}, {}, ZOTLIT));
    const preview = await previewInstall(v, items);
    expect(preview.create).toEqual([]);
    expect([...preview.leftAlone].sort()).toEqual(Object.keys(old).sort());
    await applyManaged(v, planning, items, null, opts);
    expect(v.files).toEqual(old);
  });

  it("a Templater user scripts folder that is set is kept: vtAsk.js goes into its vault/ subfolder", () => {
    const tpl = { user_scripts_folder: "My scripts", templates_folder: "Templates" };
    const r = planningRoles(app(tpl), {}, PLANNING_FOLDER_DEFAULTS);
    expect(r.userScripts).toBe("My scripts/vault");
    expect(r.templates).toBe("Templates");
    expect(tpl.user_scripts_folder).toBe("My scripts");
    expect(planningRoles(app(tpl), { templates: "Elsewhere" }, PLANNING_FOLDER_DEFAULTS).templates).toBe("Elsewhere");   // tracked wins
  });

  it("with default settings each note lands where it sits in the kit's source (folder names inside the notes match)", () => {
    // each note sits in its role's folder in the kit's source too, so the folder names written inside the notes match where they land
    for (const f of planning.manifest.files.filter(x => x.kind === "note")) expect(kitJoin(roles[f.role], f.dest), f.src).toBe(f.src);
    expect(roles.planning).toBe(PLANNING_FOLDER_DEFAULTS.planning);
  });

  it("Phase 5a: every planning folder setting is rewritten into the kit files: no default folder name is left", () => {
    const moved = Object.fromEntries(Object.entries(PLANNING_FOLDER_DEFAULTS).map(([k, v]) => [k, `Z ${k}`])) as typeof PLANNING_FOLDER_DEFAULTS;
    const r = planningRoles(app(), {}, moved, "Lab/Entries");
    expect(r.planning).toBe("Z planning");
    expect(r.labNotes).toBe("Lab/Entries");
    expect(planningRoles(app(), { planning: "Old" }, moved).planning).toBe("Z planning");   // the setting wins over where files were tracked
    const literals = [...Object.values(PLANNING_FOLDER_DEFAULTS), "03 Lab Book/Notes"];
    for (const f of planning.manifest.files) {
      const text = kitText(planning, f, r);
      for (const lit of literals) expect(text.includes(lit), `${f.src}: ${lit}`).toBe(false);
    }
    // one pass: a folder written in is not rewritten again (planning inside the old projects name, and swapped names)
    const nested = planningRoles(app(), {}, { ...PLANNING_FOLDER_DEFAULTS, planning: "02 Projects/Plan", projects: "Work" });
    const tpl = planning.manifest.files.find(f => f.dest === "To-do.md")!;
    expect(kitText(planning, tpl, nested)).toContain('"02 Projects/Plan/To-dos"');
    const swapped = planningRoles(app(), {}, { ...PLANNING_FOLDER_DEFAULTS, planning: "02 Projects", projects: "00 Planning" });
    const board0 = planning.manifest.files.find(f => f.dest === "To-do board.base")!;
    expect(kitText(planning, board0, swapped)).toContain('file.inFolder("02 Projects/To-dos")');
    // the To-do board reads the moved to-dos folder
    const board = planning.manifest.files.find(f => f.dest === "To-do board.base")!;
    expect(kitText(planning, board, r)).toContain('file.inFolder("Z planning/To-dos")');
  });

  it("lab and planning kits together: no two files share a place, and the scripts sit in sibling folders", () => {
    const labRoles = { templates: "Extras/Templates/Lab Kit", userScripts: "Extras/scripts/templater/lab-kit", scripts: "Extras/scripts/lab-kit", cssSnippets: ".obsidian/snippets", labBase: "03 Lab Book", chemicalBase: "05 Chemicals" };
    const all = [...dests(lab, labRoles), ...dests(planning, roles)];
    expect(new Set(all).size).toBe(all.length);
    const names = new Set(lab.manifest.files.map(f => f.dest.split("/").pop()));
    for (const f of planning.manifest.files) if (f.role === "userScripts") expect(names.has(f.dest.split("/").pop())).toBe(false);
  });

  it("homepage: as supplied up to the Go to box; Phase 5a blocks replace the go buttons and the Dataview lists", () => {
    const home = planning.contents[planning.manifest.files.find(f => f.src === "00 Home.md")!.id];
    const supplied = readFileSync("docs/plans/kit-files/planning/00 Home.md", "utf8").replace(/\r\n/g, "\n");
    const head = (t: string) => t.slice(0, t.indexOf("> [!goto]"));
    expect(head(home)).toBe(head(supplied));
    expect(home).toContain("> ```vault-goto");
    for (const show of ["this-week", "inbox", "experiments", "projects", "recently-read"]) expect(home).toContain(`show: ${show}`);
    expect(home).not.toContain("```dataview");
    expect(home).not.toMatch(/BUTTON\[go-/);
    const overview = planning.contents[planning.manifest.files.find(f => f.src.endsWith("Projects overview.md"))!.id];
    expect(overview).toContain("```vault-projects");
    expect(overview).not.toContain("dataviewjs");
  });
});

describe("planning kit switch (Phase 6a)", () => {
  it("a planning slot made on first read starts off; the lab slot starts on", () => {
    const kit = kitLoad(undefined);
    expect(kitSlot(kit, "planning").enabled).toBe(false);
    expect(kitSlot(kit, "lab").enabled).toBe(true);
  });

  it("a saved planning switch survives a reload", () => {
    const kit = kitLoad(undefined);
    kitSlot(kit, "planning").enabled = true;
    expect(kitLoad(JSON.parse(JSON.stringify(kit))).kits.planning.enabled).toBe(true);
  });

  it("ZotLit-only files install when ZotLit (plugin id zotlit) is loaded", async () => {
    const withZot = { vault: { configDir: ".obsidian" }, plugins: { plugins: { "zotlit": {} } } } as any;
    expect(loadedPlugins(withZot).has("zotlit")).toBe(true);
    expect(loadedPlugins(app()).has("zotlit")).toBe(false);
    const zotIds = planning.manifest.files.filter(f => f.needs === "plugin:zotlit").map(f => f.id);
    expect(zotIds.length).toBeGreaterThan(0);
    for (const id of zotIds) {
      expect(offIds(planning, {}, {}, loadedPlugins(withZot)).has(id)).toBe(false);
      expect(offIds(planning, {}, {}, loadedPlugins(app())).has(id)).toBe(true);
    }
  });
});

describe("layout folders at install (Phase 6c)", () => {
  const roles = planningRoles(app(), {}, PLANNING_FOLDER_DEFAULTS);
  it("lists the contract folders; Literature only with ZotLit; never 99 Archive", () => {
    const without = planningFolders(roles, false).map(f => f.path);
    expect(without).toEqual(expect.arrayContaining(["00 Inbox", "01 Daily Notes", "00 Planning/To-dos", "06 Knowledge", "07 How-tos", "08 Meetings"]));
    expect(without).not.toContain("04 Literature");
    expect(planningFolders(roles, true).map(f => f.path)).toContain("04 Literature");
    expect([...without, ...planningFolders(roles, true).map(f => f.path)].some(p => p.startsWith("99"))).toBe(false);
  });

  it("follows a moved role", () => {
    expect(planningFolders({ ...roles, meetings: "Meetings" }, false).map(f => f.path)).toContain("Meetings");
  });

  it("the preview adds only missing folders, with what each is for, and says what each file is", async () => {
    const v = memVault();
    const items = await planManaged(v, planning, null, roles, null, null, offIds(planning, {}, {}, ZOTLIT));
    v.files["00 Inbox"] = "";   // exists
    const p = await previewInstall(v, items, it => it.action === "create", planningFolders(roles, false));
    expect(p.folders).toContain("01 Daily Notes");
    expect(p.folders).not.toContain("00 Inbox");
    expect(p.about["01 Daily Notes"]).toMatch(/Daily notes/);
    const withDesc = planning.manifest.files.find(f => f.desc)!;
    expect(p.about[kitJoin(roles[withDesc.role], withDesc.dest)]).toContain(withDesc.desc!.replace(/\.$/, ""));
    for (const c of p.create) expect(p.about[c]).toBeTruthy();
  });

  it("lab note folders only when set", () => {
    expect(labFolders({ labFolder: "03 Lab Book/Notes", chemicalFolder: "" }).map(f => f.path)).toEqual(["03 Lab Book/Notes"]);
  });
});

describe("Meta Bind buttons (Phase 6d)", () => {
  it("adds only the buttons whose id is missing; yours stay as they are", async () => {
    const mine = { id: "today", label: "My today" };
    const mb = { settings: { buttonTemplates: [mine] }, saveSettings: async () => {} };
    const a = { plugins: { plugins: { "obsidian-meta-bind-plugin": mb } } } as any;
    const added = await addMetaBindButtons(a, PLANNING_BUTTONS);
    expect(added).toBe(PLANNING_BUTTONS.length - 1);
    expect(mb.settings.buttonTemplates[0]).toBe(mine);
    expect(await addMetaBindButtons(a, PLANNING_BUTTONS)).toBe(0);
    expect(new Set(metaBindButtonIds(a)).size).toBe(PLANNING_BUTTONS.length);
  });
});

describe("Notebook Navigator homepage (Check setup)", () => {
  const nnApp = (homepage: unknown) => { const nn: any = { settings: { homepage }, saveSettingsAndUpdate: async () => {} }; return { nn, app: { plugins: { plugins: { "notebook-navigator": nn } } } as any }; };
  it("reads the current shape and the old string; sets only when there is none", async () => {
    expect(navigatorHomepage(nnApp("Old.md").app)).toEqual({ source: "file", file: "Old.md" });
    const { nn, app } = nnApp({ source: "none", file: null, createMissingPeriodicNote: false });
    expect(await setNavigatorHomepage(app, "00 Home.md")).toBe(true);
    expect(nn.settings.homepage).toEqual({ source: "file", file: "00 Home.md", createMissingPeriodicNote: false });
    expect(await setNavigatorHomepage(nnApp({ source: "daily-note", file: null }).app, "00 Home.md")).toBe(false);
  });
});
