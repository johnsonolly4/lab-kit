// Close experiment Phase 4: the three Check setup rows (src/close/scan.ts, checkSetup, makeClosedPdf) on a small fixture vault.
import { describe, it, expect } from "vitest";
import { scanClosed, type ClosedNote } from "../src/close/scan";
import { makeClosedPdf, MSG, PENDING, type CloseHost } from "../src/close/commands";
import { closedHash, closedFooter } from "../src/close/mark";
import { checkSetup, type SetupState } from "../src/kit/setup-check";

const BODY = "# Run\n\nDry the beads first.\n";
const yaml = (fm: Record<string, unknown>) => `---\n${Object.entries(fm).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join("\n")}\n---\n`;
const note = (name: string, fm: Record<string, unknown>, body = BODY): ClosedNote => ({ path: `03 Lab Book/Notes/${name}.md`, name, fm, read: async () => yaml(fm) + body });
/** A note closed the way Close experiment does: closed_hash is the hash of the note then. */
async function closedNote(name: string, extra: Record<string, unknown> = {}, editedBody?: string): Promise<ClosedNote> {
  const base = { "Exp. Class": "RAFT", Status: "Closed", closed_on: "2026-10-20", closed_pdf: ["x.pdf"], ...extra };
  const closed = { ...base, closed_hash: await closedHash(yaml(base) + BODY) };
  return note(name, closed, editedBody ?? BODY);
}

describe("scanClosed", () => {
  it("a clean vault (open notes, closed notes with a PDF, unchanged) gives no case", async () => {
    const scan = await scanClosed([note("ABC0001", { Status: "Started" }), note("ABC0002", {}), await closedNote("ABC0003")]);
    expect(scan).toEqual({ edited: [], unclosed: [], noPdf: [] });
  });
  it("edited after closing: the note now hashes differently from closed_hash", async () => {
    const scan = await scanClosed([await closedNote("ABC0003", {}, BODY + "One more line.\n"), await closedNote("ABC0004")]);
    expect(scan.edited.map(n => n.name)).toEqual(["ABC0003"]);
    expect(scan.unclosed).toEqual([]);
    expect(scan.noPdf).toEqual([]);
  });
  it("a Status change or a CRLF save is not an edit", async () => {
    const n = await closedNote("ABC0003");
    const crlf: ClosedNote = { ...n, fm: { ...n.fm, Status: "Processing results" }, read: async () => (yaml({ ...n.fm, Status: "Processing results" }) + BODY).replace(/\n/g, "\r\n") };
    expect((await scanClosed([crlf])).edited).toEqual([]);
  });
  it("Status Closed without closed_on is listed (any case); closed notes are not", async () => {
    const scan = await scanClosed([note("ABC0005", { Status: "Closed" }), note("ABC0006", { Status: "closed" }), await closedNote("ABC0007")]);
    expect(scan.unclosed.map(n => n.name)).toEqual(["ABC0005", "ABC0006"]);
    expect(scan.edited).toEqual([]);
  });
  it("closed_on alone (ended, not formally closed) gives no row; with Status Closed it is a 'marked Closed but not closed' row", async () => {
    const scan = await scanClosed([note("ABC0010", { Status: "Started", closed_on: "2026-09-03" }), note("ABC0011", { Status: "Closed", closed_on: "2026-09-03" })]);
    expect(scan).toEqual({ edited: [], unclosed: [{ path: "03 Lab Book/Notes/ABC0011.md", name: "ABC0011" }], noPdf: [] });
  });
  it("closed_pdf: pending is listed; a note with file names is not", async () => {
    const scan = await scanClosed([await closedNote("ABC0008", { closed_pdf: PENDING }), await closedNote("ABC0009")]);
    expect(scan.noPdf.map(n => n.name)).toEqual(["ABC0008"]);
    expect(scan.edited).toEqual([]);
  });
});

const baseState = (closed?: SetupState["closed"]): SetupState => ({
  lab: { initials: "ABC", dataRoot: true, methodsFolder: "", rigsFolder: "", labFolder: "03 Lab Book/Notes", chemicalFolder: "x" },
  metaBind: null, zotlitGuide: null, plugins: new Set(), planning: false,
  templater: { templatesFolder: "", userScriptsFolder: "", folderTemplates: [] },
  menu: null, installed: { lab: false, planning: false }, css: [], folders: [], folderTemplates: [], closed,
});
const rows = (c?: SetupState["closed"]) => checkSetup(baseState(c)).filter(i => i.id.startsWith("closed:"));
const ref = (name: string) => ({ path: `03 Lab Book/Notes/${name}.md`, name });

describe("Check setup rows", () => {
  it("no rows on a clean vault or before the scan", () => {
    expect(rows(undefined)).toEqual([]);
    expect(rows({ edited: [], unclosed: [], noPdf: [], canPdf: true })).toEqual([]);
  });
  it("edited: its row only, no button, the plan's detail", () => {
    const r = rows({ edited: [ref("ABC0003")], unclosed: [], noPdf: [], canPdf: true });
    expect(r.map(i => i.id)).toEqual(["closed:edited"]);
    expect(r[0].label).toBe("Closed lab notes edited after closing");
    expect(r[0].detail).toContain("1 note changed since they were closed.");
    expect(r[0].fix).toBeUndefined();
  });
  it("Closed but not closed: its row with the Close fix on the paths", () => {
    const r = rows({ edited: [], unclosed: [ref("ABC0005"), ref("ABC0006")], noPdf: [], canPdf: true });
    expect(r.map(i => i.id)).toEqual(["closed:unclosed"]);
    expect(r[0].label).toBe("Lab notes marked Closed but not closed");
    expect(r[0].fix).toEqual({ kind: "close-notes", paths: ["03 Lab Book/Notes/ABC0005.md", "03 Lab Book/Notes/ABC0006.md"] });
  });
  it("no PDF: the Make PDF fix on a desktop, none on a phone", () => {
    const on = rows({ edited: [], unclosed: [], noPdf: [ref("ABC0008")], canPdf: true });
    expect(on.map(i => i.id)).toEqual(["closed:no-pdf"]);
    expect(on[0].label).toBe("Closed lab notes without a PDF");
    expect(on[0].fix).toEqual({ kind: "make-pdfs", paths: ["03 Lab Book/Notes/ABC0008.md"] });
    expect(rows({ edited: [], unclosed: [], noPdf: [ref("ABC0008")], canPdf: false })[0].fix).toBeUndefined();
  });
});

describe("makeClosedPdf", () => {
  async function pending(over: Partial<CloseHost> = {}) {
    const hash = await closedHash(yaml({ a: 1 }) + BODY);
    const state = { fm: { Status: "Closed", closed_on: "2026-10-20", closed_hash: hash, closed_pdf: PENDING } as Record<string, unknown>, saved: [] as string[], notices: [] as string[], footers: [] as string[] };
    const host: CloseHost = {
      name: "ABC0008", today: "2026-10-22", isLabNote: true, canPdf: true, folders: ["/pdf/a", "/pdf/b"],
      readText: async () => "", frontmatter: () => state.fm, editFrontmatter: async fn => { fn(state.fm); },
      makePdf: async footer => { state.footers.push(footer); return new ArrayBuffer(4); },
      fileExists: () => false, saveFile: (folder, name) => { state.saved.push(`${folder}/${name}`); },
      confirm: async () => true, notice: m => { state.notices.push(m); }, logError: () => {}, ...over,
    };
    return { host, state, hash };
  }
  it("saves the PDF named for the closing date, footer from the stored mark, closed_pdf = the file names", async () => {
    const { host, state, hash } = await pending();
    expect(await makeClosedPdf(host)).toBe(true);
    expect(state.saved).toEqual(["/pdf/a/ABC0008 (closed 2026-10-20).pdf", "/pdf/b/ABC0008 (closed 2026-10-20).pdf"]);
    expect(state.footers).toEqual([closedFooter("2026-10-20", "ABC0008", hash)]);
    expect(state.fm.closed_pdf).toEqual(["ABC0008 (closed 2026-10-20).pdf"]);
    expect(state.fm.closed_on).toBe("2026-10-20");
    expect(state.notices).toEqual([MSG.saved("ABC0008 (closed 2026-10-20).pdf")]);
  });
  it("stays pending when no folder is set, when printing is not possible, and when every folder fails", async () => {
    for (const over of [{ folders: [] }, { makePdf: async () => null }, { saveFile: () => { throw new Error("no"); } }] as Partial<CloseHost>[]) {
      const { host, state } = await pending(over);
      expect(await makeClosedPdf(host)).toBe(false);
      expect(state.fm.closed_pdf).toBe(PENDING);
    }
  });
});
