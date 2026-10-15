<%*
try {   // a cancel (Esc) is caught at the end of the file, so Templater does not log an error
// To-do template - always files the new to-do in 00 Planning/To-dos (see Vault spec)
// Project is filled in automatically when started from a project card or from inside a project;
// otherwise it asks (Enter on "(no project)" = none). Esc in any box cancels the whole to-do.
const folder = "00 Planning/To-dos";
// The plugin's entry window (title + chips) hands everything over in window.vtTodo, and nothing is asked here. Run without it (the board's New button,
// a folder template) the template opens the same window itself through window.vtEntryTodo, naming the board column; with no plugin the boxes below ask one by one.
// The board writes the column's `day` into the new note before this runs.
const days = ["Backlog", "Mon", "Tue", "Wed", "Thu", "Fri"];
const raw = await app.vault.read(tp.config.target_file);
const found = (raw.match(/^day:\s*["']?([^"'\r\n]+)/m) || [])[1];
const day = days.includes((found || "").trim()) ? found.trim() : "Backlog";
// Esc: a note the board just made with nothing in it but its `day` goes to the trash, so no empty note is left (a note with any text is never touched)
const trashIfBlank = async () => {
  const f = tp.config.target_file;
  const rest = raw.replace(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/, (m, fm) => fm.split(/\r?\n/).every(l => !l.trim() || /^day:/.test(l.trim())) ? "" : m);
  if (f.path.startsWith(`${folder}/`) && rest.trim() === "") { window.setTimeout(() => { app.fileManager.trashFile(f).catch(() => { /* it stays */ }); }, 800); }   // after Templater has finished with the file
};
let preset = window.vtTodo;
delete window.vtTodo;
if (!preset && typeof window.vtEntryTodo === "function") {
  preset = await window.vtEntryTodo(found ? day : undefined);
  if (!preset) { await trashIfBlank(); throw new Error("Cancelled - no to-do"); }
}
// Text box: same look as the project picker (Extras/scripts/templater/vault/vtAsk.js)
const asked = preset ? preset.text : await tp.user.vtAsk(tp, "To-do? (Esc to cancel, Enter on empty = Untitled)");
if (asked === null) { await trashIfBlank(); throw new Error("Cancelled - no to-do"); }
const text = (asked || "Untitled to-do").trim();
const isHub = f => f && app.metadataCache.getFileCache(f)?.frontmatter?.kind === "project";
let project = preset ? (preset.project || "") : (window.vtPresetProject || "");
delete window.vtPresetProject;
if (!project && !preset) {
  const here = tp.config.active_file;
  if (isHub(here)) { project = here.basename; }
  else if (here && here.path.startsWith("02 Projects/") && here.parent.path !== "02 Projects") {
    const top = here.path.split("/")[1];
    const hub = app.vault.getAbstractFileByPath(`02 Projects/${top}/${top}.md`);
    if (isHub(hub)) { project = hub.basename; }
  }
}
if (!project && !preset) {
  const hubs = app.vault.getMarkdownFiles().filter(isHub).map(f => f.basename).sort();
  const picked = await tp.system.suggester(["(no project)", ...hubs], ["", ...hubs], false, "Project? (Esc to cancel)");
  if (picked === null || picked === undefined) { await trashIfBlank(); throw new Error("Cancelled - no project picked"); }
  project = picked;
}
// Comes after?: only for a project that has open to-dos; one pick ("(nothing)" first). Esc picks nothing and does not cancel the to-do.
let after = "";
if (project && !preset) {
  const linkName = v => (String(v || "").match(/\[\[([^\]|#]+)/) || [])[1]?.split("/").pop().trim();
  const open = app.vault.getMarkdownFiles().filter(f => {
    if (!f.path.startsWith(`${folder}/`) || f.path === tp.config.target_file.path) return false;
    const fm = app.metadataCache.getFileCache(f)?.frontmatter;
    return fm?.kind === "todo" && fm.done !== true && fm.day !== "Done" && linkName(fm.project) === project;
  }).map(f => f.basename).sort((a, b) => a.localeCompare(b));
  if (open.length) {
    const before = await tp.system.suggester(["(nothing)", ...open], ["", ...open], false, "Comes after? (optional: pick (nothing) to skip)");
    after = before || "";
  }
}
// Meeting: asked only when there are several meeting series ("(none)" = not flagged; Esc cancels); with one series nothing is asked: set meeting in Properties
const series = app.vault.getMarkdownFiles().filter(f => app.metadataCache.getFileCache(f)?.frontmatter?.kind === "meeting-series").map(f => f.basename).sort((a, b) => a.localeCompare(b));
let meeting = preset ? (preset.meeting || "") : "";
const experiment = preset ? (preset.experiment || "") : "";   // the entry window's Experiment chip (a lab note's name); the boxes below never ask
if (!preset && series.length > 1) {
  const chosen = await tp.system.suggester(["(none)", ...series], ["", ...series], false, "Raise at which meeting? (Esc to cancel)");
  if (chosen === null || chosen === undefined) { await trashIfBlank(); throw new Error("Cancelled - no meeting picked"); }
  meeting = chosen;
}
// Due date: optional (Enter on empty = none); a countdown badge is offered only when a date is set. Esc cancels.
// `due` is a date property in this vault (set once here, Obsidian keeps it in .obsidian/types.json).
try { if (app.metadataTypeManager?.getAssignedType?.("due") !== "date") { await app.metadataTypeManager?.setType?.("due", "date"); } } catch (e) { /* older Obsidian: due stays text */ }
const parseDue = tp.user.vtAsk.parseDue;   // words like "fri" or "next mon"; an older vtAsk.js has none (then only YYYY-MM-DD)
let due = preset ? (preset.due || "") : "", prompt = "Due date? (YYYY-MM-DD, or today, tomorrow, fri, next mon; Enter = none, Esc to cancel)";
while (!preset) {
  const d = await tp.user.vtAsk(tp, prompt);
  if (d === null) { await trashIfBlank(); throw new Error("Cancelled - no due date"); }
  if (d === "") { break; }
  const words = parseDue ? parseDue(d, new Date()) : (/^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(new Date(d + "T00:00:00")) ? d : null);
  if (words) { due = words; break; }
  prompt = `"${d}" is not a date. Use YYYY-MM-DD, or today, tomorrow, fri, next mon (Enter = none, Esc to cancel)`;
}
// The countdown badge on the board is one setting for all to-dos (Settings > Lab Kit > Due-date countdown); `countdown` stays false here (mode "marked" reads a `countdown: true` typed by hand).
const countdown = false;
// Priority: optional, a number property (1 = highest). Esc cancels.
try { if (app.metadataTypeManager?.getAssignedType?.("priority") !== "number") { await app.metadataTypeManager?.setType?.("priority", "number"); } } catch (e) { /* older Obsidian: priority stays text */ }
const pr = preset ? preset.priority : await tp.system.suggester(["No priority", "1 - high", "2 - medium", "3 - low"], ["", 1, 2, 3], false, "Priority? (1 = high, 3 = low; Esc to cancel)");
if (pr === null || pr === undefined) { await trashIfBlank(); throw new Error("Cancelled - no priority choice"); }
const priority = pr;
// `day` (read at the top) keeps the board column the card was made in; anything else (the New to-do command, project cards) starts in Backlog.
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
due: <% due %>
countdown: <% countdown %>
priority: <% priority %>
<% after ? `after: "[[${after}]]"\n` : "" -%>
meeting: <% meeting ? `"[[${meeting}]]"` : "false" %>
<% experiment ? `experiment: "[[${experiment}]]"\n` : "" -%>
cssclasses:
  - vt
---

```vault-card
show: todo-bar
```
<%* } catch (e) {
  // A cancel is not an error: nothing is written (the empty note is trashed a moment after Templater finishes); anything else is shown as usual
  if (String(e && e.message).startsWith("Cancelled")) { tR = ""; } else { throw e; }
} -%>
