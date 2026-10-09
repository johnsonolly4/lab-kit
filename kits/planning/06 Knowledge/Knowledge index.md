---
kind: hub
cssclasses:
  - vt
---

> [!info]- How knowledge notes work
> - One idea per note, filed in a topic folder. Make one with the **New concept** template.
> - `summary`: one line saying what the note is.
> - `sources`: links or references that back it up.
> - `checked`: `true` once you have checked it against its sources.
> - A comparison is a concept note with a table. A topic hub is the index note of a topic folder (`kind: hub`). Make one with the **New topic hub** command.
> - Section headings use `##`.

```dataview
LIST rows.file.link
FROM "06 Knowledge"
WHERE file.path != this.file.path AND file.name != replace(file.folder, "06 Knowledge/", "")
GROUP BY link(file.folder + "/" + replace(file.folder, "06 Knowledge/", ""), replace(file.folder, "06 Knowledge/", "")) AS Topic
SORT Topic ASC
```

