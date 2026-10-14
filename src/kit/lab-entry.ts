// New lab entry window (planning entry window, Phase 6): the fields, and which notes can be copied. Pure.
import type { EntryField } from "../planning/entry-fields";
import { labPrefix, labTitle } from "./clone";
import { chemicalClasses } from "./snippet-env";

export interface LabNote { basename: string; path: string; classes: string[] }

/** The fields of the New lab entry window: Exp. Class (the classes already used, or a new one typed) and Copy of (none, or one of the numbered lab notes, newest first). `copyRequired`: Clone experiment, which needs a note to copy. */
export function labEntryFields(notes: LabNote[], copyRequired: boolean): EntryField[] {
  const numbered = notes.filter(n => labPrefix(n.basename)).sort((a, b) => b.basename.localeCompare(a.basename));
  const none = copyRequired ? [] : [{ label: "(none)", value: "" }];
  return [
    { key: "expClass", name: "Exp. Class", icon: "tag", kind: "pick", prompt: "Exp. Class?", allowNew: true,
      options: [{ label: "(none)", value: "" }, ...chemicalClasses(notes.map(n => n.classes)).map(c => ({ label: c, value: c }))] },
    { key: "copyOf", name: "Copy of", icon: "copy", kind: "pick", prompt: "Copy which experiment?", required: copyRequired,
      options: [...none, ...numbered.map(n => ({ label: n.basename, value: n.path }))] },
  ];
}

/** The title to use: what was typed; with a note to copy and nothing typed, that note's own title; else empty (the template makes it Untitled). */
export const labEntryTitle = (typed: string, copyOf: LabNote | null): string => typed.trim() || (copyOf ? labTitle(copyOf.basename) : "");
