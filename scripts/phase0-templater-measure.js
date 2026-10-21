// Phase 0 of docs/plans/templater-replacement-and-live-snippets.md: items 1 and 2, measured in a throwaway Obsidian.
// Run (desktop, then again with `start --mobile`); never against a real vault:
//   OBSIDIAN_CHECK_PORT=9337 node scripts/obsidian-check.mjs start --dir /tmp/p0 --no-build   (or --mobile)
//   OBSIDIAN_CHECK_PORT=9337 node scripts/obsidian-check.mjs eval --file scripts/phase0-templater-measure.js
//   OBSIDIAN_CHECK_PORT=9337 node scripts/obsidian-check.mjs stop --dir /tmp/p0
// Body of an async function (obsidian-check eval): returns JSON. Writes only under the folders "P0 Templates" and "P0 To-dos".
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const fs = window.require("fs");
const nodePath = window.require("path");
const base = app.vault.adapter.basePath;
const out = { platform: { isMobile: app.isMobile, obsidian: window.electron ? undefined : undefined } };
for (const d of ["P0 Templates", "P0 To-dos", "P0 Core"]) if (!app.vault.getAbstractFileByPath(d)) await app.vault.createFolder(d);

// ---------- item 1: Properties view and {{tokens}} ----------
const cases = {
  "Q5a header first": "---\nmake: note\nname: \"{{title}}\"\nfields:\n  - key: project\n    label: Project\n---\n---\nproject: {{project}}\ndue: {{#if due}}{{due}}{{/if}}\n---\nBody {{title}}\n",
  "Q5b properties first": "---\nproject: {{project}}\ndue: {{#if due}}{{due}}{{/if}}\n---\n```lab-template\nfields:\n  - key: project\n```\nBody {{title}}\n",
  "Templater today": "---\nproject: <% tp.file.title %>\ndue: <% tp.date.now(\"YYYY-MM-DD\") %>\n---\nBody\n",
  "quoted tokens": "---\nproject: \"{{project}}\"\ndue: \"{{due}}\"\n---\nBody\n",
};
out.item1 = {};
for (const [name, text] of Object.entries(cases)) {
  const path = `P0 Templates/${name.replace(/\W+/g, "-")}.md`;
  const f = await app.vault.create(path, text);
  const leaf = app.workspace.getLeaf(false);
  await leaf.openFile(f, { state: { mode: "preview" } });
  await wait(1200);
  const root = leaf.view.containerEl;
  const props = [...root.querySelectorAll(".metadata-property")].map((e) => e.getAttribute("data-property-key"));
  const invalid = !!root.querySelector(".metadata-container .metadata-properties-invalid, .metadata-container .mod-invalid, .metadata-container [class*='invalid']");
  const cache = app.metadataCache.getFileCache(f);
  const fm = cache?.frontmatter ? Object.keys(cache.frontmatter) : null;
  const openText = await app.vault.read(f);
  // click into the first property value, then leave it (what a user does when looking at a template's properties)
  let focus = "no property input found";
  const val = root.querySelector(".metadata-property .metadata-input-longtext, .metadata-property .metadata-input-text, .metadata-property [contenteditable]");
  if (val) { val.focus(); await wait(300); val.blur(); await wait(1500); focus = "focused and left"; }
  const afterFocus = await app.vault.read(f);
  // an API property edit (what the Properties view writes through)
  let pfm = "ok";
  try { await app.fileManager.processFrontMatter(f, (m) => { m["p0-added"] = "x"; }); } catch (e) { pfm = "threw: " + String(e.message || e).slice(0, 80); }
  await wait(500);
  const afterApi = await app.vault.read(f);
  out.item1[name] = { propertiesShown: props, invalidMarker: invalid, cacheFrontmatterKeys: fm, unchangedByOpen: openText === text, focus, unchangedByFocus: afterFocus === text, processFrontMatter: pfm, unchangedByApiEdit: afterApi === text, bytesAfterApiEdit: afterApi.length - text.length };
}

// ---------- item 2: create / modify / file-open order and content ----------
const log = [];
let t0 = 0;
const rec = async (kind, f) => {
  const at = Math.round(performance.now() - t0);
  let len = null, head = null;
  if (f && f.extension === "md") { try { const s = await app.vault.read(f); len = s.length; head = s.slice(0, 20); } catch (e) { len = "read failed"; } }
  log.push({ at, kind, path: f?.path, len, head });
};
const refs = [
  app.vault.on("create", (f) => rec("create", f)),
  app.vault.on("modify", (f) => rec("modify", f)),
  app.workspace.on("file-open", (f) => rec("file-open", f)),
];
const run = async (name, fn, settle = 2500) => {
  log.length = 0; t0 = performance.now();
  let note = "";
  try { note = (await fn()) || ""; } catch (e) { note = "error: " + String(e.message || e).slice(0, 100); }
  await wait(settle);
  out.item2 = out.item2 || {};
  out.item2[name] = { note, events: log.map((e) => `${e.at}ms ${e.kind} ${e.path} len=${e.len}`) };
};
const folder = app.vault.getAbstractFileByPath("P0 To-dos");
// stand-in for the File explorer's New note (createNewMarkdownFile, then the explorer opens it)
await run("explorer New note (createNewMarkdownFile + openFile)", async () => {
  const f = await app.fileManager.createNewMarkdownFile(folder, "P0 explorer");
  await app.workspace.getLeaf(false).openFile(f);
  return `active file after: ${app.workspace.getActiveFile()?.path}`;
});
// stand-in for Bases' New in a column: a markdown file created through the vault with front matter, not opened first
await run("vault.create with front matter, not opened (Bases-style)", async () => {
  await app.vault.create("P0 To-dos/P0 bases.md", "---\nkind: todo\n---\n");
  return `active file after: ${app.workspace.getActiveFile()?.path}`;
});
// another process writes the file (Sync stand-in): whole file at once, then empty-then-filled
await run("file written by another process (whole file)", async () => {
  fs.writeFileSync(nodePath.join(base, "P0 To-dos", "P0 synced.md"), "---\nkind: todo\n---\nbody\n");
  return `active file after: ${app.workspace.getActiveFile()?.path}`;
}, 4000);
await run("file written by another process (empty, then filled 600 ms later)", async () => {
  const p = nodePath.join(base, "P0 To-dos", "P0 synced2.md");
  fs.writeFileSync(p, "");
  setTimeout(() => fs.writeFileSync(p, "---\nkind: todo\n---\nbody\n"), 600);
  return "";
}, 4500);
// Obsidian core Templates plugin insert into an empty note
await run("core Templates insert into an empty note", async () => {
  const ip = app.internalPlugins;
  const plugin = ip?.getPluginById?.("templates") ?? ip?.plugins?.templates;
  if (!plugin) return "core Templates plugin not found";
  if (!plugin.enabled) await ip.enablePlugin?.("templates");
  const inst = (ip.getPluginById?.("templates") ?? ip.plugins.templates).instance;
  if (inst?.options) inst.options.folder = "P0 Templates";
  const tpl = app.vault.getAbstractFileByPath("P0 Templates/Q5a-header-first.md");
  const f = await app.fileManager.createNewMarkdownFile(app.vault.getAbstractFileByPath("P0 Core"), "P0 core");
  await app.workspace.getLeaf(false).openFile(f);
  await wait(300);
  await inst.insertTemplate(tpl);
  await wait(600);
  return `after insert: ${(await app.vault.read(f)).length} bytes, starts ${JSON.stringify((await app.vault.read(f)).slice(0, 12))}`;
});
for (const r of refs) { try { app.vault.offref(r); } catch (e) { /* workspace refs */ } try { app.workspace.offref(r); } catch (e) { /* vault refs */ } }
out.templaterInstalled = !!app.plugins.plugins["templater-obsidian"];
return out;
