// Close experiment, the PDF: the note rendered fresh off-screen, cleaned, and turned into one HTML page for `printHtmlToPdf` (src/node.ts).
// The page string and the cleaning are plain functions (tested); `renderForPdf` is the only part that needs Obsidian.
import { Component, MarkdownRenderer, type App, type TFile } from "obsidian";
import { extractBlocks, text } from "../calc/engine";
import { makeFigure } from "../rig/figure-make";

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

/** Removes what does not belong on paper from a rendered note and opens folds. */
export function cleanForPdf(root: HTMLElement): void {
  // the RAFT block's "How it's worked out" prints open: its head (a button) keeps its words, only the arrow goes
  for (const fold of Array.from(root.querySelectorAll(".lk-sol-fold"))) {
    fold.addClass("is-open");
    for (const c of Array.from(fold.querySelectorAll(".chev"))) c.remove();
  }
  for (const sel of REMOVE) for (const e of Array.from(root.querySelectorAll(sel))) if (!e.hasClass("lk-sol-fold-head")) e.remove();
  for (const d of Array.from(root.querySelectorAll("details"))) d.setAttribute("open", "");
  // RAFT / Solution prep: an empty Actual cell prints blank, not "click to enter" (owner P2, 2026-10-22)
  for (const c of Array.from(root.querySelectorAll(".lk-sol-cell"))) c.removeClass("is-editable");
}

/** The bytes of one picture and its media type, or null when it cannot be read. */
export type ImageReader = (img: HTMLElement) => Promise<{ bytes: ArrayBuffer | Uint8Array; type: string } | null>;

/** Media types of the pictures a note can embed, by extension. */
const IMAGE_TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp", avif: "image/avif" };
export function imageType(ext: string): string { return IMAGE_TYPES[ext.toLowerCase()] ?? "application/octet-stream"; }

/** Turns every picture that the printed page could not open (`blob:` rig figure, app resource URL of an embed) into a `data:` URI from `read`; a picture that cannot be read stays as it is. */
export async function inlineImages(root: HTMLElement, read: ImageReader): Promise<void> {
  for (const img of Array.from(root.querySelectorAll("img"))) {
    const src = img.getAttribute("src") ?? "";
    if (!src || src.startsWith("data:")) continue;
    try {
      const got = await read(img);
      if (!got) continue;
      const bytes = got.bytes instanceof Uint8Array ? got.bytes : new Uint8Array(got.bytes);
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      img.setAttribute("src", `data:${got.type};base64,${btoa(bin)}`);
    } catch { /* left as it is */ }
  }
}

/** What every page carries: the running header (left bold, right plain) and the footer. */
export interface PageFrame { left: string; right: string; footer: string }

/** A CSS string literal for a margin box `content`. */
function cssString(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ")}"`;
}

/** The `@page` rule: A4 portrait with a thin running header and a small light-grey footer in the margin boxes (Electron's `printToPDF` draws them on every page). */
export function pageRule(frame: PageFrame): string {
  const box = "font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; vertical-align: bottom; padding-bottom: 2mm;";
  const head = `${box} font-size: 8pt; color: #333; border-bottom: 0.3pt solid #999; margin-bottom: 4mm;`;
  return `@page { size: A4 portrait; margin: 20mm 14mm 16mm;\n`
    + `  @top-left { content: ${cssString(frame.left)}; font-weight: 700; ${head} }\n`
    + `  @top-right { content: ${cssString(frame.right)}; ${head} }\n`
    + `  @bottom-center { content: ${cssString(frame.footer)}; ${box} vertical-align: top; padding: 2mm 0 0; font-size: 6pt; color: #aaa; } }`;
}

/** The running header of a lab note: `ABC0014 - RAFT test` gives left `ABC0014 · RAFT test`; right is Exp. Class, project and closing date, empty ones left out. */
export function frameHeader(basename: string, fm: Record<string, unknown> | undefined, closedOn: string): Pick<PageFrame, "left" | "right"> {
  const m = basename.match(/^([A-Za-z]*\d+)\s*[-–—:]?\s*(.*)$/);
  const get = (k: string): string => propRows({ [k]: fm?.[k] })[0]?.[1].trim() ?? "";
  const lookup = (name: string): string => get(Object.keys(fm ?? {}).find(k => k.toLowerCase() === name.toLowerCase()) ?? name);
  return {
    left: m ? [m[1], m[2]].filter(Boolean).join(" · ") : basename,
    right: [lookup("Exp. Class"), lookup("Project"), closedOn].filter(Boolean).join(" · "),
  };
}

/** The whole HTML page. `bodyHtml` is the cleaned note; `css` the app's stylesheets. */
export function pdfHtml(title: string, props: [string, string][], bodyHtml: string, frame: PageFrame, css = "", bodyClass = ""): string {
  const rows = props.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}\n${pageRule(frame)}\n${PRINT_CSS}</style></head>`
    + `<body class="${esc(bodyClass)}"><div class="print"><div class="markdown-rendered markdown-preview-view">`
    + `<h1 class="lk-close-title">${esc(title)}</h1>${rows ? `<table class="lk-close-props">${rows}</table>` : ""}${bodyHtml}</div></div></body></html>`;
}

/** Renders the note fresh (the open view loses sections that are off screen) and returns the finished HTML page (after 3 s at most it prints what has drawn). */
export async function renderForPdf(app: App, file: TFile, extra: [string, string][] = [], footer = "", closedOn = ""): Promise<{ html: string }> {
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
    cleanForPdf(clone);
    // pictures from the vault files the note embeds (no fetch); the rig figure drawn again from the note's parts tables
    const byUrl = new Map<string, TFile>();
    for (const e of app.metadataCache.getFileCache(file)?.embeds ?? []) {
      const f = app.metadataCache.getFirstLinkpathDest(e.link.split("#")[0].split("|")[0], file.path);
      if (f) byUrl.set(app.vault.getResourcePath(f).split("?")[0], f);
    }
    await inlineImages(clone, async img => {
      if (img.hasClass("lab-kit-rig-img")) {
        const svg = makeFigure(note)?.svg;
        return svg ? { bytes: new TextEncoder().encode(svg), type: "image/svg+xml" } : null;
      }
      const f = byUrl.get((img.getAttribute("src") ?? "").split("?")[0]);
      return f ? { bytes: await app.vault.readBinary(f), type: imageType(f.extension) } : null;
    });
    const bodyHtml = new XMLSerializer().serializeToString(clone);
    let css = "";
    for (const sheet of Array.from(document.styleSheets)) {
      try { for (const r of Array.from(sheet.cssRules)) css += r.cssText + "\n"; } catch { /* a sheet from another origin cannot be read */ }
    }
    const props = [...propRows(app.metadataCache.getFileCache(file)?.frontmatter), ...extra];
    const bodyClass = document.body.className.replace("theme-dark", "theme-light");
    const frame = { ...frameHeader(file.basename, app.metadataCache.getFileCache(file)?.frontmatter, closedOn), footer };
    return { html: pdfHtml(file.basename, props, bodyHtml, frame, css, bodyClass) };
  } finally {
    comp.unload();
    host.remove();
  }
}
