---
make: note
name: "{{name}}"
folder: "{{folder}}"
fields:
  - key: name
    label: Project name
  - key: folder
    label: Folder
---
---
kind: project
Status: Active
deadline:
cssclasses:
  - vt
  - project
---

```vault-card
show: hub-bar
```

```vault-card
show: project-plan
```

```vault-card
show: project-map
```

> [!focus] Goal
> [goal:: ]

> [!columns]
> > [!planning] To-dos
> > ```vault-card
> > show: project-todos
> > ```
>
> > [!projects] Notes
> > ```vault-card
> > show: project-notes
> > ```

> [!question] Waiting on
> ```vault-card
> show: waiting
> ```

> [!lab] Experiments
> ```vault-card
> show: project-experiments
> ```

> [!question] Meetings
> ```vault-card
> show: project-meetings
> ```

> [!summary] Papers
> ```dataview
> LIST WITHOUT ID choice(contains(default(zotero_tags, list()), "/priority"), "&#9733; ", "") + link(file.path, paper_title) + " <span class='vt-muted'>&middot; " + default(join(map(filter(file.lists, (l) => contains(l.outlinks, this.file.link)), (l) => regexreplace(l.text, "^[^:]*:\\s*", "")), "; "), "") + "</span>"
> FROM "04 Literature"
> WHERE kind = "literature" AND (contains(default(collections, list()), "Projects/" + this.file.name) OR contains(file.outlinks, this.file.link))
> SORT contains(default(zotero_tags, list()), "/priority") DESC, Year DESC
> ```

> [!goto]- Done to-dos
> ```dataview
> LIST WITHOUT ID file.link
> FROM "00 Planning/To-dos"
> WHERE kind = "todo" AND project AND this.file.link AND project = this.file.link AND (done OR day = "Done")
> SORT default(done_on, file.mtime) DESC
> ```

## Related
- 
