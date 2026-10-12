import { describe, it, expect } from "vitest";
import { textRefHits } from "../src/calc/text-refs";

const NOTE = "intro\n```calc\nname: a\n| X | Y |\n|---|---|\n| 2 | =A2*B1 |\n```\n\n```calc\nname: b\n| P | Q |\n|---|---|\n| q | 5 |\n```\n";
const at = (needle: string, nth = 0): number => { let i = -1; for (let k = 0; k <= nth; k++) i = NOTE.indexOf(needle, i + 1); return i; };

describe("calc table text: the cells a formula points at", () => {
  const show = (note: string, hits: ReturnType<typeof textRefHits>, kind: "ref" | "cell") => hits.filter(h => h.kind === kind).map(h => `${note.slice(h.from, h.to)}:${h.colour}`);
  it("marks each reference in the formula and the cell it points at, one colour per reference", () => {
    const hits = textRefHits(NOTE, at("=A2*B1") + 3);
    expect(show(NOTE, hits, "ref")).toEqual(["A2:0", "B1:1"]);
    expect(show(NOTE, hits, "cell").sort()).toEqual(["2:0", "Y:1"]);
  });
  it("follows a reference into another table by its name", () => {
    const note = NOTE.replace("=A2*B1", "=b!B2+A2");
    const hits = textRefHits(note, note.indexOf("=b!B2") + 2);
    expect(show(note, hits, "ref")).toEqual(["b!B2:0", "A2:1"]);
    expect(show(note, hits, "cell").sort()).toEqual(["2:1", "5:0"]);
  });
  it("marks nothing outside a formula cell, a calc block or a table line", () => {
    expect(textRefHits(NOTE, at("| 2 |") + 2)).toEqual([]);   // a plain cell
    expect(textRefHits(NOTE, 2)).toEqual([]);                  // the intro
    expect(textRefHits(NOTE, at("name: a") + 3)).toEqual([]);  // an option line
  });
  it("copes with a half-typed formula and a quoted block", () => {
    const half = NOTE.replace("=A2*B1", "=SUM(A2:");
    expect(textRefHits(half, half.indexOf("=SUM") + 2).filter(h => h.kind === "ref").length).toBe(1);
    const quoted = "> ```calc\n> name: q\n> | X |\n> |---|\n> | 4 |\n> | =A2 |\n> ```\n";
    const hits = textRefHits(quoted, quoted.indexOf("=A2") + 1);
    expect(hits.filter(h => h.kind === "cell").map(h => quoted.slice(h.from, h.to))).toEqual(["4"]);
  });
});
