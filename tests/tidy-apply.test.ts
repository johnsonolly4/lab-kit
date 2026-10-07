// Phase 7b: Change notes, on the made-up fixture vault held in memory (no Obsidian): backups, ticked rules only, moves and links, a second scan.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative, sep } from "path";
import { replaceProperties, scan, selectChanges, wantsText, type Migration, type TidyContext, type TidyFile } from "../src/kit/tidy";
import { applyTidy, type TidyIO } from "../src/kit/tidy-apply";

const ROOT = join(__dirname, "fixtures", "tidy-vault");
const walk = (dir: string): string[] => readdirSync(dir).flatMap(n => statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]);
const manifest = (id: string): { migrations: Migration[] } => JSON.parse(readFileSync(join(__dirname, "..", "kits", id, "kit-manifest.json"), "utf8"));
const ctx: TidyContext = {
  labFolder: "03 Lab Book/Notes", knowledgeFolder: "06 Knowledge", inboxFolder: "00 Inbox",
  contractFolders: ["03 Lab Book", "00 Inbox", "02 Projects", "06 Knowledge", "07 How-tos", "Extras"], rootNotes: ["00 Home.md"],
  migrations: [...manifest("lab").migrations, ...manifest("planning").migrations],
};

/** The fixture vault in memory, with an IO that moves files and rewrites path links like Obsidian's rename does. */
function memory(): { files: Map<string, string>; io: TidyIO; backups: Map<string, string>; writes: string[] } {
  const files = new Map<string, string>(walk(ROOT).map(f => [relative(ROOT, f).split(sep).join("/"), readFileSync(f, "utf8")]));
  const backups = new Map<string, string>(), writes: string[] = [];
  const link = (t: string): string[] => [...t.matchAll(/\[\[([^\]|#]+)/g)].map(m => m[1]);
  const io: TidyIO = {
    read: async p => files.get(p) ?? null,
    write: async (p, t) => { writes.push(p); files.set(p, t); },
    backup: async (p, t) => { backups.set(`backups/${p}`, t); return `backups/${p}`; },
    exists: p => files.has(p) || [...files.keys()].some(k => k.startsWith(p + "/")),
    filesIn: p => [...files.keys()].filter(k => k === p || k.startsWith(p + "/")),
    linkedFrom: paths => [...files].filter(([k, t]) => !paths.includes(k) && link(t).some(l => paths.some(p => p.replace(/\.md$/, "") === l))).map(([k]) => k),
    create: async (p, t) => { files.set(p, t); },
    settingSnapshot: () => "", setSetting: async () => null,
    rename: async (from, to) => {
      for (const [k, t] of [...files]) if (k === from || k.startsWith(from + "/")) { files.delete(k); files.set(to + k.slice(from.length), t); }
      const stem = (p: string): string => p.replace(/\.md$/, "");
      for (const [k, t] of [...files]) files.set(k, t.replace(/\[\[([^\]|#]+)/g, (m, l: string) => l.startsWith(from + "/") ? `[[${to}${stem(l).slice(from.length)}` : m));
    },
  };
  return { files, io, backups, writes };
}
const files = (m: Map<string, string>): TidyFile[] => {
  const paths = [...m.keys()], readAll = true;
  return paths.map(path => ({ path, text: wantsText(path, ctx, readAll) ? m.get(path) : undefined }));
};
const unresolved = (m: Map<string, string>): string[] => {
  const stems = new Set([...m.keys()].flatMap(k => [k.replace(/\.md$/, ""), k.replace(/\.md$/, "").split("/").pop() as string]));
  return [...m.values()].flatMap(t => [...t.matchAll(/\[\[([^\]|#]+)/g)].map(x => x[1])).filter(l => !stems.has(l));
};

describe("Change notes (Phase 7b)", () => {
  it("(a) no changes: nothing is written, no backup", async () => {
    const m = memory();
    const out = await applyTidy(m.io, []);
    expect(m.writes).toEqual([]); expect(m.backups.size).toBe(0); expect(out).toEqual({ changed: [], moved: [], created: [], settings: [], skipped: [], backups: {} });
  });

  it("(b) a rule the user unticked is left alone", async () => {
    const m = memory();
    const s = scan(files(m.files), ctx);
    const before = new Map(m.files);
    const changes = selectChanges(s, new Set(["hub-kind"]));
    expect(changes.map(c => c.path)).toEqual(["07 How-tos/Cooking index.md"]);
    await applyTidy(m.io, changes);
    for (const [k, t] of before) if (k !== "07 How-tos/Cooking index.md") expect(m.files.get(k)).toBe(t);
    expect(m.files.get("07 How-tos/Cooking index.md")).toBe("---\ntags: [how-to]\nkind: hub\n---\n# Cooking index\n");
  });

  it("(c) every rewritten note has a backup equal to its old text, and only the property block changed", async () => {
    const m = memory();
    const old = new Map(m.files);
    const s = scan(files(m.files), ctx);
    const out = await applyTidy(m.io, selectChanges(s, new Set(s.groups.map(g => g.id))));
    expect(out.skipped).toEqual([]);
    expect(out.changed.length).toBeGreaterThan(5);
    for (const p of out.changed) {
      expect(m.backups.get(out.backups[p])).toBe(old.get(p));
      expect(m.files.get(p)).not.toBe(old.get(p));
    }
    // body kept: the no-block lab note keeps its text under the new block
    expect(m.files.get("03 Lab Book/Notes/ABC0006-A.md")?.endsWith("---\n# ABC0006-A\n")).toBe(true);
    expect(m.files.get("03 Lab Book/Notes/ABC0001-A.md")).toContain("Status: Planned\ndate: 2026-01-05\nType:\n");
  });

  it("(d) moves: files arrive, no new unresolved links, the notes that link to them are backed up first", async () => {
    const m = memory();
    const unresolvedBefore = unresolved(m.files);
    const s = scan(files(m.files), ctx);
    const out = await applyTidy(m.io, selectChanges(s, new Set(["move-folders"])));
    expect(out.moved).toEqual([{ from: "Extras/Templates/Scripts", to: "Extras/Templates/Actions" }, { from: "fonts", to: "Extras/fonts" }]);
    expect(m.files.has("Extras/Templates/Actions/Add to list.md")).toBe(true);
    expect(m.files.has("Extras/Templates/Scripts/Add to list.md")).toBe(false);
    expect(m.files.has("Extras/fonts/Example.woff")).toBe(true);
    expect(unresolved(m.files)).toEqual(unresolvedBefore);
    expect(m.files.get("02 Projects/Calls action.md")).toContain("[[Extras/Templates/Actions/Add to list]]");
    expect(Object.keys(out.backups)).toEqual(["02 Projects/Calls action.md"]);
    expect(m.backups.get("backups/02 Projects/Calls action.md")).toContain("[[Extras/Templates/Scripts/Add to list]]");
  });

  it("(e) a second scan finds nothing left for the applied rules", async () => {
    const m = memory();
    const s = scan(files(m.files), ctx);
    await applyTidy(m.io, selectChanges(s, new Set(s.groups.map(g => g.id))));
    expect(scan(files(m.files), ctx).groups).toEqual([]);
  });

  it("a note edited since the scan, or a place taken since, is skipped and named, not forced", async () => {
    const m = memory();
    const s = scan(files(m.files), ctx);
    m.files.set("03 Lab Book/Notes/ABC0002-A.md", "---\nStatus: Open\n---\nedited\n");
    m.files.set("Extras/fonts/late.woff", "x");
    const out = await applyTidy(m.io, selectChanges(s, new Set(["lab-status-text", "move-folders"])));
    expect(out.skipped).toEqual([
      { path: "03 Lab Book/Notes/ABC0002-A.md", why: "the note changed since the scan" },
      { path: "fonts", why: "Extras/fonts already exists" },
    ]);
    expect(m.files.get("03 Lab Book/Notes/ABC0002-A.md")).toBe("---\nStatus: Open\n---\nedited\n");
    expect(m.files.has("fonts/Example.woff")).toBe(true);
  });

  it("replaceProperties keeps Windows line endings and refuses a block that is not the one scanned", () => {
    expect(replaceProperties("---\r\nStatus: [Closed]\r\n---\r\nbody\r\n", "Status: [Closed]", "Status: Closed")).toBe("---\r\nStatus: Closed\r\n---\r\nbody\r\n");
    expect(replaceProperties("---\nStatus: Open\n---\n", "Status: [Closed]", "Status: Closed")).toBeNull();
    expect(replaceProperties("# no block\n", "Status: x", "y")).toBeNull();
  });
});
