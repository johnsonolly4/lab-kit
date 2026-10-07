// Tidy up notes window (Phase 7a): the scan's result as a before (left) / after (right) split view, one tick box per rule, an "Only reported" group,
// Copy report. Changes nothing in the vault: the Change notes… button stays disabled until Phase 7b.
import { Modal, Notice, type App } from "obsidian";
import { PLANNING_FOLDER_DEFAULTS, type KitData, type PlanningFolders, type PlanningRole } from "./paths";
import type { KitManaged } from "./managed-ui";
import { diffRows, reportMarkdown, scan, wantsText, type Migration, type TidyContext, type TidyScan } from "./tidy";

/** What the Tidy up notes window needs from the plugin. */
export interface TidyHost { kit: KitData; managed: KitManaged; planning: KitManaged | null }

const top = (p: string): string => p.includes("/") ? p.slice(0, p.indexOf("/")) : "";

/** The folders and rules the scan works from: the lab kit's, plus the planning kit's while it is on. */
export function tidyContext(host: TidyHost): TidyContext {
  const planningOn = !!host.planning?.slot.enabled;
  const pf: PlanningFolders = planningOn ? host.kit.planningFolders : { ...PLANNING_FOLDER_DEFAULTS };
  const migrations: Migration[] = [host.managed, ...(planningOn && host.planning ? [host.planning] : [])].flatMap(k => k.bundle.manifest.migrations ?? []);
  const contract = [host.kit.labFolder, host.kit.chemicalFolder, ...(planningOn ? (Object.keys(pf) as PlanningRole[]).map(r => pf[r]) : []), "Extras"].map(top).filter(Boolean);
  return {
    labFolder: host.kit.labFolder, knowledgeFolder: planningOn ? pf.knowledge : "", inboxFolder: planningOn ? pf.inbox : "",
    contractFolders: planningOn ? [...new Set(contract)] : [],
    rootNotes: [host.planning?.stateOf("note-00-home-md")?.path ?? "00 Home.md"],
    migrations,
  };
}

/** Reads the vault (only the notes the scan needs) and runs the scan. Writes nothing. */
export async function scanVault(app: App, host: TidyHost): Promise<TidyScan> {
  const ctx = tidyContext(host);
  const paths = app.vault.getFiles().map(f => f.path);
  const readAll = paths.some(p => /(^|\/)view\.js$/.test(p));
  const files = await Promise.all(paths.map(async path => {
    const f = wantsText(path, ctx, readAll) ? app.vault.getFileByPath(path) : null;
    return { path, text: f ? await app.vault.cachedRead(f) : undefined };
  }));
  return scan(files, ctx);
}

export class TidyNotesModal extends Modal {
  private result: TidyScan | null = null;
  private ticked = new Set<string>();

  constructor(app: App, private host: TidyHost) { super(app); }

  onOpen(): void {
    this.modalEl.addClass("mod-wide");
    this.contentEl.addClass("lab-kit-tidy");
    this.setTitle("Tidy up notes");
    this.contentEl.createEl("p", { text: "Reading your notes…" });
    void scanVault(this.app, this.host).then(r => {
      this.result = r;
      this.ticked = new Set(r.groups.map(g => g.id));
      this.render();
    }, () => { this.contentEl.empty(); this.contentEl.createEl("p", { text: "Couldn't read the vault. Nothing was changed." }); });
  }
  onClose(): void { this.contentEl.empty(); }

  private render(): void {
    const el = this.contentEl, r = this.result;
    if (!r) return;
    el.empty();
    const banner = el.createDiv({ cls: "lab-kit-tidy-banner" });
    banner.createEl("strong", { text: "Back up your whole vault before changing anything. " });
    banner.createSpan({ text: "Lab Kit's backups of single files don't replace that. This window only shows what would change: nothing is changed yet." });

    if (!r.groups.length && !r.reported.length) el.createEl("p", { text: "Nothing to tidy: every note matches the kit layout." });
    el.createEl("p", { cls: "setting-item-description", text: "Left is the note now, right is how it would look. Red: removed. Green: added. Amber: changed." });

    for (const g of r.groups) {
      const head = el.createDiv({ cls: "lab-kit-tidy-rule" });
      const box = head.createEl("input", { type: "checkbox" });
      box.checked = this.ticked.has(g.id);
      box.addEventListener("change", () => { if (box.checked) this.ticked.add(g.id); else this.ticked.delete(g.id); });
      const label = head.createDiv();
      label.createEl("strong", { text: `${g.title} (${g.changes.length})` });
      if (g.detail) label.createDiv({ cls: "setting-item-description", text: g.detail });
      for (const c of g.changes) {
        el.createDiv({ cls: "lab-kit-tidy-path", text: c.path });
        const grid = el.createDiv({ cls: "lab-kit-tidy-diff" });
        grid.createDiv({ cls: "lab-kit-tidy-head", text: "Before" });
        grid.createDiv({ cls: "lab-kit-tidy-head", text: "After" });
        for (const row of diffRows(c.before, c.after)) {
          const cls = row.kind === "changed" ? "is-changed" : row.kind === "same" ? "is-same" : null;
          const cell = (text: string | null, side: "removed" | "added"): void => { grid.createDiv({ cls: `lab-kit-tidy-line ${text === null ? "is-empty" : cls ?? `is-${side}`}`, text: text ?? "" }); };
          cell(row.left, "removed");
          cell(row.right, "added");
        }
      }
    }

    if (r.reported.length) {
      el.createEl("h4", { text: "Only reported" });
      el.createEl("p", { cls: "setting-item-description", text: "These need a decision from you. Nothing here is ever changed." });
      for (const rep of r.reported) {
        el.createEl("strong", { text: `${rep.title} (${rep.items.length})` });
        el.createDiv({ cls: "setting-item-description", text: rep.detail });
        const list = el.createEl("ul");
        for (const it of rep.items) list.createEl("li", { text: it.note ? `${it.path}: ${it.note}` : it.path });
      }
    }

    const foot = el.createDiv({ cls: "lab-kit-tidy-foot" });
    const backed = foot.createEl("label", { cls: "lab-kit-tidy-backup" });
    backed.createEl("input", { type: "checkbox" });
    backed.createSpan({ text: "I have backed up my vault" });
    foot.createEl("button", { text: "Copy report" }).addEventListener("click", () => {
      void navigator.clipboard.writeText(reportMarkdown(r, this.ticked)).then(() => new Notice("Report copied."), () => new Notice("Couldn't copy the report."));
    });
    const change = foot.createEl("button", { text: "Change notes…", attr: { title: "Comes in the next version" } });
    change.disabled = true;
    foot.createSpan({ cls: "setting-item-description", text: "Changing notes comes in the next version." });
  }
}
