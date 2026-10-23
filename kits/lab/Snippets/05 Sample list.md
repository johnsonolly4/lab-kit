---
title: Sample list
icon: list
desc: Untimed list of sample codes, typed or generated
group: Samples
fields:
  - key: codes
    label: Sample codes
    type: textarea
    hint: one per line or comma separated · leave blank to generate
  - key: count
    label: …or generate this many
    type: number
    value: "6"
---
## Samples
```calc
name: {{table:samples}}
title: Samples
icon: list
copy: column A
codes: column A
| Code | Description | Notes |
|---|---|---|
{{#if codes}}
{{#each codes}}
| {{.}} |  |  |
{{/each}}
{{else}}
{{#repeat count|1}}
| {{code}} |  |  |
{{/repeat}}
{{/if}}
```

