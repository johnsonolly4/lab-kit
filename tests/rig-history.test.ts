// The `## Rig history` table (src/rig/history.ts). Plan: docs/plans/rig-block-no-mermaid.md, Phase 4. The saved v1 note is written by hand and never regenerated.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { appendRow, historyTargets, linkTarget, readHistory, reconcile, type Appended } from "../src/rig/history";

const SAVED = readFileSync("tests/fixtures/rigs/saved/history-v1.md", "utf8");
const row = { date: "2026-12-01", snapshot: "[[Saved rig history/Saved rig 2026-12-01.svg]]", change: "Pump P1 swapped" };
const ok = (r: Appended): string => { if (!("text" in r)) throw new Error(r.refused); return r.text; };

describe("reading", () => {
  it("reads the saved v1 note by header name, keeping the extra column and the hand-typed row", () => {
    const h = readHistory(SAVED);
    expect(h.format).toBe(1);
    expect(h.header).toEqual(["Date", "Snapshot", "Change", "Who"]);
    expect(h.rows).toHaveLength(2);
    expect(h.rows[1]).toEqual({ Date: "2026-11-03", Snapshot: "[[Saved rig history/Saved rig 2026-11-03.svg]]", Change: "Coil R1 10 mL → 5 mL, typed by hand", Who: "me" });
  });
  it("no section, a heading inside a code block, no format line (= 1)", () => {
    expect(readHistory("# Rig\n").heading).toBe(-1);
    expect(readHistory("```\n## Rig history\n```\n").heading).toBe(-1);
    const h = readHistory("## Rig history\n| Date | Snapshot |\n|---|---|\n| 2026-01-01 | x |\n");
    expect(h.format).toBe(1); expect(h.rows).toHaveLength(1);
  });
});

describe("appending", () => {
  it("adds one row at the end of the table and every other byte stays", () => {
    const out = ok(appendRow(SAVED, row));
    const lines = SAVED.split("\n");
    const at = lines.findIndex(l => l.startsWith("| 2026-11-03"));
    const expected = [...lines.slice(0, at + 1), "| 2026-12-01 | [[Saved rig history/Saved rig 2026-12-01.svg]] | Pump P1 swapped |  |", ...lines.slice(at + 1)].join("\n");
    expect(out).toBe(expected);   // the Who column stays empty, the text under the table is untouched
    expect(readHistory(out).rows).toHaveLength(3);
  });
  it("a second row goes after the first one it added", () => {
    const out = ok(appendRow(ok(appendRow(SAVED, row)), { ...row, date: "2026-12-02", change: "" }));
    expect(readHistory(out).rows.map(r => r.Date)).toEqual(["2026-10-20", "2026-11-03", "2026-12-01", "2026-12-02"]);
    expect(out.endsWith("Typed later, below the table.\n")).toBe(true);
  });
  it("no section: it is added at the end with the format line", () => {
    expect(ok(appendRow("Text\n", row))).toBe("Text\n\n## Rig history\n<!-- lab-kit rig-history format: 1 -->\n| Date | Snapshot | Change |\n|---|---|---|\n| 2026-12-01 | [[Saved rig history/Saved rig 2026-12-01.svg]] | Pump P1 swapped |\n");
    expect(ok(appendRow("Text, no final newline", row)).startsWith("Text, no final newline\n\n## Rig history\n")).toBe(true);
    expect(ok(appendRow("", row)).startsWith("## Rig history\n")).toBe(true);
  });
  it("a section with no table gets the table (and the format line only when it has none)", () => {
    const out = ok(appendRow("## Rig history\nMy own words.\n", row));
    expect(out.split("\n").slice(0, 4)).toEqual(["## Rig history", "<!-- lab-kit rig-history format: 1 -->", "| Date | Snapshot | Change |", "|---|---|---|"]);
    expect(out).toContain("My own words.");
    const withFormat = ok(appendRow("## Rig history\n<!-- lab-kit rig-history format: 1 -->\n", row));
    expect(withFormat.match(/rig-history format/g)).toHaveLength(1);
  });
  it("a pipe or a new line in the change cell does not break the table; columns are found in any order and by any case", () => {
    const out = ok(appendRow("## Rig history\n| change | snapshot | date |\n|---|---|---|\n", { ...row, change: "a | b\nc" }));
    expect(out.split("\n")[3]).toBe("| a \\| b c | [[Saved rig history/Saved rig 2026-12-01.svg]] | 2026-12-01 |");
  });
  it("keeps Windows line ends", () => {
    const crlf = SAVED.replace(/\n/g, "\r\n");
    const out = ok(appendRow(crlf, row));
    expect(out.replace(/\r\n/g, "")).not.toContain("\n");
    expect(out.split("\r\n")).toHaveLength(crlf.split("\r\n").length + 1);
    expect(readHistory(out).rows).toHaveLength(3);
  });
  it("a newer format is refused, as is a table without Date and Snapshot; nothing is guessed", () => {
    expect(appendRow(SAVED.replace("format: 1", "format: 2"), row)).toEqual({ refused: expect.stringMatching(/newer Lab Kit: update the plugin/) });
    expect(appendRow("## Rig history\n| When | File |\n|---|---|\n", row)).toEqual({ refused: expect.stringMatching(/no Date and Snapshot columns/) });
  });
});

describe("table against folder (pure)", () => {
  it("link targets: wiki, alias, escaped pipe, heading, embed, markdown; none for plain text", () => {
    expect(["[[a/b.svg]]", "[[a/b.svg|x]]", "[[a/b.svg\\|x]]", "[[a/b.svg#h]]", "![[a/b.svg]]", "[x](a/b.svg)", "[x](<a/b.svg>)"].map(linkTarget)).toEqual(Array(7).fill("a/b.svg"));
    expect(linkTarget("typed by hand")).toBeNull();
  });
  it("historyTargets: the saved v1 note lists its snapshots in order; no table or a newer format gives null", () => {
    expect(historyTargets(SAVED)).toHaveLength(readHistory(SAVED).rows.length - readHistory(SAVED).rows.filter(r => !/\[\[|\]\(/.test(r.Snapshot)).length);
    expect(historyTargets("Text")).toBeNull();
    expect(historyTargets(SAVED.replace("format: 1", "format: 2"))).toBeNull();
    expect(historyTargets(SAVED.replace(/\n/g, "\r\n"))).toEqual(historyTargets(SAVED));
  });
  it("reconcile: latest is the last existing row; missing and unlisted files are problems; no rows, no problems", () => {
    const r = reconcile([{ target: "f/a.svg", path: "f/a.svg" }, { target: "f/b.svg", path: null }, { target: "f/b.svg", path: null }], ["f/a.svg", "f/c.svg"]);
    expect(r).toEqual({ latest: "f/a.svg", problems: ['History lists "b.svg" but the file is missing.', '"c.svg" is in the history folder but not in the table.'] });
    expect(reconcile([], ["f/c.svg"])).toEqual({ latest: null, problems: [] });
  });
});
