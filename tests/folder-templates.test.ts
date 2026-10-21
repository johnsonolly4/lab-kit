// Lab Kit's folder → template list (`kit.folderTemplates`, Phase 2 of docs/plans/templater-replacement-and-live-snippets.md).
import { describe, it } from "vitest";
import assert from "node:assert";
import { KIT_DEFAULTS, kitLoad } from "../src/kit/paths";
import { fillRows, folderTemplateRows, type FillScanRow } from "../src/kit/setup-check";

describe("kit.folderTemplates", () => {
  it("is null by default and the rows are today's: daily, to-dos (planning kit on), lab notes, chemicals", () => {
    const kit = kitLoad(null);
    assert.equal(kit.folderTemplates, null);
    assert.deepEqual(folderTemplateRows(kit, true), [
      { folder: "01 Daily Notes", file: "Daily note.md" }, { folder: "00 Planning/To-dos", file: "To-do.md" },
      { folder: "03 Lab Book/Notes", file: "Lab Book Template.md" }, { folder: "05 Chemicals/Chemicals", file: "Chemical database template.md" },
    ]);
    assert.deepEqual(folderTemplateRows(kit, false).map(r => r.file), ["Lab Book Template.md", "Chemical database template.md"]);
    assert.equal(KIT_DEFAULTS.folderTemplates, null);
  });
  it("a saved list wins, is tidied (slashes, spaces) and drops entries that are not folder / file text", () => {
    const kit = kitLoad({ folderTemplates: [{ folder: " /A/B/ ", file: " T.md " }, { folder: 3, file: "x" }, null] });
    assert.deepEqual(kit.folderTemplates, [{ folder: "A/B", file: "T.md" }]);
    assert.deepEqual(folderTemplateRows(kit, true), [{ folder: "A/B", file: "T.md" }]);
  });
  it("an empty saved list means no folders; anything else saved is back to the default", () => {
    assert.deepEqual(kitLoad({ folderTemplates: [] }).folderTemplates, []);
    assert.equal(kitLoad({ folderTemplates: "x" }).folderTemplates, null);
  });
});

describe("Check setup rows for the folder templates", () => {
  const row = (o: Partial<FillScanRow> = {}): FillScanRow => ({ folder: "00 Planning/To-dos", file: "To-do.md", folderExists: true, kind: "token", templaterRow: false, ...o });
  it("no rows scanned, nothing listed; everything fine is one green row", () => {
    assert.deepEqual(fillRows({ rows: [], mixed: [] }), []);
    const [r] = fillRows({ rows: [row(), row({ folder: "A", file: "Lab.md", kind: "templater", templaterRow: true })], mixed: [] });
    assert.equal(r.ok, true);
    assert.match(r.detail, /To-do\.md: filled by Lab Kit\./);
    assert.match(r.detail, /A → Lab\.md: Templater fills it/);
    assert.equal(r.fix, undefined);
  });
  it("a token template that Templater also has a row for: the Fix moves it (only the folders where Lab Kit fills)", () => {
    const [r] = fillRows({ rows: [row({ templaterRow: true }), row({ folder: "B", file: "x.md", kind: "templater", templaterRow: true })], mixed: [] });
    assert.equal(r.ok, false);
    assert.deepEqual(r.fix, { kind: "fill-move", folders: ["00 Planning/To-dos"] });
  });
  it("a missing folder or template, or a Templater template with no Templater row, is not ok and has no Fix", () => {
    for (const bad of [row({ folderExists: false }), row({ kind: "missing" }), row({ kind: "templater" })]) {
      const [r] = fillRows({ rows: [bad], mixed: [] });
      assert.equal(r.ok, false);
      assert.equal(r.fix, undefined);
    }
  });
  it("mixed notes are listed, never fixed", () => {
    const items = fillRows({ rows: [], mixed: ["A/n1.md", "A/n2.md"] });
    assert.equal(items.length, 1);
    assert.equal(items[0].id, "fill:mixed");
    assert.equal(items[0].ok, false);
    assert.match(items[0].detail, /2 notes \(A\/n1\.md, A\/n2\.md\)/);
    assert.deepEqual(items[0].fix, { kind: "open-note", path: "A/n1.md" });
  });
});
