// Lab Kit: live ```calc tables, hazard header + built-in kit. See STATUS.md.
import { Plugin } from "obsidian";
import { CalcRenderer } from "./calc/render";
import { HeaderRenderer } from "./header/render";
import { HeaderStore } from "./header/settings";
import { KitController } from "./kit/ui";
import { PLANNING_KIT, PLANNING_LAYOUT, kitJoin } from "./kit/paths";
import { PlanningCommands } from "./planning/commands";
import { TodoEngine } from "./planning/engine";

export default class LabKitPlugin extends Plugin {
  calc!: CalcRenderer;
  header!: HeaderRenderer;
  kit!: KitController;
  /** Planning commands; null without the planning kit. Project cards call `newTodo(project)` / `newProjectNote(folder)`. */
  planning: PlanningCommands | null = null;

  async onload(): Promise<void> {
    const store = new HeaderStore(this);
    await store.load();
    this.calc = new CalcRenderer(this, () => this.kit.kit);
    this.header = new HeaderRenderer(this, store);
    this.kit = new KitController(this, store);
    await this.kit.load();
    this.kit.setup();

    this.calc.register();
    this.header.register();

    // To-do engine and planning commands: only in a vault where the planning kit is switched on and installed (read once, at load)
    const planning = this.kit.kit.kits[PLANNING_KIT];
    if (planning?.enabled && planning.managed) {
      const engine = new TodoEngine(this, kitJoin(PLANNING_LAYOUT.planning, "To-dos"));
      engine.start();
      this.planning = new PlanningCommands(this, planning.managed, engine);
      this.planning.register();
    }

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
}
