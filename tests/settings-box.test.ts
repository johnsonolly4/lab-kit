// A settings row that acts as a link (src/kit/settings-box.ts actionRow).
import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { actionRow } from "../src/kit/settings-box";

const { El } = createRequire(import.meta.url)("./helpers/minidom.cjs");

describe("actionRow", () => {
  const make = () => { const row = new El("div"); let n = 0; actionRow({ settingEl: row }, () => { n++; }); return { row, count: () => n }; };
  it("marks the row as a clickable link: class, role and a place in the tab order", () => {
    const { row } = make();
    expect(row.hasClass("lab-kit-action")).toBe(true);
    expect(row.getAttribute("role")).toBe("button");
    expect(row.getAttribute("tabindex")).toBe("0");
  });
  it("a click runs it once", () => {
    const { row, count } = make();
    row.dispatch("click");
    expect(count()).toBe(1);
  });
  it("Enter and Space run it; other keys do not", () => {
    const { row, count } = make();
    row.dispatch("keydown", { key: "Enter" });
    row.dispatch("keydown", { key: " " });
    row.dispatch("keydown", { key: "a" });
    row.dispatch("keydown", { key: "Tab" });
    expect(count()).toBe(2);
  });
});
