// Solution prep maths: known answers from the Appendix script of docs/plans/solution-live-block.md (re-run with python3 -).
import { describe, it, expect } from "vitest";
import { acidConcForPH, acidRecipe, balanceRange, bottleMolarity, molesPerGram, pHFromConc, pHFromMasses, type AcidSetup } from "../src/solution/acid";

const ACETIC = { mw: 60.05, purity: 99.7, density: 1.049 };
const SETUP: AcidSetup = { aqueousG: 15, pH: 4, share: 0.6, use: 0.5, reagent: ACETIC, pKa: 4.76, kind: "acid", readabilityG: 0.0001 };

describe("acid for a target pH", () => {
  it("acetic acid, pH 4.00: C, 1.2205 mg, 18.00 g made, 9.00 g solution + 6.00 g water", () => {
    const r = acidRecipe(SETUP);
    expect(r.conc).toBeCloseTo(6.754e-4, 7);
    expect(r.acidG! * 1000).toBeCloseTo(1.2205, 4);
    expect(r.madeG).toBeCloseTo(18, 10);
    expect(r.solutionG).toBeCloseTo(9, 10);
    expect(r.waterG).toBeCloseTo(6, 10);
    expect(r.approximate).toBe(true);
    expect(r.tooSmall).toBe(false);
    expect(r.batchG).toBeNull();
    expect(r.problems).toEqual([]);
  });

  it("actuals 1.30 mg and 18.0012 g, step 2 at target: estimated pH 3.985", () => {
    const ph = pHFromMasses({ acidG: 1.3e-3, madeG: 18.0012, solutionG: 9, aqueousG: 15 }, ACETIC, 4.76);
    expect(ph).toBeCloseTo(3.985, 3);
  });

  it("balance +-0.1 mg on the 1.22 mg target: pH 4.020 / 3.982", () => {
    const r = acidRecipe(SETUP);
    const range = balanceRange(SETUP, r.acidG!)!;
    expect(range.high).toBeCloseTo(4.02, 3);
    expect(range.low).toBeCloseTo(3.982, 3);
  });

  it("the target mass gives back the target pH", () => {
    const r = acidRecipe(SETUP);
    expect(pHFromMasses({ acidG: r.acidG!, madeG: r.madeG, solutionG: r.solutionG, aqueousG: 15 }, ACETIC, 4.76)).toBeCloseTo(4, 6);
  });

  it("pH 4.5 needs 0.161 mg: too small for a 0.1 mg balance, batch size suggested", () => {
    const r = acidRecipe({ ...SETUP, pH: 4.5 });
    expect(r.acidG! * 1000).toBeCloseTo(0.161, 3);
    expect(r.tooSmall).toBe(true);
    // the batch brings the acid to 10 x 0.1 mg = 1 mg
    expect(r.batchG! / r.madeG * r.acidG!).toBeCloseTo(0.001, 9);
    expect(r.batchG!).toBeGreaterThan(r.madeG);
  });

  it("a base uses the same maths (pKa of the conjugate acid): mirror of the acid", () => {
    // base with conjugate pKa 14 - 4.76 at pH 10 = acid with pKa 4.76 at pH 4
    expect(acidConcForPH(10, 14 - 4.76, "base")).toBeCloseTo(acidConcForPH(4, 4.76, "acid"), 12);
    const c = acidConcForPH(10.5, 9.25, "base");
    expect(pHFromConc(c, 9.25, "base")).toBeCloseTo(10.5, 6);
  });

  it("strong acid: C = [H+] - Kw/[H+]; pH round trip", () => {
    expect(acidConcForPH(2, null)).toBeCloseTo(0.01 - 1e-12, 14);
    expect(pHFromConc(0.01, null)).toBeCloseTo(2, 6);
    expect(pHFromConc(acidConcForPH(12, null, "base"), null, "base")).toBeCloseTo(12, 6);
  });

  it("invalid set-up is named, not thrown", () => {
    const r = acidRecipe({ ...SETUP, aqueousG: 0, use: 0, share: 2 });
    expect(r.problems).toEqual(["aqueous", "share", "use"]);
    expect(r.acidG).toBeNull();
  });
});

describe("reagent: purity or molarity", () => {
  it("bottle molarity: acetic 17.42 M, HCl 12.08 M, NaOH 19.00 M", () => {
    expect(bottleMolarity(ACETIC).value).toBeCloseTo(17.42, 2);
    expect(bottleMolarity({ mw: 36.46, purity: 37, density: 1.19 }).value).toBeCloseTo(12.08, 2);
    expect(bottleMolarity({ mw: 40, purity: 50, density: 1.52 }).value).toBeCloseTo(19.0, 2);
  });

  it("missing purity / density / MW are reported, nothing is guessed", () => {
    expect(molesPerGram({ mw: 60.05 }).missing).toEqual(["purity"]);
    expect(molesPerGram({ purity: 99.7 }).missing).toEqual(["mw"]);
    expect(molesPerGram({ concentration: 1 }).missing).toEqual(["density"]);
    expect(bottleMolarity({ mw: 60.05, purity: 99.7 })).toEqual({ value: null, missing: ["density"] });
    const r = acidRecipe({ ...SETUP, reagent: { mw: 60.05 } });
    expect(r.acidG).toBeNull();
    expect(r.missing).toEqual(["purity"]);
    expect(r.conc).toBeCloseTo(6.754e-4, 7);
  });

  it("a molarity reagent: moles per gram = M / (density x 1000); same mass as the wt% reagent of the same strength", () => {
    // 17.42 M acetic acid stock with its density is the same stuff as 99.7 wt%
    const M = bottleMolarity(ACETIC).value!;
    const viaM = molesPerGram({ concentration: M, density: 1.049 });
    expect(viaM.basis).toBe("concentration");
    expect(viaM.value!).toBeCloseTo(molesPerGram(ACETIC).value!, 10);
    const r = acidRecipe({ ...SETUP, reagent: { concentration: M, density: 1.049 } });
    expect(r.acidG! * 1000).toBeCloseTo(1.2205, 4);
    expect(bottleMolarity({ concentration: 1, density: 1.0 }).value).toBe(1);
  });

  it("purity and concentration together is a conflict", () => {
    const r = acidRecipe({ ...SETUP, reagent: { ...ACETIC, concentration: 1 } });
    expect(r.problems).toContain("conflict");
    expect(r.acidG).toBeNull();
  });
});
