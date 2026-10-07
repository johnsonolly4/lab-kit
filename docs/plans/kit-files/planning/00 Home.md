---
obsidianUIMode: preview
cssclasses:
  - home
  - vt
focus1: ""
focus2: ""
focus3: ""
focus1_done: false
focus2_done: false
focus3_done: false
---

# `= dateformat(date(today), "cccc d LLLL")` `BUTTON[help]`

`BUTTON[today, todo, lab, capture, shop-add, search]`

> [!goto] Go to
> `BUTTON[go-todo, go-lab, go-projects, go-lit, go-chem, go-know, go-howto, go-meetings, go-deck, go-review, go-shop]`

> [!focus] Today's focus
> `INPUT[toggle:focus1_done]` `INPUT[text(placeholder(1. Most important thing)):focus1]` `INPUT[toggle:focus2_done]` `INPUT[text(placeholder(2. Second)):focus2]` `INPUT[toggle:focus3_done]` `INPUT[text(placeholder(3. Third)):focus3]`
>
> `BUTTON[clear-focus]`

> [!columns]
> > [!planning] This week
> > ```dataview
> > LIST WITHOUT ID file.link + " " + choice(due AND due < date(today), "<span class='vt-badge vt-overdue'>overdue " + dateformat(due, "d MMM") + "</span>", choice(day = dateformat(date(today), "ccc"), "<span class='vt-badge vt-today'>today</span>", "<span class='vt-muted'>&middot; " + day + "</span>")) + choice(rolled, " <span class='vt-badge vt-rolled'>carried over</span>", "")
> > FROM "00 Planning/To-dos"
> > WHERE kind = "todo" AND !done AND day != "Done" AND (contains(list("Mon", "Tue", "Wed", "Thu", "Fri"), day) OR (due AND due < date(today)))
> > SORT choice(due AND due < date(today), 0, 1) ASC, choice(day = "Mon", 1, choice(day = "Tue", 2, choice(day = "Wed", 3, choice(day = "Thu", 4, choice(day = "Fri", 5, 6))))) ASC
> > ```
> > ```dataview
> > LIST WITHOUT ID "<span class='vt-muted'>Inbox: " + length(rows) + " to sort</span>"
> > FROM "00 Inbox"
> > GROUP BY true
> > ```
> > `BUTTON[sort-inbox]`
>
> > [!lab] Experiments on the go
> > ```dataview
> > LIST WITHOUT ID file.link + " <span class='vt-badge vt-" + lower(replace(Status, " ", "-")) + "'>" + lower(Status) + "</span>"
> > FROM "03 Lab Book/Notes"
> > WHERE Status AND Status != "Closed"
> > SORT choice(Status = "Started", 0, choice(Status = "Processing results", 1, 2)) ASC, file.name DESC
> > LIMIT 8
> > ```
>
> > [!projects] Projects
> > ```dataview
> > LIST WITHOUT ID file.link + " <span class='vt-badge vt-" + lower(Status) + "'>" + lower(Status) + "</span>"
> > FROM "02 Projects"
> > WHERE kind = "project"
> > SORT choice(Status = "Active", 0, choice(Status = "Paused", 1, 2)) ASC, file.name ASC
> > ```
>
> > [!summary] Recently read
> > ```dataview
> > LIST WITHOUT ID link(file.path, Title) + choice(takeaway, " <span class='vt-badge vt-closed'>processed</span>", choice(kind = "literature", " <span class='vt-badge vt-planned'>to process</span>", ""))
> > FROM "04 Literature"
> > WHERE kind = "literature"
> > SORT default(imported, file.ctime) DESC
> > LIMIT 5
> > ```
