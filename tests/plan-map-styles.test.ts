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
});
