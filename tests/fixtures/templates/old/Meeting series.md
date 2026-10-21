<%*
// Meeting series template - creates the hub note "<name>/<name>" of a new meeting series. The New meeting series command asks name, interval,
// day, first date and deck path and hands them over as window.vtSeries; run by hand (no hand-over) it stops and says which command to use.
const vt = window.vtSeries;
delete window.vtSeries;
if (!vt) {
  new Notice("Use the New meeting series command: it asks the name, how often and the day.", 8000);
  throw new Error("Meeting series template run without the New meeting series command");
}
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
template: <% JSON.stringify(vt.template || "") %>
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
> FROM "<% vt.folder %>"
> WHERE kind = "meeting"
> SORT date DESC
> ```
