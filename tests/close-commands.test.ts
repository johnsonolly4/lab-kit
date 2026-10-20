// Close experiment Phase 3 (src/close/commands.ts): refusals, the order of the steps, file names, and a Close / Reopen round trip.
import { describe, it, expect } from "vitest";
import { closeExperiment, reopenExperiment, pdfFileName, MSG, PENDING, type CloseHost } from "../src/close/commands";
import { closedFooter, closedHash } from "../src/close/mark";
import type { DataCheck } from "../src/close/data";

const BODY = "# Run\n\nDry the beads first.\n\n| a | b |\n|---|---|\n| 1 | 2 |\n";

/** A fake note: front matter as an object, body as text; `text()` joins them the way a file would read. */
function fake(over: Partial<CloseHost> = {}, fm: Record<string, unknown> = { "Exp. Class": "RAFT", Status: "Started" }) {
  const state = { fm: { ...fm } as Record<string, unknown>, body: BODY, saved: [] as [string, string, number][], notices: [] as string[], asked: [] as string[], footers: [] as string[], dates: [] as string[], onDisk: new Set<string>(), extra: [] as [string, string][][], data: { state: "found", folder: "/lab/data/ABC0011-A", property: "", files: 3, hash: "h".repeat(64), missingLinks: [] } as DataCheck, dataSeen: [] as (DataCheck | undefined)[] };
  const yaml = () => `---\n${Object.entries(state.fm).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join("\n")}\n---\n`;
  const host: CloseHost = {
    name: "ABC0011 - RAFT test", today: "2026-10-20", isLabNote: true, canPdf: true, folders: ["/pdf/a", "/pdf/b"],
    readText: async () => yaml() + state.body,
    frontmatter: () => state.fm,
    editFrontmatter: async fn => { fn(state.fm); },
    checkData: async () => state.data,
    makePdf: async (footer, extra) => { state.footers.push(footer); state.extra.push(extra); return new ArrayBuffer(8); },
    fileExists: (folder, name) => state.onDisk.has(`${folder}/${name}`),
    saveFile: (folder, name, bytes) => { state.saved.push([folder, name, bytes.byteLength]); state.onDisk.add(`${folder}/${name}`); },
    confirm: async (kind, date, folders, data) => { state.dataSeen.push(data); state.asked.push(`${kind}:${folders.join("|")}`); state.dates.push(date); return true; },
    notice: m => { state.notices.push(m); },
    logError: () => {},
    ...over,
  };
  return { host, state, yaml };
}

describe("pdfFileName", () => {
  it("is <note name> (closed date).pdf; a second close the same day adds , 2, then , 3", () => {
    const taken = new Set<string>();
    const next = () => { const n = pdfFileName("ABC0011 - RAFT", "2026-10-20", x => taken.has(x)); taken.add(n); return n; };
    expect(next()).toBe("ABC0011 - RAFT (closed 2026-10-20).pdf");
    expect(next()).toBe("ABC0011 - RAFT (closed 2026-10-20, 2).pdf");
    expect(next()).toBe("ABC0011 - RAFT (closed 2026-10-20, 3).pdf");
  });
  it("replaces characters a file name cannot hold", () => {
    expect(pdfFileName("A/B: C?", "2026-10-20", () => false)).toBe("A-B- C- (closed 2026-10-20).pdf");
  });
});

describe("closeExperiment: refusals (nothing is written, nobody is asked)", () => {
  it("not a lab note", async () => {
    const { host, state } = fake({ isLabNote: false });
    await closeExperiment(host);
    expect(state.notices).toEqual([MSG.notLab]);
    expect(state.asked).toEqual([]);
    expect(state.fm.closed_on).toBeUndefined();
  });
  it("already closed", async () => {
    const { host, state } = fake({}, { closed_on: "2026-10-01", closed_hash: "abc", closed_pdf: "pending", Status: "Closed" });
    await closeExperiment(host);
    expect(state.notices).toEqual([MSG.alreadyClosed("2026-10-01")]);
    expect(state.saved).toEqual([]);
    expect(state.asked).toEqual([]);
  });
  it("a note with only closed_on (ended, not formally closed) is NOT refused: the PDF is dated today, closed_on keeps the end date", async () => {
    const { host, state, yaml } = fake({}, { "Exp. Class": "RAFT", Status: "Started", closed_on: "2026-09-03" });
    const before = await closedHash(yaml() + BODY);
    await closeExperiment(host);
    expect(state.asked).toEqual(["close:/pdf/a|/pdf/b"]);
    expect(state.dates).toEqual(["2026-10-20"]);
    expect(state.fm.closed_on).toBe("2026-09-03");
    expect(state.fm.closed_hash).toBe(before);
    expect(state.fm.closed_pdf).toEqual(["ABC0011 - RAFT test (closed 2026-10-20).pdf"]);
    expect(state.fm.Status).toBe("Closed");
    expect(state.footers).toEqual([closedFooter("2026-10-20", "ABC0011 - RAFT test", before)]);
    // the stored hash still recomputes equal, so Check setup does not call the note edited
    expect(await closedHash(yaml() + BODY)).toBe(state.fm.closed_hash);
  });
  it("a note with no closed_on: closed_on, PDF name, footer and window all use today", async () => {
    const { host, state } = fake();
    await closeExperiment(host);
    expect(state.fm.closed_on).toBe("2026-10-20");
    expect(state.dates).toEqual(["2026-10-20"]);
  });
  it("no PDF folder on a computer", async () => {
    const { host, state } = fake({ folders: [] });
    await closeExperiment(host);
    expect(state.notices).toEqual([MSG.noFolder]);
    expect(state.asked).toEqual([]);
    expect(state.fm.closed_on).toBeUndefined();
  });
  it("Cancel in the window changes nothing", async () => {
    const { host, state } = fake({ confirm: async () => false });
    await closeExperiment(host);
    expect(state.saved).toEqual([]);
    expect(state.fm.closed_on).toBeUndefined();
    expect(state.notices).toEqual([]);
  });
});

describe("closeExperiment", () => {
  it("saves the PDF in every folder, then sets closed_on, closed_hash, closed_pdf and Status", async () => {
    const { host, state, yaml } = fake();
    const before = await closedHash(yaml() + BODY);
    await closeExperiment(host);
    expect(state.asked).toEqual(["close:/pdf/a|/pdf/b"]);
    expect(state.saved.map(s => `${s[0]}/${s[1]}`)).toEqual(["/pdf/a/ABC0011 - RAFT test (closed 2026-10-20).pdf", "/pdf/b/ABC0011 - RAFT test (closed 2026-10-20).pdf"]);
    expect(state.fm.closed_on).toBe("2026-10-20");
    expect(state.fm.closed_hash).toBe(before);
    expect(state.fm.closed_pdf).toEqual(["ABC0011 - RAFT test (closed 2026-10-20).pdf"]);
    expect(state.fm.Status).toBe("Closed");
    expect(state.footers).toEqual([closedFooter("2026-10-20", "ABC0011 - RAFT test", before)]);
    expect(state.notices).toEqual([MSG.saved("ABC0011 - RAFT test (closed 2026-10-20).pdf")]);
  });
  it("the mark does not change the hash (a later edit is the only thing that does)", async () => {
    const { host, state, yaml } = fake();
    await closeExperiment(host);
    expect(await closedHash(yaml() + state.body)).toBe(state.fm.closed_hash);
    state.body += "One more line.\n";
    expect(await closedHash(yaml() + state.body)).not.toBe(state.fm.closed_hash);
  });
  it("a folder that cannot be written is named; the other still gets the PDF", async () => {
    const { host, state } = fake({ saveFile: (f, n) => { if (f === "/pdf/a") throw new Error("denied"); state.onDisk.add(`${f}/${n}`); } });
    await closeExperiment(host);
    expect(state.notices[0]).toBe(MSG.failed("/pdf/a"));
    expect(state.fm.closed_pdf).toEqual(["ABC0011 - RAFT test (closed 2026-10-20).pdf"]);
  });
  it("every folder failing leaves closed_pdf pending", async () => {
    const { host, state } = fake({ saveFile: () => { throw new Error("denied"); } });
    await closeExperiment(host);
    expect(state.fm.closed_pdf).toBe(PENDING);
    expect(state.fm.closed_on).toBe("2026-10-20");
  });
  it("a desktop that cannot print says so, and still sets the mark with closed_pdf pending", async () => {
    const { host, state } = fake({ makePdf: async () => null });
    await closeExperiment(host);
    expect(state.saved).toEqual([]);
    expect(state.fm.closed_pdf).toBe(PENDING);
    expect(state.fm.closed_on).toBe("2026-10-20");
    expect(state.notices[0]).toContain("cannot make the PDF");
  });
  it("a phone needs no folder, makes no PDF, sets the mark with closed_pdf pending", async () => {
    const { host, state } = fake({ canPdf: false, folders: [] });
    await closeExperiment(host);
    expect(state.asked).toEqual(["close:"]);
    expect(state.footers).toEqual([]);
    expect(state.fm.closed_pdf).toBe(PENDING);
    expect(state.fm.closed_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(state.notices).toEqual([MSG.noPdfHere]);
  });
  it("a second close on the same day does not overwrite the first PDF", async () => {
    const { host, state } = fake();
    state.onDisk.add("/pdf/a/ABC0011 - RAFT test (closed 2026-10-20).pdf");
    await closeExperiment(host);
    expect(state.fm.closed_pdf).toEqual(["ABC0011 - RAFT test (closed 2026-10-20, 2).pdf"]);
  });
});

describe("reopenExperiment", () => {
  it("refuses a note that is not closed, and a note that is not a lab note", async () => {
    const a = fake();
    await reopenExperiment(a.host);
    expect(a.state.asked).toEqual([]);
    const b = fake({ isLabNote: false });
    await reopenExperiment(b.host);
    expect(b.state.notices).toEqual([MSG.notLab]);
  });
  it("a bare closed_on is not a close: Reopen says so and keeps it", async () => {
    const { host, state } = fake({}, { Status: "Started", closed_on: "2026-09-03" });
    await reopenExperiment(host);
    expect(state.asked).toEqual([]);
    expect(state.notices).toEqual(["This note is not closed."]);
    expect(state.fm.closed_on).toBe("2026-09-03");
  });
  it("Close then Reopen: the body is byte for byte the same, the mark is gone, the PDF name stays as closed_pdf_old, Status is Started", async () => {
    const { host, state, yaml } = fake();
    const bodyBefore = state.body;
    const hashBefore = await closedHash(yaml() + state.body);
    await closeExperiment(host);
    await reopenExperiment(host);
    expect(state.body).toBe(bodyBefore);
    expect(state.fm.closed_on).toBeUndefined();
    expect(state.fm.closed_hash).toBeUndefined();
    expect(state.fm.closed_pdf).toBeUndefined();
    expect(state.fm.closed_pdf_old).toEqual(["ABC0011 - RAFT test (closed 2026-10-20).pdf"]);
    expect(state.fm.Status).toBe("Started");
    expect(state.fm["Exp. Class"]).toBe("RAFT");
    expect(await closedHash(yaml() + state.body)).toBe(hashBefore);
    expect(state.asked[1]).toBe("reopen:");
    expect(state.notices.at(-1)).toBe(MSG.reopened);
  });
  it("a pending note reopens without a closed_pdf_old", async () => {
    const { host, state } = fake({ canPdf: false, folders: [] });
    await closeExperiment(host);
    await reopenExperiment(host);
    expect(state.fm.closed_pdf).toBeUndefined();
    expect(state.fm.closed_pdf_old).toBeUndefined();
  });
});
