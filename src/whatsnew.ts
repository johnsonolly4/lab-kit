// "What's new" popup: shows the newest section of the bundled changelog (docs/changelog.md).
import { MarkdownRenderer, Modal, type App, type Plugin } from "obsidian";

export const CHANGELOG_URL = "https://github.com/johnsonolly4/lab-kit/blob/main/docs/changelog.md";

/** The newest section of a changelog: from the first `## ` heading up to the next one. Empty when there is none. */
export function latestSection(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex(l => /^## /.test(l));
  if (start < 0) return "";
  let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  if (end < 0) end = lines.length;
  return lines.slice(start, end).join("\n").trim();
}

/** The heading of a section (without the `## `): remembered so the popup shows once per version. */
export const sectionHeading = (section: string): string => section.split("\n", 1)[0].replace(/^## /, "").trim();

export class WhatsNewModal extends Modal {
  constructor(app: App, private plugin: Plugin, private section: string) { super(app); }

  onOpen(): void {
    const { contentEl } = this;
    this.titleEl.setText("What's new in Lab Kit");
    contentEl.addClass("lab-kit-whatsnew");
    const body = contentEl.createDiv({ cls: "lab-kit-whatsnew-body" });
    void MarkdownRenderer.render(this.app, this.section, body, "", this.plugin);
    const foot = contentEl.createDiv({ cls: "lab-kit-whatsnew-foot" });
    foot.createEl("a", { text: "Full changelog on GitHub", href: CHANGELOG_URL });
    foot.createEl("button", { text: "Close", cls: "mod-cta" }).addEventListener("click", () => this.close());
  }

  onClose(): void { this.contentEl.empty(); }
}
