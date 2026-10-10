// `npm run tidy-fixture [dir]`: writes a small vault of old-style notes to test-vault-tidy/ (or dir), to try Tidy up notes on.
// Sources: tests/fixtures/tidy-vault (lab, knowledge, scripts) and tests/fixtures/tidy-vault-planning (projects, meetings, to-dos, hubs).
// Own vault root, because Tidy matches folders like "02 Projects" from the vault root. Never writes to test-vault/.
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join, resolve, sep } from "path";

const out = resolve(process.argv[2] ?? "test-vault-tidy");
const guarded = [resolve("test-vault"), resolve("src"), resolve("kits"), resolve("tests")];
if (guarded.some(g => out === g || out.startsWith(g + sep))) { console.error(`Refusing to write into ${out}`); process.exit(1); }
if (existsSync(out)) rmSync(out, { recursive: true, force: true });
for (const src of ["tests/fixtures/tidy-vault", "tests/fixtures/tidy-vault-planning"]) cpSync(join(src), out, { recursive: true });
// The plugin itself (built: npm run build), so the vault opens with Lab Kit installed; Obsidian still asks once to turn community plugins on
const plugin = join(out, ".obsidian", "plugins", "lab-kit");
const built = ["main.js", "manifest.json", "styles.css"];
if (built.every(f => existsSync(f))) {
  mkdirSync(plugin, { recursive: true });
  for (const f of built) copyFileSync(f, join(plugin, f));
  writeFileSync(join(out, ".obsidian", "community-plugins.json"), JSON.stringify(["lab-kit"]));
  console.log("Lab Kit copied into the vault (turn community plugins on when Obsidian asks).");
} else console.log("Lab Kit not copied: run npm run build first, then npm run tidy-fixture again.");
console.log(`Tidy fixture vault written to ${out}. Open it as a vault in Obsidian, install the kits (Review update…), then run Tidy up notes.`);
