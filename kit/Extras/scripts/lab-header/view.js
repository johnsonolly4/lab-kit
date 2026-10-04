/* =====================================================================
   LAB NOTE HEADER (Dataview view)
   ---------------------------------------------------------------------
   The strip at the top of every experiment note:
     📁 Open data folder   – opens this note's Google Drive folder
                             (creates it if missing), on Windows or Mac
     ⚠️ Hazards            – collapsible hazard table (see ../hazards)

   Use in a note:
     ```dataviewjs
     await dv.view("Extras/scripts/lab-header")
     ```
   Options, e.g.:
     await dv.view("Extras/scripts/lab-header", { hazards: { collapsed: false } })

   Paths come from Extras/scripts/lab-config.json
   ===================================================================== */

const CONFIG_PATH = "Extras/scripts/lab-config.json";
const S = Object.assign({ dataFolder: true, hazards: {} }, input ?? {});

// ----- 📁 Data folder button -----
if (S.dataFolder) {
  const bar = dv.el("div", "", { cls: "lab-header-bar" });
  bar.setAttribute("style", "display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:4px;");

  if (app.isMobile) {
    bar.createSpan({ text: "📁 Data folder: desktop only" }).style.color = "var(--text-muted)";
  } else {
    const btn = bar.createEl("button", { text: "📁 Open data folder" });
    btn.onclick = async () => {
      try {
        const cfg = JSON.parse(await app.vault.adapter.read(CONFIG_PATH));
        const roots = cfg.dataRoots ?? cfg;                 // also accepts the old data-roots.json shape
        const root = process.platform === "win32" ? roots.windows : roots.mac;
        if (!root) { new Notice("Set your data folder first: " + CONFIG_PATH + " → dataRoots", 8000); return; }
        const dir = require("path").join(root, dv.current().file.name);
        const fs = require("fs");
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const err = await require("electron").shell.openPath(dir);
        if (err) new Notice(err);
      } catch (e) {
        new Notice("Couldn't open data folder. Is Google Drive running?\n" + e.message);
      }
    };
  }
}

// ----- ⚠️ Hazards -----
if (S.hazards !== false) {
  await dv.view("Extras/scripts/hazards", Object.assign({ collapsed: true }, S.hazards));
}
