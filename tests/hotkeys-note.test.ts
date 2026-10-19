// The Hotkeys how-to note recommends keys but sets none: every "Lab Kit: <name>" it names must be a command the plugin registers.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { RECOMMENDED_HOTKEYS } from "../src/kit/hotkey-check";
import { hotkeyText } from "../src/kit/setup-check";

const walk = (d: string): string[] => readdirSync(d).flatMap(n => statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]);
const note = readFileSync("kits/planning/07 How-tos/Obsidian/Hotkeys.md", "utf8");
const source = walk("src").filter(p => p.endsWith(".ts")).map(p => readFileSync(p, "utf8")).join("\n");

describe("Hotkeys note", () => {
  it("names only commands Lab Kit registers", () => {
    const named = [...note.matchAll(/Lab Kit: ([A-Z][^|\n,]*?)(?= \||,|\.| \(|$)/gm)].map(m => m[1].trim());
    expect(named.length).toBeGreaterThanOrEqual(3);
    for (const n of named) expect(source.includes(`"${n}"`), n).toBe(true);
  });

  it("gives every key once (no key assigned to two commands)", () => {
    const keys = [...note.matchAll(/^\| `([^`]+)` \|/gm)].map(m => m[1]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("matches the Check hotkeys list: same keys, same commands", () => {
    const rows = [...note.matchAll(/^\| `([^`]+)` \| ([^|]+) \| ([^|]+) \|/gm)].filter(m => m[1].startsWith("Alt+"));
    const rec = RECOMMENDED_HOTKEYS.filter(r => r.key);
    expect(rows.map(m => m[1])).toEqual(rec.map(r => hotkeyText(r.key!)));
    for (const [i, m] of rows.entries()) {
      expect(m[2].trim(), m[1]).toBe(rec[i].does);
      expect(m[3].replace(/\s*\(.*\)\s*$/, "").trim(), m[1]).toBe(rec[i].command);
    }
    const none = (note.match(/No key suggested[^:]*: Lab Kit: ([^\n]+)\./) ?? [])[1]?.split(", ") ?? [];
    expect(none.map(n => `Lab Kit: ${n}`)).toEqual(RECOMMENDED_HOTKEYS.filter(r => !r.key).map(r => r.command));
  });
});
