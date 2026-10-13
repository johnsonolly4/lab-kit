// "+ add after this": what the search offers and the text of a new to-do (src/planning/todo-picker.ts), and the flow (src/planning/add-after.ts).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { Notice } from "obsidian";
import { newTodoText, offeredTodos, todoFileName } from "../src/planning/todo-picker";
import { readPlan } from "../src/planning/plan";
import { PlanHistory } from "../src/planning/plan-history";
import type { NoteRec } from "../src/planning/lists";

const picked = vi.hoisted(() => ({ queue: [] as unknown[], calls: [] as { labels: string[]; typed: boolean }[] }));
vi.mock("../src/planning/ask", () => ({
  pick: async (_app: unknown, labels: string[], values: unknown[], _ph: string, _side?: boolean, typed?: { prefix: string; make: (t: string) => unknown }) => {
    picked.calls.push({ labels, typed: !!typed });
    const next = picked.queue.shift() as { index?: number; typed?: string; value?: unknown } | null | undefined;
    if (!next) return null;
    if (next.typed !== undefined) return typed!.make(next.typed);
    if (next.value !== undefined) return next.value;
    return values[next.index ?? 0];
  },
}));
const { addAfterFlow } = await import("../src/planning/add-after");

const T = "00 Planning/To-dos/";
const note = (path: string, fm: Record<string, unknown> = {}): NoteRec =>
  ({ path, name: path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, ""), folder: path.slice(0, path.lastIndexOf("/")), fm, ctime: 0, mtime: 0 });
const hub = note("02 Projects/Alpha/Alpha.md", { kind: "project" });
const td = (name: string, fm: Record<string, unknown> = {}): NoteRec => note(T + name + ".md", { kind: "todo", project: "[[Alpha]]", ...fm });
const other = (name: string, fm: Record<string, unknown> = {}): NoteRec => note(T + name + ".md", { kind: "todo", project: "[[Beta]]", ...fm });
const P = (n: string) => T + n + ".md";

describe("offeredTodos", () => {
  const all = [td("A"), td("B", { after: "[[A]]" }), td("C"), td("D", { done: true }), other("X"), other("Y", { after: "[[Z]]" }), other("Z"), other("W", { sub: "[[Z]]" }), note(T + "Free.md", { kind: "todo", project: "" })];
  const plan = readPlan(all.filter(t => String(t.fm.project).includes("Alpha")), hub);
  const list = offeredTodos(all, plan, "Alpha", P("A"));
  it("this project's open to-dos first, without itself, finished ones, ones already after it or that would make a loop", () => {
    expect(list.filter(o => o.same).map(o => o.name)).toEqual(["C"]);   // B already comes after A; D is done
    expect(offeredTodos(all, plan, "Alpha", P("B")).filter(o => o.same).map(o => o.name)).toEqual(["C"]);   // A would make a loop: B is after A
  });
  it("other projects' and no-project to-dos follow, with the project named", () => {
    expect(list.filter(o => !o.same).map(o => o.label)).toEqual(["Free · no project", "W · Beta (has links in its own project)", "X · Beta", "Y · Beta (has links in its own project)", "Z · Beta (has links in its own project)"]);
  });
  it("one with its own after or sub, or with subtasks, cannot be moved here", () => {
    const by = (n: string) => list.find(o => o.name === n)!;
    expect(by("X").blocked).toBeNull();
    expect(by("Free").blocked).toBeNull();
    expect(by("Y").blocked).toBe("it has links in its own project");   // has `after`
    expect(by("W").blocked).toBe("it has links in its own project");   // has `sub`
    expect(by("Z").blocked).toBe("it has links in its own project");   // W is its subtask
  });
});

describe("a new to-do", () => {
  it("has every property the To-do template writes, in Backlog with nothing else asked", () => {
    const text = newTodoText("Alpha", "[[A]]", new Date(2026, 9, 13));
    const keys = (s: string): string[] => [...(/^---\n([\s\S]*?)\n---/.exec(s)?.[1] ?? "").matchAll(/^([a-z_]+):/gm)].map(m => m[1]);
    const template = readFileSync("kits/planning/Extras/Templates/To-do.md", "utf8").split("-%>\n---\n").pop()!;
    expect(new Set([...keys("---\n" + template), "after"])).toEqual(new Set(keys(text)));   // the template writes `after` only when asked: a conditional line
    expect(text).toContain("kind: todo\nday: Backlog\nplanned: 2026-10-13\ndone: false");
    expect(text).toContain('project: "[[Alpha]]"');
    expect(text).toContain('after: "[[A]]"');
  });
  it("its file name loses the characters notes cannot have and is at most 80 long", () => {
    expect(todoFileName('  Order: tubing / valves? ')).toBe("Order- tubing - valves-");
    expect(todoFileName("x".repeat(100))).toHaveLength(80);
    expect(todoFileName("  ")).toBe("");
  });
});

describe("addAfterFlow", () => {
  const messages = (): string[] => (Notice as unknown as { messages: string[] }).messages;
  beforeEach(() => { messages().length = 0; picked.queue.length = 0; picked.calls.length = 0; });
  const setup = (fms: Record<string, Record<string, unknown>>) => {
    const created: Record<string, string> = {};
    const app = {
      vault: { getFileByPath: (p: string) => (p in fms || p in created ? { path: p } : null), create: async (p: string, t: string) => { created[p] = t; } },
      fileManager: { processFrontMatter: async (f: { path: string }, fn: (fm: Record<string, unknown>) => void) => { fn(fms[f.path]); } },
      metadataCache: { fileToLinktext: (f: { path: string }) => f.path.replace(/^.*\//, "").replace(/\.md$/, "") },
    } as never;
    const todos = Object.entries(fms).map(([p, fm]) => note(p, fm));
    const plan = readPlan(todos.filter(t => String(t.fm.project).includes("Alpha")), hub);
    const history = new PlanHistory();
    return { created, history, env: { app, history, hub, folder: "00 Planning/To-dos", todos, plan } };
  };
  const fms = (): Record<string, Record<string, unknown>> => ({ [P("A")]: { kind: "todo", project: "[[Alpha]]" }, [P("C")]: { kind: "todo", project: "[[Alpha]]" }, [P("X")]: { kind: "todo", project: "[[Beta]]" }, [P("Y")]: { kind: "todo", project: "[[Beta]]", after: "[[Q]]" } });

  it("a to-do of this project: its after gets a link to the node, and it is one history step", async () => {
    const f = fms();
    const { env, history } = setup(f);
    picked.queue.push({ index: 0 });   // C (this project's first)
    await addAfterFlow(env, P("A"));
    expect(f[P("C")].after).toBe("[[A]]");
    expect(history.peek("undo")?.label).toBe('Comes after "A"');
    expect(picked.calls[0].typed).toBe(true);
    expect(picked.calls[0].labels[0]).toBe("C");
  });
  it("a to-do of another project asks first; yes moves it here and links it, as one group in the history; no changes nothing", async () => {
    const f = fms();
    const { env, history } = setup(f);
    picked.queue.push({ index: 1 }, { value: false });   // X, then Cancel
    await addAfterFlow(env, P("A"));
    expect(f[P("X")]).toEqual({ kind: "todo", project: "[[Beta]]" });
    expect(history.size("undo")).toBe(0);
    picked.queue.push({ index: 1 }, { value: true });
    await addAfterFlow(env, P("A"));
    expect(f[P("X")]).toEqual({ kind: "todo", project: '"[[Alpha]]"', after: "[[A]]" });
    expect(history.size("undo")).toBe(2);
    expect(history.peek("undo")?.group).toBe(history.withGroup("undo", history.peek("undo")!)[0].group);
    expect(history.withGroup("undo", history.peek("undo")!)).toHaveLength(2);
  });
  it("a to-do of another project with its own links is refused with a reason", async () => {
    const f = fms();
    const { env, history } = setup(f);
    picked.queue.push({ index: 2 });   // Y
    await addAfterFlow(env, P("A"));
    expect(f[P("Y")]).toEqual({ kind: "todo", project: "[[Beta]]", after: "[[Q]]" });
    expect(history.size("undo")).toBe(0);
    expect(messages()[0]).toContain("can't be moved to this project");
  });
  it("typed text that matches nothing makes a new to-do after the node, in this project; Esc does nothing", async () => {
    const { env, created, history } = setup(fms());
    picked.queue.push({ typed: "Book pump service" });
    await addAfterFlow(env, P("A"));
    const [path, text] = Object.entries(created)[0];
    expect(path).toBe("00 Planning/To-dos/Book pump service.md");
    expect(text).toContain('project: "[[Alpha]]"');
    expect(text).toContain('after: "[[A]]"');
    expect(history.size("undo")).toBe(0);   // a new note is not in the history
    expect(messages()[0]).toContain("Undo does not remove it");
    picked.queue.push(null);
    await addAfterFlow(env, P("A"));
    expect(Object.keys(created)).toHaveLength(1);
  });
  it("a name that is taken gets a number", async () => {
    const { env, created } = setup({ ...fms(), [P("New")]: { kind: "todo", project: "[[Alpha]]" } });
    picked.queue.push({ typed: "New" });
    await addAfterFlow(env, P("A"));
    expect(Object.keys(created)).toEqual(["00 Planning/To-dos/New 2.md"]);
  });
});
