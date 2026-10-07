// Regenerates the "files" list in kits/<id>/kit-manifest.json from what's in that kit's folder, for every kit under kits/.
// Per file: id (kept once assigned), kind, version (kit version where the content last changed), sha256, renamedFrom.
// Keeps id, version, rewrite, templater, enableCss / disableCss and removed as they are.
// Usage: npm run kit:manifest
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, relative, sep } from "path";
import { KITS, sha256 } from "./embed-kit.mjs";

const KIND_BY_ROLE = { cssSnippets: "snippet", templates: "template", scripts: "script", userScripts: "script", labBase: "note", chemicalBase: "note" };
const PREFIX = { snippet: "snip", template: "tpl", script: "script", note: "note" };

/* ---- Per kit: which source folder holds which role, and the one-line descriptions ---- */
const LAB_ROLE_BY_PREFIX = [
  [".obsidian/snippets/", "cssSnippets"],
  ["Extras/scripts/templater/", "userScripts"],
  ["Extras/scripts/", "scripts"],
  ["Templates/", "templates"],
  ["03 Lab Book/", "labBase"],
  ["05 Chemicals/", "chemicalBase"],
];
// One line per kit file, shown in Manage kit files. Snippets (Templates/Snippets/) use their own "// desc:" line.
const LAB_DESC = {
  ".obsidian/snippets/scrolling-mermaid.css": "Lets wide Mermaid diagrams scroll sideways inside a note",
  "Extras/scripts/excel_to_calc.py": "Command-line tool that turns an Excel file into calc tables",
  "Extras/scripts/templater/labForm.js": "The pop-up form every snippet uses",
  "Extras/scripts/templater/labMethods.js": "Analysis methods and machines (NMR, GPC, DLS and the notes in your Methods folder)",
  "Extras/scripts/templater/labPick.js": "The searchable snippet menu with icons",
  "Extras/scripts/templater/labSnippets.js": "The code behind every snippet",
  "Templates/Insert snippet.md": "The Alt+S menu: lists the snippets and inserts the one you pick",
  "Templates/Lab Book Template.md": "New experiment note: number, hazards, data folder button and sections",
  "Templates/Chemical database template.md": "New chemical note: names, class, hazards, CAS number, MW and physical data",
  "03 Lab Book/Lab book base.base": "Board of your experiments by Status, next to your Lab notes folder",
  "05 Chemicals/Chemical database.base": "Table and by-class board of your chemical notes, next to your Chemical folder",
};
const CONFIG = {
  lab: {
    roleByPrefix: LAB_ROLE_BY_PREFIX, desc: LAB_DESC,
    // Snippets carry their own "// desc:" line and can be switched off; so can the Excel converter (not part of the plugin itself)
    optionalPrefix: "Templates/Snippets/", optionalFiles: new Set(["Extras/scripts/excel_to_calc.py", "Templates/Chemical database template.md", "03 Lab Book/Lab book base.base", "05 Chemicals/Chemical database.base"]),
    // policy "keep": installed once, never updated (notes that become the user's own)
    keepFiles: new Set(["03 Lab Book/Lab book base.base", "05 Chemicals/Chemical database.base"]),
    // "needs": the setting (kit data key) that must be set for the file to be installed; empty = treated as switched off
    needs: { "Templates/Chemical database template.md": "chemicalFolder", "03 Lab Book/Lab book base.base": "labFolder", "05 Chemicals/Chemical database.base": "chemicalFolder" },
  },
};
const SKIP = new Set(["kit-manifest.json"]);

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** Regenerates one kit's manifest. `KIT` = its folder (kits/<id>). */
function regenerate(KIT) {
  const manifestPath = join(KIT, "kit-manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const cfg = CONFIG[manifest.id];
  if (!cfg) throw new Error(`${manifestPath}: no CONFIG entry for kit id "${manifest.id}" in scripts/kit-manifest.mjs`);
  const ROLE_BY_PREFIX = cfg.roleByPrefix, DESC = cfg.desc, OPTIONAL_PREFIX = cfg.optionalPrefix, OPTIONAL_FILES = cfg.optionalFiles;
  const descOf = (rel, text) => rel.startsWith(OPTIONAL_PREFIX)
    ? (text.match(/^\/\/\s*desc:\s*(.+)$/m)?.[1]?.trim() ?? (() => { throw new Error(`${rel}: no "// desc:" line`); })())
    : (DESC[rel] ?? (() => { throw new Error(`${rel}: add a line to DESC in scripts/kit-manifest.mjs`); })());

  const previous = new Map((manifest.files ?? []).map((f) => [f.src, f]));
  const taken = new Set();

  // id: stable forever (the update system tracks files by id, not path). Kept from the previous manifest by src;
  // a new file gets kind prefix + slug of its path.
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  function idFor(entry, prev) {
    const id = prev?.id ?? `${PREFIX[entry.kind]}-${slug(entry.path)}`;
    if (taken.has(id)) throw new Error(`duplicate kit file id ${id} (${entry.src})`);
    taken.add(id);
    return id;
  }

  // Moving a kit file: add `"renames": { "<old src>": "<new src>" }` to kit-manifest.json before running this.
  // The moved file keeps its id (so installed copies keep updating in place) and remembers its old place in renamedFrom.
  const renames = manifest.renames ?? {};
  const oldSrcOf = new Map(Object.entries(renames).map(([from, to]) => [to, from]));
  const roleOf = (rel) => ROLE_BY_PREFIX.find(([pre]) => rel.startsWith(pre));

  const files = walk(KIT)
    .map((p) => relative(KIT, p).split(sep).join("/"))
    .filter((rel) => !SKIP.has(rel))
    .map((rel) => {
      const hit = roleOf(rel);
      if (!hit) throw new Error(`${KIT}/${rel}: not under a known kit folder (see ROLE_BY_PREFIX)`);
      const role = hit[1];
      const path = rel.slice(hit[0].length);
      const kind = KIND_BY_ROLE[role];
      const oldSrc = oldSrcOf.get(rel);
      const prev = previous.get(rel) ?? (oldSrc ? previous.get(oldSrc) : undefined);
      if (oldSrc && !prev) throw new Error(`renames: "${oldSrc}" is not in the previous manifest`);
      const renamedFrom = [...(prev?.renamedFrom ?? [])];
      if (oldSrc) {
        const oldHit = roleOf(oldSrc);
        const oldPath = oldHit ? oldSrc.slice(oldHit[0].length) : oldSrc;
        if (!renamedFrom.includes(oldPath)) renamedFrom.push(oldPath);
      }
      const text = readFileSync(join(KIT, rel), "utf8");
      const hash = sha256(text);
      // "version" = the kit version in which this file's content last changed
      const entry = { id: idFor({ kind, path, src: rel }, prev), kind, src: rel, role, path,
        version: prev?.sha256 === hash && prev.version ? prev.version : manifest.version, sha256: hash,
        renamedFrom, desc: descOf(rel, text) };
      if (rel.startsWith(OPTIONAL_PREFIX) || OPTIONAL_FILES.has(rel)) entry.optional = true;
    const policy = cfg.keepFiles?.has(rel) ? "keep" : prev?.policy;   // a policy set by hand in the manifest is kept too
    if (policy) entry.policy = policy;
    if (cfg.needs?.[rel]) entry.needs = cfg.needs[rel];
      return entry;
    })
    .sort((a, b) => (a.role + a.path).localeCompare(b.role + b.path));

  // The plugin's own files (main.js, manifest.json, styles.css) are deliberately NOT listed: the plugin never
  // updates itself (Obsidian developer policies).

  // A file that was in the previous manifest and is gone from kit/ (and wasn't moved) is retired: its id goes into
  // `removed`, so installed copies are marked "Retired" and left alone. Printed, so a deleted file is never silent.
  const removed = [...(manifest.removed ?? [])];
  for (const prev of previous.values()) {
    if (taken.has(prev.id) || removed.includes(prev.id)) continue;
    removed.push(prev.id);
    console.log(`retired: ${prev.src} (id ${prev.id})`);
  }
  const clash = removed.filter((id) => taken.has(id));
  if (clash.length) throw new Error(`id in both files and removed: ${clash.join(", ")}`);

  const { renames: _done, ...rest } = manifest;
  const out = { ...rest, schema: 2, files, removed };
  writeFileSync(manifestPath, JSON.stringify(out, null, 2) + "\n");
  console.log(`${manifestPath}: ${files.length} files`);
}

for (const name of readdirSync(KITS).sort()) {
  if (existsSync(join(KITS, name, "kit-manifest.json"))) regenerate(join(KITS, name));
}
