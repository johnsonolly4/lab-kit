const Module = require("module"); const o = Module._load;
const stub = class {};
Module._load = function (r, ...a) { if (r === "obsidian") return { Plugin: class {}, MarkdownRenderer: {}, Notice: stub, Menu: stub, getIcon: () => null, Modal: stub, Setting: stub, PluginSettingTab: stub, Platform: { isDesktopApp: true } }; return o.call(this, r, ...a); };
const E = require(require("path").join(__dirname, "../../legacy/main.js")).__engine;
const fs = require("fs"), path = require("path"), assert = require("assert");

const os = require("os");
const ROOT = path.join(__dirname, "../..");
const SRC = fs.mkdtempSync(path.join(os.tmpdir(), "labkit-src-"));     // stands in for the kit update folder
const VAULT = fs.mkdtempSync(path.join(os.tmpdir(), "labkit-vault-"));
fs.rmSync(SRC, { recursive: true, force: true }); fs.rmSync(VAULT, { recursive: true, force: true });
fs.mkdirSync(SRC, { recursive: true });
// Assemble a kit folder the way it is shipped: kit/ + plugin files + docs
const KIT = path.join(SRC, "Lab notebook kit v0.3");
fs.cpSync(path.join(ROOT, "kit"), KIT, { recursive: true });
fs.mkdirSync(path.join(KIT, ".obsidian/plugins/lab-calc"), { recursive: true });
for (const f of ["main.js", "manifest.json", "styles.css"]) fs.copyFileSync(path.join(ROOT, "legacy", f), path.join(KIT, ".obsidian/plugins/lab-calc", f));
fs.copyFileSync(path.join(ROOT, "docs/tutorial.md"), path.join(KIT, "Lab notebook kit - tutorial.md"));
fs.copyFileSync(path.join(ROOT, "docs/changelog.md"), path.join(KIT, "Lab notebook kit - changelog.md"));
fs.copyFileSync(path.join(ROOT, "tests/fixtures/kit-demo.md"), path.join(KIT, "Kit demo v0.2.md"));
fs.writeFileSync(path.join(KIT, "Lab notebook kit - update to v0.3.md"), "# Update to v0.3\n");
fs.mkdirSync(path.join(SRC, "Lab notebook kit v0.2"));                       // no manifest → ignored

// --- fake vault laid out like the user's (v0.1 installed by hand) ---
const put = (p, txt) => { const f = path.join(VAULT, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, txt); };
put(".obsidian/plugins/lab-calc/main.js", "// old v1.0");
put(".obsidian/snippets/tabs-mermaid-scroll.css", "/* old */");
put(".obsidian/snippets/adhd-reading-focus.css", "/* mine */");
put("Extras/scripts/lab-config.json", '{"initials":"ABC","dataRoots":{"windows":"C:/my/real/path"}}');
put("Extras/scripts/hazards/view.js", "// old hazards");
put("Extras/scripts/lab-header/view.js", "// old header");
put("Extras/scripts/templater/labForm.js", "// old form");
put("Extras/Templates/Lab Book Template.md", "old template");
put("Extras/Templates/Insert snippet.md", "old menu");
const oldSnippets = JSON.parse(fs.readFileSync(path.join(ROOT, "kit/kit-manifest.json"), "utf8")).delete.filter(d => d.path.startsWith("Snippets/"));
for (const d of oldSnippets) put("Extras/Templates/" + d.path, "old snippet");
put("Lab Book/Notes/0014 - Test.md", "my note");

const adapter = {
  exists: async (p) => fs.existsSync(path.join(VAULT, p)),
  readBinary: async (p) => { const b = fs.readFileSync(path.join(VAULT, p)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); },
  writeBinary: async (p, ab) => fs.writeFileSync(path.join(VAULT, p), Buffer.from(ab)),
  write: async (p, t) => fs.writeFileSync(path.join(VAULT, p), t),
  remove: async (p) => fs.unlinkSync(path.join(VAULT, p)),
  mkdir: async (p) => fs.mkdirSync(path.join(VAULT, p)),
};
function listFiles() {
  const out = [];
  (function walk(rel) {
    for (const d of fs.readdirSync(path.join(VAULT, rel), { withFileTypes: true })) {
      const r = rel ? rel + "/" + d.name : d.name;
      if (r.startsWith(".obsidian")) continue;
      if (d.isDirectory()) walk(r); else out.push({ name: d.name, path: r, parent: { path: rel } });
    }
  })("");
  return out;
}
const app = (tplSettings) => ({
  vault: { configDir: ".obsidian", getFiles: listFiles, getAbstractFileByPath: (p) => fs.existsSync(path.join(VAULT, p)) ? { path: p } : null },
  plugins: { plugins: { "templater-obsidian": { settings: tplSettings } } },
});
const readSrc = (kit) => (src) => fs.readFileSync(path.join(kit.dir, ...src.split("/")));

(async () => {
  const kits = E.kitScan(SRC);
  assert.strictEqual(kits.length, 1); assert.strictEqual(kits[0].manifest.version, "0.3.0");
  const kit = kits[0];
  assert.ok(E.kitCompare("0.3.0", "0.2.9") > 0 && E.kitCompare("0.10.0", "0.9.1") > 0 && E.kitCompare("1.0", "1.0.0") === 0);

  // 1. Detection
  const roles = E.kitDetectRoles(app({ templates_folder: "Extras/Templates", user_scripts_folder: "" }), ".obsidian/plugins/lab-calc", null, kit.manifest);
  console.log("detected:", roles);
  assert.deepStrictEqual(
    [roles.scripts, roles.userScripts, roles.templates, roles.docs, roles.backups],
    ["Extras/scripts", "Extras/scripts/templater", "Extras/Templates", "Extras/Lab notebook kit", "Extras/kit-backups"]);

  // 2. Plan
  let items = await E.kitPlan(adapter, kit, roles, null, readSrc(kit));
  const by = (s) => items.filter(i => i.status === s).map(i => i.dest);
  console.log("new:", by("new").length, "replace:", by("replace").length, "keep:", by("keep"), "delete:", by("delete").length);
  assert.deepStrictEqual(by("keep"), ["Extras/scripts/lab-config.json"]);
  assert.ok(by("delete").includes(".obsidian/snippets/tabs-mermaid-scroll.css"));
  assert.strictEqual(by("delete").filter(p => p.includes("Snippets/")).length, 9);
  assert.ok(by("replace").includes("Extras/Templates/Lab Book Template.md"));
  assert.ok(by("new").includes("Extras/Lab notebook kit/Lab notebook kit - tutorial.md"));

  // 3. Apply
  const res = await E.kitApply(adapter, kit, roles, items, null, "2026-10-02 1700", true);
  console.log("applied:", res.done, "backup:", res.backupRoot);
  assert.strictEqual(fs.readFileSync(path.join(VAULT, "Extras/scripts/lab-config.json"), "utf8").includes("C:/my/real/path"), true);
  assert.ok(fs.existsSync(path.join(VAULT, "Extras/kit-backups/2026-10-02 1700 before v0.3.0/Extras/Templates/Lab Book Template.md")));
  assert.ok(fs.existsSync(path.join(VAULT, "Extras/kit-backups/2026-10-02 1700 before v0.3.0/.obsidian/snippets/tabs-mermaid-scroll.css")));
  assert.ok(!fs.existsSync(path.join(VAULT, ".obsidian/snippets/tabs-mermaid-scroll.css")));
  assert.ok(fs.existsSync(path.join(VAULT, "Extras/Templates/Snippets/13 Blank calc table.md")));
  assert.strictEqual(fs.readFileSync(path.join(VAULT, "Lab Book/Notes/0014 - Test.md"), "utf8"), "my note");
  assert.strictEqual(fs.readFileSync(path.join(VAULT, ".obsidian/plugins/lab-calc/main.js"), "utf8"), fs.readFileSync(require("path").join(__dirname, "../../legacy/main.js"), "utf8"));

  // 4. Second run: everything up to date
  const rec = res.record;
  items = await E.kitPlan(adapter, kit, E.kitDetectRoles(app({ templates_folder: "Extras/Templates", user_scripts_folder: "Extras/scripts/templater" }), ".obsidian/plugins/lab-calc", rec, kit.manifest), rec, readSrc(kit));
  const statuses = [...new Set(items.map(i => i.status))].sort();
  console.log("second run statuses:", statuses);
  assert.deepStrictEqual(statuses, ["keep", "same"]);

  // 5. User edits a snippet, then a newer version arrives → shown as "edited", not overwritten by default
  put("Extras/Templates/Snippets/05 Sample list.md", "my own changes");
  const kit2 = { ...kit, manifest: { ...kit.manifest, version: "0.3.1" } };
  fs.appendFileSync(path.join(kit.dir, "Templates/Snippets/05 Sample list.md"), "\n");          // file changed upstream too
  items = await E.kitPlan(adapter, kit2, rec.roles, rec, readSrc(kit2));
  const ed = items.find(i => i.dest.endsWith("05 Sample list.md"));
  assert.strictEqual(ed.status, "edited");
  ed.overwrite = false;
  await E.kitApply(adapter, kit2, rec.roles, items, rec, "2026-10-03 0900");
  assert.strictEqual(fs.readFileSync(path.join(VAULT, "Extras/Templates/Snippets/05 Sample list.md"), "utf8"), "my own changes");

  // 6. Scripts kept somewhere else → paths inside templates are rewritten
  const r2 = { ...rec.roles, scripts: "Lab/scripts" };
  items = await E.kitPlan(adapter, kit2, r2, rec, readSrc(kit2));
  const tpl = items.find(i => i.dest === "Extras/Templates/Lab Book Template.md");
  assert.ok(tpl.text.includes('dv.view("Lab/scripts/lab-header")') && !tpl.text.includes("Extras/scripts"));
  const snip = items.find(i => i.dest.endsWith("labSnippets.js"));
  assert.ok(snip.text.includes('"Lab/scripts/lab-config.json"'));
  console.log("All updater tests passed ✔");
})().catch(e => { console.error(e); process.exit(1); });
