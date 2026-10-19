// To-do engine (planning kit): stamps dragged / ticked cards, rolls unfinished cards over, and tags the board for vault-theme.css.
// Replaces the planning suite's To-do roll-over startup template. Rules: src/planning/todo.ts. Plan: docs/plans/phase-4a-todo-engine.md.
// Uses Bases' board markup (.bases-kanban-*, data-property): not a documented API, may change between Obsidian versions.
import { trackPointer } from "./entry-window";
import { MarkdownView, Notice, Platform, TFile, normalizePath, type App, type Plugin } from "obsidian";
import { metadataResolved } from "../kit/obsidian-private";
import { applyPatch, cardTag, changePatch, emptyTodoCursorLine, rollOverPatch, snapOf, todayColumn, todayMark, ymd, dueCountdown, waitingOf, type CountdownMode, type TodoFm, type TodoSnap } from "./todo";

/** Per-device switch (this vault's local storage, not synced): "on" / "off"; unset = computers roll over, phones and tablets don't. */
export const ROLL_KEY = "vt-rollover";
const START_DELAY = 90 * 1000;      // let Obsidian Sync bring other devices' changes down first
const RECHECK = 15 * 60 * 1000;     // a new day while Obsidian stays open
const BOARD = '.bases-view[data-view-name="Board"]';

/** Whether this device rolls cards over: the per-device switch, else not on phones and tablets. */
export const rollsOnDevice = (stored: unknown, mobile: boolean): boolean => (stored ? stored === "on" : !mobile);

/** The old startup template's engine is running in this window (it sets window.vtTodoEngine). */
const templateRunning = (): boolean => !!(window as unknown as { vtTodoEngine?: unknown }).vtTodoEngine;

export class TodoEngine {
  private seen = new Map<string, TodoSnap>();   // path -> last seen { day, done }: tells a drag or tick from our own writes
  private tagQueued = false;
  private warned = false;

  /** `folder` is read each time, so a changed Planning folder setting needs no reload. A folder that doesn't exist matches nothing. */
  constructor(private plugin: Plugin, private folder: () => string, private countdown: () => CountdownMode = () => "off") {}

  /** Draw the board's tags again (a setting changed). */
  retag(): void { this.queueTag(); }

  get app(): App { return this.plugin.app; }

  private isTodo = (f: unknown): f is TFile => f instanceof TFile && f.extension === "md" && f.path.startsWith(normalizePath(this.folder()) + "/");
  private fm = (f: TFile): TodoFm => this.app.metadataCache.getFileCache(f)?.frontmatter ?? {};
  private todos = (): TFile[] => this.app.vault.getMarkdownFiles().filter(this.isTodo);

  /** The old startup template is still on: it does the same job, so this engine writes nothing (else both would write). Says so once. */
  private standDown(): boolean {
    if (!templateRunning()) return false;
    if (!this.warned) {
      this.warned = true;
      new Notice("The old to-do roll-over template still runs at startup, so the plugin leaves the to-do board to it. Remove it from the startup templates, then restart.", 12000);
    }
    return true;
  }

  private rollsHere(): boolean {
    let stored: unknown = null;
    try { stored = this.app.loadLocalStorage(ROLL_KEY); } catch { /* no local storage: use the device default */ }
    return rollsOnDevice(stored, Platform.isMobile);
  }

  start(): void {
    const plugin = this.plugin, app = this.app;
    trackPointer(plugin);   // windows can open where the cursor is
    app.workspace.onLayoutReady(() => {
      // Wait until Obsidian has read every note's properties (at most 15 s), then remember every card as it is
      let begun = false;
      const begin = (): void => {
        if (begun) return;
        begun = true;
        for (const f of this.todos()) this.seen.set(f.path, snapOf(this.fm(f)));
        this.markToday();
        this.queueTag();
      };
      if (metadataResolved(app)) begin();   // already read (normal start, or the plugin switched on later): seed now
      const ref = app.metadataCache.on("resolved", () => { app.metadataCache.offref(ref); begin(); });
      plugin.registerEvent(ref);
      plugin.register(() => window.clearTimeout(fallback));
      const fallback = window.setTimeout(begin, 15000);

      plugin.registerEvent(app.metadataCache.on("changed", f => {
        void this.onChanged(f).catch(e => console.error("Lab Kit to-do engine", e));
        if (this.isTodo(f)) this.queueTag();
      }));
      plugin.registerEvent(app.vault.on("rename", (f, old) => {
        const s = this.seen.get(old);
        this.seen.delete(old);
        if (s && this.isTodo(f)) this.seen.set(f.path, s);
      }));
      plugin.registerEvent(app.vault.on("delete", f => { this.seen.delete(f.path); }));

      // A to-do with nothing typed yet opens with the cursor under the chip bar, not above it.
      // A note made by the template is opened before Templater has written it, so look again for a moment
      const placeCursor = (path: string): boolean => {   // true = nothing more to wait for
        const view = app.workspace.getActiveViewOfType(MarkdownView);
        if (!view || view.file?.path !== path || view.getMode() !== "source") return true;
        const text = view.editor.getValue();
        const line = emptyTodoCursorLine(text);
        if (line === null) return text.trim() !== "";   // blank: the template has not written yet
        if (view.editor.getCursor().line < line) { view.editor.setCursor({ line, ch: 0 }); view.editor.focus(); }
        return true;
      };
      plugin.registerEvent(app.workspace.on("file-open", f => {
        if (!f || placeCursor(f.path)) return;
        let done = false;
        for (const ms of [150, 400, 900, 1800]) {
          const t = window.setTimeout(() => { if (!done) done = placeCursor(f.path); }, ms);
          plugin.register(() => window.clearTimeout(t));
        }
      }));

      // Clicking the done circle on a board card ticks / unticks done in that note (Bases cards are read-only)
      plugin.registerDomEvent(window, "click", e => this.onCardClick(e), { capture: true });

      // Column names and carried-over cards, again on every redraw (the board re-uses columns as you scroll)
      const observer = new MutationObserver(muts => {
        if (muts.some(m => !!(m.target.nodeType === 1 ? (m.target as Element) : m.target.parentElement)?.closest(".bases-view"))) this.queueTag();
      });
      observer.observe(app.workspace.containerEl, { childList: true, subtree: true, characterData: true });   // characterData: a re-used column changes only its header text
      plugin.register(() => observer.disconnect());

      let lastRun = ymd(new Date());
      const timer = window.setTimeout(() => this.runRollOver(), START_DELAY);
      plugin.register(() => window.clearTimeout(timer));
      plugin.registerInterval(window.setInterval(() => {
        const today = ymd(new Date());
        if (today !== lastRun) { lastRun = today; this.runRollOver(); this.queueTag(); }   // the countdown counts days
      }, RECHECK));
      plugin.register(() => this.cleanUp());
    });
  }

  private async onChanged(f: TFile): Promise<void> {
    if (!this.isTodo(f)) return;
    const fm = this.fm(f), now = snapOf(fm), before = this.seen.get(f.path);
    this.seen.set(f.path, now);
    if (this.standDown()) return;
    const patch = changePatch(fm, before, now, new Date());
    if (patch) await this.app.fileManager.processFrontMatter(f, x => applyPatch(x as Record<string, unknown>, patch));
  }

  private runRollOver(): void {
    this.markToday();
    if (this.rollsHere() && !this.standDown()) void this.rollOver().catch(e => console.error("Lab Kit to-do engine", e));
  }

  /** "Roll over to-dos now": on any device (the per-device switch is for the automatic run), unless the old startup template runs. */
  async rollOverNow(): Promise<void> {
    this.markToday();
    if (this.standDown()) return;
    const { rolled, cleared } = await this.rollOver();
    if (!rolled && !cleared) new Notice("Nothing to roll over");
  }

  /** Rolls unfinished cards over to today and clears last week's finished cards. */
  async rollOver(now = new Date()): Promise<{ rolled: number; cleared: number }> {
    let rolled = 0, cleared = 0;
    for (const f of this.todos()) {
      const out = rollOverPatch(this.fm(f), new Date(f.stat.mtime), now);
      if (!out) continue;
      if (out.snap) this.seen.set(f.path, out.snap);   // our own write: not a drag or tick
      await this.app.fileManager.processFrontMatter(f, x => applyPatch(x as Record<string, unknown>, out.patch));
      if (out.kind === "rolled") rolled++;
      if (out.kind === "cleared") cleared++;
    }
    const col = todayColumn(now);
    if (rolled) new Notice(`Moved ${rolled} unfinished to-do${rolled === 1 ? "" : "s"} to ${col}`);
    if (cleared) new Notice(`Cleared ${cleared} finished to-do${cleared === 1 ? "" : "s"} from last week`);
    return { rolled, cleared };
  }

  /** Today's column for vault-theme.css (blue). Every device does this; it writes nothing. */
  private markToday(): void { activeDocument.body.dataset.vtToday = todayMark(new Date()); }

  private cardFile(card: Element | null): TFile | null {
    if (!card) return null;
    const el = card.querySelector("[data-path], [data-href]");
    const p = el?.getAttribute("data-path") ?? el?.getAttribute("data-href");
    if (p) {
      const f = this.app.vault.getAbstractFileByPath(p) ?? this.app.metadataCache.getFirstLinkpathDest(p, "");
      if (this.isTodo(f)) return f;
    }
    const title = card.querySelector(".mod-title .bases-kanban-card-line")?.textContent?.trim();
    return title ? this.todos().find(f => f.basename === title) ?? null : null;
  }

  private onCardClick(e: MouseEvent): void {
    const target = e.target as Element | null;
    const box = target?.closest?.(`${BOARD} .bases-kanban-card [data-property="note.done"]`);
    if (!box || templateRunning()) return;   // the old template toggles it too: two toggles would cancel out
    e.preventDefault(); e.stopPropagation();
    const f = this.cardFile(box.closest(".bases-kanban-card"));
    if (!f) { new Notice("Couldn't find this card's note: open it to tick done."); return; }
    void this.app.fileManager.processFrontMatter(f, (x: Record<string, unknown>) => { x.done = x.done !== true; }).catch(err => console.error("Lab Kit to-do engine", err));
  }

  private queueTag(): void {
    if (this.tagQueued) return;
    this.tagQueued = true;
    window.requestAnimationFrame(() => this.tag());
  }

  /** Every kanban column gets data-vt-group="<its name>" (the hidden measuring column has none); carried-over cards get vt-rolled; open cards that wait on something get data-vt-waiting="<what>"; cards with a countdown get data-vt-due. */
  private tag(): void {
    this.tagQueued = false;
    const root = this.app.workspace.containerEl;
    for (const col of Array.from(root.querySelectorAll<HTMLElement>('.bases-view[data-view-type="kanban"] .bases-kanban-column'))) {
      const name = col.querySelector(".bases-group-value")?.textContent?.trim() ?? "";
      if (name) { if (col.dataset.vtGroup !== name) col.dataset.vtGroup = name; }
      else if (col.dataset.vtGroup !== undefined) delete col.dataset.vtGroup;
    }
    for (const card of Array.from(root.querySelectorAll(`${BOARD} .bases-kanban-card`))) {
      try {
        const f = this.cardFile(card);
        const fm = f ? this.fm(f) : null;
        card.classList.toggle("vt-rolled", !!fm && fm.rolled === true && fm.done !== true);
        const cd = fm ? dueCountdown(fm, this.countdown(), new Date()) : null;
        const el = card as HTMLElement;
        if (cd) { el.dataset.vtDue = cd.text; el.dataset.vtDueLevel = cd.level; }
        else { delete el.dataset.vtDue; delete el.dataset.vtDueLevel; }
        const waiting = fm && fm.done !== true ? waitingOf(fm) : "";
        if (waiting) el.dataset.vtWaiting = waiting; else delete el.dataset.vtWaiting;
        const tag = fm ? cardTag(fm) : null;
        if (tag) { el.dataset.vtTag = tag.text; el.dataset.vtPrio = tag.level; }
        else { delete el.dataset.vtTag; delete el.dataset.vtPrio; }
      } catch (e) { console.error("Lab Kit to-do engine", e); }
    }
  }

  private cleanUp(): void {
    delete activeDocument.body.dataset.vtToday;
    const root = this.app.workspace.containerEl;
    for (const el of Array.from(root.querySelectorAll<HTMLElement>("[data-vt-group]"))) delete el.dataset.vtGroup;
    for (const el of Array.from(root.querySelectorAll(".vt-rolled"))) el.classList.remove("vt-rolled");
    for (const el of Array.from(root.querySelectorAll<HTMLElement>("[data-vt-due]"))) { delete el.dataset.vtDue; delete el.dataset.vtDueLevel; }
    for (const el of Array.from(root.querySelectorAll<HTMLElement>("[data-vt-waiting]"))) delete el.dataset.vtWaiting;
    for (const el of Array.from(root.querySelectorAll<HTMLElement>("[data-vt-tag]"))) { delete el.dataset.vtTag; delete el.dataset.vtPrio; }
  }
}
