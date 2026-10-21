// RAFT block maths: the 0005 known answers and the numbers of docs/plans/raft-known-answers.py (run it to re-derive them).
import { describe, it, expect } from "vitest";
import { raftFromWeighed, raftTargets, type RaftSetup } from "../src/blocks/raft/maths";

const daam: RaftSetup = { monomers: [{ name: "DAAm", mw: 169.23, fraction: 1 }], cta: { name: "PDMA 76", mw: 2220.99 }, initiator: { name: "VA-044", mw: 323.33 }, massG: 2.5, dp: 105, ratio: 20, solidsPct: 20 };

describe("0005 targets", () => {
  const t = raftTargets(daam)!;
  it("Mn = 19990.14, CTA 0.3125 g, water 11.259 g", () => {
    expect(t.mn).toBeCloseTo(19990.14, 6);
    expect(t.cta.g).toBeCloseTo(0.3125, 3);
    expect(t.solventG).toBeCloseTo(11.259, 3);
  });
  it("the other numbers of the script", () => {
    expect(t.monomers[0].mol * 1e3).toBeCloseTo(14.77279, 4);
    expect(t.cta.mol * 1e3).toBeCloseTo(0.14069, 4);
    expect(t.initiator.g).toBeCloseTo(0.00227, 5);
    expect(t.initiator.mol * 1e3).toBeCloseTo(0.007035, 5);
    expect(t.solidsG).toBeCloseTo(2.81475, 4);
    expect(t.cosolventG).toBeNull();
  });
  it("from what is weighed: DP 104.84, Mn 19963, solids 20.00 % (initiator at target)", () => {
    const w = raftFromWeighed(daam, t, { monomers: [2.5012], cta: 0.3131, solvent: 11.263 });
    expect(w.dp).toBeCloseTo(104.8418, 3);
    expect(w.mn).toBeCloseTo(19963.373, 2);
    expect(w.solidsPct).toBeCloseTo(20.0047, 3);
  });
  it("nothing weighed gives the targets back", () => {
    const w = raftFromWeighed(daam, t, { monomers: [undefined] });
    expect(w.dp).toBeCloseTo(105, 9);
    expect(w.mn).toBeCloseTo(t.mn, 6);
    expect(w.solidsPct).toBeCloseTo(20, 9);
  });
});

describe("several monomers, co-solvent, bad input", () => {
  it("three monomers: masses add up to the total, Mn from the mean MW", () => {
    const s: RaftSetup = { ...daam, monomers: [{ name: "DMAm", mw: 99.13, fraction: 1 }, { name: "DAAm", mw: 169.23, fraction: 1 }, { name: "Lipoic Acid", mw: 206.32, fraction: 1 }], cta: { name: "PABTC", mw: 238.39 } };
    const t = raftTargets(s)!;
    expect(t.meanMw).toBeCloseTo(158.226667, 5);
    expect(t.monomers.map(m => m.g)).toEqual([expect.closeTo(0.522089, 5), expect.closeTo(0.891285, 5), expect.closeTo(1.086627, 5)]);
    expect(t.monomers.reduce((a, m) => a + m.g, 0)).toBeCloseTo(2.5, 9);
    expect(t.mn).toBeCloseTo(16852.19, 2);
  });
  it("fractions are weights: 3 : 1 and 0.75 : 0.25 are the same", () => {
    const m = (a: number, b: number) => raftTargets({ ...daam, monomers: [{ name: "A", mw: 100, fraction: a }, { name: "B", mw: 200, fraction: b }] })!;
    expect(m(3, 1).mn).toBeCloseTo(m(0.75, 0.25).mn, 9);
    expect(m(3, 1).monomers[0].g).toBeCloseTo(m(0.75, 0.25).monomers[0].g, 9);
  });
  it("co-solvent is a share of the solvent's mass, outside the solids", () => {
    const t = raftTargets({ ...daam, cosolventPct: 20 })!;
    expect(t.cosolventG).toBeCloseTo(2.2518, 4);
    expect(t.solventG).toBeCloseTo(11.259, 3);
  });
  it("an unusable input gives null, never a guess", () => {
    expect(raftTargets({ ...daam, dp: 0 })).toBeNull();
    expect(raftTargets({ ...daam, massG: NaN })).toBeNull();
    expect(raftTargets({ ...daam, solidsPct: 120 })).toBeNull();
    expect(raftTargets({ ...daam, monomers: [] })).toBeNull();
    expect(raftTargets({ ...daam, monomers: [{ name: "X", mw: 0, fraction: 1 }] })).toBeNull();
  });
});
