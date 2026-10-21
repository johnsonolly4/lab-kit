---
kind: review
cssclasses:
  - vt
r1: false
r2: false
r3: false
r4: false
r5: false
r6: false
---

> [!focus] Friday, 15 minutes
> `INPUT[toggle:r1]` **Empty the inbox** - one note at a time, pick where it goes `BUTTON[sort-inbox]`
>
> `INPUT[toggle:r2]` **Close finished experiments** `BUTTON[go-lab]`
>
> `INPUT[toggle:r3]` **Plan next week** - drag to-dos from Backlog onto days (a card dragged onto a day before today waits for next week) `BUTTON[go-todo]`
>
> `INPUT[toggle:r5]` **Meeting prep** - flag anything for the meeting `BUTTON[go-meetings]`
>
> `INPUT[toggle:r6]` **First Friday of the month:** archive finished to-dos older than 30 days `BUTTON[archive-todos]`
>
> `BUTTON[clear-review]`

> [!columns]
> > [!planning] Inbox
> > ```dataview
> > LIST
> > FROM "00 Inbox"
> > SORT file.ctime ASC
> > ```
>
> > [!lab] Experiments still open
> > ```dataview
> > LIST WITHOUT ID file.link + " <span class='vt-badge vt-" + lower(replace(Status, " ", "-")) + "'>" + lower(Status) + "</span>"
> > FROM "03 Lab Book/Notes"
> > WHERE Status AND Status != "Closed"
> > SORT file.name ASC
> > ```
>
> > [!summary] Backlog
> > ```dataview
> > LIST WITHOUT ID file.link + choice(due, " <span class='vt-muted'>&middot; due " + dateformat(due, "d MMM") + "</span>", "")
> > FROM "00 Planning/To-dos"
> > WHERE kind = "todo" AND !scheduled AND !contains(list("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Done"), day) AND !done
> > SORT due ASC
> > ```
