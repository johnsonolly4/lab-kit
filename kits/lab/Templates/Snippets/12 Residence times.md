---
title: Residence times
icon: waves
desc: Flow rate for each residence time from a reactor volume
required: rts
fields:
  - key: volume
    label: Reactor volume (mL)
    hint: type the volume, or link it like =column!B11
    value: "{{linked:column!B11}}"
  - key: rts
    label: Target residence times (min)
    hint: comma separated
    value: 2, 10, 20, 30
  - key: flows
    label: Flow rates to check (mL/min)
    hint: optional, comma separated
---
## Residence times
> [!info] Residence time
> $$\tau = \frac{V_{\text{reactor}}}{Q}$$

```calc
name: {{table:rt_in}}
title: Reactor
icon: waves
| Setting | Value |
|---|---|
| Reactor volume (mL) | {{volume}} |
```

```calc
name: {{table:rt}}
title: Flow rate for each residence time
icon: waves
| Residence time (min) | Flow rate (mL/min) | Time to steady state, 3 RTs (min) |
|---|---|---|
{{#each rts}}
| {{.}} | ={{table:rt_in}}!$B$2/A{{@i+2}} | =A{{@i+2}}*3 |
{{/each}}
```
{{#if flows}}

```calc
name: {{table:rt_check}}
title: Residence time for each flow rate
icon: waves
| Flow rate (mL/min) | Residence time (min) |
|---|---|
{{#each flows}}
| {{.}} | ={{table:rt_in}}!$B$2/A{{@i+2}} |
{{/each}}
```
{{/if}}

