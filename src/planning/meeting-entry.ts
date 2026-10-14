// New meeting / New extra meeting in the entry window: its fields, the date a series suggests, and reading the answer. Pure.
import type { EntryField, EntryValues } from "./entry-fields";
import { nextDate, ONCE, type Series } from "./meetings";
import { projectField } from "./todo-bar";
import { ymd } from "./todo";

/** The Series chip's value for a one-off meeting (a series is its name). */
export const ONE_OFF = "__one-off__";

/** Series (a regular one, or One-off unless `extra`), Date, and for a One-off also Project. The title box is the one-off's title (`titleWhen` in the window). */
export function meetingFields(series: Series[], extra: boolean, projects: string[]): EntryField[] {
  const regular = series.filter(s => s.interval !== ONCE).map(s => ({ label: s.name, value: s.name }));
  const fields: EntryField[] = [
    { key: "series", name: "Series", icon: "repeat", kind: "pick", prompt: "Which meeting?", required: true, options: extra ? regular : [...regular, { label: "One-off", value: ONE_OFF }] },
    { key: "date", name: "Date", icon: "calendar", kind: "date", prompt: extra ? "Date of the extra meeting" : "Date of the meeting", required: true },
  ];
  if (!extra) fields.push({ ...projectField(projects), showWhen: "series", showValue: ONE_OFF });
  return fields;
}

/** The date to suggest for a Series chip value: a regular series' next meeting (an extra one: today, it is held in between), else today. */
export function suggestedDate(series: Series[], chosen: string, extra: boolean, today: Date): string {
  const s = series.find(x => x.name === chosen && x.interval !== ONCE);
  return s && !extra ? ymd(nextDate(s, today)) : ymd(today);
}

/** Starting values: the only series is preselected; the date follows it. */
export function meetingStart(series: Series[], extra: boolean, today: Date, project: string): EntryValues {
  const regular = series.filter(s => s.interval !== ONCE);
  const chosen = regular.length === 1 ? regular[0].name : (!extra && !regular.length ? ONE_OFF : "");
  return { ...(chosen ? { series: chosen } : {}), date: suggestedDate(series, chosen, extra, today), ...(project ? { project } : {}) };
}

/** After a chip changed: a new Series pick moves the Date to that series' suggestion (the caller skips this once the user has typed a date). */
export function followSeries(series: Series[], extra: boolean, values: EntryValues, changed: string, today: Date): EntryValues {
  if (changed !== "series") return values;
  return { ...values, date: suggestedDate(series, String(values.series ?? ""), extra, today) };
}

export type MeetingAnswer = { oneOff: true; date: string; project: string; title: string } | { oneOff: false; series: Series; date: string };

/** What the window answered, as one meeting to make; or what to tell the user. */
export function readMeeting(series: Series[], title: string, values: EntryValues): MeetingAnswer | { error: string } {
  const date = String(values.date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Pick the date of the meeting." };
  if (values.series === ONE_OFF) return { oneOff: true, date, project: String(values.project ?? ""), title };
  const s = series.find(x => x.name === values.series && x.interval !== ONCE);
  return s ? { oneOff: false, series: s, date } : { error: "Pick which meeting." };
}
