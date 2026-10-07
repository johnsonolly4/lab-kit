<%*
// Sort the inbox one note at a time. Run from the "Sort inbox" button.
// Each note opens so you can see it, then you pick where it goes. Esc or "Stop" ends at any point.
const INBOX = "00 Inbox";
const inboxNotes = () => app.vault.getMarkdownFiles()
  .filter(f => f.parent && f.parent.path === INBOX)
  .sort((a, b) => a.stat.ctime - b.stat.ctime);
const subfolders = root => app.vault.getAllLoadedFiles()
  .filter(f => f.children && (f.path === root || f.path.startsWith(root + "/")))
  .map(f => f.path).sort();
const clean = s => String(s).replace(/[\\/:*?"<>|#^\[\]]/g, "-").trim();
async function moveTo(file, folder, newName) {
  if (!app.vault.getAbstractFileByPath(folder)) { await app.vault.createFolder(folder); }
  const base = clean(newName || file.basename) || file.basename;
  let target = `${folder}/${base}.md`, i = 2;
  while (app.vault.getAbstractFileByPath(target) && target !== file.path) { target = `${folder}/${base} ${i++}.md`; }
  await app.fileManager.renameFile(file, target);
}
async function askName(file) {
  const name = await tp.user.vtAsk(tp, "Name (Enter keeps it)", file.basename);
  return name === null ? file.basename : name;
}
async function pickFolder(root, label) {
  const folders = subfolders(root);
  const pick = await tp.system.suggester([...folders, "+ New folder in " + root], [...folders, "__new__"], false, label);
  if (pick === "__new__") {
    const name = await tp.user.vtAsk(tp, "New folder name");
    return name ? `${root}/${clean(name)}` : null;
  }
  return pick;
}

const total = inboxNotes().length;
let sorted = 0, skipped = 0;
if (total === 0) {
  new Notice("The inbox is empty.");
} else {
  for (const file of inboxNotes()) {
    await app.workspace.getLeaf(false).openFile(file);
    const where = await tp.system.suggester(
      ["To-do (goes to Backlog)", "Project...", "Knowledge...", "How-to...", "Meetings...", "Archive", "Delete", "Skip for now", "Stop"],
      ["todo", "project", "knowledge", "howto", "meetings", "archive", "delete", "skip", "stop"],
      false, `${file.basename} - where does it go? (${sorted + skipped + 1} of ${total})`);
    if (where === null || where === "stop") { break; }
    if (where === "skip") { skipped++; continue; }

    if (where === "todo") {
      const name = await askName(file);
      await app.fileManager.processFrontMatter(file, fm => {
        fm.kind = "todo"; fm.day = "Backlog"; fm.done = false; fm.rolled = false;
        if (!("project" in fm)) { fm.project = ""; }
        if (!("due" in fm)) { fm.due = ""; }
        if (!("meeting" in fm)) { fm.meeting = false; }
      });
      await moveTo(file, "00 Planning/To-dos", name);
    } else if (where === "project") {
      const hubs = app.vault.getMarkdownFiles()
        .filter(f => app.metadataCache.getFileCache(f)?.frontmatter?.kind === "project")
        .sort((a, b) => a.basename.localeCompare(b.basename));
      const hub = await tp.system.suggester(hubs.map(h => h.basename), hubs, false, "Which project?");
      if (!hub) { skipped++; continue; }
      await moveTo(file, hub.parent.path, await askName(file));
    } else if (where === "knowledge" || where === "howto" || where === "meetings") {
      const root = { knowledge: "06 Knowledge", howto: "07 How-tos", meetings: "08 Meetings" }[where];
      const folder = await pickFolder(root, "Which folder?");
      if (!folder) { skipped++; continue; }
      await moveTo(file, folder, await askName(file));
    } else if (where === "archive") {
      await moveTo(file, "99 Archive/Inbox");
    } else if (where === "delete") {
      const sure = await tp.system.suggester(["Yes, delete it", "No, keep it"], [true, false], false, `Delete "${file.basename}"?`);
      if (!sure) { skipped++; continue; }
      await app.fileManager.trashFile(file);
    }
    sorted++;
  }
  const left = inboxNotes().length;
  new Notice(`Sorted ${sorted}. ${left === 0 ? "Inbox empty!" : left + " left in the inbox."}`);
  const home = app.metadataCache.getFirstLinkpathDest("00 Home", "");
  if (home) { await app.workspace.getLeaf(false).openFile(home); }
}
-%>
