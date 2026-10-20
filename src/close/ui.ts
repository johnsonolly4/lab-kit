// Close experiment (I24 Phase 3): the confirm windows and the glue between the active note and `closeExperiment` / `reopenExperiment`.
import { Modal, Notice, TFile, type App } from "obsidian";
import { cardWindow, winFoot, winIntro } from "../kit/window-look";
import { labPrefix, localDate } from "../kit/clone";
import { hasNode } from "../platform";
import { fileExistsIn, printHtmlToPdf, saveFileTo } from "../node";
import { closeExperiment, reopenExperiment, type CloseHost } from "./commands";
import { scanClosed, type ClosedScan } from "./scan";
import { footerTemplate, renderForPdf } from "./pdf";
import type { KitData } from "../kit/paths";

/** The texts are the plan's (`docs/plans/close-experiment.md`, "New user-facing strings"). Without a PDF (a phone) the sentence about the folders is left out. */
class CloseConfirmModal extends Modal {
  private done = false;
  constructor(app: App, private kind: "close" | "reopen", private date: string, private folders: string[], private answer: (yes: boolean) => void) { super(app); }

  onOpen(): void {
    const el = this.contentEl;
    el.addClass("lab-kit-win");
    cardWindow(this);
    const close = this.kind === "close";
    this.setTitle(close ? "Close this experiment?" : "Reopen this experiment?");
    winIntro(el, close
      ? `${this.folders.length ? `A PDF of this note is saved in ${this.folders.join(", ")}. ` : ""}The note is marked closed on ${this.date}; if you change it later, Check setup tells you. You can reopen it.`
      : `The closed mark (closed ${this.date}) is removed. The PDFs are kept.`);
    const foot = winFoot(el);
    foot.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    foot.createEl("button", { text: close ? "Close experiment" : "Reopen", cls: "mod-cta" }).addEventListener("click", () => { this.done = true; this.answer(true); this.close(); });
  }

  onClose(): void { this.contentEl.empty(); if (!this.done) this.answer(false); }
}

export function closeHostFor(app: App, kit: KitData, file: TFile): CloseHost {
  const inLabFolder = !!kit.labFolder && file.parent?.path === kit.labFolder && !!labPrefix(file.basename);
  return {
    name: file.basename,
    today: localDate(new Date()),
    isLabNote: inLabFolder,
    canPdf: hasNode(),
    folders: kit.closePdfFolders.filter(f => f.trim()),
    readText: () => app.vault.read(file),
    frontmatter: () => app.metadataCache.getFileCache(file)?.frontmatter,
    editFrontmatter: fn => app.fileManager.processFrontMatter(file, fn),
    makePdf: async footer => {
      const { html } = await renderForPdf(app, file);
      return printHtmlToPdf(html, footerTemplate(footer));
    },
    fileExists: fileExistsIn,
    saveFile: saveFileTo,
    confirm: (kind, date, folders) => new Promise(resolve => new CloseConfirmModal(app, kind, date, folders, resolve).open()),
    notice: m => new Notice(m),
    logError: e => console.error("Lab Kit: close experiment", e),
  };
}

/** The Close experiment and Reopen experiment commands: act on the open note. */
export async function runCloseCommand(app: App, kit: KitData, which: "close" | "reopen"): Promise<void> {
  const file = app.workspace.getActiveFile();
  if (!file || file.extension !== "md") { new Notice("This is not a lab note."); return; }
  const host = closeHostFor(app, kit, file);
  await (which === "close" ? closeExperiment(host) : reopenExperiment(host));
}

/** The lab notes (numbered notes in the lab notes folder) sorted for Check setup. */
export function scanLabNotes(app: App, kit: KitData): Promise<ClosedScan> {
  const folder = kit.labFolder ? app.vault.getFolderByPath(kit.labFolder) : null;
  const files = (folder?.children ?? []).filter((f): f is TFile => f instanceof TFile && f.extension === "md" && !!labPrefix(f.basename));
  return scanClosed(files.map(f => ({ path: f.path, name: f.basename, fm: app.metadataCache.getFileCache(f)?.frontmatter, read: () => app.vault.read(f) })));
}
