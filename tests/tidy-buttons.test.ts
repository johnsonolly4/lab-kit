// Button bar plan Phase 5: Tidy up notes swaps a line of Meta Bind buttons for the plugin's button bar (opt-in).
import { describe, it, expect } from "vitest";
import { scan, selectChanges, wantsText, type TidyContext, type TidyFile } from "../src/kit/tidy";
import { applyTidy, type TidyIO } from "../src/kit/tidy-apply";

const ctx: TidyContext = {
  labFolder: "03 Lab Book/Notes", knowledgeFolder: "06 Knowledge", inboxFolder: "00 Inbox", contractFolders: [], rootNotes: ["00 Home.md"], migrations: [],
  buttonFolders: ["00 Planning", "02 Projects", "08 Meetings", "01 Daily Notes"],
};
const FM = "---\nkind: list\ncssclasses:\n  - vt\n---\n";
const vault = (): Map<string, string> => new Map([
  ["00 Home.md", `${FM}\n# Home \`BUTTON[help]\`\n\n\`BUTTON[today, todo, lab]\`\n\nText.\n`],
  ["00 Planning/Shopping list.md", `${FM}\n\`BUTTON[shop-add, shop-clear]\`\n- [ ] milk\n`],
  ["00 Planning/Weekly review.md", `${FM}\n> \`INPUT[toggle:r1]\` Empty the inbox \`BUTTON[sort-inbox]\`\n>\n> \`BUTTON[clear-review]\`\n`],
  ["08 Meetings/Meetings.md", `${FM}\n\`BUTTON[new-meeting, my-own-button]\`\n`],
  ["01 Daily Notes/2026-10-01.md", `${FM}\n\`BUTTON[todo, go-todo]\`\n\n\`\`\`\n\`BUTTON[todo]\`\n\`\`\`\n`],
  ["Extras/Templates/Daily note.md", `${FM}\n\`BUTTON[todo, go-todo]\`\n`],
  ["02 Projects/Polymers/My note.md", "no properties\n\n`BUTTON[todo]`\n"],
]);
const files = (m: Map<string, string>): TidyFile[] => [...m.keys()].map(path => ({ path, text: wantsText(path, ctx, false) ? m.get(path) : undefined }));
const group = (m: Map<string, string>) => scan(files(m), ctx).groups.find(g => g.id === "button-bar");
const io = (m: Map<string, string>): TidyIO => ({
  read: async p => m.get(p) ?? null, write: async (p, t) => { m.set(p, t); }, backup: async p => `backups/${p}`, exists: p => m.has(p),
  filesIn: p => [...m.keys()].filter(k => k === p), linkedFrom: () => [], rename: async () => undefined, create: async (p, t) => { m.set(p, t); },
  settingSnapshot: () => "", setSetting: async () => null,
});

describe("Tidy: button lines become the button bar", () => {
  it("opt-in; only whole lines of known buttons in notes with properties, outside Extras and code fences", () => {
    const g = group(vault())!;
    expect(g.optIn).toBe(true);
    expect(g.changes.map(c => c.path).sort()).toEqual(["00 Home.md", "00 Planning/Shopping list.md", "01 Daily Notes/2026-10-01.md"]);
  });
  it("the root note and the folders the kit's notes live in are read", () => {
    expect(wantsText("00 Home.md", ctx, false)).toBe(true);
    expect(wantsText("00 Planning/Shopping list.md", ctx, false)).toBe(true);
    expect(wantsText("05 Other/x.md", ctx, false)).toBe(false);
  });
  it("applied: the block replaces the line, the heading's inline button, a toggle line and a fenced example stay, a backup is made", async () => {
    const m = vault(), backups: string[] = [];
    const g = group(m)!, i = io(m);
    i.backup = async p => { backups.push(p); return `b/${p}`; };
    const out = await applyTidy(i, selectChanges({ groups: [g], reported: [] }, new Set(["button-bar"])));
    expect(out.skipped).toEqual([]);
    const home = m.get("00 Home.md")!;
    expect(home).toContain("```vault-card\nshow: button-bar\nids: today, todo, lab\n```");
    expect(home).toContain("# Home `BUTTON[help]`");   // inline in a heading: left alone
    expect(m.get("00 Planning/Shopping list.md")).toContain("ids: shop-add, shop-clear");
    expect(m.get("00 Planning/Weekly review.md")).toContain("`INPUT[toggle:r1]` Empty the inbox `BUTTON[sort-inbox]`");
    expect(m.get("01 Daily Notes/2026-10-01.md")).toContain("```\n`BUTTON[todo]`\n```");   // inside a code fence
    expect(m.get("01 Daily Notes/2026-10-01.md")).toContain("ids: todo, go-todo");
    expect(m.get("Extras/Templates/Daily note.md")).toContain("`BUTTON[todo, go-todo]`");
    expect(backups.sort()).toEqual(["00 Home.md", "00 Planning/Shopping list.md", "01 Daily Notes/2026-10-01.md"]);
  });
  it("a line with a button Lab Kit does not know is left as it is and reported", () => {
    const r = scan(files(vault()), ctx);
    const item = r.reported.flatMap(x => x.items).find(i => i.path === "08 Meetings/Meetings.md");
    expect(item?.note).toContain("my-own-button");
  });
  it("a second scan finds nothing to change", async () => {
    const m = vault();
    await applyTidy(io(m), selectChanges({ groups: [group(m)!], reported: [] }, new Set(["button-bar"])));
    expect(group(m)).toBeUndefined();
  });
});
