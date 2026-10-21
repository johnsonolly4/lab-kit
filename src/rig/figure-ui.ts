// The rig figure window: a preview of the figure, its size on paper, Save SVG (every device) and Save PNG (desktop only).
// The figure itself is made in figure-svg.ts, the numbers and names in figure-export.ts. Plan: docs/plans/rig-figure.md, Phase 4.
// Hand layout (docs/plans/rig-block-no-mermaid.md, Phase 6): drag a part in the preview, Reset to automatic, Save layout writes the ```rig-layout block.
import { Modal, Notice, Platform, Setting, TFile, normalizePath, type App } from "obsidian";
import { cardWindow } from "../kit/window-look";
import { ensureFolder } from "../kit/ensure-folder";
import { figuresTarget, kitJoin } from "../kit/paths";
import { figureFileName, heightMm, pngSize, savedNote, sizeLine } from "./figure-export";
import { makeFigure, type Made } from "./figure-make";
import { GRID, dropAt, findLayout, partAt, setLayoutInNote, toFigure, writeLayout, type Places, type Pos } from "./layout";

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
  const text = file instanceof TFile ? await app.vault.cachedRead(file) : "";
  const made = file instanceof TFile ? makeFigure(text) : null;
  if (!(file instanceof TFile) || !made) { new Notice("This rig has no parts to draw yet."); return; }
  const r = Platform.isDesktop ? anchor?.getBoundingClientRect() : undefined;
  new FigureModal(app, file, text, made, figuresFolder, r?.width ? { left: r.left, bottom: r.bottom } : null).open();
}

class FigureModal extends Modal {
  private previewUrl = "";
  private line!: HTMLElement;
  private pngButton: HTMLButtonElement | null = null;
  private preview!: HTMLImageElement;
  private hint!: HTMLElement;
  /** The places shown, once a part was dragged or Reset pressed (null: as the note's block says); and how many parts were moved since the last save. */
  private places: Places | null = null;
  private moved = new Set<string>();
  private reset = false;
  private drag: { id: string; start: Pos; at: { x: number; y: number }; k: number; size: { w: number; h: number } } | null = null;
  private frame = 0;

  constructor(app: App, private file: TFile, private text: string, private made: Made, private figuresFolder: string, private anchor: { left: number; bottom: number } | null) { super(app); }

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
    this.preview = contentEl.createEl("img", { cls: "lab-kit-figure-preview lab-kit-figure-drag", attr: { alt: "Preview of the rig figure", src: this.previewUrl } });
    if (this.made.missing.length) contentEl.createDiv({ cls: "vt-muted", text: `Drawn as a plain box (kind not known): ${this.made.missing.join(", ")}.` });
    this.hint = contentEl.createDiv({ cls: "lab-kit-figure-size" });
    const row = contentEl.createDiv({ cls: "lab-kit-figure-layout" });
    const resetButton = row.createEl("button", { text: "Reset to automatic" });
    const saveButton = row.createEl("button", { text: "Save layout" });
    if (this.made.layout.writable) {
      this.preview.addEventListener("pointerdown", this.down);
      resetButton.addEventListener("click", () => { this.places = new Map(); this.moved.clear(); this.reset = true; this.redraw(); });
      saveButton.addEventListener("click", () => { void this.saveLayout(); });
    } else { resetButton.disabled = saveButton.disabled = true; }
    this.showHint();

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

  private showHint(saved = false): void {
    if (!this.made.layout.writable) { this.hint.setText("The layout block is from a newer version of the plugin: update the plugin to move parts."); return; }
    const n = this.moved.size;
    this.hint.setText(saved ? "Layout saved in the note."
      : this.reset && !n ? "Drag a part to move it. Automatic layout, not saved."
      : n ? `Drag a part to move it. ${n} ${n === 1 ? "part" : "parts"} moved, not saved.` : "Drag a part to move it.");
  }

  /** Draws the figure for the places shown now; the grid dots only while a part is dragged. */
  private redraw(): void {
    const made = makeFigure(this.text, this.places ?? undefined, this.drag ? GRID : undefined);
    if (!made) return;
    this.made = made;
    const old = this.previewUrl;
    this.previewUrl = URL.createObjectURL(new Blob([made.svg], { type: "image/svg+xml" }));
    this.preview.src = this.previewUrl;
    if (old) URL.revokeObjectURL(old);
    this.update();
    this.showHint();
  }

  private down = (e: PointerEvent): void => {
    const r = this.preview.getBoundingClientRect();
    const p = toFigure(r, this.made.width, this.made.height, e.clientX, e.clientY);
    const id = partAt(this.made.boxes, p.x, p.y);
    const box = this.made.boxes.find(b => b.id === id);
    if (!id || !box) return;
    e.preventDefault();
    if (!this.places?.size) this.places = new Map(this.made.places);   // the first drag (also after Reset) pins every part where it is drawn (owner, 3a)
    this.drag = { id, start: this.places.get(id) ?? { x: box.x, y: box.y }, at: { x: e.clientX, y: e.clientY }, k: Math.min(r.width / this.made.width, r.height / this.made.height) || 1, size: box };
    this.preview.setPointerCapture(e.pointerId);
    this.preview.addEventListener("pointermove", this.move);
    this.preview.addEventListener("pointerup", this.up);
    this.preview.addEventListener("pointercancel", this.up);
    this.redraw();
  };

  private move = (e: PointerEvent): void => {
    const d = this.drag;
    if (!d || !this.places) return;
    const to = dropAt(d.start, (e.clientX - d.at.x) / d.k, (e.clientY - d.at.y) / d.k, d.size);
    const was = this.places.get(d.id);
    if (was && was.x === to.x && was.y === to.y) return;
    this.places.set(d.id, to);
    this.moved.add(d.id);
    window.cancelAnimationFrame(this.frame);
    this.frame = window.requestAnimationFrame(() => this.redraw());
  };

  private up = (): void => {
    this.preview.removeEventListener("pointermove", this.move);
    this.preview.removeEventListener("pointerup", this.up);
    this.preview.removeEventListener("pointercancel", this.up);
    this.drag = null;
    window.cancelAnimationFrame(this.frame);
    this.redraw();
  };

  /** Writes the places shown into the note's ```rig-layout block (a new block goes under the ```rig block); the rig block redraws from the note. */
  private async saveLayout(): Promise<void> {
    if (!this.places) return;   // nothing moved or reset since the window opened
    const places = this.places;
    try {
      let written = false;
      await this.app.vault.process(this.file, text => {
        const block = findLayout(text);
        if (!block && !places.size) return text;   // Reset with no block: nothing to write
        const managed = [...(makeFigure(text, new Map())?.places.keys() ?? [])];
        const body = writeLayout(block?.body ?? null, places, managed);
        if (body === null) return text;
        written = true;
        this.text = setLayoutInNote(text, body);
        return this.text;
      });
      this.moved.clear(); this.reset = false;
      this.showHint(written || !places.size);
    } catch (e) { new Notice(`Could not save the layout: ${e instanceof Error ? e.message : "see the developer console."}`); console.error("Lab Kit rig layout", e); }
  }

  private outside = (e: MouseEvent): void => { if (!this.modalEl.contains(e.target as Node)) this.close(); };

  onClose(): void {
    document.removeEventListener("mousedown", this.outside, true);
    window.cancelAnimationFrame(this.frame);
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = "";
    this.contentEl.empty();
  }
}
