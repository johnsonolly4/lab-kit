// Tidy up notes: the folder contract the scan works from (tidyContext), built from the kit's folder settings.
import { describe, it, expect } from "vitest";
import { tidyContext, type TidyHost } from "../src/kit/tidy-ui";
import { KIT_DEFAULTS, PLANNING_FOLDER_DEFAULTS } from "../src/kit/paths";
import { scan } from "../src/kit/tidy";

const bundle = { bundle: { manifest: { migrations: [] } } };
const host = (planningOn: boolean): TidyHost => ({
  kit: { ...KIT_DEFAULTS, planningFolders: { ...PLANNING_FOLDER_DEFAULTS } },
  managed: bundle,
  planning: planningOn ? { ...bundle, slot: { enabled: true }, stateOf: () => undefined } : null,
} as unknown as TidyHost);

describe("tidyContext contract folders", () => {
  it("lists single-segment folders (no slash) as well as the top of nested ones", () => {
    const ctx = tidyContext(host(true));
    expect(ctx.contractFolders).toEqual(expect.arrayContaining(
      ["00 Inbox", "01 Daily Notes", "00 Planning", "02 Projects", "04 Literature", "06 Knowledge", "07 How-tos", "08 Meetings", "99 Archive", "Extras", "03 Lab Book", "05 Chemicals"]));
  });

  it("does not report notes in the kit's own folders as outside the layout", () => {
    const ctx = tidyContext(host(true));
    const files = ["00 Inbox/a.md", "01 Daily Notes/2026-01-01.md", "02 Projects/P/P.md", "Extras/Templates/To-do.md", "03 Lab Book/Notes/ABC0001-A.md", "Stray/x.md"]
      .map(path => ({ path, text: undefined }));
    expect(scan(files, ctx).reported.find(r => r.id === "outside-contract")?.items.map(i => i.path)).toEqual(["Stray/x.md"]);
  });

  it("is empty while the planning kit is off", () => {
    expect(tidyContext(host(false)).contractFolders).toEqual([]);
  });
});
