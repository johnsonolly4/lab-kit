<%*
try {   // a cancel (Esc) is caught at the end of the file, so Templater does not log an error
// =========================================================
// Lab Book Template (Templater) · Lab Kit
// 1. Works out the next note number in this folder
// 2. Asks for a title and renames the note "ABC0014 - Title" (ABC = Initials in Lab Kit settings)
// Add more content while writing with the snippet menu (Alt+S).
// =========================================================

// ---- 0. Initials (Settings → Lab Kit → Initials): notes are named by them, so none = stop ----
let kitData = null;
try { kitData = JSON.parse(await app.vault.adapter.read(`${app.vault.configDir ?? ".obsidian"}/plugins/lab-kit/data.json`))?.kit; } catch (e) { kitData = null; }
const initials = String(kitData?.initials ?? "").trim();
if (!initials) {
  new Notice("Set your initials in Lab Kit settings first: lab notes are named ABC0001 - Title.", 8000);
  throw new Error("Lab Book Template: no initials set in Lab Kit settings");   // Templater stops; nothing is written
}

// ---- 1. Next note number (notes named 0014 - … or ABC0014 - … both count; other names don't) ----
const folder = tp.file.folder(true);
const numbered = new RegExp(`^(?:${initials.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})?(\\d+)`);
const nums = app.vault.getMarkdownFiles()
  .filter(f => f.parent.path === folder)
  .map(f => parseInt(f.basename.match(numbered)?.[1] ?? "0", 10));
const next = String(Math.max(0, ...nums) + 1).padStart(4, "0");

// ---- 2. Title and rename ----
// New lab entry asks first (Lab Kit's own box) and hands the title over; a note made in the folder by hand asks here:
// vtAsk (same look as the vault's pickers) or Templater's box. Esc cancels, an empty title is "Untitled".
let title = window.labKitPresetTitle;
let presetClass = window.labKitPresetClass;
delete window.labKitPresetTitle;
delete window.labKitPresetClass;
// Esc: a note the folder trigger just made with nothing in it goes to the trash, so no empty note is left (a note with any text is never touched)
const trashIfBlank = async () => {
  const f = tp.config.target_file;
  if (f.path.startsWith(`${folder}/`) && (await app.vault.read(f)).trim() === "") { window.setTimeout(() => { app.fileManager.trashFile(f).catch(() => { /* it stays */ }); }, 800); }   // after Templater has finished with the file
};
// A note made in the folder by hand: the plugin's window (title + Exp. Class), through window.vtEntryLab, if the plugin has it
if (title === undefined && typeof window.vtEntryLab === "function") {
  const got = await window.vtEntryLab();
  if (!got) { await trashIfBlank(); throw new Error("Cancelled - no experiment title"); }
  title = got.title; presetClass = got.expClass;
}
if (title === undefined) title = await (tp.user.vtAsk ? tp.user.vtAsk(tp, "Experiment title") : tp.system.prompt("Experiment title"));
if (title === null) { await trashIfBlank(); throw new Error("Cancelled - no experiment title"); }
title = title || "Untitled";
// The window can set the Exp. Class (written as a quoted string so any text is safe in the properties)
const expClass = String(presetClass ?? "").trim();
// A note made in a board column (Started, Closed ...) already has that column's Status when this runs: keep it, so the note stays in its column
// (writing "Planned" as well gave two Status lines and the note left the board)
const rawNow = await app.vault.read(tp.config.target_file);
const foundStatus = ((rawNow.match(/^Status:[ \t]*["']?([^"'\r\n]+)/m) || [])[1] || "").trim();
const status = foundStatus || "Planned";
const name = `${initials}${next} - ${title}`.replace(/[\\/:*?"<>|]/g, "-");
await tp.file.rename(name);
-%>
---
Type:
Status: <% /^[\w .-]+$/.test(status) ? status : JSON.stringify(status) %>
Exp. Class: <% expClass ? JSON.stringify(expClass) : "" %>
Plan date: <% tp.date.now("YYYY-MM-DD") %>
Exp. Start:
Exp. End:
Chemicals:
CoSHH:
RA:
Objective:
Outcome:
cssclasses:
  - vt
  - academia
  - academia-rounded
  - scrolling_mermaid
---

```lab-header
```

# 🔬 Objectives


# ⚙️ Apparatus


# ⚗️ Procedure
1. 

# 📈 Results / Analysis


# 💡 Notes for next time
- 
<%* } catch (e) {
  // A cancel is not an error: nothing is written (the empty note is trashed a moment after Templater finishes); anything else is shown as usual
  if (String(e && e.message).startsWith("Cancelled")) { tR = ""; } else { throw e; }
} -%>
