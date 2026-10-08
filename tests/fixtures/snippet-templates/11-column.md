---
title: Flow column prep
icon: cylinder, database
desc: Column weighing → bead mass → reactor volume
fields:
  - key: id
    label: Table id
    hint: other tables use e.g. column!B10 for the reactor volume
    value: column
  - key: solvent
    label: Solvent
    hint: optional · its note's Density fills the density below
    placeholder: e.g. solvent name
  - key: density
    label: Solvent density (g/mL)
    hint: blank = from the solvent's note, or fill in later
  - key: dead
    label: End-fitting dead volume (mL)
    value: "0.21"
  - key: packing
    label: Packing material
    hint: blank = fill in later
    placeholder: e.g. glass beads, 100 µm
---
## Column prep
```calc
name: {{table:$id|"column"}}
title: Column weighing
icon: cylinder
| State | Value |
|---|---|
| Empty column (blanking plugs, glass wool) (g) |  |
| Packed column (beads, plugs, glass wool) (g) |  |
| Packed + full of solvent (g) |  |
| Solvent density (g/mL) | {{density|note-number:solvent.Density}} |
| End-fitting dead volume (mL) | {{dead}} |
| Mass of beads (g) | =B3-B2 |
| Mass of solvent (g) | =B4-B3 |
| Solvent volume (mL) | =B8/B5 |
| Reactor volume (mL) | =B9-B6 |
| Packing material | {{packing}} |
```

