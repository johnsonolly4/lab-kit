// Reads a note's Chemicals and each chemical note's H_Phrase from the metadata cache (no Dataview) and builds the hazard rows.
import { TFile, type App } from "obsidian";
import { cleanLink, text } from "../calc/engine";
import { LEVELS, phraseLevel, severity } from "./ghs";

export interface Phrase { text: string; level: number; /** GHS category, "9" when unknown. */ cat: string }

export interface HazardRow {
  /** Link text as written in Chemicals. */
  name: string;
  /** Path of the chemical note, or null when no note exists yet. */
  path: string | null;
  phrases: Phrase[];
  /** Worst level index (LEVELS.length = none known, +1 = no note). */
  topLevel: number;
  topCount: number;
  worst: number;
}

export interface HazardData {
  /** True when this note's Exp. Class says no hazard table is wanted. */
  hidden: boolean;
  rows: HazardRow[];
}

export interface HazardOptions {
  chemicalsProperty: string;
  classProperty: string;
  hideForClasses: string[];
  sortByWorstHazard: boolean;
  /** Keep chemicals that have no note; chemicals without H_Phrase stay either way. */
  showMissing: boolean;
}

export const HAZARD_DEFAULTS: HazardOptions = {
  chemicalsProperty: "Chemicals",
  classProperty: "Exp. Class",
  hideForClasses: ["in-silico", "setup"],
  sortByWorstHazard: true,
  showMissing: true
};

const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Frontmatter value by property name, ignoring capitals and spacing ("Exp. Class" = "exp. class"). */
function prop(fm: Record<string, unknown> | undefined, name: string): unknown {
  if (!fm) return undefined;
  const want = norm(name);
  const key = Object.keys(fm).find(k => norm(k) === want);
  return key === undefined ? undefined : fm[key];
}

/** A property value as a flat list of non-empty strings (YAML `[[link]]` unquoted arrives as nested arrays). */
function toList(v: unknown): string[] {
  if (v == null || v === "") return [];
  if (Array.isArray(v)) return v.flatMap(toList);
  return [text(v)];
}

export function collectHazards(app: App, sourcePath: string, opts: HazardOptions = HAZARD_DEFAULTS): HazardData {
  const cache = app.metadataCache;
  const here = app.vault.getAbstractFileByPath(sourcePath);
  const fm: Record<string, unknown> | undefined = here instanceof TFile ? cache.getFileCache(here)?.frontmatter : undefined;

  const classes = toList(prop(fm, opts.classProperty)).map(c => c.replace(/[[\]]/g, "").trim().toLowerCase());
  const hide = opts.hideForClasses.map(c => c.trim().toLowerCase()).filter(Boolean);
  if (classes.some(c => hide.includes(c))) return { hidden: true, rows: [] };

  const rows: HazardRow[] = [];
  for (const raw of toList(prop(fm, opts.chemicalsProperty))) {
    const name = cleanLink(raw);
    if (!name) continue;
    const file = cache.getFirstLinkpathDest(name, sourcePath);
    if (!file) {
      if (opts.showMissing) rows.push({ name, path: null, phrases: [], topLevel: LEVELS.length + 1, topCount: 0, worst: 1000 });
      continue;
    }
    const chemFm: Record<string, unknown> | undefined = cache.getFileCache(file)?.frontmatter;
    const phrases = toList(prop(chemFm, "H_Phrase"))
      .sort((a, b) => severity(a).score - severity(b).score || a.localeCompare(b))
      .map(text => ({ text, level: phraseLevel(text), cat: severity(text).cat }));
    const topLevel = phrases.length ? Math.min(...phrases.map(p => p.level)) : LEVELS.length;
    rows.push({
      name: file.basename,
      path: file.path,
      phrases,
      topLevel,
      topCount: phrases.filter(p => p.level === topLevel).length,
      worst: phrases.length ? severity(phrases[0].text).score : 999
    });
  }

  rows.sort((a, b) => opts.sortByWorstHazard
    ? a.topLevel - b.topLevel || b.topCount - a.topCount || a.worst - b.worst || a.name.localeCompare(b.name)
    : a.name.localeCompare(b.name));
  return { hidden: false, rows };
}

/** Count of chemicals per level, for the summary line. Only levels that occur are returned. */
export function levelCounts(rows: HazardRow[]): { level: number; n: number }[] {
  return LEVELS.map((_, level) => ({ level, n: rows.filter(r => r.topLevel === level).length })).filter(x => x.n > 0);
}

/** Everything the rendered header depends on; equal strings mean the DOM would come out identical. */
export function hazardSignature(data: HazardData): string {
  return JSON.stringify(data);
}

/** Paths whose changes can alter this note's hazards: the note itself and its resolved chemical notes. */
export function hazardSources(sourcePath: string, data: HazardData): Set<string> {
  const s = new Set<string>([sourcePath]);
  for (const r of data.rows) if (r.path) s.add(r.path);
  return s;
}
