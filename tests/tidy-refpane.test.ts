// Tidy "Paper boxes: use refpane's blocks": Lab Kit's old paper boxes (the kit files before the refpane switch-over, tests/fixtures/refpane-swap/)
// become refpane blocks; a Dataview query you changed is left alone.
import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { scan, selectChanges, wantsText, type TidyContext, type TidyFile } from "../src/kit/tidy";
import { swapRefpaneBlocks } from "../src/kit/tidy-refpane-boxes";

const fx = (n: string): string => readFileSync(`tests/fixtures/refpane-swap/${n}`, "utf8");
const ctx: TidyContext = {
  labFolder: "03 Lab Book/Notes", knowledgeFolder: "06 Knowledge", inboxFolder: "00 Inbox", contractFolders: [], rootNotes: ["00 Home.md"], migrations: [], todoQueries: true,
};
const NEW: Record<string, string[]> = {
  "Home.md": ["```refpane", "show: recently-read", "limit: 5"],
  "Meeting.md": ["```refpane", "show: papers-read"],
  "Literature.md": ["show: to-read", "limit: 10", "show: key-papers", "show: recently-read", "limit: 15", "show: by-tag"],
  "Projects-overview.md": ["show: key-papers-by-project"],
  "Project-hub.md": ["show: project-papers"],
};

describe("Tidy: paper boxes become refpane blocks", () => {
  for (const [name, want] of Object.entries(NEW)) {
    it(`${name}: the old boxes are swapped, nothing else changes`, () => {
      const before = fx(name), after = swapRefpaneBlocks(before);
      for (const l of want) expect(after, l).toContain(l);
      expect(after).not.toMatch(/show: (meeting-papers)|```dataview\n(> )*LIST WITHOUT ID (link\(file\.path, Title\)|choice)/);
      if (name === "Home.md" || name === "Meeting.md") expect(after.split("\n").length).toBe(before.split("\n").length);
      expect(swapRefpaneBlocks(after)).toBe(after);   // a second pass changes nothing
    });
  }
  it("Literature: the 'Ideas to try' query is not one of the kit's paper boxes and stays", () => {
    expect(swapRefpaneBlocks(fx("Literature.md"))).toContain('meta(L.section).subpath = "To try"');
  });
  it("a Dataview query you edited is left alone", () => {
    const edited = fx("Projects-overview.md").replace("SORT key ASC", "SORT key DESC");
    expect(swapRefpaneBlocks(edited)).toBe(edited);
  });
  it("the scan lists it as an opt-in group; selecting it writes the body, other groups untouched", () => {
    const m = new Map([["00 Home.md", fx("Home.md")], ["04 Literature/Literature.md", fx("Literature.md")]]);
    const files: TidyFile[] = [...m.keys()].map(path => ({ path, text: wantsText(path, ctx, false) ? m.get(path) : undefined }));
    const s = scan(files, ctx), g = s.groups.find(x => x.id === "refpane-blocks")!;
    expect(g.optIn).toBe(true);
    expect(g.changes.map(c => c.path).sort()).toEqual(["00 Home.md", "04 Literature/Literature.md"]);
    expect(selectChanges(s, new Set(["refpane-blocks"])).length).toBe(2);
    expect(scan(files, { ...ctx, todoQueries: undefined }).groups.find(x => x.id === "refpane-blocks")).toBeUndefined();
  });
});
