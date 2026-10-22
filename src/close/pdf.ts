// Close experiment, the PDF: the note rendered fresh off-screen, cleaned, and turned into one HTML page for `printHtmlToPdf` (src/node.ts).
// The page string and the cleaning are plain functions (tested); `renderForPdf` is the only part that needs Obsidian.
import { Component, MarkdownRenderer, type App, type TFile } from "obsidian";
import { extractBlocks, text } from "../calc/engine";

/** A table with more columns than this turns the whole PDF landscape. */
export const WIDE_COLUMNS = 7;

/** Parts of a rendered note that do not belong on paper: hazards, buttons, the note tools. */
const REMOVE = [".block-language-lab-header", ".lab-header", ".lab-hazards-host", ".lab-hazards", "button",
  ".lab-kit-tools", ".lab-kit-name", ".mod-header", ".mod-footer", ".metadata-container", ".markdown-preview-pusher", ".edit-block-button", ".copy-code-button"];

/** Print rules, after the app's own CSS. Obsidian hides everything outside `.print` when printing, so the page wraps its content in it. */
export const PRINT_CSS = `
body { background: #fff; }
.lk-close-title { margin: 0 0 6px; }
.lk-close-props { border-collapse: collapse; margin: 0 0 12px; font-size: 9pt; }
.lk-close-props th { text-align: left; padding: 1px 10px 1px 0; color: #555; font-weight: 600; vertical-align: top; }
.lk-close-props td { padding: 1px 0; }
.markdown-rendered { font-size: 10pt; }
.markdown-rendered table { table-layout: auto; font-size: 8pt; }
.markdown-rendered th, .markdown-rendered td { font-size: 8pt; white-space: normal; word-break: normal; overflow-wrap: normal; hyphens: none; padding: 2px 4px; }
.lab-kit-scroll, .block-language-calc { overflow: visible; max-width: none; width: 100%; }
.markdown-rendered .block-language-calc tbody > tr > td { white-space: nowrap; }   /* beats Obsidian's .markdown-rendered tbody > tr > td */
tr { break-inside: avoid; }
.lab-kit-rig-diagram { overflow: visible; break-inside: avoid; }
.lab-kit-rig-img { min-width: 0 !important; width: auto; max-width: 100%; max-height: 150mm; margin: 0 auto; }
h1, h2, h3, h4, h5, h6, .block-language-calc > :first-child { break-after: avoid; }
`;

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Front matter as table rows: arrays joined with commas, `[[a|b]]` shown as `b`, Obsidian's own keys left out. */
export function propRows(fm: Record<string, unknown> | undefined): [string, string][] {
  const show = (v: unknown): string => {
    if (Array.isArray(v)) return v.map(show).filter(s => s !== "").join(", ");
    if (v == null) return "";
    if (typeof v === "object") return JSON.stringify(v);
    return text(v).replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, a: string, b?: string) => b ?? a);
  };
  return Object.entries(fm ?? {}).filter(([k]) => k !== "cssclasses" && k !== "position").map(([k, v]) => [k, show(v)]);
}

/** Removes what does not belong on paper from a rendered note, opens folds and marks wide calc tables; returns the widest table's column count. */
export function cleanForPdf(root: HTMLElement): number {
  // the RAFT block's "How it's worked out" prints open: its head (a button) keeps its words, only the arrow goes
  for (const fold of Array.from(root.querySelectorAll(".lk-sol-fold"))) {
    fold.addClass("is-open");
    for (const c of Array.from(fold.querySelectorAll(".chev"))) c.remove();
  }
  for (const sel of REMOVE) for (const e of Array.from(root.querySelectorAll(sel))) if (!e.hasClass("lk-sol-fold-head")) e.remove();
  let widest = 0;
  for (const block of Array.from(root.querySelectorAll(".block-language-calc"))) {
    const n = block.querySelector("tr")?.children.length ?? 0;
    if (n > WIDE_COLUMNS) block.addClass("lk-wide");
    widest = Math.max(widest, n);
  }
  for (const d of Array.from(root.querySelectorAll("details"))) d.setAttribute("open", "");
  return widest;
}

/** Turns every picture that the printed page could not open (`blob:` rig figure, app resource URL of an embed) into a `data:` URI; a picture that cannot be fetched stays as it is. */
export async function inlineImages(root: HTMLElement, fetcher: (url: string) => Promise<Response> = u => fetch(u)): Promise<void> {
  for (const img of Array.from(root.querySelectorAll("img"))) {
    const src = img.getAttribute("src") ?? "";
    if (!src || src.startsWith("data:")) continue;
    try {
      const blob = await (await fetcher(src)).blob();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const type = blob.type || (/\.svg(\?|$)/i.test(src) ? "image/svg+xml" : "image/png");
      img.setAttribute("src", `data:${type};base64,${btoa(bin)}`);
    } catch { /* left as it is */ }
  }
}

/** The whole HTML page. `bodyHtml` is the cleaned note; `css` the app's stylesheets. */
export function pdfHtml(title: string, props: [string, string][], bodyHtml: string, wide: boolean, css = "", bodyClass = ""): string {
  const rows = props.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}\n@page { size: A4 ${wide ? "landscape" : "portrait"}; margin: 14mm; }\n${PRINT_CSS}</style></head>`
    + `<body class="${esc(bodyClass)}"><div class="print"><div class="markdown-rendered markdown-preview-view">`
    + `<h1 class="lk-close-title">${esc(title)}</h1>${rows ? `<table class="lk-close-props">${rows}</table>` : ""}${bodyHtml}</div></div></body></html>`;
}

/** The footer `printToPDF` repeats on every page. */
export function footerTemplate(footer: string): string {
  return `<div style="width:100%;text-align:center;font-size:8px;color:#555;">${esc(footer)}</div>`;
}

/** Renders the note fresh (the open view loses sections that are off screen) and returns the finished HTML page (after 3 s at most it prints what has drawn). */
export async function renderForPdf(app: App, file: TFile, extra: [string, string][] = []): Promise<{ html: string; wide: boolean }> {
  const note = await app.vault.read(file);
  const body = note.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  const host = document.body.createDiv({ cls: "markdown-rendered markdown-preview-view lk-close-host" });
  const comp = new Component();
  comp.load();
  try {
    await MarkdownRenderer.render(app, body, host, file.path, comp);
    const calcs = extractBlocks(body).length;
    for (let i = 0; i < 20; i++) {
      if (host.querySelectorAll(".block-language-calc table").length >= calcs) break;
      await new Promise<void>(r => window.setTimeout(r, 150));
    }
    await new Promise<void>(r => window.setTimeout(r, 150));   // a last moment for the tables to fill
    const clone = host.cloneNode(true) as HTMLElement;
    clone.removeClass("lk-close-host");
    const widest = cleanForPdf(clone);
    await inlineImages(clone);
    const bodyHtml = new XMLSerializer().serializeToString(clone);
    let css = "";
    for (const sheet of Array.from(document.styleSheets)) {
      try { for (const r of Array.from(sheet.cssRules)) css += r.cssText + "\n"; } catch { /* a sheet from another origin cannot be read */ }
    }
    const props = [...propRows(app.metadataCache.getFileCache(file)?.frontmatter), ...extra];
    const bodyClass = document.body.className.replace("theme-dark", "theme-light");
    return { html: pdfHtml(file.basename, props, bodyHtml, widest > WIDE_COLUMNS, css, bodyClass), wide: widest > WIDE_COLUMNS };
  } finally {
    comp.unload();
    host.remove();
  }
}
