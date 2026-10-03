// v0.4: icons set in Settings → Lab Kit → Snippet menu (kit.snippetIcons) win over the snippet's own icon.
import { describe, it } from "vitest";
import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const labPick = require("../kit/Extras/scripts/templater/labPick.js");

const DATA = ".obsidian/plugins/lab-kit/data.json";
const KNOWN = ["test-tube", "flask-round", "magnet", "file-text"];

/** Opens the picker with a stubbed SuggestModal and returns the icon name shown for each item. */
async function shownIcons(items: { name: string; icon?: string }[], data: string | null): Promise<Record<string, string>> {
  (globalThis as any).app = {
    vault: { configDir: ".obsidian", adapter: { read: async (p: string) => { if (p === DATA && data !== null) return data; throw new Error("ENOENT " + p); } } }
  };
  let modal: any;
  class SuggestModal { constructor() { modal = this; } setPlaceholder() { /* not under test */ } open() { /* not under test */ } }
  const getIcon = (n: string) => KNOWN.includes(n) ? { icon: n } : null;
  void labPick({ obsidian: { SuggestModal, getIcon } }, items, "x");
  await new Promise(r => setTimeout(r, 0));
  const out: Record<string, string> = {};
  let cur = "";
  const holder = { style: {}, appendChild: (s: any) => { out[cur] = s.icon; }, createDiv: () => holder, createEl: () => ({ style: {} }) };
  const el = { style: {}, createDiv: () => holder };
  for (const it of modal.getSuggestions("")) { cur = it.name; modal.renderSuggestion(it, el); }
  return out;
}

const ITEMS = [{ name: "Solution prep", icon: "test-tube" }, { name: "NMR samples", icon: "magnet" }];

describe("labPick icons", () => {
  it("keeps each snippet's own icon without settings", async () => {
    assert.deepStrictEqual(await shownIcons(ITEMS, null), { "Solution prep": "test-tube", "NMR samples": "magnet" });
  });

  it("uses the icon set for that snippet name", async () => {
    const data = JSON.stringify({ kit: { snippetIcons: { "Solution prep": "flask-round" } } });
    assert.deepStrictEqual(await shownIcons(ITEMS, data), { "Solution prep": "flask-round", "NMR samples": "magnet" });
  });

  it("falls back to the snippet's own icon when the set name is not an icon", async () => {
    const data = JSON.stringify({ kit: { snippetIcons: { "Solution prep": "no-such-icon", "NMR samples": "  " } } });
    assert.deepStrictEqual(await shownIcons(ITEMS, data), { "Solution prep": "test-tube", "NMR samples": "magnet" });
  });
});
