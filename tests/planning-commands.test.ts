// Phase 4b: the planning commands (src/planning/commands.ts) and the kit's Meta Bind buttons that call them.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import type { EmbeddedKit } from "../src/kit/managed";
import { cleanName, sortedName, subfolders, todoFields } from "../src/planning/actions";
import { PlanningCommands, TPL } from "../src/planning/commands";
import type { TodoEngine } from "../src/planning/engine";
import { kitLoad } from "../src/kit/paths";
// @ts-expect-error plain .mjs build helper
import { embeddedKit } from "../scripts/embed-kit.mjs";

const planning = embeddedKit("kits/planning") as EmbeddedKit;
const lab = embeddedKit("kits/lab") as EmbeddedKit;
const buttons = JSON.parse(readFileSync("docs/plans/kit-files/planning/settings/meta-bind-buttons.json", "utf8")) as
  { buttonTemplates: { id: string; actions: { type: string; command?: string; templateFile?: string; link?: string }[] }[] };
const actions = buttons.buttonTemplates.flatMap(b => b.actions.map(a => ({ button: b.id, ...a })));

/** The command IDs a fake plugin is asked to register. */
function registered(): string[] {
  const ids: string[] = [];
  const plugin = { app: {}, addCommand: (c: { id: string }) => { ids.push(c.id); } };
  new PlanningCommands(plugin as never, null as never, {} as TodoEngine, () => kitLoad(undefined), { openSettings: () => {}, findMoved: () => {} }).register();
  return ids;
}

describe("planning commands", () => {
  it("registers the fixed IDs (never renamed: buttons call them)", () => {
    expect(registered().sort()).toEqual(["add-to-shopping", "archive-todos", "new-meeting", "new-project", "new-project-note", "new-todo",
      "open-deck", "quick-capture", "roll-over-todos", "sort-inbox"]);
  });

  it("runs templates the planning kit ships", () => {
    const shipped = new Map(planning.manifest.files.map(f => [f.id, f.dest]));
    for (const t of Object.values(TPL)) expect(shipped.get(t.id), t.id).toBe(t.dest);
  });
});

describe("Meta Bind buttons (kit-files source, shipped in Phase 6)", () => {
  it("every lab-kit: command is registered", () => {
    const ids = new Set(registered());
    const used = actions.filter(a => a.command?.startsWith("lab-kit:"));
    expect(used.length).toBe(9);
    for (const a of used) expect(ids.has(a.command!.slice("lab-kit:".length)), a.button).toBe(true);
  });

  it("no button runs a Templater file any more", () => {
    expect(actions.filter(a => a.type === "runTemplaterFile" || a.type === "templaterCreateNote" || a.templateFile)).toEqual([]);
  });

  it("every note a button opens is shipped by a kit", () => {
    const names = new Set([...planning.manifest.files, ...lab.manifest.files].map(f => f.dest.split("/").pop()!.replace(/\.md$/, "")));
    const links = actions.filter(a => a.link).map(a => a.link!.replace(/^\[\[|\]\]$/g, ""));
    expect(links.length).toBeGreaterThan(5);
    for (const l of links) expect(names.has(l), l).toBe(true);
  });
});

describe("sort inbox rules", () => {
  it("cleans names as the old template", () => {
    expect(cleanName(" a/b: c? [x] #1 ")).toBe("a-b- c- -x- -1");
    expect(sortedName("Capture 2", null)).toBe("Capture 2");
    expect(sortedName("Capture 2", "")).toBe("Capture 2");
    expect(sortedName("Capture 2", "Buy THF")).toBe("Buy THF");
  });
  it("lists the root and the folders below it, not look-alikes", () => {
    expect(subfolders(["06 Knowledge/Polymers", "06 Knowledge", "06 Knowledge 2", "07 How-tos", "06 Knowledge/A"], "06 Knowledge"))
      .toEqual(["06 Knowledge", "06 Knowledge/A", "06 Knowledge/Polymers"]);
  });
  it("makes a to-do on the Backlog, keeping project / due / meeting", () => {
    const fresh: Record<string, unknown> = { tags: ["x"] };
    todoFields(fresh);
    expect(fresh).toEqual({ tags: ["x"], kind: "todo", day: "Backlog", done: false, rolled: false, project: "", due: "", meeting: false });
    const kept: Record<string, unknown> = { project: "[[P]]", due: "2026-10-09", meeting: true, done: true, day: "Mon" };
    todoFields(kept);
    expect(kept).toMatchObject({ project: "[[P]]", due: "2026-10-09", meeting: true, done: false, day: "Backlog" });
  });
});
