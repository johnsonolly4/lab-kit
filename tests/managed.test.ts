import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import {
  applyManaged, emptyManagedState, followRename, forgetManaged, kitNormalise, kitSha1, kitSha256, planManaged, planRetired, resolveManaged, restoreManaged, setDetached, sortByAttention, statusOf, attentionRank,
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
    remove: async (p: string) => { delete files[p]; },
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

describe("per-file actions (Manage kit files)", () => {
  it("statusOf gives a label for every action", async () => {
    const v = memVault(); const { state } = await install(v);
    v.files["Templates/Book.md"] = "mine\n"; delete v.files["Templates/Menu.md"];
    v.files["Extras/scripts/templater/snip.js"] = "my edit\n";
    state.files["script-config"].detached = true;
    const labels = (await planManaged(v, V2, state, roles)).map(i => statusOf(i).label);
    expect(labels).toEqual(["Missing", "Conflict", "Changed by you", "Detached"]);
    expect(statusOf(by(await planManaged(memVault({ "Templates/Menu.md": "menu v1\n" }), V1, null, roles), "tpl-menu")).label).toBe("Up to date");
    expect(statusOf(by(await planManaged(memVault(), V1, null, roles), "tpl-menu")).label).toBe("New");
  });

  it("sorts the files that need action first, each kind in path order", () => {
    const item = (action: ManagedItem["action"], dest: string) => ({ action, dest, file: { id: dest } }) as unknown as ManagedItem;
    const all: ManagedItem["action"][] = ["off", "detached", "keep", "up-to-date", "user-modified", "create", "fast-forward", "missing", "merge", "needs-merge"];
    const items = all.map((a, i) => item(a, `b${i}.md`));
    items.push(item("fast-forward", "a.md"), item("create", "a.md"));
    expect(sortByAttention(items).map(i => `${i.action}:${i.dest}`)).toEqual([
      "needs-merge:b9.md", "merge:b8.md", "missing:b7.md", "fast-forward:a.md", "fast-forward:b6.md", "create:a.md", "create:b5.md",
      "user-modified:b4.md", "up-to-date:b3.md", "keep:b2.md", "detached:b1.md", "off:b0.md"]);
    expect(new Set(all.map(a => attentionRank(item(a, "x")))).size).toBe(all.length);   // every action has its own rank
  });

  it("a merged file (changed by you, then merged) needs no attention", () => {
    const it = { action: "user-modified", dest: "x", file: { id: "x" } } as unknown as ManagedItem;
    expect(attentionRank(it, { merged: true } as never)).toBe(attentionRank({ ...it, action: "up-to-date" }));
    expect(attentionRank(it)).toBeLessThan(attentionRank({ ...it, action: "up-to-date" }));
  });

  it("updates one file and leaves the others and the kit version alone", async () => {
    const v = memVault(); const { state } = await install(v);
    const plan = await planManaged(v, V2, state, roles);
    const out = await applyManaged(v, V2, plan, state, { ...opts, select: it => it.file.id === "tpl-menu", keepVersion: true });
    expect(v.files["Templates/Menu.md"]).toBe("menu v2\n");
    expect(v.files["Templates/Book.md"]).toBe("line 1\nline 2\nline 3\n");      // also fast-forwardable, not selected
    expect(out.state.installedKitVersion).toBe("0.1.0");
    expect(out.state.files["tpl-book"].installedHash).toBe(state.files["tpl-book"].installedHash);
  });

  it("restores a file you changed: backs up your copy, writes the kit's, refreshes the base copy", async () => {
    const v = memVault(); const { state } = await install(v);
    v.files["Extras/scripts/templater/snip.js"] = "my edit\n";
    const item = by(await planManaged(v, V2, state, roles), "script-snip");
    expect(item.action).toBe("user-modified");
    const out = await restoreManaged(v, item, state, opts);
    expect(v.files["Extras/scripts/templater/snip.js"]).toBe("path = My scripts/x\n");
    expect(v.files["Backups/2026-10-03T12-00-00-000Z/Extras/scripts/templater/snip.js"]).toBe("my edit\n");
    expect(out.result).toMatchObject({ outcome: "updated", id: "script-snip" });
    expect(v.files[".obsidian/plugins/lab-kit/kit-base/script-snip.txt"]).toBe("path = My scripts/x\n");
    expect((await planManaged(v, V2, out.state, roles)).find(i => i.file.id === "script-snip")!.action).toBe("up-to-date");
  });

  it("restores a needs-merge file to the new kit version", async () => {
    const v = memVault(); const { state } = await install(v);
    v.files["Templates/Book.md"] = "line 1\nline 2\nline 3 mine\n";
    const item = by(await planManaged(v, V2, state, roles), "tpl-book");
    const out = await restoreManaged(v, item, state, opts);
    expect(v.files["Templates/Book.md"]).toBe("line 1\nline 2\nline 3 changed by kit\n");
    expect(v.files["Backups/2026-10-03T12-00-00-000Z/Templates/Book.md"]).toBe("line 1\nline 2\nline 3 mine\n");
    expect(out.state.files["tpl-book"].installedHash).toBe(await kitSha256("line 1\nline 2\nline 3 changed by kit\n"));
  });

  it("restores a missing file without a backup", async () => {
    const v = memVault(); const { state } = await install(v);
    delete v.files["Templates/Menu.md"];
    const item = by(await planManaged(v, V1, state, roles), "tpl-menu");
    const out = await restoreManaged(v, item, state, opts);
    expect(v.files["Templates/Menu.md"]).toBe("menu v1\n");
    expect(out.result).toMatchObject({ outcome: "created" });
    expect(out.result.backup).toBeUndefined();
  });

  it("refuses to restore detached, kept and up-to-date files", async () => {
    const v = memVault(); const { state } = await install(v);
    state.files["tpl-menu"].detached = true;
    v.files["My scripts/config.json"] = "{\"mine\":1}\n";
    const plan = await planManaged(v, V2, state, roles);
    for (const id of ["tpl-menu", "script-config", "script-snip"]) {
      const before = { ...v.files };
      const out = await restoreManaged(v, by(plan, id), state, opts);
      expect(out.result.outcome).toBe("skipped");
      expect(v.files).toEqual(before);
    }
  });

  it("detach and re-attach", async () => {
    const v = memVault(); const { state } = await install(v);
    expect(setDetached(state, "tpl-menu", true)).toBe(true);
    expect(by(await planManaged(v, V2, state, roles), "tpl-menu").action).toBe("detached");
    expect(setDetached(state, "tpl-menu", false)).toBe(true);
    expect(by(await planManaged(v, V2, state, roles), "tpl-menu").action).toBe("fast-forward");
    expect(setDetached(state, "nope", true)).toBe(false);
    expect(setDetached(null, "tpl-menu", true)).toBe(false);
  });
});

describe("three-way merge", () => {
  const plan = (v: ReturnType<typeof memVault>, state: Awaited<ReturnType<typeof install>>["state"], k = V2) => planManaged(v, k, state, roles, null, opts.baseDir);

  it("plans a clean merge when your edit and the kit's don't overlap, and writes nothing", async () => {
    const v = memVault(); const { state } = await install(v);
    v.files["Templates/Book.md"] = "line 1 mine\nline 2\nline 3\n";
    const before = { ...v.files };
    const item = by(await plan(v, state), "tpl-book");
    expect(item.action).toBe("merge");
    expect(item.merged).toBe("line 1 mine\nline 2\nline 3 changed by kit\n");
    expect(v.files).toEqual(before);
    expect(statusOf(item).label).toBe("Merges cleanly");
  });

  it("does not merge in the safe default selection", async () => {
    const v = memVault(); const { state } = await install(v);
    v.files["Templates/Book.md"] = "line 1 mine\nline 2\nline 3\n";
    const out = await applyManaged(v, V2, await plan(v, state), state, opts);
    expect(v.files["Templates/Book.md"]).toBe("line 1 mine\nline 2\nline 3\n");
    expect(out.results.find(r => r.id === "tpl-book")!.outcome).toBe("skipped");
  });

  it("writes the merge when selected: backs up your copy, base becomes the kit text, status 'Merged'", async () => {
    const v = memVault(); const { state } = await install(v);
    v.files["Templates/Book.md"] = "line 1 mine\nline 2\nline 3\n";
    const out = await applyManaged(v, V2, await plan(v, state), state, { ...opts, select: it => it.action === "merge" });
    expect(v.files["Templates/Book.md"]).toBe("line 1 mine\nline 2\nline 3 changed by kit\n");
    expect(v.files["Backups/2026-10-03T12-00-00-000Z/Templates/Book.md"]).toBe("line 1 mine\nline 2\nline 3\n");
    expect(v.files[".obsidian/plugins/lab-kit/kit-base/tpl-book.txt"]).toBe("line 1\nline 2\nline 3 changed by kit\n");
    expect(out.results.find(r => r.id === "tpl-book")).toMatchObject({ outcome: "merged" });
    expect(out.state.files["tpl-book"]).toMatchObject({ merged: true, installedHash: await kitSha256("line 1\nline 2\nline 3 changed by kit\n") });
    const after = by(await plan(v, out.state), "tpl-book");
    expect(after.action).toBe("user-modified");                       // your edit still differs from the kit
    expect(statusOf(after, out.state.files["tpl-book"]).label).toBe("Merged");
  });

  it("leaves a real conflict untouched and counts it", async () => {
    const v = memVault(); const { state } = await install(v);
    v.files["Templates/Book.md"] = "line 1\nline 2\nline 3 mine\n";
    const item = by(await plan(v, state), "tpl-book");
    expect(item).toMatchObject({ action: "needs-merge", conflicts: 1 });
    expect(statusOf(item).label).toBe("Conflict");
    const out = await applyManaged(v, V2, [item], state, { ...opts, select: () => true });
    expect(v.files["Templates/Book.md"]).toBe("line 1\nline 2\nline 3 mine\n");
    expect(out.results[0].outcome).toBe("skipped");
  });

  it("stays needs-merge when there is no base copy", async () => {
    const v = memVault(); const { state } = await install(v);
    delete v.files[".obsidian/plugins/lab-kit/kit-base/tpl-book.txt"];
    v.files["Templates/Book.md"] = "line 1 mine\nline 2\nline 3\n";
    const item = by(await plan(v, state), "tpl-book");
    expect(item.action).toBe("needs-merge");
    expect(item.conflicts).toBeUndefined();
  });

  it("can still restore the kit original instead of merging", async () => {
    const v = memVault(); const { state } = await install(v);
    v.files["Templates/Book.md"] = "line 1 mine\nline 2\nline 3\n";
    const out = await restoreManaged(v, by(await plan(v, state), "tpl-book"), state, opts);
    expect(v.files["Templates/Book.md"]).toBe("line 1\nline 2\nline 3 changed by kit\n");
    expect(out.state.files["tpl-book"].merged).toBeUndefined();
  });
});

describe("resolving a conflict (merge window)", () => {
  const plan = (v: ReturnType<typeof memVault>, state: Awaited<ReturnType<typeof install>>["state"]) => planManaged(v, V2, state, roles, null, opts.baseDir);
  const conflict = async () => {
    const v = memVault(); const { state } = await install(v);
    v.files["Templates/Book.md"] = "line 1\nline 2\nline 3 mine\n";
    const item = by(await plan(v, state), "tpl-book");
    expect(item.action).toBe("needs-merge");
    return { v, state, item };
  };

  it("writes the resolved text after a backup, bases the next merge on the kit text, and reads as Merged", async () => {
    const { v, state, item } = await conflict();
    const resolved = "line 1\nline 2\nline 3 mine and kit\n";
    const out = await resolveManaged(v, item, resolved, state, opts);
    expect(out.result.outcome).toBe("merged");
    expect(v.files["Templates/Book.md"]).toBe(resolved);
    expect(v.files[out.result.backup!]).toBe("line 1\nline 2\nline 3 mine\n");
    expect(v.files[".obsidian/plugins/lab-kit/kit-base/tpl-book.txt"]).toBe(item.text);
    expect(out.state.files["tpl-book"].merged).toBe(true);
    const after = by(await plan(v, out.state), "tpl-book");
    expect(after.action).toBe("user-modified");
    expect(statusOf(after, out.state.files["tpl-book"]).label).toBe("Merged");
  });

  it("keep all mine: file and backups untouched, but it counts as based on the new kit", async () => {
    const { v, state, item } = await conflict();
    const writes = v.writes.length;
    const out = await resolveManaged(v, item, null, state, opts);
    expect(out.result.outcome).toBe("adopted");
    expect(out.result.backup).toBeUndefined();
    expect(v.files["Templates/Book.md"]).toBe("line 1\nline 2\nline 3 mine\n");
    expect(v.writes.length).toBe(writes + 1);                                  // only the base copy
    expect(out.state.files["tpl-book"].installedHash).toBe(item.kitHash);
    expect(out.state.files["tpl-book"].merged).toBeUndefined();
    expect(by(await plan(v, out.state), "tpl-book").action).toBe("user-modified");
  });

  it("resolving to the text already in the file is the same as keeping it", async () => {
    const { v, state, item } = await conflict();
    const out = await resolveManaged(v, item, "line 1\r\nline 2\r\nline 3 mine\r\n", state, opts);
    expect(out.result.outcome).toBe("adopted");
  });

  it("refuses a file that isn't in conflict", async () => {
    const v = memVault(); const { state } = await install(v);
    const out = await resolveManaged(v, by(await plan(v, state), "tpl-book"), "x", state, opts);
    expect(out.result.outcome).toBe("skipped");
    expect(v.files["Templates/Book.md"]).toBe("line 1\nline 2\nline 3\n");
  });
});

describe("files from the old folder updater", () => {
  it("hashes with SHA-1 of the exact text, like the old updater recorded (no line-ending normalising)", async () => {
    expect(await kitSha1("abc")).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
    expect(await kitSha1("a\r\n")).not.toBe(await kitSha1("a\n"));
  });
  it("treats a file unchanged since the old updater as unmodified", async () => {
    const v = memVault({ "Templates/Menu.md": "menu v0\n", "Templates/Book.md": "edited by me\n" });
    const legacy = { files: { "Templates/Menu.md": await kitSha1("menu v0\n"), "Templates/Book.md": await kitSha1("what the old updater wrote\n") }, hash: kitSha1 };
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

describe("renames and retired files", () => {
  const moved = (k: EmbeddedKit): EmbeddedKit => ({
    ...k,
    manifest: { ...k.manifest, files: k.manifest.files.map(f => f.id === "tpl-book" ? { ...f, dest: "Notes/Book.md", renamedFrom: ["Book.md"] } : f) },
  });

  it("keeps updating your file in place when the kit moves it (same id)", async () => {
    const v = memVault(); const { state } = await install(v);
    v.files["Templates/Book.md"] = "mine 1\nline 2\nline 3\n";
    const plan = await planManaged(v, moved(V2), state, roles, null, opts.baseDir);
    const item = by(plan, "tpl-book");
    expect(item.dest).toBe("Templates/Book.md");
    expect(item.action).toBe("merge");
    expect(item.merged).toBe("mine 1\nline 2\nline 3 changed by kit\n");
  });

  it("adopts a file found at an old place when nothing is tracked yet", async () => {
    const v = memVault({ "Templates/Book.md": "line 1\nline 2\nline 3 changed by kit\n" });
    const item = by(await planManaged(v, moved(V2), null, roles), "tpl-book");
    expect(item.dest).toBe("Templates/Book.md");
    expect(item.action).toBe("up-to-date");
    expect(item.untracked).toBe(true);
  });

  it("installs a moved file at the new place when no copy exists", async () => {
    const v = memVault();
    const item = by(await planManaged(v, moved(V2), null, roles), "tpl-book");
    expect(item.dest).toBe("Templates/Notes/Book.md");
    expect(item.action).toBe("create");
  });

  it("lists a removed file you have installed, and nothing for one you never had", async () => {
    const v = memVault(); const { state } = await install(v);
    const dropped: EmbeddedKit = { ...V2, manifest: { ...V2.manifest, files: V2.manifest.files.filter(f => f.id !== "tpl-menu"), removed: ["tpl-menu", "tpl-never"] } };
    expect(await planRetired(v, dropped, state)).toEqual([{ id: "tpl-menu", path: "Templates/Menu.md", exists: true }]);
    delete v.files["Templates/Menu.md"];
    expect((await planRetired(v, dropped, state))[0].exists).toBe(false);
    expect(await planRetired(v, dropped, null)).toEqual([]);
  });

  it("forgetting a retired file drops its state and base copy but leaves your file", async () => {
    const v = memVault(); const { state } = await install(v);
    const next = await forgetManaged(v, state, "tpl-menu", opts.baseDir);
    expect(next.files["tpl-menu"]).toBeUndefined();
    expect(next.files["tpl-book"]).toBeDefined();
    expect(v.files[`${opts.baseDir}/tpl-menu.txt`]).toBeUndefined();
    expect(v.files["Templates/Menu.md"]).toBe("menu v1\n");
  });
});
