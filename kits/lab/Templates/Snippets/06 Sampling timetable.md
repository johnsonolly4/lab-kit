---
title: Sampling timetable
icon: timer
desc: Codes per time point with target clock times
required: times
fields:
  - key: times
    label: Time points
    hint: comma separated
    value: 0, 30, 60, 120
  - key: unit
    label: Time unit
    hint: min or h
    value: min
  - key: letters
    label: Sample letters
    hint: comma separated · blank = one sample
    value: "{{next-letter:sampling}}"
  - key: start
    label: Start time (hh:mm)
    hint: blank = fill in on the day
---
## Sampling timetable
```calc
name: {{table:sampling>_start}}
title: Start
icon: timer
| Setting | Value |
|---|---|
| Start time (hh:mm) | {{start}} |
```

```calc
name: {{table:sampling}}
title: Sampling timetable
icon: timer
copy: column A
| Code | Time ({{unit|"min"}}) | Target time | Taken at | Notes |
|---|---|---|---|---|
{{#each letters as L or ""}}
{{#each times as t}}
| {{prefix}}{{L}}{{t}} | {{t}} | =CLOCK({{table:sampling>_start}}!$B$2, B{{@seq+2}}{{#if unit ^= "h"}}*60{{/if}}) |  |  |
{{/each}}
{{/each}}
```

