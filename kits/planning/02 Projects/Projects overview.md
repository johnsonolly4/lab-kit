---
kind: hub
obsidianUIMode: preview
cssclasses:
  - vt
---

`BUTTON[new-project]`

```dataviewjs
// One card per project hub (kind: project) - see Vault spec > Projects overview
const TODO_TPL = "Extras/Templates/To-do.md";
const NOTE_TPL = "Extras/Templates/New project note.md";
const templater = app.plugins.plugins["templater-obsidian"]?.templater;
const today = dv.date("today");
const statusOrder = { Active: 0, Paused: 1, Done: 2 };
const dayOrder = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Backlog: 6 };

// Find hubs with Obsidian's own cache (not Dataview's), so a brand-new hub always gets a card
const hubs = app.vault.getMarkdownFiles()
  .filter(f => f.path.startsWith("02 Projects/") && app.metadataCache.getFileCache(f)?.frontmatter?.kind === "project")
  .map(f => {
    const fm = app.metadataCache.getFileCache(f).frontmatter;
    const page = dv.page(f.path);
    return { file: { path: f.path, name: f.basename, folder: f.parent.path }, Status: fm.Status, goal: page?.goal };
  })
  .sort((a, b) => ((statusOrder[a.Status] ?? 3) - (statusOrder[b.Status] ?? 3)) || a.file.name.localeCompare(b.file.name));
const todos = dv.pages('"00 Planning/To-dos"').where(t => t.kind === "todo" && t.day !== "Done" && t.done !== true);
const papers = dv.pages('"04 Literature"').where(p => p.kind === "literature");

function openLink(path, text, cls) {
  const a = createEl("a", { text, cls: "internal-link " + (cls ?? ""), attr: { href: path, "data-href": path } });
  a.addEventListener("click", e => { e.preventDefault(); app.workspace.openLinkText(path, "", e.ctrlKey || e.metaKey); });
  return a;
}
async function runTemplate(tplPath, folder) {
  if (!templater) { new Notice("Templater is not enabled"); return; }
  const tpl = app.vault.getAbstractFileByPath(tplPath);
  if (!tpl) { new Notice("Template not found: " + tplPath); return; }
  await templater.create_new_note_from_template(tpl, folder, undefined, true);
}
function toArr(v) {
  if (v == null) return [];
  if (typeof v === "string") return [v];
  return Array.isArray(v) ? v : Array.from(v);
}
function pointsTo(l, hub) {
  if (!l) return false;
  const p = typeof l === "string" ? l : l.path;
  return p === hub.file.path || p === hub.file.name || p.endsWith("/" + hub.file.name + ".md") || p.includes("[[" + hub.file.name);
}

const grid = dv.container.createDiv({ cls: "vt-cards" });
if (hubs.length === 0) grid.createDiv({ cls: "vt-muted", text: "No projects yet - press New project." });

for (const h of hubs) {
  const name = h.file.name, folder = h.file.folder;
  const mine = todos.where(t => toArr(t.project).some(l => pointsTo(l, h)))
    .sort(t => ((t.due && t.due < today) ? 0 : 1) * 10 + (dayOrder[t.day] ?? 8), "asc");
  const nPapers = papers.where(p =>
    toArr(p.Collections).includes("Projects/" + name) ||
    toArr(p.file.outlinks).some(l => pointsTo(l, h))).length;
  const nNotes = dv.pages(`"${folder}"`).where(n => n.file.path !== h.file.path).length;

  const card = grid.createDiv({ cls: "vt-card" });
  const head = card.createDiv({ cls: "vt-card-head" });
  head.appendChild(openLink(h.file.path, name, "vt-card-title"));
  if (h.Status) head.createSpan({ cls: "vt-badge vt-" + String(h.Status).toLowerCase(), text: String(h.Status).toLowerCase() });

  card.createDiv({ cls: "vt-card-goal", text: h.goal ? String(h.goal) : "No goal written yet" });

  const list = card.createEl("ul");
  if (mine.length === 0) list.createEl("li", { cls: "vt-muted", text: "No open to-dos" });
  for (const t of mine.slice(0, 3)) {
    const li = list.createEl("li");
    li.appendChild(openLink(t.file.path, t.file.name));
    if (t.due && t.due < today) li.createSpan({ cls: "vt-badge vt-overdue", text: "overdue " + t.due.toFormat("d MMM") });
    else li.createSpan({ cls: "vt-muted", text: " · " + (t.day ?? "") });
  }
  if (mine.length > 3) list.createEl("li", { cls: "vt-muted", text: "+ " + (mine.length - 3) + " more on the hub" });

  card.createDiv({ cls: "vt-muted", text: `${mine.length} open to-dos · ${nPapers} papers · ${nNotes} notes` });

  const actions = card.createDiv({ cls: "vt-card-actions" });
  const noteBtn = actions.createEl("button", { text: "New note" });
  noteBtn.addEventListener("click", () => { window.vtNewNoteFolder = folder; runTemplate(NOTE_TPL, folder); });
  const todoBtn = actions.createEl("button", { text: "New to-do" });
  todoBtn.addEventListener("click", () => { window.vtPresetProject = name; runTemplate(TODO_TPL); });
  const openBtn = actions.createEl("button", { text: "Open" });
  openBtn.addEventListener("click", () => app.workspace.openLinkText(h.file.path, ""));
}
```

> [!summary] Key papers by project
> ```dataview
> LIST rows.p
> FROM "04 Literature"
> WHERE kind = "literature" AND contains(row["Zotero Tags"], "key-paper")
> FLATTEN default(Collections, list()) AS c
> WHERE startswith(c, "Projects/")
> FLATTEN link(file.path, Title) + choice(takeaway, " <span class='vt-muted'>&middot; " + takeaway + "</span>", "") AS p
> GROUP BY link(replace(c, "Projects/", ""))
> SORT key ASC
> ```
