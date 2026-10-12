// Phase 5a: data.json changed on disk by any sync tool while Obsidian is open (onExternalSettingsChange → KitController.load).
import { describe, it, expect, vi } from "vitest";
vi.mock("lab-kit-embedded", () => ({ default: { kits: [{ manifest: { id: "lab", kitVersion: "0", files: [], removed: [] }, contents: {} }] } }));
vi.mock("../docs/changelog.md", () => ({ default: "" }));
import { KitController } from "../src/kit/ui";

describe("settings changed by a sync tool", () => {
  it("reloading before the next save keeps the synced values (no stale write-back)", async () => {
    let disk: Record<string, unknown> = { kit: { initials: "ABC", planningFolders: { projects: "02 Projects" } } };
    const plugin = { app: {}, loadData: async () => structuredClone(disk), saveData: async (d: Record<string, unknown>) => { disk = structuredClone(d); } };
    const ctl = new KitController(plugin as never, {} as never);
    await ctl.load();
    // another device renames the projects folder; its data.json arrives
    disk = { kit: { initials: "ABC", planningFolders: { projects: "20 Work" } } };
    await ctl.load();                         // what onExternalSettingsChange does
    ctl.kit.initials = "XYZ";
    await ctl.save();
    const kit = disk.kit as { initials: string; planningFolders: { projects: string } };
    expect(kit.planningFolders.projects).toBe("20 Work");
    expect(kit.initials).toBe("XYZ");
  });
});
