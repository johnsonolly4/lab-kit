# Research: plots from tables without saving image files

_Written 2026-10-21 by a research side session (no plugin code, nothing built, nothing installed or tried in Obsidian). Question from the owner (2026-10-21): "Any data we plot externally then add as an image is going to fill up the vault. How hard is figure rendering from a table? Does one exist?"_

How the facts were got (tags as in the verifiable-claims rule; this note is **not** entered in the claims register, so every tag below is **unreviewed**):
- **reported** = read on a web page on 2026-10-21 and paraphrased; the URL is given. A page summary made by the fetch tool is not a full read of the README; where the summary left something out it says "not stated".
- **derived** = measured on this machine by the command shown.
- **(interpretation)** = my reading, not a measured fact.
- **Not tried in Obsidian**: no plugin below was installed or run. Everything about what a plugin can draw comes from its store page or README, not from a test.

## 1. Short answer
1. **Does one exist?** Yes, several draw charts from a Markdown table or inline data in a note and save no image file. None is confirmed (by what I could read) to draw what a chemistry notebook needs in one go: **scatter with error bars, log axes, two y axes, overlays of runs, from a table**. Each is either stale, young and tiny, or only documents line/bar/pie.
2. **How hard for Lab Kit?** Moderate and well bounded. A `plot` block that reads one table and draws an SVG with the rig figure engine's habits is roughly **5 to 6 Sonnet sessions** for the full list below, **2 to 3** for a first useful version (scatter and line, error bars, axis labels, log axis, from a Lab Kit calc table or a Markdown table in the note) (interpretation, from the size of the rig engine: about 1100 lines of `src/rig/figure*.ts` and friends, derived by `wc -l`).
3. **Recommendation:** try one existing plugin on one real data set now (cost: an afternoon, no commitment, nothing in the vault but the table and the block), and in parallel agree the small `plot` spec with the owner. Build the Lab Kit block only if the trial shows the gap (error bars or log axis or SVG for a paper not met). Details in section 6.

## 2. Existing options

Platform and download figures are from the Obsidian community listing pages (`community.obsidian.md/plugins/<id>`), read 2026-10-21 (reported). "Last updated" is as the listing words it (relative to today); the exact dates were not shown.

| Option | Draws | Reads a table / CSV? | Source stays plain text? | Mobile | Maintenance (listing) | Export for papers | Licence | Fit for the lab |
|---|---|---|---|---|---|---|---|---|
| **Obsidian Charts** (phibr0, Chart.js) [listing](https://community.obsidian.md/plugins/obsidian-charts), [repo](https://github.com/phibr0/obsidian-charts) | `chart` block: bar, line, pie, doughnut, radar, polarArea (third-party doc, [pkmer.cn](https://pkmer.cn/Pkmer-Docs/10-obsidian/obsidian社区插件/obsidian-charts)); axis titles, min/max, best-fit line (`bestFit`), time axis | A Markdown table elsewhere in the note via a block `id` (`^table-001`), or another note via `file`; listing also says embedded CSV (reported) | The table is plain; the `chart` block is YAML-like text (reported) | Yes | v3.9.0; "last updated 2 or 3 years ago" (two fetches worded it differently); 331k downloads; 809 stars, 74 open issues | Command "Create Image from Chart" **saves an image** (that is the thing to avoid); no SVG export seen (reported) | AGPL-3.0 (repo page) | Scatter, error bars, log axis, second y axis: **not documented** in what I read (not "no", not confirmed). Strong on popularity, weak on freshness |
| **Fancy Charts** [listing](https://community.obsidian.md/plugins/fancy-charts) | bar, line, pie, **scatter**, area, funnel, heatmap, sankey; simple YAML mode or a raw **ECharts** option object ("advanced mode") | Markdown table inside the block | **Yes**: data is a plain Markdown table in the block, readable without the plugin (reported) | Yes | v0.2.0, 8 releases, updated about 2 months ago; about 2k downloads; Obsidian 1.7.2+ | Not stated | MIT | Best match on paper: table in the block, scatter, ECharts underneath (ECharts itself does error bars, log axes and two y axes through its option object; whether this plugin lets that through is **not confirmed**). Young, small, one author |
| **Plotly plugin** (dmytro-shulha) [listing](https://community.obsidian.md/plugins/obsidian-plotly), [repo](https://github.com/dmytro-shulha/obsidian-plotly) | A `plotly` block passes data, layout and config to Plotly; Plotly itself supports error bars, log axes and several y axes (Plotly feature, not read on a plugin page) | Data as YAML/JSON arrays in the block (x list, y list), not a Markdown table; dynamic charts need Dataview (DataviewJS) | Plain text, but arrays, not a table; the table and the plot are two copies unless Dataview feeds it | Yes | v0.0.6; "last updated 5 years ago"; about 10k downloads | Plotly's own modebar can save a PNG in the browser; not read for this plugin | not read | Most capable chart, worst fit for "the data is the table", and stale. A copy of the numbers lives in two places |
| **Vega Visualizations** (Some-Regular-Person) [listing](https://community.obsidian.md/plugins/obsidian-vega), [repo](https://github.com/Some-Regular-Person/obsidian-vega) | `vega` / `vega-lite` JSON spec in a code block; Vega-Lite itself has error bars and log scales (library feature) | Inline `values` in the JSON; file or table input not mentioned (reported) | JSON, not recoverable by eye the way a table is | Yes (listing) | v0.1.1; "last updated 3 years ago"; about 6k downloads; no releases listed on the repo page | not mentioned | BSD-3-Clause | Powerful grammar, abandoned-looking, data pasted into JSON |
| **Mosaic** [listing](https://community.obsidian.md/plugins/mosaic) | line, bar, stacked bar, bars-and-line; also data tables, timelines | Inline CSV, JSON, **Markdown tables**, and shared dataset files in the vault | Yes for CSV/table | Yes | v1.2.5, 14 releases, created 2 months ago, updated last month; about 1k downloads | not stated | MIT | No scatter listed. Active but brand new |
| **Charts View** (Ant Design Charts) [listing](https://community.obsidian.md/plugins/obsidian-chartsview-plugin) | pie, bar, word cloud, treemap and others | CSV files, note data or Dataview | CSV stays a file | Yes | v1.2.8, updated about 11 months ago; about 97k downloads | not read | not read | General dashboard charts; no scatter/error bars confirmed |
| **Tracker** (pyrochlore) [listing](https://community.obsidian.md/plugins/obsidian-tracker), [repo](https://github.com/pyrochlore/obsidian-tracker) | Counts and numbers across notes (frontmatter, inline fields, checkboxes) as line, bar, pie, calendar, tables | From many notes' properties, **not from a table in one note** | Yes (the notes are the data) | Yes | v1.19.0, updated about 8 months ago; 368k downloads | not read | MIT | Wrong shape: it tracks a value over many notes, not a run's table |
| **Bases Charts** (Moritz Jung) [listing](https://community.obsidian.md/plugins/bases-charts) | **Scatter, line, bar** views for Obsidian Bases | One note = one point (note properties), **not rows of a table** | Yes | Yes | v0.0.11; updated about 10 months ago; about 28k downloads; install by BRAT only | not read | GPL-3.0 | Good for "one point per experiment" (Mn vs run), not for a kinetics table inside one note |
| **Graphs** (DylanHojnoski) [listing](https://community.obsidian.md/plugins/graphs) | Function plots, vector fields, 3D; interactive | Formulas, not data | YAML | Yes | v1.9.3, about 2 years ago, about 6k downloads | **SVG export** (reported) | not read | For maths, not for measured data |
| **Mermaid `xychart-beta`** (built into Obsidian) [Mermaid doc](https://mermaid.js.org/syntax/xyChart.html) | **Bar and line only**; numeric x axis allowed; no scatter, error bars, log scale or second y axis mentioned (reported) | Numbers typed into the block, not read from a table | Plain text | Yes | Part of Obsidian | none of its own | Mermaid is MIT (not re-checked) | One series of points on a line for a quick look; not enough for lab data. Obsidian 1.14.4's bundle contains the `xychart-beta` grammar and the string `11.13.0` (derived, section 8, D1) |
| **Excalidraw** | The Excalidraw web app can turn two pasted columns into a **bar or line** chart (reported, [Excalidraw blog](https://blog.excalidraw.com/tell-your-story-with-charts)); I found no Obsidian Excalidraw script that does it | Pasted | Drawn as a drawing; the file is Excalidraw's | n/a | n/a | PNG/SVG | n/a | Not a data chart (a picture of a chart); not confirmed for Obsidian |
| **Dataview + Charts / Datacore** | Dataview can feed the Charts or Plotly plugin through `dv.paragraph` or DataviewJS (reported on the Charts doc page and the Plotly listing). **Datacore: not read.** | Dataview queries note data; for a CSV a forum post uses `dv.io.csv` (reported, search result) | Script text | Dataview works on mobile (not checked) | Dataview/Datacore status **not checked** | via the chart plugin | | Adds a second plugin and a script per plot: the opposite of "plain text a person can read" |
| **DuckData**, **SQLSeal Charts** | SQL over notes/CSV, ECharts output (SQLSeal: line, bar, pie, scatter, heatmap) | CSV, tables, SQL | SQL text | DuckData is desktop only and loads DuckDB-WASM from a CDN (reported, search result): remote code, a store problem for us to copy | young | | | Not for a lab notebook that must work offline and on a phone |

Two points that matter more than the chart list:
- **No option saves an image by default.** Only Obsidian Charts has a command that does, and it is optional. So the owner's "vault fills up" worry is met by any of them for display.
- **A plugin that goes stale is the data-integrity risk the owner already named** (rig plan, "as flat / plain text / image based as possible"). The numbers are safe if they stay in a Markdown table (Charts, Fancy Charts, Mosaic: yes; Plotly, Vega: numbers inside JSON/YAML in the block). The block itself is only a recipe; losing it loses the picture, not the data (interpretation).

## 3. Chart types a chemistry notebook needs, against the options
Needed (from the owner's brief): scatter with error bars; line; GPC traces (many (retention, signal) points, several runs overlaid); kinetics ln([M]0/[M]) against t, usually with a fitted line; Mn against conversion (two y axes sometimes: Mn and dispersity); overlays of several runs; log axes; two y axes.

| Need | Obsidian Charts | Fancy Charts | Plotly plugin | Vega | Mermaid xychart |
|---|---|---|---|---|---|
| Scatter | not documented | listed | library yes | library yes | no |
| Error bars | not documented | via ECharts advanced option, not confirmed | library yes | library yes | no |
| Line / overlay of runs | yes (several series) | yes | yes | yes | one or more lines on shared x |
| Log axis | not documented | via ECharts, not confirmed | library yes | library yes | no |
| Two y axes | not documented | via ECharts, not confirmed | library yes | library yes | no |
| Best-fit line | `bestFit` modifier | not stated | by hand | by transform | no |
| GPC trace (thousands of points) | not stated | not stated | yes (Plotly handles it) | yes | no |

"Library yes" means the underlying library does it; I did not find whether the plugin passes the setting through (unconfirmed). Obsidian Charts' reader is a one-way "table to series by label", built for category charts (a label per row), so an x-y table with numeric x needs checking (not confirmed).

## 4. Lab Kit's own `plot` block: how hard

### 4.1 What it would be
A ```` ```plot ```` code block with a few lines of plain text, drawn as one SVG by the plugin and shown as an `<img>` exactly like the rig block (`makeFigure` returns `{ svg, width, height }`; `src/rig/figure-make.ts`). Source of truth stays the table. No file is written unless the owner presses Save.

```
```plot
format: 1
from: table Kinetics          # a calc table by name, or  heading "Results"  or  file "GPC/run1.csv"
x: Time (min)                 # column header; "Time (min)" also becomes the axis label
y: ln([M]0/[M])
yerr: Error                   # optional column of +/- values
series: Run                   # optional column; one line/colour per value (overlays)
y2: Mn (g/mol)                # optional second axis
ylog: false
fit: line                     # optional least-squares line, slope shown
title: Kinetics, run 12
```
```
(The names are an illustration of the size of the spec, not a decision: looks and words are the owner's.)

### 4.2 Where the data would come from
| Source | How | Notes |
|---|---|---|
| A Lab Kit calc table | `Workbook` values (`src/calc/engine.ts`, `src/calc/render.ts`) by `name:`; plot redraws when the table changes, like the rig block redraws on edit | Values already evaluated, units stripped by the column header; the calc engine is the single place for numbers |
| A plain Markdown table in the same note | by heading, or by a block `id` like Obsidian Charts' `^table-001` | Needs a small pipe-table reader; ragged and empty cells decided up front |
| A CSV in the vault | `vault.read` of one file | Plain text, good for GPC exports (one big file); one more parser (quotes, decimal comma?) |
| Several notes / experiments | Not in scope | Use Bases Charts for "one point per note" |

### 4.3 Drawing: hand-written SVG versus a bundled library
Store rules (reported, [Developer policies](https://docs.obsidian.md/Developer+policies), read through a search summary, not in full): no obfuscated code, no code loaded or updated from the internet, network use disclosed in the README, no client-side telemetry. I found **no stated size limit**. Lab Kit's built `main.js` is 1,014,805 bytes today (derived, section 8, D2). A library bundled inside `main.js` is allowed by those rules; one fetched from a CDN at run time (as DuckData does) is not.

| Route | Output | Size (approximate, from memory, **not measured**) | Fit |
|---|---|---|---|
| **Hand-written SVG** (like `figure-svg.ts`) | SVG text, same pipeline as the rig figure: `<img>`, Figure… window, Save SVG, PNG on desktop | tens of KB of source | Total control of theme, units, error bars, log ticks, two axes; no new dependency or licence; only the chart types we need; we write the tick maths (nice ticks, log decades) ourselves |
| Chart.js (MIT) | Canvas, not SVG | about 200 KB | Raster only; no SVG for a paper without extra work; poor for the export path |
| ECharts (Apache-2.0) | Has an SVG renderer; very capable (error bars via custom series, log, two axes) | several hundred KB to over 1 MB | Doubles `main.js`; theme and fonts to wire; large API surface to keep stable; heavy on a phone |
| Observable Plot / D3 (ISC) | SVG | Plot plus d3 parts, a few hundred KB | Good error bars and log scales; a DOM-building library, so the "no `innerHTML`" rule and the string-SVG pipeline need an adapter |
| Plotly / Vega-Lite | SVG/canvas | MB range | Too large; Vega needs a safe expression interpreter under strict content rules |

(interpretation) Hand-written wins for scope: the needs are a short list (axes, ticks, markers, lines, error bars, legend, a fitted line) and the rig engine already proves the path (pure function text to SVG string, tests on fixtures, Save SVG, `<img>` so scripts never run). A library becomes attractive only if the owner wants zoom, hover tooltips or dozens of chart types, none of which is asked.

### 4.4 Effort by phase (estimates; each phase one Sonnet session; Opus not needed)
| Phase | Content | Estimate | Needs the owner |
|---|---|---|---|
| 0 | Feedback page with 2 or 3 looks of the same made-up kinetics plot (axes, markers, error bars, dark), spec wording, which lines are required | no code, half a session | Looks are the owner's (CLAUDE.md rule) |
| 1 | Pure core `src/plot/`: spec parser (`format: 1`, unknown lines kept), table reader (calc table values, Markdown table), scales (linear, log, nice ticks), SVG writer for scatter and line, error bars, axis labels, legend, fit line; tests on fixtures with known answers (a fitted slope worked out by a saved script, as the project does for 0005 / 0011) | 1 to 2 sessions | no |
| 2 | The block: code block processor, redraw on edit (skip when the SVG is unchanged), `<img>` card, errors shown in words ("no table called Kinetics", "column Time not found"), light and dark, phone width (shrink to a label floor, then slide, as the rig block) | 1 session | The card's look (white or follow the theme) |
| 3 | Figure… path: reuse the figure window for mm and dpi, Save SVG (every device), Save PNG (desktop only), files go to the Figures folder only when the user presses the button | 1 session | no |
| 4 | CSV file source, series column (overlays), second y axis, log axes, GPC-sized data (thousands of points: down-sampling not needed for SVG at this size, to be measured) | 1 to 2 sessions | which extras are in |
| 5 | Closed-experiment PDF check (section 5), docs (`docs/snippet-syntax.md` section, tutorial, architecture, changelog), checklist rows, an Alt+S "Plot from table" snippet that inserts the block | 1 session | no |
| Total | | **5 to 6 sessions for everything above; 2 to 3 (phases 0 to 2) for a first useful version** | |

These numbers are my estimate from the size of the rig figure work (which took phases 2 to 4 of `docs/plans/rig-figure.md` plus the snapshot phases), not a measurement.

### 4.5 Risks
- **Scope creep (the main one).** Every chart type added is a long tail of options. Proposed boundary: **in** = scatter, line (with or without markers), error bars (y, optionally x), several series, linear and log axes, one extra y axis, axis labels with units, a fitted straight line, title, legend. **Out** = bar, pie, histogram, heat map, 3D, zoom, hover, animation, time axis, smoothing, curve fitting beyond a straight line, annotations, many small panels, anything that needs a click on the plot.
- **Format version rule (GENERAL RULE, `docs/decisions.md` 2026-10-20; `docs/plans/solution-live-block.md` "Block format version"):** first line `format: 1`; no line = version 1; the plugin always reads older versions; a change ships with an old-version reader and a test on a saved old note under `tests/fixtures/plot/saved/`, never regenerated from the new writer; a newer version is shown as "made with a newer Lab Kit: update the plugin" and left untouched. The plot is a recipe, so an old block must still draw the same picture after updates: the drawing engine (tick choice, marker shapes) is part of what must stay stable, so a change of defaults in the drawing also needs a decision (interpretation).
- **Dark mode and theme.** Same decision as the rig block (white card, black line art in every theme, owner Q2 a on that block). Axis text drawn in the SVG's own font (Helvetica, Arial, sans-serif) so a paper figure looks the same on every machine; fonts may differ slightly on a machine without them (the rig plan lists this as an open risk, not measured).
- **Phone.** Pure string-to-SVG works with no Node; `<img>` of a blob URL on mobile Obsidian was checked only in emulation for the rig block, not on a real phone (the rig plan says so); the same gap would apply here. Save PNG stays desktop only.
- **Numbers.** Reading a table means one more reader of numbers: decimal comma, units inside cells (`1.30 mg`), `±` columns, empty cells, text like `n/a`. Rule: the plot never guesses; a bad cell is named in a message (row, column) and the point is left out visibly, not silently.
- **Stale redraw / performance.** A GPC CSV may have thousands of rows; redraw on every keystroke of a neighbouring table must be debounced as the rig block does (250 ms, skipped when nothing changed). Measured: nothing yet.
- **Store review.** A larger `main.js` and a new file reader; no network, no new dependency with the hand-written route.
- **Wording and looks** (legend, empty-state messages, the Save button text) are the owner's; none decided here.

## 5. Data-integrity angle and the closed-experiment PDF
- **Stays flat.** The numbers live in a Markdown table (or a calc table, which is a Markdown table with a `calc` fence, or a CSV beside the note). The `plot` block is about eight lines of text. Nothing binary enters the vault unless someone presses Save. Opening the note without Lab Kit shows the table and a short code block: the picture is not there, but every number is, and a person can plot it in anything (same position as the rig note's empty ```` ```rig ```` block, which the rig plan accepts: "it never held data").
- **A snapshot is possible but optional.** If the owner wants a picture that cannot change, the rig plan's pattern fits: a dated SVG (write-once, with the table text in its `<metadata>`) embedded as `![[x.svg]]`. A plot SVG with the spec and table in `<metadata>` is a few KB, not the MB of a PNG (rig snapshots measured 1.8 to 4.9 KB for fixture rigs; a plot with thousands of points would be larger, not measured). Decision for the owner: live only, or live plus a snapshot at close.
- **Closed-experiment PDF.** Closing prints the rendered note through a hidden window (`docs/plans/close-experiment.md`, Phase 2: live blocks "show their values on the day"). A `plot` block drawn as an `<img>` of an SVG should print like the rig block's picture, but **I have not checked it**: the close code waits for specific block classes (the solution plan adds `.block-language-solution`), so a `.block-language-plot` wait would be needed, and blob-URL images in the print window are an open check (the rig plan Phase 2 lists "PDF export prints the image" as its own check). Not known until tried.
- **Reproducibility.** The same block, table and plugin version give the same SVG (a pure function). Different plugin versions may differ in ticks and spacing unless the engine is frozen per format version (section 4.5).
- **Hazard avoided.** Plugins whose block holds JSON arrays copy the numbers out of the table (two places, they drift). A Lab Kit block names the table; there is one copy.

## 6. Comparison and recommendation

| | Use an existing plugin now | Lab Kit `plot` block later |
|---|---|---|
| Time to a plot | An afternoon to install and try | 2 to 3 sessions for the first useful version, 5 to 6 for the full list |
| Scatter + error bars + log + 2 y axes from a table | Not confirmed in any one plugin; Fancy Charts (ECharts underneath) is the likeliest, untested | Yes by design (in-scope list) |
| Data stays in a table | Yes (Fancy Charts, Charts, Mosaic); no (Plotly, Vega: JSON) | Yes |
| Reads a Lab Kit calc table | No; it can read a plain Markdown table, which the calc fence is not obviously one of for another plugin (the block starts with a fence the plugin does not parse) | Yes, natively, live |
| Export SVG for a paper | Not found documented in the plugins that fit; Charts saves a PNG file | Same Figure… path as the rig figure (SVG every device, PNG desktop) |
| Plugin goes stale | Real risk: three of the closest are 2 to 5 years without an update on the listing; one is two months old with 2k downloads | Ours; follows the format-version rule |
| Maintenance cost for us | None, but a second plugin to install and document in Check setup | Real: a feature to keep correct and tested |
| Scope risk | None | Real; contained by the in/out list |

**Recommendation (interpretation):**
1. **Now (cost: about an afternoon, nothing built):** the owner tries **Fancy Charts** on one real table (a kinetics run with error values) and **Obsidian Charts** on the same table, and notes what is missing (error bars? log axis? SVG?). Both keep the data as a table; neither writes an image unless asked. Neither is recommended as a lab standard (stale or very young), so the trial is only to learn what the owner needs.
2. **Decide the spec in parallel** (Phase 0, no code): a feedback page with the made-up plot. If the trial shows the gaps (it likely will on error bars plus fit plus export), build the Lab Kit `plot` block, **hand-written SVG, first version = phases 0 to 2** (scatter and line, error bars, log axis, axis labels with units, from a calc table or a Markdown table), then add the figure window path and the rest as the owner asks.
3. **Mermaid `xychart-beta`** is available without installing anything and fine for a quick one-series glance; it cannot do scatter, error bars, log or a second axis, and it brings back the Mermaid prompt that the rig plan is removing, so it is not recommended.

## 7. What I could not confirm
- Whether any plugin above does scatter with error bars, a log axis or a second y axis from a table. I did not install or run any; all statements are from listing pages and a README summary. In particular for Fancy Charts, whether its advanced ECharts option object passes error-bar and axis settings through.
- The documented chart types, table syntax and export of **Obsidian Charts** come from a third-party Chinese documentation page and the community listing; the official docs site (`charts.phib.ro`) returned only an intro to my fetch, and the repo page summary did not list the types. Its last release year is unclear (the listing said "2 years ago" in one fetch and "3 years ago" in another; the releases page showed 26 Jan for 3.9.0 without a year).
- Licences, mobile support and update dates for Charts View, Tracker, Plotly, Graphs, Vega: licences of Charts View, Plotly plugin and Graphs not read. Dataview and Datacore maintenance not checked. No download count for Mermaid, Excalidraw or Dataview was collected.
- Library sizes in section 4.3 are from memory, not measured. I did not check whether Vega's expression interpreter works under Obsidian's content rules.
- That the `xychart-beta` grammar is in the bundle is derived from the app file; that it **renders** in Obsidian 1.14.4 was not tried. The exact Mermaid version is inferred from one `11.13.0` string next to the Mermaid code (see D1); not confirmed from a release note.
- The developer policies were read through a search summary; the page itself returned "not found" to two fetches. I found no stated limit on a plugin's size.
- Whether a `plot` block prints in the closed-experiment PDF, how a blob-URL `<img>` behaves on a real phone, the cost of redrawing thousands of points: not tried.

## 8. Re-runnable checks (derived)
- **D1, Mermaid in Obsidian 1.14.4** (desktop app file in the user's Obsidian data folder, run from any directory):
  ```
  python3 -I - <<'E'
  import re,glob,os
  f=glob.glob(os.path.expanduser('~/Library/Application Support/obsidian/obsidian-1.14.4.asar'))[0]
  b=open(f,'rb').read()
  print(b.count(b'xychart-beta'), set(re.findall(rb'version:"1[01]\.\d+\.\d+"',b)))
  E
  ```
  Result 2026-10-21: `xychart-beta` present in the Mermaid grammar; the only `1x.y.z` version string matching is `11.13.0`. (Which package that string belongs to was not checked, so "Mermaid 11.13.0" is likely, not confirmed.) macOS path; other systems differ.
- **D2, `main.js` size:** `ls -l main.js` at the repo root after `npm run build` (state on 2026-10-21, built the evening before): 1,014,805 bytes.
- **D3, rig engine size:** `wc -l src/rig/figure.ts src/rig/figure-svg.ts src/rig/symbols.ts src/rig/figure-make.ts src/rig/figure-ui.ts src/rig/figure-export.ts` gives 594 lines in those six files (144 + 195 + 76 + 16 + 108 + 55); `src/calc/engine.ts` is 512 lines.

## 9. Sources (read 2026-10-21)
- https://community.obsidian.md/plugins/obsidian-charts , https://github.com/phibr0/obsidian-charts , https://github.com/phibr0/obsidian-charts/releases , https://pkmer.cn/Pkmer-Docs/10-obsidian/obsidian社区插件/obsidian-charts , https://charts.phib.ro/
- https://community.obsidian.md/plugins/fancy-charts , https://community.obsidian.md/plugins/mosaic , https://community.obsidian.md/plugins/obsidian-plotly , https://community.obsidian.md/plugins/obsidian-vega , https://github.com/Some-Regular-Person/obsidian-vega
- https://community.obsidian.md/plugins/obsidian-chartsview-plugin , https://community.obsidian.md/plugins/obsidian-tracker , https://community.obsidian.md/plugins/bases-charts , https://community.obsidian.md/plugins/graphs , https://community.obsidian.md/plugins/goodcharts
- https://www.obsidianstats.com/posts/2025-07-10-chart-plugins , https://mermaid.js.org/syntax/xyChart.html , https://blog.excalidraw.com/tell-your-story-with-charts , https://docs.obsidian.md/Developer+policies (via search summary)
- In this repository: `docs/plans/rig-block-no-mermaid.md`, `docs/plans/rig-figure.md`, `docs/plans/solution-live-block.md` ("Block format version"), `docs/plans/close-experiment.md`, `docs/decisions.md` (2026-10-20 GENERAL RULE), `docs/snippet-syntax.md` (calc block options).
