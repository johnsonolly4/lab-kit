<%*
// Meeting template - creates "YYYY-MM-DD <Series>" in the series' folder. The New meeting command works out the series, the date
// (from the series' interval, day and start) and "since the last meeting" and hands them over as window.vtMeeting; run by hand
// (no hand-over) it stops and says which command to use.
const vt = window.vtMeeting;
delete window.vtMeeting;
if (!vt) {
  new Notice("Use the New meeting command: it tells this template which meeting and date.", 8000);
  throw new Error("Meeting template run without the New meeting command");
}
const folder = vt.folder;
const series = vt.series;
const d = moment(vt.date);
const date = d.format("YYYY-MM-DD");
const since = vt.since;
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

```vault-card
show: meeting-bar
```

> [!focus] To discuss
> - 

> [!columns]
> > [!lab] Experiments
> > ```vault-card
> > show: meeting-experiments
> > ```
>
> > [!planning] Done this week
> > ```vault-card
> > show: meeting-done
> > ```
>
> > [!projects] Papers read
> > ```vault-card
> > show: meeting-papers
> > ```
>
> > [!question] Flagged for this meeting
> > ```dataview
> > LIST WITHOUT ID file.link
> > FROM "00 Planning/To-dos"
> > WHERE kind = "todo" AND (meeting = link("<% series %>")<% first ? " OR meeting = true" : "" %>) AND !done AND day != "Done"
> > ```

## Notes from the meeting
- 

> [!tip] Actions
> Turn each action into a to-do with **New to-do** (`Alt+T`) so it lands on the board.
