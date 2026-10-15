<%*
// New project note - files a new note in a project's folder.
// Folder comes from: a Projects overview card, else the project you're in, else you pick one.
// The plugin's window (title + project chip) hands both over in window.vtNote; run without it, the boxes below ask.
const preset = window.vtNote;
delete window.vtNote;
let folder = preset ? preset.folder : window.vtNewNoteFolder;
delete window.vtNewNoteFolder;
const here = tp.config.active_file;
if (!folder && here && here.path.startsWith("02 Projects/") && here.parent.path !== "02 Projects") { folder = here.parent.path; }
if (!folder) {
  const hubs = app.vault.getMarkdownFiles()
    .filter(f => f.path.startsWith("02 Projects/") && app.metadataCache.getFileCache(f)?.frontmatter?.kind === "project")
    .sort((a, b) => a.basename.localeCompare(b.basename));
  const pick = await tp.system.suggester(hubs.map(h => h.basename), hubs, false, "Which project?");
  if (!pick) { throw new Error("Cancelled - no project picked"); }
  folder = pick.parent.path;
}
let title = preset ? preset.title : await tp.user.vtAsk(tp, "Note title");
if (!title) { throw new Error("Cancelled - no title"); }
title = title.replace(/[\\/:*?"<>|#^\[\]]/g, "").trim();
await tp.file.move(`${folder}/${title}`);
// project: the folder's hub note (named like the folder), when it exists
const hubName = folder.split("/").pop();
const hasHub = hubName && app.vault.getAbstractFileByPath(`${folder}/${hubName}.md`);
-%>
---
<% hasHub ? `project:\n  - "[[${hubName}]]"\n` : "" %>cssclasses:
  - vt
---

<% hasHub ? "```vault-card\nshow: back-to-project\n```\n" : "" %>

