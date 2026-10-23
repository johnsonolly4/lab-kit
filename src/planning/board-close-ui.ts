// The two windows of the Lab Kit board's top row (I2 Phase 8): Close the week (F4) and Late cards (Q12 a). What each button writes is in board-close.ts.
// They open under the button that was pressed (desktop, no dimmed background) as the window rule in docs/design-standard.md says, in the entry window's look.
import { Modal, Platform, Setting, type App } from "obsidian";
import { datePill, weekTitle, type WeekCard } from "./board-card";
import { closeList, closeWeekPlan, lateCards, nextMonday, type CloseChoice, type LateAction, type Move } from "./board-close";
import { parseDay, weekStart } from "./todo";

/** The place under a button (desktop), else null: the window opens in the middle and dims. */
export function underButton(el: HTMLElement): { left: number; bottom: number } | null {
  if (!Platform.isDesktop) return null;
  const r = el.getBoundingClientRect();
  return r.width ? { left: r.left, bottom: r.bottom } : null;
}

abstract class BoardWindow extends Modal {
  constructor(app: App, private anchor: { left: number; bottom: number } | null) { super(app); }
  protected abstract build(): void;
  private outside = (e: MouseEvent): void => { if (e.target instanceof Node && !this.modalEl.contains(e.target)) this.close(); };

  onOpen(): void {
    this.modalEl.addClass("vt-entry");   // the entry window's width, padding and corner (styles.css)
    if (this.anchor) {
      this.containerEl.addClass("vt-entry-anchored");
      this.containerEl.querySelector(".modal-bg")?.addClass("vt-entry-nobg");
      document.addEventListener("mousedown", this.outside, true);
      const w = Math.min(560, window.innerWidth * 0.92);
      this.modalEl.setCssProps({ "--vt-entry-x": `${Math.max(8, Math.min(this.anchor.left, window.innerWidth - w - 8))}px`, "--vt-entry-y": `${Math.min(this.anchor.bottom + 8, Math.max(8, window.innerHeight - 260))}px` });
    }
    this.build();
  }

  onClose(): void { document.removeEventListener("mousedown", this.outside, true); this.contentEl.empty(); }
}

class CloseWeekModal extends BoardWindow {
  private choice: CloseChoice = "next";
  private ticked: Set<string>;
  private listed: WeekCard[];

  constructor(app: App, anchor: { left: number; bottom: number } | null, cards: WeekCard[], private today: Date, private apply: (moves: Move[]) => Promise<void>) {
    super(app, anchor);
    this.listed = closeList(cards, today);
    this.ticked = new Set(this.listed.map(c => c.path));
  }

  protected build(): void {
    const el = this.contentEl, n = this.listed.length;
    el.createEl("h3", { cls: "vt-entry-heading", text: `Close the week of ${weekTitle(weekStart(this.today)).slice("Week of ".length)}` });
    el.createEl("p", { cls: "lk-close-summary", text: n === 0 ? "No open to-dos are left this week." : `${n} open to-do${n === 1 ? " is" : "s are"} left this week.` });
    const list = el.createDiv({ cls: "lk-close-list" });
    const button = new Setting(el).addButton(b => b.setButtonText("Cancel").onClick(() => this.close()));
    let go: HTMLButtonElement | null = null;
    button.addButton(b => { go = b.buttonEl; b.setCta().onClick(() => { void this.submit(); }); });
    const sync = (): void => {
      if (!go) return;
      go.setText(this.choice === "leave" ? "Close" : `Move ${this.ticked.size}`);
      go.disabled = this.choice !== "leave" && n > 0 && this.ticked.size === 0;
      for (const box of Array.from(list.querySelectorAll<HTMLInputElement>("input[type=checkbox]"))) box.disabled = this.choice === "leave";
    };
    if (n > 0) {
      const radios = el.createDiv({ cls: "lk-close-choices", attr: { role: "radiogroup" } });
      el.insertBefore(radios, list);
      const options: [CloseChoice, string][] = [["next", `Move them to ${datePill(nextMonday(this.today))}`], ["backlog", "Move them to the Backlog"], ["leave", "Leave them (they carry over)"]];
      for (const [value, text] of options) {
        const label = radios.createEl("label", { cls: "lk-close-choice" });
        const input = label.createEl("input", { attr: { type: "radio", name: "lk-close-choice", value } });
        input.checked = value === this.choice;
        label.createSpan({ text });
        input.addEventListener("change", () => { this.choice = value; sync(); });
      }
      for (const c of this.listed) {
        const row = list.createEl("label", { cls: "lk-close-row" });
        const box = row.createEl("input", { attr: { type: "checkbox" } });
        box.checked = true;
        box.addEventListener("change", () => { if (box.checked) this.ticked.add(c.path); else this.ticked.delete(c.path); sync(); });
        row.createSpan({ cls: "lk-close-title", text: c.title });
        row.createSpan({ cls: "lk-close-when", text: datePill(parseDay(c.date)!) });
      }
    }
    el.insertBefore(el.createEl("p", { cls: "vt-entry-hint", text: "Finished cards leave the board on Monday." }), button.settingEl);
    sync();
  }

  private async submit(): Promise<void> {
    const { moves } = closeWeekPlan(this.listed, this.today, this.choice, this.ticked);
    this.close();
    if (moves.length) await this.apply(moves);
  }
}

class LateModal extends BoardWindow {
  private rows: WeekCard[];
  private heading!: HTMLElement;

  constructor(app: App, anchor: { left: number; bottom: number } | null, cards: WeekCard[], today: Date, private act: (c: WeekCard, a: LateAction) => Promise<void>) {
    super(app, anchor);
    this.rows = lateCards(cards, today);
  }

  protected build(): void {
    this.heading = this.contentEl.createEl("h3", { cls: "vt-entry-heading" });
    const list = this.contentEl.createDiv({ cls: "lk-close-list" });
    const buttons: [LateAction, string][] = [["today", "Today"], ["tomorrow", "Tomorrow"], ["nextweek", "Next week"], ["backlog", "Backlog"], ["done", "Done"]];
    for (const c of this.rows.slice()) {
      const row = list.createDiv({ cls: "lk-close-late" });
      const text = row.createDiv({ cls: "lk-close-text" });
      text.createSpan({ cls: "lk-close-title", text: c.title });
      text.createSpan({ cls: "lk-close-when", text: `planned ${datePill(parseDay(c.date)!)}` });
      const bar = row.createDiv({ cls: "lk-close-acts" });
      for (const [action, label] of buttons) {
        const b = bar.createEl("button", { cls: "lk-close-btn", text: label, attr: { type: "button" } });
        b.addEventListener("click", () => {
          for (const x of Array.from(bar.querySelectorAll("button"))) x.disabled = true;
          void this.act(c, action).then(() => {
            row.remove();
            this.rows = this.rows.filter(r => r !== c);
            if (this.rows.length) this.title(); else this.close();
          }, () => { for (const x of Array.from(bar.querySelectorAll("button"))) x.disabled = false; });
        });
      }
    }
    this.title();
  }

  private title(): void { this.heading.setText(`Late cards (${this.rows.length})`); }
}

/** Opens Close the week: the listed cards, a choice, `Move N` (`apply` gets the ticked cards' writes). */
export const openCloseWeek = (app: App, anchor: HTMLElement, cards: WeekCard[], today: Date, apply: (moves: Move[]) => Promise<void>): void => { new CloseWeekModal(app, underButton(anchor), cards, today, apply).open(); };

/** Opens Late cards: one row per card with Today / Tomorrow / Next week / Backlog / Done (`act` writes as a drag, or ticks). */
export const openLateCards = (app: App, anchor: HTMLElement, cards: WeekCard[], today: Date, act: (c: WeekCard, a: LateAction) => Promise<void>): void => { new LateModal(app, underButton(anchor), cards, today, act).open(); };
