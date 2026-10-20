# Plan map for a large project: how other tools keep a big dependency graph readable (research, 2026-10-20)

_Research only, nothing built or decided. Asked by the owner (chat, 2026-10-20) after the mature-project page (`my_work/mockups/plan-map-export-mature.html`) showed today's slide picture failing for a 59 to-do project: 8 of 24 open to-dos get cards and the smallest text is 12.3 px on a 1920 px slide (about 6 pt), against the plugin's own 22 px limit; ideas 1-3 on that page do not fix it. Question: how do project, flow-chart and dependency tools show a LARGE dependency graph legibly at a glance, in a view-only form that still reflects current status?_

_Coverage: 23 web searches (3 in extended mode) and 9 pages read (2 more could not be read: one blocked, one PDF unreadable). Each source is marked **(page read)** when the page itself was read, or **(search summary)** when only a search engine's summary of it was seen; search-summary points are not confirmed. Tool behaviour can differ by version and plan. Sources were not entered in a claims register (same as `plan-map-export-research.md`). Numbers for the 59 to-do project are derived by `my_work/mockups/plan-map-export-src/gen-large.ts` and `gen-mature.ts` (re-runnable; private folder). Judgements about fit are marked (interpretation)._

## What limits the picture today (from the code and the mature page)
- The picture is a fixed 1920 × 1080 SVG with no pan or zoom. `slideSvg` scales the card map down until it fits, so text size falls as cards are added; `minText` / `MIN_READABLE` (22 px) in `src/planning/plan-slide.ts` already measures this.
- On the mature project the card area is limited by **height**, not width: cutting columns (idea 3, 2 steps ahead) only raised the smallest text from 12.3 to 13.9 px (derived, `gen-mature.ts`).
- Data the plan has: to-dos with `after` links, `due`, `waiting`, `priority`, `result`, one level of subtasks (`sub`), an experiment link. Data it does **not** have: a workstream / part / phase, a start date or length, a milestone flag, completion dates.

## Patterns found

### 1. Collapse groups into summary nodes, bundle the links between groups
- **Jira (Advanced Roadmaps / Plans) Dependencies report** lets you pick the hierarchy level the links are shown at. Above the linked items, a link is drawn as a dotted line labelled with how many links it stands for, which you can open. It can group by team, sprint, space or a parent item, and filter to one item's chain ([Atlassian docs](https://support.atlassian.com/jira-software-cloud/docs/refine-the-dependencies-report-in-advanced-roadmaps), page read). A warning turns the line red (search summary, [Server docs](https://confluence.atlassian.com/advancedroadmapsserver/displaying-the-dependencies-map-1005805794.html)).
- **Mermaid flowcharts** have subgraphs, and since v11.17.0 a subgraph can be drawn collapsed; links that cross its edge go to the collapsed box ([Mermaid docs](https://mermaid.js.org/syntax/flowchart.html), page read: the heading "Collapsible subgraphs (v11.17.0+)" and the `view: collapsed` setting; the code example did not load).
- **Research on compound graphs**: drawing every leaf node hides the higher-level structure; one layout shows collapsed groups with in / out ports and opens a group as a separate detail view next to it. The authors say it gains little on shallow groupings and was tested only on case studies ([Han et al., IEEE VIS 2024, arXiv 2408.04045](https://arxiv.org/html/2408.04045v1), page read). A 2024 survey covers the field ([Ehlers et al.](https://cg.tuwien.ac.at/research/publications/2024/ehlers-2024-vgs), search summary). A Microsoft patent replaces all links between two collapsed groups with one thick "artery" per direction, its width showing the count ([patent 20110249002](https://patents.justia.com/patent/20110249002), search summary).
- **Graphviz** has clusters and can clip a link to a cluster's edge, but no built-in collapse; forum answers point to regenerating the graph per view ([forum](https://forum.graphviz.org/t/viewer-explorer-that-can-collapse-clusters/1411), [lhead docs](https://www.graphviz.org/docs/attrs/lhead/), search summary).
- **MS Project network diagram**: when it does not fit a page, the accepted advice was to collapse the outline to summary tasks; "fit to page" only shrinks the drawing ([Microsoft Q&A](https://learn.microsoft.com/en-us/answers/a/10242017), search summary). A planning forum suggests a links table instead of a huge chart ([Planning Planet](https://planningplanet.com/comment/95377), search summary).
- **For Lab Kit:** the strongest single idea for "where are we overall": a few boxes (one per group) with "N of M done", late / waiting counts and the next to-dos, and one counted arrow per pair of groups. Size stays the same however many to-dos there are. **Blocker:** the plan has no group field (interpretation). Subtask parents are the only grouping today and are used for small steps, not workstreams.

### 2. Level of detail and semantic zoom
- Semantic zoom shows fewer, more important nodes (or clusters) when zoomed out and more detail when zoomed in; papers on map-like graph views require every visible node to be labelled without overlap ([ZMLT, De Luca et al. 2020](https://arxiv.org/pdf/1906.05996), [Wiens et al. 2017](https://par.nsf.gov/biblio/10109414), [Zinsmaier et al. 2012](https://graphics.uni-konstanz.de/publikationen/Zinsmaier2012InteractiveLevelDetail/Zinsmaier2012InteractiveLevelDetail.pdf), search summaries; the links are as the search listed them and were not opened).
- **For Lab Kit:** the picture has no zoom, so only the static form applies: choose the level of detail from the project's size. The plugin already knows when the picture is too small (`tooSmall`), so it could switch to a coarser picture instead of shrinking the cards (interpretation).

### 3. Swimlanes
- Office Timeline (now Lucen Timeline) splits a roadmap into horizontal lanes by team, phase or workstream, with sub-lanes; no limit on lanes is given ([Lucen swimlanes](https://www.lucensoftware.com/products/timeline/features/swimlanes), page read). A plan imported from MS Project needs a text column named "Swimlane" ([support](https://online-support.officetimeline.com/hc/en-us/articles/11723824117783), search summary).
- **For Lab Kit:** lanes make a map easier to follow but do not reduce the number of cards, so text size does not improve; it also needs the group field (interpretation).

### 4. Critical path only, focus on open work
- MS Project can filter a schedule to critical tasks only (filter hides, highlight only marks); users report this cuts a large schedule to a few dozen tasks ([Microsoft Q&A](https://learn.microsoft.com/en-us/answers/a/9744529), [Planning Planet](https://planningplanet.com/comment/30198), search summaries). Smartsheet highlights the critical path in red in the Gantt ([help](https://help.smartsheet.com/learning-track/smartsheet-advanced/critical-path), search summary); an archived forum thread asked for a critical-only filter ([community](https://community.smartsheet.com/discussion/4183/critical-path-where-smartsheet-fails-need-a-critical-path-filter-asap), search summary).
- Open-work views found were proposals or small projects: order open items by their open blockers only (finished blockers impose nothing) and group them In progress / Ready / Blocked ([t3code issue 13](https://github.com/tannerpolley/t3code/issues/13), search summary); open items plus their open prerequisites with a little finished context ([tanks issue 437](https://github.com/AustinOrphan/tanks/issues/437), search summary); a read-only graph of one item's neighbours capped at 30 cards ([planacity PR 131](https://github.com/tidus747/planacity/pull/131), search summary). No shipped tool was found that combines all of this (not confirmed).
- **For Lab Kit:** a true critical path needs durations, which to-dos do not have (same reason the Gantt was rejected). "Open work only" needs nothing new: late, waiting, can start and "after X" are already computed. Sorting the open to-dos by what they need now (late / waiting / can start / next) gives a bounded picture: each column shows a few, then "+N more", and everything further on is one count line that still says how many are late or waiting (interpretation).

### 5. Milestone and roadmap rollups
- A scheduling reference separates milestone, summary and detailed schedules by audience, and warns that collapsing the work breakdown mechanically gives cluttered summary bars; it advises curated groups by accountability, verifiable milestones, and keeping the summary linked to the detail ([BVOP](https://bvop.org/kb/milestonesummarydetail.html), page read).
- Consulting roadmap guides: build the executive and the detailed version from the same plan, group activities into workstreams, show where you are now and what is done ([Slideworks](https://slideworks.io/resources/how-to-write-roadmap-slides), page read); about 3 to 7 decision milestones for executives (one of the guides in [this search](https://deckary.com/blog/pillar-timelines-roadmaps-guide); search summary, the source of the number was not pinned down).
- Linear's timeline shows projects only, not issues, grouped by initiative, with zoom from days to quarters ([Linear docs](https://linear.app/docs/timeline), page read). Asana portfolios show each project's status and progress as the share of tasks or milestones done ([Asana help](https://help.asana.com/s/article/portfolio-management), page read).
- **For Lab Kit:** both tools roll up to a level **above** the task (project, epic, initiative). Lab Kit's project is already the top; the missing level is between project and to-do (interpretation). Milestones would need a new flag on a to-do.

### 6. Hierarchical progress: sunburst, icicle, treemap
- Sunbursts and icicles draw a hierarchy as rings or rows; colour can carry a second measure such as percent complete ([Plotly sunburst](https://plotly.com/python/sunburst-charts/), [icicle](https://plotly.com/python/icicle-charts/), search summary). objectiF RPM has a treemap of value streams coloured by schedule state ([manual](https://manual.microtool.de/en/products/objectif-rpm/portfolio-management/earned-value-treemap-view/), search summary); TeamForge rolls task status colours up to folders by thresholds ([docs](https://community.qnx.com/help/topic/teamforge163/action/tasks-configuringtaskstatusrollupcolors.html), search summary). No worked example of a completion-coloured project sunburst was found.
- **For Lab Kit:** poor fit (interpretation): the hierarchy is shallow (project, to-do, subtask), links disappear, narrow segments cannot hold a to-do name at slide size, and area is harder to read than "N of M done".

### 7. Matrix (DSM) instead of a node-link drawing
- Controlled studies found matrices read better than node-link drawings for most tasks once a graph has more than about 20 nodes, except following a path, where node-link drawings win ([Ghoniem, Fekete, Castagliola, HAL abstract](https://hal.archives-ouvertes.fr/hal-00343819), search summary; the page itself blocked the read). A design structure matrix orders tasks so links sit near the diagonal and shows loops as blocks ([Wikipedia](https://en.wikipedia.org/wiki/Design_structure_matrix), search summary).
- **For Lab Kit:** poor fit for a status slide (interpretation): "what comes after what" is a path question, a 59 × 59 grid is not legible on a slide, and the audience (group meeting, supervisor) is not used to reading one. A 6 × 6 workstream matrix would be legible, but pattern 1's counted arrows say the same thing.

### 8. Gantt and timeline
Rejected earlier (to-dos have a due date but no start or length; `plan-map-export-research.md`). Nothing found here changes that.

### 9. How status-review slides are made in practice
- A consulting guide: one overall one-pager (overall health, a few metrics, accomplishments, priorities, risks, decisions needed, status date), then drill-down slides; 5 to 7 rows on a multi-project grid; Harvey balls for completion, colour for health; it quotes a Smartsheet figure that executives spend under 30 seconds per status slide ([Deckary](https://deckary.com/blog/project-status-slide), page read; **figure withdrawn 2026-10-20: the cited Smartsheet page has no such figure and no primary source was found**, see `plan-map-big-project-examples.md`). Other guides list overall status, a workstream breakdown and a risks log, with one colour scheme across workstreams ([GoodPello](https://www.goodpello.com/en/products/category/258), search summary).
- Small multiples: the same small chart repeated per group in a grid, to compare at a glance; a general audience can find dense grids hard ([Pew Research Center](https://www.pewresearch.org/decoded/2018/12/20/how-pew-research-center-uses-small-multiple-charts/), search summary).
- No single authoritative "one slide per workstream" standard was found; it is a common practice in templates and guides (search summaries; not confirmed as a standard).

### 10. Obsidian plugins that draw task graphs
Tasks Map (React Flow, draggable nodes, `dependsOn` / `blockedBy`), Task flow (inline `id` / `dependsOn`), Project Planner (dependency graph, Gantt with critical path, kanban) ([Tasks Map](https://community.obsidian.md/plugins/tasks-map), [Task flow](https://community.obsidian.md/plugins/task-flow), [Project Planner](https://community.obsidian.md/plugins/project-planner), search summaries). All are interactive canvases; none was seen to offer a summary picture for large projects (not confirmed: their docs were not read).

## Drawn for the 59 to-do project (`my_work/mockups/plan-map-large-options.html`)
Derived by `gen-large.ts` (synthetic data; workstreams made up; status rules as option A; text sizes are font size × scale, not measured on a slide):

| Picture | smallest text at 1920 px | new data needed | links shown | pictures |
|---|---|---|---|---|
| Option A, compact (mature page) | 12.3 px | none | arrows, next 3 steps | 1 |
| Idea 3, 2 steps ahead (mature page) | 13.9 px | none | arrows, next 2 steps | 1 |
| P1 workstream rollup | 22 px (fixed) | workstream on each to-do | 9 counted arrows for 22 links | 1 |
| P2 one slide per workstream | 22 px on 5 of 6; 14.4 px on Characterisation (6 cards) | same | arrows inside, tiles across | 6 (Reagents all done) |
| P3 open work only | 22 px (fixed; names 26 px) | none | as text ("after X") | 1 |

P3 for this project: Late 2, Waiting 2, Can start 5, Next 4, and "Later: 11 more open to-dos (none late or waiting)".

## Pros and cons for Lab Kit
- **P3 open work only.** Pro: no new field, one picture, legible whatever the size, answers "what is next and what is stuck" (the owner's Q2 (2) on the mature page). It keeps option A's status rules, so Phase 1-2 of `plan-map-export.md` still apply. Con: no arrows (links become "after X" text), finished work is only a bar; close to option B (columns), but sorted by need rather than Now / Next / Later.
- **P1 workstream rollup.** Pro: answers "where are we overall" in one glance, fixed size, links kept as counts. Con: needs a group on every to-do (a new property and a kit template change, or reuse of `sub`), a layout rule for the boxes, and hides the order inside a group.
- **P2 summary plus one slide per workstream.** Pro: matches how status decks are built; each slide is today's picture on a smaller plan. Con: same field as P1; several pictures to copy or several blocks; a big workstream can still be too small (14.4 px here), so it needs P3 or idea 3 as a fallback inside a workstream.
- **Static level of detail** (a rule, not a picture): option A while it is readable, the coarser picture once `tooSmall` is true. Pro: small projects keep the arrows the owner liked. Con: the picture changes form as a project grows (interpretation).
- Not recommended: swimlanes (no gain in size), critical path (no durations), sunburst / treemap (no links, labels do not fit), DSM (path questions, unfamiliar), interactive semantic zoom (the picture is view-only).

## Ranked recommendation (for the owner to decide; nothing chosen)
1. **P3, open work only, as the large-project picture, with option A kept for small projects**: switch when option A's smallest text would fall under 22 px. Needs no new data, so it can follow Phases 1-2 of `plan-map-export.md` directly.
2. **P1, workstream rollup**, if the owner wants "where are we overall" on one slide and is willing to give each to-do a workstream. A second picture next to P3 (the mature page's Q2 (3), "both").
3. **P1 plus P2, a summary and one slide per workstream**: the fullest status deck, most work (field, several pictures, a fallback for big workstreams).

Open choices: BACKLOG "Questions for the owner", item "Plan map, large projects". Plan: `docs/plans/plan-map-export.md`, section "Large projects".
