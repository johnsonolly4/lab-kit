// Assembles the kit the updater installs from: dist/lab-kit-<version>/ and dist/lab-kit-<version>.zip
// (kit/ + built plugin, exactly as listed in kit/kit-manifest.json).
// Usage: npm run package   (builds main.js first)
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, cpSync, copyFileSync, readdirSync, statSync } from "fs";
import { join, relative, sep, resolve } from "path";
import { fileURLToPath } from "url";
import { zipSync } from "fflate";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PLUGIN_DIR = ".obsidian/plugins/lab-kit";

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

/** Builds the kit folder in outDir and returns { dir, version, missing }. Throws when something the manifest lists is absent. */
export function buildKitFolder({ outDir, mainJs = join(ROOT, "main.js"), root = ROOT }) {
  const pluginManifest = readJson(join(root, "manifest.json"));
  const kitManifest = readJson(join(root, "kit/kit-manifest.json"));
  if (pluginManifest.version !== kitManifest.version) {
    throw new Error(`manifest.json is ${pluginManifest.version} but kit/kit-manifest.json is ${kitManifest.version}. Bump them together (the release skill does).`);
  }
  if (!existsSync(mainJs)) throw new Error(`${mainJs} not found. Run npm run build first.`);

  const dir = join(outDir, `lab-kit-${kitManifest.version}`);
  rmSync(dir, { recursive: true, force: true });
  cpSync(join(root, "kit"), dir, { recursive: true });

  const pluginDest = join(dir, ...PLUGIN_DIR.split("/"));
  mkdirSync(pluginDest, { recursive: true });
  copyFileSync(mainJs, join(pluginDest, "main.js"));
  for (const f of ["manifest.json", "styles.css"]) copyFileSync(join(root, f), join(pluginDest, f));

  const missing = kitManifest.files.map((f) => f.src).filter((src) => !existsSync(join(dir, ...src.split("/"))));
  if (missing.length) throw new Error(`kit-manifest.json lists files that are not in the package:\n  ${missing.join("\n  ")}\nRun npm run kit:manifest.`);
  return { dir, version: kitManifest.version };
}

/** Zips a kit folder to <dir>.zip, keeping the folder as the top level so unzipping into the update folder gives one kit version folder. */
export function zipKitFolder(dir) {
  const top = dir.split(sep).pop();
  const entries = {};
  for (const p of walk(dir)) entries[`${top}/${relative(dir, p).split(sep).join("/")}`] = readFileSync(p);
  const zipPath = `${dir}.zip`;
  writeFileSync(zipPath, zipSync(entries));
  return zipPath;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { dir, version } = buildKitFolder({ outDir: join(ROOT, "dist") });
    const zip = zipKitFolder(dir);
    console.log(`Kit ${version}: ${relative(ROOT, dir)}/ and ${relative(ROOT, zip)}`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
