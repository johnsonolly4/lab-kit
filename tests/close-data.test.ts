// Close experiment, the data check (src/close/data.ts) and its place in Close: folder found / empty / missing / no root / phone,
// missing linked files, the file-list hash, the PDF rows and `closed_data`. All paths are made up.
import { describe, it, expect } from "vitest";
import { checkData, closedDataValue, dataFoundLine, dataPdfRows, dataProperty, dataWarnings, fileListHash, type DataCheck, type DataInput } from "../src/close/data";
import { closedHash, withoutClosedLines } from "../src/close/mark";
import { closeExperiment, reopenExperiment, type CloseHost } from "../src/close/commands";
import { pdfHtml } from "../src/close/pdf";

const join = (...p: string[]) => p.join("/");
const FOLDER = "/lab/data/ABC0011-A";
const input = (over: Partial<DataInput> = {}): DataInput => ({
  noteName: "ABC0011-A", fm: {}, root: "/lab/data", join, canRead: true, missingLinks: [],
  list: f => (f === FOLDER ? { exists: true, files: [["raw/b.csv", 20], ["a.txt", 10]] } : { exists: false, files: [] }),
  ...over,
});

describe("checkData", () => {
  it("folder with files: found, count, hash of the sorted list", async () => {
    const d = await checkData(input());
    expect(d).toMatchObject({ state: "found", folder: FOLDER, files: 2, property: "", missingLinks: [] });
    expect(d.hash).toBe(await fileListHash([["a.txt", 10], ["raw/b.csv", 20]]));
    expect(d.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(dataFoundLine(d)).toBe("Data folder found: 2 files.");
    expect(dataWarnings(d)).toEqual([]);
  });
  it("the hash does not depend on the listing order and changes with a size or a name", async () => {
    const a = await fileListHash([["a", 1], ["b", 2]]);
    expect(await fileListHash([["b", 2], ["a", 1]])).toBe(a);
    expect(await fileListHash([["a", 1], ["b", 3]])).not.toBe(a);
    expect(await fileListHash([["a", 1], ["c", 2]])).not.toBe(a);
  });
  it("one file reads 'file'; .DS_Store is not counted", async () => {
    const d = await checkData(input({ list: () => ({ exists: true, files: [[".DS_Store", 5], ["x.csv", 1]] }) }));
    expect(d.files).toBe(1);
    expect(dataFoundLine(d)).toBe("Data folder found: 1 file.");
  });
  it("empty folder warns", async () => {
    const d = await checkData(input({ list: () => ({ exists: true, files: [[".DS_Store", 5]] }) }));
    expect(d.state).toBe("empty");
    expect(dataWarnings(d)).toEqual([`Data folder is empty: ${FOLDER}`]);
    expect(dataFoundLine(d)).toBe("");
  });
  it("missing folder warns", async () => {
    const d = await checkData(input({ list: () => ({ exists: false, files: [] }) }));
    expect(d.state).toBe("missing");
    expect(d.hash).toBe("");
    expect(dataWarnings(d)).toEqual([`Data folder not found: ${FOLDER}`]);
  });
  it("no root on this device warns", async () => {
    const d = await checkData(input({ root: "  " }));
    expect(d.state).toBe("no-root");
    expect(dataWarnings(d)).toEqual(["No data folder root is set on this device."]);
  });
  it("a phone (no node) cannot check and does not warn about the folder", async () => {
    const d = await checkData(input({ canRead: false, list: () => null }));
    expect(d.state).toBe("no-node");
    expect(dataWarnings(d)).toEqual([]);
  });
  it("missing linked files warn, on a phone too; more than five are counted", async () => {
    const d = await checkData(input({ canRead: false, list: () => null, missingLinks: ["a.csv", "b.csv"] }));
    expect(dataWarnings(d)).toEqual(["Missing in the vault: a.csv, b.csv"]);
    const many = await checkData(input({ missingLinks: ["1", "2", "3", "4", "5", "6", "7"] }));
    expect(dataWarnings(many)).toEqual(["Missing in the vault: 1, 2, 3, 4, 5 and 2 more"]);
  });
  it("finds the note's own data-folder property", async () => {
    expect(dataProperty({ "Data folder": "/other/ABC0011-A" })).toBe("/other/ABC0011-A");
    expect(dataProperty({ data_path: "/x" })).toBe("/x");
    expect(dataProperty({ "Exp. Class": "RAFT" })).toBe("");
    expect((await checkData(input({ fm: { data_folder: "/other/x" } }))).property).toBe("/other/x");
  });
});

describe("PDF rows", () => {
  it("print the folder, the property, the count and the hash; the PDF text contains them", async () => {
    const d = await checkData(input({ fm: { "Data folder": "/other/ABC0011-A" } }));
    const rows = dataPdfRows(d);
    expect(rows).toEqual([["Data folder (this device)", FOLDER], ["Data folder (note property)", "/other/ABC0011-A"], ["Data files", "2"], ["Data file list SHA-256", d.hash]]);
    const html = pdfHtml("ABC0011-A", [["Exp. Class", "RAFT"], ...rows], "<p>x</p>", false);
    expect(html).toContain(`<th>Data folder (this device)</th><td>${FOLDER}</td>`);
    expect(html).toContain(`<th>Data file list SHA-256</th><td>${d.hash}</td>`);
  });
  it("say so when nothing could be checked, and add the date for a later PDF", async () => {
    const phone = await checkData(input({ canRead: false, list: () => null, root: "" }));
    expect(dataPdfRows(phone)[0]).toEqual(["Data folder (this device)", "cannot check on this device"]);
    const none = await checkData(input({ root: "" }));
    expect(dataPdfRows(none)[0][1]).toBe("no data folder root set on this device");
    const miss = await checkData(input({ list: () => ({ exists: false, files: [] }) }));
    expect(dataPdfRows(miss, "2026-10-21").at(-1)).toEqual(["Data checked", "2026-10-21"]);
    expect(dataPdfRows(miss)).toContainEqual(["Data files", "folder not found"]);
  });
});

describe("closed_data and the hash", () => {
  it("is the resolved path unless the note has its own property or no folder was resolved", async () => {
    expect(closedDataValue(await checkData(input()))).toBe(FOLDER);
    expect(closedDataValue(await checkData(input({ fm: { "Data folder": "/other/x" } })))).toBe("");
    expect(closedDataValue(await checkData(input({ root: "" })))).toBe("");
  });
  it("a closed_data line does not change the note hash", async () => {
    const note = "---\nStatus: Started\n---\n# Run\n";
    const closed = "---\nStatus: Closed\nclosed_data: /lab/data/ABC0011-A\nclosed_on: 2026-10-21\n---\n# Run\n";
    expect(withoutClosedLines(closed)).toBe(withoutClosedLines(note));
    expect(await closedHash(closed)).toBe(await closedHash(note));
  });
});

const found: DataCheck = { state: "found", folder: FOLDER, property: "", files: 3, hash: "a".repeat(64), missingLinks: [] };
function host(data: DataCheck, over: Partial<CloseHost> = {}) {
  const st = { fm: { Status: "Started" } as Record<string, unknown>, extra: [] as [string, string][][], data: [] as (DataCheck | undefined)[] };
  const h: CloseHost = {
    name: "ABC0011-A", today: "2026-10-21", isLabNote: true, canPdf: true, folders: ["/pdf/a"],
    readText: async () => "# Run\n", frontmatter: () => st.fm, editFrontmatter: async fn => { fn(st.fm); },
    checkData: async () => data, makePdf: async (_f, extra) => { st.extra.push(extra); return new ArrayBuffer(2); },
    fileExists: () => false, saveFile: () => {}, confirm: async (_k, _d, _f, d) => { st.data.push(d); return true; },
    notice: () => {}, logError: () => {}, ...over,
  };
  return { h, st };
}

describe("closeExperiment with the data check", () => {
  it("shows the check in the window, puts the rows in the PDF and writes closed_data", async () => {
    const { h, st } = host(found);
    await closeExperiment(h);
    expect(st.data).toEqual([found]);
    expect(st.extra[0]).toContainEqual(["Data folder (this device)", FOLDER]);
    expect(st.extra[0]).toContainEqual(["Data file list SHA-256", "a".repeat(64)]);
    expect(st.fm.closed_data).toBe(FOLDER);
  });
  it("does not write closed_data when the note has its own data-folder property", async () => {
    const { h, st } = host({ ...found, property: "/other/x" });
    await closeExperiment(h);
    expect(st.fm.closed_data).toBeUndefined();
    expect(st.extra[0]).toContainEqual(["Data folder (note property)", "/other/x"]);
  });
  it("a warning does not stop Close: the window decides (the tick lives there)", async () => {
    const { h, st } = host({ ...found, state: "missing", files: 0, hash: "" });
    await closeExperiment(h);
    expect(st.fm.Status).toBe("Closed");
  });
  it("Reopen removes closed_data", async () => {
    const { h, st } = host(found);
    await closeExperiment(h);
    await reopenExperiment(h);
    expect(st.fm.closed_data).toBeUndefined();
  });
  it("cancelling in the window writes nothing", async () => {
    const { h, st } = host(found, { confirm: async () => false });
    await closeExperiment(h);
    expect(st.fm.closed_data).toBeUndefined();
    expect(st.extra).toEqual([]);
  });
});
