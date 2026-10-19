---
kind: meeting
series: "[[Weekly meetings]]"
date: 2026-10-15
since: 2026-10-08
project:
cssclasses:
  - vt
---

```vault-card
show: meeting-bar
```

> [!focus] To discuss
> - my own question about the **RAFT** run

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
> > ```vault-card
> > show: meeting-papers
> > ```
>
> > [!question] Flagged for this meeting
> > ```dataview
> > LIST WITHOUT ID file.link
> > FROM "00 Planning/To-dos"
> > WHERE kind = "todo" AND (meeting = link("Weekly meetings")) AND !done AND day != "Done"
> > ```
> >
> > **Waiting on**
> > ```vault-card
> > show: waiting
> > ```

## Notes from the meeting
- agreed to repeat 0005
- ```not a block```

> [!tip] Actions
> Turn each action into a to-do with **New to-do** (`Alt+T`) so it lands on the board.
