// What the CURRENT Templater templates (tests/fixtures/templates/old/Meeting.md, One-off meeting.md, Meeting series.md) give, written out by hand
// (Templater's `-%>` trims the line break after its code block, so the note starts at the first `---`). Phase 4 of
// docs/plans/templater-replacement-and-live-snippets.md: the token templates must give these texts byte for byte.
const F = "```";

export interface MeetingCase { series: string; date: string; since: string; project?: string; title?: string; first?: boolean }

/** `project:` with a link when the one-off belongs to a project, else the empty key (the old `vt.project ? ... : "project:"`). */
const projectLines = (project?: string): string[] => (project ? ["project:", `  - "[[${project}]]"`] : ["project:"]);
const head = (c: MeetingCase): string[] => ["---", "kind: meeting", `series: "[[${c.series}]]"`, `date: ${c.date}`, `since: ${c.since}`, ...projectLines(c.project), "cssclasses:", "  - vt", "---", "", `${F}vault-card`, "show: meeting-bar", F, "", "> [!focus] To discuss", "> - ", ""];

/** The file name the old template moved the note to: `date` + label (the title of a one-off, else the series), then ` 2`, ` 3`... while that name is taken. */
export const meetingName = (c: MeetingCase, n = 1): string => `${c.date} ${c.title || c.series}${n > 1 ? ` ${n}` : ""}`;

/** Meeting.md (a regular series): the experiments / done / papers / flagged / waiting columns. */
export function expectedMeeting(c: MeetingCase): string {
  return [...head(c),
    "> [!columns]", "> > [!lab] Experiments", `> > ${F}vault-card`, "> > show: meeting-experiments", `> > ${F}`, ">",
    "> > [!planning] Done this week", `> > ${F}vault-card`, "> > show: meeting-done", `> > ${F}`, ">",
    "> > [!projects] Papers read", `> > ${F}vault-card`, "> > show: meeting-papers", `> > ${F}`, ">",
    "> > [!question] Flagged for this meeting", `> > ${F}vault-card`, "> > show: meeting-flagged", `> > ${F}`, "> >", "> > **Waiting on**", `> > ${F}vault-card`, "> > show: waiting", `> > ${F}`, "",
    "## Notes from the meeting", "- ", "",
    "> [!tip] Actions", "> Turn each action into a to-do with **New to-do** (`Alt+T`) so it lands on the board.", ""].join("\n");
}

/** One-off meeting.md: the small note. `first` = the series is the first by name (or the only one), so the old `meeting: true` flag counts. */
export function expectedOneOff(c: MeetingCase): string {
  return [...head(c),
    "> [!question] Flagged for this meeting", `> ${F}dataview`, "> LIST WITHOUT ID file.link", `> FROM "00 Planning/To-dos"`,
    `> WHERE kind = "todo" AND (meeting = link("${c.series}")${c.first ? " OR meeting = true" : ""}) AND !done AND day != "Done"`, `> ${F}`, "",
    "## Notes", "- ", ""].join("\n");
}

export interface SeriesCase { name: string; folder: string; interval: string; day: string; start: string; deckKey: "deck_windows" | "deck_mac"; deck: string; template?: string }

/** Meeting series.md: the hub. The deck path sits under the key of this computer, the other deck key is `""`; `template` is JSON too. */
export function expectedSeries(c: SeriesCase): string {
  const deck = (key: string): string => JSON.stringify(key === c.deckKey ? c.deck : "");
  return [
    "---", "kind: meeting-series", `interval: ${c.interval}`, `day: ${c.day}`, `start: ${c.start}`, "cssclasses:", "  - vt",
    `deck_windows: ${deck("deck_windows")}`, `deck_mac: ${deck("deck_mac")}`, `template: ${JSON.stringify(c.template || "")}`, "---", "",
    `${F}vault-card`, "show: hub-bar", F, "",
    "> [!goto]- Deck location (one path per computer)", "> Windows `INPUT[text(placeholder(Windows path)):deck_windows]`", ">", "> Mac `INPUT[text(placeholder(Mac path)):deck_mac]`", ">",
    "> The **Meeting deck** button opens this location: either a folder with all the decks in, or the path to one deck file.", ">",
    "> To copy a path: on Windows, Shift + right-click the file > *Copy as path*. On a Mac, right-click the file in Finder, hold Option > *Copy ... as Pathname*. Change both when the deck moves.", "",
    "> [!note]- How meeting prep works",
    "> - During the week, set **meeting** on any to-do you want to raise (New to-do asks which meeting when you have several series) - it shows up under *Flagged for this meeting*.",
    "> - The meeting note is made from the kit's **Meeting** template (a one-off meeting from **One-off meeting**). To use your own, write the name of a template note in `template` at the top of this note; start it as a copy of the kit's Meeting template.",
    "> - How often this meeting is held comes from `interval` (weekly, fortnightly, monthly or every N weeks), `day` and `start` at the top of this note.",
    "> - Before the meeting press **New meeting note**. It fills itself with the experiments, finished to-dos and papers read since the last one.",
    "> - Copy what you need into the deck, then add the outcomes under *Notes from the meeting* and turn actions into to-dos.", "",
    "> [!summary] All meetings", `> ${F}dataview`, `> TABLE WITHOUT ID file.link AS "Meeting", date AS "Date"`, `> FROM "${c.folder}"`, `> WHERE kind = "meeting"`, "> SORT date DESC", `> ${F}`, ""].join("\n");
}
