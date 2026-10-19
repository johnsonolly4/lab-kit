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
const entry = vi.hoisted(() => ({ first: [] as ({ title: string; values: Record<string, unknown>; alt?: boolean } | null)[], answers: [] as ({ title: string; values: Record<string, unknown> } | null)[], calls: [] as { heading: string; keys: string[]; title?: string }[] }));
vi.mock("../src/planning/entry-window", () => ({
  openEntry: async (_app: unknown, heading: string, fields: { key: string }[], initial: { title?: string; alt?: string } = {}) => {
    if (initial.alt && initial.title === undefined) return entry.first.length ? entry.first.shift() : { title: "", values: {}, alt: true };   // the window the drop opens: by default press its "pick an existing to-do" link
    entry.calls.push({ heading, keys: fields.map(f => f.key), title: initial.title });
    return entry.answers.length ? entry.answers.shift() : { title: initial.title ?? "", values: {} };   // no answer queued: Enter on what was typed
  },
  pointerAnchor: () => null,
}));
const { addAfterFlow, insertAfterFlow, insertBeforeFlow } = await import("../src/planning/add-after");

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
  it("in the Backlog with nothing else asked: only set values (kind, done, project, after, cssclasses), no day / planned / rolled / countdown", () => {
    const text = newTodoText("Alpha", "[[A]]");
    const keys = (s: string): string[] => [...(/^---\n([\s\S]*?)\n---/.exec(s)?.[1] ?? "").matchAll(/^([a-z_]+):/gm)].map(m => m[1]);
    expect(keys(text)).toEqual(["kind", "done", "project", "after", "cssclasses"]);
    expect(text).toContain("kind: todo\ndone: false\n");
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
  beforeEach(() => { messages().length = 0; picked.queue.length = 0; picked.calls.length = 0; entry.first.length = 0; });
  const setup = (fms: Record<string, Record<string, unknown>>) => {
    const created: Record<string, string> = {};
    const app = {
      vault: { getMarkdownFiles: () => [], getFileByPath: (p: string) => (p in fms || p in created ? { path: p } : null), create: async (p: string, t: string) => { created[p] = t; }, read: async (f: { path: string }) => created[f.path] },
      fileManager: { processFrontMatter: async (f: { path: string }, fn: (fm: Record<string, unknown>) => void) => { fn(fms[f.path]); }, trashFile: async (f: { path: string }) => { delete created[f.path]; } },
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
    expect(f[P("X")]).toEqual({ kind: "todo", project: "[[Alpha]]", after: "[[A]]" });   // the link itself: Obsidian adds the quotes when it writes the file
    const after = readPlan(Object.entries(f).map(([p, fm]) => note(p, fm)), hub);   // the moved to-do must be read back as one of this project's
    expect(after.rows.map(r => r.name)).toContain("X");
    expect(after.rows.find(r => r.name === "X")?.after).toEqual(["A"]);
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
    expect(history.peek("undo")?.label).toBe('Made "Book pump service"');   // the new note is a history step: Undo removes it
    picked.queue.push(null);
    await addAfterFlow(env, P("A"));
    expect(Object.keys(created)).toHaveLength(1);
  });
  it("a new to-do from the map opens the entry window (no Project chip), with what was typed as the title; its answers are written; Esc in the window makes nothing", async () => {
    const { env, created } = setup(fms());
    entry.calls.length = 0; entry.answers.length = 0;
    entry.answers.push({ title: "Book pump service", values: { due: "2026-11-15", priority: 1 } });
    picked.queue.push({ typed: "book pump" });
    await addAfterFlow(env, P("A"));
    expect(entry.calls[0]).toEqual({ heading: "New to-do", keys: ["meeting", "due", "priority", "waiting"], title: "book pump" });
    const text = Object.values(created)[0];
    expect(Object.keys(created)[0]).toBe("00 Planning/To-dos/Book pump service.md");
    expect(text).toContain("due: 2026-11-15");
    expect(text).toContain("priority: 1");
    entry.answers.push(null);
    picked.queue.push({ typed: "Other" });
    await addAfterFlow(env, P("A"));
    expect(Object.keys(created)).toHaveLength(1);
  });
  it("the drop opens the entry window first: Enter makes the to-do without the search list; its link goes to the list; Esc does nothing", async () => {
    const { env, created } = setup(fms());
    entry.calls.length = 0; entry.answers.length = 0;
    entry.first.push({ title: "Straight away", values: { priority: 2 } });
    await addAfterFlow(env, P("A"));
    expect(picked.calls).toHaveLength(0);
    expect(Object.keys(created)).toEqual(["00 Planning/To-dos/Straight away.md"]);
    entry.first.push(null);
    await addAfterFlow(env, P("A"));
    expect(picked.calls).toHaveLength(0);
    expect(Object.keys(created)).toHaveLength(1);
    await addAfterFlow(env, P("A"));   // no answer queued: the link is pressed
    expect(picked.calls).toHaveLength(1);
  });
  it("the window after a typed name has the Pick existing chip: pressing it goes back to the search list", async () => {
    const { env, created } = setup(fms());
    entry.calls.length = 0; entry.answers.length = 0;
    entry.answers.push({ title: "", values: {}, alt: true } as never);
    picked.queue.push({ typed: "brand new" }, { index: 0 });   // the typed name, then (after the chip) the first to-do of the list
    await addAfterFlow(env, P("A"));
    expect(picked.calls).toHaveLength(2);
    expect(Object.keys(created)).toHaveLength(0);
  });
  it("newTodoText writes an experiment link only when given", () => {
    expect(newTodoText("Alpha", "")).not.toContain("experiment");
    const text = newTodoText("Alpha", "", { experiment: "ABC0014-A" });
    expect(text).toContain('experiment: "[[ABC0014-A]]"\ncssclasses:');
  });
  it("newTodoText writes a waiting line only when given, quoted so a colon or quote is safe", () => {
    expect(newTodoText("Alpha", "")).not.toContain("waiting");
    expect(newTodoText("Alpha", "", { waiting: "  " })).not.toContain("waiting");
    expect(newTodoText("Alpha", "", { waiting: 'Dr "S": samples' })).toContain('waiting: "Dr \\"S\\": samples"\ncssclasses:');
  });
  it("the To-do template writes the entry window's Waiting chip", () => {
    const tpl = readFileSync("kits/planning/Extras/Templates/To-do.md", "utf8");
    expect(tpl).toContain("preset.waiting");
    expect(tpl).toContain("waiting: ${JSON.stringify(waiting)}");
  });
  it("newTodoText writes the meeting, due date and priority it is given", () => {
    const text = newTodoText("Alpha", "[[A]]", { due: "2026-11-15", priority: 2, meeting: "Group meeting" });
    expect(text).toContain("due: 2026-11-15\n");
    expect(text).toContain("priority: 2\n");
    expect(text).toContain('meeting: "[[Group meeting]]"');
    expect(newTodoText("Alpha", "[[A]]")).not.toContain("meeting");
    expect(newTodoText("", "")).not.toMatch(/project|due|priority/);
  });
  it("Undo removes a made to-do, Redo makes it again; one written in since is left alone", async () => {
    const { env, created, history } = setup(fms());
    const { runHistory } = await import("../src/planning/after-write");
    picked.queue.push({ typed: "Temp" });
    await addAfterFlow(env, P("A"));
    const path = "00 Planning/To-dos/Temp.md", text = created[path];
    await runHistory(env.app, history, "undo");
    expect(path in created).toBe(false);
    await runHistory(env.app, history, "redo");
    expect(created[path]).toBe(text);
    created[path] = text + "typed in Obsidian\n";   // the user wrote in it
    await runHistory(env.app, history, "undo");
    expect(created[path]).toContain("typed in Obsidian");
    expect(messages().pop()).toContain("changed since");
  });
  it("a name that is taken gets a number", async () => {
    const { env, created } = setup({ ...fms(), [P("New")]: { kind: "todo", project: "[[Alpha]]" } });
    picked.queue.push({ typed: "New" });
    await addAfterFlow(env, P("A"));
    expect(Object.keys(created)).toEqual(["00 Planning/To-dos/New 2.md"]);
  });
  it("the + after button: a new to-do goes between the card and all its followers; the drop box keeps them on the card; with no followers it is a plain add", async () => {
    const f = { ...fms(), [P("B")]: { kind: "todo", project: "[[Alpha]]", after: "[[A]]" }, [P("D")]: { kind: "todo", project: "[[Alpha]]", after: "[[A]]" } };
    const { env, created, history } = setup(f);
    entry.calls.length = 0; entry.answers.length = 0; entry.first.length = 0;
    entry.first.push({ title: "Middle", values: {} });
    await insertAfterFlow(env, P("A"));
    expect(created["00 Planning/To-dos/Middle.md"]).toContain('after: "[[A]]"');
    expect(f[P("B")].after).toBe("[[Middle]]");
    expect(f[P("D")].after).toBe("[[Middle]]");
    expect(history.withGroup("undo", history.peek("undo")!)).toHaveLength(3);   // the note and both followers: one Undo step
    const drop = setup(f);
    entry.first.push({ title: "Branch", values: {} });
    await addAfterFlow(drop.env, P("A"));   // the drop: no followers handed over, B and D stay on A
    expect(f[P("B")].after).toBe("[[Middle]]");   // (already moved above, untouched now)
    const plain = setup(fms());
    entry.first.push({ title: "Plain", values: {} });
    await insertAfterFlow(plain.env, P("A"));
    expect(Object.keys(plain.created)).toEqual(["00 Planning/To-dos/Plain.md"]);
    expect(plain.history.size("undo")).toBe(1);
  });
  it("the + before button: a new to-do goes between the card's predecessors and the card, as one Undo step", async () => {
    const f = { ...fms(), [P("B")]: { kind: "todo", project: "[[Alpha]]", after: ["[[A]]", "[[C]]"] } };
    const { env, created, history } = setup(f);
    const { runHistory } = await import("../src/planning/after-write");
    entry.calls.length = 0; entry.answers.length = 0;
    entry.answers.push({ title: "Before B", values: { priority: 2 } });
    await insertBeforeFlow(env, P("B"));
    const path = "00 Planning/To-dos/Before B.md", text = created[path];
    expect(text).toContain('after:\n  - "[[A]]"\n  - "[[C]]"');   // after both of B's predecessors
    expect(text).toContain("priority: 2");
    expect(f[P("B")].after).toBe("[[Before B]]");   // B comes after the new to-do instead of A and C
    expect(history.withGroup("undo", history.peek("undo")!)).toHaveLength(2);   // the note and B: one step
    expect(entry.calls[0].keys).toEqual(["meeting", "due", "priority", "waiting"]);
    await runHistory(env.app, history, "undo");
    expect(path in created).toBe(false);
    expect(f[P("B")].after).toEqual(["[[A]]", "[[C]]"]);
    await runHistory(env.app, history, "redo");
    expect(created[path]).toBe(text);
    expect(f[P("B")].after).toBe("[[Before B]]");
  });
  it("+ before on a card with nothing before it makes the new to-do its first step (no after line); Esc and an empty title make nothing", async () => {
    const f = fms();
    const { env, created } = setup(f);
    entry.answers.length = 0;
    entry.answers.push({ title: "First step", values: {} });
    await insertBeforeFlow(env, P("A"));
    expect(created["00 Planning/To-dos/First step.md"]).not.toContain("after:");
    expect(f[P("A")].after).toBe("[[First step]]");
    entry.answers.push(null);
    await insertBeforeFlow(env, P("C"));
    entry.answers.push({ title: "  ", values: {} });
    await insertBeforeFlow(env, P("C"));
    expect(Object.keys(created)).toHaveLength(1);
    expect(f[P("C")].after).toBeUndefined();
  });
  it("newTodoText: no after leaves the line out, several make a list, one stays a single link", () => {
    expect(newTodoText("Alpha", [])).not.toContain("after:");
    expect(newTodoText("Alpha", "")).not.toContain("after:");
    expect(newTodoText("Alpha", ["[[A]]"])).toContain('after: "[[A]]"\ncssclasses:');
    expect(newTodoText("Alpha", ["[[A]]", "[[C]]"])).toContain('after:\n  - "[[A]]"\n  - "[[C]]"\ncssclasses:');
  });
});
