// Phase 1 of docs/plans/base-filters-follow-folders.md: after a folder setting changes or a folder is renamed in Obsidian,
// do the kit's three .base boards get the new folder in their filter line (planFolderReapply + applyManaged), or are they reported?
import { describe, it, expect } from "vitest";
import { applyManaged, inFolders, offIds, patchFolders, patchManagedFolders, planFolderReapply, planManaged, trackedRoles, followRename, type EmbeddedKit, type ManagedAdapter, type ManagedState, type Roles } from "../src/kit/managed";
import { PLANNING_FOLDER_DEFAULTS, followFolderRename, kitFolderRoles, planningRoles, type PlanningFolders } from "../src/kit/paths";
// @ts-expect-error plain .mjs build helper
import { embeddedKit } from "../scripts/embed-kit.mjs";

const planning = embeddedKit("kits/planning") as EmbeddedKit;
const lab = embeddedKit("kits/lab") as EmbeddedKit;
const opts = { baseDir: ".obsidian/plugins/lab-kit/kit-base", backups: "Backups", stamp: "2026-10-09T12:00:00.000Z" };
type Vault = ManagedAdapter & { files: Record<string, string> };
const memVault = (files: Record<string, string> = {}): Vault => ({
  files,
  exists: async (p: string) => p in files,
  read: async (p: string) => { if (!(p in files)) throw new Error("ENOENT " + p); return files[p]; },
  write: async (p: string, d: string) => { files[p] = d; },
  mkdir: async () => {},
}) as unknown as Vault;
const app = (): any => ({ vault: { configDir: ".obsidian" }, plugins: { plugins: { "templater-obsidian": { settings: {} } } } });

/** The settings the plugin keeps (`kit.planningFolders`, `labFolder`, `chemicalFolder`), as the UI changes them. */
interface Settings { pf: PlanningFolders; labFolder: string; chemicalFolder: string }
const defaults = (): Settings => ({ pf: { ...PLANNING_FOLDER_DEFAULTS }, labFolder: "03 Lab Book/Notes", chemicalFolder: "05 Chemicals/Chemicals" });

/** Roles as `KitManager.roles()` computes them (src/kit/managed-ui.ts:35), without the vault scan that only finds scripts. */
const rolesOf = (id: "planning" | "lab", s: Settings, state: ManagedState | null): Roles => {
  const kit = id === "planning" ? planning : lab;
  const tracked = trackedRoles(kit, state);
  return id === "planning" ? planningRoles(app(), tracked, s.pf, s.labFolder) : { ...kitFolderRoles(s), ...tracked };
};
const BASES = [
  { kit: "planning" as const, dest: "To-do board.base", old: "00 Planning/To-dos", change: (s: Settings) => { s.pf.planning = "10 Plan"; }, now: '"10 Plan/To-dos"' },
  { kit: "lab" as const, dest: "Lab book base.base", old: "03 Lab Book/Notes", change: (s: Settings) => { s.labFolder = "03 Lab Book/Entries"; }, now: '"03 Lab Book/Entries"' },
  { kit: "lab" as const, dest: "Chemical database.base", old: "05 Chemicals/Chemicals", change: (s: Settings) => { s.chemicalFolder = "05 Chemicals/Stock"; }, now: '"05 Chemicals/Stock"' },
];
const bundle = (id: "planning" | "lab"): EmbeddedKit => (id === "planning" ? planning : lab);
const offFor = (id: "planning" | "lab", s: Settings) => offIds(bundle(id), {}, { labFolder: s.labFolder, chemicalFolder: s.chemicalFolder }, new Set(["literature"]));

/** A vault with the kit installed at the default folders. */
async function install(id: "planning" | "lab", s: Settings): Promise<{ v: Vault; state: ManagedState }> {
  const v = memVault();
  const items = await planManaged(v, bundle(id), null, rolesOf(id, s, null), null, null, offFor(id, s));
  const out = await applyManaged(v, bundle(id), items, null, opts);
  return { v, state: out.state };
}
/** What `reapplyFolders` does: plan with the new settings, split into rewrite / kept, write the rewrites. */
async function reapply(id: "planning" | "lab", s: Settings, v: Vault, state: ManagedState) {
  const items = await planManaged(v, bundle(id), state, rolesOf(id, s, state), null, opts.baseDir, offFor(id, s));
  const plan = await planFolderReapply(v, items, state, opts.baseDir);
  const res = await applyManaged(v, bundle(id), plan.rewrite, state, { ...opts, keepVersion: true, select: () => true });
  return { plan, state: res.state };
}
/** The vault renames a folder: files move, tracked paths and folder settings follow (src/kit/ui.ts:304-327). */
function renameFolder(v: Vault, states: ManagedState[], s: Settings, from: string, to: string): void {
  for (const p of Object.keys(v.files)) if (p === from || p.startsWith(from + "/")) { v.files[to + p.slice(from.length)] = v.files[p]; delete v.files[p]; }
  for (const st of states) followRename(st, from, to);
  for (const k of Object.keys(s.pf) as (keyof PlanningFolders)[]) s.pf[k] = followFolderRename(s.pf[k], from, to) ?? s.pf[k];
  s.labFolder = followFolderRename(s.labFolder, from, to) ?? s.labFolder;
  s.chemicalFolder = followFolderRename(s.chemicalFolder, from, to) ?? s.chemicalFolder;
}
const pathOf = (state: ManagedState, kit: EmbeddedKit, dest: string): string => state.files[kit.manifest.files.find(f => f.dest === dest)!.id].path;
const idOf = (kit: EmbeddedKit, dest: string): string => kit.manifest.files.find(f => f.dest === dest)!.id;
const filterLine = (text: string): string => text.split("\n").find(l => l.includes("file.inFolder"))!;

describe("kit .base filters follow a folder setting change", () => {
  for (const b of BASES) {
    it(`${b.dest}: unedited, installed at the current version → rewritten with the new folder`, async () => {
      const s = defaults();
      const { v, state } = await install(b.kit, s);
      const path = pathOf(state, bundle(b.kit), b.dest);
      expect(filterLine(v.files[path])).toContain(`"${b.old}`);
      b.change(s);
      const r = await reapply(b.kit, s, v, state);
      expect(r.plan.rewrite.map(i => i.dest), "rewrite list").toContain(path);
      expect(filterLine(v.files[path])).toContain(b.now);
    });

    it(`${b.dest}: edited by the user, original saved → kept and reported (not silently left)`, async () => {
      const s = defaults();
      const { v, state } = await install(b.kit, s);
      const path = pathOf(state, bundle(b.kit), b.dest);
      v.files[path] += "\n# my note\n";
      v.files[`${opts.baseDir}/${idOf(bundle(b.kit), b.dest)}.txt`] = bundle(b.kit).contents[idOf(bundle(b.kit), b.dest)];
      b.change(s);
      const r = await reapply(b.kit, s, v, state);
      expect(r.plan.kept.map(i => i.dest)).toContain(path);
      expect(filterLine(v.files[path])).toContain(`"${b.old}`);
    });

    it(`${b.dest}: edited by the user, NO saved original → reported too`, async () => {
      const s = defaults();
      const { v, state } = await install(b.kit, s);
      const path = pathOf(state, bundle(b.kit), b.dest);
      v.files[path] += "\n# my note\n";
      b.change(s);
      const r = await reapply(b.kit, s, v, state);
      expect(r.plan.kept.map(i => i.dest), "kept list (no base copy)").toContain(path);
    });

    it(`${b.dest}: installed by an older kit version → listed as skipped (reported, not rewritten)`, async () => {
      const s = defaults();
      const { v, state } = await install(b.kit, s);
      const path = pathOf(state, bundle(b.kit), b.dest);
      state.files[idOf(bundle(b.kit), b.dest)].installedVersion = "0.4.0";
      b.change(s);
      const r = await reapply(b.kit, s, v, state);
      expect(r.plan.rewrite.map(i => i.dest)).not.toContain(path);
      expect(r.plan.skipped.map(i => i.dest)).toContain(path);
      expect(filterLine(v.files[path])).toContain(`"${b.old}`);
    });
  }
});

describe("Obsidian re-saves a .base (reproduced by the user 2026-10-09: planning folder renamed to \"00 Planning moved\", board empty)", () => {
  // Opening the board in Obsidian rewrote the file with the keys in another order: same meaning, different bytes
  const reorder = (t: string): string => t.replace("    columnWidth: 270\n", "").replace("      - done\n", "      - done\n    columnWidth: 270\n");
  it("To-do board: a re-ordered but unchanged file counts as edited, so the rename does not reach its filter", async () => {
    const s = defaults();
    const { v, state } = await install("planning", s);
    const path = pathOf(state, planning, "To-do board.base");
    v.files[path] = reorder(v.files[path]);
    expect(v.files[path]).not.toBe(planning.contents[idOf(planning, "To-do board.base")]);
    v.files[`${opts.baseDir}/${idOf(planning, "To-do board.base")}.txt`] = planning.contents[idOf(planning, "To-do board.base")];
    renameFolder(v, [state], s, "00 Planning", "00 Planning moved");
    const r = await reapply("planning", s, v, state);
    const moved = "00 Planning moved/To-do board.base";
    // CAUSE: not rewritten as an unedited file; it is kept, and the filter stays on the old folder until patched
    expect(r.plan.rewrite.map(i => i.dest)).not.toContain(moved);
    expect(r.plan.kept.map(i => i.dest)).toContain(moved);
    expect(filterLine(v.files[moved])).toContain('"00 Planning/To-dos"');
    // Phase 2: patch only the folder, after a backup; key order and the rest stay as Obsidian saved them
    const item = r.plan.kept.find(i => i.dest === moved)!;
    const before = v.files[moved];
    const text = patchFolders(before, item.text)!;
    expect(text).toBe(before.replace('"00 Planning/To-dos"', '"00 Planning moved/To-dos"'));
    const hash = r.state.files[item.file.id].installedHash;
    const backups = await patchManagedFolders(v, [{ item, text }], opts);
    expect(v.files[backups[0]]).toBe(before);
    expect(filterLine(v.files[moved])).toContain('"00 Planning moved/To-dos"');
    expect(v.files[moved]).toBe(text);
    expect(r.state.files[item.file.id].installedHash).toBe(hash);   // still "yours" for later updates
    // second pass: the filter is right, so nothing is left to report
    const again = await reapply("planning", s, v, r.state);
    expect(inFolders(v.files[moved])).toEqual(inFolders(again.plan.kept.concat(again.plan.skipped).find(i => i.dest === moved)?.text ?? v.files[moved]));
  });

  it("patchFolders: nothing to change or filters that do not line up → null; only the folder strings change", () => {
    const a = 'filters:\n  and:\n    - file.inFolder("A/x")\n    - file.inFolder("B")\nmine: true\n';
    expect(patchFolders(a, 'file.inFolder("A/x") file.inFolder("B")')).toBeNull();
    expect(patchFolders(a, 'file.inFolder("A/y")')).toBeNull();   // different count
    expect(patchFolders("no filter here", 'file.inFolder("A/y")')).toBeNull();
    expect(patchFolders(a, 'file.inFolder("A/y") file.inFolder("B")')).toBe(a.replace("A/x", "A/y"));
  });
});

describe("kit .base filters follow a folder renamed in Obsidian", () => {
  it("To-do board: planning folder renamed (the base moves with it)", async () => {
    const s = defaults();
    const { v, state } = await install("planning", s);
    v.files["00 Planning/To-dos/Buy gloves.md"] = "---\nday: Backlog\n---\n";
    renameFolder(v, [state], s, "00 Planning", "10 Plan");
    expect(s.pf.planning).toBe("10 Plan");
    const path = pathOf(state, planning, "To-do board.base");
    expect(path).toBe("10 Plan/To-do board.base");
    const r = await reapply("planning", s, v, state);
    expect(r.plan.rewrite.map(i => i.dest)).toContain(path);
    expect(filterLine(v.files[path])).toContain('"10 Plan/To-dos"');
  });

  it("To-do board: only the To-dos subfolder renamed → planning setting stays, the filter is reported", async () => {
    const s = defaults();
    const { v, state } = await install("planning", s);
    renameFolder(v, [state], s, "00 Planning/To-dos", "00 Planning/Tasks");
    // no setting holds the to-dos folder (it is always <planning>/To-dos): nothing can follow this rename
    expect(s.pf.planning).toBe("00 Planning");
    const r = await reapply("planning", s, v, state);
    expect(filterLine(v.files[pathOf(state, planning, "To-do board.base")])).toContain('"00 Planning/To-dos"');
    expect(r.plan.rewrite).toEqual([]);
  });

  it("Lab book: the Notes folder renamed", async () => {
    const s = defaults();
    const { v, state } = await install("lab", s);
    renameFolder(v, [state], s, "03 Lab Book/Notes", "03 Lab Book/Entries");
    expect(s.labFolder).toBe("03 Lab Book/Entries");
    const r = await reapply("lab", s, v, state);
    const path = pathOf(state, lab, "Lab book base.base");
    expect(r.plan.rewrite.map(i => i.dest)).toContain(path);
    expect(filterLine(v.files[path])).toContain('"03 Lab Book/Entries"');
  });

  it("Lab book: the parent (Lab Book) folder renamed, base and notes move together", async () => {
    const s = defaults();
    const { v, state } = await install("lab", s);
    renameFolder(v, [state], s, "03 Lab Book", "Lab");
    expect(s.labFolder).toBe("Lab/Notes");
    const r = await reapply("lab", s, v, state);
    const path = pathOf(state, lab, "Lab book base.base");
    expect(path).toBe("Lab/Lab book base.base");
    expect(r.plan.rewrite.map(i => i.dest)).toContain(path);
    expect(filterLine(v.files[path])).toContain('"Lab/Notes"');
  });

  it("Chemical database: the Chemicals folder renamed", async () => {
    const s = defaults();
    const { v, state } = await install("lab", s);
    renameFolder(v, [state], s, "05 Chemicals/Chemicals", "05 Chemicals/Stock");
    const r = await reapply("lab", s, v, state);
    const path = pathOf(state, lab, "Chemical database.base");
    expect(r.plan.rewrite.map(i => i.dest)).toContain(path);
    expect(filterLine(v.files[path])).toContain('"05 Chemicals/Stock"');
  });

  it("Chemical database: the parent (05 Chemicals) folder renamed", async () => {
    const s = defaults();
    const { v, state } = await install("lab", s);
    renameFolder(v, [state], s, "05 Chemicals", "Chems");
    const r = await reapply("lab", s, v, state);
    const path = pathOf(state, lab, "Chemical database.base");
    expect(r.plan.rewrite.map(i => i.dest)).toContain(path);
    expect(filterLine(v.files[path])).toContain('"Chems/Chemicals"');
  });

  it("planning kit and lab kit together: renaming the lab folder also fixes the planning notes that list experiments", async () => {
    const s = defaults();
    const p = await install("planning", s), l = await install("lab", s);
    renameFolder(p.v, [p.state], s, "03 Lab Book", "Lab");   // planning vault copy: no such folder, settings still follow
    const r = await reapply("planning", s, p.v, p.state);
    expect(r.plan.rewrite.length).toBeGreaterThan(0);
    for (const it of r.plan.rewrite) expect(it.text).not.toContain("03 Lab Book/Notes");
    expect(l.state).toBeDefined();
  });
});
