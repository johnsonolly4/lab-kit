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
> ```refpane
> show: project-papers
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
