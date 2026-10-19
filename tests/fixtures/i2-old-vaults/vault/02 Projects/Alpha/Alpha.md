---
kind: project
Status: Started
deadline: 2026-10-30
cssclasses:
  - vt
---

# Alpha

[goal:: Make a polymer library]

> [!goto]- Done to-dos
> ```dataview
> LIST WITHOUT ID file.link
> FROM "00 Planning/To-dos"
> WHERE kind = "todo" AND project AND this.file.link AND project = this.file.link AND (done OR day = "Done")
> SORT default(done_on, file.mtime) DESC
> ```
