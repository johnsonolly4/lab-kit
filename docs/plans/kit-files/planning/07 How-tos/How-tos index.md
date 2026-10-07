---
cssclasses:
  - vt
---

```dataview
LIST rows.file.link
FROM "07 How-tos"
WHERE file.path != this.file.path
GROUP BY replace(file.folder, "07 How-tos/", "") AS Topic
SORT Topic ASC
```
