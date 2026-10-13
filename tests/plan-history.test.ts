// The plan map's Undo / Redo (src/planning/plan-history.ts, recordChange / runHistory in src/planning/after-write.ts).
import { describe, it, expect, beforeEach } from "vitest";
import { Notice } from "obsidian";
import { HISTORY_LIMIT, PlanHistory, sameValue, type HistoryStep } from "../src/planning/plan-history";
import { recordChange, recordTick, runHistory } from "../src/planning/after-write";
import { addAfter, removeAfter } from "../src/planning/plan-link";

const step = (n: number): HistoryStep => ({ path: `T/${n}.md`, key: "after", before: undefined, after: `[[${n}]]`, label: "Linked" });
const appWith = (notes: Record<string, Record<string, unknown>>) => ({
  vault: { getFileByPath: (p: string) => (p in notes ? { path: p } : null) },
  fileManager: { processFrontMatter: async (f: { path: string }, fn: (fm: Record<string, unknown>) => void) => { fn(notes[f.path]); } },
}) as never;

describe("sameValue", () => {
  it("absent, empty text and an empty list are the same; lists compare in order", () => {
    expect(sameValue(undefined, "")).toBe(true);
    expect(sameValue(null, [])).toBe(true);
    expect(sameValue("[[A]]", "[[A]]")).toBe(true);
    expect(sameValue(["[[A]]", "[[B]]"], ["[[B]]", "[[A]]"])).toBe(false);
    expect(sameValue("[[A]]", undefined)).toBe(false);
  });
});

describe("PlanHistory", () => {
  it("keeps the last 20 steps, oldest dropped first", () => {
    const h = new PlanHistory();
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) h.push(step(i));
    expect(h.size("undo")).toBe(20);
    expect(h.peek("undo")).toEqual(step(24));
    expect(h.has("undo", h.peek("undo")!)).toBe(true);
  });
  it("a new change drops the redo steps; putting a step on the other side does not", () => {
    const h = new PlanHistory();
    const a = step(1), b = step(2);
    h.push(a); h.remove("undo", a); h.put("redo", a);
    expect(h.peek("redo")).toBe(a);
    h.push(b);
    expect(h.size("redo")).toBe(0);
    expect(h.peek("undo")).toBe(b);
  });
});

describe("recordChange / runHistory", () => {
  beforeEach(() => { (Notice as unknown as { messages: string[] }).messages.length = 0; });
  const messages = (): string[] => (Notice as unknown as { messages: string[] }).messages;

  it("undo puts the old value back, redo the new one; undo of a first link removes the property", async () => {
    const notes: Record<string, Record<string, unknown>> = { "T/B.md": { kind: "todo" } };
    const app = appWith(notes), h = new PlanHistory();
    await recordChange(app, h, "T/B.md", "after", "Linked", v => addAfter(v, "[[A]]"));
    await recordChange(app, h, "T/B.md", "after", "Linked", v => addAfter(v, "[[C]]"));
    expect(notes["T/B.md"].after).toEqual(["[[A]]", "[[C]]"]);
    await runHistory(app, h, "undo");
    expect(notes["T/B.md"].after).toBe("[[A]]");
    await runHistory(app, h, "undo");
    expect("after" in notes["T/B.md"]).toBe(false);
    expect(h.size("undo")).toBe(0);
    await runHistory(app, h, "redo");
    expect(notes["T/B.md"].after).toBe("[[A]]");
    await runHistory(app, h, "redo");
    expect(notes["T/B.md"].after).toEqual(["[[A]]", "[[C]]"]);
    expect(h.size("redo")).toBe(0);
  });
  it("a subtask change and an unlink go through the same stack", async () => {
    const notes: Record<string, Record<string, unknown>> = { "T/B.md": { after: ["[[A]]", "[[C]]"], sub: "[[P]]" } };
    const app = appWith(notes), h = new PlanHistory();
    await recordChange(app, h, "T/B.md", "sub", "Subtask cleared", () => undefined);
    await recordChange(app, h, "T/B.md", "after", "Link removed", v => removeAfter(v, ["T/A", "A"]));
    expect(notes["T/B.md"]).toEqual({ after: "[[C]]" });
    await runHistory(app, h, "undo");
    expect(notes["T/B.md"].after).toEqual(["[[A]]", "[[C]]"]);
    await runHistory(app, h, "undo");
    expect(notes["T/B.md"].sub).toBe("[[P]]");
  });
  it("a value changed by hand since is not overwritten; the step is dropped and a notice says so", async () => {
    const notes: Record<string, Record<string, unknown>> = { "T/B.md": {} };
    const app = appWith(notes), h = new PlanHistory();
    await recordChange(app, h, "T/B.md", "after", "Linked", v => addAfter(v, "[[A]]"));
    notes["T/B.md"].after = "[[Typed by hand]]";
    await runHistory(app, h, "undo");
    expect(notes["T/B.md"].after).toBe("[[Typed by hand]]");
    expect(h.size("undo")).toBe(0);
    expect(h.size("redo")).toBe(0);
    expect(messages()).toEqual(["That to-do was changed since, so it was left as it is."]);
  });
  it("a to-do that is gone is dropped with a notice; a notice's Undo runs its own step, and only while it is still in the stack", async () => {
    const notes: Record<string, Record<string, unknown>> = { "T/B.md": {}, "T/C.md": {} };
    const app = appWith(notes), h = new PlanHistory();
    const first = await recordChange(app, h, "T/B.md", "after", "Linked", v => addAfter(v, "[[A]]"));
    await recordChange(app, h, "T/C.md", "after", "Linked", v => addAfter(v, "[[A]]"));
    await runHistory(app, h, "undo", first);   // the older step, from its own notice
    expect("after" in notes["T/B.md"]).toBe(false);
    expect(notes["T/C.md"].after).toBe("[[A]]");
    await runHistory(app, h, "undo", first);   // already undone: nothing happens
    expect(h.size("redo")).toBe(1);
    delete notes["T/C.md"];
    const gone = h.peek("undo")!;
    const app2 = appWith(notes);
    await runHistory(app2, h, "undo", gone);
    expect(messages()).toEqual(["That to-do is not there any more."]);
    expect(h.size("undo")).toBe(0);
  });
});

describe("ticks in the history", () => {
  beforeEach(() => { (Notice as unknown as { messages: string[] }).messages.length = 0; });
  it("a tick and an untick (from the Done column back to Backlog) undo and redo exactly", async () => {
    const notes: Record<string, Record<string, unknown>> = { "T/A.md": { kind: "todo", day: "Mon", done: false }, "T/B.md": { kind: "todo", day: "Done", done: true } };
    const app = appWith(notes), h = new PlanHistory();
    await recordTick(app, h, "T/A.md", true, "Ticked A");
    await recordTick(app, h, "T/B.md", false, "Unticked B");
    expect(notes["T/B.md"]).toEqual({ kind: "todo", day: "Backlog", done: false });
    expect(h.peek("undo")?.label).toBe("Unticked B");
    await runHistory(app, h, "undo");
    expect(notes["T/B.md"]).toEqual({ kind: "todo", day: "Done", done: true });
    await runHistory(app, h, "undo");
    expect(notes["T/A.md"]).toEqual({ kind: "todo", day: "Mon", done: false });
    await runHistory(app, h, "redo");
    expect(notes["T/A.md"].done).toBe(true);
    await runHistory(app, h, "redo");
    expect(notes["T/B.md"]).toEqual({ kind: "todo", day: "Backlog", done: false });
  });
  it("steps of one group (Tick all) undo and redo together, from the bar or from a notice's own step", async () => {
    const notes: Record<string, Record<string, unknown>> = { "T/P.md": { done: false }, "T/S1.md": { done: false }, "T/S2.md": { done: false } };
    const app = appWith(notes), h = new PlanHistory();
    await recordTick(app, h, "T/P.md", true, "Ticked 3 to-dos", 7);
    const s1 = await recordTick(app, h, "T/S1.md", true, "Ticked 3 to-dos", 7);
    await recordTick(app, h, "T/S2.md", true, "Ticked 3 to-dos", 7);
    await runHistory(app, h, "undo");   // the bar
    expect([notes["T/P.md"].done, notes["T/S1.md"].done, notes["T/S2.md"].done]).toEqual([false, false, false]);
    expect(h.size("undo")).toBe(0);
    expect(h.size("redo")).toBe(3);
    await runHistory(app, h, "redo");
    expect([notes["T/P.md"].done, notes["T/S1.md"].done, notes["T/S2.md"].done]).toEqual([true, true, true]);
    await runHistory(app, h, "undo", s1);   // a notice's Undo holds one step of the group: the whole group goes
    expect([notes["T/P.md"].done, notes["T/S2.md"].done]).toEqual([false, false]);
  });
  it("a tick changed since (unticked in the note) is left alone", async () => {
    const notes: Record<string, Record<string, unknown>> = { "T/A.md": { done: false } };
    const app = appWith(notes), h = new PlanHistory();
    await recordTick(app, h, "T/A.md", true, "Ticked A");
    notes["T/A.md"].done = false;
    await runHistory(app, h, "undo");
    expect(notes["T/A.md"].done).toBe(false);
    expect((Notice as unknown as { messages: string[] }).messages).toEqual(["That to-do was changed since, so it was left as it is."]);
  });
});
