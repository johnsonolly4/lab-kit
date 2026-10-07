<%*
// Meeting template - creates "YYYY-MM-DD <Series>" in the series' folder. The New meeting command works out the series, the date
// (from the series' cadence, day and start) and "since the last meeting" and hands them over as window.vtMeeting; run by hand
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
let name = `${date} ${series}`, n = 2;
while (await tp.file.exists(`${folder}/${name}.md`)) { name = `${date} ${series} ${n++}`; }
await tp.file.move(`${folder}/${name}`);
-%>
---
kind: meeting
series: "[[<% series %>]]"
date: <% date %>
since: <% since %>
cssclasses:
  - vt
---

# <% series %> - <% d.format("dddd D MMMM") %>

`BUTTON[go-deck, go-meetings]`

> [!focus] To discuss
> - 

> [!columns]
> > [!lab] Experiments this week
> > ```dataview
> > LIST WITHOUT ID file.link + " <span class='vt-badge vt-" + lower(replace(Status, " ", "-")) + "'>" + lower(Status) + "</span>"
> > FROM "03 Lab Book/Notes"
> > WHERE file.mtime > this.since AND file.mtime < this.date + dur(1 day)
> > SORT file.name ASC
> > ```
>
> > [!planning] Done this week
> > ```dataview
> > LIST WITHOUT ID file.link + choice(project, " <span class='vt-muted'>&middot; " + project + "</span>", "")
> > FROM "00 Planning/To-dos"
> > WHERE kind = "todo" AND done AND done_on > this.since AND done_on <= this.date
> > ```
>
> > [!projects] Papers read
> > ```dataview
> > LIST WITHOUT ID link(file.path, Title) + choice(takeaway, " <span class='vt-muted'>&middot; " + takeaway + "</span>", "")
> > FROM "04 Literature"
> > WHERE kind = "literature" AND striptime(default(imported, file.ctime)) > this.since AND striptime(default(imported, file.ctime)) <= this.date
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
> Turn each action into a to-do with **New to-do** (`Ctrl+Shift+T`) so it lands on the board.
