// Phase 7c-2: Tidy up notes, settings rules (Templater paths, Meta Bind buttons) on made-up settings objects held in memory.
import { describe, it, expect } from "vitest";
import { scan, selectChanges, type ButtonAction, type TidyContext, type TidyFile, type TidySettings } from "../src/kit/tidy";
import { applyTidy, type TidyIO } from "../src/kit/tidy-apply";

const MOVE = { id: "move-folders", title: "Move folders", scope: "vault" as const, ops: [{ op: "move" as const, from: "Extras/Templates/Scripts", to: "Extras/Templates/Actions" }] };
const settings = (): TidySettings & { templater: NonNullable<TidySettings["templater"]>; metaBind: { id: string; actions: ButtonAction[] }[] } => ({
  templater: {
    startup: ["Extras/Templates/Scripts/Startup.md", "Mine/Own.md"],
    folders: [{ folder: "02 Projects", template: "Extras/Templates/Scripts/Project.md" }, { folder: "Other", template: "Mine/Other.md" }],
    hotkeys: ["Extras/Templates/Scripts/Sort inbox.md"],
  },
  metaBind: [
    { id: "sort", actions: [{ type: "runTemplaterFile", templateFile: "Extras/Templates/Actions/Sort inbox.md" }] },
    { id: "mine", actions: [{ type: "runTemplaterFile", templateFile: "Mine/Thing.md" }, { type: "open", link: "[[X]]" }] },
    { id: "plain", actions: [{ type: "command", command: "lab-kit:new-todo" }] },
  ],
  hotkeyCommands: ["templater-obsidian:Extras/Templates/Scripts/Sort inbox.md", "editor:bold"],
});
const ctx = (st: TidySettings | undefined): TidyContext => ({
  labFolder: "03 Lab Book/Notes", knowledgeFolder: "", inboxFolder: "", contractFolders: [], rootNotes: [], migrations: [MOVE], settings: st,
});
const vaultFiles = (moved: boolean): TidyFile[] => (moved
  ? ["Startup", "Project", "Sort inbox"].map(n => `Extras/Templates/Actions/${n}.md`)
  : ["Startup", "Project", "Sort inbox"].map(n => `Extras/Templates/Scripts/${n}.md`)).concat("Mine/Own.md").map(path => ({ path }));
const group = (s: ReturnType<typeof scan>, id: string) => s.groups.find(g => g.id === id);

/** Settings in memory, with the IO's rules (changes only a value that still equals `from`). */
function mem(st: ReturnType<typeof settings>, existing: string[]): TidyIO & { snaps: Map<string, string>; st: typeof st } {
  const snaps = new Map<string, string>();
  return {
    st, snaps,
    read: async () => null, write: async () => undefined, backup: async (p, t) => { snaps.set(p, t); return `backups/${p}`; },
    exists: p => existing.includes(p), filesIn: () => [], linkedFrom: () => [], rename: async () => undefined, create: async () => undefined,
    settingSnapshot: target => JSON.stringify(target === "metabind-button" ? st.metaBind : target === "templater-startup" ? st.templater.startup : (target === "templater-folder" || target === "templater-folder-remove") ? st.templater.folders : st.templater.hotkeys),
    setSetting: async c => {
      if (c.target === "metabind-button") {
        const b = st.metaBind.find(x => x.id === c.key);
        if (!b || JSON.stringify(b.actions) !== JSON.stringify(c.from)) return "the setting changed since the scan";
        b.actions = c.to as ButtonAction[]; return null;
      }
      const t = st.templater;
      if (c.target === "templater-startup") { if (!t.startup.includes(c.from as string)) return "the setting changed since the scan"; t.startup = t.startup.map(x => x === c.from ? c.to as string : x); }
      else if (c.target === "templater-hotkey") { if (!t.hotkeys.includes(c.from as string)) return "the setting changed since the scan"; t.hotkeys = t.hotkeys.map(x => x === c.from ? c.to as string : x); }
      else { const e = t.folders.find(x => x.folder === c.key && x.template === c.from); if (!e) return "the setting changed since the scan"; e.template = c.to as string; }
      return null;
    },
  };
}

describe("Tidy up notes: Templater paths (Phase 7c-2)", () => {
  it("startup, folder and hotkey paths into a moved folder get the new prefix; others stay", () => {
    const g = group(scan(vaultFiles(true), ctx(settings())), "templater-paths");
    expect(g?.changes.map(c => [c.path, c.before, c.after])).toEqual([
      ["Templater › Startup templates", "Extras/Templates/Scripts/Startup.md", "Extras/Templates/Actions/Startup.md"],
      ["Templater › Folder template for 02 Projects", "Extras/Templates/Scripts/Project.md", "Extras/Templates/Actions/Project.md"],
      ["Templater › Template hotkeys", "Extras/Templates/Scripts/Sort inbox.md", "Extras/Templates/Actions/Sort inbox.md"],
    ]);
  });

  it("the new file is not there and no move is proposed: left alone and reported", () => {
    const files: TidyFile[] = [{ path: "Mine/Own.md" }];
    const s = scan(files, ctx(settings()));
    expect(group(s, "templater-paths")).toBeUndefined();
    expect(s.reported.find(r => r.id === "left-alone")?.items.length).toBe(3);
  });

  it("while the folder move is proposed, the settings follow it (the move runs first)", () => {
    const s = scan(vaultFiles(false), ctx(settings()));
    expect(group(s, "move-folders")?.changes.length).toBe(1);
    expect(group(s, "templater-paths")?.changes.length).toBe(3);
  });

  it("Obsidian hotkeys under the old template path are only reported", () => {
    const s = scan(vaultFiles(true), ctx(settings()));
    expect(s.reported.find(r => r.id === "hotkeys-renamed")?.items.map(i => i.path)).toEqual(["templater-obsidian:Extras/Templates/Scripts/Sort inbox.md"]);
  });
});

describe("Tidy up notes: Meta Bind buttons (Phase 7c-2)", () => {
  it("a button running a known template file becomes a command action; unknown ones are only reported; others untouched", () => {
    const s = scan(vaultFiles(true), ctx(settings()));
    const g = group(s, "metabind-buttons");
    expect(g?.changes.map(c => [c.path, c.before, c.after])).toEqual([["Meta Bind › button sort", "runTemplaterFile Extras/Templates/Actions/Sort inbox.md", "command lab-kit:sort-inbox"]]);
    expect(g?.changes[0].setting?.to).toEqual([{ type: "command", command: "lab-kit:sort-inbox" }]);
    expect(s.reported.find(r => r.id === "metabind-unknown")?.items.map(i => i.path)).toEqual(["Meta Bind › button mine"]);
  });

  it("scanning without settings (Templater / Meta Bind off, mobile) adds no settings rules", () => {
    expect(scan(vaultFiles(true), ctx(undefined)).groups).toEqual([]);
  });
});

describe("Change notes: settings (Phase 7c-2)", () => {
  const all = (st: ReturnType<typeof settings>) => { const s = scan(vaultFiles(true), ctx(st)); return selectChanges(s, new Set(s.groups.map(g => g.id))); };
  const there = vaultFiles(true).map(f => f.path);

  it("nothing ticked: settings unchanged, no backup", async () => {
    const st = settings(), old = JSON.stringify(st), io = mem(st, there);
    const out = await applyTidy(io, []);
    expect(JSON.stringify(st)).toBe(old); expect(io.snaps.size).toBe(0); expect(out.settings).toEqual([]);
  });

  it("applies the ticked rules, backs up the exact old value, and a second scan finds nothing", async () => {
    const st = settings(), old = { startup: [...st.templater.startup], buttons: JSON.stringify(st.metaBind) };
    const io = mem(st, there);
    const out = await applyTidy(io, all(st));
    expect(out.skipped).toEqual([]);
    expect(out.settings.length).toBe(4);
    expect(io.snaps.get("settings/templater-startup.json")).toBe(JSON.stringify(old.startup));
    expect(io.snaps.get("settings/metabind-button.json")).toBe(old.buttons);
    expect(st.templater.startup).toEqual(["Extras/Templates/Actions/Startup.md", "Mine/Own.md"]);
    expect(st.metaBind.find(b => b.id === "mine")?.actions.length).toBe(2);
    const again = scan(vaultFiles(true), ctx({ ...st, hotkeyCommands: [] }));
    expect(again.groups).toEqual([]);
  });

  it("a rule left unticked is untouched", async () => {
    const st = settings(), io = mem(st, there), s = scan(vaultFiles(true), ctx(st));
    await applyTidy(io, selectChanges(s, new Set(["metabind-buttons"])));
    expect(st.templater.startup[0]).toBe("Extras/Templates/Scripts/Startup.md");
    expect(st.metaBind[0].actions).toEqual([{ type: "command", command: "lab-kit:sort-inbox" }]);
  });

  it("a value changed since the scan, or a missing new file, is skipped and named", async () => {
    const st = settings(), changes = all(st), io = mem(st, there.filter(p => !p.endsWith("Project.md")));
    st.templater.startup = ["Mine/Own.md"];
    const out = await applyTidy(io, changes);
    expect(out.skipped.map(s => s.path)).toEqual(["Templater › Startup templates", "Templater › Folder template for 02 Projects"]);
    expect(out.skipped[0].why).toBe("the setting changed since the scan");
    expect(st.templater.folders[0].template).toBe("Extras/Templates/Scripts/Project.md");
  });
});

describe("Tidy up notes: Templater folder templates for folders Lab Kit fills (Templater replacement Phase 2)", () => {
  const withFill = (st: TidySettings, fillFolders?: string[]): TidyContext => ({ ...ctx(st), fillFolders });
  const files = vaultFiles(true);

  it("a Templater row for a folder whose template Lab Kit fills is proposed for removal, opt-in; other rows and a missing list change nothing", () => {
    const g = scan(files, withFill(settings(), ["02 Projects"])).groups.find(x => x.id === "templater-folder-templates");
    expect(g?.optIn).toBe(true);
    expect(g?.changes.map(c => [c.path, c.setting?.target, c.setting?.key])).toEqual([["Templater › Folder template for 02 Projects", "templater-folder-remove", "02 Projects"]]);
    expect(scan(files, withFill(settings())).groups.find(x => x.id === "templater-folder-templates")).toBeUndefined();
    expect(scan(files, withFill(settings(), ["Elsewhere"])).groups.find(x => x.id === "templater-folder-templates")).toBeUndefined();
  });

  it("applying backs up Templater's folder list as it was, removes only that row, and a value changed since the scan is skipped", async () => {
    const st = settings(), before = JSON.stringify(st.templater.folders);
    const io = mem(st, []);
    io.setSetting = async c => {
      const i = st.templater.folders.findIndex(f => f.folder === c.key && f.template === c.from);
      if (i < 0) return "the setting changed since the scan";
      st.templater.folders.splice(i, 1); return null;
    };
    const s = scan(files, withFill(st, ["02 Projects"]));
    const changes = selectChanges(s, new Set(["templater-folder-templates"]));
    const out = await applyTidy(io, changes);
    expect(out.skipped).toEqual([]);
    expect(io.snaps.get("settings/templater-folder-remove.json")).toBe(before);
    expect(st.templater.folders).toEqual([{ folder: "Other", template: "Mine/Other.md" }]);
    st.templater.folders = [{ folder: "02 Projects", template: "Changed.md" }];
    const again = await applyTidy(io, changes);
    expect(again.skipped.map(x => x.why)).toEqual(["the setting changed since the scan"]);
  });
});
