// `npm run tidy-fixture [dir]`: writes a small vault of old-style notes to test-vault-tidy/ (or dir), to try Tidy up notes on.
// Sources: tests/fixtures/tidy-vault (lab, knowledge, scripts) and tests/fixtures/tidy-vault-planning (projects, meetings, to-dos, hubs).
// Own vault root, because Tidy matches folders like "02 Projects" from the vault root. Never writes to test-vault/.
import { cpSync, existsSync, rmSync } from "fs";
import { join, resolve, sep } from "path";

const out = resolve(process.argv[2] ?? "test-vault-tidy");
const guarded = [resolve("test-vault"), resolve("src"), resolve("kits"), resolve("tests")];
if (guarded.some(g => out === g || out.startsWith(g + sep))) { console.error(`Refusing to write into ${out}`); process.exit(1); }
if (existsSync(out)) rmSync(out, { recursive: true, force: true });
for (const src of ["tests/fixtures/tidy-vault", "tests/fixtures/tidy-vault-planning"]) cpSync(join(src), out, { recursive: true });
console.log(`Tidy fixture vault written to ${out}. Open it as a vault in Obsidian, install the kits (Review update…), then run Tidy up notes.`);
