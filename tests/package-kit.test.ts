import { afterAll, describe, it } from "vitest";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { unzipSync } from "fflate";
import { buildKitFolder, zipKitFolder } from "../scripts/package-kit.mjs";

const ROOT = path.join(__dirname, "..");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "labkit-pack-"));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

const MAIN = path.join(TMP, "main.js");
fs.writeFileSync(MAIN, "// stub build\n");
const readManifest = (dir: string) => JSON.parse(fs.readFileSync(path.join(dir, "kit-manifest.json"), "utf8"));

// A throwaway copy of the repo inputs so a test can break them
function copyRoot(name: string): string {
  const root = path.join(TMP, name);
  fs.mkdirSync(root);
  for (const f of ["manifest.json", "styles.css"]) fs.copyFileSync(path.join(ROOT, f), path.join(root, f));
  for (const d of ["kit", "docs"]) fs.cpSync(path.join(ROOT, d), path.join(root, d), { recursive: true });
  return root;
}

describe("package-kit", () => {
  it("ships every file the manifest lists, and opens a note that exists", () => {
    const { dir, version } = buildKitFolder({ outDir: path.join(TMP, "out"), mainJs: MAIN });
    assert.strictEqual(path.basename(dir), `lab-kit-${version}`);
    const m = readManifest(dir);
    for (const f of m.files) assert.ok(fs.existsSync(path.join(dir, ...f.src.split("/"))), f.src);
    assert.ok(m.files.some((f: any) => f.role === "docs" && f.path === m.openAfter.path));
    assert.ok(fs.existsSync(path.join(dir, ".obsidian/plugins/lab-kit/main.js")));
  });

  it("zips with the kit folder as the top level", () => {
    const { dir } = buildKitFolder({ outDir: path.join(TMP, "out2"), mainJs: MAIN });
    const names = Object.keys(unzipSync(new Uint8Array(fs.readFileSync(zipKitFolder(dir)))));
    const top = path.basename(dir);
    assert.ok(names.every((n) => n.startsWith(`${top}/`)));
    assert.ok(names.includes(`${top}/kit-manifest.json`));
    assert.ok(names.includes(`${top}/.obsidian/plugins/lab-kit/styles.css`));
  });

  it("fails when the manifest lists a file that is not shipped", () => {
    const root = copyRoot("broken-src");
    const mp = path.join(root, "kit/kit-manifest.json");
    const m = JSON.parse(fs.readFileSync(mp, "utf8"));
    m.files.push({ src: "Templates/Nope.md", role: "templates", path: "Nope.md" });
    fs.writeFileSync(mp, JSON.stringify(m));
    assert.throws(() => buildKitFolder({ outDir: path.join(TMP, "o3"), mainJs: MAIN, root }), /Templates\/Nope\.md/);
  });

  it("fails when openAfter points at a file that is not shipped", () => {
    const root = copyRoot("broken-open");
    const mp = path.join(root, "kit/kit-manifest.json");
    const m = JSON.parse(fs.readFileSync(mp, "utf8"));
    m.openAfter = { role: "docs", path: "Lab notebook kit - update to v9.md" };
    fs.writeFileSync(mp, JSON.stringify(m));
    assert.throws(() => buildKitFolder({ outDir: path.join(TMP, "o4"), mainJs: MAIN, root }), /openAfter/);
  });

  it("fails when plugin and kit versions differ", () => {
    const root = copyRoot("broken-version");
    const mp = path.join(root, "manifest.json");
    fs.writeFileSync(mp, JSON.stringify({ ...JSON.parse(fs.readFileSync(mp, "utf8")), version: "9.9.9" }));
    assert.throws(() => buildKitFolder({ outDir: path.join(TMP, "o5"), mainJs: MAIN, root }), /9\.9\.9/);
  });

  it("fails when main.js has not been built", () => {
    assert.throws(() => buildKitFolder({ outDir: path.join(TMP, "o6"), mainJs: path.join(TMP, "nope.js") }), /npm run build/);
  });
});
