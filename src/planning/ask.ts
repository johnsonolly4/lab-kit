// Planning kit's text box: looks like Obsidian's pickers (same component) with no list underneath. Port of the kit's vtAsk.js.
import { SuggestModal, type App } from "obsidian";

class AskModal extends SuggestModal<never> {
  private settled = false;

  constructor(app: App, placeholder: string, private value: string, private done: (v: string | null) => void) {
    super(app);
    this.setPlaceholder(placeholder);
    this.emptyStateText = "";
    this.setInstructions([{ command: "Enter", purpose: "to save" }, { command: "Esc", purpose: "to cancel" }]);
    this.scope.register([], "Enter", (e) => { if (!e.isComposing) { e.preventDefault(); this.submit(); } return false; });
  }

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
