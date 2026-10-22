// Close experiment (I24 Phase 3): the confirm windows and the glue between the active note and `closeExperiment` / `reopenExperiment`.
import { Modal, Notice, Platform, TFile, type App } from "obsidian";
import { cardWindow, winFoot, winIntro } from "../kit/window-look";
import { labPrefix, localDate } from "../kit/clone";
import { hasNode } from "../platform";
import { fileExistsIn, listFolderFiles, nodeModule, printHtmlToPdf, saveFileTo } from "../node";
import { closeExperiment, reopenExperiment, type CloseHost } from "./commands";
import { scanClosed, type ClosedScan } from "./scan";
import { renderForPdf } from "./pdf";
import { checkData, dataFoundLine, dataWarnings, NO_NODE_LINE, type DataCheck } from "./data";
import type { KitData } from "../kit/paths";
import type { HeaderSettings } from "../header/settings";

/** The texts are the plan's (`docs/plans/close-experiment.md`, "New user-facing strings"). Without a PDF (a phone) the sentence about the folders is left out. */
class CloseConfirmModal extends Modal {
  private done = false;
  private go: HTMLButtonElement | null = null;
  constructor(app: App, private kind: "close" | "reopen", private date: string, private folders: string[], private data: DataCheck | undefined, private answer: (yes: boolean) => void) { super(app); }

  onOpen(): void {
    const el = this.contentEl;
    el.addClass("lab-kit-win");
    cardWindow(this);
    const close = this.kind === "close";
    this.setTitle(close ? "Close this experiment?" : "Reopen this experiment?");
    winIntro(el, close
      ? `${this.folders.length ? `A PDF of this note is saved in ${this.folders.join(", ")}. ` : ""}The note is marked closed on ${this.date}; if you change it later, Check setup tells you. You can reopen it.`
      : `The closed mark (closed ${this.date}) is removed. The PDFs are kept.`);
    const warnings = close && this.data ? dataWarnings(this.data) : [];
    if (close && this.data) this.drawData(el, this.data, warnings);
    const foot = winFoot(el);
    foot.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    const go = foot.createEl("button", { text: close ? "Close experiment" : "Reopen", cls: "mod-cta" });
    go.disabled = warnings.length > 0;   // a data warning needs the tick "Close anyway"
    go.addEventListener("click", () => { this.done = true; this.answer(true); this.close(); });
    this.go = go;
  }

  /** The Data part: what was found, the warnings and the tick that lets Close go on. */
  private drawData(el: HTMLElement, d: DataCheck, warnings: string[]): void {
    const box = el.createDiv({ cls: "lab-kit-close-data" });
    box.createEl("strong", { text: "Data" });
    if (d.folder) box.createDiv({ text: d.folder });
    if (d.state === "no-node") box.createDiv({ text: NO_NODE_LINE });
    const found = dataFoundLine(d);
    if (found) box.createDiv({ text: found });
    for (const w of warnings) box.createDiv({ text: w, cls: "lab-kit-close-warn" });
    if (!warnings.length) return;
    const label = box.createEl("label", { cls: "lab-kit-close-anyway" });
    const cb = label.createEl("input", { attr: { type: "checkbox" } });
    label.createSpan({ text: " Close anyway" });
    cb.addEventListener("change", () => { if (this.go) this.go.disabled = !cb.checked; });
  }

  onClose(): void { this.contentEl.empty(); if (!this.done) this.answer(false); }
}

/** Files the note embeds, or links with a file extension other than .md, that the vault does not have. */
export function missingLinkedFiles(app: App, file: TFile): string[] {
  const cache = app.metadataCache.getFileCache(file);
  const out = new Set<string>();
  const look = (link: string, embed: boolean): void => {
    const target = link.split("#")[0].split("|")[0].trim();
    if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) return;   // a web address or another scheme
    if (!embed && (!/\.[A-Za-z0-9]+$/.test(target) || /\.md$/i.test(target))) return;
    if (!app.metadataCache.getFirstLinkpathDest(target, file.path)) out.add(target);
  };
  for (const e of cache?.embeds ?? []) look(e.link, true);
  for (const l of cache?.links ?? []) look(l.link, false);
  return Array.from(out);
}

export function closeHostFor(app: App, kit: KitData, header: HeaderSettings, file: TFile): CloseHost {
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
    checkData: () => checkData({
      noteName: file.basename, fm: app.metadataCache.getFileCache(file)?.frontmatter,
      root: Platform.isWin ? header.dataRootWindows : header.dataRootMac,
      join: (...p) => nodeModule("path")?.join(...p) ?? p.join("/"),
      canRead: hasNode(), list: listFolderFiles, missingLinks: missingLinkedFiles(app, file),
    }),
    makePdf: async (footer, extra, closedOn) => {
      const { html } = await renderForPdf(app, file, extra, footer, closedOn);
      return printHtmlToPdf(html);
    },
    fileExists: fileExistsIn,
    saveFile: saveFileTo,
    confirm: (kind, date, folders, data) => new Promise(resolve => new CloseConfirmModal(app, kind, date, folders, data, resolve).open()),
    notice: m => new Notice(m),
    logError: e => console.error("Lab Kit: close experiment", e),
  };
}

/** The Close experiment and Reopen experiment commands: act on the open note. */
export async function runCloseCommand(app: App, kit: KitData, header: HeaderSettings, which: "close" | "reopen"): Promise<void> {
  const file = app.workspace.getActiveFile();
  if (!file || file.extension !== "md") { new Notice("This is not a lab note."); return; }
  const host = closeHostFor(app, kit, header, file);
  await (which === "close" ? closeExperiment(host) : reopenExperiment(host));
}

/** The lab notes (numbered notes in the lab notes folder) sorted for Check setup. */
export function scanLabNotes(app: App, kit: KitData): Promise<ClosedScan> {
  const folder = kit.labFolder ? app.vault.getFolderByPath(kit.labFolder) : null;
  const files = (folder?.children ?? []).filter((f): f is TFile => f instanceof TFile && f.extension === "md" && !!labPrefix(f.basename));
  return scanClosed(files.map(f => ({ path: f.path, name: f.basename, fm: app.metadataCache.getFileCache(f)?.frontmatter, read: () => app.vault.read(f) })));
}
