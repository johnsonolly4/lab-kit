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
> ```vault-goto
> extra: Weekly review | Weekly review | list-checks
> extra: Shopping list | Shopping list | shopping-cart
> ```

> [!focus] Today's focus
> `INPUT[toggle:focus1_done]` `INPUT[text(placeholder(1. Most important thing)):focus1]` `INPUT[toggle:focus2_done]` `INPUT[text(placeholder(2. Second)):focus2]` `INPUT[toggle:focus3_done]` `INPUT[text(placeholder(3. Third)):focus3]`
>
> `BUTTON[clear-focus]`

> [!columns]
> > [!planning] [[To-do board.base|This week]]
> > ```vault-card
> > show: this-week
> > ```
> > ```vault-card
> > show: inbox
> > ```
>
> > [!lab] [[Lab book base.base|Experiments on the go]]
> > ```vault-card
> > show: experiments
> > limit: 8
> > ```
>
> > [!projects] [[Projects overview|Projects]]
> > ```vault-card
> > show: projects
> > ```
>
> > [!summary] [[Literature|Recently read]]
> > ```vault-card
> > show: recently-read
> > limit: 5
> > ```
>
> > [!question] [[Meetings|Next meetings]]
> > ```vault-card
> > show: next-meetings
> > ```
