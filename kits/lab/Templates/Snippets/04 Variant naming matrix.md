---
title: Variant naming matrix
icon: grid-3x3, layout-grid
desc: Rows × columns → sample codes; Copy gives one column
required: rows
fields:
  - key: rows
    label: Row items
    hint: e.g. acids, comma separated
    placeholder: e.g. acid 1, acid 2
  - key: cols
    label: Column items
    hint: e.g. alcohols, comma separated
    placeholder: e.g. alcohol 1, alcohol 2
---
## Variant naming matrix
```calc
name: {{table:variants}}
title: Variant naming matrix
icon: grid-3x3
copy: list
|  | {{#if cols}}{{#each cols | " | "}}{{.}}{{/each}}{{else}}Code{{/if}} |
|{{#if cols}}{{#each cols}}---|{{/each}}{{else}}---|{{/if}}---|
{{#each rows as r}}
| **{{r}}** | {{#if cols}}{{#each cols | " | "}}{{code}}{{/each}}{{else}}{{code}}{{/if}} |
{{/each}}
```


