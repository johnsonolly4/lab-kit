<%*
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
  if (f.path.startsWith(`${folder}/`) && (await app.vault.read(f)).trim() === "") { try { await app.fileManager.trashFile(f); } catch (e) { /* it stays */ } }
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
const name = `${initials}${next} - ${title}`.replace(/[\\/:*?"<>|]/g, "-");
await tp.file.rename(name);
-%>
---
Type:
Status: Planned
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
