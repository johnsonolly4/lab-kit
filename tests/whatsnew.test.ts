import { describe, it } from "vitest";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { latestSection, sectionHeading } from "../src/whatsnew";

describe("what's new", () => {
  const md = "# Title\n\n## Unreleased (v0.4)\n- one\n- two\n\n## v0.3 (2026-10-02)\n- old\n";

  it("takes only the newest section", () => {
    assert.strictEqual(latestSection(md), "## Unreleased (v0.4)\n- one\n- two");
    assert.strictEqual(sectionHeading(latestSection(md)), "Unreleased (v0.4)");
  });

  it("copes with CRLF, a single section and no section", () => {
    assert.strictEqual(latestSection("## v1\r\n- a\r\n"), "## v1\n- a");
    assert.strictEqual(latestSection("# Title\nno sections"), "");
  });

  it("works on the real changelog", () => {
    const real = fs.readFileSync(path.join(__dirname, "..", "docs", "changelog.md"), "utf8");
    const s = latestSection(real);
    assert.ok(s.startsWith("## "));
    assert.ok(!s.slice(3).includes("\n## "));
    assert.ok(s.split("\n").length > 1);
  });
});
