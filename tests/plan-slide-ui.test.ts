import { afterEach, describe, expect, it, vi } from "vitest";
import { copyPng, layoutOf, pictureNote, readableNote } from "../src/planning/plan-slide-ui";
import { layoutPlan } from "../src/planning/plan-map";
import { readPlan } from "../src/planning/plan";
import { pictureFor } from "../src/planning/plan-slide";
import type { NoteRec } from "../src/planning/lists";
import { BIG_HUB, BIG_TODAY, BIG_TODOS } from "./fixtures/plan-big";

const T = "00 Planning/To-dos/";
const note = (path: string, fm: Record<string, unknown> = {}): NoteRec =>
  ({ path, name: path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, ""), folder: path.slice(0, path.lastIndexOf("/")), fm, ctime: 0, mtime: 0 });
const hub = note("02 Projects/Alpha/Alpha.md", { kind: "project" });
const td = (name: string, fm: Record<string, unknown> = {}): NoteRec => note(T + name + ".md", { kind: "todo", project: "[[Alpha]]", ...fm });
const small = readPlan([td("A", { done: true }), td("B", { after: "[[A]]" }), td("C", { after: "[[B]]" })], hub);
const big = readPlan(BIG_TODOS, BIG_HUB);
const opts = { title: "T", today: BIG_TODAY };

describe("slide window helpers", () => {
  it("turns the choice into a layout", () => {
    expect(layoutOf({ whole: true, ahead: 5 })).toEqual({ kind: "whole" });
    expect(layoutOf({ whole: false, ahead: 3 })).toEqual({ kind: "compact", ahead: 3 });
  });
  it("warns only when the text is too small", () => {
    expect(readableNote({ minText: 24, tooSmall: false }, false)).toBe("");
    expect(readableNote({ minText: 18.9, tooSmall: true }, false)).toContain("fewer columns");
    expect(readableNote({ minText: 18.9, tooSmall: true }, true)).toContain("19 px");
  });
});

describe("the note under the preview (M1-5)", () => {
  it("the open-work picture: open to-dos of all top-level ones", () => {
    const p = pictureFor(big, layoutPlan(big), opts);
    expect(pictureNote(p, false)).toBe("Open work only: 24 of 59 to-dos (project too big for the full map)");
    expect(pictureNote(p, true)).toBe("Open work only: 24 of 59 to-dos (project too big for the full map)");
  });
  it("option A: the readable warning, as before (empty when the text is big enough)", () => {
    const p = pictureFor(small, layoutPlan(small), opts);
    expect(p.kind).toBe("full-map");
    expect(pictureNote(p, false)).toBe(readableNote(p, false));
    expect(pictureNote(p, false)).toBe("");
    expect(pictureNote({ ...p, minText: 18.9, tooSmall: true }, true)).toBe(readableNote({ minText: 18.9, tooSmall: true }, true));
  });
});

describe("copyPng: both pictures go to the clipboard as a 1920 × 1080 PNG (M1-5)", () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  it("option A and the open-work picture", async () => {
    const drawn: number[][] = [], written: Record<string, Blob>[] = [], loaded: string[] = [];
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: (_i: unknown, ...a: number[]) => { drawn.push(a); } }), toBlob: (ok: (b: Blob) => void, type: string) => ok(new Blob(["png"], { type })) };
    vi.stubGlobal("createEl", (tag: string) => tag === "canvas" ? canvas : {
      onload: null as null | (() => void), onerror: null,
      set src(u: string) { loaded.push(u); queueMicrotask(() => this.onload?.()); },
    });
    vi.stubGlobal("ClipboardItem", class { constructor(public items: Record<string, Blob>) {} });
    vi.stubGlobal("navigator", { clipboard: { write: async (items: { items: Record<string, Blob> }[]) => { written.push(items[0].items); } } });
    for (const plan of [small, big]) await copyPng(pictureFor(plan, layoutPlan(plan), opts).svg);
    expect(loaded).toHaveLength(2);
    expect(drawn).toEqual([[0, 0, 1920, 1080], [0, 0, 1920, 1080]]);
    expect(written.map(w => Object.keys(w))).toEqual([["image/png"], ["image/png"]]);
    expect(written[1]["image/png"].type).toBe("image/png");
  });
});
