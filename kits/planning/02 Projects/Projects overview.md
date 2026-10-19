---
kind: hub
obsidianUIMode: preview
cssclasses:
  - vt
---

```vault-card
show: button-bar
ids: new-project
```

```vault-projects
```

> [!summary] Key papers by project
> ```dataview
> LIST rows.p
> FROM "04 Literature"
> WHERE kind = "literature" AND contains(row["Zotero Tags"], "key-paper")
> FLATTEN default(Collections, list()) AS c
> WHERE startswith(c, "Projects/")
> FLATTEN link(file.path, Title) + choice(takeaway, " <span class='vt-muted'>&middot; " + takeaway + "</span>", "") AS p
> GROUP BY link(replace(c, "Projects/", ""))
> SORT key ASC
> ```
