// A made-up project of 59 to-dos (24 open parents), for the plan picture tests. Names are invented; copy of the list in
// my_work/mockups/plan-map-export-src/gen-large.ts. "Today" is 2026-10-20. The workstream (first column) is not used by the plugin.
import type { NoteRec } from "../../src/planning/lists";

export const BIG_TODAY = "2026-10-20";
export const BIG_TITLE = "Block copolymer library";
const T = "00 Planning/To-dos/";
const note = (path: string, fm: Record<string, unknown> = {}): NoteRec =>
  ({ path, name: path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, ""), folder: path.slice(0, path.lastIndexOf("/")), fm, ctime: 0, mtime: 0 });
export const BIG_HUB = note(`02 Projects/${BIG_TITLE}/${BIG_TITLE}.md`, { kind: "project" });

interface O { d?: true; after?: string[]; due?: string; wait?: string; pri?: number; result?: string; subs?: [string, boolean][] }
const WS = ["Reagents", "Kinetics", "Block synthesis", "Characterisation", "Writing", "Admin and safety"] as const;
type W = typeof WS[number];
const R: W = "Reagents", K: W = "Kinetics", B: W = "Block synthesis", G: W = "Characterisation", Wr: W = "Writing", S: W = "Admin and safety";
const list: [W, string, O][] = [
  [R, "Order monomers", { d: true }],
  [R, "Order RAFT agents", { d: true }],
  [R, "Order initiator", { d: true }],
  [R, "Set up glovebox", { d: true }],
  [R, "Purify monomer A", { d: true, after: ["Order monomers"], result: "99 % by GC" }],
  [R, "Purify monomer B", { d: true, after: ["Order monomers"], result: "98 % by GC" }],
  [R, "Recrystallise initiator", { d: true, after: ["Order initiator"] }],
  [R, "Calibrate syringe pumps", { d: true }],
  [R, "Verify monomer purity by GC", { d: true, after: ["Purify monomer A", "Purify monomer B"] }],
  [R, "Label stock bottles", { d: true, after: ["Set up glovebox"] }],
  [K, "Dry solvents", { d: true, after: ["Set up glovebox"] }],
  [K, "Screen RAFT agents", { d: true, after: ["Order RAFT agents", "Purify monomer A", "Calibrate syringe pumps"], result: "agent 2 best", subs: [["Prepare agent stocks", true], ["Degas agent screen", true], ["Run 4 agents", true], ["Quench agent screen", true]] }],
  [K, "Screen temperatures", { d: true, after: ["Screen RAFT agents"] }],
  [K, "Check RAFT agent loss by UV", { d: true, after: ["Screen RAFT agents"] }],
  [K, "Run kinetics at 70 C", { after: ["Screen temperatures", "Recrystallise initiator"], due: "2026-10-23", pri: 1, subs: [["Prepare stocks 70", true], ["Degas reactor 70", true], ["Run 6 samples 70", false], ["Quench and store 70", false]] }],
  [K, "Kinetics repeat at 80 C", { after: ["Screen temperatures"], due: "2026-10-14", subs: [["Prepare stocks 80", true], ["Degas reactor 80", false], ["Run 6 samples 80", false]] }],
  [K, "NMR conversion timecourse", { after: ["Run kinetics at 70 C"] }],
  [K, "GPC Mn vs conversion", { after: ["Run kinetics at 70 C", "Run GPC standards"] }],
  [K, "Fit rate constants", { after: ["NMR conversion timecourse", "GPC Mn vs conversion"] }],
  [K, "Compare Mn with theory", { after: ["Fit rate constants"] }],
  [B, "Pilot macro-CTA run", { d: true, after: ["Purify monomer A"] }],
  [B, "Synthesise macro-CTA 1", { d: true, after: ["Purify monomer A", "Screen RAFT agents"], subs: [["Weigh macro-CTA 1 feed", true], ["Run macro-CTA 1", true], ["Precipitate macro-CTA 1", true]] }],
  [B, "Synthesise macro-CTA 2", { d: true, after: ["Purify monomer B", "Screen RAFT agents"], subs: [["Weigh macro-CTA 2 feed", true], ["Run macro-CTA 2", true]] }],
  [B, "Characterise macro-CTAs", { d: true, after: ["Synthesise macro-CTA 1", "Synthesise macro-CTA 2", "Book GPC time"] }],
  [B, "Chain extend with monomer B", { d: true, after: ["Characterise macro-CTAs"], subs: [["Prepare extension stocks", true], ["Run extension", true], ["Quench extension", true]] }],
  [B, "Chain extend second batch", { after: ["Characterise macro-CTAs"], due: "2026-10-22" }],
  [B, "NMR block ratio", { d: true, after: ["Chain extend with monomer B"] }],
  [B, "Purify blocks by precipitation", { after: ["Chain extend with monomer B"] }],
  [B, "GPC of diblocks", { after: ["Purify blocks by precipitation", "Book GPC time for diblocks"] }],
  [B, "Scale up diblock to 5 g", { after: ["GPC of diblocks", "Chain extend second batch"], subs: [["Order 5 g monomer", false], ["Set up large reactor", false], ["Run scale-up", false]] }],
  [B, "Film casting trials", { after: ["Scale up diblock to 5 g"] }],
  [G, "Book GPC time", { d: true }],
  [G, "Run GPC standards", { d: true, after: ["Book GPC time"] }],
  [G, "Calibrate GPC columns", { d: true }],
  [G, "Calibrate DSC", { d: true }],
  [G, "Calibrate TEM magnification", { d: true }],
  [G, "AFM of test films", { d: true }],
  [G, "Book GPC time for diblocks", { wait: "facility reply", due: "2026-10-15" }],
  [G, "DSC thermal transitions", { after: ["Purify blocks by precipitation", "Calibrate DSC"] }],
  [G, "SAXS beamtime proposal", { wait: "panel decision", due: "2026-11-02" }],
  [G, "Prepare SAXS samples", { after: ["Film casting trials", "SAXS beamtime proposal"], subs: [["Cut film discs", false], ["Mount capillaries", false]] }],
  [G, "SAXS data collection", { after: ["Prepare SAXS samples"] }],
  [G, "Stain TEM grids", { after: ["Film casting trials", "Calibrate TEM magnification"] }],
  [G, "TEM imaging", { after: ["Stain TEM grids"], subs: [["Image domains", false], ["Image defects", false], ["Measure spacings", false]] }],
  [Wr, "Outline paper", { d: true }],
  [Wr, "Update literature table", { d: true }],
  [Wr, "Draft methods section", { d: true, after: ["Screen temperatures", "Chain extend with monomer B"] }],
  [Wr, "Submit conference abstract", { d: true, after: ["Draft methods section"] }],
  [Wr, "Group meeting slides", { after: ["Draft methods section"], due: "2026-10-22" }],
  [Wr, "Kinetics figures", { after: ["Fit rate constants"] }],
  [Wr, "Morphology figures", { after: ["SAXS data collection", "TEM imaging"] }],
  [Wr, "Write results section", { after: ["Kinetics figures", "Morphology figures", "Compare Mn with theory"] }],
  [Wr, "Supervisor review of draft", { after: ["Write results section"], wait: "supervisor" }],
  [S, "Update risk assessment", { d: true }],
  [S, "CoSHH for new monomer", { d: true, after: ["Update risk assessment"] }],
  [S, "Order glassware", { d: true }],
  [S, "Safety walkthrough", { d: true }],
  [S, "Clean glovebox", { d: true }],
  [S, "Order gloves", {}],
];

export const BIG_TODOS: NoteRec[] = (() => {
  const out: NoteRec[] = [];
  for (const [, name, o] of list) {
    const fm: Record<string, unknown> = { kind: "todo", project: `[[${BIG_TITLE}]]` };
    if (o.d) fm.done = true;
    if (o.after) fm.after = o.after.map(x => `[[${x}]]`);
    if (o.due) fm.due = o.due;
    if (o.pri) fm.priority = o.pri;
    if (o.result) fm.result = o.result;
    if (o.wait) fm.waiting = o.wait;
    out.push(note(T + name + ".md", fm));
    for (const [sn, sd] of o.subs ?? []) out.push(note(T + sn + ".md", { kind: "todo", project: `[[${BIG_TITLE}]]`, sub: `[[${name}]]`, ...(sd ? { done: true } : {}) }));
  }
  return out;
})();
