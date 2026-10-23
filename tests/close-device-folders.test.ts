// Close experiment: PDF folders are per device (owner board 5, 2026-10-20): local storage, one-time copy from data.json.
import { describe, it, expect } from "vitest";
import { PDF_FOLDERS_KEY, loadDeviceFolders, saveDeviceFolders, type LocalStore } from "../src/close/device-folders";

const memory = (start: Record<string, unknown> = {}): LocalStore & { data: Record<string, unknown> } => {
  const data = { ...start };
  return { data, loadLocalStorage: k => (k in data ? data[k] : null), saveLocalStorage: (k, v) => { data[k] = v; } };
};

describe("per-device PDF folders", () => {
  it("a device with nothing stored copies the synced list once and keeps it", () => {
    const s = memory();
    expect(loadDeviceFolders(s, ["D:\\Reports"])).toEqual(["D:\\Reports"]);
    expect(s.data[PDF_FOLDERS_KEY]).toEqual(["D:\\Reports"]);
  });
  it("after that the device's own list wins over data.json, so two devices differ", () => {
    const win = memory(), mac = memory();
    loadDeviceFolders(win, ["D:\\Reports"]);
    loadDeviceFolders(mac, ["D:\\Reports"]);
    saveDeviceFolders(mac, ["/Users/me/Reports"]);
    expect(loadDeviceFolders(win, ["/Users/me/Reports"])).toEqual(["D:\\Reports"]);
    expect(loadDeviceFolders(mac, ["D:\\Reports"])).toEqual(["/Users/me/Reports"]);
  });
  it("an emptied list on this device stays empty (it is not refilled from data.json)", () => {
    const s = memory();
    loadDeviceFolders(s, ["D:\\Reports"]);
    saveDeviceFolders(s, []);
    expect(loadDeviceFolders(s, ["D:\\Reports"])).toEqual([]);
  });
  it("junk in local storage is ignored; storage that throws falls back to the synced list", () => {
    expect(loadDeviceFolders(memory({ [PDF_FOLDERS_KEY]: "x" }), ["/a"])).toEqual(["/a"]);
    const bad: LocalStore = { loadLocalStorage: () => { throw new Error("no"); }, saveLocalStorage: () => { throw new Error("no"); } };
    expect(loadDeviceFolders(bad, ["/a"])).toEqual(["/a"]);
    expect(() => saveDeviceFolders(bad, ["/b"])).not.toThrow();
  });
});
