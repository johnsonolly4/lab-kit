---
make: note
name: "{{name}}"
folder: "{{folder}}"
fields:
  - key: name
    label: Name
  - key: folder
    label: Folder
---
---
kind: hub
cssclasses:
  - vt
---

```vault-card
show: hub-bar
```

What is this topic about? Write it here.

```dataview
LIST
FROM "{{folder}}"
WHERE file.path != this.file.path
SORT file.name ASC
```
