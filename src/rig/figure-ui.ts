// The rig figure window: a preview of the figure, its size on paper, Save SVG (every device) and Save PNG (desktop only).
// The figure itself is made in figure-svg.ts, the numbers and names in figure-export.ts. Plan: docs/plans/rig-figure.md, Phase 4.
import { Modal, Notice, Platform, Setting, TFile, normalizePath, type App } from "obsidian";
import { cardWindow } from "../kit/window-look";
import { ensureFolder } from "../kit/ensure-folder";
import { figuresTarget, kitJoin } from "../kit/paths";
import { figureFileName, heightMm, pngSize, savedNote, sizeLine } from "./figure-export";
import { makeFigure, type Made } from "./figure-make";

/** Width and dpi the window remembers while Obsidian is open. */
const choice = { widthMm: 400, dpi: 300 };

/** The SVG text drawn onto a canvas of exactly width × height and read as PNG bytes; the canvas is the size it really got. Rejects when the browser could not make it. */
async function makePng(svg: string, width: number, height: number): Promise<{ bytes: ArrayBuffer; width: number; height: number }> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = createEl("img");
    await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = () => fail(new Error("The figure could not be drawn.")); img.src = url; });
    const canvas = createEl("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("The figure could not be drawn.");
    ctx.drawImage(img, 0, 0, width, height);
    const png = await new Promise<Blob | null>(ok => canvas.toBlob(ok, "image/png"));
    if (!png) throw new Error("The browser could not make a PNG this large.");
    return { bytes: await png.arrayBuffer(), width: canvas.width, height: canvas.height };
  } finally { URL.revokeObjectURL(url); }
}

/** Opens the figure window for a rig note, under `anchor` (the button that was clicked) with no dimmed background; in the middle, dimmed, without one. */
export async function openFigureWindow(app: App, notePath: string, figuresFolder: string, anchor: HTMLElement | null): Promise<void> {
  const file = app.vault.getAbstractFileByPath(notePath);
  const made = file instanceof TFile ? makeFigure(await app.vault.cachedRead(file)) : null;
  if (!(file instanceof TFile) || !made) { new Notice("This rig has no parts to draw yet."); return; }
  const r = Platform.isDesktop ? anchor?.getBoundingClientRect() : undefined;
  new FigureModal(app, file, made, figuresFolder, r?.width ? { left: r.left, bottom: r.bottom } : null).open();
}

class FigureModal extends Modal {
  private previewUrl = "";
  private line!: HTMLElement;
  private pngButton: HTMLButtonElement | null = null;

  constructor(app: App, private file: TFile, private made: Made, private figuresFolder: string, private anchor: { left: number; bottom: number } | null) { super(app); }

  onOpen(): void {
    cardWindow(this);
    this.modalEl.addClass("vt-entry");   // the frame and the under-the-button place of the entry window (styles.css)
    if (this.anchor) {
      this.containerEl.addClass("vt-entry-anchored");   // no dimmed background; a click outside closes it
      this.containerEl.querySelector(".modal-bg")?.addClass("vt-entry-nobg");
      document.addEventListener("mousedown", this.outside, true);
      const w = Math.min(560, window.innerWidth * 0.92);
      this.modalEl.setCssProps({ "--vt-entry-x": `${Math.max(8, Math.min(this.anchor.left, window.innerWidth - w - 8))}px`, "--vt-entry-y": `${Math.min(this.anchor.bottom + 8, Math.max(8, window.innerHeight - 560))}px` });
    }
    this.setTitle("Rig figure");
    const { contentEl } = this;
    this.previewUrl = URL.createObjectURL(new Blob([this.made.svg], { type: "image/svg+xml" }));
    contentEl.createEl("img", { cls: "lab-kit-figure-preview", attr: { alt: "Preview of the rig figure", src: this.previewUrl } });
    if (this.made.missing.length) contentEl.createDiv({ cls: "vt-muted", text: `Drawn as a plain box (kind not known): ${this.made.missing.join(", ")}.` });

    new Setting(contentEl).setName("Width on paper (mm)").setDesc("The SVG has no size of its own on paper; this sets the PNG.").addText(t => { t.inputEl.type = "number"; t.inputEl.min = "1"; t.setValue(String(choice.widthMm)).onChange(v => { choice.widthMm = Number(v); this.update(); }); });
    new Setting(contentEl).setName("Resolution (dpi)").addText(t => { t.inputEl.type = "number"; t.inputEl.min = "1"; t.setValue(String(choice.dpi)).onChange(v => { choice.dpi = Number(v); this.update(); }); });
    this.line = contentEl.createDiv({ cls: "lab-kit-figure-size" });

    const buttons = new Setting(contentEl);
    buttons.addButton(b => b.setButtonText("Close").onClick(() => this.close()));
    buttons.addButton(b => b.setButtonText("Save SVG").setCta().onClick(() => { void this.save("svg"); }));
    if (Platform.isDesktop) buttons.addButton(b => { this.pngButton = b.buttonEl; b.setButtonText("Save PNG").onClick(() => { void this.save("png"); }); });
    else contentEl.createDiv({ cls: "vt-muted", text: "The PNG is made on desktop only. The SVG opens in PowerPoint, Illustrator and Inkscape." });
    this.update();
  }

  private size() { return pngSize({ widthMm: choice.widthMm, dpi: choice.dpi, figWidth: this.made.width, figHeight: this.made.height }); }

  private update(): void {
    const s = this.size();
    const mm = Number.isFinite(choice.widthMm) && choice.widthMm > 0 ? `${Math.round(choice.widthMm)} × ${Math.round(heightMm(choice.widthMm, this.made.width, this.made.height))} mm: ` : "";
    this.line.setText(Platform.isDesktop ? mm + sizeLine(s) : "");
    if (this.pngButton) this.pngButton.disabled = !s;
  }

  /** Writes the figure into the Figures folder (the rig note's own folder when none is set) under a name that is not taken. */
  private async save(ext: "svg" | "png"): Promise<void> {
    const vault = this.app.vault;
    try {
      const folder = figuresTarget({ figuresFolder: this.figuresFolder, notePath: this.file.path });
      if (folder) await ensureFolder(vault, folder);
      const path = (name: string): string => normalizePath(kitJoin(folder, name));
      const name = figureFileName(this.file.basename, ext, n => !!vault.getAbstractFileByPath(path(n)));
      if (ext === "svg") { await vault.create(path(name), this.made.svg); new Notice(`Saved ${name}.`); return; }
      const want = this.size();
      if (!want) return;
      const png = await makePng(this.made.svg, want.width, want.height);
      await vault.createBinary(path(name), png.bytes);
      new Notice(savedNote(name, png, want.asked), 10000);
    } catch (e) { new Notice(`Could not save the ${ext.toUpperCase()}: ${e instanceof Error ? e.message : "see the developer console."}`); console.error("Lab Kit rig figure", e); }
  }

  private outside = (e: MouseEvent): void => { if (!this.modalEl.contains(e.target as Node)) this.close(); };

  onClose(): void {
    document.removeEventListener("mousedown", this.outside, true);
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = "";
    this.contentEl.empty();
  }
}
