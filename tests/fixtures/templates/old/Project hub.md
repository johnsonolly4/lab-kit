<%*
// Project hub template - asks for a name, then files the note as 02 Projects/<Name>/<Name>.md (a folder note)
let name = await tp.user.vtAsk(tp, "Project name (same as its Zotero collection under Projects/)");
if (!name) { throw new Error("Cancelled - no project name"); }   // Esc (null) or empty
name = name.replace(/['&\\/:*?"<>|#^\[\]]/g, "").trim();
const folder = `02 Projects/${name}`;
// deadline: optional date property, set once here (Obsidian keeps it in .obsidian/types.json)
try { await window.vtEnsureType?.("deadline", "date"); } catch (e) { /* older Lab Kit or Obsidian: deadline stays text */ }
if (!app.vault.getAbstractFileByPath(folder)) { await app.vault.createFolder(folder); }
await tp.file.move(`${folder}/${name}`);
-%>
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
