// Renders ```rig blocks: the figure of the note's own parts tables (src/rig/parts.ts), drawn by the same engine as the Figure… window
// (figure-make.ts) and shown as an <img> of the SVG, redrawn when the note changes. No Mermaid, no Node: it works on mobile.
// Plan: docs/plans/rig-block-no-mermaid.md, Phase 2.
import { MarkdownRenderChild, TFile, type App, type Plugin } from "obsidian";
import { makeFigure } from "./figure-make";
import { inPack, refreshPack } from "./packs-io";
import { readRig } from "./parts";
import { openFigureWindow } from "./figure-ui";
import { snapshotState } from "./snapshot-io";
import { openSnapshotWindow } from "./snapshot-ui";

export class RigRenderer {
  /** The open blocks, so an edit to their note redraws them. */
  private views = new Set<RigView>();

  /** `figuresFolder` gives the Figures folder setting at the time of a save. */
  constructor(private plugin: Plugin, readonly figuresFolder: () => string = () => "") {}

  /** The plugin's version, written into every snapshot. */
  version(): string { return this.plugin.manifest?.version ?? ""; }

  get app(): App { return this.plugin.app; }

  /** Registers the ```rig processor and the redraw-on-edit listener. */
  register(): void {
    this.plugin.registerMarkdownCodeBlockProcessor("rig", (_source, el, ctx) => { ctx.addChild(new RigView(el, this, ctx.sourcePath)); });

    const timers = new Map<string, number>();
    this.plugin.registerEvent(this.app.vault.on("modify", (file) => {
      if (inPack(file.path)) {   // a pack file or its list changed: every open block is drawn again (an unchanged picture is left alone)
        window.clearTimeout(timers.get(""));
        timers.set("", window.setTimeout(() => { for (const v of this.views) v.draw(); }, 250));
        return;
      }
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
  private url = "";
  /** What the block shows now: an edit that leaves the figure and the problems as they are does not redraw it. */
  private shown: string | null = null;

  constructor(el: HTMLElement, private owner: RigRenderer, readonly sourcePath: string) { super(el); }

  onload(): void { this.owner.add(this); this.draw(); }
  onunload(): void { this.owner.remove(this); this.revoke(); }

  private revoke(): void { if (this.url) URL.revokeObjectURL(this.url); this.url = ""; }

  draw(): void {
    const run = ++this.drawing;   // a newer draw wins over a slower one still reading the note
    void this.render(run).catch(e => { console.error("Lab Kit rig block", e); });
  }

  private async render(run: number): Promise<void> {
    const app = this.owner.app;
    const file = app.vault.getAbstractFileByPath(this.sourcePath);
    const text = file instanceof TFile ? await app.vault.cachedRead(file) : "";
    const rig = readRig(text);
    await refreshPack(app);
    const made = makeFigure(text);
    let snap: { date: string; changed: boolean; problems: string[] } | null = null;
    try { snap = file instanceof TFile && made ? await snapshotState(app, file, text) : null; } catch (e) { console.error("Lab Kit rig snapshot", e); }
    const sig = JSON.stringify([made?.svg ?? "", rig.problems, snap]);
    if (run !== this.drawing || sig === this.shown) return;

    const box = this.containerEl.createDiv({ cls: "lab-kit-rig" });
    let url = "";
    if (made) {
      url = URL.createObjectURL(new Blob([made.svg], { type: "image/svg+xml" }));
      const card = box.createDiv({ cls: "lab-kit-rig-diagram" });
      // the smallest width keeps the 13-unit labels at about 9 px; narrower pages slide sideways (owner, Q3)
      card.setCssProps({ "--lk-rig-min": `${Math.round(made.width * 9 / 13)}px` });
      card.createEl("img", { cls: "lab-kit-rig-img", attr: { src: url, alt: "Diagram of the rig" } });
      if (made.missing.length) box.createDiv({ cls: "vt-muted", text: `Drawn as a plain box (kind not known): ${made.missing.join(", ")}.` });
    }
    if (rig.parts.length) {
      const open = box.createEl("button", { cls: "lab-kit-rig-figure", text: "Figure…", attr: { "aria-label": "Preview the figure and save it as SVG or PNG" } });
      open.addEventListener("click", () => { void openFigureWindow(app, this.sourcePath, this.owner.figuresFolder(), open); });
    }
    if (rig.parts.length) {
      const save = box.createEl("button", { cls: "lab-kit-rig-figure", text: "Save snapshot…", attr: { "aria-label": "Save a dated picture of the rig and add it to the Rig history table" } });
      save.addEventListener("click", () => { openSnapshotWindow(app, this.sourcePath, this.owner.version(), save, () => { this.owner.refreshFile(this.sourcePath); }); });
    }
    if (snap?.date && snap.changed) box.createDiv({ cls: "vt-muted lab-kit-rig-changed", text: `Changed since the last snapshot (${snap.date})` });
    const problems = [...rig.problems, ...(made?.problems ?? []), ...(snap?.problems ?? [])];
    if (problems.length) {
      const list = box.createEl("ul", { cls: "lab-kit-rig-problems lab-kit-warn" });
      for (const p of problems) list.createEl("li", { text: p });
    }
    if (run !== this.drawing) { box.remove(); if (url) URL.revokeObjectURL(url); return; }
    this.box?.remove();
    this.revoke();
    this.box = box; this.url = url; this.shown = sig;
  }
}
