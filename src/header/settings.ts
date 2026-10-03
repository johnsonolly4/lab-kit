// Settings for the ```lab-header block, saved under the `header` key of data.json (the updater keeps `kit`).
// Every hazard option can also be set for one note, as `key: value` lines inside the block.
import { Setting, type Plugin } from "obsidian";

/** How the hazards look and behave. Names match the options of the old Dataview script. */
export interface HazardView {
  layout: "chips" | "table";
  chemicalsProperty: string;
  classProperty: string;
  /** Comma-separated Exp. Class values that get no hazard table. */
  hideForClasses: string;
  /** Put the hazards behind a clickable one-line summary. */
  collapsed: boolean;
  /** That summary starts expanded. */
  startOpen: boolean;
  showSummaryCounts: boolean;
  showLegend: boolean;
  /** Show the GHS categories under each legend item. */
  legendDetails: boolean;
  /** Most hazardous chemical first; off = A to Z. */
  sortByWorstHazard: boolean;
  /** Colour the whole phrase, not just the H-code. */
  highlightWholePhrase: boolean;
  /** Add "Cat 2" after each code. */
  showCategoryLabels: boolean;
  /** Shade the chemical name with its worst hazard colour. */
  shadeChemicalCell: boolean;
  /** Centre the chemical name (table layout). */
  centreChemicalCell: boolean;
  /** List chemicals that have no note or no H_Phrase. */
  showMissing: boolean;
}

export interface HeaderSettings extends HazardView {
  dataRootWindows: string;
  dataRootMac: string;
}

export const HEADER_DEFAULTS: HeaderSettings = {
  layout: "chips",
  chemicalsProperty: "Chemicals",
  classProperty: "Exp. Class",
  hideForClasses: "in-silico, setup",
  collapsed: true,
  startOpen: true,
  showSummaryCounts: true,
  showLegend: true,
  legendDetails: false,
  sortByWorstHazard: true,
  highlightWholePhrase: false,
  showCategoryLabels: false,
  shadeChemicalCell: true,
  centreChemicalCell: true,
  showMissing: true,
  dataRootWindows: "",
  dataRootMac: ""
};

export const splitClasses = (s: string): string[] => s.split(",").map(x => x.trim()).filter(Boolean);

const HAZARD_KEYS = Object.keys(HEADER_DEFAULTS).filter(k => !k.startsWith("dataRoot")) as (keyof HazardView)[];

/** Options only a block can set: leave out the data-folder button or the hazards. */
export interface BlockOptions { dataFolder: boolean; hazards: boolean }

/** Reads `key: value` lines from a ```lab-header block. Unknown keys and bad values are ignored. */
export function parseBlock(source: string): { block: BlockOptions; over: Partial<HazardView> } {
  const block: BlockOptions = { dataFolder: true, hazards: true };
  const over: Record<string, unknown> = {};
  for (const line of source.split("\n")) {
    const m = line.match(/^\s*([A-Za-z]+)\s*:\s*(.*?)\s*$/);
    if (!m) continue;
    const [, key, raw] = m;
    const bool = raw.toLowerCase() === "true" ? true : raw.toLowerCase() === "false" ? false : undefined;
    if (key === "dataFolder" || key === "hazards") { if (bool !== undefined) block[key] = bool; continue; }
    if (!(HAZARD_KEYS as string[]).includes(key)) continue;
    const def = HEADER_DEFAULTS[key as keyof HazardView];
    if (typeof def === "boolean") { if (bool !== undefined) over[key] = bool; }
    else if (key === "layout") { if (raw === "chips" || raw === "table") over[key] = raw; }
    else over[key] = raw;
  }
  return { block, over: over };
}

/** The hazard options in effect for one block: plugin settings, then the block's own lines. */
export function hazardView(s: HeaderSettings, over: Partial<HazardView> = {}): HazardView {
  const v = {} as Record<string, unknown>;
  for (const k of HAZARD_KEYS) v[k] = s[k];
  return Object.assign(v, over) as unknown as HazardView;
}

/** Owns the header's saved state and its section of the settings tab. */
export class HeaderStore {
  settings: HeaderSettings = { ...HEADER_DEFAULTS };
  /** Called after a setting changes so open notes can redraw. */
  onChange: () => void = () => { /* set by the renderer */ };

  constructor(private plugin: Plugin) {}

  async load(): Promise<void> {
    const saved = (await this.plugin.loadData()) as { header?: Partial<HeaderSettings> } | null;
    this.settings = Object.assign({}, HEADER_DEFAULTS, saved?.header ?? {});
  }

  async save(): Promise<void> {
    const data = ((await this.plugin.loadData()) ?? {}) as Record<string, unknown>;
    data.header = this.settings;
    await this.plugin.saveData(data);
    this.onChange();
  }

  private toggle(el: HTMLElement, key: keyof HazardView, name: string, desc: string): void {
    const s = this.settings as unknown as Record<string, boolean>;
    new Setting(el).setName(name).setDesc(desc)
      .addToggle(t => t.setValue(s[key]).onChange(async v => { s[key] = v; await this.save(); }));
  }

  private text(el: HTMLElement, key: "chemicalsProperty" | "classProperty" | "hideForClasses", name: string, desc: string): void {
    const s = this.settings;
    new Setting(el).setName(name).setDesc(desc)
      .addText(t => t.setValue(s[key]).onChange(async v => { s[key] = v; await this.save(); }));
  }

  display(containerEl: HTMLElement): void {
    const s = this.settings;
    new Setting(containerEl).setName("Lab header").setHeading();
    new Setting(containerEl).setName("Data folder root (Windows)")
      .setDesc("Each note gets a subfolder named after it here. Empty: the button asks you to set this.")
      .addText(t => { t.setValue(s.dataRootWindows).onChange(async v => { s.dataRootWindows = v.trim(); await this.save(); }); t.inputEl.addClass("lab-kit-wide-input"); });
    new Setting(containerEl).setName("Data folder root (macOS or Linux)")
      .setDesc("Same, for a Mac or Linux computer. The button creates the note's folder when you press it.")
      .addText(t => { t.setValue(s.dataRootMac).onChange(async v => { s.dataRootMac = v.trim(); await this.save(); }); t.inputEl.addClass("lab-kit-wide-input"); });

    new Setting(containerEl).setName("Hazards").setHeading();
    containerEl.createEl("p", { cls: "setting-item-description",
      text: "Any option can be set for one note with a line inside the block, e.g. collapsed: false (names are in the tutorial)." });
    new Setting(containerEl).setName("Layout")
      .setDesc("Chips: one row per chemical with a coloured chip for each H-code. Table: the two-column table.")
      .addDropdown(d => d.addOption("chips", "Chips").addOption("table", "Table").setValue(s.layout)
        .onChange(async v => { s.layout = v === "table" ? "table" : "chips"; await this.save(); }));
    this.text(containerEl, "chemicalsProperty", "Chemicals property", "The note property that lists the chemicals.");
    this.text(containerEl, "classProperty", "Class property", "The note property that holds the experiment class.");
    this.text(containerEl, "hideForClasses", "No hazards for", "Class values that hide the hazards, separated by commas.");
    this.toggle(containerEl, "collapsed", "Collapsible", "Put the hazards behind a clickable one-line summary.");
    this.toggle(containerEl, "startOpen", "Start open", "The summary starts expanded (only when collapsible).");
    this.toggle(containerEl, "showSummaryCounts", "Summary counts", "Show e.g. Severe 1, High 2 in the summary line.");
    this.toggle(containerEl, "showLegend", "Legend", "Show the colour key under the hazards.");
    this.toggle(containerEl, "legendDetails", "Legend details", "Show the GHS categories under each legend item.");
    this.toggle(containerEl, "sortByWorstHazard", "Most hazardous first", "Off sorts the chemicals A to Z.");
    this.toggle(containerEl, "highlightWholePhrase", "Colour the whole phrase", "Off colours just the H-code.");
    this.toggle(containerEl, "showCategoryLabels", "Category labels", "Add the GHS category (e.g. Cat 2) after each code.");
    this.toggle(containerEl, "shadeChemicalCell", "Shade chemical names", "Colour the chemical name with its worst hazard.");
    this.toggle(containerEl, "centreChemicalCell", "Centre chemical names", "Table layout only.");
    this.toggle(containerEl, "showMissing", "Show missing data", "List chemicals that have no note or no H_Phrase.");
  }
}
