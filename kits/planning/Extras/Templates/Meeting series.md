---
make: note
name: "{{name}}"
folder: "{{folder}}"
fields:
  - key: name
    label: Name
  - key: folder
    label: Folder
  - key: interval
    label: How often
  - key: day
    label: Day
  - key: start
    label: First meeting
  - key: deck_windows
    label: Deck (Windows)
  - key: deck_mac
    label: Deck (Mac)
  - key: template
    label: Meeting template
---
---
kind: meeting-series
interval: {{interval}}
day: {{day}}
start: {{start}}
cssclasses:
  - vt
deck_windows: {{json:deck_windows}}
deck_mac: {{json:deck_mac}}
template: {{json:template}}
---

```vault-card
show: hub-bar
```

> [!goto]- Deck location (one path per computer)
> Windows `INPUT[text(placeholder(Windows path)):deck_windows]`
>
> Mac `INPUT[text(placeholder(Mac path)):deck_mac]`
>
> The **Meeting deck** button opens this location: either a folder with all the decks in, or the path to one deck file.
>
> To copy a path: on Windows, Shift + right-click the file > *Copy as path*. On a Mac, right-click the file in Finder, hold Option > *Copy ... as Pathname*. Change both when the deck moves.

> [!note]- How meeting prep works
> - During the week, set **meeting** on any to-do you want to raise (New to-do asks which meeting when you have several series) - it shows up under *Flagged for this meeting*.
> - The meeting note is made from the kit's **Meeting** template (a one-off meeting from **One-off meeting**). To use your own, write the name of a template note in `template` at the top of this note; start it as a copy of the kit's Meeting template.
> - How often this meeting is held comes from `interval` (weekly, fortnightly, monthly or every N weeks), `day` and `start` at the top of this note.
> - Before the meeting press **New meeting note**. It fills itself with the experiments, finished to-dos and papers read since the last one.
> - Copy what you need into the deck, then add the outcomes under *Notes from the meeting* and turn actions into to-dos.

> [!summary] All meetings
> ```dataview
> TABLE WITHOUT ID file.link AS "Meeting", date AS "Date"
> FROM "{{folder}}"
> WHERE kind = "meeting"
> SORT date DESC
> ```
