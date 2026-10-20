# Thinking: how plots should fit the lab notebook

_Written 2026-10-21 (think piece only: no plugin code, nothing built, nothing tried in Obsidian). Follows `docs/plans/plots-from-tables-research.md` (existing chart plugins, a Lab Kit `plot` block). Owner, chat 2026-10-21: "I would normally plot in Python or Origin. These are obviously powerful, so I don't know how well they would translate to a plugin. I would be plotting NMR spectra, conversion based on these stacked spectra, GPC traces and conversion / Mw based on these, DLS traces and stacked data for size, etc. Let's have a think about it at least. I know there is an NMR plotter in already."_

How to read the tags (as in the verifiable-claims rule; this note is **not** entered in the claims register, so every tag is **unreviewed**):
- **reported** = read in a named file of this repository or on a named web page on 2026-10-21.
- **derived** = measured by the script in section 8 (`D-P1`), on made-up data.
- **(interpretation)** = my reading or general chemistry / software knowledge that I did not check against a source today. Numbers marked "typical, not measured" are of this kind: ranges to give a feel, not facts to quote.
- **decision** = something the owner has decided (with the source).

## Short answer
- **Keep plotting spectra and traces in Python or Origin.** Lab Kit's job is to put the figure in the note and to write down *how it was made* (script, data files, versions, fingerprints), so the figure can be checked and made again (route A).
- **Later, Lab Kit can draw the simple plots** whose numbers already sit in a table in the note (conversion vs time, ln([M]0/[M]) vs t, Mn and Đ vs conversion, size vs time) as a small `plot` block (route B, already scoped in the research note).
- **Not now: Lab Kit reading raw instrument files** and drawing stacked spectra with processing (route C). That is what MestReNova, TopSpin and Origin are for; a plugin version is a large project. A small "quick look" overlay from CSV exports, with no processing, could make sense later.
- **Vault size:** a line-plot PNG is small; a full-resolution SVG of a 64k-point spectrum is not (about 0.8 MB each, 7.8 MB for ten stacked, derived D-P1). Raw data stays in the data folder outside the vault.
- (All of this is interpretation; the questions at the end are the owner's to answer.)

## 0. "I know there is an NMR plotter in already"
I could not find an NMR plotter in Lab Kit (reported: a search of `src/`, `kits/`, `scripts/` and `docs/` for "plotter", "spectrum", "spectra", "JCAMP", "MestReNova" found nothing about plotting; the only hits for "spectrum" are in `docs/plans/rig-figure.md`, which is about the rig drawing). What Lab Kit has for NMR is the **NMR sample table** (Alt+S → NMR): columns Run #, Sample, Solvent (default CDCl3), Method (default 1H), Conversion (%), Notes, a `Dataset:` line and a checklist (reported, `kits/lab/Extras/scripts/templater/labMethods.js:105-108`). It records values, it draws nothing.
The test vault has no plotting plugin either (reported: its plugins folder holds css-editor, dataview, lab-kit, literature-feed, notebook-navigator, meta-bind, view-mode-by-frontmatter, omnisearch, templater, zotlit). I cannot look in the owner's real vault (project rule).
Where the plotter might be (question Q1 below): an Obsidian plugin in the real vault; MestReNova or TopSpin (they plot and stack spectra themselves); an Origin template; a Python script (for example one using a library such as nmrglue); a colleague's or the group's tool.

## 1. What each kind of data is
Everything in this section is (interpretation) from general knowledge of the instruments, not checked against a manual today. Sizes and point counts are **typical, not measured**; they vary a lot with the instrument and settings.

### What Lab Kit records today (reported)
| Snippet table | Columns | Where the numbers come from |
|---|---|---|
| NMR (`labMethods.js:105`) | Run #, Sample, Solvent, Method, Conversion (%), Notes; a `Dataset:` line | Conversion typed by hand from integrals worked out in the NMR software |
| GPC (`labMethods.js:109`) | Sample, Eluent, Mn (g/mol), Mw (g/mol), Đ (= Mw / Mn, a calc formula), Notes | Mn and Mw typed by hand from the GPC software's report; Đ calculated in the table |
| DLS (`labMethods.js:113`) | Sample, Solvent / dispersant, Temp (°C), Dh (nm), PDI, Notes | Typed by hand from the DLS software's report |
| Combined results (`kits/lab/Templates/Snippets/10 Combined results.md`) | One row per sample code, pulling NMR conversion, GPC Mn / Mw / Đ, DLS Dh / PDI | Looked up from the tables above (`docs/snippet-syntax.md` line 11) |
| Sampling timetable (`06 Sampling timetable.md`) | Sample codes and times | Planned or typed |

So the notebook already holds the **derived numbers per sample** (one conversion, one Mn, one Dh...). It does not hold the traces or spectra they came from; those live in the instrument's files (the `Dataset:` line names where, for NMR).

### NMR
- **Raw:** the FID (free induction decay), written by the spectrometer software (for example Bruker TopSpin: a folder per experiment with `fid` and parameter files). Typically 16k to 64k complex points for a 1H spectrum (typical, not measured). Raw data is a few hundred KB per experiment (typical, not measured).
- **Processed:** after Fourier transform, phasing, baseline correction and referencing: a real spectrum of typically 32k to 128k points (Bruker writes it as a binary file in the `pdata` folder). Exports: JCAMP-DX (a text standard, several dialects), CSV or text (ppm, intensity) from MestReNova or TopSpin, or the software's own project file.
- **Integrals:** areas over chosen ppm ranges, relative to a reference peak. This is a **choice** (which peaks, which limits, which reference) made in the software.
- **Conversion:** derived from integrals, for example monomer vinyl peaks against an internal standard or the polymer peak. This is the number in the NMR table.
- **Kinetics:** a series of spectra over time (one per sample code from the Sampling timetable), shown **stacked**; from each, a conversion; from those, ln([M]0/[M]) against time, whose slope is the apparent rate constant.
- **Derived vs raw:** FID = raw; processed spectrum = derived (by processing settings); integrals and conversion = derived (by choices); kinetics plot and slope = derived from derived.

### GPC / SEC
- **Raw:** detector signal(s) against time or elution volume: refractive index (RI), often UV, sometimes light scattering (MALS) and viscometer. A run of 20 to 60 min sampled at a few points per second gives thousands to tens of thousands of points per detector (typical, not measured). Exported as CSV or text from the vendor software (Agilent, Malvern / OmniSEC, Waters, Shimadzu, and others).
- **Calibration:** a curve of log(molar mass) against elution volume from standards (polystyrene, PMMA...). Mn, Mw and Đ depend on it: they are "relative to PS standards" unless an absolute detector (MALS) is used.
- **Derived:** the molar-mass distribution (trace converted with the calibration), Mn, Mw, Đ = Mw / Mn, and peak Mp. These are the GPC table's numbers.
- **Plots the owner named:** overlaid traces (normalised, against elution time or log M), and Mn / Đ against conversion (one point per sample, joining the GPC and NMR tables by sample code: Combined results already does that join).

### DLS
- **Raw:** the intensity autocorrelation function against delay time, typically a hundred to a few hundred delay points per measurement, several repeat measurements per sample (typical, not measured). Count rate and attenuator are also recorded.
- **Derived:** the cumulants fit gives the **Z-average** hydrodynamic diameter and the **PDI** (the DLS table's Dh and PDI); a distribution fit gives size distributions by intensity, volume or number (often around 70 bins on a log scale; typical, not measured). The distribution depends on the fit model and is easy to over-read (interpretation).
- **Plots the owner named:** correlation curves overlaid, size distributions stacked (by sample or time), and Dh against time or temperature (one point per measurement).

### The pattern (interpretation)
Each technique has three layers:
1. **Raw instrument data**: large, binary or vendor format, lives with the instrument software and the data folder.
2. **Processed curves**: spectra, traces, distributions: thousands of points, made with choices (phasing, baseline, calibration, fit model).
3. **Numbers per sample**: conversion, Mn, Mw, Đ, Dh, PDI: a handful of values, already in Lab Kit tables.

Plots of layer 3 are simple x-y plots of a small table. Plots of layer 2 are the heavy ones (stacking, thousands of points, reversed ppm axis, normalisation). Layer 1 is only read by specialist software.

## 2. Three routes

### A. Keep plotting in Python / Origin; Lab Kit links the figure and records how it was made
**What it is:** the owner makes the figure as now. The figure file and the data go to the experiment's **data folder** (outside the vault: `<data root>/<note name>`, which the header's Open data folder button makes and opens; desktop only, reported `src/kit/datafolder.ts`). The note gets a small picture (a preview) and a short **figure record**: what made it, from what, with fingerprints.

A figure record, made-up values, in the note under the picture:
```markdown
![[0016 kinetics.png]]
- Figure format: 1
- Figure: kinetics, ln([M]0/[M]) vs t · file 0016 kinetics.svg (data folder) · sha256 3b9e1c0a77d2…
- Made by: scripts/kinetics.py · commit 7c41e0b2a9f1 · clean tree: yes · Python 3.12.4
- Data: nmr/ABC0016-*.csv, 8 files · manifest sha256 9a10f4e2c6b1…
- Integrals: vinyl 5.4–6.3 ppm vs internal standard 6.9–7.1 ppm [decision · Lab member A]
- Result: kapp = 0.021 min⁻¹ [derived · kinetics.py] · first-order up to 3 h [interpretation · Lab member A]
- Re-run: python kinetics.py --check (rebuilds the figure, compares the fingerprints)
```
This is the in-silico helper idea (`docs/plans/in-silico-note.md`, PARKED: one stand-alone standard-library Python file, called in one line at the end of a script, writes the facts the computer knows, `not recorded` for anything it cannot read) applied to wet-lab analysis: the analysis script is the "run", the instrument exports are the inputs, the figure is the output (interpretation).

- **Pros:** the owner keeps full-strength tools (Origin and Python can do anything a paper needs); nothing new to learn; Lab Kit work is small and mostly text; the figure becomes **verifiable** (which script, which data, which version) instead of a loose picture; the same record works for figures made by an agent.
- **Cons:** the figure in the vault is a picture, not live: if a sample is re-measured, the script must be run again; Origin made by hand (clicking) is recorded but not re-runnable (only the project file's fingerprint and the Origin version can be written; interpretation); the data folder is not on the phone, so the phone sees only the preview.
- **Effort (estimate, interpretation):** a typed-by-hand version (an Alt+S snippet "Figure record" that asks for the file and fills the lines) is about one session; the helper that writes the record from Python is the in-silico Phase 1 work (one session) plus a figure mode; hashing a file inside the vault from Lab Kit is easy, hashing a file in the data folder is desktop only.

### B. A Lab Kit `plot` block for the simple, derived plots
**What it is:** the `plot` block of `docs/plans/plots-from-tables-research.md` section 4: a few lines of plain text naming a table in the note and two columns, drawn by Lab Kit as an SVG picture, redrawn when the table changes, no image file saved unless asked. Fits layer 3: conversion vs time (Sampling timetable + NMR table), ln([M]0/[M]) vs t with a fitted line, Mn and Đ vs conversion (Combined results), Dh vs time.
- **Pros:** the numbers stay in one plain table (the block is only a recipe; without the plugin the table is still readable, reported research note section 5); updates as soon as a value is typed; no image in the vault; good for watching a reaction while it runs.
- **Cons:** not a paper figure (Origin will still make that, interpretation); one more feature to keep correct and stable (the format-version rule applies, reported `docs/decisions.md` 2026-10-20 GENERAL RULE); whether it prints in the closed-experiment PDF is not known until tried.
- **Effort (estimate from the research note, interpretation there):** 2 to 3 sessions for a first useful version, 5 to 6 for the full list.

### C. Lab Kit plots raw instrument exports directly
**What it is:** Lab Kit reads CSV, JCAMP-DX or Bruker processed files and draws stacked spectra, GPC overlays and DLS distributions itself.

Why this is a big project (interpretation): each item below is a feature that MestReNova, TopSpin or Origin has spent years on.
- **Readers:** Bruker binary processed data (byte order, scaling, parameter files), JCAMP-DX (several compression forms), each GPC vendor's CSV layout, each DLS export; every reader needs test files and breaks when a vendor changes its export.
- **Drawing:** a reversed ppm axis, stacking with offsets, overlays with a legend, normalisation (to the highest peak, to a chosen peak, to area), zoom into a region, axis breaks.
- **Processing:** phasing, baseline correction, referencing, integration, peak picking, calibration for GPC, fit models for DLS. If Lab Kit did any of these, its numbers would compete with the instrument software's and a second set of choices would need recording.
- **Size and speed:** tens of thousands of points per curve, ten or more curves, on a phone; must be downsampled for drawing (section 3).
- **Store and safety:** a plugin that reads binary files and draws large data is more to review and to keep working across Obsidian updates.

A **minimal subset that could be sensible later** (interpretation): a "quick look" block that reads already-processed CSV exports (ppm or time, intensity) from a folder, downsamples each curve, and draws them stacked or overlaid with a reversed axis option, a ppm window and "normalise to highest point". No processing, no integrals, no peak picking; the numbers still come from the instrument software. It would reuse B's drawing engine. Effort (guess, interpretation): 2 to 4 sessions on top of B. The CSV files would have to be inside the vault (or the block would be desktop only, reading the data folder), which brings the size question back.

### Side by side (interpretation)
| | A: Python / Origin + record | B: `plot` block (tables) | C: Lab Kit reads raw exports |
|---|---|---|---|
| Fits | spectra, traces, distributions, paper figures | per-sample numbers already in tables | quick look at curves (subset only) |
| Live while typing | no | yes | yes, from files |
| Verifiable | yes, through the record | yes: table + block text | yes, but processing choices sit elsewhere |
| On the phone | preview only | yes | only if the files are in the vault |
| Vault growth | one small preview per figure | none | the CSVs, unless desktop only |
| Effort | about 1 to 2 sessions | 2 to 3 first version | large; subset 2 to 4 after B |
| Risk | low | scope creep (contained by the research note's in / out list) | high: readers, processing, upkeep |

## 3. Vault size
- **Why images fill a vault (interpretation):** photos and screenshots are often MB each; figures exported at high resolution or in colour with smooth lines are larger than plain line art; every re-made version is kept (and Obsidian Sync keeps version history); nothing ever leaves.
- **Measured on a made-up 64k-point spectrum** (derived, D-P1, section 8; a 1600 × 1000 picture):

| Form | Size |
|---|---|
| CSV export (ppm, intensity) | 1330 KB |
| SVG, every point, 1 decimal | 788 KB (916 KB with 2 decimals) |
| SVG, downsampled to 3,200 points (min and max per pixel column) | 39 KB |
| 10 stacked spectra, SVG, every point | 7,813 KB |
| 10 stacked spectra, SVG, downsampled | 382 KB |
| PNG, greyscale, one spectrum, no smoothing, no text | 7 KB |
| PNG, greyscale, 10 stacked, no smoothing, no text | 8 KB |

  What this says (interpretation): **a full-resolution SVG of a spectrum is the big one**, because it stores every point as text; a PNG of a line plot is small because it stores pixels, and a line plot is mostly white. The PNG here is a lower bound: a real Origin or matplotlib PNG has smooth (anti-aliased) lines, colour, text and often 300 dpi, so it is larger (typically tens to a few hundred KB, not measured). Downsampling (keeping the highest and lowest point per pixel column, so no peak is lost at that size) makes an SVG small enough for the vault.
- **Obsidian Sync limits** (reported, https://obsidian.md/help/sync/plans, read 2026-10-21): Sync Standard: 1 GB in total, 5 MB per file, 1 month of version history; Sync Plus: 10 GB to 100 GB, 200 MB per file, 12 months. The owner's vault is on Obsidian Sync (reported, `docs/decisions.md` 2026-10-20 SDS line); the plan is not recorded here. A ten-spectrum full-resolution SVG (7.8 MB) would be over the Standard plan's per-file cap (derived D-P1 against the reported limit). Whether version history counts toward the total was not read.
- **Where things should live (interpretation):** raw files, exports and master figures in the **data folder** (outside the vault, already supported by the header button; for example on Google Drive); the vault holds the preview, the record with fingerprints, and the tables. The fingerprint in the note pins the data-folder files without copying them.

## 4. Verifiability
The owner's principles (reported, `docs/decisions.md` 2026-10-20): plain text, flat, recoverable without the plugin; claims tagged reported / derived / interpretation / decision.

What this means for a figure (interpretation):
- **A figure in a closed experiment should carry what made it.** Close experiment fingerprints the note's text (`closed_hash`, reported in `docs/plans/in-silico-note.md` section 1c, `src/close/mark.ts`), not the embedded image files. So the record must hold the figure file's sha256 and the data files' sha256; then the closed hash pins them indirectly, as the in-silico Run table pins run files.
- **Tag the numbers, not only the figure.** "kapp = 0.021 min⁻¹ [derived · kinetics.py]" can be checked; "first-order up to 3 h [interpretation · who]" is honest about being a reading; the integration limits are a [decision · who].
- **Re-runnable beats described.** A Python script plus data plus version can be run again (`--check`); a hand-made Origin figure can only be described (Origin version, project file fingerprint) and should be labelled so (interpretation).
- **Recoverable without Lab Kit.** The record is plain `- Label: value` lines; the preview is a normal image embed; the data folder is normal files. Nothing needs the plugin to be read.
- **Route B plots are verifiable by construction** (the block names the table; one copy of the numbers; research note section 5). Route C would add a second place where processing choices are made, which is harder to record.

## 5. Recommendation (interpretation)
1. **Now: route A.** Keep Python and Origin. Agree what a **figure record** holds and where the files go (Q3 to Q5). Start with the typed-by-hand Alt+S version or the helper, as the owner prefers; the helper is the parked in-silico helper with a figure mode, so it is best done together with that work when it is resumed.
2. **Later: route B** for the per-sample plots (conversion vs time, ln([M]0/[M]) vs t, Mn and Đ vs conversion, size vs time), following the research note's plan and its own questions (BACKLOG "Plots from tables").
3. **Not now: route C.** Revisit the "quick look" CSV overlay only if, after A and B, the owner still wants to see curves in the note without opening Origin.

## 6. Open questions for the owner (multiple choice, recommendation marked; also in BACKLOG "Questions for the owner": "Lab plots: approach")
- **Q1 The NMR plotter you mentioned: where is it?** (a) an Obsidian plugin in your vault (which?) / (b) MestReNova or TopSpin / (c) a Python script of yours (where?) / (d) Origin / (e) a colleague's or the group's tool. No recommendation: a fact only you know.
- **Q2 Overall approach:** (a, rec) A now for spectra and traces, B later for the table plots, C not now / (b) A only / (c) A and B both now / (d) A now plus the C "quick look" CSV overlay.
- **Q3 Where the figure files go:** (a, rec) master figure (SVG or PNG) and data in the data folder; a small preview image in the vault, embedded in the note / (b) everything in the data folder, the note only links (no picture on the phone or in the closed PDF) / (c) everything in the vault.
- **Q4 How the figure record is written:** (a, rec) a small helper you call at the end of your Python script (the parked in-silico helper with a figure mode), pasted with Alt+S / (b) an Alt+S snippet that asks for the files and fills the lines by hand / (c) just a caption and a link, no record.
- **Q5 Figures made by hand in Origin:** (a, rec) record the Origin version and the project file's fingerprint, labelled "not re-runnable" / (b) move plots whose numbers matter to Python scripts / (c) no record for Origin figures.
- **Q6 The preview image in the vault:** (a, rec) PNG at screen resolution (small for line plots, shows on every device; whether it prints in the closed PDF is not tried) / (b) a downsampled SVG (sharp at any zoom, about 40 KB per spectrum, D-P1) / (c) no preview.

## 7. Not known
- Where the owner's "NMR plotter" is (Q1).
- Real file sizes of the owner's instrument exports and Origin / matplotlib figures: section 3 uses made-up data only.
- Which Obsidian Sync plan the vault uses; whether version history counts toward the storage total.
- Whether an embedded PNG or SVG from the data-folder workflow prints in the closed-experiment PDF (not tried).
- Section 1's point counts and file sizes: general knowledge, not checked against instrument manuals.
- All effort numbers are estimates.

## 8. Re-runnable check (derived)
**D-P1, file sizes of a made-up spectrum** (standard library only; made-up Lorentzian peaks plus noise, fixed seed; not an instrument file). Save as `plot_sizes.py` anywhere and run `python3 -I plot_sizes.py`. Result 2026-10-21 (Python 3.14.8, macOS): the table in section 3.
```python
"""D-P1: file sizes of one made-up 64k-point spectrum as CSV, SVG (full and downsampled) and PNG."""
import random, zlib, struct
random.seed(1)
N, W, H = 65536, 1600, 1000
peaks = [(7.26, 0.3, 0.004), (6.1, 1.0, 0.003), (5.6, 1.0, 0.003), (4.2, 2.0, 0.004), (3.7, 3.0, 0.004), (1.9, 3.0, 0.005), (0.9, 2.5, 0.004)]
x = [12 - 13 * i / (N - 1) for i in range(N)]                      # ppm, 12 to -1
def spec(shift):
    return [sum(h * w * w / ((xi - p - shift) ** 2 + w * w) for p, h, w in peaks) + random.gauss(0, 0.002) for xi in x]
y = spec(0)
def csv(xs, ys): return "ppm,intensity\n" + "".join(f"{a:.6f},{b:.6g}\n" for a, b in zip(xs, ys))
def px(xs, ys, top=0.0, height=H):
    lo, hi = min(ys), max(ys)
    return [((12 - a) / 13 * W, top + height - (b - lo) / (hi - lo) * height) for a, b in zip(xs, ys)]
def poly(pts, d): return '<polyline fill="none" stroke="#000" stroke-width="1" points="' + " ".join(f"{a:.{d}f},{b:.{d}f}" for a, b in pts) + '"/>'
def svg(polys): return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">' + "".join(polys) + "</svg>"
def minmax(xs, ys, cols=W):                                          # keep min and max per pixel column
    out = []; step = len(xs) / cols
    for c in range(cols):
        a, b = int(c * step), int((c + 1) * step)
        seg = range(a, b); i1 = min(seg, key=lambda i: ys[i]); i2 = max(seg, key=lambda i: ys[i])
        out += [(xs[i], ys[i]) for i in sorted({i1, i2})]
    return [p[0] for p in out], [p[1] for p in out]
def png(pts_list):
    img = bytearray(b"\xff" * (W * H))
    for pts in pts_list:
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
            for k in range(n + 1):
                t = k / n; xi = int(x0 + (x1 - x0) * t); yi = int(y0 + (y1 - y0) * t)
                if 0 <= xi < W and 0 <= yi < H: img[yi * W + xi] = 0
    raw = b"".join(b"\x00" + bytes(img[r * W:(r + 1) * W]) for r in range(H))
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 0, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
kb = lambda s: f"{len(s.encode() if isinstance(s, str) else s) / 1024:.0f} KB"
dx, dy = minmax(x, y)
print("points full / downsampled:", N, len(dx))
print("CSV full:", kb(csv(x, y)))
print("SVG full, 2 decimals:", kb(svg([poly(px(x, y), 2)])))
print("SVG full, 1 decimal:", kb(svg([poly(px(x, y), 1)])))
print("SVG downsampled, 1 decimal:", kb(svg([poly(px(dx, dy), 1)])))
stack = [spec(0.002 * k) for k in range(10)]                         # 10 stacked spectra
band = H / 10
full10 = [px(x, s, top=k * band, height=band) for k, s in enumerate(stack)]
down10 = [px(*minmax(x, s), top=k * band, height=band) for k, s in enumerate(stack)]
print("10 stacked, SVG full, 1 decimal:", kb(svg([poly(p, 1) for p in full10])))
print("10 stacked, SVG downsampled, 1 decimal:", kb(svg([poly(p, 1) for p in down10])))
print("PNG 1600x1000 grey, one spectrum (no anti-aliasing, no text):", kb(png([px(x, y)])))
print("PNG 1600x1000 grey, 10 stacked (no anti-aliasing, no text):", kb(png(full10)))
```
Limits of this check: made-up data; the PNG writer has no smoothing, colour, axes or text, so real PNGs are larger; the SVGs have no axes or text (a few KB more).

## 9. Sources
- In this repository: `docs/plans/plots-from-tables-research.md`, `docs/plans/in-silico-note.md`, `docs/decisions.md` (2026-10-20 GENERAL RULE for live blocks; rig data-integrity line; SDS line on Obsidian Sync), `src/kit/datafolder.ts`, `kits/lab/Extras/scripts/templater/labMethods.js` (built-in NMR, GPC, DLS tables), `kits/lab/Templates/Snippets/`, `docs/snippet-syntax.md`.
- https://obsidian.md/help/sync/plans (read 2026-10-21 through a fetch summary).
