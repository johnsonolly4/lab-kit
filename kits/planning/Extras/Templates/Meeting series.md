<%*
// Meeting series template - creates the hub note "<name>/<name>" of a new meeting series. The New meeting series command asks name, interval,
// day, first date and deck path and hands them over as window.vtSeries; run by hand (no hand-over) it makes a weekly Thursday series
// named like this note, in the folder it is created in.
const vt = window.vtSeries || {
  name: tp.file.title, folder: tp.file.folder(true), interval: "weekly", day: "Thu",
  start: (moment().isoWeekday() <= 4 ? moment().isoWeekday(4) : moment().add(1, "weeks").isoWeekday(4)).format("YYYY-MM-DD"),
  deckKey: "deck_windows", deck: "",
};
delete window.vtSeries;
const deck = (key) => JSON.stringify(key === vt.deckKey ? vt.deck : "");
await tp.file.move(`${vt.folder}/${vt.name}`);
-%>
---
kind: meeting-series
interval: <% vt.interval %>
day: <% vt.day %>
start: <% vt.start %>
cssclasses:
  - vt
deck_windows: <% deck("deck_windows") %>
deck_mac: <% deck("deck_mac") %>
---


`BUTTON[go-deck, new-meeting]`

> [!goto]- Deck location (one path per computer)
> Windows `INPUT[text(placeholder(Windows path)):deck_windows]`
>
> Mac `INPUT[text(placeholder(Mac path)):deck_mac]`
>
> To copy a path: on Windows, Shift + right-click the file > *Copy as path*. On a Mac, right-click the file in Finder, hold Option > *Copy ... as Pathname*. Change both at the start of each term.

> [!note]- How meeting prep works
> - During the week, set **meeting** on any to-do you want to raise (New to-do asks which meeting when you have several series) - it shows up under *Flagged for this meeting*.
> - How often this meeting is held comes from `interval` (weekly, fortnightly or monthly), `day` and `start` at the top of this note.
> - Before the meeting press **New meeting note**. It fills itself with the experiments, finished to-dos and papers read since the last one.
> - Copy what you need into the deck, then add the outcomes under *Notes from the meeting* and turn actions into to-dos.

> [!summary] All meetings
> ```dataview
> TABLE WITHOUT ID file.link AS "Meeting", date AS "Date"
> FROM "<% vt.folder %>"
> WHERE kind = "meeting"
> SORT date DESC
> ```
