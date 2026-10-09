---
title: Blank calc table
icon: calculator
desc: Your own columns and rows
required: cols
fields:
  - key: cols
    label: Column headings
    hint: comma separated
    value: Item, Value, Result
  - key: rows
    label: Rows
    type: number
    value: "3"
  - key: id
    label: Table id
    hint: used in formulas from other tables
    value: calc1
---
```calc
name: {{table:$id|"calc1"}}
icon: calculator
| {{#each cols | " | "}}{{.}}{{/each}} |
|{{#each cols}}---|{{/each}}
{{#repeat rows|3}}
| {{#each cols | " | "}}{{/each}} |
{{/repeat}}
```

