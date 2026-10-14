<%*
// To-do template - always files the new to-do in 00 Planning/To-dos (see Vault spec)
// Project is filled in automatically when started from a project card or from inside a project;
// otherwise it asks (Enter on "(no project)" = none). Esc in any box cancels the whole to-do.
const folder = "00 Planning/To-dos";
// New to-do from the plugin: its entry window (title + chips) hands everything over in window.vtTodo, and nothing is asked here.
// Without it (the board's button, Templater run by hand) the boxes below ask one after the other, as before.
const preset = window.vtTodo;
delete window.vtTodo;
// Text box: same look as the project picker (Extras/scripts/templater/vault/vtAsk.js)
const asked = preset ? preset.text : await tp.user.vtAsk(tp, "To-do? (Esc to cancel, Enter on empty = Untitled)");
if (asked === null) { throw new Error("Cancelled - no to-do"); }
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
  if (picked === null || picked === undefined) { throw new Error("Cancelled - no project picked"); }
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
if (!preset && series.length > 1) {
  const chosen = await tp.system.suggester(["(none)", ...series], ["", ...series], false, "Raise at which meeting? (Esc to cancel)");
  if (chosen === null || chosen === undefined) { throw new Error("Cancelled - no meeting picked"); }
  meeting = chosen;
}
// Due date: optional (Enter on empty = none); a countdown badge is offered only when a date is set. Esc cancels.
// `due` is a date property in this vault (set once here, Obsidian keeps it in .obsidian/types.json).
try { if (app.metadataTypeManager?.getAssignedType?.("due") !== "date") { await app.metadataTypeManager?.setType?.("due", "date"); } } catch (e) { /* older Obsidian: due stays text */ }
const parseDue = tp.user.vtAsk.parseDue;   // words like "fri" or "next mon"; an older vtAsk.js has none (then only YYYY-MM-DD)
let due = preset ? (preset.due || "") : "", prompt = "Due date? (YYYY-MM-DD, or today, tomorrow, fri, next mon; Enter = none, Esc to cancel)";
while (!preset) {
  const d = await tp.user.vtAsk(tp, prompt);
  if (d === null) { throw new Error("Cancelled - no due date"); }
  if (d === "") { break; }
  const words = parseDue ? parseDue(d, new Date()) : (/^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(new Date(d + "T00:00:00")) ? d : null);
  if (words) { due = words; break; }
  prompt = `"${d}" is not a date. Use YYYY-MM-DD, or today, tomorrow, fri, next mon (Enter = none, Esc to cancel)`;
}
let countdown = preset ? (!!due && preset.countdown === true) : false;
if (due && !preset) {
  const c = await tp.system.suggester(["No countdown", "Show a countdown on the board"], [false, true], false, "Countdown on the board card? (Esc to cancel)");
  if (c === null || c === undefined) { throw new Error("Cancelled - no countdown choice"); }
  countdown = c;
}
// Priority: optional, a number property (1 = highest). Esc cancels.
try { if (app.metadataTypeManager?.getAssignedType?.("priority") !== "number") { await app.metadataTypeManager?.setType?.("priority", "number"); } } catch (e) { /* older Obsidian: priority stays text */ }
const pr = preset ? preset.priority : await tp.system.suggester(["No priority", "1 - high", "2 - medium", "3 - low"], ["", 1, 2, 3], false, "Priority? (1 = high, 3 = low; Esc to cancel)");
if (pr === null || pr === undefined) { throw new Error("Cancelled - no priority choice"); }
const priority = pr;
// Keep the day of the board column it was made in (the board writes it before this runs);
// anything else (the New to-do command, project cards) starts in Backlog.
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
due: <% due %>
countdown: <% countdown %>
priority: <% priority %>
<% after ? `after: "[[${after}]]"\n` : "" -%>
meeting: <% meeting ? `"[[${meeting}]]"` : "false" %>
cssclasses:
  - vt
---

```vault-card
show: todo-bar
```

