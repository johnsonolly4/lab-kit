<%*
// New concept template - asks for a title and a topic, then files the note as 06 Knowledge/<Topic>/<Title>.md
let title = await tp.user.vtAsk(tp, "Concept title");
if (!title) { throw new Error("Cancelled - no title"); }   // Esc (null) or empty
title = title.replace(/[\\/:*?"<>|#^\[\]]/g, "").trim();
if (!title) { throw new Error("Cancelled - no title"); }
const root = "06 Knowledge";
const NEW_TOPIC = "(new topic...)";
const presetFolder = window.vtNewConceptFolder;   // a topic hub's New concept button: this topic, no question
delete window.vtNewConceptFolder;
const topics = (app.vault.getAbstractFileByPath(root)?.children ?? []).filter(c => c.children).map(c => c.name).sort((a, b) => a.localeCompare(b));
let topic = NEW_TOPIC;
if (presetFolder && presetFolder.startsWith(root + "/")) {
  topic = presetFolder.slice(root.length + 1);
} else if (topics.length) {
  topic = await tp.system.suggester([...topics, NEW_TOPIC], [...topics, NEW_TOPIC], false, "Which topic?");
  if (!topic) { throw new Error("Cancelled - no topic picked"); }
}
if (topic === NEW_TOPIC) {
  topic = await tp.user.vtAsk(tp, "Topic name (a folder under Knowledge)");
  if (!topic) { throw new Error("Cancelled - no topic"); }
  topic = topic.replace(/[\\/:*?"<>|#^\[\]]/g, "").trim();
  if (!topic) { throw new Error("Cancelled - no topic"); }
}
const folder = `${root}/${topic}`;
if (!app.vault.getAbstractFileByPath(folder)) { await app.vault.createFolder(folder); }
if (app.vault.getAbstractFileByPath(`${folder}/${title}.md`)) { throw new Error(`${title} already exists in ${folder}`); }
await tp.file.move(`${folder}/${title}`);
-%>
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
