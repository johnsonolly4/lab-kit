#!/usr/bin/env python3
"""Known answers for SLOPE, INTERCEPT, RSQ, STDEV (Excel rules), 10 significant figures.
Re-run: python3 scripts/calc_stats_known_answers.py
Pairs where either value is blank/text are dropped pairwise (SLOPE/INTERCEPT/RSQ);
STDEV (sample, n-1) skips blanks/text."""
import math, statistics

def pairs(ys, xs):
    return [(y, x) for y, x in zip(ys, xs) if isinstance(y, (int, float)) and isinstance(x, (int, float))]

def fit(ys, xs):
    p = pairs(ys, xs)
    n = len(p)
    my = sum(y for y, _ in p) / n
    mx = sum(x for _, x in p) / n
    sxx = sum((x - mx) ** 2 for _, x in p)
    syy = sum((y - my) ** 2 for y, _ in p)
    sxy = sum((x - mx) * (y - my) for y, x in p)
    slope = sxy / sxx
    return slope, my - slope * mx, sxy * sxy / (sxx * syy)

SETS = {
    "perfect line y=2x+1": ([3, 5, 7, 9, 11], [1, 2, 3, 4, 5]),
    "noisy": ([2.1, 3.9, 6.2, 7.8, 10.1, 12.2], [1, 2, 3, 4, 5, 6]),
    "blank cell pairs": ([1.5, None, 4.4, 6.1, "n/a", 9.8], [1, 2, 3, 4, 5, 6]),
}
for name, (ys, xs) in SETS.items():
    s, i, r = fit(ys, xs)
    sd = statistics.stdev([v for v in ys if isinstance(v, (int, float))])
    print(f"{name}: SLOPE={s:.10g} INTERCEPT={i:.10g} RSQ={r:.10g} STDEV(y)={sd:.10g}")
