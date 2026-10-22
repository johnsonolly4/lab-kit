import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { pdfHtml, propRows, cleanForPdf, inlineImages, footerTemplate, PRINT_CSS, WIDE_COLUMNS } from "../src/close/pdf";
import { closedFooter } from "../src/close/mark";

const { El } = createRequire(import.meta.url)("./helpers/minidom.cjs");
const html = (wide: boolean) => pdfHtml("ABC0011", [["Exp. Class", "RAFT"], ["Chemicals", "A, B"]], "<p>Dry the beads first.</p>", wide, "x{}");

describe("propRows", () => {
  it("lists every property, joins arrays, shows link names, leaves out cssclasses and position", () => {
    expect(propRows({ cssclasses: ["lab"], position: {}, Chemicals: ["[[Toluene]]", "[[a|Water]]"], N: 3, Empty: null }))
      .toEqual([["Chemicals", "Toluene, Water"], ["N", "3"], ["Empty", ""]]);
    expect(propRows(undefined)).toEqual([]);
  });
});

describe("pdfHtml", () => {
  it("has one row per property, the title and the .print wrapper", () => {
    const h = html(false);
    expect(h).toContain("<tr><th>Exp. Class</th><td>RAFT</td></tr>");
    expect(h).toContain("<tr><th>Chemicals</th><td>A, B</td></tr>");
    expect(h).toContain('<h1 class="lk-close-title">ABC0011</h1>');
    expect(h).toContain('<div class="print">');
    expect(h).toContain("<p>Dry the beads first.</p>");
  });
  it("is portrait unless a table is wide", () => {
    expect(html(false)).toContain("size: A4 portrait");
    expect(html(true)).toContain("size: A4 landscape");
  });
  it("escapes the title and the properties", () => {
    expect(pdfHtml("a<b", [["k", "<i>"]], "", false)).toContain("<th>k</th><td>&lt;i&gt;</td>");
  });
  it("carries the print rules and the given CSS", () => {
    expect(html(false)).toContain(PRINT_CSS);
    expect(html(false)).toContain("x{}");
  });
});

describe("cleanForPdf", () => {
  const note = (cols: number) => {
    const root = new El("div");
    root.createDiv({ cls: "block-language-lab-header lab-header" }).createEl("table", { cls: "lab-hazard-table" });
    root.createEl("button", { text: "+ Row" });
    const block = root.createDiv({ cls: "block-language-calc" });
    const tr = block.createEl("table").createEl("tr");
    for (let i = 0; i < cols; i++) tr.createEl("td", { text: `c${i}` });
    root.createEl("details");
    return root;
  };
  it("removes the hazard block and the buttons", () => {
    const root = note(3);
    cleanForPdf(root);
    expect(root.querySelector(".lab-header")).toBeNull();
    expect(root.querySelector(".lab-hazard-table")).toBeNull();
    expect(root.querySelector("button")).toBeNull();
    expect(root.querySelector(".block-language-calc")).not.toBeNull();
  });
  it("opens folds", () => {
    const root = note(3);
    cleanForPdf(root);
    expect(root.querySelector("details").getAttribute("open")).toBe("");
  });
  it(`marks a table of more than ${WIDE_COLUMNS} columns wide and returns the widest count`, () => {
    const wide = note(11), narrow = note(WIDE_COLUMNS);
    expect(cleanForPdf(wide)).toBe(11);
    expect(wide.querySelector(".block-language-calc").hasClass("lk-wide")).toBe(true);
    expect(cleanForPdf(narrow)).toBe(WIDE_COLUMNS);
    expect(narrow.querySelector(".block-language-calc").hasClass("lk-wide")).toBe(false);
  });
});

describe("footerTemplate", () => {
  it("prints the closed footer text exactly", () => {
    expect(footerTemplate(closedFooter("2026-10-20", "ABC0011", "a".repeat(64)))).toContain("Closed 2026-10-20 · ABC0011 · SHA-256 aaaaaaaaaaaa<");
  });
});

describe("inlineImages", () => {
  const reply = (type: string, data: string) => async () => new Response(new Blob([data], { type }));
  it("turns a blob: or app picture into a data: URI with its own type, and leaves data: and failures alone", async () => {
    const root = new El("div");
    const a = root.createEl("img", { attr: { src: "blob:abc" } });
    const b = root.createEl("img", { attr: { src: "data:image/png;base64,AA==" } });
    const c = root.createEl("img", { attr: { src: "app://x/gone.png" } });
    await inlineImages(root, async u => { if (u.startsWith("app:")) throw new Error("no"); return reply("image/svg+xml", "<svg/>")(); });
    expect(a.getAttribute("src")).toBe(`data:image/svg+xml;base64,${btoa("<svg/>")}`);
    expect(b.getAttribute("src")).toBe("data:image/png;base64,AA==");
    expect(c.getAttribute("src")).toBe("app://x/gone.png");
  });
  it("falls back to png when the reply has no type", async () => {
    const root = new El("div");
    const a = root.createEl("img", { attr: { src: "app://x/p.png" } });
    await inlineImages(root, reply("", "x"));
    expect(a.getAttribute("src")).toBe(`data:image/png;base64,${btoa("x")}`);
  });
});

describe("PRINT_CSS", () => {
  it("never breaks a word in a table cell: calc data cells stay on one line, no fixed layout", () => {
    expect(PRINT_CSS).not.toContain("anywhere");
    expect(PRINT_CSS).not.toContain("table-layout: fixed");
    expect(PRINT_CSS).toContain(".block-language-calc td { white-space: nowrap; }");
  });
});
