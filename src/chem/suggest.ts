// Popup that suggests chemical notes while a [[link]] is typed in a text input (the calc cell editor).
import { AbstractInputSuggest, type App } from "obsidian";
import { chemicalLink, insertLink, matchChemicals, openLink, type Chemical, type Suggestion } from "./index";

export class ChemicalSuggest extends AbstractInputSuggest<Suggestion> {
  /** True while the popup is showing suggestions: Enter and Tab then pick one instead of saving the cell. */
  shown = false;

  constructor(app: App, private input: HTMLInputElement, private entries: () => Chemical[]) { super(app, input); }

  getSuggestions(value: string): Suggestion[] {
    const open = openLink(value, this.input.selectionStart ?? value.length);
    const found = open ? matchChemicals(this.entries(), open.query) : [];
    this.shown = found.length > 0;
    return found;
  }

  renderSuggestion(s: Suggestion, el: HTMLElement): void {
    el.setText(s.chemical.name);
    if (s.alias) el.createSpan({ cls: "lab-kit-suggest-alias", text: s.alias });
  }

  selectSuggestion(s: Suggestion): void {
    const at = this.input.selectionStart ?? this.input.value.length;
    const open = openLink(this.input.value, at);
    if (open) {
      const done = insertLink(this.input.value, at, open.start, chemicalLink(s));
      this.input.value = done.value;
      this.input.setSelectionRange(done.cursor, done.cursor);
    }
    this.input.focus({ preventScroll: true });
    this.close();
  }

  close(): void {
    this.shown = false;
    super.close();
  }
}
