# Plan map for a big project: real examples from other tools and Obsidian plugins (research, 2026-10-20)

_Research and mock-ups only; nothing built or decided. Asked by the owner (chat, 2026-10-20) after none of the three offered options (open work only, workstream rollup, one slide per workstream) was picked: "show real examples from the internet, including Notion, then decide". Builds on `plan-map-large-graph-research.md` (patterns, mostly search summaries) and `plan-map-export-research.md`; this pass read the product and plugin pages themselves._

_Coverage and honesty: about 30 pages were fetched or searched; **(page read)** means the page text was read (through a fetch that summarises the page, so wording was not checked line by line); **(search summary)** means only a search engine's summary was seen; **(seen)** means a screenshot was looked at in a browser. Anything marked **not confirmed** was looked for and not found. Claims were not entered in a claims register (same as the two earlier research docs). Product behaviour changes by version and plan. Brief paraphrase only; no text is copied._

## What these tools have in common (interpretation)
No tool read keeps a big project legible by shrinking it. Six moves came up again and again:
1. **Group, then fold the group** (Notion, Obsidian Bases, Asana sections, ClickUp groups, Spatial Task Graph, Jira parents).
2. **A rollup instead of the items**: "N of M done" as a bar or percentage per group (Notion rollup, Jira epic bar, Linear milestones, Asana portfolio).
3. **Hide finished work** (Project Manager Enhanced "Hide done in Gantt", Spatial Task Graph, Jira filters).
4. **Filter to one chain or one group** (Project Planner upstream / downstream, saved filters, Linear milestone filter).
5. **Counts in the group header** (GitHub Projects field sums, monday group summary).
6. **Zoom and drill-down** (Notion zoom and load limit, GitHub Month/Quarter/Year, Project Planner day/week/month): the one move a view-only picture cannot copy.

I found **no tool that makes a static, slide-sized picture that simplifies itself as the project grows**. Their answer is interaction (open the group, zoom in, filter). For a picture, the practice that remains is the status-deck one (`plan-map-large-graph-research.md`, pattern 9): one overview page, a few numbers, a short "needs attention" list.

## Examples

### Notion
| What | Source | What it shows and how it copes with 50+ items | Confirmed |
|---|---|---|---|
| **Timeline view** | [Notion help: Timelines](https://www.notion.com/help/timelines) (page read) | Bars on a date axis; zoom from hours to years; a **Load limit** setting caps how many pages are drawn; small arrows on a row point to items outside the current window; table beside the timeline can be shown or hidden. The help page does not cover dependencies, grouping or progress. | zoom, load limit, off-screen arrows: page read. Dependencies and grouping: only from [Notion's intro guide copy](https://www.notion.com/fr/help/guides/intro-to-timeline-view) (page read, one sentence each) and third-party posts (search summary). How grouping and arrows behave together at scale: **not confirmed** |
| **Dependencies** | [Notion release note 2.19, Dec 2022](https://www.notion.com/releases/2022-12-15) (search summary); [Notion help: sub-items and dependencies](https://www.notion.com/help/tasks-and-dependencies) (page read) | Arrows between timeline items; date-shifting options (only when overlapping, keep the gap, never). Linear sequence of related work. Nothing on how a big graph is kept legible. | page read for the options; a "blocked by" word and any limit: **not confirmed** (the page lists none) |
| **Sub-items** | same help page (page read) | Visible in every view. Table / list / timeline: nested in toggles or a flat list; filter parents only, both or sub-items only. **Board / calendar / gallery: sub-items show as a property on the parent card or flat; only "parents only" filtering.** | page read |
| **Rollup as progress** | [Notion help: relations and rollups](https://www.notion.com/help/relations-and-rollups) (page read) and a how-to roundup (search summary) | A rollup summarises the linked pages with a count, percent not empty, sum etc. The help page does **not** mention percent checked, per-group percent or bars; a how-to says "percent per group" can be shown as a **bar or ring** and that a rollup cannot be rolled up again, and that grouping by a rollup is not allowed. | bar / ring and the rollup limits: search summary only, **not confirmed** on an official page |
| **Group / sub-group in a board** | [Notion grouping guide](https://notion.vip/insights/the-grouping-guide) (search summary, third party) | Board grouped by one property, sub-grouped by another (since v2.13 per that source). | **not confirmed** officially |

**Lesson (interpretation):** Notion copes with size by grouping, nested toggles and a progress rollup per parent, not by a smaller picture. The "progress bar per group" is the piece that fits a picture; it is also exactly what a list of groups with "N of M done" gives.
**Implement here:** rollup bar per group = mock-up M3 (needs a group). Sub-items as a property on a card = the "2/4 subtasks" text already on cards (done).

### GitHub Projects
| What | Source | Shows / copes | Confirmed |
|---|---|---|---|
| **Roadmap layout** | [GitHub docs: customizing the roadmap layout](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-roadmap-layout) (page read) | Items on a time axis; vertical markers for iterations and milestones; Month / Quarter / Year zoom; **group by a field** with **sums (including item counts) in each group header**; a slice panel to filter by a field value. | page read. Whether sub-issue progress shows on the roadmap: **not confirmed** |
| **Sub-issues** | [GitHub docs: adding sub-issues](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues) (page read) | Hierarchy up to 100 sub-issues per parent and 8 levels; projects can group or filter by parent. | limits: page read. How progress is drawn (bar, X of Y): **not confirmed** on this page |

**Lesson:** a group header with a count is cheap and effective. **Implement here:** a "N open" count on each group in M2 / M3.

### Linear
| What | Source | Shows / copes | Confirmed |
|---|---|---|---|
| **Project graph** | [Linear docs: project graph](https://linear.app/docs/project-graph) (page read) | Scope line, started and completed lines, completed bars per week, a target date line and a predicted finish (dotted). Needs a started project with enough data. | page read |
| **Milestones** | [Linear docs: project milestones](https://linear.app/docs/project-milestones) (page read) | Each milestone shows a completion percentage from its issues; the next unfinished milestone is marked; a big milestone can be **turned into its own project**; timelines show the current milestone with its percentage. | page read |
| **Timeline** | [Linear docs: timeline](https://linear.app/docs/timeline) (earlier doc, page read) | Projects only, not issues. | page read earlier |

**Lesson:** Linear never draws the 59 issues: the project is the unit, with milestones inside it, and size is handled by promoting a large milestone to a project. A burn-up needs history, which to-dos do not keep (no completion dates). **Implement here:** nothing from the graph; "milestone with a percentage" = a group row in M3.

### Jira (Advanced Roadmaps / Plans)
[Atlassian: tracking progress and status](https://confluence.atlassian.com/advancedroadmapsserver/tracking-progress-and-status-814212695.html) (page read): each bar carries progress (grey = none, green = share done); a parent shows an **aggregated bar of its children** and expanding it shows them; progress counts resolved children or estimates; a warning appears when a done parent has open children. The same page does not describe how a big plan is kept readable beyond filters and expandable parents. The Dependencies report (counted, expandable links between grouped items) is in `plan-map-large-graph-research.md` (page read). **Implement here:** the warning idea ("done but N subtasks open") is a cheap status mark; counted links = earlier P1.

### Asana, monday, ClickUp, Miro (weakest evidence)
- **Asana Timeline:** subtasks open from an arrow, **only the first level of subtasks shown**; dependencies are drawn by dragging a connector; sections can be collapsed ([help: plan and execute projects with timeline](https://help.asana.com/s/article/plan-and-execute-projects-with-timeline), search summary; the direct help page I tried returned 404). Collapse of sections: third-party and an old forum post, **not confirmed** officially. Portfolios (earlier doc, page read) show status and progress per project.
- **monday.com:** Gantt with dependencies and milestones; a dashboard "battery" widget for progress; "Show Group Summary" option ([support page](https://support.monday.com/hc/en-us/articles/360015643840), search summary; the page itself returned 403). Sources disagree on baselines and critical path: **not confirmed**.
- **ClickUp:** Gantt with a **Show critical path** switch (red path) and collapsible groups ([ClickUp help](https://help.clickup.com/hc/en-us/articles/40982447293207-How-to-use-Gantt-charts-for-project-planning), search summary; page returned 403). How collapsed groups interact with the path: **not confirmed**.
- **Miro:** frames act as slides (reorder, hide, export); a Dependencies app links cards; no built-in overview of a big board found ([Miro help: presentation mode](https://help.miro.com/hc/en-us/articles/8512850754962-Interactive-Presentation-Mode), [dependency mapping](https://miro.com/agile/dependency-mapping), search summary). **The nearest thing to "one slide per group" is a frame per group.**

**Lesson:** all three scale with collapse and critical-path filters, both interactive; Miro's frames are the only "deck from one canvas" idea. **Implement here:** critical path is not possible (no durations); frames = earlier P2 (one picture per group).

### Mermaid and diagram-as-code
- **Treemap** (`treemap-beta`): nested rectangles sized by a number; the docs warn very small values are hard to see or label and deep hierarchies are hard to read ([Mermaid docs](https://mermaid.js.org/syntax/treemap.html), page read). Poor fit: 59 equal to-dos have no size, no links.
- **Kanban:** columns and cards with optional `assigned`, `ticket`, `priority`; one config option only ([docs](https://mermaid.js.org/syntax/kanban.html), page read). No status marks beyond priority, no grouping or rollup. A flat board of 59 cards would be as unreadable as today's map.
- **Collapsible subgraphs** (v11.17.0+) and Graphviz clusters: in `plan-map-large-graph-research.md`. Lab Kit already does not use Mermaid for this picture, so these are examples of the idea only.

### Obsidian community plugins
| Plugin | Source | What it shows / copes | Confirmed |
|---|---|---|---|
| **Project Planner** | [plugin page](https://community.obsidian.md/plugins/project-planner) (page read; screenshot **seen** in a browser) | Dependency **graph** (auto layout, critical path), Gantt (day/week/month zoom, group rows by tag, status, note or project; parents fold children; filters and saved presets), kanban board, a **panel for unlinked tasks** so they do not clutter the canvas, tasks grouped into labelled project containers, upstream / downstream chain for a search hit, and a fenced **`project-planner` block that renders a filtered graph inside any note**. Plain Markdown (Tasks emoji or Dataview fields). Desktop and mobile listed. | page read. The enlarged graph screenshot (about 40 small nodes, dark theme, filters and a legend at the bottom) **was not legible at the size shown**, which is the problem we have; performance at large counts: **not confirmed** |
| **Simpromana** | [plugin page](https://community.obsidian.md/plugins/simpromana) (page read) | Flow graph ("grouped and laid out automatically") with `blocked_by` / `continues` / `related`; board (Todo / Doing / Review / Done); project panel. | no word on collapse, zoom or a read-only embed: **not confirmed** |
| **Spatial Task Graph** | [plugin page](https://community.obsidian.md/plugins/spatial-task-graph) (page read) | Infinite canvas; **groups collapse into a checklist**, nest, and can still link to other tasks; completed isolated tasks move to the bottom; filters by tag or path. | interactive only; no static view mentioned |
| **Tasks Map** | [plugin page](https://community.obsidian.md/plugins/tasks-map) (page read) | React Flow nodes with dependency edges, tag filters; no grouping or collapse mentioned; embed "format may change" (no details). | **not confirmed** beyond that |
| **Project Manager Enhanced** | [plugin page](https://community.obsidian.md/plugins/project-manager-enhanced) (page read) | Table / Gantt / kanban over one data set; hierarchies collapse in all views; **"Hide done in Gantt"**; arrows for dependencies. | progress rollup to parents: **not confirmed** |
| **Bases (core Obsidian)** | [Obsidian help: Bases views](https://obsidian.md/help/bases/views) (page read) | Table, list, cards, kanban, map; **group by one property; groups can be collapsed** in table, cards and list; embed a base in a note as `![[File.base#View]]`. Per-group summaries: **not covered on that page**. | page read |
| Dashboards, Project Cockpit, Tag Project, QueryDash, DataCards | search listing only | Dashboard-style plugins (status overview, open to-dos, kanban from Dataview). | **not confirmed**; not opened |

Not looked at: the Kanban plugin, Canvas as a project view, Excalidraw. **Lesson:** Obsidian's answer to size is again filter, group and fold, plus (Project Planner) a filtered graph block. The block idea fits Lab Kit's existing `show:` blocks; the unlinked-tasks side panel matches M1's "not linked" row.

## Pattern to Lab Kit (how, where, rough effort)
All rows draw from to-dos with `due`, `waiting`, `after`, subtasks; note data stays the source of truth; no picture is saved. Effort is a guess in sessions for a Sonnet builder on top of Phases 1-2 of `plan-map-export.md` (status marks, header, as-of date, `PlanRow.waiting`).

| Pattern (from) | Mock-up | New data | Block in a note | Phone | Effort |
|---|---|---|---|---|---|
| **One-pager: big counts, dot wall, short lists** (status-deck practice; contribution grids) | M4 | none | yes, a second layout of `slideSvg` / a block option | yes, dots wrap, text 15 px | small to medium: a `kind: "overview"` in `slideModel`, steps from `layoutPlan`, three list rules (late, waiting, can start) |
| **Open-work graph, slim chips** (Project Planner / Jira dependency report with done hidden) | M1 | none | yes, but a note block is too small on a phone | no | medium: own chip layout over the real `layoutPlan` (cards are fixed 190 x 108 in `mapGeometry`), arrow routing |
| **Progress table / rollup bar per group** (Notion rollup, Linear milestones, Jira epic bar) | M3 | a group per to-do | yes | yes (best of four) | medium once the group exists; the group is the bigger job |
| **Lanes, done folded** (Notion board group, Bases group by, Asana sections) | M2 | a group per to-do | yes | no | medium once the group exists |
| **Switch by size** (the plugin's own `tooSmall`) | n/a | none | yes | n/a | small: choose the layout from the card count; not a product pattern, a rule |

### Where a group could come from (derived, re-runnable: `my_work/mockups/plan-map-export-src/goals.ts`)
- **The end goal a to-do leads to does not work as a group.** On the 59 to-do project there are 20 end goals, but **36 of the 59 to-dos (20 of the 24 open ones) lead to the single goal "Supervisor review of draft"**, and 8 to-dos are linked to nothing. So a group cannot be computed from `after` links alone.
- Options that exist or are cheap (interpretation, not checked in code): a new property on the to-do; the experiment the to-do links to (the chip bar has an Experiment chip, but `PlanRow` does not read it today); who it is waiting on (`waiting`, only set on some); the parent to-do (conflicts with using subtasks for small steps).
- M1 and M4 need none of these: M4's dot columns are the plugin's own steps.

## Ranked recommendation (for the owner to decide; nothing chosen)
1. **M4 one-pager first, as the large-project picture** (and as a block option): no new field, one picture, readable on desktop and phone, answers "where are we and what needs me now". It subsumes earlier P3 (the lists) and adds the whole-project dot wall. Switch to it when option A's smallest text would fall under 22 px.
2. **M3 progress table second**, only if the owner is willing to give to-dos a group (best phone picture; the group also feeds M2 and the earlier P1 / P2).
3. **M1 open-work graph third**, for owners who want the arrows back on a big project; slide only, and it shrinks again once many to-dos are open.
M2 last: it names every open to-do but loses the arrows and needs the group.

## Not confirmed (summary)
Notion: grouping with dependencies at scale, percent-per-group bar on an official page. GitHub: sub-issue progress display. Asana, monday, ClickUp: official pages for collapse, baselines, critical-path interaction (three pages blocked or missing). Miro: any overview of a big board. Obsidian plugins: performance and zoom behaviour of Simpromana, Tasks Map, Project Planner at large counts; Bases summaries; plugins listed only by search. The Smartsheet "30 seconds per status slide" figure quoted in the earlier doc was never checked.

Looks: `my_work/mockups/plan-map-big-project-mockups.html` (feedback copy `my_work/mockups/plan-map-big-project-feedback/page.html`); generator `my_work/mockups/plan-map-export-src/gen-big.ts`, page builder `build-big.py`. Question: BACKLOG "Questions for the owner", item "Plan map, big project: examples".
