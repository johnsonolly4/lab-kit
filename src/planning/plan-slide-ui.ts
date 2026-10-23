// The window for the plan map's picture for a slide (desktop only): choose the layout, see a preview, copy a PNG to the clipboard.
// A project too big for the full map gets the open-work picture instead (automatic, `pictureFor`); the layout rows are hidden then, as they do not change it.
// Nothing is saved in the vault. The picture itself is made in plan-slide.ts; this file only shows it and turns the SVG into a PNG.
import { Modal, Notice, Setting, type App } from "obsidian";
import { DEFAULT_AHEAD, MIN_READABLE, pictureFor, type ChosenPicture, type SlideLayout, type SlidePicture } from "./plan-slide";
import type { Plan } from "./plan";
import type { PlanMap } from "./plan-map";
import { ymd } from "./todo";

export { DEFAULT_AHEAD };
const WIDTH = 1920, HEIGHT = 1080;

/** What the window remembers while Obsidian is open (kept on the block, not a setting). */
export interface SlideChoice { whole: boolean; ahead: number }

export const layoutOf = (c: SlideChoice): SlideLayout => c.whole ? { kind: "whole" } : { kind: "compact", ahead: c.ahead };

/** The warning under the preview, "" when the text is big enough. */
export function readableNote(p: Pick<SlidePicture, "minText" | "tooSmall">, whole: boolean): string {
  if (!p.tooSmall) return "";
  return `The smallest text is ${Math.round(p.minText)} px of ${MIN_READABLE} (it may be hard to read on a slide): ${whole ? "choose the layout with tiles and fewer columns." : "use fewer columns."}`;
}

/** The line under the preview: for the open-work picture what it leaves out, for option A the readable warning (`readableNote`). */
export function pictureNote(p: ChosenPicture, whole: boolean): string {
  return p.kind === "open-work" ? `Open work only: ${p.open} of ${p.total} to-dos (project too big for the full map)` : readableNote(p, whole);
}

/** The SVG text drawn onto a canvas and copied as a PNG. Rejects when the picture cannot be drawn or the clipboard refuses. */
export async function copyPng(svg: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = createEl("img");
    await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = () => fail(new Error("The picture could not be drawn.")); img.src = url; });
    const canvas = createEl("canvas");
    canvas.width = WIDTH; canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("The picture could not be drawn.");
    ctx.drawImage(img, 0, 0, WIDTH, HEIGHT);
    const png = await new Promise<Blob | null>(ok => canvas.toBlob(ok, "image/png"));
    if (!png) throw new Error("The picture could not be made.");
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
  } finally { URL.revokeObjectURL(url); }
}

export class PlanSlideModal extends Modal {
  private previewUrl = "";

  constructor(app: App, private plan: Plan, private map: PlanMap, private title: string, private choice: SlideChoice) { super(app); }

  onOpen(): void {
    this.setTitle("Picture for a slide");
    const { contentEl } = this;
        let aheadEl: HTMLElement | null = null;   // made below, under the layout drop-down
    this.layoutEl = new Setting(contentEl).setName("Layout").setDesc("Done and later to-dos as tiles, or every to-do as a card.").addDropdown(d => d
      .addOption("compact", "Done and later as tiles").addOption("whole", "The whole map")
      .setValue(this.choice.whole ? "whole" : "compact")
      .onChange(v => { this.choice.whole = v === "whole"; aheadEl?.toggleClass("lab-kit-hidden", this.choice.whole); this.draw(); })).settingEl;
    const aheadRow = new Setting(contentEl).setName("Columns of full cards").setDesc("How many columns of cards to show, counting from the next open one (cards that can be done together share a column); the rest become tiles.");
    aheadEl = this.aheadEl = aheadRow.settingEl;
    aheadRow.addText(t => { t.inputEl.type = "number"; t.inputEl.min = "1"; t.setValue(String(this.choice.ahead)).onChange(v => {
      const n = Math.floor(Number(v));
      if (n >= 1) { this.choice.ahead = n; this.draw(); }
    }); });
    aheadEl.toggleClass("lab-kit-hidden", this.choice.whole);
    this.preview = contentEl.createEl("img", { cls: "lab-kit-slide-preview", attr: { alt: "Preview of the picture" } });
    this.note = contentEl.createDiv({ cls: "vt-muted" });
    const buttons = new Setting(contentEl);
    buttons.addButton(b => b.setButtonText("Close").onClick(() => this.close()));
    buttons.addButton(b => b.setButtonText("Copy picture").setCta().onClick(() => {
      copyPng(this.picture().svg).then(
        () => { new Notice("Picture copied: paste it into your slide."); },
        (e: unknown) => { new Notice(`Could not copy the picture: ${e instanceof Error ? e.message : "the clipboard refused it."}`); });
    }));
    this.draw();
  }

  private preview!: HTMLImageElement;
  private note!: HTMLElement;
  private layoutEl!: HTMLElement;
  private aheadEl!: HTMLElement;

  private picture(): ChosenPicture {
    return pictureFor(this.plan, this.map, { title: this.title, width: WIDTH, height: HEIGHT, today: ymd(new Date()), layout: layoutOf(this.choice) });
  }

  private draw(): void {
    const p = this.picture();
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = URL.createObjectURL(new Blob([p.svg], { type: "image/svg+xml" }));
    this.preview.src = this.previewUrl;
    this.note.setText(pictureNote(p, this.choice.whole));
    const open = p.kind === "open-work";   // the layout rows do not change the open-work picture
    this.layoutEl.toggleClass("lab-kit-hidden", open);
    this.aheadEl.toggleClass("lab-kit-hidden", open || this.choice.whole);
  }

  onClose(): void {
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = "";
    this.contentEl.empty();
  }
}
