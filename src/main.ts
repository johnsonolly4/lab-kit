// Lab Kit: live ```calc tables + kit updater. See STATUS.md.
import { Plugin } from "obsidian";
import { CalcRenderer } from "./calc/render";
import { KitController } from "./kit/ui";

export default class LabKitPlugin extends Plugin {
  calc!: CalcRenderer;
  kit!: KitController;

  async onload(): Promise<void> {
    this.calc = new CalcRenderer(this);
    this.kit = new KitController(this);
    await this.kit.load();
    this.kit.setup();

    this.calc.register();

    this.addCommand({
      id: "insert-calc-block",
      name: "Insert empty calc block",
      editorCallback: (editor) => editor.replaceSelection("```calc\nname: \ntitle: \n| Item | Value | Result |\n|---|---|---|\n| a | 1 | =B2*2 |\n```\n")
    });
  }
}
