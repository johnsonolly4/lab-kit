// The Alt+S menu window in the entry-window look (approved: my_work/reference_visual/alts-menu-grouped.png): heading, search box, Recent then the groups, hint line.
// Contents and search are in snippet-menu.ts (pure). Insert snippet.md opens it through `plugin.snippets.menu(items)`.
import { Menu, Modal, getIcon, type App } from "obsidian";
import { cursorAnchor, type EntryAnchor } from "../planning/entry-window";
import { groupOf, iconNames, menuSections, searchItems, type MenuItem } from "./snippet-menu";

/** Right-click → Change icon…: `can` says whether an entry has a header to keep an icon in; `change` runs the picker and writes it (null = nothing changed; `copied` = a copy of a kit snippet got the icon). */
export interface MenuIcons {
  can(it: MenuItem): Promise<boolean>;
  change(it: MenuItem): Promise<{ icon: string; copied: boolean } | null>;
}

class SnippetMenu extends Modal {
  private input!: HTMLInputElement;
  private list!: HTMLElement;
  private shown: MenuItem[] = [];
  private rows: HTMLElement[] = [];
  private active = 0;
  private settled = false;

  constructor(app: App, private items: MenuItem[], private recent: string[], private icons: MenuIcons | null, private anchor: EntryAnchor | null, private done: (it: MenuItem | null) => void) { super(app); }

  onOpen(): void {
    this.modalEl.addClass("vt-entry", "lk-snip");   // styles.css
    if (this.anchor) {   // under the cursor line, no dimmed background (the window rule in docs/design-standard.md)
      this.containerEl.addClass("vt-entry-anchored");
      this.containerEl.querySelector(".modal-bg")?.addClass("vt-entry-nobg");
      document.addEventListener("mousedown", this.outside, true);
    }
    this.contentEl.createEl("h3", { text: "Insert snippet", cls: "vt-entry-heading" });
    const box = this.contentEl.createDiv({ cls: "lk-snip-search" });
    const glass = getIcon("search");
    if (glass) box.createSpan({ cls: "lk-snip-search-icon" }).appendChild(glass);
    this.input = box.createEl("input", { type: "text", attr: { placeholder: "Search snippets…" } });
    this.list = this.contentEl.createDiv({ cls: "lk-snip-list" });
    this.contentEl.createDiv({ cls: "vt-entry-hint", text: "↑↓ to move · Enter inserts · Esc closes" });
    this.input.addEventListener("input", () => this.draw());
    this.input.addEventListener("keydown", e => {
      if (e.isComposing) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); this.move(e.key === "ArrowDown" ? 1 : -1); }
      else if (e.key === "Enter") { e.preventDefault(); this.pick(this.shown[this.active]); }
    });
    this.draw();
    this.place();
    this.input.focus();
  }

  /** Under the cursor line, moved up as far as needed so the whole window stays on screen (measured once drawn). */
  private place(): void {
    if (!this.anchor) return;
    const w = Math.min(560, window.innerWidth * 0.92), h = this.modalEl.offsetHeight;
    this.modalEl.setCssProps({ "--vt-entry-x": `${Math.max(8, Math.min(this.anchor.left, window.innerWidth - w - 8))}px`, "--vt-entry-y": `${Math.max(8, Math.min(this.anchor.bottom + 8, window.innerHeight - h - 8))}px` });
  }

  private draw(): void {
    this.list.empty();
    this.rows = [];
    const q = this.input.value.trim();
    if (q) {
      this.shown = searchItems(this.items, q);
      if (!this.shown.length) this.list.createDiv({ cls: "lk-snip-empty", text: `No snippet matches “${q}”.` });
      for (const it of this.shown) this.row(this.list, it, true);
    } else {
      this.shown = [];
      for (const s of menuSections(this.items, this.recent)) {
        this.list.createDiv({ cls: "lk-snip-heading", text: s.heading });
        for (const it of s.items) { this.shown.push(it); this.row(this.list, it, false); }
      }
    }
    this.active = 0;
    this.mark();
  }

  private row(parent: HTMLElement, it: MenuItem, tag: boolean): void {
    const i = this.rows.length;
    const el = parent.createDiv({ cls: "lk-snip-row" });
    const ic = el.createSpan({ cls: "lk-snip-icon" });
    const svg = iconNames(it).map(n => getIcon(n)).find(Boolean) ?? getIcon("file-text");
    if (svg) ic.appendChild(svg);
    const text = el.createDiv({ cls: "lk-snip-text" });
    text.createDiv({ cls: "lk-snip-name", text: it.name });
    if (it.desc) text.createDiv({ cls: "lk-snip-desc", text: it.desc });
    if (tag) el.createSpan({ cls: "lk-snip-tag", text: groupOf(it) });
    el.addEventListener("mousemove", () => { if (this.active !== i) { this.active = i; this.mark(); } });
    el.addEventListener("click", () => this.pick(it));
    el.addEventListener("contextmenu", e => { e.preventDefault(); void this.rightClick(it, e); });
    this.rows.push(el);
  }

  /** Change icon… under the pointer, for entries that have a header to write into. */
  private async rightClick(it: MenuItem, e: MouseEvent): Promise<void> {
    const icons = this.icons;
    if (!icons || !(await icons.can(it))) return;
    const menu = new Menu();
    menu.addItem(m => m.setTitle("Change icon…").setIcon("palette").onClick(() => void this.changeIcon(it)));
    menu.showAtPosition({ x: e.clientX, y: e.clientY });
  }

  private async changeIcon(it: MenuItem): Promise<void> {
    const res = await this.icons?.change(it);
    if (!res) return;
    if (res.copied) { this.close(); return; }   // the copy is a new entry: it shows the next time the menu opens
    it.icon = res.icon;
    const keep = this.active;
    this.draw();
    this.active = Math.min(keep, this.rows.length - 1);
    this.mark();
  }

  private move(by: number): void {
    if (!this.rows.length) return;
    this.active = (this.active + by + this.rows.length) % this.rows.length;
    this.mark();
    this.rows[this.active].scrollIntoView({ block: "nearest" });
  }
  private mark(): void { this.rows.forEach((r, i) => r.toggleClass("is-active", i === this.active)); }

  private pick(it: MenuItem | undefined): void {
    if (!it) return;
    this.finish(it);
    this.close();
  }
  private finish(it: MenuItem | null): void { if (!this.settled) { this.settled = true; this.done(it); } }
  private outside = (e: MouseEvent): void => { if (!this.modalEl.contains(e.target as Node)) this.close(); };

  onClose(): void {
    document.removeEventListener("mousedown", this.outside, true);
    this.contentEl.empty();
    window.setTimeout(() => this.finish(null), 0);
  }
}

/** Opens the menu; the picked entry, or null on Esc / a click outside. */
export const openSnippetMenu = (app: App, items: MenuItem[], recent: string[], icons: MenuIcons | null): Promise<MenuItem | null> =>
  new Promise(resolve => new SnippetMenu(app, items, recent, icons, cursorAnchor(app), resolve).open());
