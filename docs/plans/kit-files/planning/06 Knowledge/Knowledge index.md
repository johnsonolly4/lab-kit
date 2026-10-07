---
cssclasses:
  - vt
---

```dataview
LIST rows.file.link
FROM "06 Knowledge"
WHERE file.path != this.file.path
GROUP BY replace(file.folder, "06 Knowledge/", "") AS Topic
SORT Topic ASC
```

