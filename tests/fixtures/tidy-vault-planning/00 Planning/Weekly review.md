---
cssclasses:
  - vt
---
# Weekly review

> [!summary] Backlog
> ```dataview
> LIST WITHOUT ID file.link + choice(due, " <span class='vt-muted'>&middot; due " + dateformat(due, "d MMM") + "</span>", "")
> FROM "00 Planning/To-dos"
> WHERE kind = "todo" AND day = "Backlog" AND !done
> SORT due ASC
> ```
