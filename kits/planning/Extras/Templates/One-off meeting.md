<%*
// One-off meeting template - the smaller meeting note of New one-off meeting; creates "YYYY-MM-DD <Series>" in the series' folder. The New meeting command works out the series, the date
// (from the series' interval, day and start) and "since the last meeting" and hands them over as window.vtMeeting; run by hand
// (no hand-over) it makes a Weekly meetings note for the next Thursday.
const vt = window.vtMeeting;
delete window.vtMeeting;
const folder = vt ? vt.folder : "08 Meetings/Weekly meetings";
const series = vt ? vt.series : "Weekly meetings";
const d = vt ? moment(vt.date) : (moment().isoWeekday() <= 4 ? moment().isoWeekday(4) : moment().add(1, "weeks").isoWeekday(4));
const date = d.format("YYYY-MM-DD");
const since = vt ? vt.since : d.clone().subtract(7, "days").format("YYYY-MM-DD");
// The old "meeting: true" flag counts for the first series (by name) only
const names = app.vault.getMarkdownFiles().filter(f => app.metadataCache.getFileCache(f)?.frontmatter?.kind === "meeting-series").map(f => f.basename).sort((a, b) => a.localeCompare(b));
const first = !names.length || names[0] === series;
// A one-off meeting (New one-off meeting) has a title and may belong to a project
const label = vt && vt.title ? vt.title : series;
let name = `${date} ${label}`, n = 2;
while (await tp.file.exists(`${folder}/${name}.md`)) { name = `${date} ${label} ${n++}`; }
await tp.file.move(`${folder}/${name}`);
-%>
---
kind: meeting
series: "[[<% series %>]]"
date: <% date %>
since: <% since %>
<% vt && vt.project ? `project:\n  - "[[${vt.project}]]"` : "project:" %>
cssclasses:
  - vt
---

`BUTTON[go-deck, go-meetings]`

> [!focus] To discuss
> - 

> [!question] Flagged for this meeting
> ```dataview
> LIST WITHOUT ID file.link
> FROM "00 Planning/To-dos"
> WHERE kind = "todo" AND (meeting = link("<% series %>")<% first ? " OR meeting = true" : "" %>) AND !done AND day != "Done"
> ```

## Notes
- 
