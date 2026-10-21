// Phase 0 item 3 of docs/plans/templater-replacement-and-live-snippets.md: Templater's folder template and a Lab Kit token template on one folder.
// Throwaway vault only. Templater is the official release (github.com/SilentVoid13/Templater, main.js + manifest.json + styles.css), downloaded into its own
// folder first and copied into the throwaway vault's plugin folder, nowhere else:
//   D=<scratch>/p0t; export OBSIDIAN_CHECK_PORT=9337
//   node scripts/obsidian-check.mjs start --no-build --dir "$D"            (add --mobile for the phone run; use another --dir)
//   mkdir -p "$D/vault/.obsidian/plugins/templater-obsidian" && cp <download>/{main.js,manifest.json,styles.css} "$D/vault/.obsidian/plugins/templater-obsidian/"
//   node scripts/obsidian-check.mjs eval --file scripts/phase0-templater-coexist.js
//   node scripts/obsidian-check.mjs stop --dir "$D"
// Body of an async function (obsidian-check eval). It writes only under "T Tpl", "T Todos", "T Other". Lab Kit's fill does not exist yet: a stand-in listener
// only LOGS where the planned rule ("empty or a raw `make: note` header, open in the active editor") would fire.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const fs = window.require("fs");
const nodePath = window.require("path");
const base = app.vault.adapter.basePath;
const out = { isMobile: app.isMobile };
for (const d of ["T Tpl", "T Todos", "T Other"]) if (!app.vault.getAbstractFileByPath(d)) await app.vault.createFolder(d);

const TOKEN = "---\nmake: note\nfields:\n  - key: project\n    label: Project\n---\n---\nkind: todo\nproject: \"[[{{project}}]]\"\n---\nBody\n";
const OLD = "---\nkind: todo\nyear: <% tp.date.now(\"YYYY\") %>\n---\nBody\n";
for (const [n, t] of [["Todo token.md", TOKEN], ["Todo old.md", OLD]]) {
  const p = `T Tpl/${n}`;
  if (!app.vault.getAbstractFileByPath(p)) await app.vault.create(p, t);
}

// ---- turn Templater on with a folder template row ----
await app.plugins.loadManifests();
if (!app.plugins.manifests["templater-obsidian"]) return { error: "Templater files are not in the vault's plugins folder" };
await app.plugins.enablePluginAndSave("templater-obsidian");
await wait(1500);
let tp = app.plugins.plugins["templater-obsidian"];
if (!tp) return { error: "Templater did not load" };
out.templater = tp.manifest.version;
const setRow = async (template) => {
  Object.assign(tp.settings, { templates_folder: "T Tpl", trigger_on_file_creation: true, trigger_on_file_creation_mode: "folder", folder_templates: template ? [{ folder: "T Todos", template }] : [] });
  await tp.save_settings();
};
// Templater registers its create handler when it loads with the trigger on: set it once, then reload the plugin (later row changes are read live)
await setRow("T Tpl/Todo token.md");
app.saveLocalStorage("templater-local-settings", { trigger_on_file_creation: true });   // "Trigger Templater on new file creation" is per device: Obsidian's local storage, not data.json
await app.plugins.disablePlugin("templater-obsidian");
await app.plugins.enablePlugin("templater-obsidian");
await wait(1500);
tp = app.plugins.plugins["templater-obsidian"];
out.triggerOnAfterReload = tp.settings.trigger_on_file_creation + "/" + tp.settings.trigger_on_file_creation_mode + "/" + JSON.stringify(tp.settings.folder_templates);

// ---- listeners ----
const STANDIN_TEXT = "---\nkind: todo\n---\nFILLED BY STAND-IN\n";
let standin = null;   // "open": fill at the first event that finds the note empty and active; "raw": only when a raw header is seen
const filled = new Set();
const log = [];
let t0 = 0;
const head = (s) => JSON.stringify(s.slice(0, 26));
const rec = async (kind, f) => {
  if (!f || f.extension !== "md" || !/^T (Todos|Other)\//.test(f.path)) return;
  const at = Math.round(performance.now() - t0);
  let s = ""; try { s = await app.vault.read(f); } catch (e) { s = "(read failed)"; }
  const raw = s === "" ? "empty" : /^---\r?\nmake: note/.test(s) ? "raw lab-kit header" : s.includes("<%") ? "raw Templater tags" : "filled/other";
  const active = app.workspace.getActiveFile()?.path === f.path;
  const wouldFill = (kind === "file-open" || kind === "modify") && active && (raw === "empty" || raw === "raw lab-kit header") && f.path.startsWith("T Todos/");
  if (standin && wouldFill && !filled.has(f.path) && (standin === "open" || raw === "raw lab-kit header")) {
    filled.add(f.path);
    await app.vault.modify(f, STANDIN_TEXT);
    log.push(`${Math.round(performance.now() - t0)}ms STAND-IN FILL written (mode ${standin}, saw ${raw})`);
  }
  log.push(`${at}ms ${kind} ${f.path} [${raw}] len=${s.length} ${head(s)} active=${active}${wouldFill ? "  <== Lab Kit rule would fill here" : ""}`);
};
const refs = [app.vault.on("create", (f) => rec("create", f)), app.vault.on("modify", (f) => rec("modify", f)), app.workspace.on("file-open", (f) => rec("file-open", f))];

const scenarios = {};
const run = async (name, fn, settle = 3500) => {
  log.length = 0; t0 = performance.now();
  let note = "";
  try { note = (await fn()) || ""; } catch (e) { note = "error: " + String(e.message || e).slice(0, 100); }
  await wait(settle);
  scenarios[name] = { note, events: [...log] };
};
const folder = (n) => app.vault.getAbstractFileByPath(n);
const finalText = async (p) => { const f = app.vault.getAbstractFileByPath(p); return f ? await app.vault.read(f) : null; };

const suite = async (label, tpl) => {
  await setRow(tpl);
  await run(`${label} | explorer New note in the mapped folder (create + openFile)`, async () => {
    const f = await app.fileManager.createNewMarkdownFile(folder("T Todos"), `${label}-explorer`);
    await app.workspace.getLeaf(false).openFile(f);
    return "";
  });
  scenarios[`${label} | explorer New note in the mapped folder (create + openFile)`].final = await finalText(`T Todos/${label}-explorer.md`);
  await run(`${label} | Bases-style vault.create with front matter, not opened`, async () => { await app.vault.create(`T Todos/${label}-bases.md`, "---\nkind: todo\n---\n"); });
  scenarios[`${label} | Bases-style vault.create with front matter, not opened`].final = await finalText(`T Todos/${label}-bases.md`);
  await run(`${label} | vault.create empty, not opened`, async () => { await app.vault.create(`T Todos/${label}-empty.md`, ""); });
  scenarios[`${label} | vault.create empty, not opened`].final = await finalText(`T Todos/${label}-empty.md`);
  await run(`${label} | another process writes a whole file`, async () => { fs.writeFileSync(nodePath.join(base, "T Todos", `${label}-synced.md`), "---\nkind: todo\n---\nbody\n"); }, 4500);
  scenarios[`${label} | another process writes a whole file`].final = await finalText(`T Todos/${label}-synced.md`);
  await run(`${label} | explorer New note in an unmapped folder (control)`, async () => {
    const f = await app.fileManager.createNewMarkdownFile(folder("T Other"), `${label}-other`);
    await app.workspace.getLeaf(false).openFile(f);
  });
  scenarios[`${label} | explorer New note in an unmapped folder (control)`].final = await finalText(`T Other/${label}-other.md`);
};
await suite("rowTokenTemplate", "T Tpl/Todo token.md");
await suite("rowOldTemplate", "T Tpl/Todo old.md");
await suite("noRow", null);
// the planned Lab Kit rule, as a stand-in that really writes, with Templater's row for the folder still set
for (const mode of ["open", "raw"]) {
  standin = mode;
  await setRow("T Tpl/Todo token.md");
  const nm = `standin-${mode}`;
  await run(`${nm} | explorer New note, Templater row set, stand-in fills on ${mode}`, async () => {
    const f = await app.fileManager.createNewMarkdownFile(folder("T Todos"), nm);
    await app.workspace.getLeaf(false).openFile(f);
  }, 4500);
  scenarios[`${nm} | explorer New note, Templater row set, stand-in fills on ${mode}`].final = await finalText(`T Todos/${nm}.md`);
}
standin = null;

// ---- the real Bases New button ----
const bases = { tried: true };
try {
  const ip = app.internalPlugins;
  if (!ip.getPluginById?.("bases")?.enabled) await ip.enablePlugin?.("bases");
  await setRow("T Tpl/Todo token.md");
  if (!app.vault.getAbstractFileByPath("T Todos.base")) await app.vault.create("T Todos.base", "filters:\n  and:\n    - file.inFolder(\"T Todos\")\nviews:\n  - type: table\n    name: Table\n");
  const leaf = app.workspace.getLeaf("tab");
  await leaf.openFile(app.vault.getAbstractFileByPath("T Todos.base"));
  await wait(2500);
  const root = leaf.view.containerEl;
  const btns = [...root.querySelectorAll("button, .clickable-icon, [aria-label]")].map((b) => (b.getAttribute("aria-label") || b.textContent || "").trim()).filter(Boolean);
  bases.buttons = [...new Set(btns)].slice(0, 20);
  bases.baseClasses = [...new Set([...root.querySelectorAll("[class*='bases']")].flatMap((e) => [...e.classList]).filter((c) => /bases/.test(c)))].slice(0, 30);
  const newBtn = root.querySelector(".bases-toolbar-new-item-menu button, button.bases-toolbar-new-item-menu, .bases-toolbar-new-item-menu") ?? [...root.querySelectorAll("button, .clickable-icon, [aria-label]")].find((b) => /^new$/i.test((b.getAttribute("aria-label") || b.textContent || "").trim()));
  bases.newButtonHtmlClass = newBtn ? newBtn.className + " | " + (newBtn.textContent || "").trim().slice(0, 30) : null;
  bases.foundNewButton = !!newBtn;
  if (newBtn) {
    const before = new Set(app.vault.getMarkdownFiles().map((f) => f.path));
    await run("real Bases New button on a base filtered to the mapped folder", async () => { for (const t of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) newBtn.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })); await wait(1200); const items = [...document.querySelectorAll(".menu .menu-item")].map((m) => m.textContent.trim()); bases.menuAfterClick = items; const modal = document.querySelector(".modal-container .modal"); return modal ? "a window opened: " + modal.textContent.slice(0, 80) : ""; }, 4000);
    const made = app.vault.getMarkdownFiles().filter((f) => !before.has(f.path));
    bases.newFiles = made.map((f) => f.path);
    for (const f of made) bases.final = { path: f.path, text: await app.vault.read(f), active: app.workspace.getActiveFile()?.path === f.path };
  }
} catch (e) { bases.error = String(e.message || e).slice(0, 160); }
out.bases = bases;

for (const r of refs) { try { app.vault.offref(r); } catch (e) { /* workspace ref */ } try { app.workspace.offref(r); } catch (e) { /* vault ref */ } }
out.scenarios = scenarios;
return out;
