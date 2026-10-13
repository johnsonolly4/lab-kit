// Homepage blocks (Phase 5a): ```vault-card, ```vault-goto and ```vault-projects, drawn by the plugin from Obsidian's metadata cache
// (no Dataview). Rules: src/planning/lists.ts. Plan: docs/plans/phase-5-homepage-meetings.md.
import { Keymap, MarkdownRenderChild, Notice, TFile, TFolder, debounce, setIcon, type App, type Plugin } from "obsidian";
import { folderMissingText } from "../kit/folder-guard";
import { runCommand, loadedPlugins } from "../kit/obsidian-private";
import { PLANNING_KIT, kitJoin, todoFolder, type KitData } from "../kit/paths";
import type { PlanningCommands } from "./commands";
import { ymd } from "./todo";
import { ONCE, WEEKDAYS, nextMeetingLines, nextMeetings } from "./meetings";
import { hasPlan, planLines, projectExperiments, readPlan } from "./plan";
import { layoutPlan, type Direction } from "./plan-map";
import { drawPlanMap } from "./plan-map-render";
import { DEFAULT_AHEAD, PlanSlideModal, type SlideChoice } from "./plan-slide-ui";
import { hasNode } from "../platform";
import { blockOptions, experiments, folderHub, meetingDone, meetingExperiments, meetingPapers, meetingWindow, topicIndex, gotoTargets, goalOf, inFolder, parentHub, deadlineBadge, dayMonth, projectCards, projectMeetings, projectNotes, projectTodos, PROJECT_MEETINGS, PROJECT_STATUSES, PROJECT_TILE_ROWS, projects, recentlyRead, thisWeek, TILE_ROWS, unnumbered, withExtras, type GotoLink, type ListLine, type NoteRec } from "./lists";

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
  private expanded = new Set<string>();   // plan map parents whose subtask list is open
  private mapScroll: { left: number; top: number } | null = null;   // where the user scrolled the plan map, null = not by hand
  private direction: Direction | null = null;   // the toggle on the plan map: null = the setting
  private slideChoice: SlideChoice = { whole: false, ahead: DEFAULT_AHEAD };   // the slide picture window's choices, for this session
  private noteText = "";   // the hub text, read for the Plan tile (does the hub also hold the map?)
  private showAll = false;   // a project hub list (meetings: last 8; to-dos and notes: 10) or all of it

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
    else {
      if (blockOptions(this.source).show === "project-plan") {
        const file = this.app.vault.getFileByPath(this.sourcePath);
        this.noteText = file ? await this.app.vault.cachedRead(file) : "";
      }
      this.card(box);
    }
    if (run !== this.drawing) return;
    this.containerEl.empty();
    this.containerEl.appendChild(box);
    const scroller = box.querySelector<HTMLElement>(".vt-map-scroll");
    if (scroller) this.placeMap(scroller);
  }

  /** The folder `path` exists; else a line saying it is missing (moved outside Obsidian?) in `box`. */
  private commands(): PlanningCommands | null {
    const c = this.owner.commands();
    if (!c) new Notice("Install the planning kit first, then try again.");
    return c;
  }

  /** Show all / Show the last N at a tile's top right. Live Preview opens a code block for editing on a click inside it: the events stop here. */
  private toggle(box: HTMLElement, text: string): void {
    const b = box.createEl("button", { cls: "vt-tile-toggle", text });
    const stop = (e: Event): void => { e.stopPropagation(); e.preventDefault(); };
    b.addEventListener("mousedown", stop);
    b.addEventListener("click", e => { stop(e); this.showAll = !this.showAll; this.draw(); });
  }

  /** A tile's rows: the first `cap`, with Show all N / Show the last N at the tile's top right when there are more. */
  private capped(box: HTMLElement, all: ListLine[], cap: number, empty: string): void {
    if (all.length > cap) this.toggle(box, this.showAll ? `Show the last ${cap}` : `Show all ${all.length}`);
    this.list(box, this.showAll ? all : all.slice(0, cap), empty);
  }

  /** On a meeting note: the since / date window of the note itself; a line in `box` when it has none. */
  private window(box: HTMLElement): { since: string; date: string } | null {
    const w = meetingWindow(this.app.metadataCache.getCache(this.sourcePath)?.frontmatter ?? {});
    if (!w) box.createDiv({ cls: "vt-muted", text: "This note has no since and date properties." });
    return w;
  }

  /** Puts the map where the user left it, else at the start step. Obsidian lays the note out a little after the block is added, so the position is set again on each resize for a moment; only a scroll after that counts as the user's. */
  private placeMap(scroller: HTMLElement): void {
    const target = this.mapScroll ?? { left: Number(scroller.dataset.startScroll ?? 0), top: Number(scroller.dataset.startScrollTop ?? 0) };
    let placing = true;
    scroller.addEventListener("scroll", () => { if (!placing) this.mapScroll = { left: scroller.scrollLeft, top: scroller.scrollTop }; });
    const apply = (): void => { scroller.scrollLeft = target.left; scroller.scrollTop = target.top; };
    apply();
    const watch = new ResizeObserver(() => { if (placing) apply(); });
    watch.observe(scroller);
    for (const child of Array.from(scroller.children)) watch.observe(child);
    window.setTimeout(() => { placing = false; watch.disconnect(); }, 800);
  }

  /** The lab notes, for a to-do's `experiment` link; none when the lab folder is not set (nothing is then looked up). */
  private labNotes(): NoteRec[] | undefined {
    const lab = this.owner.kit().labFolder.trim();
    return lab ? this.owner.notesIn(kitJoin(lab)) : undefined;
  }

  /** The note this block is in also has a `project-map` block (an old hub that was never tidied does not: it keeps its list). */
  private hubHasMap(): boolean {
    return /^show:\s*project-map\s*$/m.test(this.noteText);
  }

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
        if (this.need(box, todoFolder(f))) this.capped(box, thisWeek(this.owner.notesIn(todoFolder(f)), new Date()), o.limit ?? TILE_ROWS, "Nothing planned this week.");
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
        if (this.need(box, lab)) this.capped(box, experiments(this.owner.notesIn(lab), Infinity), o.limit ?? TILE_ROWS, "No experiments on the go.");
        return;
      }
      case "meeting-experiments": {   // on a meeting note: lab notes changed since the last meeting
        const lab = kitJoin(kit.labFolder.trim()), w = this.window(box);
        if (!w) return;
        if (!lab) { box.createDiv({ cls: "vt-muted", text: "Set the Lab notes folder in Settings → Lab Kit." }); return; }
        if (this.need(box, lab)) this.capped(box, meetingExperiments(this.owner.notesIn(lab), w), o.limit ?? PROJECT_TILE_ROWS, "No experiments changed since the last meeting.");
        return;
      }
      case "meeting-done": {   // on a meeting note: to-dos finished since the last meeting
        const w = this.window(box);
        if (w && this.need(box, todoFolder(f))) this.capped(box, meetingDone(this.owner.notesIn(todoFolder(f)), w), o.limit ?? PROJECT_TILE_ROWS, "No to-dos finished since the last meeting.");
        return;
      }
      case "meeting-papers": {   // on a meeting note: papers imported since the last meeting
        const w = this.window(box);
        if (!w) return;
        if (!this.app.vault.getFolderByPath(f.literature) && !loadedPlugins(this.app).has("zotlit")) { box.createDiv({ cls: "vt-muted", text: "No literature notes yet." }); return; }
        if (this.need(box, f.literature)) this.capped(box, meetingPapers(this.owner.notesIn(f.literature), w), o.limit ?? PROJECT_TILE_ROWS, "No papers read since the last meeting.");
        return;
      }
      case "projects":
        if (this.need(box, f.projects)) this.capped(box, projects(this.owner.notesIn(f.projects), Infinity, kit.dueCountdown), o.limit ?? TILE_ROWS, "No projects yet.");
        return;
      case "recently-read":
        // Literature is only made with ZotLit: without it, an absent folder is normal
        if (!this.app.vault.getFolderByPath(f.literature) && !loadedPlugins(this.app).has("zotlit")) { box.createDiv({ cls: "vt-muted", text: "No literature notes yet." }); return; }
        if (this.need(box, f.literature)) this.capped(box, recentlyRead(this.owner.notesIn(f.literature), Infinity), o.limit ?? 5, "No literature notes yet.");
        return;
      case "deadline": {   // on a project hub: this project's deadline countdown
        const b = deadlineBadge((this.app.metadataCache.getCache(this.sourcePath)?.frontmatter ?? {}), kit.dueCountdown, new Date());
        if (b) box.createSpan({ cls: b.cls, text: b.text });
        else box.createDiv({ cls: "vt-muted", text: kit.dueCountdown === "off" ? "Deadline countdown is off (Settings → Lab Kit)." : "No deadline set." });
        return;
      }
      case "project-meetings": {   // on a project hub: meeting notes that name this project
        const hubFile = this.app.vault.getFileByPath(this.sourcePath);
        if (!hubFile) return;
        const hub = this.owner.rec(hubFile);
        const all = projectMeetings(this.owner.notesIn(f.meetings), hub);
        if (!all.length) { box.createDiv({ cls: "vt-muted", text: "No meetings name this project yet. Set project on a meeting note." }); return; }
        this.list(box, this.showAll ? all : all.slice(0, PROJECT_MEETINGS));
        if (all.length > PROJECT_MEETINGS) {
          this.toggle(box, this.showAll ? "Show the last " + PROJECT_MEETINGS : `Show all ${all.length}`);
        }
        return;
      }
      case "project-experiments": {   // on a project hub: the lab notes its to-dos name in `experiment`, with their Status
        const hubFile = this.app.vault.getFileByPath(this.sourcePath);
        if (!hubFile || !this.need(box, todoFolder(f))) return;
        const labNotes = this.labNotes();
        if (!labNotes) { box.createDiv({ cls: "vt-muted", text: "Set the Lab folder in Settings → Lab Kit to list experiments." }); return; }
        this.capped(box, projectExperiments(readPlan(this.owner.notesIn(todoFolder(f)), this.owner.rec(hubFile), labNotes)), PROJECT_TILE_ROWS, "No experiments yet: set experiment on a to-do of this project.");
        return;
      }
      case "project-actions": {   // on a project hub: New to-do / New note in one row, like the Projects overview card
        const hubFile = this.app.vault.getFileByPath(this.sourcePath);
        if (!hubFile) return;
        const actions = box.createDiv({ cls: "vt-card-actions" });
        actions.createEl("button", { text: "New to-do" }).addEventListener("click", () => void this.commands()?.newTodo(hubFile.basename));
        actions.createEl("button", { text: "New note" }).addEventListener("click", () => void this.commands()?.newProjectNote(hubFile.parent?.path));
        return;
      }
      case "back-to-hub": {   // on a project, topic or series hub: a link to the hub one folder up, found by folder so a rename cannot break it
        const up = parentHub(this.app.vault.getMarkdownFiles().map(x => this.owner.rec(x)), this.sourcePath);
        if (up) this.link(box, up.path, `\u2190 ${up.name}`, "vt-back");
        else box.createDiv({ cls: "vt-muted", text: "No hub one folder up." });
        return;
      }
      case "topic-actions": {   // on a topic hub: New concept in this topic's folder, without asking the topic
        const hubFile = this.app.vault.getFileByPath(this.sourcePath);
        if (!hubFile) return;
        const actions = box.createDiv({ cls: "vt-card-actions" });
        actions.createEl("button", { text: "New concept" }).addEventListener("click", () => void this.commands()?.newConcept(hubFile.parent?.path));
        return;
      }
      case "series-actions": {   // on a meeting series hub: New meeting note and Extra meeting now for this series
        const series = this.owner.commands()?.seriesList().find(x => x.path === this.sourcePath);
        if (!series) { box.createDiv({ cls: "vt-muted", text: "This note is not a meeting series hub." }); return; }
        const actions = box.createDiv({ cls: "vt-card-actions" });
        actions.createEl("button", { text: "Extra meeting now" }).addEventListener("click", () => void this.commands()?.newMeeting(series, true));
        return;
      }
      case "topic-index": {   // the Knowledge index: every topic with its notes, empty topics included
        if (!this.need(box, f.knowledge)) return;
        const topics = topicIndex(this.owner.notesIn(f.knowledge), f.knowledge);
        if (!topics.length) { box.createDiv({ cls: "vt-muted", text: "No topics yet: press New topic hub." }); return; }
        const ul = box.createEl("ul");
        for (const t of topics) {
          const li = ul.createEl("li");
          this.link(li, t.hub.path, t.hub.text);
          if (t.notes.length) this.list(li, t.notes);
          else li.createSpan({ cls: "vt-muted", text: " (no notes yet)" });
        }
        return;
      }
      case "hub-bar": this.hubBar(box); return;
      case "meeting-bar": this.meetingBar(box); return;
      case "back-to-project": {   // on a note inside a project's folder: a link to that project's hub
        const up = folderHub(this.app.vault.getMarkdownFiles().map(x => this.owner.rec(x)), this.sourcePath);
        if (up) this.link(box, up.path, `\u2190 ${up.name}`, "vt-back");
        else box.createDiv({ cls: "vt-muted", text: "No project hub found for this note." });
        return;
      }
      case "project-todos":   // on a project hub: its open to-dos, 10 rows with Show all
      case "project-notes": {   // on a project hub: the other notes in its folder, 10 rows with Show all
        const hubFile = this.app.vault.getFileByPath(this.sourcePath);
        if (!hubFile) return;
        const hub = this.owner.rec(hubFile);
        const todos = o.show === "project-todos";
        const folder = todos ? todoFolder(f) : f.projects;
        if (!this.need(box, folder)) return;
        const all = todos ? projectTodos(this.owner.notesIn(folder), hub, new Date()) : projectNotes(this.owner.notesIn(folder), hub);
        if (all.length > PROJECT_TILE_ROWS) {   // at the callout's top right (styles in vault-theme.css)
          this.toggle(box, this.showAll ? `Show the last ${PROJECT_TILE_ROWS}` : `Show all ${all.length}`);
        }
        this.list(box, this.showAll ? all : all.slice(0, PROJECT_TILE_ROWS), todos ? "No open to-dos for this project." : "No notes in this project yet.");
        return;
      }
      case "project-plan": {   // on a project hub: next steps, then blocked ones, finished ones behind Show all; nothing when the project has no plan
        const hubFile = this.app.vault.getFileByPath(this.sourcePath);
        if (!hubFile || !this.app.vault.getFolderByPath(todoFolder(f))) return;
        const plan = readPlan(this.owner.notesIn(todoFolder(f)), this.owner.rec(hubFile), this.labNotes());
        if (!hasPlan(plan)) return;
        if (kit.planView === "map" && this.hubHasMap()) return;   // the map replaces the list (Settings → Lab Kit → Project plan view)
        const { lines, finished } = planLines(plan);
        const open = lines.slice(0, lines.length - finished), shown = this.showAll ? lines : open.slice(0, PROJECT_TILE_ROWS);
        box.addClass("vt-plan");
        if (finished || open.length > PROJECT_TILE_ROWS) this.toggle(box, this.showAll ? "Hide finished" : `Show all ${lines.length}`);
        box.createDiv({ cls: "vt-plan-title", text: "Plan" });
        this.list(box, shown, "Nothing left to do in this plan.");
        for (const p of plan.problems) box.createDiv({ cls: "vt-muted", text: p });
        return;
      }
      case "project-map": {   // on a project hub: the plan as cards joined by arrows; nothing when the project has no plan
        const hubFile = this.app.vault.getFileByPath(this.sourcePath);
        if (!hubFile || !this.app.vault.getFolderByPath(todoFolder(f))) return;
        const plan = readPlan(this.owner.notesIn(todoFolder(f)), this.owner.rec(hubFile), this.labNotes());
        if (!hasPlan(plan)) return;
        box.addClass("vt-plan");
        const direction = this.direction ?? kit.planDirection;
        const title = box.createDiv({ cls: "vt-plan-title", text: "Plan" });
        const flip = title.createEl("button", { cls: "vt-map-dir", text: direction === "down" ? "\u21c5" : "\u21c4", attr: { "aria-label": "Flip the map direction", title: direction === "down" ? "Top to bottom: click for left to right" : "Left to right: click for top to bottom" } });
        const stop = (e: Event): void => { e.stopPropagation(); e.preventDefault(); };
        flip.addEventListener("mousedown", stop);
        flip.addEventListener("click", e => { stop(e); this.direction = direction === "down" ? "across" : "down"; this.mapScroll = null; this.draw(); });
        const map = layoutPlan(plan);
        if (hasNode()) {   // the picture for a slide is a PNG on the clipboard: desktop only
          const shot = title.createEl("button", { cls: "vt-map-dir vt-map-slide", attr: { "aria-label": "Picture for a slide", title: "Copy a picture of the plan for a slide" } });
          setIcon(shot, "image");
          shot.addEventListener("mousedown", stop);
          shot.addEventListener("click", e => { stop(e); new PlanSlideModal(this.app, map, this.sourcePath.replace(/^.*\//, "").replace(/\.md$/, ""), this.slideChoice).open(); });
        }
        drawPlanMap(box, plan, map, { app: this.app, sourcePath: this.sourcePath, expanded: this.expanded, direction, redraw: () => this.draw() });
        for (const p of plan.problems) box.createDiv({ cls: "vt-muted", text: p });
        return;
      }
      case "meeting-cards": {   // the Meetings hub: one card per series
        if (!this.need(box, f.meetings)) return;
        const today = new Date(), all = this.owner.commands()?.seriesList() ?? [];
        const next = nextMeetings(all, today).slice(0, o.limit ?? TILE_ROWS);
        const once = all.filter(s => s.interval === ONCE);
        if (!next.length && !once.length) { box.createDiv({ cls: "vt-muted", text: "No meeting series yet - press New meeting series." }); return; }
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
          actions.createEl("button", { text: "Extra meeting now" }).addEventListener("click", () => {
            const c = this.owner.commands();
            if (c && series) void c.newMeeting(series, true); else new Notice("Install the planning kit first, then try again.");
          });
          actions.createEl("button", { text: "Open" }).addEventListener("click", () => void this.app.workspace.openLinkText(n.path, this.sourcePath));
        }
        for (const s of once) {   // the One-off hub: no schedule, a button for a new one-off meeting
          const card = grid.createDiv({ cls: "vt-card" });
          this.link(card.createDiv({ cls: "vt-card-head" }), s.path, s.name, "vt-card-title");
          card.createDiv({ cls: "vt-card-goal", text: "Meetings that belong to no series" });
          const held = this.owner.notesIn(s.folder).filter(x => x.path !== s.path).length;
          card.createDiv({ cls: "vt-muted", text: `${held} meeting ${held === 1 ? "note" : "notes"}` });
          const actions = card.createDiv({ cls: "vt-card-actions" });
          actions.createEl("button", { text: "New one-off meeting" }).addEventListener("click", () => {
            const c = this.owner.commands();
            if (c) void c.newOneOff(); else new Notice("Install the planning kit first, then try again.");
          });
          actions.createEl("button", { text: "Open" }).addEventListener("click", () => void this.app.workspace.openLinkText(s.path, this.sourcePath));
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
        box.createDiv({ cls: "vt-muted", text: `Unknown card "${o.show}". Use show: this-week, inbox, experiments, projects, recently-read, meeting-experiments, meeting-done, meeting-papers, deadline, topic-index, hub-bar, meeting-bar, back-to-project, project-meetings, project-experiments, project-plan, project-map, project-todos, project-notes, project-actions, back-to-hub, topic-actions, series-actions, meeting-cards or next-meetings.` });
    }
  }

  /** The top row of a hub: the link to the hub one folder up and that kind of hub's buttons, on one line. */
  private hubBar(box: HTMLElement): void {
    const file = this.app.vault.getFileByPath(this.sourcePath);
    if (!file) return;
    const kind = this.owner.rec(file).fm.kind;
    const bar = box.createDiv({ cls: "vt-hub-bar" });
    const up = parentHub(this.app.vault.getMarkdownFiles().map(x => this.owner.rec(x)), this.sourcePath);
    if (up) this.link(bar, up.path, `\u2190 ${up.name}`, "vt-back");
    const button = (text: string, run: (c: PlanningCommands) => void): void => {
      bar.createEl("button", { text }).addEventListener("click", () => { const c = this.commands(); if (c) run(c); });
    };
    if (kind === "project") {
      button("New to-do", c => void c.newTodo(file.basename)); button("New note", c => void c.newProjectNote(file.parent?.path));
      this.statusSelect(bar, file);
      this.deadlineInput(bar, file);
      const badge = deadlineBadge(this.owner.rec(file).fm, this.owner.kit().dueCountdown, new Date());   // none once the project is Done
      if (badge) bar.createSpan({ cls: badge.cls, text: badge.text });
    }
    else if (kind === "hub") button("New concept", c => void c.newConcept(file.parent?.path));
    else if (kind === "meeting-series") {
      const series = this.owner.commands()?.seriesList().find(x => x.path === this.sourcePath);
      if (!series) { box.createDiv({ cls: "vt-muted", text: "This series has a wrong property: Check setup names it." }); return; }
      button("Meeting deck", c => void c.openDeck(series));
      if (series.interval === ONCE) button("New one-off meeting", c => void c.newOneOff());
      else { button("New meeting note", c => void c.newMeeting(series)); button("Extra meeting now", c => void c.newMeeting(series, true)); }
    } else box.createDiv({ cls: "vt-muted", text: "hub-bar belongs on a project, topic or meeting series hub." });
  }

  /** A drop-down for a project's Status (no label), written to the note's properties. Live Preview opens a code block for editing on a click inside it: the events stop here. */
  private statusSelect(bar: HTMLElement, file: TFile): void {
    const status = this.owner.rec(file).fm.Status, now = typeof status === "string" ? status : "";
    const select = bar.createEl("select", { cls: "vt-status-select dropdown", attr: { "aria-label": "Status" } });
    for (const s of PROJECT_STATUSES.includes(now) || !now ? PROJECT_STATUSES : [...PROJECT_STATUSES, now]) select.createEl("option", { text: s, value: s });
    select.value = now || PROJECT_STATUSES[0];
    for (const ev of ["mousedown", "click"]) select.addEventListener(ev, e => e.stopPropagation());
    select.addEventListener("change", () => {
      void this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => { fm.Status = select.value; })
        .then(() => this.draw(), e => { console.error(e); new Notice("Could not change the status."); });
    });
  }

  /** The project's `deadline` date, a date box in the bar (emptying it clears the date). */
  private deadlineInput(bar: HTMLElement, file: TFile): void {
    const deadline = this.owner.rec(file).fm.deadline;
    const input = bar.createEl("input", { cls: "vt-deadline-input", type: "date", attr: { "aria-label": "Deadline" } });
    input.value = typeof deadline === "string" ? deadline.slice(0, 10) : "";
    for (const ev of ["mousedown", "click"]) input.addEventListener(ev, e => e.stopPropagation());
    input.addEventListener("change", () => {
      void this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => { fm.deadline = input.value; })
        .then(() => this.draw(), e => { console.error(e); new Notice("Could not change the deadline."); });
    });
  }

  /** The top row of a meeting note: the link to its series hub (the One-off hub for a one-off) and Meeting deck for that series. */
  private meetingBar(box: HTMLElement): void {
    const bar = box.createDiv({ cls: "vt-hub-bar" });
    const up = folderHub(this.app.vault.getMarkdownFiles().map(x => this.owner.rec(x)), this.sourcePath);
    if (up) this.link(bar, up.path, `\u2190 ${up.name}`, "vt-back");
    bar.createEl("button", { text: "Meeting deck" }).addEventListener("click", () => void this.commands()?.openDeck());
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
      const chips = head.createDiv({ cls: "vt-card-chips" });
      for (const b of c.hub.badges) chips.createSpan({ cls: b.cls, text: b.text });
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
