<%*
// =========================================================
// Lab Book Template (Templater) · Lab notebook kit v0.2
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
  const empty = tp.config.target_file;
  if (empty && !(await app.vault.read(empty)).trim()) await app.fileManager.trashFile(empty);
  throw new Error("Lab Book Template: no initials set in Lab Kit settings");
}

// ---- 1. Next note number (notes named 0014 - … or ABC0014 - … both count) ----
const folder = tp.file.folder(true);
const nums = app.vault.getMarkdownFiles()
  .filter(f => f.parent.path === folder)
  .map(f => parseInt(f.basename.match(/^[A-Za-z]*(\d+)/)?.[1] ?? "0", 10));
const next = String(Math.max(0, ...nums) + 1).padStart(4, "0");

// ---- 2. Title and rename ----
// Text box: same look as the vault's pickers (vtAsk.js); falls back to Templater's box if it is missing
const title = (await (tp.user.vtAsk ? tp.user.vtAsk(tp, "Experiment title") : tp.system.prompt("Experiment title"))) || "Untitled";
const name = `${initials}${next} - ${title}`.replace(/[\\/:*?"<>|]/g, "-");
await tp.file.rename(name);
-%>
---
Type:
Status: Planned
Exp. Class:
Plan date: <% tp.date.now("YYYY-MM-DD") %>
Exp. Start:
Exp. End:
Chemicals:
CoSHH:
RA:
Objective:
Outcome:
cssclasses:
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
