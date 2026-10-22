---
kind: hub
cssclasses:
  - vt
---

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
