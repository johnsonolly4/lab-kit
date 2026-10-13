// Settings text boxes: wide enough to read what is typed, and (for folders) with a drop-down of the vault's folders.
import { AbstractInputSuggest, type App, type TextComponent, type TFolder } from "obsidian";

/** Suggests the folders of the vault while a path is typed in a text box. */
export class FolderSuggest extends AbstractInputSuggest<TFolder> {
  constructor(app: App, private input: HTMLInputElement) { super(app, input); }

  getSuggestions(query: string): TFolder[] {
    const q = query.trim().toLowerCase();
    return this.app.vault.getAllFolders(false)
      .filter(f => !q || f.path.toLowerCase().includes(q))
      .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: "base" }))
      .slice(0, 50);
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void { el.setText(folder.path); }

  selectSuggestion(folder: TFolder): void {
    this.setValue(folder.path);
    this.input.dispatchEvent(new Event("input"));   // so the setting saves the picked folder
    this.close();
  }
}

/** Lets a settings text box fill its row. With `app`, typing suggests vault folders. */
export function wideBox(setting: { settingEl: HTMLElement; controlEl: HTMLElement }, text: TextComponent, app?: App): TextComponent {
  setting.settingEl.addClass("lab-kit-wide-row");
  setting.controlEl.addClass("lab-kit-wide-control");
  text.inputEl.addClass("lab-kit-wide-input");
  if (app) new FolderSuggest(app, text.inputEl);
  return text;
}

/** Makes a settings row that only does one thing act as a link: its name shows in the accent colour (styles.css), and a click, Enter or Space anywhere on the row runs `run`. The row has no button. */
export function actionRow(setting: { settingEl: HTMLElement }, run: () => void): void {
  const row = setting.settingEl;
  row.addClass("lab-kit-action");
  row.setAttr("role", "button");
  row.setAttr("tabindex", "0");
  row.addEventListener("click", () => run());
  row.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); run(); } });
}
