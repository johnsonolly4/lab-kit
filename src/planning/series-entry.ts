// New meeting series in the entry window: its fields, and reading what was typed into the series the hub is made from. Pure.
import type { EntryField, EntryValues } from "./entry-fields";
import { checkSeriesName, cleanDeckPath, everyWeeks, parseInterval, templateRef, type Interval } from "./meetings";
import { parseDay } from "./todo";

/** Name (the window's title box), How often, First meeting (its weekday is the series' day), Deck and Note template. */
export function seriesFields(deckWhere: string): EntryField[] {
  const opt = (label: string, value = label): { label: string; value: string } => ({ label, value });
  return [
    { key: "interval", name: "How often", icon: "repeat", kind: "pick", prompt: "How often? (or type a number of weeks)", required: true, allowNew: true,
      options: [opt("Weekly", "weekly"), opt("Fortnightly", "fortnightly"), opt("Monthly", "monthly"), opt("Every 3 weeks", everyWeeks(3)), opt("Every 4 weeks", everyWeeks(4))] },
    { key: "date", name: "First meeting", icon: "calendar", kind: "date", prompt: "Date of the first meeting", required: true },
    { key: "deck", name: "Deck", icon: "presentation", kind: "text", prompt: `A folder of decks on ${deckWhere}, or one deck file (empty: none)` },
    { key: "template", name: "Note template", icon: "file-text", kind: "text", prompt: "Name of a template note (empty: the kit's Meeting template)" },
  ];
}

export interface SeriesAnswer { name: string; interval: Interval; /** 0 = Sunday … 6 = Saturday. */ day: number; /** YYYY-MM-DD */ start: string; deck: string; template: string }

/** The series from the window's title and values; or what to tell the user. `taken` says whether a series or folder of that name exists. A bare number in How often is that many weeks. */
export function readSeries(title: string, values: EntryValues, taken: (name: string) => boolean): SeriesAnswer | { error: string } {
  const checked = checkSeriesName(title);
  if ("error" in checked) return checked;
  if (taken(checked.name)) return { error: `A meeting series called ${checked.name} already exists. Choose another name.` };
  const typed = String(values.interval ?? "").trim();
  const interval = /^\d{1,2}$/.test(typed) ? parseInterval(everyWeeks(+typed)) : parseInterval(typed);
  if (!interval) return { error: "How often: pick one, or type a whole number of weeks from 1 to 52." };
  const date = parseDay(String(values.date ?? ""));
  if (!date) return { error: "Pick the date of the first meeting." };
  return { name: checked.name, interval, day: date.getDay(), start: String(values.date), deck: cleanDeckPath(String(values.deck ?? "")), template: templateRef(String(values.template ?? "")) };
}
