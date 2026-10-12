// Column colours on Bases kanban boards by status name (Lab book: Planned, Started, Processing results, Closed), so a vault without the
// planning kit's theme has them too. Tags each column `data-lab-kit-group` (own attribute: the planning theme uses data-vt-group) and sets
// the colours as CSS variables on the body; styles.css does the drawing. Uses Bases' board markup (not a documented API).
import type { Plugin } from "obsidian";
import type { KitData } from "./paths";

/** Status names with their default colour (hex). Settings can change each. */
export const BOARD_STATUSES: [name: string, key: string, hex: string][] = [
  ["Planned", "planned", "#94a3b8"],
  ["Started", "started", "#3b82f6"],
  ["Processing results", "processing", "#f59e0b"],
  ["Closed", "closed", "#10b981"],
];

/** `#rrggbb` as "r, g, b" for rgba(); null when it is not a hex colour. */
export function rgbTriplet(hex: string): string | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  return m ? `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}` : null;
}

/** "3/7" (anywhere in the text) as [3, 7]; null when there is no fraction of check boxes. */
export function progressFraction(text: string): [number, number] | null {
  const m = /(\d+)\s*\/\s*(\d+)/.exec(text);
  return m && +m[2] > 0 ? [Math.min(+m[1], +m[2]), +m[2]] : null;
}

export class BoardColours {
  private queued = false;
  constructor(private plugin: Plugin, private kit: () => KitData) {}

  start(): void {
    const { app } = this.plugin;
    app.workspace.onLayoutReady(() => {
      this.apply();
      const queue = (): void => { if (!this.queued) { this.queued = true; window.requestAnimationFrame(() => { this.queued = false; this.tag(); }); } };
      for (const ev of ["layout-change", "active-leaf-change", "file-open"] as const) this.plugin.registerEvent(app.workspace.on(ev as "layout-change", queue));
      this.plugin.registerEvent(app.metadataCache.on("changed", queue));
      const mo = new MutationObserver(queue);
      mo.observe(app.workspace.containerEl, { childList: true, subtree: true });
      this.plugin.register(() => { mo.disconnect(); this.clear(); });
    });
  }

  /** The switch and the colours (settings changed): body class and CSS variables, then tag the columns. */
  apply(): void {
    const body = activeDocument.body, k = this.kit();
    body.classList.toggle("lab-kit-board-colours", k.boardColours.enabled);
    for (const [, key, hex] of BOARD_STATUSES) {
      const t = rgbTriplet(k.boardColours.colours[key] ?? "") ?? rgbTriplet(hex);
      if (t) body.style.setProperty(`--lab-kit-col-${key}`, t);
    }
    this.tag();
  }

  private tag(): void {
    const root = this.plugin.app.workspace.containerEl;
    this.bars(root);
    if (!this.kit().boardColours.enabled) return;
    for (const col of Array.from(root.querySelectorAll<HTMLElement>('.bases-view[data-view-type="kanban"] .bases-kanban-column'))) {
      const name = col.querySelector(".bases-group-value")?.textContent?.trim() ?? "";
      if (name) { if (col.dataset.labKitGroup !== name) col.dataset.labKitGroup = name; }
      else if (col.dataset.labKitGroup !== undefined) delete col.dataset.labKitGroup;
    }
  }

  /** A card's `progress` property ("3/7") gets a bar under it; a card with none hides the empty property (label and dash). */
  private bars(root: HTMLElement): void {
    for (const prop of Array.from(root.querySelectorAll<HTMLElement>('.bases-view[data-view-type="kanban"] .bases-kanban-card [data-property="note.progress"]'))) {
      const done = progressFraction(prop.textContent ?? "");
      prop.classList.toggle("lab-kit-no-progress", !done);
      let bar = prop.querySelector<HTMLProgressElement>("progress.lab-kit-card-bar");
      if (!done) { bar?.remove(); continue; }
      if (!bar) bar = prop.createEl("progress", { cls: "lab-kit-card-bar" });
      // Always write both attributes: a <progress> without a `value` attribute is an "unknown amount" bar that animates instead of filling
      if (bar.getAttribute("max") !== String(done[1])) bar.setAttribute("max", String(done[1]));
      if (bar.getAttribute("value") !== String(done[0])) bar.setAttribute("value", String(done[0]));
    }
  }

  private clear(): void {
    for (const el of Array.from(this.plugin.app.workspace.containerEl.querySelectorAll("progress.lab-kit-card-bar"))) el.remove();
    for (const el of Array.from(this.plugin.app.workspace.containerEl.querySelectorAll(".lab-kit-no-progress"))) el.classList.remove("lab-kit-no-progress");
    activeDocument.body.classList.remove("lab-kit-board-colours");
    for (const [, key] of BOARD_STATUSES) activeDocument.body.style.removeProperty(`--lab-kit-col-${key}`);
    for (const el of Array.from(this.plugin.app.workspace.containerEl.querySelectorAll<HTMLElement>("[data-lab-kit-group]"))) delete el.dataset.labKitGroup;
  }
}
