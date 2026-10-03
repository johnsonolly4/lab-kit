<%*
// =========================================================
// Lab Book Template (Templater) · Lab notebook kit v0.2
// 1. Works out the next note number in this folder
// 2. Asks for a title and renames the note "0014 - Title"
// 3. Creates a matching Google Drive data folder
//    (paths set in Extras/scripts/lab-config.json)
// Add more content while writing with the snippet menu (Alt+S).
// =========================================================

// ---- 1. Next note number ----
const folder = tp.file.folder(true);
const nums = app.vault.getMarkdownFiles()
  .filter(f => f.parent.path === folder)
  .map(f => parseInt(f.basename.match(/^(\d+)/)?.[1] ?? "0", 10));
const next = String(Math.max(0, ...nums) + 1).padStart(4, "0");

// ---- 2. Title and rename ----
const title = (await tp.system.prompt("Experiment title")) || "Untitled";
const name = `${next} - ${title}`.replace(/[\\/:*?"<>|]/g, "-");
await tp.file.rename(name);

// ---- 3. Matching data folder in Google Drive (desktop only) ----
if (!app.isMobile) {
  try {
    const cfg = JSON.parse(await app.vault.adapter.read("Extras/scripts/lab-config.json"));
    const root = process.platform === "win32" ? cfg.dataRoots.windows : cfg.dataRoots.mac;
    if (!root) throw new Error("set dataRoots in Extras/scripts/lab-config.json");
    require("fs").mkdirSync(require("path").join(root, name), { recursive: true });
  } catch (e) {
    new Notice("Couldn't create data folder. Is Google Drive running?\n" + e.message);
  }
}
-%>
---
Type:
Status:
  - Planned
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
  - wide
  - scrolling_mermaid
---
```dataviewjs
await dv.view("Extras/scripts/lab-header")
```

# 🎯 Objectives


# 🔧 Apparatus


# 🧪 Procedure
1. 

# 📊 Results / Analysis


# 📝 Notes for next time
- 
