// Made-up lab notes for tests/lab-board.test.ts (front matter as Obsidian's metadata cache gives it, check-box counts, and to-dos that link to them).
// Same cases as prototype B3's vault: a note with no chemicals, one with no class, one with five chemicals, one with no check boxes, a long title,
// an old one-item Status list, a Status of the user's own, an ended note (closed_on only) and closed ones with a Result.
import type { LabNoteIn } from "../../src/lab/lab-board";

const F = "03 Lab Book/Notes/";
const note = (name: string, fm: Record<string, unknown>, boxes = 0, ticked = 0): LabNoteIn => ({ path: `${F}${name}.md`, name, fm, boxes, ticked, todos: 0 });

export const LAB_NOTES: LabNoteIn[] = [
  note("ABC0001-A - RAFT of styrene", { Status: "Closed", "Exp. Class": "RAFT", "Exp. Start": "2026-06-02", Chemicals: ["[[Styrene]]", "[[AIBN]]", "[[CPDB]]"], Outcome: "Mn 19990", Result: "Worked", closed_on: "2026-07-01", closed_hash: "ab12" }, 6, 6),
  note("ABC0002-A - Flow reactor calibration", { Status: "Planned", "Exp. Class": "Flow", "Exp. Start": "2026-10-20" }, 4, 0),
  note("ABC0003-A - Solubility screen", { Status: "Started", Chemicals: ["[[DCM]]"] }, 3, 1),
  note("ABC0005-A - Chain extension", { Status: ["Started"], "Exp. Class": "RAFT", "Exp. Start": "2026-10-01", Chemicals: ["[[Styrene]]", "[[AIBN]]", "[[CPDB]]", "[[Toluene]]", "[[Chemicals/MMA|MMA]]"] }, 10, 7),
  note("ABC0007-A - GPC of the series", { Status: "Processing results", "Exp. Class": "RAFT", Chemicals: "[[THF]]" }),
  note("ABC0008-A - Old run, ended", { Status: "Processing results", "Exp. Class": "Flow", closed_on: "2026-05-10" }),
  note("ABC0009-A - Failed gel", { Status: "Closed", "Exp. Class": "RAFT", Outcome: "gelled at 40 min", Result: "Failed", closed_on: "2026-09-15", closed_pdf: "pending" }, 2, 2),
  note("ABC0010-A - Waiting on a part", { Status: "On hold", "Exp. Class": "in silico" }),
  note("ABC0031-A - A very long title for an experiment that runs over two lines on a card in the board", { Status: "Planned", "Exp. Class": "in silico", "Exp. Start": new Date("2026-11-03T00:00:00Z") }),
];

/** To-do front matter: two open for ABC0005, one done for ABC0005, one open for ABC0002 (by path link), one with no experiment. */
export const TODOS: { fm: Record<string, unknown> }[] = [
  { fm: { kind: "todo", experiment: "[[ABC0005-A - Chain extension]]" } },
  { fm: { kind: "todo", experiment: ["[[ABC0005-A - Chain extension|chain ext]]"] } },
  { fm: { kind: "todo", experiment: "[[ABC0005-A - Chain extension]]", done: true } },
  { fm: { kind: "todo", experiment: "[[03 Lab Book/Notes/ABC0002-A - Flow reactor calibration]]" } },
  { fm: { kind: "todo" } },
];
