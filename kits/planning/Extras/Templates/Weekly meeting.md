<%*
// Weekly meeting template - creates "YYYY-MM-DD Weekly meeting" for the next Thursday (today if it is Thursday)
const d = moment().isoWeekday() <= 4 ? moment().isoWeekday(4) : moment().add(1, "weeks").isoWeekday(4);
const date = d.format("YYYY-MM-DD");
const folder = "08 Meetings/Weekly meetings";
let name = `${date} Weekly meeting`, n = 2;
while (await tp.file.exists(`${folder}/${name}.md`)) { name = `${date} Weekly meeting ${n++}`; }
await tp.file.move(`${folder}/${name}`);
-%>
---
kind: meeting
date: <% date %>
cssclasses:
  - vt
  - wide
---

# Weekly meeting - <% d.format("dddd D MMMM") %>

`BUTTON[go-deck, go-meetings]`

> [!focus] To discuss
> - 

> [!columns]
> > [!lab] Experiments this week
> > ```dataview
> > LIST WITHOUT ID file.link + " <span class='vt-badge vt-" + lower(replace(Status, " ", "-")) + "'>" + lower(Status) + "</span>"
> > FROM "03 Lab Book/Notes"
> > WHERE file.mtime > this.date - dur(7 days) AND file.mtime < this.date + dur(1 day)
> > SORT file.name ASC
> > ```
>
> > [!planning] Done this week
> > ```dataview
> > LIST WITHOUT ID file.link + choice(project, " <span class='vt-muted'>&middot; " + project + "</span>", "")
> > FROM "00 Planning/To-dos"
> > WHERE kind = "todo" AND done AND done_on > this.date - dur(7 days) AND done_on <= this.date
> > ```
>
> > [!projects] Papers read
> > ```dataview
> > LIST WITHOUT ID link(file.path, Title) + choice(takeaway, " <span class='vt-muted'>&middot; " + takeaway + "</span>", "")
> > FROM "04 Literature"
> > WHERE kind = "literature" AND striptime(default(imported, file.ctime)) > this.date - dur(7 days) AND striptime(default(imported, file.ctime)) <= this.date
> > ```
>
> > [!question] Flagged for this meeting
> > ```dataview
> > LIST WITHOUT ID file.link
> > FROM "00 Planning/To-dos"
> > WHERE kind = "todo" AND meeting = true AND !done AND day != "Done"
> > ```

## Notes from the meeting
- 

> [!tip] Actions
> Turn each action into a to-do with **New to-do** (`Ctrl+Shift+T`) so it lands on the board.
