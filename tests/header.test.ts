import { describe, it } from "vitest";
import { TFile } from "obsidian";
import assert from "node:assert";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { LEVELS, levelIndex, phraseLevel, severity } from "../src/header/ghs";
import { collectHazards, hazardSignature, hazardSources } from "../src/header/hazards";
import { HeaderRenderer } from "../src/header/render";
import { HEADER_DEFAULTS, hazardView, parseBlock, type HeaderStore } from "../src/header/settings";

const { El } = createRequire(import.meta.url)("./helpers/minidom.cjs");
const fixture: Record<string, Record<string, unknown>> = JSON.parse(readFileSync(new URL("./fixtures/hazard-chemicals.json", import.meta.url), "utf8"));

/** Fake vault + metadata cache backed by the fixture; `data` can be edited to simulate the user changing a note. */
function fakeApp(data = structuredClone(fixture)) {
  const files = () => Object.keys(data).map(path => new TFile({ path, basename: path.split("/").pop()!.replace(/\.md$/, "") }));
  const handlers: Record<string, ((...a: any[]) => void)[]> = {};
  const on = (evt: string, fn: (...a: any[]) => void) => { (handlers[evt] ||= []).push(fn); return {}; };
  const app: any = {
    vault: { getAbstractFileByPath: (p: string) => files().find(f => f.path === p) ?? null, on },
    metadataCache: {
      getFileCache: (f: { path: string }) => ({ frontmatter: data[f.path] }),
      getFirstLinkpathDest: (name: string) => files().find(f => f.basename.toLowerCase() === name.toLowerCase()) ?? null,
      on
    },
    workspace: { openLinkText: async () => { /* unused */ } }
  };
  const fire = (evt: string, ...a: any[]) => (handlers[evt] ?? []).forEach(fn => fn(...a));
  return { app, data, fire };
}

describe("ghs", () => {
  it("maps H-codes to levels; combined phrases use the worst part", () => {
    assert.strictEqual(LEVELS[phraseLevel("H225 Highly flammable")].name, "High");
    assert.strictEqual(LEVELS[phraseLevel("H314 Causes severe burns")].name, "Severe");
    assert.strictEqual(LEVELS[phraseLevel("H319 Eye irritation")].name, "Moderate");
    assert.strictEqual(LEVELS[phraseLevel("H336 Drowsiness")].name, "Low");
    assert.strictEqual(LEVELS[phraseLevel("H412 Harmful to aquatic life")].name, "None");
    assert.strictEqual(LEVELS[phraseLevel("H300+H310 Fatal")].name, "Severe");
    assert.strictEqual(LEVELS[phraseLevel("no code here")].name, "None");
    assert.strictEqual(levelIndex("W", "5"), 3);
    assert.ok(severity("H225").score < severity("H319").score);
  });
});

describe("collectHazards", () => {
  it("lists chemicals worst first, with missing notes and missing H_Phrase", () => {
    const { app } = fakeApp();
    const d = collectHazards(app, "notes/0014 - Test.md");
    assert.strictEqual(d.hidden, false);
    // Acetone (High x2 first by count), Ethanol (High x1), Water (no phrases), then the missing note
    assert.deepStrictEqual(d.rows.map(r => r.name), ["Acetone", "Ethanol", "Water", "Missing reagent"]);
    assert.strictEqual(d.rows[0].phrases[0].text.slice(0, 4), "H225");
    assert.strictEqual(d.rows[2].phrases.length, 0);
    assert.strictEqual(d.rows[3].path, null);
  });

  it("hides the table for configured Exp. Class values, ignoring capitals", () => {
    const { app } = fakeApp();
    assert.strictEqual(collectHazards(app, "notes/0015 - Setup.md").hidden, true);
  });

  it("tracks which notes it depends on", () => {
    const { app } = fakeApp();
    const d = collectHazards(app, "notes/0014 - Test.md");
    assert.deepStrictEqual([...hazardSources("notes/0014 - Test.md", d)].sort(),
      ["chem/Acetone.md", "chem/Ethanol.md", "chem/Water.md", "notes/0014 - Test.md"]);
  });

  it("signature ignores unrelated edits but changes with H_Phrase or Chemicals", () => {
    const { app, data } = fakeApp();
    const sig = () => hazardSignature(collectHazards(app, "notes/0014 - Test.md"));
    const before = sig();
    data["notes/0014 - Test.md"].Status = ["Done"];
    assert.strictEqual(sig(), before);
    data["chem/Water.md"].H_Phrase = ["H314 Causes severe skin burns"];
    assert.notStrictEqual(sig(), before);
  });
});

describe("HeaderRenderer", () => {
  function setup() {
    const world = fakeApp();
    let proc: ((src: string, el: any, ctx: any) => void) | undefined;
    const plugin: any = { app: world.app, registerMarkdownCodeBlockProcessor: (_n: string, fn: any) => { proc = fn; }, registerEvent() { /* unused */ } };
    const store = { settings: { ...HEADER_DEFAULTS }, onChange() { /* replaced */ } } as unknown as HeaderStore;
    const renderer = new HeaderRenderer(plugin, store);
    renderer.register();
    return { ...world, renderer, store, mount: (path: string, source = "") => { const el = new El("div"); proc!(source, el, { sourcePath: path }); return el; } };
  }

  it("renders chips: one row per chemical, a chip per H-code", () => {
    const { mount } = setup();
    const el = mount("notes/0014 - Test.md");
    assert.strictEqual(el.querySelectorAll(".lab-hazard-row").length, 4);
    const chips = el.querySelectorAll(".lab-hazard-chips .lab-hazard-chip").map((c: any) => c.textContent);
    assert.ok(chips.includes("H336"));
    assert.ok(el.querySelector("summary").textContent.includes("4 chemicals"));
    assert.ok(el.textContent.includes("no chemical note found"));
    assert.ok(el.textContent.includes("no H_Phrase"));
  });

  it("renders the table layout when chosen", () => {
    const { mount, store } = setup();
    store.settings.layout = "table";
    const el = mount("notes/0014 - Test.md");
    assert.strictEqual(el.querySelectorAll("tbody tr").length, 4);
    assert.strictEqual(el.querySelectorAll(".lab-hazard-row").length, 0);
  });

  it("renders no hazards for in-silico/setup notes", () => {
    const { mount } = setup();
    const el = mount("notes/0015 - Setup.md");
    assert.strictEqual(el.querySelector("details"), null);
  });

  it("redraws only when its own inputs change (the stutter fix)", () => {
    const { mount, renderer, data } = setup();
    const el = mount("notes/0014 - Test.md");
    assert.strictEqual(renderer.draws, 1);

    // Another note changes, and this note is edited without touching Chemicals: no redraw
    renderer.refreshFor("notes/0015 - Setup.md");
    data["notes/0014 - Test.md"].Status = ["Done"];
    renderer.refreshFor("notes/0014 - Test.md");
    assert.strictEqual(renderer.draws, 1);

    // A linked chemical's H_Phrase changes: redraw once
    data["chem/Water.md"].H_Phrase = ["H314 Causes severe skin burns"];
    renderer.refreshFor("chem/Water.md");
    assert.strictEqual(renderer.draws, 2);
    assert.ok(el.querySelector("summary").textContent.includes("Severe"));

    // The missing chemical's note appears: redraw (block reacts to any change while a chemical is unresolved)
    data["chem/Missing reagent.md"] = { H_Phrase: ["H302 Harmful if swallowed"] };
    renderer.refreshFor("chem/Missing reagent.md");
    assert.strictEqual(renderer.draws, 3);
    assert.ok(!el.textContent.includes("no chemical note found"));
  });

  it("keeps the open/closed state of the summary across redraws", () => {
    const { mount, renderer, data } = setup();
    const el = mount("notes/0014 - Test.md");
    el.querySelector("details").open = false;
    data["chem/Water.md"].H_Phrase = ["H314 Causes severe skin burns"];
    renderer.refreshFor("chem/Water.md");
    assert.strictEqual(el.querySelector("details").open, false);
  });

  it("honours the restored options (settings, and lines inside the block)", () => {
    const { mount, store } = setup();
    const path = "notes/0014 - Test.md";
    const names = (el: any) => el.querySelectorAll(".lab-hazard-name").map((n: any) => n.textContent);

    // collapsed: false → no <details>, no summary
    store.settings.collapsed = false;
    let el = mount(path);
    assert.strictEqual(el.querySelector("details"), null);
    assert.strictEqual(el.querySelectorAll(".lab-hazard-row").length, 4);
    store.settings.collapsed = true;

    // startOpen: false → closed on first draw
    store.settings.startOpen = false;
    assert.strictEqual(mount(path).querySelector("details").open, false);
    store.settings.startOpen = true;

    // sortByWorstHazard: false → A to Z; showMissing: false → the unresolved chemical is dropped, Water (no H_Phrase) stays blank
    store.settings.sortByWorstHazard = false; store.settings.showMissing = false;
    el = mount(path);
    assert.deepStrictEqual(names(el), ["Acetone", "Ethanol", "Water"]);
    assert.ok(!el.textContent.includes("⚠ no"));
    store.settings.sortByWorstHazard = true; store.settings.showMissing = true;

    // showCategoryLabels, highlightWholePhrase, legend, summary counts
    store.settings.showCategoryLabels = true; store.settings.showLegend = false; store.settings.showSummaryCounts = false;
    el = mount(path);
    assert.ok(el.textContent.includes("Cat 2"));
    assert.strictEqual(el.querySelectorAll(".lab-hazard-legend").length, 0);
    assert.ok(!el.querySelector("summary").textContent.includes("chemical"));
    store.settings.showCategoryLabels = false; store.settings.showLegend = true; store.settings.showSummaryCounts = true;
    store.settings.highlightWholePhrase = true;
    el = mount(path);
    assert.ok(el.querySelectorAll(".lab-hazard-chips .lab-hazard-chip").some((c: any) => c.textContent.startsWith("H225 Highly")));
    store.settings.highlightWholePhrase = false;

    // legendDetails adds the category text; shade/centre in the table layout
    store.settings.legendDetails = true; store.settings.layout = "table"; store.settings.shadeChemicalCell = false;
    el = mount(path);
    assert.ok(el.querySelectorAll(".lab-hazard-legend-desc").length === LEVELS.length);
    assert.strictEqual(el.querySelectorAll("td.lab-hazard-name.is-centred").length, 4);
    assert.strictEqual(el.querySelectorAll("td.lab-hazard-name").filter((t: any) => t.getAttribute("data-level") != null).length, 0);
    store.settings.centreChemicalCell = false;
    assert.strictEqual(mount(path).querySelectorAll("td.is-centred").length, 0);
  });

  it("reads per-note overrides from the block and can drop the button or the hazards", () => {
    const { mount } = setup();
    const path = "notes/0014 - Test.md";
    let el = mount(path, "layout: table\ncollapsed: false\nnonsense: 1\nshowLegend: maybe");
    assert.strictEqual(el.querySelectorAll("tbody tr").length, 4);
    assert.strictEqual(el.querySelector("details"), null);
    assert.ok(el.querySelectorAll(".lab-hazard-legend").length === 1, "bad value ignored");
    assert.ok(el.querySelector("button"));
    el = mount(path, "dataFolder: false\nhazards: false");
    assert.strictEqual(el.querySelector("button"), null);
    assert.strictEqual(el.querySelector("details"), null);
    const b = parseBlock("startOpen: false\nhideForClasses: a, b");
    assert.deepStrictEqual(b.over, { startOpen: false, hideForClasses: "a, b" });
    assert.strictEqual(hazardView(HEADER_DEFAULTS, b.over).startOpen, false);
    assert.strictEqual(hazardView(HEADER_DEFAULTS).startOpen, true);
  });
});
