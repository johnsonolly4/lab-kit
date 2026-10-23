// A made-up 16 to-do project (RAFT kinetics) for the plan picture tests. "Today" is 2026-10-20.
import type { NoteRec } from "../../src/planning/lists";

export const RAFT_TODAY = "2026-10-20";
const T = "00 Planning/To-dos/";
const note = (path: string, fm: Record<string, unknown> = {}): NoteRec =>
  ({ path, name: path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, ""), folder: path.slice(0, path.lastIndexOf("/")), fm, ctime: 0, mtime: 0 });
export const RAFT_HUB = note("02 Projects/RAFT kinetics/RAFT kinetics.md", { kind: "project" });
const td = (name: string, fm: Record<string, unknown> = {}): NoteRec => note(T + name + ".md", { kind: "todo", project: "[[RAFT kinetics]]", ...fm });
const after = (...n: string[]): string[] => n.map(x => `[[${x}]]`);
export const RAFT_TODOS: NoteRec[] = [
  td("Order monomers", { done: true }),
  td("Purify monomer", { done: true, after: after("Order monomers"), result: "98 % by GC" }),
  td("Calibrate pumps", { done: true }),
  td("Run RAFT screen", { after: after("Purify monomer", "Calibrate pumps"), due: "2026-10-23", priority: 1 }),
  td("Prepare stock solutions", { sub: "[[Run RAFT screen]]", done: true }),
  td("Degas reactor", { sub: "[[Run RAFT screen]]", done: true }),
  td("Run 6 conditions", { sub: "[[Run RAFT screen]]" }),
  td("Quench and store", { sub: "[[Run RAFT screen]]" }),
  td("Book GPC time", { after: after("Calibrate pumps"), due: "2026-10-15", waiting: "facility reply" }),
  td("GPC analysis", { after: after("Run RAFT screen", "Book GPC time") }),
  td("NMR end groups", { after: after("Run RAFT screen"), due: "2026-10-28" }),
  td("Compare Mn with theory", { after: after("GPC analysis", "NMR end groups") }),
  td("Scale-up batch", { after: after("Compare Mn with theory") }),
  td("Write up results", { after: after("Scale-up batch") }),
  td("Group meeting slides", { due: "2026-10-22" }),
  td("Clean glovebox", { done: true }),
];
