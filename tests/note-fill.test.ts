// The self-filling note (Phase 2 of docs/plans/templater-replacement-and-live-snippets.md): the pure rule and the runner, driven by a fake vault
// event stream. The orders and delays are the ones measured in Phase 0 (plan "Phase 0 result" items 2-3): explorer New note = create (empty) then
// file-open; Templater's raw header arrives about 0.3-0.5 s later; a synced-in file is never the active file.
import { describe, it } from "vitest";
import assert from "node:assert";
import { NoteFiller, boardStub, classify, rowFor, shouldFill, type FillHost } from "../src/kit/note-fill";
import { miniYaml as mini } from "./token-snippets";

/** miniYaml reads a key with no value as an empty list; a real YAML reader gives null. */
const miniYaml = (src: string): unknown => {
  const o = mini(src) as Record<string, unknown>;
  for (const k of Object.keys(o)) if (Array.isArray(o[k]) && !(o[k] as unknown[]).length) o[k] = null;
  return o;
};

const TPL = "---\nmake: note\nfields:\n  - key: project\n    label: Project\n---\n---\nkind: todo\nproject: {{project}}\n---\n";
const FILLED = "---\nkind: todo\nproject: P1\n---\n";
const ROWS = [{ folder: "00 Planning/To-dos", file: "To-do.md" }];
const P = "00 Planning/To-dos/New.md";

class FakeVault {
  files = new Map<string, string>();
  active: string | null = null;
  templaterFolders: string[] = [];
  writes: string[] = [];
  asked = 0;
  answer: Record<string, string> | null = { project: "P1" };
  failures: string[] = [];
  host: FillHost = {
    rows: () => ROWS, templaterFolders: () => this.templaterFolders, activePath: () => this.active,
    read: async p => this.files.get(p) ?? null,
    template: async f => f === "To-do.md" ? TPL : null,
    write: async (p, expected, text) => { if (this.files.get(p) !== expected) return false; this.files.set(p, text); this.writes.push(p); return true; },
    ask: async () => { this.asked++; return this.answer; },
    env: () => ({ parseYaml: miniYaml }), parseYaml: miniYaml, failed: (_p, m) => this.failures.push(m),
  };
  filler = new NoteFiller(this.host);
  open(p: string) { this.active = p; return this.filler.check(p); }
  modify(p: string, text: string) { this.files.set(p, text); return this.filler.check(p); }
}

describe("classify", () => {
  it("empty, raw header, mixed, other", () => {
    assert.equal(classify("  \n", miniYaml), "empty");
    assert.equal(classify(TPL, miniYaml), "raw-header");
    assert.equal(classify("---\nkind: todo\nmake: note\nfields:\n  - key: a\n    label: A\n---\n---\nkind: todo\n---\n", miniYaml), "mixed");
    assert.equal(classify(FILLED, miniYaml), "other");
    assert.equal(classify("---\nkind: todo\n---\n", miniYaml), "other");
    assert.equal(classify("# a note about make: note\n", miniYaml), "other");
  });
});

describe("rowFor", () => {
  it("the deepest row at or above the note's folder; a name that only starts the same does not match", () => {
    const rows = [{ folder: "A", file: "a" }, { folder: "A/B", file: "b" }];
    assert.equal(rowFor(rows, "A/B/C/n.md")?.file, "b");
    assert.equal(rowFor(rows, "A/x.md")?.file, "a");
    assert.equal(rowFor(rows, "AB/x.md"), null);
    assert.equal(rowFor(rows, "n.md"), null);
  });
});

describe("shouldFill", () => {
  const base = { text: "", path: P, active: true, rows: ROWS, templaterFolders: [], rowTemplateText: TPL, parseYaml: miniYaml };
  it("an empty open note in a mapped folder with no Templater row is filled from the row's template", () => {
    assert.deepEqual(shouldFill(base), { action: "fill", source: "row-template" });
  });
  it("not open: left alone, empty or raw", () => {
    assert.deepEqual(shouldFill({ ...base, active: false }), { action: "skip", reason: "not-open" });
    assert.deepEqual(shouldFill({ ...base, active: false, text: TPL }), { action: "skip", reason: "not-open" });
  });
  it("a Templater row for the folder: an empty note is left, a raw header is filled", () => {
    assert.deepEqual(shouldFill({ ...base, templaterFolders: ["00 Planning"] }), { action: "skip", reason: "templater-row" });
    assert.deepEqual(shouldFill({ ...base, templaterFolders: ["00 Planning/To-dos"], text: TPL }), { action: "fill", source: "raw-header" });
  });
  it("an empty note whose template is a Templater template or missing is left", () => {
    assert.equal((shouldFill({ ...base, rowTemplateText: "<% tp.date.now() %>" }) as { reason: string }).reason, "not-token-template");
    assert.equal((shouldFill({ ...base, rowTemplateText: null }) as { reason: string }).reason, "not-token-template");
  });
  it("outside a mapped folder nothing is filled, not even a raw header (a template file being edited)", () => {
    assert.deepEqual(shouldFill({ ...base, path: "Extras/Templates/To-do.md", text: TPL }), { action: "skip", reason: "unmapped" });
  });
  it("a mixed note and an ordinary note are left", () => {
    const mixed = "---\nkind: todo\nmake: note\n---\n---\nkind: todo\n---\n";
    assert.deepEqual(shouldFill({ ...base, text: mixed }), { action: "skip", reason: "mixed" });
    assert.deepEqual(shouldFill({ ...base, text: FILLED }), { action: "skip", reason: "other" });
  });
});

describe("the runner on a vault event stream", () => {
  it("explorer New note, no Templater row: create (empty) does nothing, file-open fills once; a second open and a modify do not fill again", async () => {
    const v = new FakeVault();
    v.files.set(P, "");                          // create: the runner is not called for create
    assert.equal((await v.open(P)).action, "fill");
    assert.equal(v.files.get(P), FILLED);
    assert.equal(v.asked, 1);
    assert.equal((await v.open(P)).action, "skip");
    assert.equal((await v.modify(P, FILLED + "x")).action, "skip");
    assert.deepEqual(v.writes, [P]);
  });
  it("a synced-in file that is not open is left alone, empty or whole; opening it later does not fill a whole note", async () => {
    const v = new FakeVault();
    v.files.set("00 Planning/To-dos/Sync.md", "");
    v.active = "Other.md";
    assert.deepEqual(await v.filler.check("00 Planning/To-dos/Sync.md"), { action: "skip", reason: "not-open" });
    v.files.set("00 Planning/To-dos/Whole.md", FILLED);
    assert.equal((await v.open("00 Planning/To-dos/Whole.md")).action, "skip");
    assert.deepEqual(v.writes, []);
  });
  it("Templater has a row: the empty note is left at file-open; the raw header arriving 0.3-0.5 s later (a modify) is filled once", async () => {
    const v = new FakeVault();
    v.templaterFolders = ["00 Planning/To-dos"];
    v.files.set(P, "");
    assert.deepEqual(await v.open(P), { action: "skip", reason: "templater-row" });
    assert.deepEqual(v.writes, []);
    assert.equal((await v.modify(P, TPL)).action, "fill");        // Templater's fill: the raw header
    assert.equal(v.files.get(P), FILLED);
    assert.equal((await v.modify(P, FILLED)).action, "skip");     // the no-change pass Templater makes after ours
    assert.deepEqual(v.writes, [P]);
  });
  it("a raw header written while the note is not open waits until it is opened", async () => {
    const v = new FakeVault();
    v.files.set(P, TPL);
    v.active = "Other.md";
    assert.equal((await v.filler.check(P)).action, "skip");
    assert.equal((await v.open(P)).action, "fill");
    assert.equal(v.files.get(P), FILLED);
  });
  it("a mixed note is never filled, at open or later", async () => {
    const v = new FakeVault();
    const mixed = "---\nkind: todo\nmake: note\nfields:\n  - key: project\n    label: Project\n---\n---\nkind: todo\n---\n";
    v.files.set(P, mixed);
    assert.deepEqual(await v.open(P), { action: "skip", reason: "mixed" });
    assert.equal(v.files.get(P), mixed);
    assert.equal(v.asked, 0);
  });
  it("the same note opened twice at once is filled once and asked once", async () => {
    const v = new FakeVault();
    v.files.set(P, "");
    v.active = P;
    const [a, b] = await Promise.all([v.filler.check(P), v.filler.check(P)]);
    assert.deepEqual([a.action, b.action].sort(), ["fill", "skip"]);
    assert.equal(v.asked, 1);
    assert.deepEqual(v.writes, [P]);
  });
  it("a cancelled form leaves the note as it is and is not asked again", async () => {
    const v = new FakeVault();
    v.answer = null;
    v.files.set(P, "");
    await v.open(P);
    await v.open(P);
    assert.equal(v.asked, 1);
    assert.equal(v.files.get(P), "");
  });
  it("a note changed while the form was open is not overwritten, and is looked at again", async () => {
    const v = new FakeVault();
    v.files.set(P, "");
    const slow = v.host.ask;
    v.host.ask = async (h, n) => { v.files.set(P, "typed"); return slow(h, n); };
    v.active = P;
    await v.filler.check(P);
    assert.equal(v.files.get(P), "typed");
    assert.deepEqual(v.writes, []);
  });
  it("a template that cannot be filled gives one message and no write", async () => {
    const v = new FakeVault();
    v.answer = {};
    const bad = "---\nmake: note\nfields:\n  - key: project\n    label: Project\n---\n{{nope}}\n";
    v.files.set(P, bad);
    v.active = P;
    const d = await v.filler.check(P);
    assert.equal(d.action, "skip");
    assert.equal(v.failures.length, 1);
    assert.equal(v.files.get(P), bad);
  });
});

/* ---------- the board's New (Phase 3): a stub with only the column and empty keys ---------- */

const STUB = "---\nscheduled: 2026-10-21\ndone:\n---\n";
const STUB_DAY = "---\nday: Wed\ndone:\n---\n";
const STUB_BACKLOG = "---\ndone:\n---\n";
/** What Templater's row makes of STUB in the plan's Phase 0 measurement: the header keys and the stub's keys in one front matter, then the template's own text. */
const MIXED_STUB = "---\nscheduled: 2026-10-21\ndone:\nmake: note\nfields:\n  - key: project\n    label: Project\n---\n---\nkind: todo\nproject: {{project}}\n---\n";

describe("boardStub / classify: the board's New", () => {
  it("the column's date or weekday, or none (the Backlog); only empty keys besides", () => {
    assert.deepEqual(boardStub(STUB, miniYaml), { day: "2026-10-21" });
    assert.deepEqual(boardStub(STUB_DAY, miniYaml), { day: "Wed" });
    assert.deepEqual(boardStub(STUB_BACKLOG, miniYaml), { day: "" });
    assert.equal(classify(STUB, miniYaml), "board-stub");
  });
  it("what Templater's row made of it is the same stub (its column is kept)", () => {
    assert.deepEqual(boardStub(MIXED_STUB, miniYaml), { day: "2026-10-21" });
    assert.equal(classify(MIXED_STUB, miniYaml), "board-stub");
  });
  it("a note with text, a value of the user's, or other properties is not a stub; a plain raw header is not either", () => {
    assert.equal(boardStub(STUB + "\nBuy vials\n", miniYaml), null);
    assert.equal(boardStub("---\nscheduled: 2026-10-21\nproject: \"[[A]]\"\n---\n", miniYaml), null);
    assert.equal(boardStub("---\nkind: todo\ndone: false\n---\n", miniYaml), null);
    assert.equal(boardStub(TPL, miniYaml), null);
    assert.equal(classify(TPL, miniYaml), "raw-header");
    assert.equal(classify("---\nkind: todo\nmake: note\nfields:\n  - key: a\n    label: A\n---\n---\nkind: todo\n---\n", miniYaml), "mixed");
  });
});

describe("shouldFill: a board stub", () => {
  const base = { text: STUB, path: P, active: true, rows: ROWS, templaterFolders: [] as string[], rowTemplateText: TPL, parseYaml: miniYaml };
  it("filled from the row's template with the column; with no Templater row", () => {
    assert.deepEqual(shouldFill(base), { action: "fill", source: "row-template", day: "2026-10-21" });
    assert.deepEqual(shouldFill({ ...base, text: STUB_BACKLOG }), { action: "fill", source: "row-template", day: "" });
  });
  it("with a Templater row the plain stub waits for Templater's pass; the note it makes of it is then filled", () => {
    assert.deepEqual(shouldFill({ ...base, templaterFolders: ["00 Planning/To-dos"] }), { action: "skip", reason: "templater-row" });
    assert.deepEqual(shouldFill({ ...base, templaterFolders: ["00 Planning/To-dos"], text: MIXED_STUB }), { action: "fill", source: "row-template", day: "2026-10-21" });
  });
  it("an old blank note is left (not fresh), a note that is not open is left, a Templater template in the row is left", () => {
    assert.deepEqual(shouldFill({ ...base, fresh: false }), { action: "skip", reason: "other" });
    assert.deepEqual(shouldFill({ ...base, active: false }), { action: "skip", reason: "not-open" });
    assert.equal((shouldFill({ ...base, rowTemplateText: "<% tp.date.now() %>" }) as { reason: string }).reason, "not-token-template");
  });
});

describe("the runner on a board stub", () => {
  class Board extends FakeVault {
    ctx: unknown[] = []; finished: string[] = []; cancelled: string[] = []; young = true;
    constructor() {
      super();
      this.host.ask = async (_h, _n, c) => { this.asked++; this.ctx.push(c); return this.answer; };
      this.host.finish = async c => { this.finished.push(c.path); };
      this.host.cancelled = async (c, t) => { this.cancelled.push(c.path + "|" + t); };
      this.host.fresh = () => this.young;
      this.filler = new NoteFiller(this.host);
    }
  }
  it("New on the board: the stub is asked once with its column, filled once, then finished (renamed by the caller)", async () => {
    const v = new Board(); v.files.set(P, STUB);
    assert.equal((await v.open(P)).action, "fill");
    assert.deepEqual(v.ctx, [{ file: "To-do.md", path: P, day: "2026-10-21", stub: true }]);
    assert.equal(v.files.get(P), FILLED);
    assert.deepEqual(v.finished, [P]);
    await v.open(P); await v.modify(P, FILLED);
    assert.equal(v.asked, 1);
  });
  it("Esc: nothing is written and the caller is told it was a stub; not asked again", async () => {
    const v = new Board(); v.files.set(P, STUB_DAY); v.answer = null;
    await v.open(P);
    assert.deepEqual(v.cancelled, [P + "|" + STUB_DAY]);
    assert.equal(v.files.get(P), STUB_DAY);
    await v.open(P);
    assert.equal(v.asked, 1);
  });
  it("Esc on an ordinary new note is reported with its (empty) text; the handler decides (the To-do's leaves it, the lab note's trashes a blank one)", async () => {
    const v = new Board(); v.files.set(P, ""); v.answer = null;
    await v.open(P);
    assert.deepEqual(v.cancelled, [P + "|"]);
    assert.equal(v.files.get(P), "");
  });
  it("with Templater's row: the plain stub is left, the mixed note Templater makes of it is filled once with the column", async () => {
    const v = new Board(); v.templaterFolders = ["00 Planning/To-dos"]; v.files.set(P, STUB);
    assert.equal((await v.open(P)).action, "skip");
    assert.equal(v.asked, 0);
    await v.modify(P, MIXED_STUB);
    assert.deepEqual(v.ctx, [{ file: "To-do.md", path: P, day: "2026-10-21", stub: true }]);
    assert.equal(v.files.get(P), FILLED);
    assert.equal(v.writes.length, 1);
  });
  it("a stub left from earlier is not asked about when opened", async () => {
    const v = new Board(); v.young = false; v.files.set(P, STUB);
    assert.equal((await v.open(P)).action, "skip");
    assert.equal(v.asked, 0);
  });
});
