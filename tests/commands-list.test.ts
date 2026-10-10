// Every command the plugin registers is listed in the How my vault works note (so the list can't drift).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string): string => readFileSync(p, "utf8");
const names = (): string[] => {
  const out: string[] = [];
  for (const p of ["src/main.ts", "src/kit/ui.ts", "src/planning/commands.ts"]) {
    const text = read(p);
    for (const m of text.matchAll(/addCommand\(\{[^}]*?name:\s*"([^"]+)"/g)) out.push(m[1]);
    for (const m of text.matchAll(/\badd\("[a-z-]+",\s*"([^"]+)"/g)) out.push(m[1]);
    for (const m of text.matchAll(/id:\s*"[a-z-]+",\s*name:\s*"([^"]+)"/g)) if (!out.includes(m[1])) out.push(m[1]);
  }
  return [...new Set(out)];
};

describe("commands list in How my vault works", () => {
  const note = read("kits/planning/07 How-tos/Obsidian/How my vault works.md");
  it("finds the commands in the source", () => expect(names().length).toBeGreaterThanOrEqual(26));
  it("lists every command by its name", () => {
    const missing = names().filter(n => !note.includes(`| ${n} |`));
    expect(missing).toEqual([]);
  });
});
