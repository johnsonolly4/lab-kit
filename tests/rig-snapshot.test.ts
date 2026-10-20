// Rig snapshots (src/rig/snapshot.ts, snapshot-io.ts): the dated write-once SVG with the rig's data as plain text in its <metadata>.
// Plan: docs/plans/rig-block-no-mermaid.md, Phase 3. Made-up fixture rigs only; the saved v1 file is written by hand and never regenerated.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { makeFigure } from "../src/rig/figure-make";
import { SNAPSHOT_FORMAT, localDate, readSnapshotMeta, rigRecord, sameRecord, snapshotName, snapshotNames, snapshotSvg } from "../src/rig/snapshot";
import { latestSnapshot, saveSnapshot, snapshotState, takeSnapshot } from "../src/rig/snapshot-io";
import { rigVault } from "./helpers/rig-vault";

const DIR = "tests/fixtures/rigs/";
const fixtures = readdirSync(DIR).filter(f => f.endsWith(".md"));
const NOTE = "Rigs/Rig A.md";
const FIXTURE = readFileSync(DIR + "two-pumps-mixer.md", "utf8");
const meta = (text: string) => ({ rig: "Rig A", date: "2026-10-20", version: "1.2.3", record: rigRecord(text) });
const day = (m: number, d: number) => new Date(2026, m - 1, d, 12);

describe("snapshot file", () => {
  it("has the format number 1", () => { expect(SNAPSHOT_FORMAT).toBe(1); });

  for (const name of fixtures) {
    it(`${name}: the record round-trips byte-equal and the figure is untouched`, () => {
      const text = readFileSync(DIR + name, "utf8");
      const svg = makeFigure(text)!.svg;
      const file = snapshotSvg(svg, meta(text));
      const read = readSnapshotMeta(file);
      expect(read.status).toBe("ok");
      if (read.status !== "ok") return;
      expect(read.meta).toEqual({ format: 1, ...meta(text) });
      expect(read.meta.record.tables.length).toBeGreaterThan(0);
      expect(file.replace(/\n<metadata[\s\S]*<\/metadata>/, "")).toBe(svg);   // taking the metadata out gives the engine's SVG again
      expect(file.startsWith("<svg ")).toBe(true);
      expect(file.match(/<metadata/g)).toHaveLength(1);
      expect(file.length).toBeLessThan(svg.length + 2500);   // measured 2026-10-20: 1.8 to 4.9 KB a file, the tables add 0.4 to 0.9 KB
    });
  }

  it("escapes < > & in the tables and the Control line, and reads them back unescaped", () => {
    const text = "---\nControl: a & b <1>\n---\n| ID | Part | Model | Feeds |\n|---|---|---|---|\n| P1 | Pump | A&B <x> ]]> &amp; | OUT |\n| OUT | Outlet | | |";
    const file = snapshotSvg(makeFigure(text)!.svg, meta(text));
    const inside = /<metadata[^>]*>([\s\S]*)<\/metadata>/.exec(file)![1];
    expect(inside).not.toMatch(/<(?!\/?$)/);   // no raw < inside the metadata
    expect(inside).toContain("A&amp;B &lt;x&gt; ]]&gt; &amp;amp;");
    const read = readSnapshotMeta(file);
    expect(read.status === "ok" && read.meta.record).toEqual(rigRecord(text));
    expect(read.status === "ok" && read.meta.record.tables).toContain("A&B <x> ]]> &amp;");
    expect(read.status === "ok" && read.meta.record.control).toBe("a & b <1>");
  });

  it("keeps the hand layout block as text", () => {
    const text = FIXTURE + "\n```rig-layout\nformat: 1\nP1:  120, 40 \nM1: 200, 40\n```\n";
    expect(rigRecord(text).layout).toBe("format: 1\nP1:  120, 40\nM1: 200, 40");
    const read = readSnapshotMeta(snapshotSvg(makeFigure(text)!.svg, meta(text)));
    expect(read.status === "ok" && read.meta.record.layout).toBe("format: 1\nP1:  120, 40\nM1: 200, 40");
    expect(rigRecord(FIXTURE).layout).toBe("");
  });

  it("reads the saved v1 snapshot (written by hand)", () => {
    const read = readSnapshotMeta(readFileSync(DIR + "saved/snapshot-v1.svg", "utf8"));
    expect(read).toEqual({ status: "ok", meta: { format: 1, rig: "Saved rig", date: "2026-10-20", version: "0.0.0-test", record: {
      control: "made-up 1.0",
      tables: "## Pumps\n| ID | Model | Feeds |\n|---|---|---|\n| P1 | syringe pump & <made up> | OUT |\n\n## Outlets\n| ID | Part | Feeds |\n|---|---|---|\n| OUT | Outlet | |",
      layout: "format: 1\nP1: 40, 40",
    } } });
  });

  it("a newer format is reported, not read; a plain SVG has no record", () => {
    const newer = readFileSync(DIR + "saved/snapshot-v1.svg", "utf8").replace("format: 1\nrig", "format: 2\nrig");
    expect(readSnapshotMeta(newer)).toEqual({ status: "newer", format: 2 });
    expect(readSnapshotMeta(makeFigure(FIXTURE)!.svg)).toEqual({ status: "none" });
    expect(readSnapshotMeta("")).toEqual({ status: "none" });
  });

  it("is the same rig when only the prose changes, not when a table cell, Control or the layout changes", () => {
    const base = rigRecord(FIXTURE);
    expect(sameRecord(base, rigRecord(FIXTURE + "\nMore prose.\n"))).toBe(true);
    expect(sameRecord(base, rigRecord(FIXTURE.replace("5.0 mL", "10 mL")))).toBe(false);
    expect(sameRecord(base, rigRecord("---\nControl: other\n---\n" + FIXTURE))).toBe(false);
    expect(sameRecord(base, rigRecord(FIXTURE + "\n```rig-layout\nformat: 1\nP1: 0, 0\n```\n"))).toBe(false);
  });
});

describe("names", () => {
  it("<rig> <date>.svg, then 2, 3 while taken; the local date", () => {
    const taken = new Set<string>();
    const make = (): string => { const n = snapshotName("Rig A", "2026-10-20", x => taken.has(x)); taken.add(n); return n; };
    expect([make(), make(), make()]).toEqual(["Rig A 2026-10-20.svg", "Rig A 2026-10-20 2.svg", "Rig A 2026-10-20 3.svg"]);
    expect(localDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
  it("orders a rig's snapshots by date, then number, and ignores other files", () => {
    const names = ["Rig A 2026-10-20 10.svg", "Rig A 2026-10-20 2.svg", "Rig A 2026-10-20.svg", "Rig A 2026-09-30.svg", "Rig A figure.svg", "Rig AB 2026-10-21.svg", "Rig A 2026-10-21.png", "Rig.A 2026-12-01.svg"];
    expect(snapshotNames("Rig A", names)).toEqual(["Rig A 2026-09-30.svg", "Rig A 2026-10-20.svg", "Rig A 2026-10-20 2.svg", "Rig A 2026-10-20 10.svg"]);
  });
});

describe("snapshot files in the vault", () => {
  const FOLDER = "Rigs/Rig A history";
  it("makes the folder beside the rig note and a dated file; nothing is made for a rig without parts", async () => {
    const v = rigVault({ [NOTE]: FIXTURE, "Rigs/Empty.md": "No table." });
    expect(await takeSnapshot(v.app, v.file("Rigs/Empty.md"), "1.0.0", day(10, 20))).toBeNull();
    expect(v.created).toEqual([]);
    const t = await takeSnapshot(v.app, v.file(NOTE), "1.0.0", day(10, 20));
    expect(t?.created).toBe(true);
    expect(v.created).toEqual([`${FOLDER}/Rig A 2026-10-20.svg`]);
    const read = readSnapshotMeta(v.files.get(`${FOLDER}/Rig A 2026-10-20.svg`)!);
    expect(read.status === "ok" && [read.meta.rig, read.meta.date, read.meta.version]).toEqual(["Rig A", "2026-10-20", "1.0.0"]);
  });

  it("reuses the latest snapshot while the rig is unchanged (also on another day); a changed table makes a new file; the old file is never touched", async () => {
    const v = rigVault({ [NOTE]: FIXTURE });
    const first = await takeSnapshot(v.app, v.file(NOTE), "1.0.0", day(10, 20));
    const text1 = v.files.get(first!.file.path)!;
    const again = await takeSnapshot(v.app, v.file(NOTE), "1.1.0", day(10, 25));
    expect(again).toMatchObject({ created: false });
    expect(again!.file.path).toBe(first!.file.path);
    v.files.set(NOTE, FIXTURE + "\nProse added.\n");
    expect((await takeSnapshot(v.app, v.file(NOTE), "1.0.0", day(10, 26)))!.created).toBe(false);
    v.files.set(NOTE, FIXTURE.replace("5.0 mL", "10 mL"));
    const next = await takeSnapshot(v.app, v.file(NOTE), "1.0.0", day(11, 3));
    expect(next).toMatchObject({ created: true });
    expect(next!.file.path).toBe(`${FOLDER}/Rig A 2026-11-03.svg`);
    expect(v.files.get(first!.file.path)).toBe(text1);   // byte-equal
    expect(v.created).toHaveLength(2);
  });

  it("a second different version on the same day gets a number; going back to an older state makes a new file too", async () => {
    const v = rigVault({ [NOTE]: FIXTURE });
    await takeSnapshot(v.app, v.file(NOTE), "1.0.0", day(10, 20));
    v.files.set(NOTE, FIXTURE.replace("5.0 mL", "10 mL"));
    const b = await takeSnapshot(v.app, v.file(NOTE), "1.0.0", day(10, 20));
    expect(b!.file.path).toBe(`${FOLDER}/Rig A 2026-10-20 2.svg`);
    v.files.set(NOTE, FIXTURE);
    const c = await takeSnapshot(v.app, v.file(NOTE), "1.0.0", day(10, 20));
    expect(c!.file.path).toBe(`${FOLDER}/Rig A 2026-10-20 3.svg`);
    expect((await latestSnapshot(v.app, v.file(NOTE)))!.file.path).toBe(c!.file.path);
  });

  it("a file that is taken is never overwritten", async () => {
    const v = rigVault({ [NOTE]: FIXTURE, [`${FOLDER}/Rig A 2026-10-20.svg`]: "somebody's own file" });
    const t = await takeSnapshot(v.app, v.file(NOTE), "1.0.0", day(10, 20));
    expect(t!.file.path).toBe(`${FOLDER}/Rig A 2026-10-20 2.svg`);
    expect(v.files.get(`${FOLDER}/Rig A 2026-10-20.svg`)).toBe("somebody's own file");
  });

  it("says whether the rig changed since the latest snapshot", async () => {
    const v = rigVault({ [NOTE]: FIXTURE });
    expect(await snapshotState(v.app, v.file(NOTE), FIXTURE)).toBeNull();
    await takeSnapshot(v.app, v.file(NOTE), "1.0.0", day(10, 20));
    expect(await snapshotState(v.app, v.file(NOTE), FIXTURE)).toEqual({ date: "2026-10-20", changed: false, problems: [] });
    expect(await snapshotState(v.app, v.file(NOTE), FIXTURE.replace("T-piece", "Y-piece"))).toEqual({ date: "2026-10-20", changed: true, problems: [] });
  });

  it("a snapshot of a newer Lab Kit is left alone and says nothing", async () => {
    const newer = readFileSync(DIR + "saved/snapshot-v1.svg", "utf8").replace("format: 1\nrig", "format: 9\nrig").replace(/Saved rig/, "Rig A");
    const v = rigVault({ [NOTE]: FIXTURE, [`${FOLDER}/Rig A 2026-12-31.svg`]: newer });
    expect(await snapshotState(v.app, v.file(NOTE), FIXTURE)).toBeNull();
    expect((await latestSnapshot(v.app, v.file(NOTE)))!.newer).toBe(true);
  });

  describe("the history table is the source of truth for the latest snapshot", () => {
    const snap = (rig: string, date: string, tables: string): string => readFileSync(DIR + "saved/snapshot-v1.svg", "utf8").replace("rig: Saved rig", `rig: ${rig}`).replace("date: 2026-10-20", `date: ${date}`).replace(/=== tables ===\n[\s\S]*\n=== layout ===/, `=== tables ===\n${tables}\n=== layout ===`);
    const A = `${FOLDER}/Rig A 2026-10-20.svg`, B = `${FOLDER}/Rig A 2026-11-03.svg`, C = `${FOLDER}/Rig A 2026-12-01.svg`;
    const table = (...links: string[]): string => `\n## Rig history\n<!-- lab-kit rig-history format: 1 -->\n| Date | Snapshot | Change |\n|---|---|---|\n${links.map(l => `| 2026-10-20 | ${l} | x |`).join("\n")}\n`;
    const files = (): Record<string, string> => ({ [A]: snap("Rig A", "2026-10-20", "a"), [B]: snap("Rig A", "2026-11-03", "b"), [C]: snap("Rig A", "2026-12-01", "c") });
    const latest = async (note: string, extra: Record<string, string> = files()) => { const v = rigVault({ [NOTE]: note, ...extra }); return { v, l: await latestSnapshot(v.app, v.file(NOTE)) }; };

    it("picks the table's last existing row even when a newer-dated file is in the folder; that file is reported as not in the table", async () => {
      const { l } = await latest(FIXTURE + table(`[[${A}]]`, `[[${B}]]`));
      expect(l!.file.path).toBe(B);
      expect(l!.meta!.date).toBe("2026-11-03");
      expect(l!.problems).toEqual(['"Rig A 2026-12-01.svg" is in the history folder but not in the table.']);
    });
    it("the table's order wins over the dates (a hand-reordered table)", async () => {
      const { l } = await latest(FIXTURE + table(`[[${B}]]`, `[[${A}]]`, `[[${C}]]`).replace("| 2026-10-20 | [[" + C, "| 2026-12-01 | [[" + C));
      expect(l!.file.path).toBe(C);
      const r = await latest(FIXTURE + table(`[[${C}]]`, `[[${A}]]`, `[[${B}]]`));
      expect(r.l!.file.path).toBe(B);
      expect(r.l!.problems).toEqual([]);
    });
    it("a row whose file is missing is skipped for the latest and reported; nothing is written", async () => {
      const note = FIXTURE + table(`[[${A}]]`, `[[${FOLDER}/Rig A 2026-11-03 2.svg]]`);
      const { v, l } = await latest(note);
      expect(l!.file.path).toBe(A);
      expect(l!.problems).toEqual(['History lists "Rig A 2026-11-03 2.svg" but the file is missing.', '"Rig A 2026-11-03.svg" is in the history folder but not in the table.', '"Rig A 2026-12-01.svg" is in the history folder but not in the table.']);
      expect(v.files.get(NOTE)).toBe(note);
      expect(v.created).toEqual([]);
    });
    it("falls back to the newest-dated file when there is no table, no row with a link, or no row with a file; no problems then", async () => {
      for (const note of [FIXTURE, FIXTURE + "\n## Rig history\n", FIXTURE + table("typed by hand"), FIXTURE + "\n## Rig history\n| Date | Snapshot |\n|---|---|\n"]) {
        const { l } = await latest(note);
        expect(l!.file.path).toBe(C);
        expect(l!.problems).toEqual([]);
      }
      const { l } = await latest(FIXTURE + table(`[[${FOLDER}/Gone.svg]]`));
      expect(l!.file.path).toBe(C);
      expect(l!.problems).toContain('History lists "Gone.svg" but the file is missing.');
    });
    it("a table of a newer format is not read: newest-dated file, no problems", async () => {
      const { l } = await latest((FIXTURE + table(`[[${A}]]`)).replace("format: 1", "format: 2"));
      expect(l!.file.path).toBe(C);
      expect(l!.problems).toEqual([]);
    });
    it("reads links with a text, a heading or the markdown form, and Windows line ends", async () => {
      for (const link of [`[[${A}|first]]`, `[[${A}\\|first]]`, `![[${A}]]`, `[first](${A.replace(/ /g, "%20")})`]) {
        const { l } = await latest((FIXTURE + table(link)).replace(/\n/g, "\r\n"));
        expect(l!.file.path).toBe(A);
        expect(l!.problems).toEqual(['"Rig A 2026-11-03.svg" is in the history folder but not in the table.', '"Rig A 2026-12-01.svg" is in the history folder but not in the table.']);
      }
    });
    it("finds a file by its short link, the way Obsidian writes it", async () => {
      const { l } = await latest(FIXTURE + table("[[Rig A 2026-10-20.svg]]"));
      expect(l!.file.path).toBe(A);
    });
    it("reuse and the changed-since line follow the table's latest", async () => {
      const text = FIXTURE;
      const v = rigVault({ [NOTE]: text + table(`[[${A}]]`), [A]: snapshotSvg(makeFigure(text)!.svg, { rig: "Rig A", date: "2026-10-20", version: "1", record: rigRecord(text) }), [C]: snap("Rig A", "2026-12-01", "other") });
      const t = await takeSnapshot(v.app, v.file(NOTE), "1.0.0", day(12, 5));
      expect(t).toMatchObject({ created: false });
      expect(t!.file.path).toBe(A);
      expect(await snapshotState(v.app, v.file(NOTE), text)).toMatchObject({ date: "2026-10-20", changed: false, problems: ['"Rig A 2026-12-01.svg" is in the history folder but not in the table.'] });
    });
  });

  for (const name of fixtures) {
    it(`${name}: snapshot made, read back as the note's own record`, async () => {
      const text = readFileSync(DIR + name, "utf8");
      const v = rigVault({ [NOTE]: text });
      const t = await takeSnapshot(v.app, v.file(NOTE), "1.0.0", day(10, 20));
      const read = readSnapshotMeta(v.files.get(t!.file.path)!);
      expect(read.status === "ok" && read.meta.record).toEqual(rigRecord(text));
    });
  }

  it("saveSnapshot adds a history row for a new file only; the note's other text stays", async () => {
    const v = rigVault({ [NOTE]: FIXTURE });
    const a = await saveSnapshot(v.app, v.file(NOTE), "1.0.0", "First snapshot", day(10, 20));
    expect(a).toMatchObject({ created: true, rowNote: "" });
    const after = v.files.get(NOTE)!;
    expect(after.startsWith(FIXTURE)).toBe(true);
    expect(after.slice(FIXTURE.length)).toBe(`\n## Rig history\n<!-- lab-kit rig-history format: 1 -->\n| Date | Snapshot | Change |\n|---|---|---|\n| 2026-10-20 | [[${FOLDER}/Rig A 2026-10-20.svg]] | First snapshot |\n`);
    const b = await saveSnapshot(v.app, v.file(NOTE), "1.0.0", "ignored", day(10, 21));   // nothing changed: no file, no row
    expect(b).toMatchObject({ created: false });
    expect(v.files.get(NOTE)).toBe(after);
    expect(rigRecord(after)).toEqual(rigRecord(FIXTURE));   // the history table is not a parts table
  });

  it("saveSnapshot with a history table of a newer Lab Kit: the snapshot is made, no row, and it says why", async () => {
    const note = FIXTURE + "\n## Rig history\n<!-- lab-kit rig-history format: 7 -->\n| Date | Snapshot | Change |\n|---|---|---|\n";
    const v = rigVault({ [NOTE]: note });
    const r = await saveSnapshot(v.app, v.file(NOTE), "1.0.0", "x", day(10, 20));
    expect(r!.created).toBe(true);
    expect(r!.rowNote).toMatch(/newer Lab Kit/);
    expect(v.files.get(NOTE)).toBe(note);
  });
});
