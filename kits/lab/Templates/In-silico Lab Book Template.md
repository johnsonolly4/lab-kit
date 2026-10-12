<%*
// =========================================================
// In-silico Lab Book Template (Templater) · Lab Kit
// For computational experiments: same numbering as the Lab Book Template, sections for what a rerun needs.
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
  throw new Error("In-silico Lab Book Template: no initials set in Lab Kit settings");   // Templater stops; nothing is written
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
delete window.labKitPresetTitle;
if (title === undefined) title = await (tp.user.vtAsk ? tp.user.vtAsk(tp, "Experiment title") : tp.system.prompt("Experiment title"));
if (title === null) throw new Error("Cancelled - no experiment title");
title = title || "Untitled";
const name = `${initials}${next} - ${title}`.replace(/[\\/:*?"<>|]/g, "-");
await tp.file.rename(name);
-%>
---
Type:
Status: Planned
Exp. Class: in-silico
Plan date: <% tp.date.now("YYYY-MM-DD") %>
Exp. Start:
Exp. End:
Code:
Commit:
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


# 💻 Environment
Machine or cluster (queue, cores, GPUs, memory): 

Environment file or container image: 

| Software | Version | Source |
|---|---|---|
|  |  |  |

# 📥 Inputs
| Input | Location | Version or checksum |
|---|---|---|
|  |  |  |

# 🧮 Method
- 

# ▶️ Runs
| Run | Date | Commit | Command or config | Seed | Job ID | Wall time | Output folder | Status |
|---|---|---|---|---|---|---|---|---|
| 1 |  |  |  |  |  |  |  |  |

# 📈 Results / Analysis
Script and commit behind each figure: 

# 💡 Notes for next time
- 
