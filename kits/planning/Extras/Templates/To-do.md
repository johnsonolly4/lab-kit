---
make: note
fields:
  - key: text
    label: To-do
  - key: scheduled
    label: Day
  - key: project
    label: Project
  - key: due
    label: Due
  - key: priority
    label: Priority
  - key: after
    label: Comes after
  - key: meeting
    label: Meeting
  - key: experiment
    label: Experiment
  - key: waiting
    label: Waiting for
---
---
kind: todo
{{#if scheduled != ""}}
scheduled: {{scheduled}}
{{/if}}
done: false
{{#if project != ""}}
project: "[[{{project}}]]"
{{/if}}
{{#if due != ""}}
due: {{due}}
{{/if}}
{{#if priority != ""}}
priority: {{priority}}
{{/if}}
{{#if after != ""}}
after: "[[{{after}}]]"
{{/if}}
{{#if meeting != ""}}
meeting: "[[{{meeting}}]]"
{{/if}}
{{#if experiment != ""}}
experiment: "[[{{experiment}}]]"
{{/if}}
{{#if waiting != ""}}
waiting: {{json:waiting}}
{{/if}}
cssclasses:
  - vt
---

```vault-card
show: todo-bar
```
