---
Type:
  - Daily Note
kind: daily
Experiments:
cssclasses:
  - vt
  - wide
---

`BUTTON[todo, go-todo]`

> [!planning] Planned for today
> ```dataview
> LIST WITHOUT ID file.link + choice(project, " <span class='vt-muted'>&middot; " + project + "</span>", "") + choice(due AND due <= date(this.file.name), " <span class='vt-badge vt-overdue'>due " + dateformat(due, "d MMM") + "</span>", "")
> FROM "00 Planning/To-dos"
> WHERE kind = "todo" AND !done AND day != "Done" AND (day = dateformat(date(this.file.name), "ccc") OR (due AND due <= date(this.file.name)))
> SORT due ASC
> ```

## Notes
- 

## Today in the vault

> [!columns]
> > [!lab] Lab entries worked on
> > ```dataview
> > LIST WITHOUT ID file.link + " <span class='vt-badge vt-" + lower(replace(Status, " ", "-")) + "'>" + lower(Status) + "</span>"
> > FROM "03 Lab Book/Notes"
> > WHERE file.mtime >= date(this.file.name) AND file.mtime < date(this.file.name) + dur(1 day)
> > ```
>
> > [!planning] To-dos finished
> > ```dataview
> > LIST
> > FROM "00 Planning/To-dos"
> > WHERE kind = "todo" AND done AND done_on = date(this.file.name)
> > ```
>
> > [!projects] Papers read
> > ```dataview
> > LIST WITHOUT ID link(file.path, Title)
> > FROM "04 Literature"
> > WHERE kind = "literature" AND striptime(default(imported, file.ctime)) = date(this.file.name)
> > ```
