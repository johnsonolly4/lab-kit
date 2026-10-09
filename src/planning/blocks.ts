// Homepage blocks (Phase 5a): ```vault-card, ```vault-goto and ```vault-projects, drawn by the plugin from Obsidian's metadata cache
// (no Dataview). Rules: src/planning/lists.ts. Plan: docs/plans/phase-5-homepage-meetings.md.
import { Keymap, MarkdownRenderChild, Notice, TFile, TFolder, debounce, setIcon, type App, type Plugin } from "obsidian";
import { folderMissingText } from "../kit/folder-guard";
import { runCommand, loadedPlugins } from "../kit/obsidian-private";
import { PLANNING_KIT, kitJoin, todoFolder, type KitData } from "../kit/paths";
import type { PlanningCommands } from "./commands";
import { ymd } from "./todo";
import { WEEKDAYS, nextMeetingLines, nextMeetings } from "./meetings";
import { blockOptions, experiments, gotoTargets, goalOf, inFolder, deadlineBadge, dayMonth, projectCards, projects, recentlyRead, thisWeek, TILE_ROWS, unnumbered, withExtras, type GotoLink, type ListLine, type NoteRec } from "./lists";

const LANGS = ["vault-card", "vault-goto", "vault-projects"] as const;
type Lang = (typeof LANGS)[number];

/** Draws the blocks and redraws the open ones when notes change. Registered at load; shows a line instead while the planning kit is off. */
export class PlanningBlocks {
  private views = new Set<BlockView>();

  constructor(readonly plugin: Plugin, readonly kit: () => KitData, readonly commands: () => PlanningCommands | null) {}

  get app(): App { return this.plugin.app; }

  register(): void {
    for (const lang of LANGS) {
      this.plugin.registerMarkdownCodeBlockProcessor(lang, (source, el, ctx) => { ctx.addChild(new BlockView(el, this, lang, source, ctx.sourcePath)); });
    }
    const redraw = debounce(() => this.refresh(), 500, true);
    this.plugin.registerEvent(this.app.metadataCache.on("changed", () => redraw()));
    for (const ev of ["create", "delete", "rename"] as const) this.plugin.registerEvent(this.app.vault.on(ev as "create", () => redraw()));
  }

  /** Redraws every open block (settings changed, notes changed). */
  refresh(): void { for (const v of this.views) v.draw(); }

  add(v: BlockView): void { this.views.add(v); }
  remove(v: BlockView): void { this.views.delete(v); }

  /** Notes in `folder` and below, as the lists see them. */
  notesIn(folder: string): NoteRec[] {
    return this.app.vault.getMarkdownFiles().filter(f => inFolder(f.path, folder)).map(f => this.rec(f));
  }

  rec(f: TFile): NoteRec {
    const cache = this.app.metadataCache.getFileCache(f);
    const links = Object.keys(this.app.metadataCache.resolvedLinks[f.path] ?? {});
    return { path: f.path, name: f.basename, folder: f.parent?.path ?? "", fm: cache?.frontmatter ?? {}, ctime: f.stat.ctime, mtime: f.stat.mtime, links };
  }
}

class BlockView extends MarkdownRenderChild {
  private drawing = 0;

  constructor(el: HTMLElement, private owner: PlanningBlocks, private lang: Lang, private source: string, private sourcePath: string) { super(el); }

  get app(): App { return this.owner.app; }

  onload(): void { this.owner.add(this); this.draw(); }
  onunload(): void { this.owner.remove(this); }

  draw(): void {
    const run = ++this.drawing;   // a newer draw wins over a slower one still reading goals
    void this.render(run).catch(e => { console.error("Lab Kit block", e); });
  }

  private async render(run: number): Promise<void> {
    const kit = this.owner.kit();
    const box = createDiv({ cls: `lab-kit-block lab-kit-${this.lang}` });
    if (!kit.kits[PLANNING_KIT]?.enabled) box.createDiv({ cls: "vt-muted", text: "The planning kit is off: switch it on in Settings → Lab Kit." });
    else if (this.lang === "vault-goto") this.goto(box);
    else if (this.lang === "vault-projects") await this.projects(box);
    else this.card(box);
    if (run !== this.drawing) return;
    this.containerEl.empty();
    this.containerEl.appendChild(box);
  }

  /** The folder `path` exists; else a line saying it is missing (moved outside Obsidian?) in `box`. */
  private need(box: HTMLElement, path: string): boolean {
    if (this.app.vault.getFolderByPath(path)) return true;
    box.createDiv({ cls: "vt-muted lab-kit-block-missing", text: folderMissingText(path) });
    return false;
  }

  private link(parent: HTMLElement, path: string, text: string, cls = ""): HTMLElement {
    const a = parent.createEl("a", { text, cls: `internal-link ${cls}`.trim(), attr: { href: path, "data-href": path } });
    a.addEventListener("click", e => { e.preventDefault(); void this.app.workspace.openLinkText(path, this.sourcePath, Keymap.isModEvent(e)); });
    return a;
  }

  private list(box: HTMLElement, lines: ListLine[], empty = "Nothing here."): void {
    if (!lines.length) { box.createDiv({ cls: "vt-muted", text: empty }); return; }
    const ul = box.createEl("ul");
    for (const l of lines) {
      const li = ul.createEl("li");
      this.link(li, l.path, l.text);
      for (const b of l.badges) { li.appendText(" "); li.createSpan({ cls: b.cls, text: b.text }); }
    }
  }

  private card(box: HTMLElement): void {
    const kit = this.owner.kit(), f = kit.planningFolders, o = blockOptions(this.source);
    switch (o.show) {
      case "this-week":
        if (this.need(box, todoFolder(f))) this.list(box, thisWeek(this.owner.notesIn(todoFolder(f)), new Date()).slice(0, o.limit ?? TILE_ROWS), "Nothing planned this week.");
        return;
      case "inbox": {
        if (!this.need(box, f.inbox)) return;
        const n = this.owner.notesIn(f.inbox).length;
        box.createDiv({ cls: "vt-muted", text: n ? `Inbox: ${n} to sort` : "Inbox: empty" });
        if (n) box.createEl("button", { text: "Sort inbox" }).addEventListener("click", () => {
          const c = this.owner.commands();
          if (c) void c.sortInbox(); else new Notice("Install the planning kit first, then try again.");
        });
        return;
      }
      case "experiments": {
        const lab = kitJoin(kit.labFolder.trim());
        if (!lab) { box.createDiv({ cls: "vt-muted", text: "Set the Lab notes folder in Settings → Lab Kit." }); return; }
        if (this.need(box, lab)) this.list(box, experiments(this.owner.notesIn(lab), o.limit ?? TILE_ROWS), "No experiments on the go.");
        return;
      }
      case "projects":
        if (this.need(box, f.projects)) this.list(box, projects(this.owner.notesIn(f.projects), o.limit ?? TILE_ROWS, kit.dueCountdown), "No projects yet.");
        return;
      case "recently-read":
        // Literature is only made with ZotLit: without it, an absent folder is normal
        if (!this.app.vault.getFolderByPath(f.literature) && !loadedPlugins(this.app).has("zotlit")) { box.createDiv({ cls: "vt-muted", text: "No literature notes yet." }); return; }
        if (this.need(box, f.literature)) this.list(box, recentlyRead(this.owner.notesIn(f.literature), o.limit ?? 5), "No literature notes yet.");
        return;
      case "deadline": {   // on a project hub: this project's deadline countdown
        const b = deadlineBadge((this.app.metadataCache.getCache(this.sourcePath)?.frontmatter ?? {}), kit.dueCountdown, new Date());
        if (b) box.createSpan({ cls: b.cls, text: b.text });
        else box.createDiv({ cls: "vt-muted", text: kit.dueCountdown === "off" ? "Deadline countdown is off (Settings → Lab Kit)." : "No deadline set." });
        return;
      }
      case "meeting-cards": {   // the Meetings hub: one card per series
        if (!this.need(box, f.meetings)) return;
        const today = new Date(), all = this.owner.commands()?.seriesList() ?? [];
        const next = nextMeetings(all, today).slice(0, o.limit ?? TILE_ROWS);
        if (!next.length) { box.createDiv({ cls: "vt-muted", text: "No meeting series yet - press New meeting series." }); return; }
        const grid = box.createDiv({ cls: "vt-cards" });
        for (const n of next) {
          const series = all.find(s => s.path === n.path);
          const card = grid.createDiv({ cls: "vt-card" });
          const head = card.createDiv({ cls: "vt-card-head" });
          this.link(head, n.path, n.name, "vt-card-title");
          if (ymd(n.date) === ymd(today)) head.createSpan({ cls: "vt-badge vt-today", text: "today" });
          card.createDiv({ cls: "vt-card-goal", text: `Next: ${WEEKDAYS[n.date.getDay()]} ${dayMonth(n.date)} · ${n.interval}` });
          const held = series ? this.owner.notesIn(series.folder).filter(x => x.path !== series.path).length : 0;
          card.createDiv({ cls: "vt-muted", text: `${held} meeting ${held === 1 ? "note" : "notes"}` });
          const actions = card.createDiv({ cls: "vt-card-actions" });
          actions.createEl("button", { text: "New meeting note" }).addEventListener("click", () => {
            const c = this.owner.commands();
            if (c && series) void c.newMeeting(series); else new Notice("Install the planning kit first, then try again.");
          });
          actions.createEl("button", { text: "Open" }).addEventListener("click", () => void this.app.workspace.openLinkText(n.path, this.sourcePath));
        }
        return;
      }
      case "next-meetings": {
        if (!this.need(box, f.meetings)) return;
        const today = new Date();
        this.list(box, nextMeetingLines(nextMeetings(this.owner.commands()?.seriesList() ?? [], today), today).slice(0, o.limit ?? TILE_ROWS), "No meeting series yet.");
        return;
      }
      default:
        box.createDiv({ cls: "vt-muted", text: `Unknown card "${o.show}". Use show: this-week, inbox, experiments, projects, recently-read, deadline, meeting-cards or next-meetings.` });
    }
  }

  private goto(box: HTMLElement): void {
    const o = blockOptions(this.source);
    const top = this.app.vault.getRoot().children.filter((c): c is TFolder => c instanceof TFolder && !c.name.startsWith("."));
    const files = top.flatMap(folder => folder.children.filter((c): c is TFile => c instanceof TFile && (c.extension === "md" || c.extension === "base")))
      .map(f => this.owner.rec(f));
    const links: GotoLink[] = withExtras(gotoTargets(top.map(t => t.path), files, o.hide), o.extra.map(e => this.extra(e)).filter((l): l is GotoLink => !!l));
    const row = box.createDiv({ cls: "lab-kit-goto" });
    for (const l of links) {
      const b = row.createEl("button", { cls: "lab-kit-goto-button" });
      if (l.icon) setIcon(b.createSpan({ cls: "lab-kit-goto-icon" }), l.icon);
      b.createSpan({ text: l.text });
      b.addEventListener("click", e => {
        if (l.command) { if (!runCommand(this.app, l.command)) new Notice(`Command not found: ${l.command}`); return; }
        if (l.path) void this.app.workspace.openLinkText(l.path, this.sourcePath, Keymap.isModEvent(e));
      });
    }
  }

  /** An `extra:` line: `Label | target`, `Label | target | icon` or `target`. A target like `plugin-id:command` is a command, else a note or base (by link name or path). */
  private extra(line: string): GotoLink | null {
    const [a, b, icon] = line.split("|").map(s => s.trim());
    const target = b ?? a, label = b ? a : unnumbered(target.replace(/\.(md|base)$/, "").split("/").pop() ?? target);
    if (/^[\w-]+:[\w-]+$/.test(target)) return { text: label, command: target, icon: icon || "terminal" };
    const file = this.app.metadataCache.getFirstLinkpathDest(target, this.sourcePath);
    return file ? { text: label, path: file.path, icon: icon || "file-text" } : null;
  }

  private async projects(box: HTMLElement): Promise<void> {
    const kit = this.owner.kit(), f = kit.planningFolders;
    if (!this.need(box, f.projects)) return;
    const inProjects = this.owner.notesIn(f.projects);
    const hubs = inProjects.filter(n => n.fm.kind === "project");
    const goals: Record<string, string> = {};
    for (const h of hubs) {
      const file = this.app.vault.getFileByPath(h.path);
      if (file) goals[h.path] = goalOf(await this.app.vault.cachedRead(file));
    }
    const cards = projectCards(hubs, this.owner.notesIn(todoFolder(f)), this.owner.notesIn(f.literature), inProjects, goals, new Date(), kit.dueCountdown);
    const grid = box.createDiv({ cls: "vt-cards" });
    if (!cards.length) grid.createDiv({ cls: "vt-muted", text: "No projects yet - press New project." });
    const commands = (): PlanningCommands | null => {
      const c = this.owner.commands();
      if (!c) new Notice("Install the planning kit first, then try again.");
      return c;
    };
    for (const c of cards) {
      const card = grid.createDiv({ cls: "vt-card" });
      const head = card.createDiv({ cls: "vt-card-head" });
      this.link(head, c.hub.path, c.hub.text, "vt-card-title");
      for (const b of c.hub.badges) head.createSpan({ cls: b.cls, text: b.text });
      card.createDiv({ cls: "vt-card-goal", text: c.goal || "No goal written yet" });
      const ul = card.createEl("ul");
      if (!c.todos.length) ul.createEl("li", { cls: "vt-muted", text: "No open to-dos" });
      for (const t of c.todos) {
        const li = ul.createEl("li");
        this.link(li, t.path, t.text);
        for (const b of t.badges) { li.appendText(" "); li.createSpan({ cls: b.cls, text: b.text }); }
      }
      if (c.more) ul.createEl("li", { cls: "vt-muted", text: `+ ${c.more} more on the hub` });
      card.createDiv({ cls: "vt-muted", text: `${c.open} open to-dos · ${c.papers} papers · ${c.notes} notes` });
      const actions = card.createDiv({ cls: "vt-card-actions" });
      const name = c.hub.text, folder = c.folder;
      actions.createEl("button", { text: "New note" }).addEventListener("click", () => void commands()?.newProjectNote(folder));
      actions.createEl("button", { text: "New to-do" }).addEventListener("click", () => void commands()?.newTodo(name));
      actions.createEl("button", { text: "Open" }).addEventListener("click", () => void this.app.workspace.openLinkText(c.hub.path, this.sourcePath));
    }
  }
}
