---
kind: meeting-series
interval: weekly
day: Thu
start: 2026-10-01
cssclasses:
  - vt
deck_windows: ""
deck_mac: ""
---


`BUTTON[go-deck, new-meeting]`

> [!goto]- Thursday deck location (one path per computer)
> Windows `INPUT[text(placeholder(Windows path)):deck_windows]`
>
> Mac `INPUT[text(placeholder(Mac path)):deck_mac]`
>
> To copy a path: on Windows, Shift + right-click the file > *Copy as path*. On a Mac, right-click the file in Finder, hold Option > *Copy ... as Pathname*. Change both at the start of each term.

> [!note]- How Thursday prep works
> - During the week, set **meeting** on any to-do you want to raise (New to-do asks which meeting when you have several series) - it shows up under *Flagged for this meeting*.
> - How often this meeting is held comes from `interval` (weekly, fortnightly or monthly), `day` and `start` at the top of this note. Another meeting series is another note like this one in a folder of its own, with `kind: meeting-series`.
> - On Wednesday or Thursday morning press **New meeting note**. It fills itself with this week's experiments, finished to-dos and papers read.
> - Copy what you need into the deck, then add the outcomes under *Notes from the meeting* and turn actions into to-dos.

> [!summary] All meetings
> ```dataview
> TABLE WITHOUT ID file.link AS "Meeting", date AS "Date"
> FROM "08 Meetings/Weekly meetings"
> WHERE kind = "meeting"
> SORT date DESC
> ```
