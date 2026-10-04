// Reads kit/kit-manifest.json and every file it lists, for embedding in main.js (esbuild plugin) and for tests.
// Contents are stored with normalised line endings ("\n", no BOM) so the same build gives the same bytes on every OS.
import { readFileSync } from "fs";
import { createHash } from "crypto";
import { join } from "path";

export const normalise = (text) => text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
export const sha256 = (text) => createHash("sha256").update(normalise(text), "utf8").digest("hex");

/** { manifest, contents } as consumed by src/kit/managed.ts (type EmbeddedKit). `paths` = every file read. */
export function embeddedKit(root = "kit") {
  const m = JSON.parse(readFileSync(join(root, "kit-manifest.json"), "utf8"));
  const contents = {};
  const paths = [join(root, "kit-manifest.json")];
  const files = m.files.map((f) => {
    if (!f.id || !f.kind) throw new Error(`kit-manifest.json: ${f.src} has no id/kind (run npm run kit:manifest)`);
    if (contents[f.id] !== undefined) throw new Error(`kit-manifest.json: duplicate id ${f.id}`);
    const p = join(root, ...f.src.split("/"));
    const raw = readFileSync(p, "utf8");
    if (raw.includes("\0")) throw new Error(`${f.src} is not a text file`);
    contents[f.id] = normalise(raw);
    paths.push(p);
    return {
      id: f.id, kind: f.kind, role: f.role, src: f.src, dest: f.path, version: f.version,
      sha256: sha256(raw), renamedFrom: f.renamedFrom ?? [], ...(f.policy ? { policy: f.policy } : {}),
      ...(f.desc ? { desc: f.desc } : {}), ...(f.optional ? { optional: true } : {}),
    };
  });
  return {
    manifest: { schema: m.schema ?? 1, kitVersion: m.version, files, removed: m.removed ?? [], rewrite: m.rewrite ?? {} },
    contents,
    paths,
  };
}
