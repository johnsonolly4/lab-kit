// Pressing Insert in the Alt+S form (labForm.js): the real script on a stubbed Obsidian. A `rows is not defined` error here made every form's Insert do nothing.
import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const labForm = require("../kits/lab/Extras/scripts/templater/labForm.js");

/** Opens the form, lets `act` type into it, presses Insert, and returns what the form resolved with (or "open" when it stayed open). */
async function submit(fields: any[], act: (v: Record<string, string>) => void = () => undefined): Promise<unknown> {
  const buttons: Record<string, () => void> = {};
  const inputs: Record<string, (v: string) => void> = {};
  let modal: any;
  class Modal {
    contentEl: any = { createEl: () => ({}), addEventListener: () => undefined, empty: () => undefined };
    titleEl = { setText: () => undefined };
    constructor() { modal = this; }
    open() { (this as any).onOpen(); }
    close() { (this as any).onClose(); }
  }
  class Setting {
    settingEl = { toggleClass: () => undefined };
    controlEl = { style: {} };
    private key = "";
    setName(n: string) { this.key = n.replace(/ \*$/, ""); return this; }
    setDesc() { return this; }
    setHeading() { return this; }
    addText(cb: (c: any) => void) {
      let change: (v: string) => void = () => undefined;
      const c: any = { inputEl: { style: {}, focus: () => undefined, select: () => undefined }, setPlaceholder: () => c, setValue: () => c, onChange: (f: (v: string) => void) => { change = f; return c; } };
      cb(c);
      inputs[this.key] = change;
      return this;
    }
    addTextArea(cb: (c: any) => void) { return this.addText(cb); }
    addButton(cb: (b: any) => void) {
      const b: any = { setButtonText: (t: string) => { b.text = t; return b; }, setCta: () => b, onClick: (f: () => void) => { buttons[b.text] = f; return b; } };
      cb(b);
      return this;
    }
  }
  (globalThis as any).app = {};
  const result = labForm({ obsidian: { Modal, Setting } }, "Rig", fields);
  const values: Record<string, string> = {};
  act(new Proxy(values, { set: (t, k: string, v: string) => { inputs[k]?.(v); t[k] = v; return true; } }));
  buttons["Insert"]();
  const first = await Promise.race([result, new Promise(r => setTimeout(() => r("open"), 20))]);
  if (first === "open") modal.close();
  return first;
}

describe("labForm Insert", () => {
  it("returns the answers when no field is mandatory", async () => {
    expect(await submit([{ key: "rig", label: "Rig", type: "text", value: "First test rig" }])).toEqual({ rig: "First test rig" });
  });
  it("returns the answers for a mandatory field that is filled", async () => {
    expect(await submit([{ key: "rig", label: "Rig", type: "text", value: "", required: true }], v => { v.Rig = "First test rig"; })).toEqual({ rig: "First test rig" });
  });
  it("stays open while a mandatory field is empty", async () => {
    expect(await submit([{ key: "rig", label: "Rig", type: "text", value: "", required: true }])).toBe("open");
  });
});
