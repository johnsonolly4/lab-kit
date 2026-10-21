// Lab Kit's folder → template list (`kit.folderTemplates`, Phase 2 of docs/plans/templater-replacement-and-live-snippets.md).
import { describe, it } from "vitest";
import assert from "node:assert";
import { KIT_DEFAULTS, kitLoad } from "../src/kit/paths";
import { folderTemplateRows } from "../src/kit/setup-check";

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
