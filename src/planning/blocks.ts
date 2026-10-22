// Homepage blocks (Phase 5a): ```vault-card, ```vault-goto and ```vault-projects, drawn by the plugin from Obsidian's metadata cache
// (no Dataview). Rules: src/planning/lists.ts. Plan: docs/plans/phase-5-homepage-meetings.md.
import { Keymap, MarkdownRenderChild, Notice, TFile, TFolder, debounce, setIcon, type App, type Plugin } from "obsidian";
import { folderMissingText } from "../kit/folder-guard";
import { runCommand, commandInfo } from "../kit/obsidian-private";
import { PLANNING_KIT, kitJoin, todoFolder, type KitData } from "../kit/paths";
import type { PlanningCommands } from "./commands";
import { ymd } from "./todo";
import { ONCE, WEEKDAYS, firstSeries, nextMeetingLines, nextMeetings } from "./meetings";
import { hasPlan, planLines, projectExperiments, readPlan } from "./plan";
import { ZOOM_STEP, clampZoom, fitZoom, layoutPlan, type Direction, type PlaceMemory } from "./plan-map";
import { drawPlanMap, drawProblems } from "./plan-map-render";
import { addAfterFlow, insertAfterFlow, insertBeforeFlow } from "./add-after";
import { applyProjectValue, projectBarFields, projectBarValues } from "./project-bar";
import { applyReplace, parseAlignEnd, parseIds, resolveBar, type BarButton } from "./button-bar";
import { chipView, visibleFields, type EntryField, type EntryValue } from "./entry-fields";
import { editEntryField } from "./entry-window";
import { applyTodoValue, experimentOptions, projectNames, todoFields, todoValues } from "./todo-bar";
import { PlanHistory } from "./plan-history";
import { tickButton } from "./undo-notice";
import { runHistory } from "./after-write";
import { DEFAULT_AHEAD, PlanSlideModal, copyPng, type SlideChoice } from "./plan-slide-ui";
import { pictureFor } from "./plan-slide";
import { hasNode } from "../platform";
import { flaggedLines, FLAGGED_EMPTY, RAISED } from "./freeze";
import { blockOptions, linkTarget, pictureHub, experiments, folderHub, meetingDone, meetingExperiments, meetingWindow, topicIndex, gotoTargets, goalOf, inFolder, parentHub, deadlineBadge, dayMonth, projectCards, projectMeetings, projectNotes, projectTodos, noNextStep, NO_NEXT_STEP, waitingOn, PROJECT_MEETINGS, PROJECT_TILE_ROWS, projects, thisWeek, TILE_ROWS, unnumbered, withExtras, type GotoLink, type ListLine, type NoteRec } from "./lists";

const LANGS = ["vault-card", "vault-goto", "vault-projects"] as const;
type Lang = (typeof LANGS)[number];

/** Draws the blocks and redraws the open ones when notes change. Registered at load; shows a line instead while the planning kit is off. */
export class PlanningBlocks {
  private views = new Set<BlockView>();
  private histories = new Map<string, PlanHistory>();   // each project hub's plan map Undo / Redo steps, until Obsidian closes

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
  historyFor(path: string): PlanHistory { let h = this.histories.get(path); if (!h) { h = new PlanHistory(); this.histories.set(path, h); } return h; }

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
  private chipBusy = false;   // the to-do chip bar has a list open
  private drawing = 0;
  private collapsed = new Set<string>();   // plan map parents whose subtask list was closed (every list starts open)
  private mapScroll: { left: number; top: number } | null = null;   // where the user scrolled the plan map, null = not by hand
  private direction: Direction | null = null;   // the toggle on the plan map: null = the setting
  private slideChoice: SlideChoice = { whole: false, ahead: DEFAULT_AHEAD };   // the slide picture window's choices, for this session
  private places: PlaceMemory = new Map();   // where the plan map's cards were last drawn: new links do not shuffle them (lost when the note is closed)
  private problemsOpen = false;   // the plan map's problems list: hidden until opened
  private zoom = 1;   // the plan map's zoom buttons; not saved
  private noteText = "";   // the hub text, read for the Plan tile (does the hub also hold the map?)
  private showAll = false;   // a project hub list (meetings: last 8; to-dos and notes: 10) or all of it
  private pictureUrl = "";   // the plan-picture block's blob URL on screen: revoked on redraw and unload
  private newUrl = "";   // the one the draw being built made

  constructor(el: HTMLElement, private owner: PlanningBlocks, private lang: Lang, private source: string, private sourcePath: string) { super(el); }

  get app(): App { return this.owner.app; }

  onload(): void { this.owner.add(this); this.draw(); }
  onunload(): void { this.owner.remove(this); this.swapUrl(""); }

  private swapUrl(url: string): void { if (this.pictureUrl) URL.revokeObjectURL(this.pictureUrl); this.pictureUrl = url; }

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
      this.newUrl = "";
      this.card(box);
    }
    const url = this.newUrl;
    this.newUrl = "";
    if (run !== this.drawing) { if (url) URL.revokeObjectURL(url); return; }
    this.swapUrl(url);
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
        if (w && this.need(box, todoFolder(f))) {
          const { lines, hidden } = meetingDone(this.owner.notesIn(todoFolder(f)), w);   // only to-dos with a priority: the small ones would crowd the meeting
          this.capped(box, lines, o.limit ?? PROJECT_TILE_ROWS, hidden ? "No prioritised to-dos finished since the last meeting." : "No to-dos finished since the last meeting.");
          if (hidden) box.createDiv({ cls: "vt-muted", text: `${hidden} finished ${hidden === 1 ? "to-do" : "to-dos"} without a priority ${hidden === 1 ? "isn't" : "aren't"} listed. Give a to-do a priority (1 to 3) to list it here.` });
        }
        return;
      }
      case "meeting-flagged": {   // on a meeting note: the open to-dos flagged for its series, with when each was first raised and an Unflag button
        const w = this.window(box);
        if (!w || !this.need(box, todoFolder(f))) return;
        const here = this.app.vault.getFileByPath(this.sourcePath), series = linkTarget(here ? this.owner.rec(here).fm.series : "");
        const hubFile = series ? this.app.metadataCache.getFirstLinkpathDest(series, this.sourcePath) : null;
        if (!hubFile) { box.createDiv({ cls: "vt-muted", text: "This note has no series link." }); return; }
        const hubs = this.app.vault.getMarkdownFiles().map(x => this.owner.rec(x)).filter(n => n.fm.kind === "meeting-series");
        const lines = flaggedLines(this.owner.notesIn(todoFolder(f)), this.owner.rec(hubFile), firstSeries(hubs)?.name === hubFile.basename, w.date);
        if (!lines.length) { box.createDiv({ cls: "vt-muted", text: FLAGGED_EMPTY }); return; }
        const ul = box.createEl("ul");
        for (const l of lines) {
          const li = ul.createEl("li");
          this.link(li, l.path, l.text);
          for (const b of l.badges) { li.appendText(" "); li.createSpan({ cls: b.cls, text: b.text }); }
          li.appendText(" ");
          li.createEl("button", { text: "Unflag", cls: "vt-unflag" }).addEventListener("click", () => {
            const todo = this.app.vault.getFileByPath(l.path);
            if (todo) void this.app.fileManager.processFrontMatter(todo, (fm: Record<string, unknown>) => { fm.meeting = null; delete fm[RAISED]; })
              .then(() => this.draw(), e => { console.error(e); new Notice("Could not unflag the to-do."); });
          });
        }
        return;
      }
      case "projects":
        if (this.need(box, f.projects)) this.capped(box, projects(this.owner.notesIn(f.projects), Infinity, kit.dueCountdown, new Date(), this.app.vault.getFolderByPath(todoFolder(f)) ? this.owner.notesIn(todoFolder(f)) : []), o.limit ?? TILE_ROWS, "No projects yet.");
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
      case "todo-bar": this.todoBar(box); return;
      case "hub-bar": this.hubBar(box); return;
      case "button-bar": this.buttonBar(box); return;
      case "meeting-bar": this.meetingBar(box); return;
      case "waiting": {   // open to-dos with `waiting` set, grouped by what they wait on; on a project hub only that project's
        if (!this.need(box, todoFolder(f))) return;
        const here = this.app.vault.getFileByPath(this.sourcePath), rec = here ? this.owner.rec(here) : null;
        const onHub = rec?.fm.kind === "project";
        const groups = waitingOn(this.owner.notesIn(todoFolder(f)), new Date(), onHub ? rec : undefined);
        if (!groups.length) { box.createDiv({ cls: "vt-muted", text: onHub ? "Nothing in this project is waiting." : "Nothing is waiting." }); return; }
        for (const g of groups) { box.createDiv({ cls: "vt-muted vt-waiting-who", text: g.who }); this.list(box, g.lines); }
        return;
      }
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
        if (this.hubHasMap()) return;   // the map replaces the list (a hub without the map block keeps the list)
        const { lines, finished } = planLines(plan);
        const open = lines.slice(0, lines.length - finished), shown = this.showAll ? lines : open.slice(0, PROJECT_TILE_ROWS);
        box.addClass("vt-plan");
        if (finished || open.length > PROJECT_TILE_ROWS) this.toggle(box, this.showAll ? "Hide finished" : `Show all ${lines.length}`);
        box.createDiv({ cls: "vt-plan-title", text: "Plan" });
        this.list(box, shown, "Nothing left to do in this plan.");
        for (const p of plan.problems) box.createDiv({ cls: "vt-muted", text: p });
        return;
      }
      case "project-map": {   // on a project hub: the plan as cards joined by arrows; with no to-dos, a box that makes one
        const hubFile = this.app.vault.getFileByPath(this.sourcePath);
        if (!hubFile || !this.app.vault.getFolderByPath(todoFolder(f))) return;
        const plan = readPlan(this.owner.notesIn(todoFolder(f)), this.owner.rec(hubFile), this.labNotes());
        box.addClass("vt-plan");
        const direction = this.direction ?? kit.planDirection;
        const title = box.createDiv({ cls: "vt-plan-title is-bar", text: "Plan" });
        const flip = title.createEl("button", { cls: "vt-map-dir", text: direction === "down" ? "\u21c5" : "\u21c4", attr: { "aria-label": "Flip the map direction", title: direction === "down" ? "Top to bottom: click for left to right" : "Left to right: click for top to bottom" } });
        const stop = (e: Event): void => { e.stopPropagation(); e.preventDefault(); };
        flip.addEventListener("mousedown", stop);
        flip.addEventListener("click", e => { stop(e); this.direction = direction === "down" ? "across" : "down"; this.mapScroll = null; this.draw(); });
        const map = layoutPlan(plan, this.places);
        this.places = new Map(map.cards.map(c => [c.path, { step: c.step, place: c.place }]));   // the next draw keeps the cards where they are
        const zoomBy = (label: string, text: string, tip: string, next: () => number): void => {
          const b = title.createEl("button", { cls: "vt-map-zoom", text, attr: { "aria-label": label, title: tip } });
          b.addEventListener("mousedown", stop);
          b.addEventListener("click", e => { stop(e); this.zoom = next(); this.mapScroll = null; this.draw(); });
        };
        zoomBy("Make the map smaller", "\u2212", "Smaller", () => clampZoom(this.zoom - ZOOM_STEP));
        zoomBy("Make the map larger", "+", "Larger", () => clampZoom(this.zoom + ZOOM_STEP));
        zoomBy("Fit the map to the width", "Fit", "Fit the map to the width", () => {
          const sc = box.querySelector<HTMLElement>(".vt-map-scroll");
          return sc ? fitZoom(sc.clientWidth, Number(sc.dataset.mapWidth ?? 0)) : 1;
        });
        const reset = title.createEl("button", { cls: "vt-map-zoom vt-map-slide", attr: { "aria-label": "Reset the map view", title: "Reset: zoom, direction and card positions back to the default" } });
        setIcon(reset, "rotate-ccw");
        reset.addEventListener("mousedown", stop);
        reset.addEventListener("click", e => { stop(e); this.zoom = 1; this.direction = null; this.places = new Map(); this.mapScroll = null; this.draw(); });
        const history = this.owner.historyFor(this.sourcePath);
        for (const side of ["undo", "redo"] as const) {   // the last 20 changes made on the map; the buttons follow the steps that are left
          const step = history.peek(side), what = side === "undo" ? "Undo" : "Redo";
          const btn = title.createEl("button", { cls: "vt-map-zoom vt-map-slide vt-map-history", attr: { "aria-label": step ? `${what}: ${step.label}` : `Nothing to ${what.toLowerCase()}` } });
          setIcon(btn, side === "undo" ? "undo-2" : "redo-2");
          btn.toggleClass("vt-map-off", !step);
          btn.addEventListener("mousedown", stop);
          btn.addEventListener("click", e => { stop(e); runHistory(this.app, history, side).then(() => { this.draw(); }).catch(() => { new Notice("Could not change that to-do."); }); });
        }
        if (hasNode()) {   // the picture for a slide is a PNG on the clipboard: desktop only
          const shot = title.createEl("button", { cls: "vt-map-dir vt-map-slide", attr: { "aria-label": "Picture for a slide", title: "Copy a picture of the plan for a slide" } });
          setIcon(shot, "image");
          shot.addEventListener("mousedown", stop);
          shot.addEventListener("click", e => { stop(e); new PlanSlideModal(this.app, plan, map, this.sourcePath.replace(/^.*\//, "").replace(/\.md$/, ""), this.slideChoice).open(); });
        }
        const addEnv = { app: this.app, history, hub: this.owner.rec(hubFile), folder: todoFolder(f), todos: this.owner.notesIn(todoFolder(f)), plan, experiments: this.experimentChoices() };
        const mapOptions = { app: this.app, sourcePath: this.sourcePath, collapsed: this.collapsed, direction, zoom: this.zoom, history, problemsOpen: this.problemsOpen, showProblems: (open: boolean) => { this.problemsOpen = open; this.draw(); }, redraw: () => this.draw(),
          addAfter: (from: string, at?: { left: number; bottom: number }) => { addAfterFlow(addEnv, from, undefined, at).catch(() => { new Notice("Could not make that link."); }); },
          insertAfter: (from: string, at?: { left: number; bottom: number }) => { insertAfterFlow(addEnv, from, at).catch(() => { new Notice("Could not insert that to-do."); }); },
          insertBefore: (b: string, at?: { left: number; bottom: number }) => { insertBeforeFlow(addEnv, b, at).catch(() => { new Notice("Could not insert that to-do."); }); },
          newTodo: () => { void this.commands()?.newTodo(hubFile.basename); },
          insertBetween: (a: string, b: string, at?: { left: number; bottom: number }) => { addAfterFlow(addEnv, a, b, at).catch(() => { new Notice("Could not insert that to-do."); }); } };
        drawPlanMap(box, plan, map, mapOptions);
        drawProblems(box, plan, mapOptions);
        return;
      }
      case "plan-picture": {   // the slide picture of a project's plan (option A, or the open work of a big project), view only; the note's own hub or `project: [[Hub]]`
        if (!this.need(box, todoFolder(f))) return;
        const here = this.app.vault.getFileByPath(this.sourcePath);
        const found = pictureHub(this.source, here ? this.owner.rec(here) : null, link => { const t = this.app.metadataCache.getFirstLinkpathDest(link, this.sourcePath); return t ? this.owner.rec(t) : null; });
        if ("error" in found) { box.createDiv({ cls: "vt-muted", text: found.error }); return; }
        const plan = readPlan(this.owner.notesIn(todoFolder(f)), found.hub, this.labNotes()), map = layoutPlan(plan);
        const now = new Date(), picture = pictureFor(plan, map, { title: found.hub.name, width: 1920, height: 1080, today: ymd(now) });
        box.addClass("vt-plan");
        const title = box.createDiv({ cls: "vt-plan-title is-bar", text: `Plan: ${found.hub.name}` });
        title.createSpan({ cls: "vt-muted lab-kit-plan-picture-asof", text: `as of ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}` });
        if (hasNode()) {   // Copy picture and the window: desktop only (PNG on the clipboard)
          const stop = (e: Event): void => { e.stopPropagation(); e.preventDefault(); };
          const copy = title.createEl("button", { cls: "vt-map-dir lab-kit-plan-picture-copy", text: "Copy picture" });
          copy.addEventListener("mousedown", stop);
          copy.addEventListener("click", e => { stop(e); copyPng(picture.svg).then(() => { new Notice("Picture copied: paste it into your slide."); }, (err: unknown) => { new Notice(`Could not copy the picture: ${err instanceof Error ? err.message : "the clipboard refused it."}`); }); });
          const shot = title.createEl("button", { cls: "vt-map-dir vt-map-slide", attr: { "aria-label": "Picture for a slide", title: "Open the picture window" } });
          setIcon(shot, "image");
          shot.addEventListener("mousedown", stop);
          shot.addEventListener("click", e => { stop(e); new PlanSlideModal(this.app, plan, map, found.hub.name, this.slideChoice).open(); });
        }
        this.newUrl = URL.createObjectURL(new Blob([picture.svg], { type: "image/svg+xml" }));
        box.createDiv({ cls: "lab-kit-plan-picture" }).createEl("img", { attr: { src: this.newUrl, alt: `Plan of ${found.hub.name}` } });
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
        box.createDiv({ cls: "vt-muted", text: `Unknown card "${o.show}". Use show: this-week, inbox, experiments, projects, meeting-experiments, meeting-done, meeting-flagged, deadline, topic-index, hub-bar, todo-bar, button-bar, meeting-bar, back-to-project, project-meetings, project-experiments, project-plan, project-map, plan-picture, project-todos, project-notes, project-actions, waiting, back-to-hub, topic-actions, series-actions, meeting-cards or next-meetings.` });
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
      const b = bar.createEl("button", { text, cls: "vt-bar-button" });
      b.addEventListener("click", () => { b.focus(); const c = this.commands(); if (c) run(c); });
    };
    if (kind === "project") {
      button("New to-do", c => void c.newTodo(file.basename)); button("New note", c => void c.newProjectNote(file.parent?.path));
      this.projectChips(bar, file);
      const badge = deadlineBadge(this.owner.rec(file).fm, this.owner.kit().dueCountdown, new Date());   // none once the project is Done
      if (badge) bar.createSpan({ cls: badge.cls, text: badge.text });
      if (noNextStep(this.owner.rec(file), this.owner.notesIn(todoFolder(this.owner.kit().planningFolders)))) bar.createSpan({ cls: NO_NEXT_STEP.cls, text: NO_NEXT_STEP.text });
    }
    else if (kind === "hub") button("New concept", c => void c.newConcept(file.parent?.path));
    else if (kind === "meeting-series") {
      const series = this.owner.commands()?.seriesList().find(x => x.path === this.sourcePath);
      if (!series) { box.createDiv({ cls: "vt-muted", text: "This series has a wrong property: Check setup names it." }); return; }
      // no Meeting deck here: only a meeting note has it (owner's Phase 4 test M6, 2026-10-21)
      if (series.interval === ONCE) button("New one-off meeting", c => void c.newOneOff());
      else { button("New meeting note", c => void c.newMeeting(series)); button("Extra meeting now", c => void c.newMeeting(series, true)); }
    } else box.createDiv({ cls: "vt-muted", text: "hub-bar belongs on a project, topic or meeting series hub." });
  }

  /** A row of the planning kit's buttons, named by id in the block (`ids: new-meeting, go-deck`); the label, icon and action come from the plugin's table, never from the note. */
  private buttonBar(box: HTMLElement): void {
    const { buttons, problems } = resolveBar(parseIds(this.source), id => commandInfo(this.app, id));
    if (!buttons.length && !problems.length) { box.createDiv({ cls: "vt-muted", text: "button-bar needs a line like ids: new-meeting, go-deck." }); return; }
    const bar = box.createDiv({ cls: parseAlignEnd(this.source) ? "vt-button-bar is-end" : "vt-button-bar" });
    for (const b of buttons) {
      const btn = bar.createEl("button", { cls: ["vt-bar-button", b.plain ? "is-plain" : "", b.cls ?? ""].filter(Boolean).join(" "), attr: b.tooltip ? { "aria-label": b.tooltip } : {} });
      if (b.icon) setIcon(btn.createSpan({ cls: "vt-bar-button-icon" }), b.icon);
      btn.createSpan({ text: b.label });
      // Live Preview opens a code block for editing on a click inside it
      btn.addEventListener("mousedown", e => e.stopPropagation());
      btn.addEventListener("click", e => { e.stopPropagation(); btn.focus(); this.pressButton(b); });
    }
    for (const text of problems) box.createDiv({ cls: "vt-muted", text });
  }

  /** The button has focus, so a window opens under it (`buttonAnchor`): Safari does not focus a button on click, hence the `focus()` above. */
  private pressButton(b: BarButton): void {
    if (b.kind === "command") {
      if (!runCommand(this.app, b.target)) new Notice(`"${b.label}" needs the command ${b.target}: its plugin may be off.`);
      return;
    }
    if (b.kind === "edit" && b.edit) { void this.editNote(b); return; }
    const file = this.app.metadataCache.getFirstLinkpathDest(b.target, this.sourcePath);
    if (file) void this.app.workspace.getLeaf(false).openFile(file);
    else new Notice(`No note called "${b.target}" in this vault.`);
  }

  /** An edit button changes the note the block is in: removes the lines that match (Clear ticked) or sets properties (Start a new review). A failed write says so and leaves the note as it was. */
  private async editNote(b: BarButton): Promise<void> {
    const file = this.app.vault.getFileByPath(this.sourcePath), e = b.edit;
    if (!file || !e) return;
    try {
      if (e.type === "replace") await this.app.vault.process(file, text => applyReplace(text, e));
      else await this.app.fileManager.processFrontMatter(file, fm => { Object.assign(fm, e.values); });
    } catch (err) { new Notice(`"${b.label}" did not change the note: ${err instanceof Error ? err.message : String(err)}`); }
  }

  /** The chip bar of a to-do note: Project, Meeting, Due, Priority (and Countdown once there is a due date). A click picks the value and writes it to the note's properties. Live Preview opens a code block for editing on a click inside it: the events stop here. */
  private todoBar(box: HTMLElement): void {
    const file = this.app.vault.getFileByPath(this.sourcePath);
    if (!file) return;
    const fm = this.owner.rec(file).fm;
    if (fm.kind !== "todo") { box.createDiv({ cls: "vt-muted", text: "todo-bar belongs on a to-do note." }); return; }
    const fields = this.todoEntryFields(), values = todoValues(fm);
    const bar = box.createDiv({ cls: "vt-todo-bar" });
    tickButton(bar, this.app, file, fm.done === true, this);
    for (const f of visibleFields(fields, values)) {
      const btn = bar.createEl("button", { cls: "vt-todo-chip", attr: { "aria-label": f.name, title: f.name } });
      this.paintChip(btn, f, values[f.key]);
      for (const ev of ["mousedown", "click"]) btn.addEventListener(ev, e => e.stopPropagation());
      btn.addEventListener("click", () => { void this.editChip(file, f, values[f.key], btn); });
    }
  }

  /** The to-do fields with the live lists of projects and meeting series. */
  private todoEntryFields(): EntryField[] {
    const notes = this.app.vault.getMarkdownFiles().map(x => this.owner.rec(x));
    const named = (kind: string): string[] => notes.filter(n => n.fm.kind === kind).map(n => n.name).sort((a, b) => a.localeCompare(b));
    return todoFields(projectNames(notes.filter(n => n.fm.kind === "project")), named("meeting-series"), this.experimentChoices());
  }

  /** The lab notes as the Experiment chip's list; none (no chip) when the lab folder is not set. */
  private experimentChoices(): { label: string; value: string }[] | undefined {
    const lab = this.labNotes();
    return lab ? experimentOptions(lab) : undefined;
  }

  /** What a chip shows for `value`: its icon (when set) and text, and its set / empty look. */
  private paintChip(btn: HTMLElement, f: EntryField, value: EntryValue | undefined): void {
    const view = chipView(f, value);
    btn.empty();
    btn.toggleClass("is-set", view.set);
    btn.toggleClass("is-empty", !view.set);
    if (view.set || f.kind === "toggle") setIcon(btn.createSpan({ cls: "vt-todo-chip-icon" }), f.icon);
    btn.createSpan({ text: view.text });
  }

  /** Asks for the value of one chip and writes it; Esc changes nothing. The chip shows the new value at once (the write goes through the file and the block redraws a moment later). */
  private async editChip(file: TFile, field: EntryField, current: EntryValue | undefined, anchor: HTMLElement): Promise<void> {
    if (this.chipBusy) return;   // one list at a time: a click on another chip meanwhile does nothing
    this.chipBusy = true;
    const got = await editEntryField(this.app, field, current, anchor).finally(() => { this.chipBusy = false; });
    if (got === null) return;
    this.paintChip(anchor, field, got);
    await this.app.fileManager.processFrontMatter(file, (f: Record<string, unknown>) => { applyTodoValue(f, field.key, got); })
      .then(() => this.draw(), e => { console.error(e); new Notice(`Could not change ${field.name.toLowerCase()}.`); });
  }

  /** Status and Deadline of a project as chips, written to the note's properties. Live Preview opens a code block for editing on a click inside it: the events stop here. */
  private projectChips(bar: HTMLElement, file: TFile): void {
    const values = projectBarValues(this.owner.rec(file).fm);
    for (const f of projectBarFields(String(values.Status))) {
      const btn = bar.createEl("button", { cls: "vt-todo-chip", attr: { "aria-label": f.name, title: f.name } });
      this.paintChip(btn, f, values[f.key]);
      for (const ev of ["mousedown", "click"]) btn.addEventListener(ev, e => e.stopPropagation());
      btn.addEventListener("click", () => { void this.editProjectChip(file, f, values[f.key], btn); });
    }
  }

  private async editProjectChip(file: TFile, field: EntryField, current: EntryValue | undefined, anchor: HTMLElement): Promise<void> {
    if (this.chipBusy) return;
    this.chipBusy = true;
    const got = await editEntryField(this.app, field, current, anchor).finally(() => { this.chipBusy = false; });
    if (got === null) return;
    this.paintChip(anchor, field, got);
    await this.app.fileManager.processFrontMatter(file, (f: Record<string, unknown>) => { applyProjectValue(f, field.key, got); })
      .then(() => this.draw(), e => { console.error(e); new Notice(`Could not change ${field.name.toLowerCase()}.`); });
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
