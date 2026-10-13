// Both kits in one window and one confirmation (src/kit/kit-set.ts): section order, status lines, the merged confirmation.
import { describe, it, expect } from "vitest";
import { combinePreviews, kitFilesDesc, kitStatusLine, mergeParts, orderKits, runSafeUpdate, waitingCount, type KitPart, type KitSection, type SafeKit } from "../src/kit/kit-set";
import type { InstallPreview, ManagedAction, ManagedItem, ManagedResult } from "../src/kit/managed";

const item = (action: ManagedAction, n = 1): ManagedItem => ({ file: { id: `f${n}` } as never, dest: `x/${n}.md`, text: "", kitHash: "", curHash: null, action, untracked: false });
const kit = (id: string, name: string, actions: ManagedAction[], installed = true): KitSection => ({ id, name, installed, items: actions.map((a, i) => item(a, i)) });
const preview = (o: Partial<InstallPreview> = {}): InstallPreview => ({ create: [], update: [], leftAlone: [], folders: [], about: {}, ...o });
const part = (id: string, o: Partial<KitPart> = {}): KitPart => ({ id, name: id, preview: preview(), settings: [], notes: [], ask: false, folders: [], ...o });
const change = (name: string, desc: string) => ({ name, desc, apply: async () => {} });

describe("waitingCount", () => {
  it("counts updates, new, missing, merge and conflict; not what is up to date, kept, changed by you, detached or off", () => {
    expect(waitingCount([item("fast-forward"), item("create"), item("missing"), item("merge"), item("needs-merge")])).toBe(5);
    expect(waitingCount([item("up-to-date"), item("keep"), item("user-modified"), item("detached"), item("off")])).toBe(0);
  });
});

describe("orderKits", () => {
  it("the kit with something waiting comes first and starts open; an up-to-date kit comes last and starts folded", () => {
    const out = orderKits([kit("lab", "Lab kit", ["up-to-date", "up-to-date"]), kit("planning", "Planning kit", ["up-to-date", "fast-forward"])]);
    expect(out.map(k => [k.name, k.waiting, k.open])).toEqual([["Planning kit", 1, true], ["Lab kit", 0, false]]);
  });
  it("a kit that was never installed (all files new) is first; the most waiting first; ties by name", () => {
    const out = orderKits([kit("lab", "Lab kit", ["fast-forward"]), kit("planning", "Planning kit", ["create", "create", "create"], false)]);
    expect(out.map(k => k.name)).toEqual(["Planning kit", "Lab kit"]);
    const tie = orderKits([kit("b", "B kit", ["create"]), kit("a", "A kit", ["create"])]);
    expect(tie.map(k => k.name)).toEqual(["A kit", "B kit"]);
  });
  it("two up-to-date kits are both folded, in name order", () => {
    const out = orderKits([kit("p", "Planning kit", ["up-to-date"]), kit("l", "Lab kit", ["up-to-date"])]);
    expect(out.map(k => [k.name, k.open])).toEqual([["Lab kit", false], ["Planning kit", false]]);
  });
});

describe("kitStatusLine", () => {
  it("says what is bundled and installed, and how many files wait", () => {
    expect(kitStatusLine({ bundled: "1.1.0", installed: "1.1.0", tracked: 26, waiting: 0 })).toBe("Bundled v1.1.0 · installed v1.1.0, 26 files tracked");
    expect(kitStatusLine({ bundled: "1.1.0", installed: "1.0.1", tracked: 26, waiting: 3 })).toBe("Bundled v1.1.0 · installed v1.0.1, 26 files tracked · 3 waiting");
    expect(kitStatusLine({ bundled: "1.1.0", installed: null, tracked: 0, waiting: 29 })).toBe("Bundled v1.1.0 · not installed yet · 29 waiting");
  });
});

describe("mergeParts", () => {
  it("nothing to ask: no first install, no folder, no setting", () => {
    const m = mergeParts([part("lab"), part("planning")]);
    expect(m.needsConfirm).toBe(false);
    expect(m.parts.map(p => p.id)).toEqual(["lab", "planning"]);
  });
  it("a first install of either kit asks, even with nothing else", () => {
    expect(mergeParts([part("lab"), part("planning", { ask: true })]).needsConfirm).toBe(true);
  });
  it("a folder both kits would make is listed once", () => {
    const m = mergeParts([part("lab", { preview: preview({ folders: ["03 Lab Book", "05 Chemicals"] }) }), part("planning", { preview: preview({ folders: ["05 Chemicals", "00 Planning"] }) })]);
    expect(m.folders).toEqual(["03 Lab Book", "05 Chemicals", "00 Planning"]);
    expect(m.needsConfirm).toBe(true);
  });
  it("a setting both kits offer in the same words is one switch; the same name with different text stays two", () => {
    const same = change("Set Templater's user scripts folder", "To 07 How-tos/scripts. Templater has none yet.");
    const m = mergeParts([part("lab", { settings: [same, change("Turn on the CSS snippet", "scrolling-mermaid")] }), part("planning", { settings: [{ ...same }, change("Turn on the CSS snippet", "vault-colours, vault-theme")] })]);
    expect(m.settings.map(s => `${s.name} | ${s.desc}`)).toEqual([
      "Set Templater's user scripts folder | To 07 How-tos/scripts. Templater has none yet.",
      "Turn on the CSS snippet | scrolling-mermaid",
      "Turn on the CSS snippet | vault-colours, vault-theme",
    ]);
  });
  it("the notes of both kits are kept, in kit order", () => {
    const m = mergeParts([part("lab", { notes: [{ heading: "Old copies", paths: ["a"] }] }), part("planning", { notes: [{ heading: "Left alone", paths: ["b"] }] })]);
    expect(m.notes.map(n => n.heading)).toEqual(["Old copies", "Left alone"]);
  });
});

describe("combinePreviews", () => {
  it("puts both kits' files in one list, folders once, and what each file is for", () => {
    const c = combinePreviews([part("lab", { preview: preview({ create: ["a"], update: ["b"], folders: ["F"], about: { a: "A" } }) }), part("planning", { preview: preview({ create: ["c"], leftAlone: ["d"], folders: ["F", "G"], about: { c: "C" } }) })]);
    expect(c).toEqual({ create: ["a", "c"], update: ["b"], leftAlone: ["d"], folders: ["F", "G"], about: { a: "A", c: "C" } });
  });
});

describe("runSafeUpdate", () => {
  const result = (dest: string): ManagedResult => ({ id: dest, dest, action: "create", outcome: "created" });
  /** A fake kit that logs what it is asked to do. */
  const fake = (id: string, log: string[], o: { part?: Partial<KitPart>; results?: ManagedResult[]; fail?: boolean } = {}): SafeKit => ({
    id, name: id, plan: async () => ({
      part: part(id, o.part),
      ensure: async () => { log.push(`${id}:ensure`); },
      run: async () => { log.push(`${id}:run`); if (o.fail) throw new Error(`${id} broke`); return o.results ?? [result(`${id}.md`)]; },
    }),
  });

  it("nothing to ask: each kit is written in turn and the results are joined; confirm is never called", async () => {
    const log: string[] = [];
    const out = await runSafeUpdate([fake("lab", log), fake("planning", log)], async () => { log.push("confirm"); return []; });
    expect(log).toEqual(["lab:ensure", "lab:run", "planning:ensure", "planning:run"]);
    expect(out).toEqual({ cancelled: false, results: [result("lab.md"), result("planning.md")], failed: [] });
  });
  it("one confirmation for both kits; the answer's settings changes are made after the files", async () => {
    const log: string[] = [];
    let asked = 0;
    const css = { name: "Turn on the CSS snippet", desc: "both", apply: async () => { log.push("css"); } };
    const out = await runSafeUpdate([fake("lab", log, { part: { ask: true, settings: [css] } }), fake("planning", log, { part: { settings: [{ ...css }] } })], async merged => { asked++; expect(merged.settings).toHaveLength(1); return merged.settings; });
    expect(asked).toBe(1);
    expect(log).toEqual(["lab:ensure", "lab:run", "planning:ensure", "planning:run", "css"]);
    expect(out.cancelled).toBe(false);
  });
  it("Cancel writes nothing in either kit", async () => {
    const log: string[] = [];
    const out = await runSafeUpdate([fake("lab", log, { part: { ask: true } }), fake("planning", log)], async () => null);
    expect(out).toEqual({ cancelled: true });
    expect(log).toEqual([]);
  });
  it("a settings change the user switched off is not made", async () => {
    const log: string[] = [];
    const s = { name: "Set Templater's folder", desc: "x", apply: async () => { log.push("setting"); } };
    await runSafeUpdate([fake("lab", log, { part: { settings: [s] } })], async () => []);
    expect(log).toEqual(["lab:ensure", "lab:run"]);
  });
  it("a kit that fails is named and does not stop the other; a failing setting is named too", async () => {
    const log: string[] = [];
    const bad = { name: "Bad setting", desc: "y", apply: async () => { throw new Error("no"); } };
    const out = await runSafeUpdate([fake("lab", log, { fail: true, part: { settings: [bad] } }), fake("planning", log)], async m => m.settings);
    expect(log).toEqual(["lab:ensure", "lab:run", "planning:ensure", "planning:run"]);
    expect(out.cancelled).toBe(false);
    if (!out.cancelled) {
      expect(out.results).toEqual([result("planning.md")]);
      expect(out.failed.map(f => f.name)).toEqual(["lab", "Bad setting"]);
    }
  });
  it("with one kit it is the same run", async () => {
    const log: string[] = [];
    const out = await runSafeUpdate([fake("lab", log)], async () => []);
    expect(out).toEqual({ cancelled: false, results: [result("lab.md")], failed: [] });
  });
});

describe("kitFilesDesc", () => {
  it("each kit's installed version and files, with the bundled version only when it differs or the kit is not installed", () => {
    expect(kitFilesDesc([{ name: "Lab kit", bundled: "1.1.0", installed: "1.1.0", tracked: 26 }, { name: "Planning kit", bundled: "1.1.0", installed: "1.0.1", tracked: 29 }]))
      .toBe("Lab kit: v1.1.0, 26 files tracked · Planning kit: v1.0.1, 29 files tracked (bundled v1.1.0)");
    expect(kitFilesDesc([{ name: "Planning kit", bundled: "1.1.0", installed: null, tracked: 0 }])).toBe("Planning kit: not installed yet (bundled v1.1.0)");
  });
});
