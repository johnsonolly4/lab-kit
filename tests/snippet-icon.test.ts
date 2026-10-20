// I23 Phase 5: icons live in snippet headers. withIcon (writing one), Change icon… (own file, kit file, header with no icon line) and the Tidy rule that moves the old Snippet icons page into headers.
import { describe, it, expect } from "vitest";
import { canChangeIcon, changeIcon, withIcon, type IconDeps } from "../src/kit/snippet-icon";
import { scan, type TidyContext, type TidyFile } from "../src/kit/tidy";
import { applyTidy, type TidyIO } from "../src/kit/tidy-apply";
import { selectChanges } from "../src/kit/tidy";

const TOKEN = "---\ntitle: Sample list\nicon: list\ndesc: x\ngroup: Samples\nfields:\n  - key: a\n---\nbody {{a}}\n";

describe("withIcon", () => {
  it("replaces the icon line, keeps every other line and the body", () => {
    expect(withIcon(TOKEN, "flask-round")).toBe(TOKEN.replace("icon: list", "icon: flask-round"));
  });
  it("a header with no icon line gets one after the title (else at the end of the header)", () => {
    expect(withIcon("---\ntitle: T\nrun: raft\n---\n", "magnet")).toBe("---\ntitle: T\nicon: magnet\nrun: raft\n---\n");
    expect(withIcon("---\nrun: raft\n---\n", "magnet")).toBe("---\nrun: raft\nicon: magnet\n---\n");
  });
  it("a fallback list becomes the one picked name; CRLF is kept", () => {
    expect(withIcon("---\r\nicon: grid-3x3, layout-grid\r\n---\r\nx", "table")).toBe("---\r\nicon: table\r\n---\r\nx");
  });
  it("an old <%* stub keeps its // icon: comment form, added under <%* when missing", () => {
    expect(withIcon("<%*\n// icon: x\ntR += await tp.user.labSnippets(tp, \"nmr\");\n%>", "magnet")).toBe("<%*\n// icon: magnet\ntR += await tp.user.labSnippets(tp, \"nmr\");\n%>");
    expect(withIcon("<%*\ntR += 1;\n%>", "magnet")).toBe("<%*\n// icon: magnet\ntR += 1;\n%>");
  });
  it("a note with no header gets nothing", () => {
    expect(withIcon("a table\n| a |", "magnet")).toBeNull();
    expect(withIcon("---\nunclosed", "magnet")).toBeNull();
  });
});

const fake = (files: Record<string, string>, over: Partial<IconDeps> = {}, kit: string[] = []): IconDeps & { files: Record<string, string>; copies: string[] } => {
  const copies: string[] = [];
  return {
    files, copies,
    read: async p => files[p] ?? null,
    write: async (p, t) => { files[p] = t; },
    isKit: async p => kit.includes(p),
    kind: t => t.startsWith("---") ? (/^run:/m.test(t) ? "calculator" : "token") : t.startsWith("<%*") ? "stub" : "plain",
    pick: async () => "flask-round",
    copy: async p => { const to = p.replace(".md", " (mine).md"); files[to] = files[p]; copies.push(to); return to; },
    ...over,
  };
};

describe("Change icon…", () => {
  it("your own file: the icon goes into its header, no copy", async () => {
    const d = fake({ "S/A.md": TOKEN });
    expect(await changeIcon(d, "S/A.md", "list")).toEqual({ icon: "flask-round", path: "S/A.md", copied: false });
    expect(d.files["S/A.md"]).toContain("icon: flask-round");
    expect(d.copies).toEqual([]);
  });
  it("an unedited kit file is copied first; the copy gets the icon, the kit file stays as it was", async () => {
    const d = fake({ "S/04 Sample list.md": TOKEN }, {}, ["S/04 Sample list.md"]);
    const res = await changeIcon(d, "S/04 Sample list.md", "list");
    expect(res).toEqual({ icon: "flask-round", path: "S/04 Sample list (mine).md", copied: true });
    expect(d.files["S/04 Sample list.md"]).toBe(TOKEN);
    expect(d.files["S/04 Sample list (mine).md"]).toContain("icon: flask-round");
  });
  it("a copy that is cancelled, or an icon picker closed, changes nothing", async () => {
    const kit = fake({ "S/04.md": TOKEN }, { copy: async () => null }, ["S/04.md"]);
    expect(await changeIcon(kit, "S/04.md", "")).toBeNull();
    const none = fake({ "S/A.md": TOKEN }, { pick: async () => null });
    expect(await changeIcon(none, "S/A.md", "")).toBeNull();
    expect(none.files["S/A.md"]).toBe(TOKEN);
  });
  it("a header with no icon: line gets one", async () => {
    const d = fake({ "S/A.md": "---\ntitle: A\nfields:\n  - key: a\n---\nx" });
    await changeIcon(d, "S/A.md", "");
    expect(d.files["S/A.md"]).toBe("---\ntitle: A\nicon: flask-round\nfields:\n  - key: a\n---\nx");
  });
  it("an unedited kit calculator (run: file) gets the icon in its own header, no copy", async () => {
    const CALC = "---\ntitle: Solution prep\nicon: test-tube\nrun: solution\n---\n";
    const d = fake({ "S/01 Solution prep.md": CALC }, {}, ["S/01 Solution prep.md"]);
    expect(await changeIcon(d, "S/01 Solution prep.md", "test-tube")).toEqual({ icon: "flask-round", path: "S/01 Solution prep.md", copied: false });
    expect(d.files["S/01 Solution prep.md"]).toBe(CALC.replace("test-tube", "flask-round"));
    expect(d.copies).toEqual([]);
  });
  it("is offered only where an icon can be kept: not for plain snippets, not for a missing file; yes for kit calculators", async () => {
    const d = fake({ "S/plain.md": "just a table", "S/01.md": "---\ntitle: Solution prep\nrun: solution\n---\n", "S/own.md": "---\ntitle: Mine\nrun: raft\n---\n", "S/old.md": "<%*\n// icon: x\n%>" }, {}, ["S/01.md"]);
    expect(await canChangeIcon(d, "S/plain.md")).toBe(false);
    expect(await canChangeIcon(d, "S/01.md")).toBe(true);
    expect(await canChangeIcon(d, "S/gone.md")).toBe(false);
    expect(await canChangeIcon(d, "S/own.md")).toBe(true);
    expect(await canChangeIcon(d, "S/old.md")).toBe(true);
  });
});

const DIR = "Extras/Templates/Snippets";
const ctx = (icons: Record<string, string>, kitSnippets: string[] = []): TidyContext => ({ labFolder: "03 Lab Book/Notes", knowledgeFolder: "", inboxFolder: "", contractFolders: [], rootNotes: [], migrations: [], snippetsFolder: DIR, snippetIcons: icons, kitSnippets });
const f = (name: string, text: string): TidyFile => ({ path: `${DIR}/${name}`, text });
const group = (files: TidyFile[], c: TidyContext) => scan(files, c).groups.find(g => g.id === "snippet-icons");

describe("Tidy: icons from settings into the notes", () => {
  it("offers a header change per saved icon of your own snippet, not ticked, with the exact title", () => {
    const g = group([f("20 Mine.md", TOKEN)], ctx({ Mine: "magnet" }))!;
    expect(g.title).toBe("Snippets: icons from settings into the notes");
    expect(g.optIn).toBe(true);
    expect(g.changes).toHaveLength(1);
    expect(g.changes[0].path).toBe(`${DIR}/20 Mine.md`);
    expect(g.changes[0].after).toContain("icon: magnet");
    expect(g.changes[0].after).not.toContain("icon: list");
  });
  it("a kit file nobody edited gets nothing written and is reported; a missing snippet and a header-less one are reported too", () => {
    const files = [f("04 Sample list.md", TOKEN), f("30 Plain.md", "a table")];
    const r = scan(files, ctx({ "Sample list": "magnet", Gone: "x", Plain: "y" }, [`${DIR}/04 Sample list.md`]));
    expect(r.groups.find(g => g.id === "snippet-icons")).toBeUndefined();
    const notes = r.reported.find(x => x.id === "left-alone")!.items.map(i => i.note ?? "");
    expect(notes.some(n => n.includes("kit file nobody has edited"))).toBe(true);
    expect(notes.some(n => n.includes("no snippet of that name"))).toBe(true);
    expect(notes.some(n => n.includes("no header"))).toBe(true);
  });
  it("an edited kit file counts as yours; an icon already in the header, or no saved icons, offers nothing", () => {
    expect(group([f("04 Sample list.md", TOKEN)], ctx({ "Sample list": "magnet" }, []))!.changes).toHaveLength(1);
    expect(group([f("20 Mine.md", TOKEN)], ctx({ Mine: "list" }))).toBeUndefined();
    expect(group([f("20 Mine.md", TOKEN)], ctx({}))).toBeUndefined();
    expect(group([f("20 Mine.md", TOKEN)], { ...ctx({ Mine: "magnet" }), snippetsFolder: undefined })).toBeUndefined();
  });
  it("Change notes backs the note up, then writes only the icon line", async () => {
    const files = new Map([[`${DIR}/20 Mine.md`, TOKEN]]);
    const backups = new Map<string, string>();
    const io: TidyIO = {
      read: async p => files.get(p) ?? null, write: async (p, t) => { files.set(p, t); }, exists: p => files.has(p), filesIn: () => [], linkedFrom: () => [],
      backup: async (p, t) => { backups.set(p, t); return `b/${p}`; }, create: async () => {}, rename: async () => {}, settingSnapshot: () => "", setSetting: async () => null,
    };
    const scanned = scan([f("20 Mine.md", TOKEN)], ctx({ Mine: "magnet" }));
    const out = await applyTidy(io, selectChanges(scanned, new Set(["snippet-icons"])));
    expect(out.changed).toEqual([`${DIR}/20 Mine.md`]);
    expect(backups.get(`${DIR}/20 Mine.md`)).toBe(TOKEN);
    expect(files.get(`${DIR}/20 Mine.md`)).toBe(TOKEN.replace("icon: list", "icon: magnet"));
  });
});

describe("no code reads the old Snippet icons setting except the Tidy rule", () => {
  it("snippetIcons appears only in the kit data (paths.ts), the Tidy context and the Tidy rule", async () => {
    const { execSync } = await import("node:child_process");
    const hits = execSync("grep -rl snippetIcons src kits --include=*.ts --include=*.js || true", { encoding: "utf8" }).split("\n").filter(Boolean).sort();
    expect(hits).toEqual(["src/kit/paths.ts", "src/kit/tidy-ui.ts", "src/kit/tidy.ts"]);
  });
});
