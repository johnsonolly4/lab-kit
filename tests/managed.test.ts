import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import {
  applyManaged, emptyManagedState, followRename, kitNormalise, kitSha256, planManaged,
  type EmbeddedKit, type ManagedAdapter, type ManagedItem
} from "../src/kit/managed";
// @ts-expect-error plain .mjs build helper
import { embeddedKit } from "../scripts/embed-kit.mjs";

const roles = { templates: "Templates", userScripts: "Extras/scripts/templater", scripts: "My scripts", cssSnippets: ".obsidian/snippets", backups: "Backups" };
const opts = { baseDir: ".obsidian/plugins/lab-kit/kit-base", backups: "Backups", stamp: "2026-10-03T12:00:00.000Z" };

/** In-memory vault adapter (text only). */
function memVault(files: Record<string, string> = {}): ManagedAdapter & { files: Record<string, string>; writes: string[] } {
  const dirs = new Set<string>();
  const v = {
    files, writes: [] as string[],
    exists: async (p: string) => p in files || dirs.has(p),
    read: async (p: string) => { if (!(p in files)) throw new Error("ENOENT " + p); return files[p]; },
    write: async (p: string, d: string) => { files[p] = d; v.writes.push(p); },
    mkdir: async (p: string) => { dirs.add(p); },
  };
  return v as unknown as ManagedAdapter & { files: Record<string, string>; writes: string[] };
}

/** Build a small kit; the v2 bundle changes only the files named in `changed`. */
function kit(version: string, text: Record<string, string>): EmbeddedKit {
  const meta = [
    { id: "tpl-menu", kind: "template", role: "templates", dest: "Menu.md" },
    { id: "tpl-book", kind: "template", role: "templates", dest: "Book.md" },
    { id: "script-snip", kind: "script", role: "userScripts", dest: "snip.js" },
    { id: "script-config", kind: "script", role: "scripts", dest: "config.json", policy: "keep" },
  ] as const;
  return {
    manifest: {
      schema: 1, kitVersion: version, removed: [], rewrite: { "Extras/scripts": "scripts" },
      files: meta.map(m => ({ ...m, src: m.dest, version, sha256: "", renamedFrom: [] })),
    },
    contents: text,
  };
}
const V1 = kit("0.1.0", { "tpl-menu": "menu v1\n", "tpl-book": "line 1\nline 2\nline 3\n", "script-snip": "path = Extras/scripts/x\n", "script-config": "{}\n" });
const V2 = kit("0.2.0", { "tpl-menu": "menu v2\n", "tpl-book": "line 1\nline 2\nline 3 changed by kit\n", "script-snip": "path = Extras/scripts/x\n", "script-config": "{\"new\":1}\n" });
const by = (items: ManagedItem[], id: string): ManagedItem => items.find(i => i.file.id === id)!;
const install = async (v: ReturnType<typeof memVault>, k = V1) => {
  const plan = await planManaged(v, k, null, roles);
  return applyManaged(v, k, plan, null, opts);
};

describe("kitSha256", () => {
  it("ignores CRLF and a BOM", async () => {
    expect(await kitSha256("a\r\nb\r\n")).toBe(await kitSha256("a\nb\n"));
    expect(await kitSha256("\uFEFFa\n")).toBe(await kitSha256("a\n"));
    expect(await kitSha256("a")).not.toBe(await kitSha256("b"));
    expect(kitNormalise("\uFEFFx\r\ny")).toBe("x\ny");
  });
});

describe("fresh install", () => {
  it("creates every file, applies the folder rewrite, and saves base copies", async () => {
    const v = memVault();
    const plan = await planManaged(v, V1, null, roles);
    expect(plan.map(p => p.action)).toEqual(["create", "create", "create", "create"]);
    expect(v.writes).toEqual([]);                                   // planning (dry run) writes nothing
    const { state, results } = await applyManaged(v, V1, plan, null, opts);
    expect(results.every(r => r.outcome === "created")).toBe(true);
    expect(v.files["Templates/Menu.md"]).toBe("menu v1\n");
    expect(v.files["Extras/scripts/templater/snip.js"]).toBe("path = My scripts/x\n");
    expect(v.files["My scripts/config.json"]).toBe("{}\n");
    for (const id of ["tpl-menu", "tpl-book", "script-snip", "script-config"]) expect(v.files[`.obsidian/plugins/lab-kit/kit-base/${id}.txt`]).toBeDefined();
    expect(v.files[".obsidian/plugins/lab-kit/kit-base/script-snip.txt"]).toBe("path = My scripts/x\n");
    expect(state.installedKitVersion).toBe("0.1.0");
    expect(state.files["tpl-menu"]).toMatchObject({ path: "Templates/Menu.md", installedVersion: "0.1.0", detached: false, userDeleted: false, pendingConflict: null });
    expect(state.files["tpl-menu"].installedHash).toBe(await kitSha256("menu v1\n"));
  });
});

describe("update", () => {
  it("fast-forwards an unmodified file and backs up the old copy", async () => {
    const v = memVault(); const { state } = await install(v);
    const plan = await planManaged(v, V2, state, roles);
    expect(by(plan, "tpl-menu").action).toBe("fast-forward");
    const out = await applyManaged(v, V2, plan, state, opts);
    expect(v.files["Templates/Menu.md"]).toBe("menu v2\n");
    expect(v.files["Backups/2026-10-03T12-00-00-000Z/Templates/Menu.md"]).toBe("menu v1\n");
    expect(v.files[".obsidian/plugins/lab-kit/kit-base/tpl-menu.txt"]).toBe("menu v2\n");
    expect(out.state.installedKitVersion).toBe("0.2.0");
    expect(out.state.files["tpl-menu"].installedHash).toBe(await kitSha256("menu v2\n"));
  });

  it("leaves a file you changed alone when the kit did not change it", async () => {
    const v = memVault(); const { state } = await install(v);
    v.files["Extras/scripts/templater/snip.js"] = "my edit\n";
    const plan = await planManaged(v, V2, state, roles);
    expect(by(plan, "script-snip").action).toBe("user-modified");
    await applyManaged(v, V2, plan, state, opts);
    expect(v.files["Extras/scripts/templater/snip.js"]).toBe("my edit\n");
  });

  it("reports needs-merge and does not touch the file when you and the kit both changed it", async () => {
    const v = memVault(); const { state } = await install(v);
    v.files["Templates/Book.md"] = "line 1\nline 2\nline 3 mine\n";
    const plan = await planManaged(v, V2, state, roles);
    expect(by(plan, "tpl-book").action).toBe("needs-merge");
    // even when a caller selects it, apply never overwrites it
    const out = await applyManaged(v, V2, plan, state, { ...opts, select: () => true });
    expect(v.files["Templates/Book.md"]).toBe("line 1\nline 2\nline 3 mine\n");
    expect(out.results.find(r => r.id === "tpl-book")!.outcome).toBe("skipped");
    expect(out.state.files["tpl-book"].installedHash).toBe(state.files["tpl-book"].installedHash);
  });

  it("treats CRLF copies as unchanged", async () => {
    const v = memVault(); const { state } = await install(v);
    v.files["Templates/Menu.md"] = "menu v1\r\n";                    // same text, Windows line endings
    expect(by(await planManaged(v, V2, state, roles), "tpl-menu").action).toBe("fast-forward");
    expect(by(await planManaged(v, V1, state, roles), "tpl-menu").action).toBe("up-to-date");
  });

  it("never overwrites a keep file", async () => {
    const v = memVault(); const { state } = await install(v);
    v.files["My scripts/config.json"] = "{\"mine\":1}\n";
    const plan = await planManaged(v, V2, state, roles);
    expect(by(plan, "script-config").action).toBe("keep");
    await applyManaged(v, V2, plan, state, opts);
    expect(v.files["My scripts/config.json"]).toBe("{\"mine\":1}\n");
  });
});

describe("missing and detached files", () => {
  it("does not recreate a deleted file unless asked", async () => {
    const v = memVault(); const { state } = await install(v);
    delete v.files["Templates/Menu.md"];
    const plan = await planManaged(v, V2, state, roles);
    expect(by(plan, "tpl-menu").action).toBe("missing");
    await applyManaged(v, V2, plan, state, opts);
    expect(v.files["Templates/Menu.md"]).toBeUndefined();
    await applyManaged(v, V2, plan, state, { ...opts, select: it => it.action === "missing" });
    expect(v.files["Templates/Menu.md"]).toBe("menu v2\n");
  });

  it("never touches a detached file", async () => {
    const v = memVault(); const { state } = await install(v);
    state.files["tpl-menu"].detached = true;
    const before = v.files["Templates/Menu.md"];
    const plan = await planManaged(v, V2, state, roles);
    expect(by(plan, "tpl-menu").action).toBe("detached");
    const out = await applyManaged(v, V2, plan, state, { ...opts, select: () => true });
    expect(v.files["Templates/Menu.md"]).toBe(before);
    expect(out.state.files["tpl-menu"].detached).toBe(true);
  });

  it("follows a file you moved", async () => {
    const v = memVault(); const { state } = await install(v);
    v.files["Notes/Menu.md"] = v.files["Templates/Menu.md"]; delete v.files["Templates/Menu.md"];
    expect(followRename(state, "Templates/Menu.md", "Notes/Menu.md")).toBe(true);
    const item = by(await planManaged(v, V2, state, roles), "tpl-menu");
    expect(item.dest).toBe("Notes/Menu.md");
    expect(item.action).toBe("fast-forward");
  });
});

describe("files from the old folder updater", () => {
  const sha1 = (t: string): string => "h:" + t;                       // stand-in hash, only equality matters
  it("treats a file unchanged since the old updater as unmodified", async () => {
    const v = memVault({ "Templates/Menu.md": "menu v0\n", "Templates/Book.md": "edited by me\n" });
    const legacy = { files: { "Templates/Menu.md": sha1("menu v0\n"), "Templates/Book.md": sha1("what the old updater wrote\n") }, hash: sha1 };
    const plan = await planManaged(v, V1, emptyManagedState(), roles, legacy);
    expect(by(plan, "tpl-menu").action).toBe("fast-forward");
    expect(by(plan, "tpl-book").action).toBe("user-modified");
    expect(by(plan, "tpl-book").untracked).toBe(true);
  });
  it("adopts a file that already equals the kit", async () => {
    const v = memVault({ "Templates/Menu.md": "menu v1\n" });
    const plan = await planManaged(v, V1, null, roles);
    expect(by(plan, "tpl-menu").action).toBe("up-to-date");
    const out = await applyManaged(v, V1, plan, null, opts);
    expect(out.state.files["tpl-menu"].installedHash).toBe(await kitSha256("menu v1\n"));
    expect(v.writes.some(p => p === "Templates/Menu.md")).toBe(false);   // not rewritten
  });
});

describe("embedded kit (the real one)", () => {
  const real = embeddedKit() as EmbeddedKit & { paths: string[] };
  const listed = JSON.parse(readFileSync("kit/kit-manifest.json", "utf8")) as { files: { id: string; sha256: string; version: string }[] };
  it("has unique ids, a kind per file and text for each", () => {
    const ids = real.manifest.files.map(f => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of real.manifest.files) { expect(["template", "snippet", "script"]).toContain(f.kind); expect(real.contents[f.id].length).toBeGreaterThan(0); }
  });
  it("matches kit-manifest.json (run npm run kit:manifest if this fails)", async () => {
    for (const f of real.manifest.files) {
      expect(await kitSha256(real.contents[f.id])).toBe(f.sha256);
      expect(listed.files.find(l => l.id === f.id)?.sha256).toBe(f.sha256);
    }
    expect(listed.files.length).toBe(real.manifest.files.length);
  });
  it("installs into an empty vault and then reports everything up to date", async () => {
    const v = memVault();
    const plan = await planManaged(v, real, null, roles);
    expect(plan.every(p => p.action === "create")).toBe(true);
    const { state } = await applyManaged(v, real, plan, null, opts);
    expect((await planManaged(v, real, state, roles)).every(p => p.action === "up-to-date")).toBe(true);
  });
});
