// The plan map's look lives in the plugin's styles.css, not in the theme snippet (docs/plans/plan-map-styles-in-plugin.md).
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

const css = readFileSync("styles.css", "utf8");
const snippet = readFileSync("kits/planning/.obsidian/snippets/vault-theme.css", "utf8");
const sources = ["plan-map-render.ts", "blocks.ts", "plan-slide-ui.ts"].map(f => readFileSync(`src/planning/${f}`, "utf8")).join("\n");

// Class names the code adds only as a hook for itself: no rule, before or after the move.
const NO_RULE = new Set(["vt-map-warn"]);

describe("plan map styles", () => {
  it("the theme snippet no longer holds any .vt-map rule", () => {
    expect(snippet).not.toMatch(/vt-map/);
  });

  it("styles.css has a rule for every .vt-map class the code adds", () => {
    // `--vt-map-x` and friends are CSS variables set by the code, not classes
    const used = [...sources.matchAll(/(?<!-)\bvt-map-[a-z-]+/g)].map(m => m[0]).filter(c => !NO_RULE.has(c));
    const missing = [...new Set(used)].filter(c => !new RegExp(`\\.${c}(?![a-z-])`).test(css));
    expect(missing).toEqual([]);
  });

  it("the theme's card colours in the map rules have an Obsidian fallback", () => {
    const map = css.slice(css.indexOf("/* ---- Plan map"));
    const bare = map.match(/var\(--vt-(?:card-[a-z]+|divider)\)/g);
    expect(bare).toBeNull();
    expect(map).toMatch(/var\(--vt-card-border, var\(--background-modifier-border\)\)/);
  });

  // Shape standard (docs/design-standard.md): corners use the --lk-radius-* variables, never a number.
  // Each exception is an inline mark inside text or a grip corner, with the reason.
  const RADIUS_EXCEPTIONS: Record<string, string> = {
    ".cm-lab-kit-cell-": "3px: inline highlight of a calc table cell inside text (calc tables are audited in Phase 4)",
    ".lab-hazard-chip": "3px: inline hazard mark inside text (hazard header, Phase 4)",
    ".lab-hazard-row .lab-hazard-name": "3px: inline hazard name (hazard header, Phase 4)",
    ".vt-map-sub-grip": "4px: 10 px wide sub-tile grip, an inner corner of its tile",
  };

  it("styles.css has no bare border-radius number outside the listed exceptions", () => {
    const bad = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(m => /border-radius:(?![^;]*--lk-radius)[^;]*\b[1-9]\d*(px|%)/.test(m[2]))
      .map(m => m[1].replace(/\/\*[\s\S]*?\*\//g, "").trim())
      .filter(sel => !Object.keys(RADIUS_EXCEPTIONS).some(k => sel.startsWith(k)));
    expect(bad).toEqual([]);
  });

  it("styles.css does not use Obsidian's --radius-* for a Lab Kit corner", () => {
    expect(css).not.toMatch(/border-radius:[^;}]*var\(--radius-/);
  });
});

describe("plain prompt corners", () => {
  it("ask and pick add the lab-kit-prompt class and styles.css styles it", () => {
    const ask = readFileSync("src/planning/ask.ts", "utf8");
    expect((ask.match(/lab-kit-prompt/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(css).toMatch(/\.modal\.lab-kit-prompt \{[^}]*--lk-radius-card/);
    expect(css).toMatch(/\.lab-kit-prompt \.prompt-input \{[^}]*--lk-radius-control/);
  });
});

describe("theme snippet corners", () => {
  it("vault-theme.css has no bare border-radius number (variables with a fallback only)", () => {
    const bad = snippet.split("\n").filter(l => /border-radius:/.test(l) && !/var\(--(lk-radius-[a-z]+|vt-card-radius)/.test(l));
    expect(bad).toEqual([]);
  });
});

describe("lab-kit windows corner", () => {
  it("every contentEl class the kit windows use is covered by the card-corner rule", () => {
    const rule = css.split("\n").find(l => l.includes("--modal-radius: var(--lk-radius-card)") && l.startsWith(".modal:has("))!;
    expect(rule).toBeTruthy();
    for (const c of ["lab-kit-modal", "lab-kit-win", "lab-kit-tidy"]) expect(rule).toContain(`.modal-content.${c}`);
  });
});
