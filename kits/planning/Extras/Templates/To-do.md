<%*
try {   // a cancel (Esc) is caught at the end of the file, so Templater does not log an error
// To-do template - always files the new to-do in 00 Planning/To-dos (see Vault spec)
// Project is filled in automatically when started from a project card or from inside a project;
// otherwise it asks (Enter on "(no project)" = none). Esc in any box cancels the whole to-do.
const folder = "00 Planning/To-dos";
// The plugin's entry window (title + chips) hands everything over in window.vtTodo, and nothing is asked here. Run without it (the board's New button,
// a folder template) the template opens the same window itself through window.vtEntryTodo, naming the board column; with no plugin the boxes below ask one by one.
// A board writes the column into the new note before this runs: a `scheduled` date, or (the Bases kanban, an old board) a weekday `day`,
// read as the next such day from today (today counts). Anything else starts in the Backlog (no `scheduled`). Same rule as startDate in src/planning/todo-note.ts.
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const raw = await app.vault.read(tp.config.target_file);
const pad = n => String(n).padStart(2, "0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const wd = d => (d.getDay() + 6) % 7;   // 0 = Mon
const setDate = (raw.match(/^scheduled:\s*["']?(\d{4}-\d{2}-\d{2})/m) || [])[1];
const oldDay = ((raw.match(/^day:\s*["']?([^"'\r\n]+)/m) || [])[1] || "").trim();
let at = null;
if (setDate) { const [y, m, d] = setDate.split("-").map(Number), x = new Date(y, m - 1, d); if (iso(x) === setDate) { at = x; } }
else if (days.includes(oldDay)) { at = new Date(today.getFullYear(), today.getMonth(), today.getDate() + (days.indexOf(oldDay) - wd(today) + 7) % 7); }
let scheduled = at ? iso(at) : "";
// Esc: a note the board just made with nothing in it but its day and empty properties (the board's New writes `done:`) goes to the trash, so no empty note is left (a note with any text is never touched)
const trashIfBlank = async () => {
  const f = tp.config.target_file;
  const rest = raw.replace(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/, (m, fm) => fm.split(/\r?\n/).every(l => !l.trim() || /^(?:day:|scheduled:|[\w .-]+:\s*$)/.test(l.trim())) ? "" : m);
  if (f.path.startsWith(`${folder}/`) && rest.trim() === "") { window.setTimeout(() => { app.fileManager.trashFile(f).catch(() => { /* it stays */ }); }, 800); }   // after Templater has finished with the file
};
let preset = window.vtTodo;
delete window.vtTodo;
if (!preset && typeof window.vtEntryTodo === "function") {
  preset = await window.vtEntryTodo(scheduled || undefined);   // the window opens its Day chip with the column's date (today or later) and names its weekday
  if (!preset) { await trashIfBlank(); throw new Error("Cancelled - no to-do"); }
}
// Text box: same look as the project picker (Extras/scripts/templater/vault/vtAsk.js)
if (preset && typeof preset.scheduled === "string") { scheduled = /^\d{4}-\d{2}-\d{2}$/.test(preset.scheduled) ? preset.scheduled : ""; }   // the window's Day chip decides (empty = Backlog); an older plugin sends none and the column stays
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
const waiting = preset ? String(preset.waiting || "").trim() : "";   // the entry window's Waiting chip (free text); the boxes below never ask
const experiment = preset ? (preset.experiment || "") : "";   // the entry window's Experiment chip (a lab note's name); the boxes below never ask
if (!preset && series.length > 1) {
  const chosen = await tp.system.suggester(["(none)", ...series], ["", ...series], false, "Raise at which meeting? (Esc to cancel)");
  if (chosen === null || chosen === undefined) { await trashIfBlank(); throw new Error("Cancelled - no meeting picked"); }
  meeting = chosen;
}
// Due date: optional (Enter on empty = none). Esc cancels.
// `due` is a date property in this vault (set once here, Obsidian keeps it in .obsidian/types.json).
try { await window.vtEnsureType?.("due", "date"); } catch (e) { /* older Lab Kit or Obsidian: due stays text */ }
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
// Priority: optional, a number property (1 = highest). Esc cancels.
try { await window.vtEnsureType?.("priority", "number"); } catch (e) { /* older Lab Kit or Obsidian: priority stays text */ }
const pr = preset ? preset.priority : await tp.system.suggester(["No priority", "1 - high", "2 - medium", "3 - low"], ["", 1, 2, 3], false, "Priority? (1 = high, 3 = low; Esc to cancel)");
if (pr === null || pr === undefined) { await trashIfBlank(); throw new Error("Cancelled - no priority choice"); }
const priority = pr;
// `scheduled` (read at the top) keeps the board column the card was made in, or the Day chip's date; anything else (the New to-do command, project cards) starts in the Backlog.
const base = text.replace(/[\\/:*?"<>|#^\[\]]/g, "-").slice(0, 80);
// The plugin's New to-do makes the note under this name already (todoFileName in src/planning/quick-todo.ts): then nothing is renamed, which would ask "Update links" with Automatically update internal links off
const here = tp.config.target_file.path;
let name = base, n = 2;
while (await tp.file.exists(`${folder}/${name}.md`) && `${folder}/${name}.md` !== here) { name = `${base} ${n++}`; }
if (here !== `${folder}/${name}.md`) { await tp.file.move(`${folder}/${name}`); }
-%>
---
kind: todo
<% scheduled ? `scheduled: ${scheduled}\n` : "" -%>
done: false
<% project ? `project: "[[${project}]]"\n` : "" -%>
<% due ? `due: ${due}\n` : "" -%>
<% priority ? `priority: ${priority}\n` : "" -%>
<% after ? `after: "[[${after}]]"\n` : "" -%>
<% meeting ? `meeting: "[[${meeting}]]"\n` : "" -%>
<% experiment ? `experiment: "[[${experiment}]]"\n` : "" -%>
<% waiting ? `waiting: ${JSON.stringify(waiting)}\n` : "" -%>
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
