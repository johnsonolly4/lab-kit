// Planning commands' rules (src/planning/actions.ts), checked against the old Action templates' behaviour.
import { describe, it, expect } from "vitest";
import { deckPath, isArchivable, shoppingAppend, splitItems, topicsWithoutHub, uniquePath } from "../src/planning/actions";

describe("shopping list", () => {
  it("splits on commas and drops empty items", () => {
    expect(splitItems(" acetone, , DCM ,gloves ")).toEqual(["acetone", "DCM", "gloves"]);
    expect(splitItems("  ")).toEqual([]);
  });
  it("appends after one line break, with or without a trailing newline", () => {
    expect(shoppingAppend("# List\n- [ ] a\n", ["b", "c"])).toBe("# List\n- [ ] a\n- [ ] b\n- [ ] c\n");
    expect(shoppingAppend("# List\n- [ ] a", ["b"])).toBe("# List\n- [ ] a\n- [ ] b\n");
    expect(shoppingAppend("# List\n- [ ] a\n\n\n", ["b"])).toBe("# List\n- [ ] a\n- [ ] b\n");
  });
});

describe("uniquePath", () => {
  it("adds 2, 3, … when the name is taken", () => {
    const taken = new Set(["00 Inbox/Capture.md", "00 Inbox/Capture 2.md"]);
    expect(uniquePath("00 Inbox", "Capture", "md", p => taken.has(p))).toBe("00 Inbox/Capture 3.md");
    expect(uniquePath("00 Inbox", "Idea", "md", p => taken.has(p))).toBe("00 Inbox/Idea.md");
    expect(uniquePath("", "Capture", "md", () => false)).toBe("Capture.md");
  });
});

describe("archive", () => {
  const now = new Date(2026, 9, 7, 14, 0);   // 7 Oct 2026, 14:00
  const old = new Date(2026, 7, 1);
  it("archives done_on 30 or more days ago, keeps 29", () => {
    expect(isArchivable({ done: true, done_on: "2026-09-07" }, now, now)).toBe(true);    // exactly 30 days: before the cut-off (14:00)
    expect(isArchivable({ done: true, done_on: "2026-09-06" }, now, now)).toBe(true);
    expect(isArchivable({ done: true, done_on: "2026-09-08" }, old, now)).toBe(false);   // 29 days, even though the note is old
  });
  it("uses the last change when done_on is missing or not a day", () => {
    expect(isArchivable({ done: true }, old, now)).toBe(true);
    expect(isArchivable({ done: true, done_on: "soon" }, now, now)).toBe(false);
    expect(isArchivable({ done: true }, new Date(2026, 8, 7, 15, 0), now)).toBe(false);  // 30 days minus one hour
  });
  it("keeps a finished to-do of a project that is not Done", () => {
    expect(isArchivable({ done: true, project: "[[Alpha]]" }, old, now, true)).toBe(false);
    expect(isArchivable({ done: true, project: "[[Alpha]]" }, old, now, false)).toBe(true);   // project Done or not found
  });
  it("counts day: Done as finished, leaves open to-dos", () => {
    expect(isArchivable({ day: "Done", done: false }, old, now)).toBe(true);
    expect(isArchivable({ day: "Mon", done: false }, old, now)).toBe(false);
    expect(isArchivable({}, old, now)).toBe(false);
  });
});

describe("deckPath", () => {
  it("picks this computer's path and strips quotes", () => {
    const fm = { deck_mac: ' "/Users/x/Deck.pptx" ', deck_windows: "'C:\\Decks\\Deck.pptx'" };
    expect(deckPath(fm, true)).toBe("/Users/x/Deck.pptx");
    expect(deckPath(fm, false)).toBe("C:\\Decks\\Deck.pptx");
  });
  it("is empty when not set or not text", () => {
    expect(deckPath({}, true)).toBe("");
    expect(deckPath({ deck_windows: 3 }, false)).toBe("");
  });
});

describe("topicsWithoutHub", () => {
  const folders = ["06 Knowledge", "06 Knowledge/Polymers", "06 Knowledge/Polymers/Deep", "06 Knowledge/Synthesis", "06 Knowledge/Safety", "06 Knowledge Extra/Other"];
  it("lists the topic folders directly under the root that have no hub", () => {
    expect(topicsWithoutHub(folders, [], "06 Knowledge")).toEqual(["06 Knowledge/Polymers", "06 Knowledge/Safety", "06 Knowledge/Synthesis"]);
  });
  it("a folder-named note or any kind: hub note counts as a hub; a hub deeper down does not", () => {
    const notes = [
      { path: "06 Knowledge/Polymers/Polymers.md", kind: undefined },
      { path: "06 Knowledge/Synthesis/Index.md", kind: "hub" },
      { path: "06 Knowledge/Safety/Deep/Deep.md", kind: "hub" },
      { path: "06 Knowledge/Safety/Rules.md", kind: "concept" },
    ];
    expect(topicsWithoutHub(folders, notes, "06 Knowledge")).toEqual(["06 Knowledge/Safety"]);
  });
});
