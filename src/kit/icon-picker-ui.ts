// Icon picker for Settings → Lab Kit → Snippet icons: a search box and a grid of the real icons. Icons come from Obsidian's own set (Lucide).
import { Modal, getIconIds, setIcon, type App } from "obsidian";
import { lucideNames, matchIcons } from "./icon-list";

export class IconPickerModal extends Modal {
  private names: string[];

  constructor(app: App, private current: string, private onPick: (name: string) => void) {
    super(app);
    this.names = lucideNames(getIconIds());
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("lab-kit-icon-picker");
    this.setTitle("Choose an icon");
    const search = contentEl.createEl("input", { type: "text", cls: "lab-kit-icon-search", attr: { placeholder: "Search icons, for example flask" } });
    const grid = contentEl.createDiv({ cls: "lab-kit-icon-grid" });
    const draw = (): void => {
      grid.empty();
      const shown = matchIcons(this.names, search.value);
      for (const name of shown) {
        const cell = grid.createEl("button", { cls: "lab-kit-icon-cell", attr: { "aria-label": name, title: name } });
        if (name === this.current) cell.addClass("is-current");
        setIcon(cell.createSpan(), name);
        cell.createSpan({ cls: "lab-kit-icon-name", text: name });
        cell.addEventListener("click", () => { this.onPick(name); this.close(); });
      }
      if (!shown.length) grid.createDiv({ cls: "vt-muted", text: "No icon matches." });
    };
    search.addEventListener("input", draw);
    draw();
    search.focus();
  }

  onClose(): void { this.contentEl.empty(); }
}
