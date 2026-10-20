// The button-bar block: ids → buttons from the one table (src/planning/button-bar.ts), read from the Meta Bind template file.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { BAR_BUTTONS, applyReplace, cmdId, openName, parseAlignEnd, parseIds, resolveBar, type BarEdit } from "../src/planning/button-bar";
import { commandInfo, runCommand } from "../src/kit/obsidian-private";
import type { App } from "obsidian";
import { PLANNING_BUTTONS } from "../src/planning/buttons";

describe("the button table", () => {
  it("has every Meta Bind template id, each as a command, an open link or an edit (none left unknown)", () => {
    for (const t of PLANNING_BUTTONS) expect(BAR_BUTTONS.get(t.id)?.kind, t.id).toMatch(/^(command|open|edit)$/);
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

describe("parseAlignEnd", () => {
  it("is true only for an align: end line", () => {
    expect(parseAlignEnd("show: button-bar\nids: help\nalign: end\n")).toBe(true);
    expect(parseAlignEnd("ids: help")).toBe(false);
    expect(parseAlignEnd("align: start")).toBe(false);
  });
});

describe("resolveBar", () => {
  it("keeps good ids in order and reports a wrong id in plain words", () => {
    const r = resolveBar(["todo", "nope", "shop-clear", "go-deck"]);
    expect(r.buttons.map(b => b.id)).toEqual(["todo", "shop-clear", "go-deck"]);
    expect(r.problems).toEqual(['"nope" is not a button']);
  });
});

describe("edit buttons (same result as the Meta Bind actions in the JSON)", () => {
  const clear = BAR_BUTTONS.get("shop-clear")?.edit as Extract<BarEdit, { type: "replace" }>;
  it("Clear ticked removes ticked lines only, with their line break, indented ones too", () => {
    const note = "---\nkind: list\n---\n\n- [ ] milk\n- [x] DCM 2.5 L\n  - [X] nested\n- [ ] gloves\n- [x] last, no newline";
    expect(applyReplace(note, clear)).toBe("---\nkind: list\n---\n\n- [ ] milk\n- [ ] gloves\n");
    expect(applyReplace("a\r\n- [x] b\r\nc", clear)).toBe("a\r\nc");
  });
  it("Clear ticked leaves a note with nothing ticked unchanged, and prose that mentions [x] alone", () => {
    const note = "- [ ] a\ntext - [x] not a task\n";
    expect(applyReplace(note, clear)).toBe(note);
  });
  it("Start a new review sets r1 to r6 to the boolean false", () => {
    expect(BAR_BUTTONS.get("clear-review")?.edit).toEqual({ type: "properties", values: { r1: false, r2: false, r3: false, r4: false, r5: false, r6: false } });
  });
});

describe("the block's code", () => {
  it("focuses the clicked button before the command runs, so the window opens under it", () => {
    const src = readFileSync("src/planning/blocks.ts", "utf8");
    expect(src).toMatch(/btn\.focus\(\); this\.pressButton\(b\)/);
    expect(src).toContain('case "button-bar"');
    expect(src).toMatch(/vault\.process\(file, text => applyReplace\(text, e\)\)/);   // one atomic write
    expect(src).toMatch(/processFrontMatter\(file, fm => \{ Object\.assign\(fm, e\.values\)/);
  });
});

describe("cmd: ids run any Obsidian command", () => {
  const ran: string[] = [];
  const app = { commands: { commands: { "refpane:toggle-queue": { name: "Refpane: Toggle queue", icon: "list-checks" }, "other:plain": { name: "Plain one" } }, executeCommandById: (id: string) => { ran.push(id); return true; } } } as unknown as App;
  const lookup = (id: string) => commandInfo(app, id);

  it("parseIds keeps the id whole, colon and all", () => {
    expect(parseIds("show: button-bar\nids: todo, cmd:refpane:toggle-queue go-deck")).toEqual(["todo", "cmd:refpane:toggle-queue", "go-deck"]);
    expect(cmdId("cmd:refpane:toggle-queue")).toBe("refpane:toggle-queue");
    expect(cmdId("cmd:")).toBeNull();
    expect(cmdId("todo")).toBeNull();
  });
  it("label and icon come from the command; a command with no icon gets the generic one", () => {
    const r = resolveBar(["cmd:refpane:toggle-queue", "cmd:other:plain"], lookup);
    expect(r.problems).toEqual([]);
    expect(r.buttons).toMatchObject([{ label: "Refpane: Toggle queue", icon: "list-checks", kind: "command", target: "refpane:toggle-queue" }, { label: "Plain one", icon: "zap", kind: "command", target: "other:plain" }]);
  });
  it("a missing command (plugin off) gives the same muted line as an unknown id, and no button", () => {
    const r = resolveBar(["cmd:nope:gone", "todo"], lookup);
    expect(r.problems).toEqual(['"cmd:nope:gone" is not a button']);
    expect(r.buttons.map(b => b.id)).toEqual(["todo"]);
    expect(resolveBar(["cmd:refpane:toggle-queue"]).buttons).toEqual([]);   // no lookup: none
  });
  it("a click runs the command once, by its id", () => {
    const b = resolveBar(["cmd:refpane:toggle-queue"], lookup).buttons[0];
    expect(runCommand(app, b.target)).toBe(true);
    expect(ran).toEqual(["refpane:toggle-queue"]);
  });
  it("existing ids resolve as before when a lookup is given", () => {
    expect(resolveBar(["todo", "nope"], lookup).buttons.map(b => b.id)).toEqual(["todo"]);
  });
});
