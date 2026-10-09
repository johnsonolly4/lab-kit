<%*
// To-do template - always files the new to-do in 00 Planning/To-dos (see Vault spec)
// Project is filled in automatically when started from a project card or from inside a project;
// otherwise it asks (Enter on "(no project)" = none). Esc in any box cancels the whole to-do.
const folder = "00 Planning/To-dos";
// Text box: same look as the project picker (Extras/scripts/templater/vault/vtAsk.js)
const asked = await tp.user.vtAsk(tp, "To-do? (Esc to cancel, Enter on empty = Untitled)");
if (asked === null) { throw new Error("Cancelled - no to-do"); }
const text = (asked || "Untitled to-do").trim();
const isHub = f => f && app.metadataCache.getFileCache(f)?.frontmatter?.kind === "project";
let project = window.vtPresetProject || "";
delete window.vtPresetProject;
if (!project) {
  const here = tp.config.active_file;
  if (isHub(here)) { project = here.basename; }
  else if (here && here.path.startsWith("02 Projects/") && here.parent.path !== "02 Projects") {
    const top = here.path.split("/")[1];
    const hub = app.vault.getAbstractFileByPath(`02 Projects/${top}/${top}.md`);
    if (isHub(hub)) { project = hub.basename; }
  }
}
if (!project) {
  const hubs = app.vault.getMarkdownFiles().filter(isHub).map(f => f.basename).sort();
  const picked = await tp.system.suggester(["(no project)", ...hubs], ["", ...hubs], false, "Project? (Esc to cancel)");
  if (picked === null || picked === undefined) { throw new Error("Cancelled - no project picked"); }
  project = picked;
}
// Meeting: asked only when there are several meeting series ("(none)" = not flagged; Esc cancels); with one series nothing is asked: set meeting in Properties
const series = app.vault.getMarkdownFiles().filter(f => app.metadataCache.getFileCache(f)?.frontmatter?.kind === "meeting-series").map(f => f.basename).sort((a, b) => a.localeCompare(b));
let meeting = "";
if (series.length > 1) {
  const chosen = await tp.system.suggester(["(none)", ...series], ["", ...series], false, "Raise at which meeting? (Esc to cancel)");
  if (chosen === null || chosen === undefined) { throw new Error("Cancelled - no meeting picked"); }
  meeting = chosen;
}
// Keep the day of the board column it was made in (the board writes it before this runs);
// anything else (Ctrl+Shift+T, project cards) starts in Backlog.
const days = ["Backlog", "Mon", "Tue", "Wed", "Thu", "Fri"];
const raw = await app.vault.read(tp.config.target_file);
const found = (raw.match(/^day:\s*["']?([^"'\r\n]+)/m) || [])[1];
const day = days.includes((found || "").trim()) ? found.trim() : "Backlog";
const base = text.replace(/[\\/:*?"<>|#^\[\]]/g, "-").slice(0, 80);
let name = base, n = 2;
while (await tp.file.exists(`${folder}/${name}.md`)) { name = `${base} ${n++}`; }
await tp.file.move(`${folder}/${name}`);
-%>
---
kind: todo
day: <% day %>
planned: <% tp.date.now("YYYY-MM-DD") %>
done: false
rolled: false
project: <% project ? `"[[${project}]]"` : "" %>
due:
countdown: false
meeting: <% meeting ? `"[[${meeting}]]"` : "false" %>
cssclasses:
  - vt
---

