// Reads kits/<id>/kit-manifest.json and every file it lists, for embedding in main.js (esbuild plugin) and for tests.
// Contents are stored with normalised line endings ("\n", no BOM) so the same build gives the same bytes on every OS.
import { existsSync, readFileSync, readdirSync } from "fs";
import { createHash } from "crypto";
import { join } from "path";

export const normalise = (text) => text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
export const sha256 = (text) => createHash("sha256").update(normalise(text), "utf8").digest("hex");

/** Folder that holds one folder per kit (each with its own kit-manifest.json). */
export const KITS = "kits";

/** { manifest, contents } of one kit, as consumed by src/kit/managed.ts (type EmbeddedKit). `paths` = every file read. */
export function embeddedKit(root = join(KITS, "lab")) {
  const m = JSON.parse(readFileSync(join(root, "kit-manifest.json"), "utf8"));
  if (!m.id) throw new Error(`${join(root, "kit-manifest.json")}: no "id"`);
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
      ...(f.needs ? { needs: f.needs } : {}),
      ...(f.defaultOff ? { defaultOff: true } : {}),
    };
  });
  return {
    manifest: {
      schema: m.schema ?? 1, id: m.id, kitVersion: m.version, files, removed: m.removed ?? [], rewrite: m.rewrite ?? {},
      ...(m.migrations ? { migrations: m.migrations } : {}), ...(m.enableCss ? { enableCss: m.enableCss } : {}), ...(m.disableCss ? { disableCss: m.disableCss } : {}), ...(m.templater ? { templater: m.templater } : {}),
    },
    contents,
    paths,
  };
}

/** Every kit under kits/ (folders with a kit-manifest.json), sorted by id: { schema: 2, kits, paths } (type EmbeddedKits). */
export function embeddedKits(root = KITS) {
  const kits = readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(root, d.name, "kit-manifest.json")))
    .map((d) => embeddedKit(join(root, d.name)));
  const ids = kits.map((k) => k.manifest.id);
  const dup = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dup) throw new Error(`two kits have the id ${dup}`);
  kits.sort((a, b) => a.manifest.id.localeCompare(b.manifest.id));
  return { schema: 2, kits: kits.map(({ paths: _p, ...k }) => k), paths: kits.flatMap((k) => k.paths) };
}
