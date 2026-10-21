// Meeting notes without Templater (docs/plans/templater-replacement-and-live-snippets.md, Phase 4): the vault's Meeting.md, One-off meeting.md and
// Meeting series.md are token templates (`make: note`), filled by noteFromTemplate. The bundled copies below are what is used when the vault has none,
// or only an old Templater one (Q7, owner 2026-10-21); a test keeps them equal to the kit files.
import type { TFile, Vault } from "obsidian";
import { noteFromTemplate, type MadeNote } from "../kit/note-template";
import { parseTemplate } from "../kit/snippet-template";
import type { Series } from "./meetings";

/** The bundled Meeting.md (a regular series). */
export const MEETING_TEMPLATE = `---
make: note
name: "{{date}} {{label}}"
folder: "{{folder}}"
fields:
  - key: series
    label: Series
  - key: folder
    label: Folder
  - key: date
    label: Date
  - key: since
    label: Since
  - key: label
    label: Title
  - key: project
    label: Project
---
---
kind: meeting
series: "[[{{series}}]]"
date: {{date}}
since: {{since}}
{{#if project != ""}}
project:
  - "[[{{project}}]]"
{{else}}
project:
{{/if}}
cssclasses:
  - vt
---

\`\`\`vault-card
show: meeting-bar
\`\`\`

> [!focus] To discuss
> - 

> [!columns]
> > [!lab] Experiments
> > \`\`\`vault-card
> > show: meeting-experiments
> > \`\`\`
>
> > [!planning] Done this week
> > \`\`\`vault-card
> > show: meeting-done
> > \`\`\`
>
> > [!projects] Papers read
> > \`\`\`vault-card
> > show: meeting-papers
> > \`\`\`
>
> > [!question] Flagged for this meeting
> > \`\`\`vault-card
> > show: meeting-flagged
> > \`\`\`
> >
> > **Waiting on**
> > \`\`\`vault-card
> > show: waiting
> > \`\`\`

## Notes from the meeting
- 

> [!tip] Actions
> Turn each action into a to-do with **New to-do** (\`Alt+T\`) so it lands on the board.
`;

/** The bundled One-off meeting.md. */
export const ONE_OFF_TEMPLATE = `---
make: note
name: "{{date}} {{label}}"
folder: "{{folder}}"
fields:
  - key: series
    label: Series
  - key: folder
    label: Folder
  - key: date
    label: Date
  - key: since
    label: Since
  - key: label
    label: Title
  - key: project
    label: Project
  - key: first
    label: Old flag counts for this series
---
---
kind: meeting
series: "[[{{series}}]]"
date: {{date}}
since: {{since}}
{{#if project != ""}}
project:
  - "[[{{project}}]]"
{{else}}
project:
{{/if}}
cssclasses:
  - vt
---

\`\`\`vault-card
show: meeting-bar
\`\`\`

> [!focus] To discuss
> - 

> [!question] Flagged for this meeting
> \`\`\`dataview
> LIST WITHOUT ID file.link
> FROM "00 Planning/To-dos"
> WHERE kind = "todo" AND (meeting = link("{{series}}"){{#if first != ""}} OR meeting = true{{/if}}) AND !done AND day != "Done"
> \`\`\`

## Notes
- 
`;

/** The bundled Meeting series.md (the hub note). */
export const SERIES_TEMPLATE = `---
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

\`\`\`vault-card
show: hub-bar
\`\`\`

> [!goto]- Deck location (one path per computer)
> Windows \`INPUT[text(placeholder(Windows path)):deck_windows]\`
>
> Mac \`INPUT[text(placeholder(Mac path)):deck_mac]\`
>
> The **Meeting deck** button opens this location: either a folder with all the decks in, or the path to one deck file.
>
> To copy a path: on Windows, Shift + right-click the file > *Copy as path*. On a Mac, right-click the file in Finder, hold Option > *Copy ... as Pathname*. Change both when the deck moves.

> [!note]- How meeting prep works
> - During the week, set **meeting** on any to-do you want to raise (New to-do asks which meeting when you have several series) - it shows up under *Flagged for this meeting*.
> - The meeting note is made from the kit's **Meeting** template (a one-off meeting from **One-off meeting**). To use your own, write the name of a template note in \`template\` at the top of this note; start it as a copy of the kit's Meeting template.
> - How often this meeting is held comes from \`interval\` (weekly, fortnightly, monthly or every N weeks), \`day\` and \`start\` at the top of this note.
> - Before the meeting press **New meeting note**. It fills itself with the experiments, finished to-dos and papers read since the last one.
> - Copy what you need into the deck, then add the outcomes under *Notes from the meeting* and turn actions into to-dos.

> [!summary] All meetings
> \`\`\`dataview
> TABLE WITHOUT ID file.link AS "Meeting", date AS "Date"
> FROM "{{folder}}"
> WHERE kind = "meeting"
> SORT date DESC
> \`\`\`
`;

/** The template to use: the vault's text when it is a token template (`make: note`), else the bundled one (an old Templater file, or none). */
export function tokenTemplate(vaultText: string | null, bundled: string, parseYaml: (yaml: string) => unknown): string {
  return isTokenTemplate(vaultText, parseYaml) ? vaultText! : bundled;
}

/** True for a note template in the new format (`make: note`). */
export function isTokenTemplate(text: string | null, parseYaml: (yaml: string) => unknown): boolean {
  try { return !!text && parseTemplate(text, parseYaml)?.header.make === "note"; } catch { return false; }
}

/** What New meeting works out for a meeting note. `title` is a one-off's title; `first`: this series is the first by name, so the old `meeting: true` flag counts. */
export interface MeetingNote { series: string; folder: string; date: string; since: string; title?: string; project?: string; first?: boolean }

/** The answers the Meeting and One-off meeting templates are filled with; `label` is the title of a one-off, else the series (the note's name after the date). */
export function meetingAnswers(m: MeetingNote): Record<string, string> {
  return { series: m.series, folder: m.folder, date: m.date, since: m.since, label: m.title || m.series, project: m.project || "", first: m.first ? "1" : "" };
}

/** What New meeting series works out for the hub note: `deckKey` names the deck property of this computer (the other one stays empty). */
export interface SeriesNote { name: string; folder: string; interval: string; day: string; start: string; deckKey: string; deck: string; template?: string }

export function seriesAnswers(s: SeriesNote): Record<string, string> {
  return { name: s.name, folder: s.folder, interval: s.interval, day: s.day, start: s.start, template: s.template || "",
    deck_windows: s.deckKey === "deck_windows" ? s.deck : "", deck_mac: s.deckKey === "deck_mac" ? s.deck : "" };
}

/** The first series by name: the one whose to-dos the old `meeting: true` flag belongs to (also true when there is none yet). Every series counts, the One-off hub too, as the old template read them. */
export const isFirstSeries = (all: Series[], name: string): boolean => {
  const names = all.map(s => s.name).sort((a, b) => a.localeCompare(b));
  return !names.length || names[0] === name;
};

/** The meeting note's text, its name and its folder from `template`; a template without `name` / `folder` in its header gets `fallbackName` / `fallbackFolder`. Throws a TemplateError for a template that cannot be filled. */
export function madeNote(template: string, parseYaml: (yaml: string) => unknown, answers: Record<string, string>, now: Date, fallbackName: string, fallbackFolder: string, noteName?: string): MadeNote {
  const run = (name?: string): MadeNote => noteFromTemplate(template, answers, { parseYaml, now, folder: fallbackFolder, ...(name ? { noteName: name } : {}) });
  const made = run(noteName);
  return made.name || !fallbackName ? made : { ...run(noteName ?? fallbackName), name: fallbackName };
}

/** Makes the note in its folder (which exists) and returns the file. A taken name gets ` 2`, ` 3`... (as the old template did) unless `unique` is false (then the caller has checked). */
export function createMadeNote(vault: Vault, template: string, parseYaml: (yaml: string) => unknown, answers: Record<string, string>, now: Date, fallbackName: string, fallbackFolder: string, unique = true): Promise<TFile> {
  const first = madeNote(template, parseYaml, answers, now, fallbackName, fallbackFolder);
  let name = first.name, n = 2;
  const path = (): string => `${first.folder}/${name}.md`;
  if (unique) while (vault.getAbstractFileByPath(path())) name = `${first.name} ${n++}`;
  // a template that writes {{note-name}} gets the name the note really has
  const text = name === first.name ? first.text : madeNote(template, parseYaml, answers, now, fallbackName, fallbackFolder, name).text;
  return vault.create(path(), text);
}
