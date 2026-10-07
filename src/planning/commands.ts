// Planning kit commands (fixed IDs, never renamed: kit buttons call them as lab-kit:<id>). Rules: src/planning/actions.ts.
// Plan: docs/plans/phase-4b-planning-commands.md. Note folders are the folder contract's (PLANNING_LAYOUT) until Phase 5 adds settings.
import { Notice, Platform, TFile, type App, type Plugin } from "obsidian";
import { ensureFolder } from "../kit/ensure-folder";
import type { ManagedState } from "../kit/managed";
import { hasTemplater, templaterCreateNote } from "../kit/obsidian-private";
import { PLANNING_LAYOUT, kitIsBackup, kitJoin, planningRoles } from "../kit/paths";
import { nodeModule } from "../node";
import { hasNode } from "../platform";
import { cleanName, deckPath, isArchivable, shoppingAppend, sortedName, splitItems, subfolders, todoFields, uniquePath } from "./actions";
import { ask, pick } from "./ask";
import type { TodoEngine } from "./engine";

// Folders from the folder contract (docs/plans/planning-suite-kit.md) that the kit ships no file into, so they have no role yet
const INBOX = "00 Inbox";
const ARCHIVE = "99 Archive/To-dos";
const ARCHIVE_INBOX = "99 Archive/Inbox";
const MEETINGS_HUB = "Weekly meetings";

/** Templates the commands run, by kit file id and their place under the templates folder. */
export const TPL = {
  todo: { id: "tpl-to-do-md", dest: "To-do.md" },
  meeting: { id: "tpl-weekly-meeting-md", dest: "Weekly meeting.md" },
  project: { id: "tpl-project-hub-md", dest: "Project hub.md" },
  projectNote: { id: "tpl-new-project-note-md", dest: "New project note.md" },
} as const;

/** Hand-offs the kit's To-do and New project note templates read (and delete) at their start. */
interface Handoff { vtPresetProject?: string; vtNewNoteFolder?: string }
const handoff = (): Handoff => window as unknown as Handoff;

export class PlanningCommands {
  /** `state` reads the planning kit's install record when needed (it is replaced on every install). */
  constructor(private plugin: Plugin, private state: () => ManagedState | null, private engine: TodoEngine) {}

  get app(): App { return this.plugin.app; }

  register(): void {
    const add = (id: string, name: string, run: () => Promise<void>): void => {
      this.plugin.addCommand({ id, name, callback: () => { void run().catch(e => this.failed(name, e)); } });
    };
    add("new-todo", "New to-do", () => this.newTodo());
    add("quick-capture", "Quick capture", () => this.quickCapture());
    add("add-to-shopping", "Add to shopping list", () => this.addToShopping());
    add("sort-inbox", "Sort inbox", () => this.sortInbox());
    add("archive-todos", "Archive old to-dos", () => this.archiveTodos());
    add("new-meeting", "New weekly meeting", () => this.fromTemplate(TPL.meeting, kitJoin(PLANNING_LAYOUT.meetings, MEETINGS_HUB)));
    add("new-project", "New project", () => this.fromTemplate(TPL.project, PLANNING_LAYOUT.projects));
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
    try { await this.fromTemplate(TPL.todo, kitJoin(PLANNING_LAYOUT.planning, "To-dos"), false); }   // not opened, as the old button
    finally { delete handoff().vtPresetProject; }   // the template deletes it when it runs; also gone when it didn't or failed
  }

  /** New note in a project; `folder` (the project's folder) is used without asking: for project cards. */
  async newProjectNote(folder?: string): Promise<void> {
    if (folder) handoff().vtNewNoteFolder = folder;
    try { await this.fromTemplate(TPL.projectNote, folder ?? PLANNING_LAYOUT.projects); }
    finally { delete handoff().vtNewNoteFolder; }
  }

  /** Where the planning kit installed this template, else where it would install it. */
  private templateFile(tpl: { id: string; dest: string }): TFile | null {
    const rec = this.state()?.files[tpl.id];
    const tracked = rec && !rec.userDeleted && !kitIsBackup(rec.path) ? rec.path : "";
    return [tracked, kitJoin(planningRoles(this.app, {}).templates, tpl.dest)]
      .map(p => (p ? this.app.vault.getFileByPath(p) : null)).find(f => f) ?? null;
  }

  /** Creates a note from a kit template with Templater in `folderPath` (the template then files it where it belongs). */
  private async fromTemplate(tpl: { id: string; dest: string }, folderPath: string, open = true): Promise<void> {
    if (!hasTemplater(this.app)) { new Notice("Templater is needed for this: install and enable it, then try again."); return; }
    const template = this.templateFile(tpl);
    if (!template) { new Notice(`Template not found: ${tpl.dest}`); return; }
    await ensureFolder(this.app.vault, folderPath);
    const folder = this.app.vault.getFolderByPath(folderPath);
    if (!folder) { new Notice(`Could not use the folder ${folderPath}.`); return; }
    if (!(await templaterCreateNote(this.app, template, folder, open))) new Notice("Templater couldn't create the note. Update it to the latest version, then try again.");
  }

  /** An empty note in the inbox, opened. */
  private async quickCapture(): Promise<void> {
    await ensureFolder(this.app.vault, INBOX);
    const path = uniquePath(INBOX, "Capture", "md", p => !!this.app.vault.getAbstractFileByPath(p));
    const file = await this.app.vault.create(path, "");
    await this.app.workspace.getLeaf(false).openFile(file);
  }

  private async addToShopping(): Promise<void> {
    const path = kitJoin(PLANNING_LAYOUT.planning, "Shopping list.md");
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
    return this.app.vault.getMarkdownFiles().filter(f => f.parent?.path === INBOX).sort((a, b) => a.stat.ctime - b.stat.ctime);
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
  private async sortInbox(): Promise<void> {
    const total = this.inboxNotes().length;
    if (!total) { new Notice("The inbox is empty."); return; }
    const roots = { knowledge: PLANNING_LAYOUT.knowledge, howto: PLANNING_LAYOUT.howtos, meetings: PLANNING_LAYOUT.meetings };
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
        await this.moveTo(file, kitJoin(PLANNING_LAYOUT.planning, "To-dos"), name);
      } else if (where === "project") {
        const hubs = this.app.vault.getMarkdownFiles()
          .filter(f => this.app.metadataCache.getFileCache(f)?.frontmatter?.kind === "project")
          .sort((a, b) => a.basename.localeCompare(b.basename));
        const hub = await pick(this.app, hubs.map(h => h.basename), hubs, "Which project?");
        if (!hub) { skipped++; continue; }
        await this.moveTo(file, hub.parent?.path ?? PLANNING_LAYOUT.projects, await this.askName(file));
      } else if (where === "knowledge" || where === "howto" || where === "meetings") {
        const folder = await this.pickFolder(roots[where]);
        if (!folder) { skipped++; continue; }
        await this.moveTo(file, folder, await this.askName(file));
      } else if (where === "archive") {
        await this.moveTo(file, ARCHIVE_INBOX);
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
    const prefix = kitJoin(PLANNING_LAYOUT.planning, "To-dos") + "/", now = new Date();
    const done = this.app.vault.getMarkdownFiles().filter(f =>
      f.path.startsWith(prefix) && isArchivable(this.app.metadataCache.getFileCache(f)?.frontmatter ?? {}, new Date(f.stat.mtime), now));
    if (done.length) await ensureFolder(this.app.vault, ARCHIVE);
    for (const f of done) {
      const target = uniquePath(ARCHIVE, f.basename, f.extension, p => !!this.app.vault.getAbstractFileByPath(p));
      await this.app.fileManager.renameFile(f, target);
    }
    new Notice(`Archived ${done.length} to-do${done.length === 1 ? "" : "s"}`);
  }

  /** Opens the deck set in the meetings hub (`deck_mac` / `deck_windows`) with this computer's default app. */
  private async openDeck(): Promise<void> {
    const hub = this.app.metadataCache.getFirstLinkpathDest(MEETINGS_HUB, "");
    const fm = (hub && this.app.metadataCache.getFileCache(hub)?.frontmatter) || {};
    const isMac = Platform.isMacOS;
    const deck = deckPath(fm, isMac);
    if (!deck) {
      new Notice(`No meeting deck set for ${isMac ? "Mac" : "this computer"} yet: add the path in ${MEETINGS_HUB} (${isMac ? "deck_mac" : "deck_windows"}).`);
      if (hub) await this.app.workspace.getLeaf(false).openFile(hub);
      return;
    }
    const shell = nodeModule("electron")?.shell;
    if (!shell) { new Notice("Opening the deck needs the desktop app."); return; }
    const error = await shell.openPath(deck);
    if (error) new Notice(`Couldn't open the deck: ${error}`);
  }
}
