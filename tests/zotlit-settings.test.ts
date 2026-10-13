// ZotLit's frontmatter fields and folders against the kit's (src/kit/zotlit.ts).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { ZOTLIT_FIELDS, zotlitApply, zotlitScan } from "../src/kit/zotlit";

const want = { literature: "04 Literature/ZotLit Imports", templates: "Extras/Templates/ZotLit" };
const spec = readFileSync("kits/planning/07 How-tos/Obsidian/Vault spec.md", "utf8");
const guide = readFileSync("kits/planning/07 How-tos/Obsidian/Set up ZotLit.md", "utf8");
const MERGE: Record<string, string> = { "Replace": "replace", "Keep existing": "keep", "Append arrays": "append" };

/** The `| `key` | `expr` | Merge |` rows of a note's frontmatter table. */
function table(text: string): { key: string; expr: string; merge: string }[] {
  return [...text.matchAll(/^\s*\| `([^`|]+)` \| `((?:[^`]|\\\|)+)` \| (Replace|Keep existing|Append arrays) \|\s*$/gm)]
    .map(m => ({ key: m[1], expr: m[2].replace(/\\\|/g, "|"), merge: MERGE[m[3]] }));
}
/** What the user's ZotLit 2.1.4 had on 2026-10-13 (the twelve fields before DOI). */
const theirs = ZOTLIT_FIELDS.filter(f => f.key !== "DOI").map(f => ({ ...f }));
const data = (fields: unknown, extra: Record<string, unknown> = {}): Record<string, unknown> =>
  ({ "__VERSION__": 9, "release.previous-version": "2.1.4", "note.literature-folder": want.literature, "template.folder": want.templates, "note.frontmatter-fields": fields, "server.enabled": true, ...extra });

describe("the kit's ZotLit fields", () => {
  it("are the same as the Vault spec table and the Set up ZotLit table", () => {
    const expected = ZOTLIT_FIELDS.map(f => ({ key: f.key, expr: f.expr, merge: f.merge })).sort((a, b) => a.key.localeCompare(b.key));
    // The Vault spec lists them with the escaped pipe `\|`: unescaped above
    const bySpec = table(spec).filter(r => expected.some(e => e.key === r.key)).sort((a, b) => a.key.localeCompare(b.key));
    const byGuide = table(guide).sort((a, b) => a.key.localeCompare(b.key));
    expect(bySpec).toEqual(expected);
    expect(byGuide).toEqual(expected);
  });
  it("all use the liquid language and each key once", () => {
    expect(ZOTLIT_FIELDS.every(f => f.language === "liquid")).toBe(true);
    expect(new Set(ZOTLIT_FIELDS.map(f => f.key)).size).toBe(ZOTLIT_FIELDS.length);
  });
});

describe("zotlitScan", () => {
  it("settings that have everything: nothing missing, nothing differing, folders ok", () => {
    const s = zotlitScan(data(ZOTLIT_FIELDS), want);
    expect(s).toEqual({ readable: true, missing: [], differing: [], literature: "ok", templates: "ok" });
  });
  it("the user's twelve fields: only DOI is missing", () => {
    const s = zotlitScan(data(theirs), want);
    expect(s.missing.map(f => f.key)).toEqual(["DOI"]);
    expect(s.differing).toEqual([]);
  });
  it("no field list and no folders: everything missing, folders empty", () => {
    const s = zotlitScan({ "__VERSION__": 9 }, want);
    expect(s.missing).toHaveLength(ZOTLIT_FIELDS.length);
    expect([s.literature, s.templates]).toEqual(["empty", "empty"]);
  });
  it("a field with the same key but another expression or merge is the user's own: listed, not missing", () => {
    const fields = ZOTLIT_FIELDS.map(f => (f.key === "Year" ? { ...f, expr: "zt.date.year | plus: 0" } : f.key === "URL" ? { ...f, merge: "replace" } : f));
    const s = zotlitScan(data(fields), want);
    expect(s.missing).toEqual([]);
    expect(s.differing.map(d => d.key)).toEqual(["URL", "Year"].sort((a, b) => ZOTLIT_FIELDS.findIndex(f => f.key === a) - ZOTLIT_FIELDS.findIndex(f => f.key === b)));
    expect(s.differing.find(d => d.key === "Year")).toMatchObject({ now: "zt.date.year | plus: 0 (replace)", kit: "zt.date.year (replace)" });
  });
  it("folders: another value is the user's own", () => {
    expect(zotlitScan(data(ZOTLIT_FIELDS, { "note.literature-folder": "Papers", "template.folder": "" }), want)).toMatchObject({ literature: "other", templates: "empty" });
  });
  it("not an object, or a field list that is not a list: unreadable", () => {
    expect(zotlitScan(null, want).readable).toBe(false);
    expect(zotlitScan([], want).readable).toBe(false);
    expect(zotlitScan(data("nope"), want).readable).toBe(false);
  });
});

describe("zotlitApply", () => {
  it("appends the missing fields and keeps everything else as it is", () => {
    const d = data(theirs, { "attachment.folder-path": "04 Literature/ZotLit Imports/ZotLit attachments" });
    const out = zotlitApply(d, zotlitScan(d, want), want);
    expect((out["note.frontmatter-fields"] as { key: string }[]).map(f => f.key)).toEqual([...theirs.map(f => f.key), "DOI"]);
    expect(out["attachment.folder-path"]).toBe(d["attachment.folder-path"]);
    expect(out["__VERSION__"]).toBe(9);
    expect(Object.keys(out)).toEqual(Object.keys(d));
    expect(zotlitScan(out, want)).toEqual({ readable: true, missing: [], differing: [], literature: "ok", templates: "ok" });
  });
  it("a field of yours with another expression stays as it is", () => {
    const mine = { key: "Year", expr: "zt.date.year | plus: 0", merge: "replace", language: "liquid" };
    const d = data([mine, ...theirs.filter(f => f.key !== "Year")]);
    const out = zotlitApply(d, zotlitScan(d, want), want)["note.frontmatter-fields"] as { key: string; expr: string }[];
    expect(out.find(f => f.key === "Year")).toEqual(mine);
    expect(out.filter(f => f.key === "Year")).toHaveLength(1);
  });
  it("sets empty folders and leaves your own", () => {
    const d = data(ZOTLIT_FIELDS, { "note.literature-folder": "Papers", "template.folder": "" });
    const out = zotlitApply(d, zotlitScan(d, want), want);
    expect(out["note.literature-folder"]).toBe("Papers");
    expect(out["template.folder"]).toBe(want.templates);
  });
  it("does not change the object it was given", () => {
    const d = data(theirs);
    const copy = JSON.stringify(d);
    zotlitApply(d, zotlitScan(d, want), want);
    expect(JSON.stringify(d)).toBe(copy);
  });
});
