---
make: note
name: "{{date}} {{label}}"
folder: "{{folder}}"
fields:
  - key: series
    label: Series
  - key: folder
    label: Folder
  - key: date
    label: Date
  - key: since
    label: Since
  - key: label
    label: Title
  - key: project
    label: Project
  - key: first
    label: Old flag counts for this series
---
---
kind: meeting
series: "[[{{series}}]]"
date: {{date}}
since: {{since}}
{{#if project != ""}}
project:
  - "[[{{project}}]]"
{{else}}
project:
{{/if}}
cssclasses:
  - vt
---

```vault-card
show: meeting-bar
```

> [!focus] To discuss
> - 

> [!question] Flagged for this meeting
> ```dataview
> LIST WITHOUT ID file.link
> FROM "00 Planning/To-dos"
> WHERE kind = "todo" AND (meeting = link("{{series}}"){{#if first != ""}} OR meeting = true{{/if}}) AND !done AND day != "Done"
> ```

## Notes
- 
