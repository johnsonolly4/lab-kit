<%*
// =========================================================
// Lab Book Template (Templater) · Lab notebook kit v0.2
// 1. Works out the next note number in this folder
// 2. Asks for a title and renames the note "0014 - Title"
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

```lab-header
```

# 🔬 Objectives


# ⚙️ Apparatus


# ⚗️ Procedure
1. 

# 📈 Results / Analysis


# 💡 Notes for next time
- 
