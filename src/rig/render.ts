// Renders ```rig blocks: the diagram of the note's own parts tables (src/rig/parts.ts), redrawn when the note changes.
// The Mermaid text goes through Obsidian's Markdown renderer, so it needs no Node and works on mobile.
import { MarkdownRenderChild, MarkdownRenderer, TFile, type App, type Plugin } from "obsidian";
import { readRig } from "./parts";
import { openFigureWindow } from "./figure-ui";

export class RigRenderer {
  /** The open blocks, so an edit to their note redraws them. */
  private views = new Set<RigView>();

  /** `figuresFolder` gives the Figures folder setting at the time of a save. */
  constructor(private plugin: Plugin, readonly figuresFolder: () => string = () => "") {}

  get app(): App { return this.plugin.app; }

  /** Registers the ```rig processor and the redraw-on-edit listener. */
  register(): void {
    this.plugin.registerMarkdownCodeBlockProcessor("rig", (_source, el, ctx) => { ctx.addChild(new RigView(el, this, ctx.sourcePath)); });

    const timers = new Map<string, number>();
    this.plugin.registerEvent(this.app.vault.on("modify", (file) => {
      if (![...this.views].some(v => v.sourcePath === file.path)) return;
      window.clearTimeout(timers.get(file.path));
      timers.set(file.path, window.setTimeout(() => this.refreshFile(file.path), 250));
    }));
  }

  /** Redraws the blocks of one note. */
  refreshFile(path: string): void { for (const v of this.views) if (v.sourcePath === path) v.draw(); }

  add(v: RigView): void { this.views.add(v); }
  remove(v: RigView): void { this.views.delete(v); }
}

class RigView extends MarkdownRenderChild {
  private drawing = 0;
  private box: HTMLElement | null = null;
  /** What the block shows now: an edit that leaves the diagram and the problems as they are does not redraw it. */
  private shown: string | null = null;

  constructor(el: HTMLElement, private owner: RigRenderer, readonly sourcePath: string) { super(el); }

  onload(): void { this.owner.add(this); this.draw(); }
  onunload(): void { this.owner.remove(this); }

  draw(): void {
    const run = ++this.drawing;   // a newer draw wins over a slower one still reading the note
    void this.render(run).catch(e => { console.error("Lab Kit rig block", e); });
  }

  private async render(run: number): Promise<void> {
    const app = this.owner.app;
    const file = app.vault.getAbstractFileByPath(this.sourcePath);
    const rig = readRig(file instanceof TFile ? await app.vault.cachedRead(file) : "");
    const sig = JSON.stringify([rig.mermaid, rig.problems]);
    if (run !== this.drawing || sig === this.shown) return;

    const box = this.containerEl.createDiv({ cls: "lab-kit-rig" });
    if (rig.mermaid) await MarkdownRenderer.render(app, "```mermaid\n" + rig.mermaid + "\n```", box.createDiv({ cls: "lab-kit-rig-diagram" }), this.sourcePath, this);
    if (rig.parts.length) {
      const open = box.createEl("button", { cls: "lab-kit-rig-figure", text: "Figure…", attr: { "aria-label": "Preview the figure and save it as SVG or PNG" } });
      open.addEventListener("click", () => { void openFigureWindow(app, this.sourcePath, this.owner.figuresFolder(), open); });
    }
    if (rig.problems.length) {
      const list = box.createEl("ul", { cls: "lab-kit-rig-problems lab-kit-warn" });
      for (const p of rig.problems) list.createEl("li", { text: p });
    }
    if (run !== this.drawing) { box.remove(); return; }
    this.box?.remove();
    this.box = box; this.shown = sig;
  }
}
