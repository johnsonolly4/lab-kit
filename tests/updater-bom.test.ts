// kitPlan reads text files with TextDecoder (no Buffer). A leading BOM must survive exactly as it did with Buffer.toString("utf8"),
// or every kit file that has one would hash differently and show up as "changed by you".
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { kitPlan, type Kit } from "../src/kit/updater";

const sha1 = (b: Uint8Array): string => createHash("sha1").update(b).digest("hex");
const BOM = [0xef, 0xbb, 0xbf];
const withBom = (text: string): Uint8Array => Buffer.concat([Buffer.from(BOM), Buffer.from(text, "utf8")]);

const adapter = { exists: async () => false, readBinary: async () => new ArrayBuffer(0), writeBinary: async () => {}, write: async () => {}, remove: async () => {}, mkdir: async () => {} };
const kitWith = (src: string, rewrite?: Record<string, string>): Kit => ({
  dir: "", folder: "kit", manifest: { version: "0", files: [{ src, path: src, role: "templates" }], ...(rewrite ? { rewrite } : {}) },
});
const roles = { templates: "T", scripts: "S" };

describe("kitPlan keeps a BOM like Buffer did", () => {
  it("a text file without rewrites hashes as its own bytes", async () => {
    const bytes = withBom("# Lab Book é\n");
    const [it1] = await kitPlan(adapter, kitWith("a.md"), roles, null, () => bytes);
    expect([...it1.buf!.slice(0, 3)]).toEqual(BOM);
    expect([...it1.buf!]).toEqual([...bytes]);
    expect(it1.newHash).toBe(sha1(bytes));
  });

  it("a rewritten text file hashes as the old Buffer code did", async () => {
    const bytes = withBom("see Extras/scripts/x.js\n");
    const [it1] = await kitPlan(adapter, kitWith("a.md", { "Extras/scripts": "scripts" }), { templates: "T", scripts: "Mine/js" }, null, () => bytes);
    const old = Buffer.from(Buffer.from(bytes).toString("utf8").split("Extras/scripts").join("Mine/js"), "utf8");   // the previous implementation
    expect(it1.newHash).toBe(sha1(old));
    expect([...it1.buf!.slice(0, 3)]).toEqual(BOM);
    expect(it1.text).toBe("﻿see Mine/js/x.js\n");
  });

  it("a file that is not text is left alone", async () => {
    const bytes = new Uint8Array([...BOM, 1, 2, 3]);
    const [it1] = await kitPlan(adapter, kitWith("a.png"), roles, null, () => bytes);
    expect(it1.text).toBeNull();
    expect(it1.newHash).toBe(sha1(bytes));
  });
});
