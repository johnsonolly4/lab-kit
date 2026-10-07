---
kind: hub
cssclasses:
  - vt
  - wide
---

> [!note]- How I read
> 1. **Read in Zotero** and highlight with `1` **yellow** = key point, `2` **red** = disagree, confused or a question, `3` **green** = something to try in the lab. Add a **comment** for your own words, a **tag** to find it by topic later.
> 2. **In Zotero**: drag the paper into its project collection(s) under `Projects/`, and tag it `key-paper` if it matters most.
> 3. **Make the note**: `Ctrl+P` > **ZotLit: Create literature note**. Highlighted more later? Press **Update literature note** (`Alt+Shift+Z`). Updates never touch the Takeaway box or *My notes*.
> 4. **Process** (weekly review): write one line after `takeaway::`, then one line per project in *For my projects* - why it matters there. Link the paper, or one finding with `[[citekey#^`, from any experiment it informs.
>
> Put papers in a Zotero collection under `Projects/` *before* making the note - the project lines then fill themselves in. See them all on [[Projects overview]].

> [!columns]
> > [!focus] To process
> > ```dataview
> > LIST WITHOUT ID link(file.path, Title)
> > FROM "04 Literature"
> > WHERE kind = "literature" AND !takeaway
> > SORT default(imported, file.ctime) DESC
> > LIMIT 10
> > ```
>
> > [!projects] Key papers
> > ```dataview
> > LIST WITHOUT ID link(file.path, Title) + " <span class='vt-muted'>&middot; " + Year + "</span>"
> > FROM "04 Literature"
> > WHERE kind = "literature" AND contains(row["Zotero Tags"], "key-paper")
> > SORT Year DESC
> > ```

> [!lab] Ideas to try
> Every green highlight, newest papers first. Tried one? Tag the highlight `tried` in Zotero and update the paper - it drops off this list.
> ```dataview
> LIST WITHOUT ID L.text + " <span class='vt-muted'>&middot; " + link(file.path, Title) + "</span>"
> FROM "04 Literature"
> WHERE kind = "literature"
> SORT default(imported, file.ctime) DESC
> FLATTEN file.lists AS L
> WHERE meta(L.section).subpath = "To try" AND !contains(L.text, "#tried")
> LIMIT 15
> ```

> [!summary] Recently read
> ```dataview
> TABLE WITHOUT ID link(file.path, Title) AS "Paper", takeaway AS "Takeaway", Year
> FROM "04 Literature"
> WHERE kind = "literature"
> SORT default(imported, file.ctime) DESC
> LIMIT 15
> ```

> [!goto]- Papers by Zotero tag
> ```dataview
> LIST rows.file.link
> FROM "04 Literature"
> WHERE kind = "literature"
> FLATTEN row["Zotero Tags"] AS tag
> WHERE tag
> GROUP BY tag
> SORT tag ASC
> ```
