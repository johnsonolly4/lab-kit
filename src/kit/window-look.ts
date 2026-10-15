// The look shared by Lab Kit's list windows (Check setup, Check hotkeys, ...): an intro, a big summary line, rows with a round tinted mark, a footer.
// Styles: `.lab-kit-win-*` in styles.css. Each window decides what its rows mean; this file only draws them.

export type WinState = "missing" | "todo" | "info" | "ok";
/** The mark inside a row's round badge. */
export const WIN_MARK: Record<WinState, string> = { missing: "✗", todo: "!", info: "i", ok: "✓" };

export function winIntro(el: HTMLElement, text: string): HTMLElement {
  return el.createEl("p", { cls: "lab-kit-win-intro", text });
}

export function winSummary(el: HTMLElement, text: string): HTMLElement {
  return el.createDiv({ cls: "lab-kit-win-summary", text });
}

export interface WinRow { title: string; detail?: string; group?: string; state: WinState; label?: boolean; }

/** One row: mark, title, muted description and optional group label. Returns the row (add buttons or a tick box to it) and its text block. */
export function winRow(el: HTMLElement, o: WinRow): { row: HTMLElement; text: HTMLElement } {
  const row = o.label ? el.createEl("label", { cls: `lab-kit-win-row is-${o.state}` }) : el.createDiv({ cls: `lab-kit-win-row is-${o.state}` });
  row.createSpan({ cls: "lab-kit-win-mark", text: WIN_MARK[o.state] });
  const text = row.createDiv({ cls: "lab-kit-win-text" });
  text.createDiv({ cls: "lab-kit-win-title", text: o.title });
  if (o.detail) text.createDiv({ cls: "setting-item-description", text: o.detail });
  if (o.group) text.createDiv({ cls: "lab-kit-win-group", text: o.group });
  return { row, text };
}

export function winFoot(el: HTMLElement): HTMLElement {
  return el.createDiv({ cls: "lab-kit-win-foot" });
}

export interface WinFold { title: string; /** Shown at the right of the header (a count, or a short word). */ count?: string | number; /** A muted second line under the title. */ sub?: string; open: boolean; /** Called with the new state when the user opens or closes it. */ onToggle?: (open: boolean) => void }

/** A group that folds: a box with a header row (chevron, title, count at the right) and a body, like the groups in Tidy up notes. Returns the box and the body to fill. */
export function winFold(parent: HTMLElement, o: WinFold): { box: HTMLElement; body: HTMLElement } {
  const box = parent.createDiv({ cls: `lab-kit-fold${o.open ? " is-open" : ""}` });
  const head = box.createEl("button", { cls: "lab-kit-fold-head", attr: { "aria-expanded": String(o.open) } });
  head.createSpan({ cls: "lab-kit-fold-chev", attr: { "aria-hidden": "true" } });
  const text = head.createDiv({ cls: "lab-kit-fold-text" });
  text.createDiv({ cls: "lab-kit-fold-title", text: o.title });
  if (o.sub) text.createDiv({ cls: "setting-item-description", text: o.sub });
  if (o.count !== undefined) head.createSpan({ cls: "lab-kit-fold-count", text: String(o.count) });
  const body = box.createDiv({ cls: "lab-kit-fold-body" });
  head.addEventListener("click", () => {
    const open = !box.hasClass("is-open");
    box.toggleClass("is-open", open);
    head.setAttr("aria-expanded", String(open));
    o.onToggle?.(open);
  });
  return { box, body };
}
