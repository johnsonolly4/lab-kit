import { describe, it, expect } from "vitest";
import { closedHash, closedFooter, hasEnded, isClosed, withoutClosedLines } from "../src/close/mark";

const note = (fm: string, body = "Dry the beads first.\n") => `---\n${fm}\n---\n${body}`;
const base = note("Exp. Class: RAFT\nStatus: Running");

describe("closedHash", () => {
  it("is 64 lowercase hex and stable", async () => {
    const h = await closedHash(base);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(await closedHash(base)).toBe(h);
  });
  it("changes when one body character changes", async () => {
    expect(await closedHash(note("Exp. Class: RAFT\nStatus: Running", "Dry the beads first!\n"))).not.toBe(await closedHash(base));
  });
  it("changes when another property changes", async () => {
    expect(await closedHash(note("Exp. Class: ATRP\nStatus: Running"))).not.toBe(await closedHash(base));
  });
  it("does not change with Status or any closed_* line", async () => {
    const h = await closedHash(base);
    expect(await closedHash(note("Exp. Class: RAFT\nStatus: Closed"))).toBe(h);
    expect(await closedHash(note("Exp. Class: RAFT\nStatus: Closed\nclosed_on: 2026-10-20\nclosed_hash: abc\nclosed_pdf:\n  - a.pdf\n  - b.pdf\nclosed_pdf_old: x.pdf"))).toBe(h);
  });
  it("does not change with CRLF line ends", async () => {
    expect(await closedHash(base.replace(/\n/g, "\r\n"))).toBe(await closedHash(base));
  });
  it("keeps a body line that looks like a property", async () => {
    expect(withoutClosedLines(note("A: 1", "Status: kept\nclosed_on: kept\n"))).toContain("Status: kept\nclosed_on: kept");
  });
});

describe("isClosed / hasEnded", () => {
  const on = "2026-10-20";
  it("truth table: closed only when closed_on AND (closed_hash OR closed_pdf, pending included)", () => {
    expect(isClosed({ closed_on: on, closed_hash: "ab" })).toBe(true);
    expect(isClosed({ closed_on: on, closed_pdf: "pending" })).toBe(true);
    expect(isClosed({ closed_on: on, closed_pdf: ["a.pdf"] })).toBe(true);
    expect(isClosed({ Closed_On: on, Closed_Hash: "ab" })).toBe(true);
    expect(isClosed({ closed_on: on })).toBe(false);
    expect(isClosed({ closed_on: on, closed_hash: "", closed_pdf: null })).toBe(false);
    expect(isClosed({ closed_on: on, closed_pdf: [] })).toBe(false);
    expect(isClosed({ closed_on: "", closed_hash: "ab" })).toBe(false);
    expect(isClosed({ closed_hash: "ab", closed_pdf: "pending" })).toBe(false);
    expect(isClosed({ Status: "Closed" })).toBe(false);
    expect(isClosed(undefined)).toBe(false);
  });
  it("hasEnded is a non-empty closed_on alone", () => {
    expect(hasEnded({ closed_on: on })).toBe(true);
    expect(hasEnded({ closed_on: "" })).toBe(false);
    expect(hasEnded({ closed_hash: "ab" })).toBe(false);
    expect(hasEnded(undefined)).toBe(false);
  });
});

describe("closedFooter", () => {
  it("prints date, note name and the first 12 hash characters", () => {
    expect(closedFooter("2026-10-20", "0011 RAFT", "0123456789abcdef0123")).toBe("Closed 2026-10-20 · 0011 RAFT · SHA-256 0123456789ab");
  });
});
