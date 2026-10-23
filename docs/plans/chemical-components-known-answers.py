"""Known answers for docs/plans/chemical-database-components.md (derived, unreviewed). Run: python3 -I -B docs/plans/chemical-components-known-answers.py

Method: each worked example of the plan as a few lines of plain arithmetic, standard library only, no files read or written.
Mass fractions are g per g of the material as weighed ("as is"). A component's own purity multiplies through (content is
recursive). Amount bases: w/w % = /100; ppm = 1e-6; mol/L = c * MW / (1000 * density of the mix, g/mL); w/v % = g per 100 mL
-> /(100 * density). Rounding only when printed (4 decimals for grams, 4 significant figures for fractions).
Kinetics: kd = exp(lnA - Ea / (R T)), t1/2 = ln 2 / kd, R = 8.314 J/(mol K), T in kelvin (273.15 + deg C).

By hand: (1) 0.22 * 0.66 = 0.1452 g pure C per g of A; 0.500 g / 0.1452 = 3.4435 g of A. (2) acid stock top-up
(0.300 - 5.000 * 0.02) / 0.10 = 2.000 g; water to add 20 - 5 - 2 - 4 = 9.000 g. (3) 10 g * 30e-6 = 0.30 mg MEHQ, 15 ppm of 20 g.
(4) 0.020 * 323.33 / 1000 / 1.00 = 0.006467 g/g; 3.00 mg / 6.467 mg/g = 0.4639 g of stock. (5) 1.500 / (0.62 * 0.95) = 2.5467.
(6) 100 / 0.635 = 157.48 mg. (7) 100 * (45/30 - 1) = 50 g water. (8) 2x2: a = 4.7143 g, b = 2.5714 g. (9) VA-044 t1/2 at 44 C
about 9.8 h (Wako: 10 h), at 70 C about 26 min. (10) solids 2.66 / 10 = 26.60 %. (11) Fox: 1 / (0.5/378 + 0.5/293) = 330.1 K.
(12) alligation 500 * 15/30 = 250 g of each.
"""
import math

def p(label, value, unit="", fmt="{:.4f}"):
    print(f"{label}: {fmt.format(value)} {unit}".rstrip())

# 1. Owner example: A = C 22 % w/w (C itself 66 % pure), D 5 %, E 0.5 %, X rest. Target 0.500 g of pure C.
c_in_a, c_purity = 0.22, 0.66
pure_c_per_g_a = c_in_a * c_purity
a_needed = 0.500 / pure_c_per_g_a
p("1 pure C per g A", pure_c_per_g_a, "g/g")
p("1 A to weigh for 0.500 g pure C", a_needed, "g")
p("1   brings D (5 %)", a_needed * 0.05, "g")
p("1   brings E (0.5 %)", a_needed * 0.005, "g")
p("1   brings X (rest 72.5 %)", a_needed * (1 - 0.22 - 0.05 - 0.005), "g")
p("1   brings C's own impurity (22 % x 34 %)", a_needed * 0.22 * 0.34, "g")

# 2. One ingredient from two sources: pre-mix P (surfactant 10 %, acetic acid 2 %, water rest) fixed at 5.000 g for its
#    surfactant; acid stock S (acetic acid 10 % in water) tops the acid up to 0.300 g; monomer 4.000 g; water q.s. to 20.000 g.
premix, acid_target, stock_frac = 5.000, 0.300, 0.10
stock = (acid_target - premix * 0.02) / stock_frac
water_add = 20.000 - premix - stock - 4.000
water_total = water_add + premix * (1 - 0.10 - 0.02) + stock * (1 - stock_frac)
p("2 acid stock to weigh", stock, "g")
p("2 water to add (q.s. to 20 g)", water_add, "g")
p("2 total water in the batch", water_total, "g")
p("2 acid wt% of batch", acid_target / 20 * 100, "%", "{:.2f}")
p("2 surfactant wt% of batch", premix * 0.10 / 20 * 100, "%", "{:.2f}")

# 3. Inhibitor arriving with a monomer: 10.000 g monomer at (at most) 30 ppm MEHQ in a 20.000 g batch.
mehq_mg = 10.000 * 30e-6 * 1000
p("3 MEHQ brought by 10 g monomer (max)", mehq_mg, "mg", "{:.2f}")
p("3 MEHQ in the 20 g batch (max)", 10.000 * 30e-6 / 20.000 * 1e6, "ppm", "{:.1f}")

# 4. A molarity stock: VA-044 0.020 mol/L in water, density taken as 1.00 g/mL, MW 323.33 (the RAFT fixture's value).
g_per_g = 0.020 * 323.33 / 1000 / 1.00
p("4 VA-044 per g of stock", g_per_g, "g/g", "{:.6f}")
p("4 stock to weigh for 3.00 mg VA-044", 0.00300 / g_per_g, "g")

# 4b. A w/v stock: 5 % w/v (5 g per 100 mL), density 1.02 g/mL.
p("4b 5 % w/v as w/w", 5 / 100 / 1.02, "g/g", "{:.5f}")

# 5. Dry-basis assay with loss on drying (inputs from the SG Systems glossary page): 1.500 kg active, 62 % dry basis, LOD 5 %.
p("5 as-received fraction", 0.62 * (1 - 0.05), "", "{:.3f}")
p("5 addition for 1.500 kg active", 1.500 / (0.62 * 0.95), "kg")

# 6. Salt form (Restek's example): parent fraction 63.5 / 100 = 0.635 by MW; 100 mg of parent.
p("6 salt to weigh for 100 mg parent", 100 / 0.635, "mg", "{:.2f}")

# 7. Dilute 100 g of a 45 % solids dispersion to 30 % solids (mass balance on solids).
p("7 water to add", 100 * (45 / 30 - 1), "g", "{:.1f}")

# 8. Two targets met by two pre-mixes at once (a 2x2 solve): P1 = surfactant 10 %, acid 2 %; P2 = surfactant 5 %, acid 8 %;
#    targets surfactant 0.600 g, acid 0.300 g.  0.10a + 0.05b = 0.6 ; 0.02a + 0.08b = 0.3
det = 0.10 * 0.08 - 0.05 * 0.02
a = (0.6 * 0.08 - 0.05 * 0.3) / det
b = (0.10 * 0.3 - 0.02 * 0.6) / det
p("8 P1", a, "g"); p("8 P2", b, "g")
p("8 check surfactant", 0.10 * a + 0.05 * b, "g"); p("8 check acid", 0.02 * a + 0.08 * b, "g")

# 9. Initiator half-life from the maker's Ea and ln A (FUJIFILM Wako VA-044 page: Ea 108.2 kJ/mol, ln A 30.19, in water).
R = 8.314
for t_c in (44, 70):
    kd = math.exp(30.19 - 108200 / (R * (273.15 + t_c)))
    print(f"9 VA-044 at {t_c} C: kd {kd:.3e} 1/s, half-life {math.log(2) / kd / 3600:.2f} h")

# 10. Solids at full conversion: monomer 2.500 g + CTA 0.150 g + initiator 0.010 g non-volatile, water 7.340 g.
p("10 solids", (2.500 + 0.150 + 0.010) / (2.500 + 0.150 + 0.010 + 7.340) * 100, "%", "{:.2f}")

# 11. Fox equation for a copolymer Tg: 1/Tg = w1/Tg1 + w2/Tg2; w = 0.5/0.5, Tg1 = 378 K, Tg2 = 293 K (illustrative values).
tg = 1 / (0.5 / 378 + 0.5 / 293)
p("11 Fox Tg", tg, "K", "{:.1f}")

# 12. Alligation (Pearson calculator page, seen as a search result): 500 g of 25 % from 10 % and 40 %.
lo, hi, t, total = 10, 40, 25, 500
p("12 of the 10 % stock", total * (hi - t) / (hi - lo), "g", "{:.1f}")
p("12 of the 40 % stock", total * (t - lo) / (hi - lo), "g", "{:.1f}")
