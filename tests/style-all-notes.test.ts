import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "fs";
import { KIT_DEFAULTS, kitLoad } from "../src/kit/paths";
import { applyStyleAllNotes, STYLE_ALL_CLASS, STYLE_ALL_NOTES } from "../src/kit/style-all-notes";

const css = readFileSync("kits/planning/.obsidian/snippets/vault-theme.css", "utf8");
const noComments = (t: string): string => t.replace(/\/\*[\s\S]*?\*\//g, "");

describe("Style all notes (TC4)", () => {
  it("is off by default, and an old data.json or a junk value gets off", () => {
    expect(KIT_DEFAULTS.styleAllNotes).toBe(false);
    expect(kitLoad({}).styleAllNotes).toBe(false);
    expect(kitLoad({ styleAllNotes: "yes" }).styleAllNotes).toBe(false);
    expect(kitLoad({ styleAllNotes: true }).styleAllNotes).toBe(true);
  });
  it("puts the body class on and takes it off", () => {
    const classes = new Set<string>();
    const body = { classList: { toggle: (n: string, f?: boolean) => { if (f ?? !classes.has(n)) classes.add(n); else classes.delete(n); return classes.has(n); } } };
    applyStyleAllNotes(body, true);
    expect([...classes]).toEqual([STYLE_ALL_CLASS]);
    applyStyleAllNotes(body, true);
    expect(classes.size).toBe(1);
    applyStyleAllNotes(body, false);
    expect(classes.size).toBe(0);
  });
  it("uses the owner's wording and the class name the snippet reads", () => {
    expect(STYLE_ALL_CLASS).toBe("lab-kit-style-all-notes");
    expect([STYLE_ALL_NOTES.name, STYLE_ALL_NOTES.desc]).toEqual(["Style all notes", "Apply the Lab Kit table, heading and callout styles to every note, not only kit notes."]);
  });
  it("the snippet scopes the every-note rules to .vt or the body class, and sets none of them on plain body", () => {
    const code = noComments(css);
    expect(code).toContain(".vt, .lab-kit-style-all-notes {\n  --file-line-width: 1200px;");
    expect(code).toContain(":is(.vt, .lab-kit-style-all-notes) :is(h2, .cm-header-2) { color: rgb(var(--vt-h2)); }");
    expect(code).toContain(":is(.vt, .lab-kit-style-all-notes) .cm-active");
    expect(code).toContain(":is(.vt, .lab-kit-style-all-notes) .callout:not([data-callout=\"columns\"]) {");
    expect(code).not.toMatch(/(^|\n)body\s*\{[^}]*(--file-line-width|--line-height-normal|--link-color)/);
    expect(code).not.toMatch(/(^|\n)\.markdown-rendered h\d|(^|\n)\.cm-header-\d|(^|\n)\.cm-active/);
    // the only bare `.vt ` ancestors left are the kit-only back link
    expect([...code.matchAll(/(^|\n|, )\.vt (?!a\.vt-back)/g)]).toEqual([]);
  });
});

describe("callout colours are real colours (S4)", () => {
  it("no kit CSS gives --callout-color a bare r, g, b triplet or a bare variable that holds one", () => {
    const dirs = readdirSync("kits").map(k => `kits/${k}/.obsidian/snippets`).filter(existsSync);
    const files = [...dirs.flatMap(d => readdirSync(d).filter(f => f.endsWith(".css")).map(f => `${d}/${f}`)), "styles.css"];
    expect(files).toContain("kits/planning/.obsidian/snippets/vault-theme.css");
    for (const f of files) {
      const code = noComments(readFileSync(f, "utf8"));
      for (const m of code.matchAll(/--callout-color\s*:\s*([^;}]+)/g)) {
        const v = m[1].trim();
        expect(v, `${f}: --callout-color: ${v}`).not.toMatch(/^\d+\s*,\s*\d+\s*,\s*\d+$/);
        expect(v, `${f}: --callout-color: ${v}`).not.toMatch(/^var\(--vt-/);
        expect(v, `${f}: --callout-color: ${v}`).toMatch(/^(rgb|rgba|hsl|color-mix|var\(--color-)|^#/);
      }
      expect(code, f).not.toMatch(/rgba?\(\s*var\(--callout-color/);
    }
  });
  it("the card icon reads --callout-color as a colour, and every kit callout type is set", () => {
    expect(css).toMatch(/\.callout-icon \{ color: var\(--callout-color\) !important;/);
    for (const t of ["focus", "projects", "planning", "lab", "goto", "overdue", "summary", "question", "comment"]) {
      expect(css).toMatch(new RegExp(`\\.callout\\[data-callout="${t}"\\]\\s*\\{ --callout-color: rgb\\(var\\(--vt-[a-z]+-text\\)\\);`));
    }
  });
});
