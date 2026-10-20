// Phase 1 of docs/plans/lab-notes-board-and-completed-view.md: the kit's `Lab book base.base` holds the running board AND the
// completed views in one file (the Bases view menu is the switch). The .base text is read as plain lines (no YAML library):
// the file is small and every key below is one the throwaway Obsidian 1.14.4 accepted (Phase 0 table in the plan).
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { inFolders, patchFolders } from "../src/kit/managed";

const text = readFileSync("kits/lab/03 Lab Book/Lab book base.base", "utf8");
const lines = (s: string) => s.split(/\r?\n/);

/** The part of the file before `views:` (base-wide keys). */
const head = text.slice(0, text.indexOf("\nviews:"));
/** One block of text per view, in file order. */
const views = text.slice(text.indexOf("\nviews:")).split(/\n  - type: /).slice(1).map((b) => "  - type: " + b);
const view = (name: string) => views.find((v) => lines(v).includes(`    name: ${name}`)) ?? "";
const typeOf = (v: string) => /^  - type: (\S+)/.exec(v)![1];
/** Expressions of a view's `filters:` block, whatever the and / or wrapper. */
const filterLines = (v: string) => {
  const ls = lines(v), i = ls.indexOf("    filters:");
  if (i < 0) return [];
  const out: string[] = [];
  for (const l of ls.slice(i + 2)) { if (!l.startsWith("        - ")) break; out.push(l.slice(10)); }
  return out;
};
const wrapper = (v: string) => lines(v)[lines(v).indexOf("    filters:") + 1].trim();
const sortOf = (v: string) => { const m = /    sort:\n      - property: (\S+)\n        direction: (\w+)/.exec(v); return m ? `${m[1]} ${m[2]}` : ""; };
const orderOf = (v: string) => { const ls = lines(v), i = ls.indexOf("    order:"); const out: string[] = []; for (const l of ls.slice(i + 1)) { if (!l.startsWith("      - ")) break; out.push(l.slice(8)); } return out; };

describe("Lab book base.base (kit)", () => {
  it("is one base with the running board first, so it opens first, then the list, then the completed views", () => {
    expect(views.map((v) => [typeOf(v), /    name: (.+)/.exec(v)![1]])).toEqual([
      ["kanban", "Experiments"], ["list", "All experiments"], ["table", "Completed experiments"], ["table", "RAFT experiments"], ["table", "Closed this year"],
    ]);
  });

  it("base filter is the Lab notes folder (the one folder string patchFolders follows)", () => {
    expect(inFolders(text)).toEqual(["03 Lab Book/Notes"]);
    expect(head).toContain('    - file.inFolder("03 Lab Book/Notes")');
    // a folder setting change rewrites only that string; the views stay byte for byte
    const moved = patchFolders(text, text.replace("03 Lab Book/Notes", "03 Lab Book/Entries"))!;
    expect(moved.replace("03 Lab Book/Entries", "03 Lab Book/Notes")).toBe(text);
  });

  it("Ended is the closed_on column's name (note.closed_on, as Bases wrote it in Obsidian 1.14.4)", () => {
    expect(head).toContain("properties:\n  note.closed_on:\n    displayName: Ended");
  });

  it("running board: columns, order and sort unchanged; a Closed card stays 30 days from closed_on, from the last edit when there is none", () => {
    const b = view("Experiments");
    expect(filterLines(b)).toEqual(['Status != "Closed" || if(closed_on, closed_on > now() - "30d", file.mtime > now() - "30d")']);
    expect(b).toContain("    groupBy:\n      property: Status\n      direction: ASC");
    expect(b).toContain("    groupOrder:\n      - Planned\n      - Started\n      - Processing results\n      - Closed");
    expect(sortOf(b)).toBe("file.name DESC");
    expect(orderOf(b)).toEqual(["file.name", "progress"]);
  });

  it("All experiments is unchanged", () => {
    const l = view("All experiments");
    expect(filterLines(l)).toEqual([]);
    expect(sortOf(l)).toBe("file.name DESC");
    expect(orderOf(l)).toEqual(["file.name", "Status", "progress"]);
  });

  it("Completed experiments: Status Closed or closed_on set, newest end date first, the six columns", () => {
    const c = view("Completed experiments");
    expect(wrapper(c)).toBe("or:");
    expect(filterLines(c)).toEqual(['Status == "Closed"', "closed_on"]);
    expect(sortOf(c)).toBe("closed_on DESC");
    expect(orderOf(c)).toEqual(["file.name", "Exp. Class", "Chemicals", "Outcome", "Status", "closed_on"]);
  });

  it("RAFT experiments: the class text contains raft, any case (a property name with a space and a dot needs note[\"…\"] in a filter)", () => {
    const r = view("RAFT experiments");
    expect(filterLines(r)).toEqual(['note["Exp. Class"].lower().contains("raft")']);
    expect(orderOf(r)).toEqual(orderOf(view("Completed experiments")));
  });

  it("Closed this year: closed_on is in the current year", () => {
    const y = view("Closed this year");
    expect(filterLines(y)).toEqual(["closed_on.year == now().year"]);
    expect(sortOf(y)).toBe("closed_on DESC");
  });

  it("every filter line avoids what Obsidian 1.14.4 silently turned into an empty table", () => {
    const all = views.flatMap(filterLines).join("\n");
    expect(all).not.toMatch(/ = "/);                       // Status = "Closed" (single =) matched nothing
    expect(all).not.toMatch(/(^|\s)Exp\. Class\b/);        // a bare name with a space and a dot matched nothing in a filter
    for (const v of views) expect(typeOf(v)).toMatch(/^(kanban|list|table)$/);   // only built-in view types: the file works with the plugin off
  });
});
