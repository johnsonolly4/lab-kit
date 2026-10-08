// Planning kit's text box (looks like Obsidian's pickers, same component, with no list underneath: port of the kit's vtAsk.js)
// and picker (a fuzzy list, as Templater's tp.system.suggester).
import { FuzzySuggestModal, SuggestModal, type App, type KeymapEventHandler } from "obsidian";

class AskModal extends SuggestModal<never> {
  private settled = false;

  constructor(app: App, placeholder: string, private value: string, private done: (v: string | null) => void) {
    super(app);
    this.setPlaceholder(placeholder);
    this.emptyStateText = "";
    this.setInstructions([{ command: "Enter", purpose: "to save" }, { command: "Esc", purpose: "to cancel" }]);
    // SuggestModal registered its own Enter first, and the first match wins: drop it so ours runs (`scope.keys` is private)
    const keys = (this.scope as unknown as { keys?: KeymapEventHandler[] }).keys ?? [];
    for (const k of [...keys]) if (k.key === "Enter" && !k.modifiers) this.scope.unregister(k);
    this.scope.register([], "Enter", (e) => { if (!e.isComposing) { e.preventDefault(); this.submit(); } return false; });
  }

  /** The list's own Enter picks the highlighted (absent) suggestion: save instead. */
  selectActiveSuggestion(): void { this.submit(); }

  getSuggestions(): never[] { return []; }
  renderSuggestion(): void { /* no list */ }
  onChooseSuggestion(): void { /* no list */ }

  private finish(v: string | null): void { if (!this.settled) { this.settled = true; this.done(v); } }
  private submit(): void { this.finish(this.inputEl.value.trim()); this.close(); }

  onOpen(): void {
    void super.onOpen();
    this.modalEl.addClass("lab-kit-ask");   // styles.css hides the empty list
    if (this.value) { this.inputEl.value = this.value; this.inputEl.select(); }
    // As vtAsk.js: catch Enter on the box first, so the (empty) list's own Enter handler can't swallow it
    this.inputEl.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); e.stopPropagation(); this.submit(); }
    }, true);
  }

  onClose(): void { super.onClose(); window.setTimeout(() => this.finish(null), 0); }
}

/** Asks for one line of text. The trimmed text, or null when Esc was pressed. */
export const ask = (app: App, placeholder: string, value = ""): Promise<string | null> =>
  new Promise(resolve => new AskModal(app, placeholder, value, resolve).open());

interface Choice<T> { label: string; value: T }

class PickModal<T> extends FuzzySuggestModal<Choice<T>> {
  private settled = false;

  constructor(app: App, private choices: Choice<T>[], placeholder: string, private done: (v: T | null) => void, private side = false) {
    super(app);
    this.setPlaceholder(placeholder);
  }

  onOpen(): void {
    void super.onOpen();
    if (this.side) { this.containerEl.addClass("lab-kit-pick-side"); this.modalEl.addClass("lab-kit-pick-side"); }   // styles.css
  }

  getItems(): Choice<T>[] { return this.choices; }
  getItemText(c: Choice<T>): string { return c.label; }
  private finish(v: T | null): void { if (!this.settled) { this.settled = true; this.done(v); } }
  onChooseItem(c: Choice<T>): void { this.finish(c.value); }
  // Obsidian closes the modal before it calls onChooseItem: wait a tick so a choice wins over "closed"
  onClose(): void { super.onClose(); window.setTimeout(() => this.finish(null), 0); }
}

/** Asks to pick one of `labels`; the matching entry of `values`, or null when Esc was pressed. `side`: a small picker at the right edge, so the note behind stays readable. */
export const pick = <T>(app: App, labels: string[], values: T[], placeholder: string, side = false): Promise<T | null> =>
  new Promise(resolve => new PickModal(app, labels.map((label, i) => ({ label, value: values[i] })), placeholder, resolve, side).open());
