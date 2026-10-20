// The plugin's Alt+S question window (I23 Phase 2): the helpers answer exactly as labForm.js does, and token templates ask through it.
import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { TFile } from "obsidian";
import { formFooter, currentItem, matchNames, missingRequired, replaceItem, startValues, PILL_MAX, type FormField, type FormFn } from "../src/kit/snippet-form";
import { SnippetTemplates, type SnippetTp } from "../src/kit/snippet-run";
import { KIT_DEFAULTS, type KitData } from "../src/kit/paths";

const old = createRequire(import.meta.url)("../kits/lab/Extras/scripts/templater/labForm.js");

describe("plugin form helpers = labForm.js", () => {
  const entries = [
    { name: "Toluene", aliases: ["methylbenzene"] },
    { name: "Tetrahydrofuran", aliases: ["THF"] },
    { name: "Dichloromethane", aliases: ["DCM", "methylene chloride"] },
    { name: "Water" },
  ];
  it("matchNames ranks and limits the same", () => {
    for (const q of ["", "t", "tol", "th", "m", "ene", "xyz", "  DCM "]) {
      expect(matchNames(entries, q)).toEqual(old.matchNames(entries, q));
      expect(matchNames(entries, q, 2)).toEqual(old.matchNames(entries, q, 2));
    }
  });
  it("currentItem / replaceItem find and replace the item being typed", () => {
    for (const [v, c] of [["DCM, tol", 8], ["a\n  b", 5], ["", 0], ["tol", 2], ["x, y, z", 4]] as [string, number][]) {
      expect(currentItem(v, c)).toEqual(old.currentItem(v, c));
      expect(replaceItem(v, c, "Toluene")).toEqual(old.replaceItem(v, c, "Toluene"));
    }
    expect(replaceItem("DCM, tol, THF", 8, "Toluene")).toEqual({ value: "DCM, Toluene, THF", cursor: 12 });
  });
  it("missingRequired skips toggles, selects and headings", () => {
    const fields: FormField[] = [{ key: "a", label: "A", required: true }, { key: "b", label: "B" }, { key: "c", label: "C", type: "toggle", required: true }, { key: "d", label: "D", required: true, type: "number" }];
    const values = { a: "  ", b: "", c: false, d: "" };
    expect(missingRequired(fields, values)).toEqual(["a", "d"]);
    expect(missingRequired(fields, values)).toEqual(old.missingRequired(fields, values));
    expect(missingRequired(fields, { a: "x", b: "", c: false, d: "0" })).toEqual([]);
  });
});

describe("form footer follows the button", () => {
  it("Save reads Enter saves, the default Insert reads Enter inserts", () => {
    expect(formFooter("Save")).toBe("Enter saves · Esc cancels");
    expect(formFooter()).toBe("Enter inserts · Esc cancels");
    expect(formFooter("Insert")).toBe("Enter inserts · Esc cancels");
  });
});

describe("startValues", () => {
  it("gives the answers an untouched Insert returns, per field type", () => {
    const fields: FormField[] = [
      { key: "name", label: "Name", value: "Solution 1" },
      { key: "n", label: "N", type: "number", value: 5 },
      { key: "note", label: "Note", type: "textarea" },
      { key: "nmr", label: "NMR", type: "toggle", value: true },
      { key: "off", label: "Off", type: "toggle" },
      { key: "mode", label: "Mode", type: "select", options: [{ value: "a" }, { value: "b" }] },
      { key: "mode2", label: "Mode 2", type: "select", options: [{ value: "a" }, { value: "b" }], value: "b" },
      { key: "h", label: "Heading", type: "heading" },
    ];
    expect(startValues(fields)).toEqual({ name: "Solution 1", n: "5", note: "", nmr: true, off: false, mode: "a", mode2: "b" });
  });
  it("short choices are pills, longer ones a dropdown", () => { expect(PILL_MAX).toBe(3); });
});

describe("token templates ask through the plugin form", () => {
  const template = `---\n${JSON.stringify({ title: "Name", fields: [{ key: "name", label: "Name", value: "Sample" }] })}\n---\nHello {{name}}\n`;
  const file = new TFile({ path: "S/t.md", basename: "t" });
  const app = {
    vault: { cachedRead: async () => template },
    workspace: { activeEditor: null, getActiveFile: () => null },
    metadataCache: { getFileCache: () => null, getFirstLinkpathDest: () => null },
  };
  const kit = { ...KIT_DEFAULTS, initials: "ABC" } as KitData;
  const tp = (): SnippetTp & { asked: number } => {
    const t = { asked: 0, user: { labForm: async () => { t.asked++; return { name: "from Templater" }; } } };
    return t as never;
  };

  it("uses the injected form, not tp.user.labForm", async () => {
    const seen: string[] = [];
    const form: FormFn = async (title, fields) => { seen.push(title, fields[0].key); return { name: "Ada" }; };
    const t = tp();
    expect(await new SnippetTemplates(app as never, () => kit, undefined, form).run(t, file)).toBe("Hello Ada\n");
    expect(seen).toEqual(["Name", "name"]);
    expect(t.asked).toBe(0);
  });
  it("a cancelled form inserts nothing", async () => {
    expect(await new SnippetTemplates(app as never, () => kit, undefined, async () => null).run(tp(), file)).toBe("");
  });
  it("without a plugin form it still asks labForm.js on tp", async () => {
    const t = tp();
    expect(await new SnippetTemplates(app as never, () => kit).run(t, file)).toBe("Hello from Templater\n");
    expect(t.asked).toBe(1);
  });
});
