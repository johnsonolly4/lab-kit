// Tidy up notes window: the scan's result as a before (left) / after (right) split view, one tick box per rule, an "Only reported" group, Copy report.
// Nothing is written until: the backup box is ticked, Change notes… is pressed and the second window is confirmed (Phase 7b).
import { Modal, Notice, type App } from "obsidian";
import { PLANNING_FOLDER_DEFAULTS, kitParent, kitEnsureDir, type KitData, type PlanningFolders, type PlanningRole } from "./paths";
import type { KitManaged } from "./managed-ui";
import { kitBackupPath } from "./managed";
import { ensureFolder } from "./ensure-folder";
import { applyTidy, type TidyIO } from "./tidy-apply";
import { batchChanges, changeKey, countRows, diffRows, foldRows, pageSummary, replacesPage, reportMarkdown, scan, selectChanges, wantsText, type DiffRow, type Migration, type TidyChange, type TidyContext, type TidyFile, type TidyScan } from "./tidy";
import { hotkeysInUse, metaBindButtons, setMetaBindActions, setTemplaterPath, settingSnapshot, templaterPaths } from "./obsidian-private";
import { INTERVALS, WEEKDAYS, everyWeeks, intervalWeeks } from "../planning/meetings";
import { todoFolder } from "./paths";
import { ymd } from "../planning/todo";
import { winFoot, winIntro } from "./window-look";

/** What the Tidy up notes window needs from the plugin. */
export interface TidyHost { kit: KitData; managed: KitManaged; planning: KitManaged | null }

/** The vault as TidyIO: notes through the Vault API, backups into the kit's backups folder (inside the plugin folder), moves through fileManager. */
export function vaultIO(app: App, backups: string, stamp: string): TidyIO {
  const file = (p: string) => app.vault.getFileByPath(p);
  return {
    read: async p => { const f = file(p); return f ? await app.vault.read(f) : null; },
    write: async (p, text) => { const f = file(p); if (f) await app.vault.process(f, () => text); },
    backup: async (p, text) => {
      const to = kitBackupPath({ backups, stamp }, p);
      await kitEnsureDir(app.vault.adapter, kitParent(to));
      await app.vault.adapter.write(to, text);
      return to;
    },
    exists: p => !!app.vault.getAbstractFileByPath(p),
    filesIn: p => app.vault.getFiles().map(f => f.path).filter(x => x === p || x.startsWith(p + "/")),
    linkedFrom: paths => {
      const gone = new Set(paths);
      return Object.entries(app.metadataCache.resolvedLinks).filter(([src, links]) => !gone.has(src) && paths.some(p => links[p])).map(([src]) => src);
    },
    settingSnapshot: target => settingSnapshot(app, target),
    setSetting: async c => c.target === "metabind-button" ? setMetaBindActions(app, c.key, c.from, c.to) : setTemplaterPath(app, c.target, c.key, c.from as string, c.to as string),
    create: async (p, text) => { await ensureFolder(app.vault, kitParent(p)); await app.vault.create(p, text); },
    rename: async (from, to) => {
      const f = app.vault.getAbstractFileByPath(from);
      if (!f) return;
      await ensureFolder(app.vault, kitParent(to));
      await app.fileManager.renameFile(f, to);
    },
  };
}

/** The first segment of a folder path; a folder with no slash ("00 Inbox", "Extras") is its own top folder. */
const top = (p: string): string => p.includes("/") ? p.slice(0, p.indexOf("/")) : p;

/** What the user chooses for the old weekly-meeting hub (the meetings rule). */
export interface MeetingAnswers { interval: string; day: string }
const MEETING_DEFAULTS: MeetingAnswers = { interval: "weekly", day: "Thu" };

/** The three hub templates, or undefined when one is missing (a hub is never rewritten from an empty template). */
function hubTemplates(host: TidyHost): TidyContext["hubTemplates"] {
  const get = (id: string): string => host.planning?.bundle.contents?.[id] ?? "";
  const out = { project: get("tpl-project-hub-md"), topic: get("tpl-new-topic-hub-md"), series: get("tpl-meeting-series-md") };
  return out.project && out.topic && out.series ? out : undefined;
}

/** The folders and rules the scan works from: the lab kit's, plus the planning kit's while it is on. */
export function tidyContext(host: TidyHost, ask: MeetingAnswers = MEETING_DEFAULTS, app?: App): TidyContext {
  const planningOn = !!host.planning?.slot.enabled;
  const pf: PlanningFolders = planningOn ? host.kit.planningFolders : { ...PLANNING_FOLDER_DEFAULTS };
  const migrations: Migration[] = [host.managed, ...(planningOn && host.planning ? [host.planning] : [])].flatMap(k => k.bundle.manifest.migrations ?? []);
  const contract = [host.kit.labFolder, host.kit.chemicalFolder, ...(planningOn ? (Object.keys(pf) as PlanningRole[]).map(r => pf[r]) : []), "Extras"].map(top).filter(Boolean);
  return {
    labFolder: host.kit.labFolder, chemicalFolder: host.kit.chemicalFolder, knowledgeFolder: planningOn ? pf.knowledge : "", inboxFolder: planningOn ? pf.inbox : "",
    contractFolders: planningOn ? [...new Set(contract)] : [],
    rootNotes: [host.planning?.stateOf("note-00-home-md")?.path ?? "00 Home.md"],
    migrations,
    hubFolders: planningOn ? [pf.projects, pf.literature, pf.knowledge, pf.howtos] : undefined,
    projectsFolder: planningOn ? pf.projects : undefined,
    hubTemplates: planningOn ? hubTemplates(host) : undefined,
    projectHubText: planningOn ? (host.planning?.bundle.contents?.["tpl-project-hub-md"] ?? "").replace(/\r\n/g, "\n").split("-%>\n")[1] : undefined,
    settings: app ? { templater: templaterPaths(app), metaBind: metaBindButtons(app) ?? undefined, hotkeyCommands: Object.keys(hotkeysInUse(app)) } : undefined,
    meetings: planningOn ? { folder: pf.meetings, todos: todoFolder(pf), today: ymd(new Date()), ...ask } : undefined,
  };
}

/** Reads the vault (only the notes the scan needs). Writes nothing. */
async function readVault(app: App, ctx: TidyContext): Promise<TidyFile[]> {
  const paths = app.vault.getFiles().map(f => f.path);
  const readAll = paths.some(p => /(^|\/)view\.js$/.test(p));
  return Promise.all(paths.map(async path => {
    const f = wantsText(path, ctx, readAll) ? app.vault.getFileByPath(path) : null;
    return { path, text: f ? await app.vault.cachedRead(f) : undefined };
  }));
}

export class TidyNotesModal extends Modal {
  private result: TidyScan | null = null;
  private ticked = new Set<string>();
  /** Single changes unticked inside a ticked rule (see changeKey). */
  private off = new Set<string>();
  private backedUp = false;
  private message = "";
  private files: TidyFile[] = [];
  private answers: MeetingAnswers = { ...MEETING_DEFAULTS };

  constructor(app: App, private host: TidyHost) { super(app); }

  onOpen(): void {
    this.modalEl.addClass("mod-wide");
    this.contentEl.addClass("lab-kit-tidy");
    this.setTitle("Tidy up notes");
    this.contentEl.createEl("p", { text: "Reading your notes…" });
    void this.load().then(() => {
      this.ticked = new Set(this.result?.groups.filter(g => !g.optIn).map(g => g.id)); this.off.clear();
      this.render();
    }, () => { this.contentEl.empty(); this.contentEl.createEl("p", { text: "Couldn't read the vault. Nothing was changed." }); });
  }
  onClose(): void { this.contentEl.empty(); }

  /** Reads the vault and scans it. */
  private async load(): Promise<void> {
    this.files = await readVault(this.app, tidyContext(this.host, this.answers, this.app));
    this.rescan();
  }
  /** Scans again with the current answers (no reading: the answers only change what the meetings rule proposes). */
  private rescan(): void { this.off.clear(); this.result = scan(this.files, tidyContext(this.host, this.answers, this.app)); }

  private render(): void {
    const el = this.contentEl, r = this.result;
    if (!r) return;
    el.empty();
    const banner = el.createDiv({ cls: "lab-kit-tidy-banner" });
    banner.createEl("strong", { text: "Back up your whole vault before changing anything. " });
    banner.createSpan({ text: "Lab Kit backs up each note it changes, but that doesn't replace a backup of the vault. Nothing changes until you tick the box below, press Change notes and confirm." });
    if (this.message) el.createDiv({ cls: "lab-kit-tidy-banner", text: this.message });

    if (!r.groups.length && !r.reported.length) el.createEl("p", { text: "Nothing to tidy: every note matches the kit layout." });
    el.createEl("p", { cls: "setting-item-description", text: "Left is the note now, right is how it would look. Red: removed. Green: added. Amber: changed. Unchanged lines are folded; identical changes are shown once." });

    for (const g of r.groups) {
      const section = el.createDiv({ cls: "lab-kit-tidy-group" });
      const head = section.createDiv({ cls: "lab-kit-tidy-rule" });
      const box = head.createEl("input", { type: "checkbox" });
      box.checked = this.ticked.has(g.id);
      box.indeterminate = this.ticked.has(g.id) && g.changes.some((_, i) => this.off.has(changeKey(g.id, i)));
      const singles: HTMLInputElement[] = [];   // one per change, at its position in g.changes
      const batchBoxes: (() => void)[] = [];
      const on = (i: number): boolean => this.ticked.has(g.id) && !this.off.has(changeKey(g.id, i));
      box.addEventListener("change", () => {
        box.indeterminate = false;
        g.changes.forEach((_, i) => this.off.delete(changeKey(g.id, i)));
        if (box.checked) this.ticked.add(g.id); else this.ticked.delete(g.id);
        singles.forEach(b => { b.checked = box.checked; });
        batchBoxes.forEach(sync => sync());
        this.refreshChange?.();
      });
      /** Ticks or unticks some of the rule's notes: the rule counts as ticked while any of its notes is. */
      const setNotes = (indices: number[], value: boolean): void => {
        if (!value && !this.ticked.has(g.id)) return;
        if (value && !this.ticked.has(g.id)) { this.ticked.add(g.id); g.changes.forEach((_, i) => this.off.add(changeKey(g.id, i))); }
        for (const i of indices) { if (value) this.off.delete(changeKey(g.id, i)); else this.off.add(changeKey(g.id, i)); }
        if (g.changes.every((_, i) => this.off.has(changeKey(g.id, i)))) { this.ticked.delete(g.id); g.changes.forEach((_, i) => this.off.delete(changeKey(g.id, i))); }
        box.checked = this.ticked.has(g.id);
        box.indeterminate = box.checked && g.changes.some((_, i) => this.off.has(changeKey(g.id, i)));
        singles.forEach((b, i) => { b.checked = on(i); });
        batchBoxes.forEach(sync => sync());
        this.refreshChange?.();
      };
      /** One note's box. */
      const single = (el: HTMLElement, index: number): void => {
        const one = el.createEl("input", { type: "checkbox" });
        one.checked = on(index);
        singles[index] = one;
        one.addEventListener("change", () => setNotes([index], one.checked));
      };
      const label = head.createDiv();
      label.createEl("strong", { text: `${g.title} (${g.changes.length})` });
      if (g.detail) label.createDiv({ cls: "setting-item-description", text: g.detail });
      if (g.ask === "meetings") this.askMeetings(label);
      for (const { indices } of batchChanges(g.changes)) {
        const c = g.changes[indices[0]];
        const block = section.createDiv({ cls: "lab-kit-tidy-note" });
        const line = block.createDiv({ cls: "lab-kit-tidy-path" });
        if (indices.length === 1) {
          single(line, indices[0]);
          if (c.to !== undefined) { line.createSpan({ text: `${c.path} → ${c.to}${c.note ? ` (${c.note})` : ""}` }); continue; }
          this.path(line, c.path, c.create ? "new note" : c.body ? "page" : "");
          this.change(block, line, c);
          continue;
        }
        // the same change in several notes: drawn once, with one box for all of them and the notes listed below
        const all = line.createEl("input", { type: "checkbox" });
        line.createSpan({ cls: "lab-kit-tidy-name", text: `Same change in ${indices.length} notes${c.create ? " (new notes)" : c.body ? " (page)" : ""}` });
        const sync = (): void => { const n = indices.filter(on).length; all.checked = n > 0; all.indeterminate = n > 0 && n < indices.length; };
        sync();
        batchBoxes.push(sync);
        all.addEventListener("change", () => setNotes(indices, all.checked));
        this.change(block, line, c);
        const notes = block.createEl("details", { cls: "lab-kit-tidy-notes" });
        notes.createEl("summary", { text: `Notes (${indices.length})` });
        for (const i of indices) {
          const row = notes.createDiv({ cls: "lab-kit-tidy-path" });
          single(row, i);
          this.path(row, g.changes[i].path, "");
        }
      }
    }

    if (r.reported.length) {
      el.createEl("h4", { text: "Only reported" });
      el.createEl("p", { cls: "setting-item-description", text: "These need a decision from you. Nothing here is ever changed." });
      for (const rep of r.reported) {
        const section = el.createDiv({ cls: "lab-kit-tidy-group" });
        const label = section.createDiv({ cls: "lab-kit-tidy-rule" }).createDiv();
        label.createEl("strong", { text: `${rep.title} (${rep.items.length})` });
        label.createDiv({ cls: "setting-item-description", text: rep.detail });
        const list = section.createEl("ul", { cls: "lab-kit-tidy-reported" });
        for (const it of rep.items) list.createEl("li", { text: it.note ? `${it.path}: ${it.note}` : it.path });
      }
    }

    const foot = el.createDiv({ cls: "lab-kit-tidy-foot" });
    const backed = foot.createEl("label", { cls: "lab-kit-tidy-backup" });
    const backBox = backed.createEl("input", { type: "checkbox" });
    backBox.checked = this.backedUp;
    backBox.addEventListener("change", () => { this.backedUp = backBox.checked; this.refreshChange?.(); });
    backed.createSpan({ text: "I have backed up my vault" });
    foot.createEl("button", { text: "Copy report" }).addEventListener("click", () => {
      void navigator.clipboard.writeText(reportMarkdown(r, this.ticked)).then(() => new Notice("Report copied."), () => new Notice("Couldn't copy the report."));
    });
    const change = foot.createEl("button", { text: "Change notes…", cls: "mod-cta" });
    this.refreshChange = () => { change.disabled = !this.backedUp || !this.selected().length; };
    this.refreshChange();
    change.addEventListener("click", () => this.confirm());
    foot.createSpan({ cls: "setting-item-description", text: "Tick the box once your vault is backed up." });
  }

  private refreshChange: (() => void) | null = null;

  /** A note's path: its name first, then the folder it is in, muted. `tag` says what sort of change it is ("page", "new note"). */
  private path(line: HTMLElement, path: string, tag: string): void {
    const cut = path.lastIndexOf("/");
    line.createSpan({ cls: "lab-kit-tidy-name", text: `${path.slice(cut + 1)}${tag ? ` (${tag})` : ""}` });
    if (cut !== -1) line.createSpan({ text: path.slice(0, cut) });
  }

  /** One change, under its path line: a short count on the line, then the folded grid, or the short view of a replaced page. */
  private change(block: HTMLElement, line: HTMLElement, c: TidyChange): void {
    if (replacesPage(c)) {
      const s = pageSummary(c.before, c.after), n = s.lost.length;
      line.createSpan({ cls: "lab-kit-tidy-count", text: n ? `${n} of your ${n === 1 ? "line" : "lines"} removed · new page` : "new page" });
      const box = block.createDiv({ cls: "lab-kit-tidy-page" });
      box.createDiv({ cls: "setting-item-description", text: n
        ? `The page is replaced by the kit's template. ${n} of your lines ${n === 1 ? "is" : "are"} not in the new page (${s.kept} ${s.kept === 1 ? "stays" : "stay"}):`
        : "The page is replaced by the kit's template. Nothing of yours is removed." });
      for (const l of s.lost) box.createDiv({ cls: "lab-kit-tidy-line is-removed", text: l });
      const page = c.after.replace(/\r\n/g, "\n").trim();
      const more = box.createEl("details", { cls: "lab-kit-tidy-notes" });
      more.createEl("summary", { text: `New page (${page.split("\n").length} lines)` });
      more.createEl("pre", { cls: "lab-kit-tidy-newpage", text: page });
      return;
    }
    const n = countRows(diffRows(c.before, c.after));
    const parts = [n.added ? `${n.added} added` : "", n.changed ? `${n.changed} changed` : "", n.removed ? `${n.removed} removed` : ""].filter(Boolean);
    line.createSpan({ cls: "lab-kit-tidy-count", text: parts.join(" · ") });
    this.grid(block, c);
  }

  /** One change as a before / after grid. Runs of unchanged lines are folded into one row; pressing it shows them. */
  private grid(el: HTMLElement, c: TidyChange): void {
    const grid = el.createDiv({ cls: "lab-kit-tidy-diff" });
    grid.createDiv({ cls: "lab-kit-tidy-head", text: "Before" });
    grid.createDiv({ cls: "lab-kit-tidy-head", text: "After" });
    const draw = (into: HTMLElement, row: DiffRow): void => {
      const cls = row.kind === "changed" ? "is-changed" : row.kind === "same" ? "is-same" : null;
      const cell = (text: string | null, side: "removed" | "added"): void => { into.createDiv({ cls: `lab-kit-tidy-line ${text === null ? "is-empty" : cls ?? `is-${side}`}`, text: text ?? "" }); };
      cell(row.left, "removed");
      cell(row.right, "added");
    };
    for (const row of foldRows(diffRows(c.before, c.after))) {
      if (row.kind !== "fold") { draw(grid, row); continue; }
      const open = grid.createEl("button", { cls: "lab-kit-tidy-fold", text: `… ${row.rows.length} unchanged lines` });
      const more = grid.createDiv({ cls: "lab-kit-tidy-more" });
      for (const r of row.rows) draw(more, r);
      open.addEventListener("click", () => { more.addClass("is-open"); open.remove(); });
    }
  }

  /** The meetings rule's questions: how often and on which day the old hub's meeting is held. Changing one updates the rows below. */
  private askMeetings(into: HTMLElement): void {
    const row = into.createDiv({ cls: "lab-kit-tidy-foot" });
    const pick = (label: string, options: readonly string[], value: string, set: (v: string) => void): void => {
      row.createSpan({ text: label });
      const sel = row.createEl("select");
      for (const o of options) sel.createEl("option", { text: o, value: o });
      sel.value = value;
      sel.addEventListener("change", () => { set(sel.value); this.rescan(); this.render(); });
    };
    // weekly / fortnightly / monthly, or every N weeks (a number box appears)
    const EVERY = "every N weeks";
    const weeks = intervalWeeks(this.answers.interval);
    const preset = (INTERVALS as readonly string[]).includes(this.answers.interval);
    pick("Held", [...INTERVALS, EVERY], preset ? this.answers.interval : EVERY, v => { this.answers.interval = v === EVERY ? everyWeeks(weeks && !preset ? weeks : 3) : v; });
    if (!preset) {
      const n = row.createEl("input", { type: "number", cls: "lab-kit-tidy-weeks" });
      n.min = "1"; n.max = "52"; n.value = String(weeks ?? 3);
      row.createSpan({ text: "weeks" });
      n.addEventListener("change", () => { const v = Math.min(52, Math.max(1, Math.round(Number(n.value)) || 3)); this.answers.interval = everyWeeks(v); this.rescan(); this.render(); });
    }
    pick("on", WEEKDAYS, this.answers.day, v => { this.answers.day = v; });
  }

  /** The changes of the ticked rules. */
  private selected(): TidyChange[] { return this.result ? selectChanges(this.result, this.ticked, this.off) : []; }

  /** Step 2: a second window; nothing is written before Confirm. */
  private confirm(): void {
    const changes = this.selected(), rules = (this.result?.groups ?? []).filter(g => this.ticked.has(g.id)).length;   // a rule counts while any of its notes is ticked
    if (!changes.length || !this.backedUp) return;
    new TidyConfirmModal(this.app, changes.length, rules, () => void this.apply(changes)).open();
  }

  private async apply(changes: TidyChange[]): Promise<void> {
    const backups = this.host.managed.roles().backups;
    try {
      const out = await applyTidy(vaultIO(this.app, backups, new Date().toISOString()), changes);
      const parts = [`${out.changed.length} notes changed`, `${out.moved.length} moved`, `${out.created.length} created`, `${out.settings.length} settings`, `${out.skipped.length} skipped`];
      this.message = `${parts.join(", ")}. Backups: ${backups}.${out.skipped.length ? ` Skipped: ${out.skipped.map(x => `${x.path} (${x.why})`).join("; ")}.` : ""}`;
      new Notice(parts.join(", ") + ".");
    } catch (e) { this.message = `Stopped: ${(e as Error).message}. Anything already changed is in the backups folder (${backups}).`; }
    await this.load();   // a second scan: what is left
    this.ticked = new Set(this.result?.groups.filter(g => !g.optIn).map(g => g.id)); this.off.clear();
    this.backedUp = false;
    this.render();
  }
}

/** Step 2 of Change notes: "Change N notes (M rules)?" with Confirm and Cancel. */
class TidyConfirmModal extends Modal {
  constructor(app: App, private n: number, private rules: number, private onConfirm: () => void) { super(app); }
  onOpen(): void {
    this.setTitle(`Change ${this.n} ${this.n === 1 ? "item" : "items"} (${this.rules} ${this.rules === 1 ? "rule" : "rules"})?`);
    winIntro(this.contentEl, "Each note is backed up first. Notes you have edited since the scan are skipped.");
    const row = winFoot(this.contentEl);
    row.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    row.createEl("button", { text: "Confirm", cls: "mod-warning" }).addEventListener("click", () => { this.close(); this.onConfirm(); });
  }
  onClose(): void { this.contentEl.empty(); }
}
