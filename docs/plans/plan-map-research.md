# Plan map: what other tools do (research, 2026-10-19)

_Research only, nothing built. Asked by the owner (last-group feedback page, mark 8): research card-based to-do / dependency maps across tools and related fields first, then the owner, Claude and the findings make the plan. Coverage was partial: 9 web searches, no full page reads; Asana, ClickUp, Trello, OmniPlan, MS Project, Gantt / PERT, SciNote, Benchling, Galaxy, KNIME, Canvas / Excalidraw planners were NOT researched (general knowledge only, marked unconfirmed)._

## The plan map's known issues (from obsidian-check, 2026-10-19)
- (a) The Reset (auto layout) icon sits next to Undo and looks like it.
- (b) In the top-to-bottom layout the arrows run close to the cards.
- (c) Cards with nothing under the title are tall and empty.
- Phone: the + buttons are 18 px (a finger needs about 44 px); Fit stops at 40 %, so wide maps scroll sideways. The owner: "phone is always going to be awkward, we might have to disable certain features".

## What others do
| Tool | Idea worth taking | Source |
|---|---|---|
| TaskNotes 4.11 + Canvas Bases | dependency and subtask edges on a canvas, badges and task menus, blocked / blocking kept live | https://tasknotes.dev/releases/4.11.0/ |
| Project Manager (obsidian-pm) | Gantt / Kanban / Table from one dataset; moving a blocker moves dependents; cycles refused | https://github.com/StepanKropachev/obsidian-pm |
| Linear timeline | drag from a handle to link; blue line ok, red line = violated; Shift moves a whole chain | https://linear.app/docs/project-dependencies |
| Jira dependencies report | tiles with arrows; red arrow on a problem (view only) | https://confluence.atlassian.com/advancedroadmapsserver/displaying-the-dependencies-map-1005805794.html |
| FigJam, Miro | + on hover adds a connected shape; Tab adds a child | https://www.figma.com/figjam/how-to-use-figjam-to-make-diagrams/ · https://help.miro.com/hc/articles/360017730753 |
| GitLab pipeline graph | replaced per-node lines by stage lists; on phones tap, not hover | https://gitlab.com/gitlab-org/gitlab/-/merge_requests/132462 |
| ELK layered layout | separate spacing between rows and between siblings; direction DOWN | https://eclipse.dev/elk/blog/posts/2025/25-08-21-layered.html |
| React Flow | auto layout and undo / redo as separate actions; undo disabled when empty; one step per gesture | https://reactflow.dev/pro/content |

## Recommendations (ranked; for a before / after feedback page, nothing decided)
1. Reset gets its own "tidy layout" icon (grid) with a text tooltip; a gap between the Undo / Redo group and the Fit / Reset group; Reset is one undo step.
2. Top-to-bottom spacing: gap between rows about 1.5-2 × the gap between cards; a straight stub of 12-16 px in and out of each card before a bend.
3. Empty cards shrink to one line (title and done circle) until they have a badge, count or subtasks.
4. Arrow colour by state: amber when a card is done before the one it comes after (reuses the warning logic).
5. Touch: tapping a card shows a small toolbar (Add before / after / subtask) with 44 px targets; hover + stays on desktop.
6. Phone: an indented list with an "after: X" chip per row, with a toggle to the map, instead of sideways scrolling; editing (drag, nest, insert) desktop only (to discuss).
7. "Hide finished" switch; a fully finished branch collapses to one "✓ 5 done" chip; arrows to hidden cards stay as stubs.
8. While dragging the nesting strip: a drop highlight and a "Nest under X" hint.

Avoid: re-laying-out everything on each edit (only first draw and Reset); a hover-only way to add; line tangles on phones; read-only maps (editing in place is the advantage).

## Next
A feedback page with before / after pictures of the top five (1-4 and 6), then the plan with the owner. The research gaps (Asana, ClickUp, MS Project, lab workflow tools) can be filled first if the owner wants.
