// Regenerates the "files" list in kit/kit-manifest.json from what's in kit/.
// Keeps version, notes, rewrite, delete, templater, enableCss, openAfter as they are.
// Usage: npm run kit:manifest
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, relative, sep } from "path";

const KIT = "kit";
const ROLE_BY_PREFIX = [
  [".obsidian/plugins/lab-calc/", "plugin"],
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
const files = walk(KIT)
  .map((p) => relative(KIT, p).split(sep).join("/"))
  .filter((rel) => !SKIP.has(rel))
  .map((rel) => {
    const hit = ROLE_BY_PREFIX.find(([pre]) => rel.startsWith(pre));
    const entry = hit ? { src: rel, role: hit[1], path: rel.slice(hit[0].length) } : { src: rel, role: "docs", path: rel };
    if (KEEP.has(rel)) entry.policy = "keep";
    return entry;
  })
  .sort((a, b) => (a.role + a.path).localeCompare(b.role + b.path));

// Shipped alongside kit/ by the packaging step (built plugin + docs)
const EXTRA = [
  { src: ".obsidian/plugins/lab-calc/main.js", role: "plugin", path: "main.js" },
  { src: ".obsidian/plugins/lab-calc/manifest.json", role: "plugin", path: "manifest.json" },
  { src: ".obsidian/plugins/lab-calc/styles.css", role: "plugin", path: "styles.css" },
  { src: "Lab notebook kit - tutorial.md", role: "docs", path: "Lab notebook kit - tutorial.md" },
  { src: "Lab notebook kit - changelog.md", role: "docs", path: "Lab notebook kit - changelog.md" },
];
for (const e of EXTRA) if (!files.some((f) => f.src === e.src)) files.push(e);

manifest.files = files;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`kit-manifest.json: ${files.length} files`);
