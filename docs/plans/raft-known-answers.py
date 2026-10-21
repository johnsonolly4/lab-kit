"""Known answers for the ```raft live block (Templater plan Phase 9). Derived, re-runnable: python3 docs/plans/raft-known-answers.py
Inputs of fixture 0005 (tests/snippets.test.ts RAFT part; MW from the chemical notes). Written before src/blocks/raft/ was coded.
Formulas (the old generator's, labSnippets.js raft()): mean MW = sum(MW_i f_i) / sum(f_i); n monomer = mass / mean MW; n_i = n * f_i / sum(f);
n CTA = n / DP; n initiator = n CTA / ratio; solids = monomers + CTA + initiator masses; solvent = solids (100 / solids% - 1);
co-solvent = solvent * pct / 100 (outside the solids); Mn = DP * mean MW + MW CTA.
From what is weighed (actual, else the target): Mn = sum(monomer g) / (CTA g / MW CTA) + MW CTA; DP = sum(monomer mol) / CTA mol;
solids % = (monomers + CTA + initiator) / (that + solvent) * 100."""

def targets(mons, mw_cta, mw_init, mass, dp, ratio, solids, cosolvent_pct=None):
    f_sum = sum(f for _, _, f in mons)
    mean = sum(mw * f for _, mw, f in mons) / f_sum
    n = mass / mean
    out = {"mean": mean, "n": n}
    out["mons"] = [(name, n * f / f_sum, n * f / f_sum * mw) for name, mw, f in mons]
    n_cta = n / dp; n_i = n_cta / ratio
    out["cta"] = (n_cta, n_cta * mw_cta); out["init"] = (n_i, n_i * mw_init)
    solid = mass + n_cta * mw_cta + n_i * mw_init
    out["solid"] = solid; out["solvent"] = solid * (100 / solids - 1)
    if cosolvent_pct is not None: out["cosolvent"] = out["solvent"] * cosolvent_pct / 100
    out["mn"] = dp * mean + mw_cta
    return out

def weighed(t, mons, mw_cta, a_mons, a_cta, a_solvent, a_init=None):
    m_g = sum(a if a is not None else g for (_, _, g), a in zip(t["mons"], a_mons))
    n_m = sum((a if a is not None else g) / mw for (name, mw, _), (_, _, g), a in zip(mons, t["mons"], a_mons))
    cta = a_cta if a_cta is not None else t["cta"][1]
    init = a_init if a_init is not None else t["init"][1]
    sol = a_solvent if a_solvent is not None else t["solvent"]
    n_cta = cta / mw_cta
    return {"dp": n_m / n_cta, "mn": m_g / n_cta + mw_cta, "solids": (m_g + cta + init) / (m_g + cta + init + sol) * 100}

# 0005: DAAm 2.5 g, DP 105, PDMA 76 macro-CTA (2220.99), VA-044 (323.33), CTA:I 20, 20 % solids in water
daam = [("DAAm", 169.23, 1)]
t = targets(daam, 2220.99, 323.33, 2.5, 105, 20, 20)
print("0005 targets: DAAm %.4f g %.5f mmol | CTA %.5f g %.5f mmol | VA-044 %.5f g %.6f mmol | solids %.5f g | water %.5f g | Mn %.4f"
      % (t["mons"][0][2], t["mons"][0][1] * 1e3, t["cta"][1], t["cta"][0] * 1e3, t["init"][1], t["init"][0] * 1e3, t["solid"], t["solvent"], t["mn"]))
assert abs(t["mn"] - 19990.14) < 1e-6 and abs(t["cta"][1] - 0.3125) < 1e-3 and abs(t["solvent"] - 11.259) < 1e-3
w = weighed(t, daam, 2220.99, [2.5012], 0.3131, 11.2630)
print("0005 weighed (2.5012 g, 0.3131 g, 11.2630 g, initiator at target): DP %.4f Mn %.3f solids %.4f %%" % (w["dp"], w["mn"], w["solids"]))

# three monomers, mole fractions 1/3 each (the old test: masses add up to 2.5 g, Mn = 105 mean + 238.39)
three = [("DMAm", 99.13, 1), ("DAAm", 169.23, 1), ("Lipoic Acid", 206.32, 1)]
t3 = targets(three, 238.39, 323.33, 2.5, 105, 20, 20)
print("three monomers: mean %.6f | masses %s | sum %.6f | Mn %.4f" % (t3["mean"], ["%.6f" % g for _, _, g in t3["mons"]], sum(g for _, _, g in t3["mons"]), t3["mn"]))

# co-solvent 20 % of the solvent's mass
tc = targets(daam, 2220.99, 323.33, 2.5, 105, 20, 20, 20)
print("co-solvent: %.5f g (of water %.5f g)" % (tc["cosolvent"], tc["solvent"]))
