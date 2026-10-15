// The button-bar block: ids → buttons from the one table (src/planning/button-bar.ts), read from the Meta Bind template file.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { BAR_BUTTONS, openName, parseIds, resolveBar } from "../src/planning/button-bar";
import { PLANNING_BUTTONS } from "../src/planning/buttons";

/** Buttons whose edit the plugin must do itself: Phase 2 of docs/plans/button-bar-block.md. */
const PHASE_2 = ["clear-review", "shop-clear"];

describe("the button table", () => {
  it("has every Meta Bind template id, or lists it as an own edit for Phase 2", () => {
    for (const t of PLANNING_BUTTONS) {
      const b = BAR_BUTTONS.get(t.id);
      expect(b, t.id).toBeDefined();
      if (b?.kind === "own") expect(PHASE_2, t.id).toContain(t.id); else expect(PHASE_2).not.toContain(t.id);
    }
    expect([...BAR_BUTTONS.values()].filter(b => b.kind === "own").map(b => b.id).sort()).toEqual(PHASE_2);
  });
  it("takes label, icon and action from the template", () => {
    expect(BAR_BUTTONS.get("new-meeting")).toMatchObject({ label: "New meeting note", icon: "calendar-plus", kind: "command", target: "lab-kit:new-meeting" });
    expect(BAR_BUTTONS.get("go-meetings")).toMatchObject({ kind: "open", target: "Meetings" });
    expect(BAR_BUTTONS.get("go-todo")).toMatchObject({ kind: "open", target: "To-do board.base" });
    expect(BAR_BUTTONS.get("help")).toMatchObject({ plain: true, cls: "vt-help", tooltip: "How this vault works and how to use it" });
  });
  it("names an open target without folders, so a renamed planning folder still finds the note (Obsidian resolves the name)", () => {
    for (const b of BAR_BUTTONS.values()) if (b.kind === "open") expect(b.target, b.id).not.toMatch(/[[\]/|#]/);
    expect(openName("[[Notes/Meetings|the hub]]")).toBe("Notes/Meetings");
    expect(openName("[[Meetings#Next]]")).toBe("Meetings");
  });
});

describe("parseIds", () => {
  it("reads commas and spaces, keeps the order, drops repeats", () => {
    expect(parseIds("show: button-bar\nids: new-meeting, new-one-off-meeting  go-deck, new-meeting")).toEqual(["new-meeting", "new-one-off-meeting", "go-deck"]);
  });
  it("the key may repeat; no ids line gives none", () => {
    expect(parseIds("ids: a\nIDS: b, c")).toEqual(["a", "b", "c"]);
    expect(parseIds("show: button-bar")).toEqual([]);
  });
});

describe("resolveBar", () => {
  it("keeps good ids in order and reports a wrong id and one not built yet in plain words", () => {
    const r = resolveBar(["todo", "nope", "shop-clear", "go-deck"]);
    expect(r.buttons.map(b => b.id)).toEqual(["todo", "go-deck"]);
    expect(r.problems).toEqual(['"nope" is not a button', '"shop-clear" is not available in a button bar yet']);
  });
});

describe("the block's code", () => {
  it("focuses the clicked button before the command runs, so the window opens under it", () => {
    const src = readFileSync("src/planning/blocks.ts", "utf8");
    expect(src).toMatch(/btn\.focus\(\); this\.pressButton\(b\)/);
    expect(src).toContain('case "button-bar"');
  });
});
