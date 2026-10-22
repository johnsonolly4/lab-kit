// Project hub, New project note, New concept and New topic hub without Templater (docs/plans/templater-replacement-and-live-snippets.md, Phase 6): the vault's
// templates are token templates (`make: note`), filled by noteFromTemplate. The bundled copies below are used when the vault has none, or only an old
// Templater one (Q7, owner 2026-10-21); a test keeps them equal to the kit files. The questions the old templates asked are asked here, in the entry window.
import type { EntryField, EntryValues } from "./entry-fields";

/** The bundled Project hub.md. */
export const PROJECT_HUB_TEMPLATE = `---
make: note
name: "{{name}}"
folder: "{{folder}}"
fields:
  - key: name
    label: Project name
  - key: folder
    label: Folder
---
---
kind: project
Status: Active
deadline:
cssclasses:
  - vt
  - project
---

\`\`\`vault-card
show: hub-bar
\`\`\`

\`\`\`vault-card
show: project-plan
\`\`\`

\`\`\`vault-card
show: project-map
\`\`\`

> [!focus] Goal
> [goal:: ]

> [!columns]
> > [!planning] To-dos
> > \`\`\`vault-card
> > show: project-todos
> > \`\`\`
>
> > [!projects] Notes
> > \`\`\`vault-card
> > show: project-notes
> > \`\`\`

> [!question] Waiting on
> \`\`\`vault-card
> show: waiting
> \`\`\`

> [!lab] Experiments
> \`\`\`vault-card
> show: project-experiments
> \`\`\`

> [!question] Meetings
> \`\`\`vault-card
> show: project-meetings
> \`\`\`

> [!summary] Papers
> \`\`\`dataview
> LIST WITHOUT ID choice(contains(default(zotero_tags, list()), "/priority"), "&#9733; ", "") + link(file.path, paper_title) + " <span class='vt-muted'>&middot; " + default(join(map(filter(file.lists, (l) => contains(l.outlinks, this.file.link)), (l) => regexreplace(l.text, "^[^:]*:\\\\s*", "")), "; "), "") + "</span>"
> FROM "04 Literature"
> WHERE kind = "literature" AND (contains(default(collections, list()), "Projects/" + this.file.name) OR contains(file.outlinks, this.file.link))
> SORT contains(default(zotero_tags, list()), "/priority") DESC, Year DESC
> \`\`\`

> [!goto]- Done to-dos
> \`\`\`dataview
> LIST WITHOUT ID file.link
> FROM "00 Planning/To-dos"
> WHERE kind = "todo" AND project AND this.file.link AND project = this.file.link AND (done OR day = "Done")
> SORT default(done_on, file.mtime) DESC
> \`\`\`

## Related
- 
`;

/** The bundled New project note.md. */
export const PROJECT_NOTE_TEMPLATE = `---
make: note
name: "{{title}}"
folder: "{{folder}}"
fields:
  - key: title
    label: Note title
  - key: folder
    label: Folder
  - key: hub
    label: Project hub
---
---
{{#if hub != ""}}
project:
  - "[[{{hub}}]]"
{{/if}}
cssclasses:
  - vt
---

{{#if hub != ""}}
\`\`\`vault-card
show: back-to-project
\`\`\`
{{/if}}


`;

/** The bundled New concept.md. */
export const CONCEPT_TEMPLATE = `---
make: note
name: "{{title}}"
folder: "{{folder}}"
fields:
  - key: title
    label: Concept title
  - key: folder
    label: Folder
---
---
kind: concept
summary:
sources: []
checked: false
cssclasses:
  - vt
---

## What it is

## Why it matters

## Related
- 
`;

/** The bundled New topic hub.md. */
export const TOPIC_HUB_TEMPLATE = `---
make: note
name: "{{name}}"
folder: "{{folder}}"
fields:
  - key: name
    label: Name
  - key: folder
    label: Folder
---
---
kind: hub
cssclasses:
  - vt
---

\`\`\`vault-card
show: hub-bar
\`\`\`

What is this topic about? Write it here.

\`\`\`dataview
LIST
FROM "{{folder}}"
WHERE file.path != this.file.path
SORT file.name ASC
\`\`\`
`;

/** A project name as the old Project hub template cleaned it. */
export const cleanProjectName = (s: string): string => s.replace(/['&\\/:*?"<>|#^[\]]/g, "").trim();
/** A note or topic name as the old New concept / New project note templates cleaned it. */
export const cleanNoteName = (s: string): string => s.replace(/[\\/:*?"<>|#^[\]]/g, "").trim();

/** The answers of the Project hub template: the hub is `<root>/<Name>/<Name>.md` (a folder note). */
export const projectHubAnswers = (root: string, name: string): Record<string, string> => ({ name, folder: `${root}/${name}` });

/** The answers of the New project note template; `hasHub`: the folder's hub note (named like the folder) exists, so the note links to it. */
export function projectNoteAnswers(folder: string, title: string, hasHub: boolean): Record<string, string> {
  return { title, folder, hub: hasHub ? folder.split("/").pop() ?? "" : "" };
}

/** The Topic chip's value for "a new topic": the New topic box then asks its name. */
export const NEW_TOPIC = "\u0000new-topic";

/**
 * New concept's questions after the title (the window's title box): Topic (the topic folders under Knowledge, and "(new topic…)") and, for a new
 * topic, its name. No Topic chip when the topic is given (a topic hub's New concept button); only the name box when there is no topic yet.
 */
export function conceptFields(topics: string[], preset = false): EntryField[] {
  if (preset) return [];
  const newName: EntryField = { key: "newTopic", name: "New topic", icon: "folder-plus", kind: "text", prompt: "Topic name (a folder under Knowledge)", required: true };
  if (!topics.length) return [newName];
  return [
    { key: "topic", name: "Topic", icon: "folder", kind: "pick", prompt: "Which topic?", required: true, options: [...topics.map(t => ({ label: t, value: t })), { label: "(new topic…)", value: NEW_TOPIC }] },
    { ...newName, showWhen: "topic", showValue: NEW_TOPIC },
  ];
}

/** The concept from the window: its title and topic folder, or what to tell the user. `exists` says whether a note path is taken. */
export function readConcept(root: string, title: string, values: EntryValues, presetFolder: string | undefined, exists: (path: string) => boolean): { title: string; folder: string } | { error: string } {
  const name = cleanNoteName(title);
  if (!name) return { error: "Type a title for the concept." };
  let folder = presetFolder && presetFolder.startsWith(root + "/") ? presetFolder : "";
  if (!folder) {
    const picked = values.topic === undefined || values.topic === NEW_TOPIC ? cleanNoteName(String(values.newTopic ?? "")) : String(values.topic);
    if (!picked) return { error: values.topic === NEW_TOPIC || values.topic === undefined ? "Type a name for the new topic." : "Pick a topic." };
    folder = `${root}/${picked}`;
  }
  if (exists(`${folder}/${name}.md`)) return { error: `${name} already exists in ${folder}` };
  return { title: name, folder };
}
