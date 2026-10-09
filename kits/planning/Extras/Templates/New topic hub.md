<%*
// New topic hub template - creates the hub note "<topic>/<topic>" of a topic folder. The New topic hub command picks the topic and hands
// folder and name over as window.vtTopicHub; run by hand (no hand-over) it makes the hub for the folder it is created in, named like the folder.
const vt = window.vtTopicHub || { folder: tp.file.folder(true), name: tp.file.folder(true).split("/").pop() };
delete window.vtTopicHub;
await tp.file.move(`${vt.folder}/${vt.name}`);
-%>
---
kind: hub
cssclasses:
  - vt
---

What is this topic about? Write it here.

```dataview
LIST
FROM "<% vt.folder %>"
WHERE file.path != this.file.path
SORT file.name ASC
```
