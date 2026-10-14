// The entry window's fields (a title box with a row of chips under it): what each chip shows and which ones are visible. Pure; the window is entry-window.ts.

export type EntryValue = string | number | boolean;
export type EntryValues = Record<string, EntryValue>;

export interface EntryOption { label: string; value: EntryValue }

export interface EntryField {
  key: string;
  /** Shown on an empty chip as "+ <name>" and as the chip's tooltip. */
  name: string;
  /** An Obsidian icon name. */
  icon: string;
  /** pick: a list of `options`; date: a text box that reads dates and words; text: a text box; toggle: click to turn on / off. */
  kind: "pick" | "date" | "toggle" | "text";
  options?: EntryOption[];
  /** The box's placeholder. */
  prompt: string;
  /** Visible only once the field with this key has a value. */
  showWhen?: string;
  /** With `showWhen`: visible only while that field equals this value (Project only for a One-off meeting). */
  showValue?: EntryValue;
  /** Enter does not create until it has a value. */
  required?: boolean;
  /** A pick field: text typed in its search that is not in the list can be picked as a new value. */
  allowNew?: boolean;
}

const empty = (v: EntryValue | undefined): boolean => v === undefined || v === "" || v === false;

/** The fields to show, given what is set. */
export const visibleFields = (fields: EntryField[], values: EntryValues): EntryField[] => fields.filter(f => !f.showWhen || (f.showValue !== undefined ? values[f.showWhen] === f.showValue : !empty(values[f.showWhen])));

/** What a chip says, and whether it has a value. */
export function chipView(f: EntryField, v: EntryValue | undefined): { text: string; set: boolean } {
  if (f.kind === "toggle") return { text: `${f.name} ${v === true ? "on" : "off"}`, set: v === true };
  if (empty(v)) return { text: `+ ${f.name}`, set: false };
  if (f.kind === "pick") return { text: f.options?.find(o => o.value === v)?.label ?? String(v), set: true };
  if (f.kind === "date" && typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return { text: `${v.slice(8)}-${v.slice(5, 7)}-${v.slice(0, 4)}`, set: true };   // shown as DD-MM-YYYY; the property stays YYYY-MM-DD
  return { text: String(v), set: true };
}

/** The first visible required field with no value, or null. */
export const missingRequired = (fields: EntryField[], values: EntryValues): EntryField | null => visibleFields(fields, values).find(f => f.required && empty(values[f.key])) ?? null;

/** The values to hand over: only those of visible fields that have one (a hidden Countdown is dropped with its Due). */
export function entryResult(fields: EntryField[], values: EntryValues): EntryValues {
  const out: EntryValues = {};
  for (const f of visibleFields(fields, values)) if (!empty(values[f.key]) || (f.kind === "toggle" && values[f.key] === false)) out[f.key] = values[f.key];
  return out;
}

/** Sets one value; clearing a field also clears the ones that need it (clearing Due clears Countdown). */
export function setEntryValue(fields: EntryField[], values: EntryValues, key: string, value: EntryValue): EntryValues {
  const next = { ...values, [key]: value };
  if (empty(value)) for (const f of fields) if (f.showWhen === key) delete next[f.key];
  return next;
}
