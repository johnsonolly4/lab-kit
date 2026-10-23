// `npm run starter [dir]`: writes the new-vault starter (Obsidian settings, plugin list, install scripts; from the kits) to dist/starter/ (or dir).
// The logic is src/kit/starter.ts (TypeScript, tested); it is bundled to a temporary file here and run.
import esbuild from "esbuild";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { pathToFileURL } from "url";
import { embeddedKits } from "./embed-kit.mjs";

const out = process.argv[2] ?? join("dist", "starter");
const tmp = mkdtempSync(join(tmpdir(), "lab-kit-starter-"));
try {
  const file = join(tmp, "starter.mjs");
  await esbuild.build({ entryPoints: ["src/kit/starter.ts"], bundle: true, format: "esm", platform: "node", outfile: file, external: ["obsidian"], logLevel: "error" });
  const { buildStarter } = await import(pathToFileURL(file).href);
  const { files } = buildStarter(embeddedKits().kits, ".obsidian");
  for (const [path, text] of Object.entries(files)) {
    const dest = join(out, ...path.split("/"));
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, text, { mode: path.endsWith(".sh") ? 0o755 : 0o644 });
  }
  // No folders: the kit install makes them (CI4)
  console.log(`Starter written to ${out}: ${Object.keys(files).length} files.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
