// The Undo notice after a tick (I2 Phase 6, Q19): Undo leaves the front matter byte-equal to before; a second tick replaces the first notice.
import { describe, it, expect } from "vitest";
import { Notice } from "obsidian";
import { frontOf, swapFront, tickButton, tickNotice, toggleDoneWithUndo, undoPlan } from "../src/planning/undo-notice";
import { applyPatch, tickPatch } from "../src/planning/todo";

const WED = new Date(2026, 9, 21, 9);

/** A one-note vault whose front matter writes re-serialise the block (as Obsidian's do: quotes and order may change). */
function fakeApp(text: string) {
  const file = { path: "To-dos/Book NMR.md", basename: "Book NMR" };
  let body = text;
  const parse = (t: string): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const line of frontOf(t).split("\n").slice(1, -2)) {
      const i = line.indexOf(":");
      const v = line.slice(i + 1).trim().replace(/^"(.*)"$/, "$1");
      out[line.slice(0, i)] = v === "true" ? true : v === "false" ? false : v;
    }
    return out;
  };
  const app = {
    vault: {
      read: async () => body,
      process: async (_f: unknown, fn: (t: string) => string) => { body = fn(body); return body; },
    },
    fileManager: {
      processFrontMatter: async (_f: unknown, fn: (x: Record<string, unknown>) => void) => {
        const fm = parse(body);
        fn(fm);
        body = `---\n${Object.entries(fm).map(([k, v]) => `${k}: ${String(v)}`).join("\n")}\n---\n` + body.slice(frontOf(body).length);
      },
    },
    metadataCache: { getFileCache: () => ({ frontmatter: parse(body) }) },
  };
  return { app, file, text: () => body };
}

const NOTE = '---\nkind: todo\ndone: false\nscheduled: "2026-10-22"\nrolled: 2026-10-20\npriority: 2\n---\nBook the 400 MHz.\n';

describe("frontOf / swapFront", () => {
  it("finds the block and keeps the body", () => {
    expect(frontOf(NOTE)).toBe('---\nkind: todo\ndone: false\nscheduled: "2026-10-22"\nrolled: 2026-10-20\npriority: 2\n---\n');
    expect(frontOf("no front matter")).toBe("");
    expect(swapFront("---\na: 1\n---\nbody", "---\nb: 2\n---\n")).toBe("---\nb: 2\n---\nbody");
  });
});

describe("undoPlan", () => {
  const before = { kind: "todo", done: false, scheduled: "2026-10-22", rolled: "2026-10-20" };
  it("restores the block when only the tick and its stamps changed", () => {
    expect(undoPlan(before, { kind: "todo", done: true, scheduled: "2026-10-22", done_on: "2026-10-21" })).toBe("restore");
  });
  it("sets back only the tick keys when something else changed since", () => {
    expect(undoPlan(before, { kind: "todo", done: true, scheduled: "2026-10-23", done_on: "2026-10-21" })).toEqual({ set: { done: false, rolled: "2026-10-20" }, remove: ["done_on"] });
  });
  it("is null when nothing is left to undo", () => {
    expect(undoPlan(before, { ...before })).toBeNull();
  });
});

describe("toggleDoneWithUndo", () => {
  it("tick, the engine's stamps, then Undo: the front matter is byte-equal to before", async () => {
    const { app, file, text } = fakeApp(NOTE);
    await toggleDoneWithUndo(app as never, file as never);
    await app.fileManager.processFrontMatter(file, x => { const p = tickPatch(x, false, WED); if (p) applyPatch(x, p); });
    expect(text()).toContain("done_on: 2026-10-21");
    expect(text()).not.toContain("rolled");
    const n = lastNotice();
    expect(n.texts).toEqual(['Ticked "Book NMR". ', "Undo"]);
    n.clicks[0]();
    await new Promise(r => setTimeout(r, 0));
    expect(text()).toBe(NOTE);
    expect(n.hidden).toBe(true);
  });

  it("an untick shows no notice", async () => {
    const { app, file } = fakeApp(NOTE.replace("done: false", "done: true"));
    const count = created.length;
    await toggleDoneWithUndo(app as never, file as never);
    expect(created.length).toBe(count);
  });
});

describe("tickNotice", () => {
  it("a second tick replaces the first notice", () => {
    const a = tickNotice("A", async () => {}) as unknown as Seen;
    const b = tickNotice("B", async () => {}) as unknown as Seen;
    expect(a.hidden).toBe(true);
    expect(b.hidden).toBe(false);
  });
});

type Seen = { texts: string[]; clicks: (() => void)[]; hidden: boolean };
const created = (Notice as unknown as { all: Seen[] }).all;
const lastNotice = (): Seen => created[created.length - 1];

/** A parent that records the button it is asked for (no DOM in the tests). */
function fakeParent() {
  const btn = {
    className: "", attrs: {} as Record<string, string>, dataset: {} as Record<string, string>, on: {} as Record<string, (e: unknown) => void>,
    setAttribute(k: string, v: string) { this.attrs[k] = v; }, empty() { this.dataset = {}; },
    addEventListener(ev: string, fn: (e: unknown) => void) { this.on[ev] = fn; },
  };
  return { btn, parent: { createEl: () => btn } };
}
const click = { stopPropagation() { /* ignored */ } };

describe("tickButton (the chip bar's round tick)", () => {
  it("an open tick says Mark done; a click writes done: true, shows the notice, and the circle fills at once", async () => {
    const { app, file, text } = fakeApp(NOTE);
    const { btn, parent } = fakeParent();
    tickButton(parent as never, app as never, file as never, false);
    expect(btn.attrs["aria-label"]).toBe("Mark done");
    expect(btn.className).toBe("vt-todo-tick");
    const count = created.length;
    btn.on.click(click);
    expect(btn.className).toBe("vt-todo-tick is-done");
    expect(btn.attrs["aria-label"]).toBe("Mark not done");
    expect(btn.dataset.icon).toBe("check");
    await new Promise(r => setTimeout(r, 0));
    expect(text()).toContain("done: true");
    expect(created.length).toBe(count + 1);
    expect(lastNotice().texts).toEqual(['Ticked "Book NMR". ', "Undo"]);
  });

  it("a ticked tick says Mark not done and shows a check; a click writes done: false, no notice, and the circle opens", async () => {
    const { app, file, text } = fakeApp(NOTE.replace("done: false", "done: true"));
    const { btn, parent } = fakeParent();
    tickButton(parent as never, app as never, file as never, true);
    expect(btn.attrs["aria-label"]).toBe("Mark not done");
    expect(btn.className).toBe("vt-todo-tick is-done");
    expect(btn.dataset.icon).toBe("check");
    const count = created.length;
    btn.on.click(click);
    expect(btn.className).toBe("vt-todo-tick");
    expect(btn.dataset.icon).toBeUndefined();
    await new Promise(r => setTimeout(r, 0));
    expect(text()).toContain("done: false");
    expect(created.length).toBe(count);
  });
});
