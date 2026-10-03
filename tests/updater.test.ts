// Ported from the v0.3 plain-Node test of the same name.
import { afterAll, describe, it } from "vitest";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildKitFolder } from "../scripts/package-kit.mjs";
import { kitApply, kitCompare, kitDetectRoles, kitPlan, kitScan, type Kit } from "../src/kit/updater";

const ROOT = path.join(__dirname, "..");
const SRC = fs.mkdtempSync(path.join(os.tmpdir(), "labkit-src-"));     // stands in for the kit update folder
const VAULT = fs.mkdtempSync(path.join(os.tmpdir(), "labkit-vault-"));
afterAll(() => { fs.rmSync(SRC, { recursive: true, force: true }); fs.rmSync(VAULT, { recursive: true, force: true }); });

// Assemble a kit folder the way `npm run package` ships it: kit/ + plugin files
const PLUGIN_BUILD = "// built plugin (stand-in for main.js)\n";
const STUB_MAIN = path.join(SRC, "main.js");
fs.writeFileSync(STUB_MAIN, PLUGIN_BUILD);
const PACK = path.join(SRC, "packed");                                       // the update folder
const KIT = buildKitFolder({ outDir: PACK, mainJs: STUB_MAIN }).dir;
fs.mkdirSync(path.join(PACK, "Lab notebook kit v0.2"));                      // no manifest → ignored

// --- fake vault laid out like a real one (v0.1 installed by hand) ---
const put = (p: string, txt: string) => { const f = path.join(VAULT, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, txt); };
put(".obsidian/plugins/lab-kit/main.js", "// old v1.0");
put(".obsidian/snippets/tabs-mermaid-scroll.css", "/* old */");
put(".obsidian/snippets/adhd-reading-focus.css", "/* mine */");
put("Extras/scripts/lab-config.json", '{"initials":"ABC","dataRoots":{"windows":"C:/my/real/path"}}');
put("Extras/scripts/hazards/view.js", "// old hazards");
put("Extras/scripts/lab-header/view.js", "// old header");
put("Extras/scripts/templater/labForm.js", "// old form");
put("Extras/Templates/Lab Book Template.md", "old template");
put("Extras/Templates/Insert snippet.md", "old menu");
const oldSnippets = JSON.parse(fs.readFileSync(path.join(ROOT, "kit/kit-manifest.json"), "utf8")).delete.filter((d: any) => d.path.startsWith("Snippets/"));
for (const d of oldSnippets) put("Extras/Templates/" + d.path, "old snippet");
put("Lab Book/Notes/0014 - Test.md", "my note");

const adapter: any = {
  exists: async (p: string) => fs.existsSync(path.join(VAULT, p)),
  readBinary: async (p: string) => { const b = fs.readFileSync(path.join(VAULT, p)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); },
  writeBinary: async (p: string, ab: ArrayBuffer) => fs.writeFileSync(path.join(VAULT, p), Buffer.from(ab)),
  write: async (p: string, t: string) => fs.writeFileSync(path.join(VAULT, p), t),
  remove: async (p: string) => fs.unlinkSync(path.join(VAULT, p)),
  mkdir: async (p: string) => fs.mkdirSync(path.join(VAULT, p)),
};
function listFiles() {
  const out: any[] = [];
  (function walk(rel: string) {
    for (const d of fs.readdirSync(path.join(VAULT, rel), { withFileTypes: true })) {
      const r = rel ? rel + "/" + d.name : d.name;
      if (r.startsWith(".obsidian")) continue;
      if (d.isDirectory()) walk(r); else out.push({ name: d.name, path: r, parent: { path: rel } });
    }
  })("");
  return out;
}
const app = (tplSettings: object): any => ({
  vault: { configDir: ".obsidian", getFiles: listFiles, getAbstractFileByPath: (p: string) => fs.existsSync(path.join(VAULT, p)) ? { path: p } : null },
  plugins: { plugins: { "templater-obsidian": { settings: tplSettings } } },
});
const readSrc = (kit: Kit) => (src: string) => fs.readFileSync(path.join(kit.dir, ...src.split("/")));

describe("kit updater", () => {
  it("scans, detects, plans, applies, re-plans and respects edits", async () => {
    const kits = kitScan(PACK);
    assert.strictEqual(kits.length, 1); assert.strictEqual(kits[0].manifest.version, "0.3.0");
    const kit = kits[0];
    assert.ok(kitCompare("0.3.0", "0.2.9") > 0 && kitCompare("0.10.0", "0.9.1") > 0 && kitCompare("1.0", "1.0.0") === 0);

    // 1. Detection
    const roles = kitDetectRoles(app({ templates_folder: "Extras/Templates", user_scripts_folder: "" }), null, kit.manifest);
    assert.deepStrictEqual(
      [roles.scripts, roles.userScripts, roles.templates, roles.docs, roles.backups],
      ["Extras/scripts", "Extras/scripts/templater", "Extras/Templates", "Extras/Lab notebook kit", "Extras/kit-backups"]);

    // 2. Plan
    let items = await kitPlan(adapter, kit, roles, null, readSrc(kit));
    const by = (s: string) => items.filter(i => i.status === s).map(i => i.dest);
    assert.deepStrictEqual(by("keep"), ["Extras/scripts/lab-config.json"]);
    assert.ok(by("delete").includes(".obsidian/snippets/tabs-mermaid-scroll.css"));
    assert.strictEqual(by("delete").filter(p => p.includes("Snippets/")).length, 9);
    assert.ok(by("replace").includes("Extras/Templates/Lab Book Template.md"));
    assert.ok(!items.some(i => i.dest.includes("Lab notebook kit - ")));                 // tutorial / changelog notes are no longer installed

    // 3. Apply
    const res = await kitApply(adapter, kit, roles, items, null, "2026-10-02 1700", true);
    assert.strictEqual(fs.readFileSync(path.join(VAULT, "Extras/scripts/lab-config.json"), "utf8").includes("C:/my/real/path"), true);
    assert.ok(fs.existsSync(path.join(VAULT, "Extras/kit-backups/2026-10-02 1700 before v0.3.0/Extras/Templates/Lab Book Template.md")));
    assert.ok(fs.existsSync(path.join(VAULT, "Extras/kit-backups/2026-10-02 1700 before v0.3.0/.obsidian/snippets/tabs-mermaid-scroll.css")));
    assert.ok(!fs.existsSync(path.join(VAULT, ".obsidian/snippets/tabs-mermaid-scroll.css")));
    assert.ok(fs.existsSync(path.join(VAULT, "Extras/Templates/Snippets/13 Blank calc table.md")));
    assert.strictEqual(fs.readFileSync(path.join(VAULT, "Lab Book/Notes/0014 - Test.md"), "utf8"), "my note");
    // The updater never touches the plugin itself (store policy: no self-update); the store / a release updates it
    assert.ok(!items.some(i => i.dest.startsWith(".obsidian/plugins/")));
    assert.ok(!kit.manifest.files.some(f => f.role === "plugin"));
    assert.strictEqual(fs.readFileSync(path.join(VAULT, ".obsidian/plugins/lab-kit/main.js"), "utf8"), "// old v1.0");

    // 4. Second run: everything up to date
    const rec = res.record;
    items = await kitPlan(adapter, kit, kitDetectRoles(app({ templates_folder: "Extras/Templates", user_scripts_folder: "Extras/scripts/templater" }), rec, kit.manifest), rec, readSrc(kit));
    const statuses = [...new Set(items.map(i => i.status))].sort();
    assert.deepStrictEqual(statuses, ["keep", "same"]);

    // 5. User edits a snippet, then a newer version arrives → shown as "edited", not overwritten by default
    put("Extras/Templates/Snippets/05 Sample list.md", "my own changes");
    const kit2: Kit = { ...kit, manifest: { ...kit.manifest, version: "0.3.1" } };
    fs.appendFileSync(path.join(kit.dir, "Templates/Snippets/05 Sample list.md"), "\n");          // file changed upstream too
    items = await kitPlan(adapter, kit2, rec.roles, rec, readSrc(kit2));
    const ed = items.find(i => i.dest.endsWith("05 Sample list.md"))!;
    assert.strictEqual(ed.status, "edited");
    ed.overwrite = false;
    await kitApply(adapter, kit2, rec.roles, items, rec, "2026-10-03 0900");
    assert.strictEqual(fs.readFileSync(path.join(VAULT, "Extras/Templates/Snippets/05 Sample list.md"), "utf8"), "my own changes");

    // 6. Scripts kept somewhere else → paths inside templates are rewritten
    const r2 = { ...rec.roles, scripts: "Lab/scripts" };
    items = await kitPlan(adapter, kit2, r2, rec, readSrc(kit2));
    const tpl = items.find(i => i.dest === "Extras/Templates/Lab Book Template.md")!;
    // The note template now uses the ```lab-header block, so it carries no script paths to rewrite
    assert.ok(!(tpl.text ?? fs.readFileSync(path.join(kit.dir, "Templates/Lab Book Template.md"), "utf8")).includes("Extras/scripts"));
    const snip = items.find(i => i.dest.endsWith("labSnippets.js"))!;
    assert.ok(snip.text!.includes('"Lab/scripts/lab-config.json"'));
  });
});
