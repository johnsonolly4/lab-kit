import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { pdfHtml, propRows, cleanForPdf, inlineImages, imageType, pageRule, frameHeader, PRINT_CSS } from "../src/close/pdf";
import { closedFooter } from "../src/close/mark";

const { El } = createRequire(import.meta.url)("./helpers/minidom.cjs");
const frame = { left: "ABC0011 · Test", right: "RAFT · Proj · 2026-10-20", footer: closedFooter("2026-10-20", "ABC0011", "a".repeat(64)) };
const html = () => pdfHtml("ABC0011", [["Exp. Class", "RAFT"], ["Chemicals", "A, B"]], "<p>Dry the beads first.</p>", frame, "x{}");

describe("propRows", () => {
  it("lists every property, joins arrays, shows link names, leaves out cssclasses and position", () => {
    expect(propRows({ cssclasses: ["lab"], position: {}, Chemicals: ["[[Toluene]]", "[[a|Water]]"], N: 3, Empty: null }))
      .toEqual([["Chemicals", "Toluene, Water"], ["N", "3"], ["Empty", ""]]);
    expect(propRows(undefined)).toEqual([]);
  });
});

describe("pdfHtml", () => {
  it("has one row per property, the title and the .print wrapper", () => {
    const h = html();
    expect(h).toContain("<tr><th>Exp. Class</th><td>RAFT</td></tr>");
    expect(h).toContain("<tr><th>Chemicals</th><td>A, B</td></tr>");
    expect(h).toContain('<h1 class="lk-close-title">ABC0011</h1>');
    expect(h).toContain('<div class="print">');
    expect(h).toContain("<p>Dry the beads first.</p>");
  });
  it("is always portrait A4, never landscape", () => {
    expect(html()).toContain("size: A4 portrait");
    expect(html()).not.toContain("landscape");
  });
  it("escapes the title and the properties", () => {
    expect(pdfHtml("a<b", [["k", "<i>"]], "", frame)).toContain("<th>k</th><td>&lt;i&gt;</td>");
  });
  it("carries the print rules and the given CSS", () => {
    expect(html()).toContain(PRINT_CSS);
    expect(html()).toContain("x{}");
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
  it("prints the RAFT \"How it's worked out\" fold open with its head words, without the arrow", () => {
    const root = new El("div");
    const fold = root.createDiv({ cls: "lk-sol-fold" });
    const head = fold.createEl("button", { cls: "lk-sol-fold-head" });
    head.createSpan({ cls: "chev", text: "▸" });
    head.createSpan({ text: "How it's worked out" });
    fold.createDiv({ cls: "lk-sol-fold-body", text: "# n = m / M" });
    cleanForPdf(root);
    expect(fold.hasClass("is-open")).toBe(true);
    expect(root.querySelector(".lk-sol-fold-head")).not.toBeNull();
    expect(root.querySelector(".chev")).toBeNull();
    expect(root.querySelector(".lk-sol-fold-body")).not.toBeNull();
  });
  it("prints an empty RAFT / Solution prep Actual cell blank (no \"click to enter\")", () => {
    const root = new El("div");
    const cell = root.createDiv({ cls: "lk-sol-cell is-num is-actual is-empty is-editable" });
    cleanForPdf(root);
    expect(cell.hasClass("is-editable")).toBe(false);
    expect(cell.hasClass("is-empty")).toBe(true);
  });
});

describe("page frame", () => {
  it("puts the running header and the footer in the @page margin boxes, footer small and light grey", () => {
    const r = pageRule(frame);
    expect(r).toMatch(/@top-left \{ content: "ABC0011 · Test"; font-weight: 700;/);
    expect(r).toContain('@top-right { content: "RAFT · Proj · 2026-10-20";');
    expect(r).toContain("border-bottom: 0.3pt solid #999; margin-bottom: 4mm");   // a gap between the rule and the text
    expect(r).toContain('Closed 2026-10-20 · ABC0011 · SHA-256 aaaaaaaaaaaa"');
    const foot = r.match(/@bottom-center \{[^}]*\}/)![0];
    expect(foot).toContain("font-size: 6pt");   // the old footer was 8px (6pt)
    expect(foot).toContain("color: #aaa");      // lighter than the old #555
  });
  it("escapes quotes, backslashes and line breaks in the text", () => {
    expect(pageRule({ left: 'a"b\\c', right: "x\ny", footer: "" })).toContain('"a\\"b\\\\c"');
    expect(pageRule({ left: "", right: "x\ny", footer: "" })).toContain('"x y"');
  });
  it("header: number and title on the left; Exp. Class, project and closing date on the right, empty ones left out", () => {
    expect(frameHeader("ABC0014 - RAFT test", { "Exp. Class": "RAFT", Project: "[[Beads]]" }, "2026-10-20"))
      .toEqual({ left: "ABC0014 · RAFT test", right: "RAFT · Beads · 2026-10-20" });
    expect(frameHeader("ABC0014", { Project: "" }, "2026-10-20")).toEqual({ left: "ABC0014", right: "2026-10-20" });
    expect(frameHeader("Scratch note", undefined, "")).toEqual({ left: "Scratch note", right: "" });
  });
});

describe("inlineImages", () => {
  it("turns a picture into a data: URI from the reader, and leaves data: pictures and unreadable ones alone", async () => {
    const root = new El("div");
    const a = root.createEl("img", { cls: "lab-kit-rig-img", attr: { src: "blob:abc" } });
    const b = root.createEl("img", { attr: { src: "data:image/png;base64,AA==" } });
    const c = root.createEl("img", { attr: { src: "app://x/gone.png" } });
    const d = root.createEl("img", { attr: { src: "app://x/p.png" } });
    const asked: string[] = [];
    await inlineImages(root, async img => {
      asked.push(img.getAttribute("src") ?? "");
      if (img.hasClass("lab-kit-rig-img")) return { bytes: new TextEncoder().encode("<svg/>"), type: "image/svg+xml" };
      if (img.getAttribute("src") === "app://x/gone.png") return null;
      return { bytes: new Uint8Array([120]).buffer, type: imageType("PNG") };
    });
    expect(a.getAttribute("src")).toBe(`data:image/svg+xml;base64,${btoa("<svg/>")}`);
    expect(b.getAttribute("src")).toBe("data:image/png;base64,AA==");
    expect(c.getAttribute("src")).toBe("app://x/gone.png");
    expect(d.getAttribute("src")).toBe(`data:image/png;base64,${btoa("x")}`);
    expect(asked).not.toContain("data:image/png;base64,AA==");
  });
  it("leaves a picture as it is when the reader throws", async () => {
    const root = new El("div");
    const a = root.createEl("img", { attr: { src: "app://x/p.jpg" } });
    await inlineImages(root, async () => { throw new Error("no"); });
    expect(a.getAttribute("src")).toBe("app://x/p.jpg");
  });
  it("knows the media type of the usual picture files", () => {
    expect(imageType("jpg")).toBe("image/jpeg");
    expect(imageType("svg")).toBe("image/svg+xml");
    expect(imageType("xyz")).toBe("application/octet-stream");
  });
});

describe("PRINT_CSS", () => {
  it("never breaks a word in a table cell: calc data cells stay on one line, no fixed layout", () => {
    expect(PRINT_CSS).not.toContain("anywhere");
    expect(PRINT_CSS).not.toContain("table-layout: fixed");
    expect(PRINT_CSS).toContain(".markdown-rendered .block-language-calc tbody > tr > td { white-space: nowrap; }");
  });
  it("keeps a heading or a calc title with what follows it", () => {
    expect(PRINT_CSS).toContain("h1, h2, h3, h4, h5, h6, .block-language-calc > :first-child { break-after: avoid; }");
  });
});
