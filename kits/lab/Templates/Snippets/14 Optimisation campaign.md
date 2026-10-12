---
title: Optimisation campaign
icon: sliders-horizontal, target
desc: Record of an algorithm-led optimisation, with settings, variables and iterations
required: vars
fields:
  - key: vars
    label: Variables
    type: textarea
    hint: one per line with units · these become the columns of the iteration table
    placeholder: e.g. Temperature (°C)
  - key: objs
    label: Objectives
    hint: comma separated · what the algorithm maximises or minimises
    value: Objective
  - key: algo
    label: Algorithm, library and version
    hint: blank = fill in later
    placeholder: e.g. Bayesian optimisation, library name and version
  - key: acq
    label: Acquisition function
    hint: blank = fill in later
  - key: init
    label: Initial design
    hint: method and number of points · blank = fill in later
    placeholder: e.g. Latin hypercube, 8 points
  - key: seed
    label: Random seed
    hint: blank = fill in later
  - key: count
    label: Iteration rows to start with
    type: number
    value: "8"
---
## Optimisation campaign
```calc
name: {{table:opt_setup}}
title: Optimisation setup
icon: sliders-horizontal
| Setting | Value |
|---|---|
| Algorithm, library and version | {{algo}} |
| Surrogate model and kernel |  |
| Acquisition function | {{acq}} |
| Batch size |  |
| Random seed | {{seed}} |
| Initial design (method, points, seed) | {{init}} |
| Budget and stopping rule |  |
| Code (repository and commit) |  |
| Config file |  |
| Observations file (every point, to rebuild the model) |  |
| Control software and version |  |
| Steady-state rule before sampling |  |
```

```calc
name: {{table:opt_objectives}}
title: Objectives
icon: target
| Objective | Goal (max or min) | Calculated from |
|---|---|---|
{{#each objs}}
| {{.}} |  |  |
{{/each}}
```

```calc
name: {{table:opt_variables}}
title: Variables
icon: sliders-horizontal
| Variable | Type | Lower | Upper | Constraint |
|---|---|---|---|---|
{{#each vars}}
| {{.}} | continuous |  |  |  |
{{/each}}
```

```calc
name: {{table:opt_runs}}
title: Iterations
icon: list-ordered
codes: column B
| Iteration | Sample | Source | {{#each vars | " | "}}{{.}}{{/each}} | {{#each objs | " | "}}{{.}}{{/each}} | Notes |
|---|---|---|{{#each vars}}---|{{/each}}{{#each objs}}---|{{/each}}---|
{{#repeat count|8}}
| {{@n}} | {{code}} | initial | {{#each vars | " | "}}{{/each}} | {{#each objs | " | "}}{{/each}} |  |
{{/repeat}}
```
Source is one of: initial (from the initial design), model (suggested by the algorithm), manual (chosen by you).

