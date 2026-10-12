// Phase 3: the planning kit's files (kits/planning): roles, policies, installs next to an old copy of the suite without overwriting it.
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { applyManaged, kitText, offIds, planFolderReapply, planManaged, previewInstall, trackedRoles, type EmbeddedKit, type ManagedAdapter } from "../src/kit/managed";
import { PLANNING_FOLDER_DEFAULTS, kitJoin, kitLoad, kitSlot, labFolders, planningFolders, planningRoles } from "../src/kit/paths";
import { addMetaBindButtons, resetMetaBindActions, loadedPlugins, metaBindButtonIds, navigatorHomepage, setNavigatorHomepage } from "../src/kit/obsidian-private";
import { PLANNING_BUTTONS } from "../src/planning/buttons";
import { scan, type TidyContext } from "../src/kit/tidy";
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
    for (const d of ["00 Home.md", "00 Planning/To-do board.base", "Extras/Templates/ZotLit/zotlit-note.liquid.md", "Extras/scripts/templater/vault/vtAsk.js", ".obsidian/snippets/vault-theme.css", "08 Meetings/Meetings.md"]) expect(v.files[d], d).toBeDefined();
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
    for (const [d, text] of Object.entries(old)) expect(v.files[d]).toBe(text);
    // only the kit's own bookkeeping (base copies of the kept files it now tracks) was added
    expect(Object.keys(v.files).filter(f => !(f in old)).every(f => f.startsWith(".obsidian/plugins/lab-kit/kit-base/"))).toBe(true);
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

  it("a folder setting changed after install: unedited kit files get the new folder (backed up), edited ones are kept and reported", async () => {
    const v = memVault();
    const first = await planManaged(v, planning, null, roles, null, null, offIds(planning, {}, {}, ZOTLIT));
    const out = await applyManaged(v, planning, first, null, opts);
    const todo = planning.manifest.files.find(f => f.dest === "To-do.md")!;
    const hub = planning.manifest.files.find(f => f.dest === "Project hub.md")!;
    const todoPath = kitJoin(roles.templates, "To-do.md"), hubPath = kitJoin(roles.templates, "Project hub.md");
    expect(v.files[todoPath]).toContain('"00 Planning/To-dos"');
    v.files[hubPath] += "\n// my own note\n";   // the user edited the project hub template
    const moved = planningRoles(app(), trackedRoles(planning, out.state), { ...PLANNING_FOLDER_DEFAULTS, planning: "10 Plan", projects: "20 Work" });
    const items = await planManaged(v, planning, out.state, moved, null, opts.baseDir, offIds(planning, {}, {}, ZOTLIT));
    const plan = await planFolderReapply(v, items, out.state, opts.baseDir);
    expect(plan.rewrite.map(i => i.file.id)).toContain(todo.id);
    expect(plan.kept.map(i => i.file.id)).toEqual([hub.id]);
    const res = await applyManaged(v, planning, plan.rewrite, out.state, { ...opts, keepVersion: true, select: () => true });
    expect(v.files[todoPath]).toContain('"10 Plan/To-dos"');
    expect(v.files[todoPath]).not.toContain("00 Planning");
    expect(v.files[hubPath]).toContain("02 Projects/${name}");   // edited: untouched
    expect(res.results.find(r => r.id === todo.id)?.backup).toBeDefined();
    // nothing left to do on a second pass
    const again = await planFolderReapply(v, await planManaged(v, planning, res.state, moved, null, opts.baseDir, offIds(planning, {}, {}, ZOTLIT)), res.state, opts.baseDir);
    expect(again.rewrite).toEqual([]);
    expect(again.kept.map(i => i.file.id)).toEqual([hub.id]);
  });

  it("the Project hub template writes kind, Status and the vt / project classes; the New project note template vt and a link to its hub", () => {
    const front = (dest: string): string => readFileSync(join("kits/planning/Extras/Templates", dest), "utf8").replace(/\r\n/g, "\n").split("-%>\n")[1].split("---")[1];
    expect(front("Project hub.md")).toMatch(/kind: project\nStatus: Active\ndeadline:\ncssclasses:\n {2}- vt\n {2}- project\n/);
    // the note links to the folder's hub (when it exists) as a list, then the vt class
    expect(front("New project note.md")).toBe('\n<% hasHub ? `project:\\n  - "[[${hubName}]]"\\n` : "" %>cssclasses:\n  - vt\n');
    expect(readFileSync(join("kits/planning/Extras/Templates", "New project note.md"), "utf8")).toContain("getAbstractFileByPath(`${folder}/${hubName}.md`)");
  });

  it("the New concept template: shipped, asks with vtAsk, Esc cancels, filed under Knowledge, no ### headings, and Tidy only asks for its summary and sources", () => {
    const file = planning.manifest.files.find(f => f.dest === "New concept.md")!;
    expect(file).toMatchObject({ kind: "template", role: "templates", src: "Extras/Templates/New concept.md" });
    const text = planning.contents[file.id].replace(/\r\n/g, "\n");
    expect(text).toContain("tp.user.vtAsk");
    expect(text).not.toContain("tp.system.prompt");
    expect(text).toContain("Cancelled - no title");
    expect(text).toContain("06 Knowledge");
    const [code, note] = text.split("-%>\n");
    expect(code).toContain("tp.file.move");
    expect(note.startsWith("---\nkind: concept\nsummary:\nsources: []\nchecked: false\ncssclasses:\n  - vt\n---\n\n## ")).toBe(true);
    expect(note).not.toMatch(/^###\s/m);
    const ctx: TidyContext = { labFolder: "03 Lab Book/Notes", knowledgeFolder: "06 Knowledge", inboxFolder: "00 Inbox", contractFolders: ["06 Knowledge"], rootNotes: [], migrations: [] };
    const s = scan([{ path: "06 Knowledge/Polymers/Chain growth.md", text: note }], ctx);
    const ids = (id: string): string[] | undefined => s.reported.find(r => r.id === id)?.items.map(i => i.path);
    expect(ids("knowledge-summary")).toEqual(["06 Knowledge/Polymers/Chain growth.md"]);
    expect(ids("knowledge-sources")).toEqual(["06 Knowledge/Polymers/Chain growth.md"]);
    expect(ids("knowledge-headings") ?? []).toEqual([]);
  });

  it("the New topic hub template: shipped, takes the folder from the hand-over, kind hub, a text area above the list, no ### headings", () => {
    const file = planning.manifest.files.find(f => f.dest === "New topic hub.md")!;
    expect(file).toMatchObject({ kind: "template", role: "templates", src: "Extras/Templates/New topic hub.md" });
    const [code, note] = planning.contents[file.id].replace(/\r\n/g, "\n").split("-%>\n");
    expect(code).toContain("window.vtTopicHub");
    expect(code).toContain("delete window.vtTopicHub");
    expect(code).toContain("tp.file.move");
    expect(note.startsWith("---\nkind: hub\ncssclasses:\n  - vt\n---\n\n")).toBe(true);
    expect(note).toContain('FROM "<% vt.folder %>"');
    expect(note).not.toMatch(/^###\s/m);
  });

  it("lab and planning kits together: no two files share a place, and the scripts sit in sibling folders", () => {
    const labRoles = { templates: "Extras/Templates/Lab Kit", userScripts: "Extras/scripts/templater/lab-kit", scripts: "Extras/scripts/lab-kit", cssSnippets: ".obsidian/snippets", labBase: "03 Lab Book", chemicalBase: "05 Chemicals" };
    const all = [...dests(lab, labRoles), ...dests(planning, roles)];
    expect(new Set(all).size).toBe(all.length);
    const names = new Set(lab.manifest.files.map(f => f.dest.split("/").pop()));
    for (const f of planning.manifest.files) if (f.role === "userScripts") expect(names.has(f.dest.split("/").pop())).toBe(false);
  });

  it("homepage: as supplied (minus the focus properties) up to the Go to box; Phase 5a blocks replace the go buttons and the Dataview lists", () => {
    const home = planning.contents[planning.manifest.files.find(f => f.src === "00 Home.md")!.id];
    // the supplied original still has the focus properties and callout: the kit dropped them on purpose (hub plan Phase 1), so only the head is compared
    const supplied = readFileSync("docs/plans/kit-files/planning/00 Home.md", "utf8").replace(/\r\n/g, "\n").replace(/focus\d(_done)?: .*\n/g, "");
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

describe("Meta Bind buttons that differ from the kit", () => {
  it("resets only the actions of a button whose actions differ; label, matching and your own buttons stay", async () => {
    const wrong = { id: "go-meetings", label: "My label", icon: "star", actions: [{ type: "open", link: "[[Weekly meetings]]", newTab: false }] };
    const same = { id: "today", label: "Today", actions: [{ type: "command", command: "x" }] };
    const mine = { id: "mine", label: "Mine", actions: [{ type: "command", command: "z" }] };
    const mb = { settings: { buttonTemplates: [wrong, same, mine] }, saveSettings: async () => {} };
    const a = { plugins: { plugins: { "obsidian-meta-bind-plugin": mb } } } as any;
    const kit = [{ id: "go-meetings", actions: [{ type: "open", link: "[[Meetings]]", newTab: false }] }, { id: "today", actions: [{ type: "command", command: "x" }] }, { id: "missing", actions: [] }];
    expect(await resetMetaBindActions(a, kit)).toBe(1);
    expect(wrong).toMatchObject({ label: "My label", icon: "star", actions: [{ type: "open", link: "[[Meetings]]" }] });
    expect(mine.actions).toEqual([{ type: "command", command: "z" }]);
    expect(mb.settings.buttonTemplates.length).toBe(3);   // a missing id is not added here
    expect(await resetMetaBindActions(a, kit)).toBe(0);
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

describe("Phase 5b: the kit's meeting series", () => {
  const text = (path: string): string => readFileSync(path, "utf8");
  it("no meeting series ships; the Meetings hub shows the next-meetings card and Go to has no deck link", () => {
    expect(existsSync("kits/planning/08 Meetings/Weekly meetings")).toBe(false);
    const hub = text("kits/planning/08 Meetings/Meetings.md");
    expect(hub).not.toContain("kind: meeting-series");
    expect(hub).toContain("show: meeting-cards");
    expect(hub).toContain("new-meeting-series");
    const home = text("kits/planning/00 Home.md");
    expect(home).not.toContain("extra: Meetings |"); // the Go to bar finds the Meetings hub by its folder
    expect(home).not.toContain("lab-kit:open-deck");
  });

  it("the meeting template reads the hand-over and links its series; the homepage has the next-meetings card", () => {
    const tpl = text("kits/planning/Extras/Templates/Meeting.md");
    expect(tpl).toContain("window.vtMeeting");
    expect(tpl).toContain('series: "[[<% series %>]]"');
    expect(tpl).not.toContain("dur(7 days)");   // the window is "since the last meeting of the series"
    expect(text("kits/planning/00 Home.md")).toContain("show: next-meetings");
  });

  it("the Home tile headings link to their hubs, and each linked note ships in a kit", () => {
    const home = text("kits/planning/00 Home.md");
    const links: Record<string, string> = {
      "To-do board.base": "kits/planning/00 Planning/To-do board.base", "Lab book base.base": "kits/lab/03 Lab Book/Lab book base.base",
      "Projects overview": "kits/planning/02 Projects/Projects overview.md", "Literature": "kits/planning/04 Literature/Literature.md",
      "Meetings": "kits/planning/08 Meetings/Meetings.md",
    };
    for (const [name, file] of Object.entries(links)) {
      expect(home, name).toMatch(new RegExp(`\\[!\\w+\\] \\[\\[${name.replace(".", "\\.")}\\|`));
      expect(existsSync(file), file).toBe(true);
    }
  });

  it("the Lab book base has the kanban (closed after 30 days hidden there only) and a list of all experiments", () => {
    const base = readFileSync("kits/lab/03 Lab Book/Lab book base.base", "utf8");
    expect(base).toMatch(/- type: kanban\n {4}name: Experiments\n {4}filters:/);
    expect(base).toContain("- type: list\n    name: All experiments");
    expect(base.split("file.inFolder(").length).toBe(2);              // one folder filter, shared by both views
    expect(base.split("Status != \"Closed\"").length).toBe(2);       // not in the base-wide filter, or the list would hide old closed ones
    expect(base.indexOf("Status != \"Closed\"")).toBeGreaterThan(base.indexOf("- type: kanban"));
  });
});
