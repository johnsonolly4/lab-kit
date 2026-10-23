// S2 of docs/plans/obsidian-update-robustness.md: every Obsidian internal we lean on (a class Obsidian draws, a member of `app` that its typings
// do not declare, and a typed cast over app / vault) is listed in scripts/obsidian-internals.json with where and how risky. A new use fails here until it is listed (and a
// listed one that is gone fails too, so the list stays true). Add the entry, then decide how the smoke test will notice a rename.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

interface Entry { name: string; kind: "selector" | "member" | "cast"; files: string[]; risk: "high" | "medium" | "low"; note: string }
const inventory = JSON.parse(readFileSync("scripts/obsidian-internals.json", "utf8")) as { entries: Entry[] };

const walk = (dir: string, out: string[] = []): string[] => {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
};
const read = (p: string): string => readFileSync(p, "utf8");

// code that draws or styles: .ts in src, the plugin sheet, and the kit's CSS snippets (selectors); plus kit notes and scripts for members
const selectorFiles = [...walk("src").filter(f => f.endsWith(".ts")), "styles.css", ...walk("kits").filter(f => f.endsWith(".css"))];
const memberFiles = [...walk("src").filter(f => f.endsWith(".ts")), ...walk("kits").filter(f => /\.(md|js)$/.test(f))];
// Obsidian classes we depend on: Bases, windows (modal, prompt) and settings rows. Not preceded by a word, dot or bracket (`field.prompt` is not a class).
const SELECTOR = /(?<![\w.\])-])\.((?:bases-|modal|prompt|setting-item)[\w-]*)/g;
const PUBLIC_APP = new Set(["vault", "workspace", "metadataCache", "fileManager", "keymap", "scope", "lastEvent", "isDarkMode", "renderContext", "secretStorage", "loadLocalStorage", "saveLocalStorage"]);
const MEMBER = /(?<![\w/"'`-])app\.([A-Za-z]+)(?![\w"'`])/g;
const PRIV = /\bpriv\([\w.]+\)\??\.([A-Za-z]+)/g;   // src/kit/obsidian-private.ts reads Obsidian's private members through priv(app)
const CAST = /\b(?:app|vault|metadataCache|workspace)\b[^;\n]*\bas unknown as\b/;   // a typed cast over app, vault, metadataCache or workspace: the file is listed

function found(files: string[], re: RegExp, clean: (s: string) => string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const f of files) {
    for (const m of read(f).matchAll(re)) {
      const name = clean(m[1]);
      if (!name) continue;
      (out.get(name) ?? out.set(name, new Set()).get(name)!).add(f.split("\\").join("/"));
    }
  }
  return out;
}
const selectors = found(selectorFiles, SELECTOR, s => s.replace(/-+$/, ""));
const members = new Map<string, Set<string>>();
for (const [n, fs] of [...found(memberFiles, MEMBER, s => s), ...found(memberFiles, PRIV, s => s)]) {
  if (!PUBLIC_APP.has(n)) members.set(n, new Set([...(members.get(n) ?? []), ...fs]));
}
const casts = new Map(selectorFiles.filter(f => f.endsWith(".ts") && read(f).split("\n").some(l => CAST.test(l))).map(f => [f.split("\\").join("/"), new Set([f.split("\\").join("/")])]));

const listed = (kind: Entry["kind"]): Map<string, Entry> => new Map(inventory.entries.filter(e => e.kind === kind).map(e => [e.name, e]));

describe("Obsidian internals inventory", () => {
  it("every entry is complete", () => {
    for (const e of inventory.entries) {
      expect(e.files.length, e.name).toBeGreaterThan(0);
      expect(["high", "medium", "low"], e.name).toContain(e.risk);
      expect(e.note.length, e.name).toBeGreaterThan(5);
    }
  });

  it("every Obsidian class we select or style is listed", () => {
    const known = listed("selector");
    const missing = [...selectors].filter(([n]) => !known.has(n)).map(([n, f]) => `.${n} in ${[...f].join(", ")}`);
    expect(missing, "add these to scripts/obsidian-internals.json (kind selector)").toEqual([]);
  });

  it("every `app.<member>` that Obsidian's typings lack is listed", () => {
    const known = listed("member");
    const missing = [...members].filter(([n]) => !known.has(n)).map(([n, f]) => `app.${n} in ${[...f].join(", ")}`);
    expect(missing, "add these to scripts/obsidian-internals.json (kind member), or read them through src/kit/obsidian-private.ts").toEqual([]);
  });

  it("every file that casts app, vault or metadataCache to a private shape is listed (kind cast, name = the file)", () => {
    const known = listed("cast");
    const missing = [...casts.keys()].filter(n => !known.has(n));
    expect(missing, "add these to scripts/obsidian-internals.json (kind cast), or move the cast into src/kit/obsidian-private.ts").toEqual([]);
  });

  it("no listed entry is gone, and each lists the files that use it", () => {
    const stale: string[] = [];
    for (const e of inventory.entries) {
      const now = (e.kind === "selector" ? selectors : e.kind === "member" ? members : casts).get(e.name);
      if (!now) { stale.push(`${e.kind} ${e.name} is not used any more: remove it`); continue; }
      const listedFiles = new Set(e.files);
      for (const f of now) if (!listedFiles.has(f)) stale.push(`${e.name} is also used in ${f}: add the file`);
      for (const f of listedFiles) if (!now.has(f)) stale.push(`${e.name} is no longer used in ${f}: remove the file`);
    }
    expect(stale).toEqual([]);
  });
});
