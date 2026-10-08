// Planning kit commands (fixed IDs, never renamed: kit buttons call them as lab-kit:<id>). Rules: src/planning/actions.ts.
// Plan: docs/plans/phase-4b-planning-commands.md. Note folders: Settings → Planning folders (Phase 5a); a missing one is never made again silently.
import { Notice, Platform, TFile, type App, type Plugin } from "obsidian";
import { ensureFolder } from "../kit/ensure-folder";
import type { ManagedState } from "../kit/managed";
import { hasTemplater, templaterCreateNote } from "../kit/obsidian-private";
import { missingFolderNotice, type FolderGuardActions } from "../kit/folder-guard";
import { archiveInboxFolder, archiveTodoFolder, kitIsBackup, kitJoin, planningRoles, todoFolder, type KitData, type PlanningFolders } from "../kit/paths";
import { nodeModule } from "../node";
import { hasNode } from "../platform";
import { cleanName, deckPath, isArchivable, shoppingAppend, sortedName, splitItems, subfolders, todoFields, uniquePath } from "./actions";
import { ask, pick } from "./ask";
import type { TodoEngine } from "./engine";
import { inFolder, type NoteRec } from "./lists";
import { checkFirstDate, checkSeriesName, cleanDeckPath, firstDefaultDate, INTERVALS, nextDate, parseSeries, sinceLast, WEEKDAYS, type Series } from "./meetings";
import { parseDay, ymd } from "./todo";

/** Templates the commands run, by kit file id and their place under the templates folder. */
export const TPL = {
  todo: { id: "tpl-to-do-md", dest: "To-do.md" },
  meeting: { id: "tpl-weekly-meeting-md", dest: "Weekly meeting.md" },
  series: { id: "tpl-meeting-series-md", dest: "Meeting series.md" },
  project: { id: "tpl-project-hub-md", dest: "Project hub.md" },
  projectNote: { id: "tpl-new-project-note-md", dest: "New project note.md" },
} as const;

/** Hand-offs the kit's To-do and New project note templates read (and delete) at their start. */
interface Handoff { vtPresetProject?: string; vtNewNoteFolder?: string; vtMeeting?: { series: string; folder: string; date: string; since: string };
  vtSeries?: { name: string; folder: string; interval: string; day: string; start: string; deckKey: string; deck: string } }
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
    add("sort-inbox", "Sort inbox", () => this.sortInbox());
    add("archive-todos", "Archive old to-dos", () => this.archiveTodos());
    add("new-meeting", "New meeting", () => this.newMeeting());
    add("new-meeting-series", "New meeting series", () => this.newSeries());
    add("new-project", "New project", () => this.fromTemplate(TPL.project, this.folders.projects));
    add("new-project-note", "New project note", () => this.newProjectNote());
    add("roll-over-todos", "Roll over to-dos now", () => this.engine.rollOverNow());
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

  /** New to-do; `project` (a project hub's name) is filled in without asking: for project cards. */
  async newTodo(project?: string): Promise<void> {
    if (project) handoff().vtPresetProject = project;
    try { await this.fromTemplate(TPL.todo, this.folders.planning, todoFolder(this.folders), false); }   // not opened, as the old button
    finally { delete handoff().vtPresetProject; }   // the template deletes it when it runs; also gone when it didn't or failed
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

  /** Asks which series when there are several; null when there is none (a notice says so) or Esc was pressed. */
  private async pickSeries(): Promise<Series | null> {
    const all = this.seriesList();
    if (!all.length) { new Notice(`No meeting series yet: a note in ${this.folders.meetings} with kind: meeting-series, interval, day and start.`); return null; }
    return all.length === 1 ? all[0] : pick(this.app, all.map(s => s.name), all, "Which meeting?");
  }

  /** New meeting note in a series: dated from the series' interval, "since" the last meeting of the series. The template reads `vtMeeting`. */
  async newMeeting(): Promise<void> {
    const series = await this.pickSeries();
    if (!series) return;
    const date = nextDate(series, new Date());
    const held = this.app.vault.getMarkdownFiles().filter(f => f.parent?.path === series.folder)
      .map(f => parseDay(String(this.app.metadataCache.getFileCache(f)?.frontmatter?.date ?? "").slice(0, 10))).filter((d): d is Date => !!d);
    handoff().vtMeeting = { series: series.name, folder: series.folder, date: ymd(date), since: ymd(sinceLast(series, date, held)) };
    try { await this.fromTemplate(TPL.meeting, this.folders.meetings, series.folder); }
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
    const interval = await pick(this.app, [...INTERVALS], [...INTERVALS], "How often?");
    if (!interval) return;
    const day = await pick(this.app, [...WEEKDAYS], WEEKDAYS.map((_, i) => i), "On which day?");
    if (day === null) return;
    let start = ymd(firstDefaultDate(day, new Date()));
    for (let date = await ask(this.app, "Date of the first meeting (YYYY-MM-DD)", start); ; date = await ask(this.app, "Date of the first meeting (YYYY-MM-DD)", date ?? "")) {
      if (date === null) return;
      const checked = checkFirstDate(date, day);
      if ("error" in checked) { new Notice(checked.error); continue; }
      start = ymd(checked.date);
      break;
    }
    const deck = await ask(this.app, `Path of the meeting deck on ${Platform.isMacOS ? "this Mac" : "this computer"} (Enter to leave empty)`);
    if (deck === null) return;
    handoff().vtSeries = { name, folder: kitJoin(root, name), interval, day: WEEKDAYS[day], start, deckKey: Platform.isMacOS ? "deck_mac" : "deck_windows", deck: cleanDeckPath(deck) };
    try { await this.fromTemplate(TPL.series, root, kitJoin(root, name)); }
    finally { delete handoff().vtSeries; }
  }

  /** New note in a project; `folder` (the project's folder) is used without asking: for project cards. */
  async newProjectNote(folder?: string): Promise<void> {
    if (folder) handoff().vtNewNoteFolder = folder;
    try { await this.fromTemplate(TPL.projectNote, this.folders.projects, folder ?? this.folders.projects); }
    finally { delete handoff().vtNewNoteFolder; }
  }

  /** Where the planning kit installed this template, else where it would install it. */
  private templateFile(tpl: { id: string; dest: string }): TFile | null {
    const rec = this.state()?.files[tpl.id];
    const tracked = rec && !rec.userDeleted && !kitIsBackup(rec.path) ? rec.path : "";
    return [tracked, kitJoin(planningRoles(this.app, {}, this.folders).templates, tpl.dest)]
      .map(p => (p ? this.app.vault.getFileByPath(p) : null)).find(f => f) ?? null;
  }

  /** Creates a note from a kit template with Templater in `folderPath` (inside the setting folder `root`; the template then files it where it belongs). */
  private async fromTemplate(tpl: { id: string; dest: string }, root: string, folderPath = root, open = true): Promise<void> {
    if (!hasTemplater(this.app)) { new Notice("Templater is needed for this: install and enable it, then try again."); return; }
    const template = this.templateFile(tpl);
    if (!template) { new Notice(`Template not found: ${tpl.dest}`); return; }
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
    const picked = await pick(this.app, [...folders, "+ New folder in " + root], [...folders, ""], "Which folder?");
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
        `${file.basename} - where does it go? (${sorted + skipped + 1} of ${total})`);
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
        const hub = await pick(this.app, hubs.map(h => h.basename), hubs, "Which project?");
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
        const sure = await pick(this.app, ["Yes, delete it", "No, keep it"], [true, false], `Delete "${file.basename}"?`);
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

  /** Moves to-dos finished more than 30 days ago into the archive (a name already there gets " 2", " 3", …). */
  private async archiveTodos(): Promise<void> {
    const archive = archiveTodoFolder(this.folders);
    const prefix = todoFolder(this.folders) + "/", now = new Date();
    const done = this.app.vault.getMarkdownFiles().filter(f =>
      f.path.startsWith(prefix) && isArchivable(this.app.metadataCache.getFileCache(f)?.frontmatter ?? {}, new Date(f.stat.mtime), now));
    if (done.length) await ensureFolder(this.app.vault, archive);   // the archive is made when first needed
    for (const f of done) {
      const target = uniquePath(archive, f.basename, f.extension, p => !!this.app.vault.getAbstractFileByPath(p));
      await this.app.fileManager.renameFile(f, target);
    }
    new Notice(`Archived ${done.length} to-do${done.length === 1 ? "" : "s"}`);
  }

  /** Opens the deck set in the meetings hub (`deck_mac` / `deck_windows`) with this computer's default app. */
  private async openDeck(): Promise<void> {
    const series = await this.pickSeries();
    if (!series) return;
    const hub = this.app.vault.getFileByPath(series.path);
    const fm = (hub && this.app.metadataCache.getFileCache(hub)?.frontmatter) || {};
    const isMac = Platform.isMacOS;
    const deck = deckPath(fm, isMac);
    if (!deck) {
      new Notice(`No meeting deck set for ${isMac ? "Mac" : "this computer"} yet: add the path in ${series.name} (${isMac ? "deck_mac" : "deck_windows"}).`);
      if (hub) await this.app.workspace.getLeaf(false).openFile(hub);
      return;
    }
    const shell = nodeModule("electron")?.shell;
    if (!shell) { new Notice("Opening the deck needs the desktop app."); return; }
    const error = await shell.openPath(deck);
    if (error) new Notice(`Couldn't open the deck: ${error}`);
  }
}
