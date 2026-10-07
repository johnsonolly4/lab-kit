<%*
// Moves to-dos that were finished more than 30 days ago into 99 Archive/To-dos.
// Finished = done ticked (or day Done); date = done_on, else last modified.
// Run from the Weekly review button (Meta Bind runTemplaterFile).
const cutoff = moment().subtract(30, "days");
const folder = "99 Archive/To-dos";
if (!app.vault.getAbstractFileByPath(folder)) { await app.vault.createFolder(folder); }
const isDone = fm => fm && (fm.done === true || fm.day === "Done");
const doneDate = f => {
  const d = moment(String(app.metadataCache.getFileCache(f)?.frontmatter?.done_on ?? ""), "YYYY-MM-DD", true);
  return d.isValid() ? d : moment(f.stat.mtime);
};
const done = app.vault.getMarkdownFiles().filter(f =>
  f.path.startsWith("00 Planning/To-dos/") &&
  isDone(app.metadataCache.getFileCache(f)?.frontmatter) &&
  doneDate(f).isBefore(cutoff));
for (const f of done) {
  let target = `${folder}/${f.name}`, i = 2;
  while (app.vault.getAbstractFileByPath(target)) { target = `${folder}/${f.basename} ${i++}.md`; }
  await app.fileManager.renameFile(f, target);
}
new Notice(`Archived ${done.length} to-do${done.length === 1 ? "" : "s"}`);
-%>
