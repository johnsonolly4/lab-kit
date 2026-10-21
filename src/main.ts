// Lab Kit: live ```calc tables, hazard header + built-in kit. See STATUS.md.
import { openSnippetForm } from "./kit/snippet-form";
import { registerNoteFill, type CustomFill } from "./kit/note-fill-ui";
import { Plugin } from "obsidian";
import { CalcRenderer } from "./calc/render";
import { HeaderRenderer } from "./header/render";
import { HeaderStore } from "./header/settings";
import { KitController } from "./kit/ui";
import { PLANNING_KIT, todoFolder } from "./kit/paths";
import { PlanningCommands } from "./planning/commands";
import { TodoEngine } from "./planning/engine";
import { ymd } from "./planning/todo";
import { metadataResolved } from "./kit/obsidian-private";
import { refreshBoards, registerBoardView } from "./planning/board-view";
import { bridgeOnDelete } from "./planning/after-bridge";
import { registerLabBoardView } from "./lab/lab-board-view";
import { PlanningBlocks } from "./planning/blocks";
import { ProgressWriter } from "./planning/progress";
import { BoardColours } from "./kit/board-colours";
import { applyStyleAllNotes } from "./kit/style-all-notes";
import { calcTextRefs } from "./calc/text-refs-cm";
import { SnippetTemplates } from "./kit/snippet-run";
import { RigRenderer } from "./rig/render";
import { SolutionRenderer } from "./solution/render";
import { RaftRenderer } from "./blocks/raft/render";

export default class LabKitPlugin extends Plugin {
  calc!: CalcRenderer;
  header!: HeaderRenderer;
  kit!: KitController;
  /** Planning commands; null without the planning kit. Project cards call `newTodo(project)` / `newProjectNote(folder)`. */
  planning: PlanningCommands | null = null;
  /** Alt+S: the Insert snippet command and the old Insert snippet.md (Templater) use `menu`, `meta` and `run` on it. */
  snippets!: SnippetTemplates;
  private store!: HeaderStore;

  async onload(): Promise<void> {
    const store = this.store = new HeaderStore(this);
    await store.load();
    this.calc = new CalcRenderer(this, () => this.kit.kit);
    this.header = new HeaderRenderer(this, store);
    this.kit = new KitController(this, store);
    await this.kit.load();
    this.snippets = new SnippetTemplates(this.app, () => this.kit.kit, () => this.kit.save(), openSnippetForm(this.app, () => this.kit.kit.snippetFormsAtCursor), undefined, () => this.manifest.version);
    this.kit.snippets = this.snippets;
    this.kit.setup();
    // Self-filling note: a note opened in a folder of Settings → Folder templates is filled by Lab Kit (src/kit/note-fill.ts)
    const planningOn = (): boolean => !!this.kit.planning?.slot.enabled;
    registerNoteFill(this, { kit: () => this.kit.kit, planningOn, form: () => openSnippetForm(this.app, () => this.kit.kit.snippetFormsAtCursor),
      templateFolders: () => [...(planningOn() ? [this.kit.planning!.templatesFolder()] : []), this.kit.managed.templatesFolder()],
      custom: (): Record<string, CustomFill> => this.planning ? { "To-do.md": this.planning.todoFill() } : {} });

    this.calc.register();
    this.registerEditorExtension(calcTextRefs());
    this.header.register();
    new RigRenderer(this, () => this.kit.kit.figuresFolder).register();
    new SolutionRenderer(this, () => this.kit.kit, openSnippetForm(this.app, () => this.kit.kit.snippetFormsAtCursor)).register();
    new RaftRenderer(this, () => this.kit.kit, openSnippetForm(this.app, () => this.kit.kit.snippetFormsAtCursor)).register();
    // Homepage blocks: always registered, so a homepage never shows raw code (they say so while the planning kit is off)
    const blocks = new PlanningBlocks(this, () => this.kit.kit, () => this.planning);
    blocks.register();
    this.kit.onChanged = () => blocks.refresh();

    // Lab board (own Bases view in the kit's Lab book base): always registered, the lab kit has no start step
    registerLabBoardView(this, {
      todoFolder: () => (this.kit.kit.kits[PLANNING_KIT]?.enabled ? todoFolder(this.kit.kit.planningFolders) : null),
      newLabEntry: status => void this.kit.newLabEntry(status ? { status } : {}),
    });

    new ProgressWriter(this, () => this.kit.kit).start();
    const colours = new BoardColours(this, () => this.kit.kit);
    colours.start();
    this.kit.boardColoursChanged = () => colours.apply();
    // Style all notes: the planning snippet's every-note rules apply to all notes while this body class is on (default off)
    const styleAll = (): void => applyStyleAllNotes(activeDocument.body, this.kit.kit.styleAllNotes);
    styleAll();
    this.kit.styleAllNotesChanged = styleAll;
    this.register(() => applyStyleAllNotes(activeDocument.body, false));

    // To-do engine and planning commands: once the planning kit is switched on and installed (at load, or right after its install)
    this.startPlanning();
    this.kit.onInstalled = () => this.startPlanning();

    this.addCommand({
      id: "insert-calc-block",
      name: "Insert empty calc block",
      editorCallback: (editor) => editor.replaceSelection("```calc\nname: \ntitle: \n| Item | Value | Result |\n|---|---|---|\n| a | 1 | =B2*2 |\n```\n")
    });
    this.addCommand({
      id: "insert-lab-header",
      name: "Insert lab header block",
      editorCallback: (editor) => editor.replaceSelection("```lab-header\n```\n")
    });
  }

  /**
   * data.json changed on disk while Obsidian is open (Obsidian Sync, iCloud, Dropbox, Syncthing, Git, another program): read it again,
   * so open views show the new values and the next save doesn't write the old ones back over them.
   */
  async onExternalSettingsChange(): Promise<void> {
    await this.store.load();
    this.store.onChange();
    await this.kit.load();
    this.kit.redrawSettings?.();
    this.kit.onChanged?.();
  }

  /** The daily check that freezes meeting notes dated before today (I19): once the note properties are read, then whenever the day changes. */
  private scheduleFreeze(planning: PlanningCommands): void {
    let last = "";
    const run = (): void => {
      if (this.kit.kit.freezeAuto === false) return;   // off in Settings: not marked as done, so switching it on freezes at the next 15-minute check
      const today = ymd(new Date());
      if (today === last) return;
      last = today;
      void planning.freezeDueNotes().catch(e => console.error("Lab Kit", "freeze", e));
    };
    this.app.workspace.onLayoutReady(() => {
      if (metadataResolved(this.app)) run();
      else { const ref = this.app.metadataCache.on("resolved", () => { this.app.metadataCache.offref(ref); run(); }); this.registerEvent(ref); }
      this.registerInterval(window.setInterval(run, 15 * 60 * 1000));
    });
  }

  /** Starts the to-do engine and registers the planning commands, once, when the planning kit is on and installed. Switching it off needs a reload. */
  startPlanning(): void {
    const planning = this.kit.kit.kits[PLANNING_KIT];
    if (this.planning || !planning?.enabled || !planning.managed) return;
    const engine = new TodoEngine(this, () => todoFolder(this.kit.kit.planningFolders), () => this.kit.kit.dueCountdown);
    this.kit.dueCountdownChanged = () => engine.retag();
    engine.start();
    bridgeOnDelete(this, () => todoFolder(this.kit.kit.planningFolders));
    this.planning = new PlanningCommands(this, () => this.kit.kit.kits[PLANNING_KIT]?.managed ?? null, () => this.kit.kit, this.kit.folderGuard);
    this.planning.register();
    this.scheduleFreeze(this.planning);
    registerBoardView(this, { kit: () => this.kit.kit, series: () => this.planning?.seriesList() ?? [], newTodo: day => this.planning?.newTodoOn(day) });
    this.kit.boardChanged = refreshBoards;
  }
}
