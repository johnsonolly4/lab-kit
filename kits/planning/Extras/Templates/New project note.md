---
make: note
name: "{{title}}"
folder: "{{folder}}"
fields:
  - key: title
    label: Note title
  - key: folder
    label: Folder
  - key: hub
    label: Project hub
---
---
{{#if hub != ""}}
project:
  - "[[{{hub}}]]"
{{/if}}
cssclasses:
  - vt
---

{{#if hub != ""}}
```vault-card
show: back-to-project
```
{{/if}}


