// Lab Kit: live ```calc tables, hazard header + built-in kit. See STATUS.md.
import { Plugin } from "obsidian";
import { CalcRenderer } from "./calc/render";
import { HeaderRenderer } from "./header/render";
import { HeaderStore } from "./header/settings";
import { KitController } from "./kit/ui";
import { PLANNING_KIT, todoFolder } from "./kit/paths";
import { PlanningCommands } from "./planning/commands";
import { TodoEngine } from "./planning/engine";
import { PlanningBlocks } from "./planning/blocks";

export default class LabKitPlugin extends Plugin {
  calc!: CalcRenderer;
  header!: HeaderRenderer;
  kit!: KitController;
  /** Planning commands; null without the planning kit. Project cards call `newTodo(project)` / `newProjectNote(folder)`. */
  planning: PlanningCommands | null = null;
  private store!: HeaderStore;

  async onload(): Promise<void> {
    const store = this.store = new HeaderStore(this);
    await store.load();
    this.calc = new CalcRenderer(this, () => this.kit.kit);
    this.header = new HeaderRenderer(this, store);
    this.kit = new KitController(this, store);
    await this.kit.load();
    this.kit.setup();

    this.calc.register();
    this.header.register();
    // Homepage blocks: always registered, so a homepage never shows raw code (they say so while the planning kit is off)
    const blocks = new PlanningBlocks(this, () => this.kit.kit, () => this.planning);
    blocks.register();
    this.kit.onChanged = () => blocks.refresh();

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

  /** Starts the to-do engine and registers the planning commands, once, when the planning kit is on and installed. Switching it off needs a reload. */
  startPlanning(): void {
    const planning = this.kit.kit.kits[PLANNING_KIT];
    if (this.planning || !planning?.enabled || !planning.managed) return;
    const engine = new TodoEngine(this, () => todoFolder(this.kit.kit.planningFolders));
    engine.start();
    this.planning = new PlanningCommands(this, () => this.kit.kit.kits[PLANNING_KIT]?.managed ?? null, engine, () => this.kit.kit, this.kit.folderGuard);
    this.planning.register();
  }
}
