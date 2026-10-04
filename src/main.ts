// Lab Kit: live ```calc tables, hazard header + built-in kit. See STATUS.md.
import { Plugin } from "obsidian";
import { CalcRenderer } from "./calc/render";
import { HeaderRenderer } from "./header/render";
import { HeaderStore } from "./header/settings";
import { KitController } from "./kit/ui";

export default class LabKitPlugin extends Plugin {
  calc!: CalcRenderer;
  header!: HeaderRenderer;
  kit!: KitController;

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
