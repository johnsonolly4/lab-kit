<%*
// Project hub template - asks for a name, then files the note as 02 Projects/<Name>/<Name>.md (a folder note)
let name = await tp.user.vtAsk(tp, "Project name (same as its Zotero collection under Projects/)");
if (!name) { throw new Error("Cancelled - no project name"); }
name = name.replace(/['&\\/:*?"<>|#^\[\]]/g, "").trim();
const folder = `02 Projects/${name}`;
if (!app.vault.getAbstractFileByPath(folder)) { await app.vault.createFolder(folder); }
await tp.file.move(`${folder}/${name}`);
-%>
---
kind: project
Status: Active
cssclasses:
  - vt
  - project
---

**Status:** `INPUT[inlineSelect(option(Active), option(Paused), option(Done)):Status]`

`BUTTON[todo, project-note]`

> [!focus] Goal
> [goal:: ]

> [!columns]
> > [!planning] To-dos
> > ```dataview
> > LIST WITHOUT ID file.link + choice(due AND due < date(today), " <span class='vt-badge vt-overdue'>overdue " + dateformat(due, "d MMM") + "</span>", " <span class='vt-muted'>&middot; " + day + "</span>")
> > FROM "00 Planning/To-dos"
> > WHERE kind = "todo" AND project AND this.file.link AND project = this.file.link AND !done AND day != "Done"
> > SORT choice(due AND due < date(today), 0, 1) ASC, choice(day = "Mon", 1, choice(day = "Tue", 2, choice(day = "Wed", 3, choice(day = "Thu", 4, choice(day = "Fri", 5, 6))))) ASC
> > ```
>
> > [!projects] Notes
> > ```dataview
> > LIST WITHOUT ID file.link + " <span class='vt-muted'>&middot; " + dateformat(file.mtime, "d MMM") + "</span>"
> > FROM "02 Projects"
> > WHERE this.file.folder AND startswith(file.folder, this.file.folder) AND file.path != this.file.path
> > SORT file.mtime DESC
> > ```

> [!summary] Papers
> ```dataview
> LIST WITHOUT ID choice(contains(row["Zotero Tags"], "key-paper"), "&#9733; ", "") + link(file.path, Title) + " <span class='vt-muted'>&middot; " + default(join(map(filter(file.lists, (l) => contains(l.outlinks, this.file.link)), (l) => regexreplace(l.text, "^[^:]*:\\s*", "")), "; "), "") + "</span>"
> FROM "04 Literature"
> WHERE kind = "literature" AND (contains(default(Collections, list()), "Projects/" + this.file.name) OR contains(file.outlinks, this.file.link))
> SORT contains(row["Zotero Tags"], "key-paper") DESC, Year DESC
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
