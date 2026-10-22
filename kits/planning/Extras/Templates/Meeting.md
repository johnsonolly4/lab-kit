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

> [!columns]
> > [!lab] Experiments
> > ```vault-card
> > show: meeting-experiments
> > ```
>
> > [!planning] Done this week
> > ```vault-card
> > show: meeting-done
> > ```
>
> > [!projects] Papers read
> > ```refpane
> > show: papers-read
> > ```
>
> > [!question] Flagged for this meeting
> > ```vault-card
> > show: meeting-flagged
> > ```
> >
> > **Waiting on**
> > ```vault-card
> > show: waiting
> > ```

## Notes from the meeting
- 

> [!tip] Actions
> Turn each action into a to-do with **New to-do** (`Alt+T`) so it lands on the board.
