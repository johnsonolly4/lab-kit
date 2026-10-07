// Phase 3: the planning kit's files (kits/planning): roles, policies, installs next to an old copy of the suite without overwriting it.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { applyManaged, offIds, planManaged, previewInstall, trackedRoles, type EmbeddedKit, type ManagedAdapter } from "../src/kit/managed";
import { PLANNING_LAYOUT, kitJoin, planningRoles } from "../src/kit/paths";
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
  const roles = planningRoles(app(), {});

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
    expect(off).toEqual(["04 Literature/Literature.md", "Extras/Templates/ZotLit/zotlit-content.liquid.md", "Extras/Templates/ZotLit/zotlit-lititem.liquid.md", "Extras/Templates/ZotLit/zotlit-note.liquid.md"]);
    const v = memVault();
    const items = await planManaged(v, planning, null, roles, null, null, offIds(planning, {}, {}, ZOTLIT));
    expect(items.every(i => i.action === "create")).toBe(true);
    expect(Object.keys(v.files)).toEqual([]);
    const out = await applyManaged(v, planning, items, null, opts);
    for (const d of ["00 Home.md", "00 Planning/To-do board.base", "Extras/Templates/ZotLit/zotlit-note.liquid.md", "Extras/scripts/templater/vault/vtAsk.js", ".obsidian/snippets/vault-theme.css", "08 Meetings/Weekly meetings/Weekly meetings.md"]) expect(v.files[d], d).toBeDefined();
    const again = await planManaged(v, planning, out.state, planningRoles(app(), trackedRoles(planning, out.state)), null, null, offIds(planning, {}, {}, ZOTLIT));
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
    const r = planningRoles(app(tpl), {});
    expect(r.userScripts).toBe("My scripts/vault");
    expect(r.templates).toBe("Templates");
    expect(tpl.user_scripts_folder).toBe("My scripts");
    expect(planningRoles(app(tpl), { templates: "Elsewhere" }).templates).toBe("Elsewhere");   // tracked wins
  });

  it("note folders are the folder contract (no rewrite until Phase 5): the files' folder literals are the defaults", () => {
    expect(planning.manifest.rewrite).toEqual({});
    // each note sits in its role's folder in the kit's source too, so the folder names written inside the notes match where they land
    for (const f of planning.manifest.files.filter(x => x.kind === "note")) expect(kitJoin(roles[f.role], f.dest), f.src).toBe(f.src);
    expect(roles.planning).toBe(PLANNING_LAYOUT.planning);
  });

  it("lab and planning kits together: no two files share a place, and the scripts sit in sibling folders", () => {
    const labRoles = { templates: "Extras/Templates/Lab Kit", userScripts: "Extras/scripts/templater/lab-kit", scripts: "Extras/scripts/lab-kit", cssSnippets: ".obsidian/snippets", labBase: "03 Lab Book", chemicalBase: "05 Chemicals" };
    const all = [...dests(lab, labRoles), ...dests(planning, roles)];
    expect(new Set(all).size).toBe(all.length);
    const names = new Set(lab.manifest.files.map(f => f.dest.split("/").pop()));
    for (const f of planning.manifest.files) if (f.role === "userScripts") expect(names.has(f.dest.split("/").pop())).toBe(false);
  });

  it("leaves the planning notes' text as supplied", () => {
    const home = planning.manifest.files.find(f => f.src === "00 Home.md")!;
    expect(planning.contents[home.id]).toBe(readFileSync("docs/plans/kit-files/planning/00 Home.md", "utf8").replace(/\r\n/g, "\n"));
  });
});
