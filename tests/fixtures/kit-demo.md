---
Chemicals:
  - "[[Lipoic Acid]]"
  - "[[Benzyl alcohol]]"
  - "[[DCM]]"
cssclasses:
  - academia
  - academia-rounded
  - wide
---
# Kit demo v0.2

> [!tip] What to try here
> This note was made by running every v0.2 snippet once. Some numbers are filled in so you can see results.
> - Hover a table → **+ Row**, **A1**, **Copy** sit on the left, clear of the `</>` button.
> - Amber cells say what they **need**; the empty inputs they need are outlined.
> - Right-click a row → insert / delete. Add a row to **nmr** and watch **results** still find every sample.
> - MW values come from your chemical notes (needs an `MW` or `Mw` property on each).

## Solution 1
Made on: 2026-10-02

```calc
name: sol1
title: Solution 1
icon: test-tube
| Reagent | MW (g/mol) | Target (g) | Added (g) | mmol (added) | wt% (added) |
|---|---|---|---|---|---|
| [[Lipoic Acid]] | =MW(A2) | 1 | 1.0316 | =IF(D2="", "", D2/B2*1000) | =IFERROR(D2/SUM(D$2:D$4)*100, "") |
| [[Benzyl alcohol]] | =MW(A3) |  |  | =IF(D3="", "", D3/B3*1000) | =IFERROR(D3/SUM(D$2:D$4)*100, "") |
| [[DCM]] | =MW(A4) |  |  | =IF(D4="", "", D4/B4*1000) | =IFERROR(D4/SUM(D$2:D$4)*100, "") |
| **Total** |  | =SUM(C2:C4) | =SUM(D2:D4) |  |  |
```



## Recipe
```calc
name: recipe
title: Recipe by equivalents
icon: flask-round
| Reagent | Eq. | Relative to | MW (g/mol) | Set mmol | mmol | Mass (g) | Added (g) | wt% |
|---|---|---|---|---|---|---|---|---|
| [[Lipoic Acid]] | 1 |  | =MW(A2) | 10 | =IF(E2<>"", E2, XLOOKUP(C2, A$2:A$3, F$2:F$3)*B2) | =F2*D2/1000 |  | =IFERROR(G2/G$5*100, "") |
| [[Benzyl alcohol]] | 1 | Lipoic Acid | =MW(A3) |  | =IF(E3<>"", E3, XLOOKUP(C3, A$2:A$3, F$2:F$3)*B3) | =F3*D3/1000 |  | =IFERROR(G3/G$5*100, "") |
| [[DCM]] (rest) |  |  |  |  |  | =IF(G5="", 1/0, G5-SUM(G2:G3)) |  | =IFERROR(G4/G$5*100, "") |
| **Total** |  |  |  |  |  | 60 | =SUM(H2:H4) |  |
```



## RAFT recipe generator
```calc
name: raft
title: Targets
icon: flask-conical
| Parameter | Value |
|---|---|
| Total monomer mass (g) | 2.5 |
| Target DP | 105 |
| CTA : initiator | 20 |
| Solids (% w/w) | 20 |
| Total monomer (mol) | =IF(B2="", 1/0, B2/SUMPRODUCT(raft_r!C2:C2, raft_r!D2:D2)) |
| Theoretical Mn (g/mol) | =IF(B3="", 1/0, B3*SUMPRODUCT(raft_r!C2:C2, raft_r!D2:D2)+raft_r!C3) |
```

```calc
name: raft_r
title: Reagents
icon: flask-conical
| Role | Name | MW (g/mol) | Mol fraction | mol | Mass (g) | Used (g) |
|---|---|---|---|---|---|---|
| Monomer | [[DAAm]] | =MW(B2) | 1 | =raft!$B$6*D2 | =E2*C2 |  |
| CTA | PDMA 76 | 2220.99 |  | =raft!B6/raft!B3 | =E3*C3 |  |
| Initiator | [[VA-044]] | =MW(B4) |  | =E3/raft!B4 | =E4*C4 |  |
| Solvent | Water |  |  |  | =SUM(F2:F4)*(100/raft!B5-1) |  |
```

> [!tip] A CTA or macro-CTA without a chemical note: click its MW cell and type the number.


## Samples
```calc
name: samples
title: Samples
icon: list
copy: column A
| Code | Description | Notes |
|---|---|---|
| ABC0016-A |  |  |
| ABC0016-B |  |  |
| ABC0016-C |  |  |
```

## NMR samples
```calc
name: nmr
title: NMR samples
icon: magnet
copy: column B
| Run # | Sample | Solvent | Method | Conversion (%) | Notes |
|---|---|---|---|---|---|
| 1 | ABC0016-A | CDCl3 | 1H | 42 |  |
| 2 | ABC0016-B | CDCl3 | 1H |  |  |
| 3 | ABC0016-C | CDCl3 | 1H |  |  |
|  |  |  |  |  |  |
```

Dataset: Monty_2026_10_02

- [ ] Submitted
- [ ] Results processed
- [ ] Results saved

## GPC samples
```calc
name: gpc
title: GPC samples
icon: line-chart
copy: column A
| Sample | Eluent | Mn (g/mol) | Mw (g/mol) | Đ | Notes |
|---|---|---|---|---|---|
| ABC0016-A | THF |  |  | =IFERROR(D2/C2, "") |  |
| ABC0016-B | THF | 10000 | 12000 | =IFERROR(D3/C3, "") |  |
| ABC0016-C | THF |  |  | =IFERROR(D4/C4, "") |  |
```

- [ ] Submitted
- [ ] Results processed
- [ ] Results saved

## Results
```calc
name: results
title: Results by sample
icon: table
| Sample | Conversion (%) | Mn (g/mol) | Mw (g/mol) | Đ |
|---|---|---|---|---|
| ABC0016-A | =XLOOKUP(A2, nmr!B$2:B$5, nmr!E$2:E$5, "") | =XLOOKUP(A2, gpc!A$2:A$4, gpc!C$2:C$4, "") | =XLOOKUP(A2, gpc!A$2:A$4, gpc!D$2:D$4, "") | =XLOOKUP(A2, gpc!A$2:A$4, gpc!E$2:E$4, "") |
| ABC0016-B | =XLOOKUP(A3, nmr!B$2:B$5, nmr!E$2:E$5, "") | =XLOOKUP(A3, gpc!A$2:A$4, gpc!C$2:C$4, "") | =XLOOKUP(A3, gpc!A$2:A$4, gpc!D$2:D$4, "") | =XLOOKUP(A3, gpc!A$2:A$4, gpc!E$2:E$4, "") |
| ABC0016-C | =XLOOKUP(A4, nmr!B$2:B$5, nmr!E$2:E$5, "") | =XLOOKUP(A4, gpc!A$2:A$4, gpc!C$2:C$4, "") | =XLOOKUP(A4, gpc!A$2:A$4, gpc!D$2:D$4, "") | =XLOOKUP(A4, gpc!A$2:A$4, gpc!E$2:E$4, "") |
```


## Sampling timetable
```calc
name: sampling_start
title: Start
icon: timer
| Setting | Value |
|---|---|
| Start time (hh:mm) | 10:37 |
```

```calc
name: sampling
title: Sampling timetable
icon: timer
copy: column A
| Code | Time (min) | Target time | Taken at | Notes |
|---|---|---|---|---|
| ABC0016-A0 | 0 | =CLOCK(sampling_start!$B$2, B2) |  |  |
| ABC0016-A30 | 30 | =CLOCK(sampling_start!$B$2, B3) |  |  |
| ABC0016-A90 | 90 | =CLOCK(sampling_start!$B$2, B4) |  |  |
| ABC0016-B0 | 0 | =CLOCK(sampling_start!$B$2, B5) |  |  |
| ABC0016-B30 | 30 | =CLOCK(sampling_start!$B$2, B6) |  |  |
| ABC0016-B90 | 90 | =CLOCK(sampling_start!$B$2, B7) |  |  |
```

## DLS samples
```calc
name: dls
title: DLS samples
icon: sparkles
copy: column A
| Sample | Solvent | Temp (°C) | Dh (nm) | PDI | Notes |
|---|---|---|---|---|---|
| ABC0016-A0 | Water | 25 |  |  |  |
| ABC0016-A30 | Water | 25 |  |  |  |
| ABC0016-A90 | Water | 25 |  |  |  |
| ABC0016-B0 | Water | 25 |  |  |  |
| ABC0016-B30 | Water | 25 |  |  |  |
| ABC0016-B90 | Water | 25 |  |  |  |
```

- [ ] Submitted
- [ ] Results processed
- [ ] Results saved


## NMR samples
```calc
name: nmr2
title: NMR samples
icon: magnet
copy: column B
| Run # | Sample | Solvent | Method | Conversion (%) | Notes |
|---|---|---|---|---|---|
| 1 | ABC0016-A | CDCl3 | 1H |  |  |
| 2 | ABC0016-B | CDCl3 | 1H |  |  |
| 3 | ABC0016-C | CDCl3 | 1H |  |  |
```

Dataset: Monty_2026_10_02

- [ ] Submitted
- [ ] Results processed
- [ ] Results saved


## Variant naming matrix
```calc
name: variants
title: Variant naming matrix
icon: grid-3x3
copy: list
|  | Benzyl alcohol | Methanol |
|---|---|---|
| **Lipoic acid** | ABC0016-A | ABC0016-B |
| **Acetic acid** | ABC0016-C | ABC0016-D |
```



## Column prep
```calc
name: column
title: Column weighing
icon: cylinder
| State | Value |
|---|---|
| Empty column (blanking plugs, glass wool) (g) | 111.076 |
| Packed column (beads, plugs, glass wool) (g) | 111.967 |
| Packed + full of solvent (g) | 114.576 |
| Solvent density (g/mL) | 1.325 |
| End-fitting dead volume (mL) | 0.21 |
| Mass of beads (g) | =B3-B2 |
| Mass of solvent (g) | =B4-B3 |
| Solvent volume (mL) | =B8/B5 |
| Reactor volume (mL) | =B9-B6 |
```


## Residence times
$$\tau = \frac{V_{\text{reactor}}}{Q}$$

```calc
name: rt_in
title: Reactor
icon: waves
| Setting | Value |
|---|---|
| Reactor volume (mL) | =column!B10 |
```

```calc
name: rt
title: Flow rate for each residence time
icon: waves
| Residence time (min) | Flow rate (mL/min) | Time to steady state, 3 RTs (min) |
|---|---|---|
| 2 | =rt_in!$B$2/A2 | =A2*3 |
| 10 | =rt_in!$B$2/A3 | =A3*3 |
| 20 | =rt_in!$B$2/A4 | =A4*3 |
| 30 | =rt_in!$B$2/A5 | =A5*3 |
```


## GPC samples
```calc
name: gpc2
title: GPC samples
icon: line-chart
copy: column A
| Sample | Eluent | Mn (g/mol) | Mw (g/mol) | Đ | Notes |
|---|---|---|---|---|---|
| ABC0016-A | THF |  |  | =IFERROR(D2/C2, "") |  |
| ABC0016-B | THF |  |  | =IFERROR(D3/C3, "") |  |
| ABC0016-C | THF |  |  | =IFERROR(D4/C4, "") |  |
```

- [ ] Submitted
- [ ] Results processed
- [ ] Results saved


## DLS samples
```calc
name: dls2
title: DLS samples
icon: sparkles
copy: column A
| Sample | Solvent | Temp (°C) | Dh (nm) | PDI | Notes |
|---|---|---|---|---|---|
| ABC0016-A | Water | 25 |  |  |  |
| ABC0016-B | Water | 25 |  |  |  |
| ABC0016-C | Water | 25 |  |  |  |
```

- [ ] Submitted
- [ ] Results processed
- [ ] Results saved


## Results
```calc
name: results2
title: Results by sample
icon: table
| Sample | Conversion (%) | Mn (g/mol) | Mw (g/mol) | Đ | Dh (nm) | PDI |
|---|---|---|---|---|---|---|
| ABC0016-A | =XLOOKUP(A2, nmr!B$2:B$4, nmr!E$2:E$4, "") | =XLOOKUP(A2, gpc!A$2:A$4, gpc!C$2:C$4, "") | =XLOOKUP(A2, gpc!A$2:A$4, gpc!D$2:D$4, "") | =XLOOKUP(A2, gpc!A$2:A$4, gpc!E$2:E$4, "") | =XLOOKUP(A2, dls!A$2:A$7, dls!D$2:D$7, "") | =XLOOKUP(A2, dls!A$2:A$7, dls!E$2:E$7, "") |
| ABC0016-B | =XLOOKUP(A3, nmr!B$2:B$4, nmr!E$2:E$4, "") | =XLOOKUP(A3, gpc!A$2:A$4, gpc!C$2:C$4, "") | =XLOOKUP(A3, gpc!A$2:A$4, gpc!D$2:D$4, "") | =XLOOKUP(A3, gpc!A$2:A$4, gpc!E$2:E$4, "") | =XLOOKUP(A3, dls!A$2:A$7, dls!D$2:D$7, "") | =XLOOKUP(A3, dls!A$2:A$7, dls!E$2:E$7, "") |
| ABC0016-C | =XLOOKUP(A4, nmr!B$2:B$4, nmr!E$2:E$4, "") | =XLOOKUP(A4, gpc!A$2:A$4, gpc!C$2:C$4, "") | =XLOOKUP(A4, gpc!A$2:A$4, gpc!D$2:D$4, "") | =XLOOKUP(A4, gpc!A$2:A$4, gpc!E$2:E$4, "") | =XLOOKUP(A4, dls!A$2:A$7, dls!D$2:D$7, "") | =XLOOKUP(A4, dls!A$2:A$7, dls!E$2:E$7, "") |
```


```calc
name: calc1
icon: calculator
| Item | Value | Result |
|---|---|---|
|  |  |  |
|  |  |  |
|  |  |  |
```

