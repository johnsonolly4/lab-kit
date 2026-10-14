// Planning kit commands (fixed IDs, never renamed: kit buttons call them as lab-kit:<id>). Rules: src/planning/actions.ts.
// Plan: docs/plans/phase-4b-planning-commands.md. Note folders: Settings → Planning folders (Phase 5a); a missing one is never made again silently.
import { Notice, Platform, TFile, normalizePath, type App, type Plugin } from "obsidian";
import { ensureFolder } from "../kit/ensure-folder";
import type { ManagedState } from "../kit/managed";
import { hasTemplater, templaterCreateNote } from "../kit/obsidian-private";
import { missingFolderNotice, type FolderGuardActions } from "../kit/folder-guard";
import { archiveInboxFolder, archiveTodoFolder, kitIsBackup, kitJoin, planningRoles, todoFolder, type KitData, type PlanningFolders } from "../kit/paths";
import { nodeModule } from "../node";
import { hasNode } from "../platform";
import { cleanName, deckPath, isArchivable, shoppingAppend, sortedName, splitItems, subfolders, todoFields, topicsWithoutHub, uniquePath } from "./actions";
import { ask, pick } from "./ask";
import type { EntryValues } from "./entry-fields";
import { openEntry } from "./entry-window";
import { todoFields as todoEntryFields } from "./todo-bar";
import type { TodoEngine } from "./engine";
import { inFolder, linkTarget, type NoteRec } from "./lists";
import { checkFirstDate, checkSeriesName, cleanDeckPath, firstDefaultDate, everyWeeks, INTERVALS, nextDate, ONCE, parseSeries, sinceLast, templateRef, seriesOfNote, WEEKDAYS, type Series } from "./meetings";
import { addResult } from "./result";
import { linkInOrder } from "./sequence";
import { parseDay, ymd } from "./todo";

/** Templates the commands run, by kit file id and their place under the templates folder. */
export const TPL = {
  todo: { id: "tpl-to-do-md", dest: "To-do.md" },
  meeting: { id: "tpl-weekly-meeting-md", dest: "Meeting.md" },
  oneOff: { id: "tpl-one-off-meeting-md", dest: "One-off meeting.md" },
  series: { id: "tpl-meeting-series-md", dest: "Meeting series.md" },
  project: { id: "tpl-project-hub-md", dest: "Project hub.md" },
  projectNote: { id: "tpl-new-project-note-md", dest: "New project note.md" },
  concept: { id: "tpl-new-concept-md", dest: "New concept.md" },
  topicHub: { id: "tpl-new-topic-hub-md", dest: "New topic hub.md" },
} as const;

/** Hand-offs the kit's To-do and New project note templates read (and delete) at their start. */
interface Handoff { vtPresetProject?: string; vtTodo?: { text: string; project: string; meeting: string; due: string; priority: number | ""; countdown: boolean }; vtNewNoteFolder?: string; vtNewConceptFolder?: string; vtMeeting?: { series: string; folder: string; date: string; since: string; title?: string; project?: string };
  vtTopicHub?: { folder: string; name: string };
  vtSeries?: { name: string; folder: string; interval: string; day: string; start: string; deckKey: string; deck: string; template?: string } }
const handoff = (): Handoff => window as unknown as Handoff;

export class PlanningCommands {
  /** `state` reads the planning kit's install record when needed (it is replaced on every install); `kit` the current settings. */
  constructor(private plugin: Plugin, private state: () => ManagedState | null, private engine: TodoEngine, private kit: () => KitData,
    private guard: FolderGuardActions) {}

  get app(): App { return this.plugin.app; }
  private get folders(): PlanningFolders { return this.kit().planningFolders; }

  /**
   * True when the Planning folders setting `root` exists, after making `sub` (a folder inside it) if needed. A missing root was most
   * likely moved outside Obsidian: a notice says so (Find moved folders / Open settings / Create it) and nothing is made.
   */
  private async ready(root: string, sub = root): Promise<boolean> {
    if (!this.app.vault.getFolderByPath(root)) { missingFolderNotice(this.app, root, this.guard); return false; }
    await ensureFolder(this.app.vault, sub);
    return true;
  }

  register(): void {
    const add = (id: string, name: string, run: () => Promise<void>): void => {
      this.plugin.addCommand({ id, name, callback: () => { void run().catch(e => this.failed(name, e)); } });
    };
    add("new-todo", "New to-do", () => this.newTodo());
    add("quick-capture", "Quick capture", () => this.quickCapture());
    add("add-to-shopping", "Add to shopping list", () => this.addToShopping());
    add("add-result", "Add result", () => addResult(this.app));
    add("link-todos-in-order", "Link to-dos in order", () => linkInOrder(this.app, this.folders));
    add("sort-inbox", "Sort inbox", () => this.sortInbox());
    add("archive-todos", "Archive old to-dos", () => this.archiveTodos());
    add("new-meeting", "New meeting", () => this.newMeeting());
    add("new-extra-meeting", "New extra meeting now", () => this.newMeeting(undefined, true));
    add("new-one-off-meeting", "New one-off meeting", () => this.newOneOff());
    add("new-meeting-series", "New meeting series", () => this.newSeries());
    add("new-project", "New project", () => this.fromTemplate(TPL.project, this.folders.projects));
    add("new-project-note", "New project note", () => this.newProjectNote());
    add("new-concept", "New concept", () => this.newConcept());   // the template asks title + topic and files the note
    add("new-topic-hub", "New topic hub", () => this.newTopicHub());
    add("roll-over-todos", "Roll over to-dos now", () => this.engine.rollOverNow());
    add("open-todo-board", "Open to-do board", () => this.openBoard());
    // Desktop only: opening a file in another app needs Electron
    this.plugin.addCommand({
      id: "open-deck", name: "Open meeting deck",
      checkCallback: (checking) => {
        if (!hasNode()) return false;
        if (!checking) void this.openDeck().catch(e => this.failed("Open meeting deck", e));
        return true;
      },
    });
  }

  private failed(name: string, e: unknown): void {
    console.error("Lab Kit", name, e);
    new Notice(`${name} failed. See the developer console for details.`);
  }

  /** New to-do: the entry window (title, then chips for project, meeting, due, priority and countdown; Enter creates), then the To-do template makes the note from what was set. `project` (a project hub's name) is already set in the window: for project cards and from inside a project. */
  async newTodo(project?: string, initial: { title?: string; values?: EntryValues } = {}): Promise<void> {
    const named = (kind: string): string[] => this.app.vault.getMarkdownFiles().filter(f => this.app.metadataCache.getFileCache(f)?.frontmatter?.kind === kind).map(f => f.basename).sort((a, b) => a.localeCompare(b));
    const inside = project ?? this.hubOfActiveNote();
    const answer = await openEntry(this.app, "New to-do", todoEntryFields(named("project"), named("meeting-series")), { title: initial.title, values: { ...(inside ? { project: inside } : {}), ...initial.values } });
    if (!answer) return;
    const v = answer.values;
    handoff().vtTodo = { text: answer.title, project: String(v.project ?? ""), meeting: String(v.meeting ?? ""), due: String(v.due ?? ""), priority: typeof v.priority === "number" ? v.priority : "", countdown: v.countdown === true };
    try { await this.fromTemplate(TPL.todo, this.folders.planning, todoFolder(this.folders), false); }   // not opened, as the old button
    finally { delete handoff().vtTodo; }   // the template deletes it when it runs; also gone when it didn't or failed
  }

  /** The project hub the open note is, or is inside (as the To-do template works it out), else "". */
  private hubOfActiveNote(): string {
    const here = this.app.workspace.getActiveFile();
    if (!here) return "";
    const isHub = (f: TFile | null | undefined): boolean => !!f && this.app.metadataCache.getFileCache(f)?.frontmatter?.kind === "project";
    if (isHub(here)) return here.basename;
    const root = this.folders.projects;
    if (!here.path.startsWith(root + "/") || here.parent?.path === root) return "";
    const top = here.path.slice(root.length + 1).split("/")[0], hub = this.app.vault.getFileByPath(`${root}/${top}/${top}.md`);
    return hub && isHub(hub) ? hub.basename : "";
  }

  /** The meeting series hubs (`kind: meeting-series`) in the meetings folder, by name; a hub with a wrong field is left out (Check setup names it). */
  seriesList(): Series[] {
    const out: Series[] = [];
    for (const f of this.app.vault.getMarkdownFiles()) {
      if (!inFolder(f.path, this.folders.meetings)) continue;
      const fm = this.app.metadataCache.getFileCache(f)?.frontmatter ?? {};
      if (fm.kind !== "meeting-series") continue;
      const rec: NoteRec = { path: f.path, name: f.basename, folder: f.parent?.path ?? "", fm, ctime: f.stat.ctime, mtime: f.stat.mtime };
      const read = parseSeries(rec);
      if ("series" in read) out.push(read.series);
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Mon to Fri; "Sat / Sun…" opens the weekend. The day as 0 (Sun) to 6 (Sat), or null on Esc. */
  private async askDay(): Promise<number | null> {
    const weekdays = [1, 2, 3, 4, 5], WEEKEND = -1;
    const first = await pick(this.app, [...weekdays.map(d => WEEKDAYS[d]), "Sat / Sun…"], [...weekdays, WEEKEND], "On which day?");
    if (first !== WEEKEND) return first;
    return pick(this.app, [WEEKDAYS[6], WEEKDAYS[0]], [6, 0], "On which day?");
  }

  /** Asks which series when there are several; null when there is none (a notice says so) or Esc was pressed. */
  private async pickSeries(regularOnly = false): Promise<Series | null> {
    const all = this.seriesList().filter(s => !regularOnly || s.interval !== ONCE);
    if (!all.length) { new Notice("No meeting series yet. Make one with the meeting series command first."); return null; }
    return all.length === 1 ? all[0] : pick(this.app, all.map(s => s.name), all, "Which meeting?");
  }

  /** New meeting note in `given` (a series card's button), else in the series asked for:  dated from the series' interval, "since" the last meeting of the series. The template reads `vtMeeting`. */
  async newMeeting(given?: Series, extra = false): Promise<void> {
    const series = given ?? await this.pickSeries(extra);
    if (!series) return;
    if (series.interval === ONCE) { await this.newOneOff(); return; }
    // An extra meeting is held on a date you give (today by default), in between: it does not move the schedule
    let date = nextDate(series, new Date());
    if (extra) {
      const asked = await this.askDate("Date of the extra meeting (YYYY-MM-DD)", ymd(new Date()));
      if (!asked) return;
      date = asked;
    }
    const held = this.app.vault.getMarkdownFiles().filter(f => f.parent?.path === series.folder)
      .map(f => parseDay(String(this.app.metadataCache.getFileCache(f)?.frontmatter?.date ?? "").slice(0, 10))).filter((d): d is Date => !!d);
    handoff().vtMeeting = { series: series.name, folder: series.folder, date: ymd(date), since: ymd(sinceLast(series, date, held)) };
    try { await this.fromTemplateFile(this.seriesTemplate(series), this.folders.meetings, series.folder); }
    finally { delete handoff().vtMeeting; }
  }

  /** Asks a date until it is a real YYYY-MM-DD day; null when cancelled. */
  private async askDate(prompt: string, start: string): Promise<Date | null> {
    for (let typed = await ask(this.app, prompt, start); ; typed = await ask(this.app, prompt, typed ?? "")) {
      if (typed === null) return null;
      const d = parseDay(typed.trim());
      if (d) return d;
      new Notice("Type the date with year, month and day, for example 2026-10-15.");
    }
  }

  /**
   * New one-off meeting: a meeting that belongs to no series. It goes in the One-off hub (made the first time), is named from what you type,
   * dated (today unless you change it) and can belong to a project. The Meeting template reads `vtMeeting`.
   */
  async newOneOff(): Promise<void> {
    const root = this.folders.meetings;
    if (!(await this.ready(root))) return;
    const NAME = "One-off";
    let hub = this.seriesList().find(s => s.interval === ONCE);
    const title = await ask(this.app, "What is the meeting about? (Enter = One-off)");
    if (title === null) return;
    const asked = await this.askDate("Date of the meeting (YYYY-MM-DD)", ymd(new Date()));
    if (!asked) return;
    const date = ymd(asked);
    const hubs = this.app.vault.getMarkdownFiles().filter(f => this.app.metadataCache.getFileCache(f)?.frontmatter?.kind === "project").sort((a, b) => a.basename.localeCompare(b.basename));
    let project = "";
    if (hubs.length) {
      const chosen = await pick(this.app, ["(no project)", ...hubs.map(h => h.basename)], ["", ...hubs.map(h => h.basename)], "Which project? (Esc to cancel)");
      if (chosen === null) return;
      project = chosen;
    }
    if (!hub) {
      const folder = kitJoin(root, NAME);
      handoff().vtSeries = { name: NAME, folder, interval: ONCE, day: "Mon", start: date, deckKey: "deck_windows", deck: "" };
      try { await this.fromTemplate(TPL.series, root, folder, false); }
      finally { delete handoff().vtSeries; }
      // Obsidian reads the new note's properties a moment after it exists: wait for them (up to 3 s) before saying it failed
      for (let tries = 0; tries < 20; tries++) {
        hub = this.seriesList().find(s => s.interval === ONCE);
        if (hub) break;
        await new Promise<void>(resolve => window.setTimeout(resolve, 150));
      }
      if (!hub) { new Notice("The hub note for one-off meetings could not be made."); return; }
    }
    const since = new Date(parseDay(date)!.getFullYear(), parseDay(date)!.getMonth(), parseDay(date)!.getDate() - 7);
    handoff().vtMeeting = { series: hub.name, folder: hub.folder, date, since: ymd(since), title: cleanName(title) || "", project };
    try { await this.fromTemplateFile(this.seriesTemplate(hub), this.folders.meetings, hub.folder); }
    finally { delete handoff().vtMeeting; }
  }

  /**
   * New meeting series: asks name, interval, day, first date and deck path (one box at a time; Esc at any point stops, nothing is made), then the
   * Meeting series template makes the folder's hub note. Stops with a notice when a series or folder of that name exists. The template reads `vtSeries`.
   */
  async newSeries(): Promise<void> {
    const root = this.folders.meetings;
    if (!this.app.vault.getFolderByPath(root)) { missingFolderNotice(this.app, root, this.guard); return; }
    const taken = (name: string): boolean => !!this.app.vault.getAbstractFileByPath(kitJoin(root, name)) || this.seriesList().some(s => s.name.toLowerCase() === name.toLowerCase());
    let name = "";
    for (let typed = await ask(this.app, "Name of the meeting series (for example Group meeting)"); ; typed = await ask(this.app, "Name of the meeting series", typed ?? "")) {
      if (typed === null) return;
      const checked = checkSeriesName(typed);
      if ("error" in checked) { new Notice(checked.error); continue; }
      if (taken(checked.name)) { new Notice(`A meeting series called ${checked.name} already exists in ${root}. Choose another name.`); continue; }
      name = checked.name;
      break;
    }
    const CUSTOM = "every N weeks…";
    let interval = await pick<string>(this.app, [...INTERVALS, CUSTOM], [...INTERVALS, CUSTOM], "How often?");
    if (!interval) return;
    if (interval === CUSTOM) {
      let n = 0;
      for (let typed = await ask(this.app, "Every how many weeks? (1-52)", "3"); ; typed = await ask(this.app, "Every how many weeks? (1-52)", typed ?? "")) {
        if (typed === null) return;
        n = /^\d{1,2}$/.test(typed.trim()) ? +typed.trim() : 0;
        if (n >= 1 && n <= 52) break;
        new Notice("Type a whole number of weeks from 1 to 52.");
      }
      interval = everyWeeks(n);
    }
    const day = await this.askDay();
    if (day === null) return;
    let start = ymd(firstDefaultDate(day, new Date()));
    for (let date = await ask(this.app, "Date of the first meeting (YYYY-MM-DD)", start); ; date = await ask(this.app, "Date of the first meeting (YYYY-MM-DD)", date ?? "")) {
      if (date === null) return;
      const checked = checkFirstDate(date, day);
      if ("error" in checked) { new Notice(checked.error); continue; }
      start = ymd(checked.date);
      break;
    }
    const deck = await ask(this.app, `Meeting deck on ${Platform.isMacOS ? "this Mac" : "this computer"}: a folder of decks, or the path to one deck file (Enter to leave empty)`);
    if (deck === null) return;
    const template = await ask(this.app, "Meeting note template for this series: the name of a template note (Enter = the kit's Meeting template)");
    if (template === null) return;
    handoff().vtSeries = { name, folder: kitJoin(root, name), interval, day: WEEKDAYS[day], start, deckKey: Platform.isMacOS ? "deck_mac" : "deck_windows", deck: cleanDeckPath(deck), template: templateRef(template) };
    try { await this.fromTemplate(TPL.series, root, kitJoin(root, name)); }
    finally { delete handoff().vtSeries; }
  }

  /**
   * New topic hub: the index note (`kind: hub`, named like its folder) of a topic folder under Knowledge. Pick a topic that has no hub yet, or a new topic
   * (its folder is made); Esc stops, nothing is made. The template reads `vtTopicHub`.
   */
  async newTopicHub(): Promise<void> {
    const root = this.folders.knowledge;
    if (!(await this.ready(root))) return;
    const notes = this.app.vault.getMarkdownFiles().map(f => ({ path: f.path, kind: this.app.metadataCache.getFileCache(f)?.frontmatter?.kind as unknown }));
    const open = topicsWithoutHub(this.app.vault.getAllFolders().map(f => f.path), notes, root);
    const NEW = "+ New topic…";
    const picked = await pick(this.app, [...open.map(p => p.slice(root.length + 1)), NEW], [...open, ""], "Which topic gets a hub?", true,
      { prefix: "+ New topic: ", make: text => (cleanName(text) ? kitJoin(root, cleanName(text)) : "") });   // typing a new name + Enter makes it
    if (picked === null) return;
    let folder = picked;
    if (!folder) {
      const typed = await ask(this.app, "Topic name (a folder under Knowledge)");
      const name = typed ? cleanName(typed) : "";
      if (!name) return;
      folder = kitJoin(root, name);
    }
    const name = folder.slice(root.length + 1);
    const taken = this.app.vault.getAbstractFileByPath(`${folder}/${name}.md`);
    if (taken) { new Notice(`${name} already has a hub note in ${folder}.`); return; }
    handoff().vtTopicHub = { folder, name };
    try { await this.fromTemplate(TPL.topicHub, root, folder); }
    finally { delete handoff().vtTopicHub; }
  }

  /** New note in a project; `folder` (the project's folder) is used without asking: for project cards. */
  async newProjectNote(folder?: string): Promise<void> {
    if (folder) handoff().vtNewNoteFolder = folder;
    try { await this.fromTemplate(TPL.projectNote, this.folders.projects, folder ?? this.folders.projects); }
    finally { delete handoff().vtNewNoteFolder; }
  }

  /** New concept; `folder` (a topic hub's folder) files it there without asking the topic. */
  async newConcept(folder?: string): Promise<void> {
    if (folder) handoff().vtNewConceptFolder = folder;
    try { await this.fromTemplate(TPL.concept, this.folders.knowledge); }
    finally { delete handoff().vtNewConceptFolder; }
  }

  /** Where the planning kit installed this template, else where it would install it. */
  private templateFile(tpl: { id: string; dest: string }): TFile | null {
    const rec = this.state()?.files[tpl.id];
    const tracked = rec && !rec.userDeleted && !kitIsBackup(rec.path) ? rec.path : "";
    return [tracked, kitJoin(planningRoles(this.app, {}, this.folders).templates, tpl.dest)]
      .map(p => (p ? this.app.vault.getFileByPath(p) : null)).find(f => f) ?? null;
  }

  /** The meeting note template of a series: the one named on its hub (`template`), else the kit's One-off meeting for a one-off hub, else the kit's Meeting. A name that finds no note falls back with a notice. */
  private seriesTemplate(series: Series): TFile | null {
    if (series.template) {
      const own = this.app.metadataCache.getFirstLinkpathDest(series.template, series.path) ?? this.app.vault.getFileByPath(normalizePath(series.template + ".md"));
      if (own) return own;
      new Notice(`Template "${series.template}" for ${series.name} was not found. Using the kit's template.`);
    }
    return this.templateFile(series.interval === ONCE ? TPL.oneOff : TPL.meeting);
  }

  /** Creates a note from a kit template with Templater in `folderPath` (inside the setting folder `root`; the template then files it where it belongs). */
  private async fromTemplate(tpl: { id: string; dest: string }, root: string, folderPath = root, open = true): Promise<void> {
    const template = this.templateFile(tpl);
    if (!template && hasTemplater(this.app)) { new Notice(`Template not found: ${tpl.dest}`); return; }
    await this.fromTemplateFile(template, root, folderPath, open);
  }

  private async fromTemplateFile(template: TFile | null, root: string, folderPath = root, open = true): Promise<void> {
    if (!hasTemplater(this.app)) { new Notice("Templater is needed for this: install and enable it, then try again."); return; }
    if (!template) { new Notice("Meeting template not found."); return; }
    if (!(await this.ready(root, folderPath))) return;
    const folder = this.app.vault.getFolderByPath(folderPath);
    if (!folder) { new Notice(`Could not use the folder ${folderPath}.`); return; }
    if (!(await templaterCreateNote(this.app, template, folder, open))) new Notice("Templater couldn't create the note. Update it to the latest version, then try again.");
  }

  /** An empty note in the inbox, opened. */
  private async quickCapture(): Promise<void> {
    const inbox = this.folders.inbox;
    if (!(await this.ready(inbox))) return;
    const path = uniquePath(inbox, "Capture", "md", p => !!this.app.vault.getAbstractFileByPath(p));
    const file = await this.app.vault.create(path, "");
    await this.app.workspace.getLeaf(false).openFile(file);
  }

  /** Opens the kit's to-do board (the .base in the Planning folder). */
  private async openBoard(): Promise<void> {
    const path = kitJoin(this.folders.planning, "To-do board.base");
    const file = this.app.vault.getFileByPath(path);
    if (!file) { new Notice("To-do board not found: " + path); return; }
    await this.app.workspace.getLeaf(false).openFile(file);
  }

  private async addToShopping(): Promise<void> {
    const path = kitJoin(this.folders.planning, "Shopping list.md");
    const file = this.app.vault.getFileByPath(path);
    if (!file) { new Notice("Shopping list not found: " + path); return; }
    const input = await ask(this.app, "Add to lab shopping list (commas between items)");
    const items = input ? splitItems(input) : [];
    if (!items.length) return;
    await this.app.vault.process(file, text => shoppingAppend(text, items));
    new Notice(`Added ${items.length} to the shopping list`);
  }

  /** Inbox notes, oldest first. */
  private inboxNotes(): TFile[] {
    return this.app.vault.getMarkdownFiles().filter(f => f.parent?.path === this.folders.inbox).sort((a, b) => a.stat.ctime - b.stat.ctime);
  }

  /** Moves `file` into `folder` (made if missing) as `name`; a name already taken gets " 2", " 3", … */
  private async moveTo(file: TFile, folder: string, name = file.basename): Promise<void> {
    await ensureFolder(this.app.vault, folder);
    const target = uniquePath(folder, sortedName(file.basename, name), file.extension, p => p !== file.path && !!this.app.vault.getAbstractFileByPath(p));
    await this.app.fileManager.renameFile(file, target);
  }

  private askName = async (file: TFile): Promise<string> => sortedName(file.basename, await ask(this.app, "Name (Enter keeps it)", file.basename));

  /** A folder in `root` (or a new one in it); null when Esc was pressed. */
  private async pickFolder(root: string): Promise<string | null> {
    const folders = subfolders(this.app.vault.getAllFolders().map(f => f.path), root);
    const picked = await pick(this.app, [...folders, "+ New folder in " + root], [...folders, ""], "Which folder?", true,
      { prefix: "+ New folder: ", make: text => (cleanName(text) ? `${root}/${cleanName(text)}` : "") });
    if (picked !== "") return picked;
    const name = await ask(this.app, "New folder name");
    return name ? `${root}/${cleanName(name)}` : null;
  }

  /** Opens each inbox note in turn and asks where it goes. Esc or Stop ends at any point. As the old Sort inbox template. */
  async sortInbox(): Promise<void> {
    if (!(await this.ready(this.folders.inbox))) return;
    const total = this.inboxNotes().length;
    if (!total) { new Notice("The inbox is empty."); return; }
    const f = this.folders;
    const roots = { knowledge: f.knowledge, howto: f.howtos, meetings: f.meetings };
    let sorted = 0, skipped = 0;
    for (const file of this.inboxNotes()) {
      await this.app.workspace.getLeaf(false).openFile(file);
      const where = await pick(this.app,
        ["To-do (goes to Backlog)", "Project...", "Knowledge...", "How-to...", "Meetings...", "Archive", "Delete", "Skip for now", "Stop"],
        ["todo", "project", "knowledge", "howto", "meetings", "archive", "delete", "skip", "stop"] as const,
        `${file.basename} - where does it go? (${sorted + skipped + 1} of ${total})`, true);
      if (where === null || where === "stop") break;
      if (where === "skip") { skipped++; continue; }

      if (where === "todo") {
        const name = await this.askName(file);
        await this.app.fileManager.processFrontMatter(file, todoFields);
        if (!(await this.ready(f.planning, todoFolder(f)))) break;
        await this.moveTo(file, todoFolder(f), name);
      } else if (where === "project") {
        const hubs = this.app.vault.getMarkdownFiles()
          .filter(f => this.app.metadataCache.getFileCache(f)?.frontmatter?.kind === "project")
          .sort((a, b) => a.basename.localeCompare(b.basename));
        const hub = await pick(this.app, hubs.map(h => h.basename), hubs, "Which project?", true);
        if (!hub) { skipped++; continue; }
        await this.moveTo(file, hub.parent?.path ?? f.projects, await this.askName(file));
      } else if (where === "knowledge" || where === "howto" || where === "meetings") {
        if (!(await this.ready(roots[where]))) break;
        const folder = await this.pickFolder(roots[where]);
        if (!folder) { skipped++; continue; }
        await this.moveTo(file, folder, await this.askName(file));
      } else if (where === "archive") {
        await this.moveTo(file, archiveInboxFolder(f));
      } else if (where === "delete") {
        const sure = await pick(this.app, ["Yes, delete it", "No, keep it"], [true, false], `Delete "${file.basename}"?`, true);
        if (!sure) { skipped++; continue; }
        await this.app.fileManager.trashFile(file);   // the trash setting the user chose (system or .trash), never a hard delete
      }
      sorted++;
    }
    const left = this.inboxNotes().length;
    new Notice(`Sorted ${sorted}. ${left === 0 ? "Inbox empty!" : left + " left in the inbox."}`);
    const home = this.app.metadataCache.getFirstLinkpathDest("00 Home", "");
    if (home) await this.app.workspace.getLeaf(false).openFile(home);
  }

  /** True when `project` (a link; of a list, the first) names a hub that exists and whose Status is not Done. */
  private projectIsActive(project: unknown, from: string): boolean {
    const link = linkTarget(project);
    const hub = link ? this.app.metadataCache.getFirstLinkpathDest(link, from) : null;
    return !!hub && this.app.metadataCache.getFileCache(hub)?.frontmatter?.Status !== "Done";
  }

  /** Moves to-dos finished more than 30 days ago into the archive, except those of a project that is not Done (a name already there gets " 2", " 3", …). */
  private async archiveTodos(): Promise<void> {
    const archive = archiveTodoFolder(this.folders);
    const prefix = todoFolder(this.folders) + "/", now = new Date();
    const done = this.app.vault.getMarkdownFiles().filter(f => {
      if (!f.path.startsWith(prefix)) return false;
      const fm = this.app.metadataCache.getFileCache(f)?.frontmatter ?? {};
      return isArchivable(fm, new Date(f.stat.mtime), now, this.projectIsActive(fm.project, f.path));
    });
    if (done.length) await ensureFolder(this.app.vault, archive);   // the archive is made when first needed
    for (const f of done) {
      const target = uniquePath(archive, f.basename, f.extension, p => !!this.app.vault.getAbstractFileByPath(p));
      await this.app.fileManager.renameFile(f, target);
    }
    new Notice(`Archived ${done.length} to-do${done.length === 1 ? "" : "s"}`);
  }

  /** Opens the deck set in the meetings hub (`deck_mac` / `deck_windows`) with this computer's default app. */
  async openDeck(given?: Series): Promise<void> {
    // The series comes from the note you are in (a series hub, or a meeting note's `series`); only elsewhere is it asked
    const file = this.app.workspace.getActiveFile();
    const here = file ? seriesOfNote(this.seriesList(), file.path, this.app.metadataCache.getFileCache(file)?.frontmatter ?? {}) : undefined;
    const series = given ?? here ?? await this.pickSeries();
    if (!series) return;
    const hub = this.app.vault.getFileByPath(series.path);
    const fm = (hub && this.app.metadataCache.getFileCache(hub)?.frontmatter) || {};
    const isMac = Platform.isMacOS;
    const deck = deckPath(fm, isMac);
    if (!deck) {
      new Notice(`No meeting deck set for ${isMac ? "Mac" : "this computer"} yet: add a folder of decks or the path to one deck file in ${series.name} (${isMac ? "deck_mac" : "deck_windows"}).`);
      if (hub) await this.app.workspace.getLeaf(false).openFile(hub);
      return;
    }
    const shell = nodeModule("electron")?.shell;
    if (!shell) { new Notice("Opening the deck needs the desktop app."); return; }
    const error = await shell.openPath(deck);
    if (error) new Notice(`Couldn't open the deck: ${error}`);
  }
}
