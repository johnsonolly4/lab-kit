// Regenerates the "files" list in kit/kit-manifest.json from what's in kit/.
// Per file: id (kept once assigned), kind, version (kit version where the content last changed), sha256, renamedFrom.
// Keeps version, notes, rewrite, delete, templater, enableCss as they are.
// Usage: npm run kit:manifest
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, relative, sep } from "path";
import { sha256 } from "./embed-kit.mjs";

const KIT = "kit";
const KIND_BY_ROLE = { cssSnippets: "snippet", templates: "template", scripts: "script", userScripts: "script", docs: "script" };
const PREFIX = { snippet: "snip", template: "tpl", script: "script" };
const ROLE_BY_PREFIX = [
  [".obsidian/snippets/", "cssSnippets"],
  ["Extras/scripts/templater/", "userScripts"],
  ["Extras/scripts/", "scripts"],
  ["Templates/", "templates"],
];
const SKIP = new Set(["kit-manifest.json", "install-updater.ps1", "install-updater.sh"]);
const KEEP = new Set(["Extras/scripts/lab-config.json"]);

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const manifestPath = join(KIT, "kit-manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
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

const files = walk(KIT)
  .map((p) => relative(KIT, p).split(sep).join("/"))
  .filter((rel) => !SKIP.has(rel))
  .map((rel) => {
    const hit = ROLE_BY_PREFIX.find(([pre]) => rel.startsWith(pre));
    const role = hit ? hit[1] : "docs";
    const path = hit ? rel.slice(hit[0].length) : rel;
    const kind = KIND_BY_ROLE[role];
    const prev = previous.get(rel);
    const hash = sha256(readFileSync(join(KIT, rel), "utf8"));
    // "version" = the kit version in which this file's content last changed
    const entry = { id: idFor({ kind, path, src: rel }, prev), kind, src: rel, role, path,
      version: prev?.sha256 === hash && prev.version ? prev.version : manifest.version, sha256: hash,
      renamedFrom: prev?.renamedFrom ?? [] };
    if (KEEP.has(rel)) entry.policy = "keep";
    return entry;
  })
  .sort((a, b) => (a.role + a.path).localeCompare(b.role + b.path));

// The plugin's own files (main.js, manifest.json, styles.css) are deliberately NOT listed: the plugin never
// updates itself (Obsidian developer policies). The package still carries them for the install-updater scripts.

const out = { schema: 1, ...manifest, files, removed: manifest.removed ?? [] };
writeFileSync(manifestPath, JSON.stringify(out, null, 2) + "\n");
console.log(`kit-manifest.json: ${files.length} files`);
