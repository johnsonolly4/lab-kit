// REMOVING THIS FEATURE (if testing shows it does not work): delete this file and `tests/clone.test.ts` and `tests/fixtures/lab-notes/`; once Phase 2 is in,
// also the `clone-experiment` command in `src/kit/ui.ts`, its row in "How my vault works", its `RECOMMENDED_HOTKEYS` entry and the changelog / checklist lines
// (full list: `docs/decisions.md`, "Removing experimental features"). Nothing else imports this file.
// Clone experiment: the text rules for making a new lab note from an old one. Pure (no Obsidian imports, works on mobile).
// The numbering rule is the one in `kits/lab/Templates/Lab Book Template.md` (Templater scripts cannot import this file; `tests/clone.test.ts` checks both agree).

const escapeRx = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The next note number as 4 digits: notes named `0014 - …` or `ABC0014 - …` both count, other names don't. `basenames` = the notes of the lab folder. */
export function nextLabNumber(basenames: string[], initials: string): string {
  const numbered = new RegExp(`^(?:${escapeRx(initials)})?(\\d+)`);
  const nums = basenames.map(b => parseInt(b.match(numbered)?.[1] ?? "0", 10));
  return String(Math.max(0, ...nums) + 1).padStart(4, "0");
}

/** The title part of a lab note's name: `ABC0014 - RAFT test` gives `RAFT test` (the name itself when it has no number or no title). */
export function labTitle(basename: string): string {
  return basename.replace(/^[A-Za-z]*\d+\s*-\s*/, "").trim() || basename;
}

/** A date as YYYY-MM-DD in the local time zone. */
export function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** `ABC0015 - Title`, with the characters a file name cannot hold replaced by `-`. An empty title is "Untitled". */
export function labNoteName(initials: string, number: string, title: string): string {
  return `${initials}${number} - ${title.trim() || "Untitled"}`.replace(/[\\/:*?"<>|]/g, "-");
}

/** The sample-code prefix of a lab note from its name: `ABC0014 - RAFT test` gives `ABC0014-`; null when the name has no number. */
export function labPrefix(basename: string): string | null {
  const m = basename.match(/^([A-Za-z]*)(\d+)/);
  return m ? `${m[1]}${m[2]}-` : null;
}

export interface CloneOptions {
  /** Prefix of the note being copied, e.g. `ABC0014-`. */
  oldPrefix: string;
  /** Prefix of the new note, e.g. `ABC0015-`. */
  newPrefix: string;
  /** Today as YYYY-MM-DD, written to `Plan date`. */
  today: string;
  /** Name of the note being copied: written as `Cloned from: "[[name]]"` at the end of the properties, so the clone links back. */
  clonedFrom?: string;
}

export interface CloneResult {
  text: string;
  /** How many sample codes were renumbered. */
  recoded: number;
}

/** Properties the clone starts again: name and the value it gets (undefined = empty). A list value under the key is removed too. */
const RESET: [RegExp, (o: CloneOptions) => string][] = [
  [/^Status:/, () => "Status: Planned"],
  [/^Plan date:/, o => `Plan date: ${o.today}`],
  [/^Exp\. Start:/, () => "Exp. Start:"],
  [/^Exp\. End:/, () => "Exp. End:"],
  [/^Outcome:/, () => "Outcome:"],
];

const isResults = (line: string): boolean => /^#\s/.test(line) && line.includes("Results / Analysis");
const isNotes = (line: string): boolean => /^#\s/.test(line) && line.includes("Notes for next time");

/**
 * The new note's text from the old one. Kept: the set-up (properties, objectives, apparatus, procedure, rig, solution and sample tables).
 * Started again: Status, Plan date, Exp. Start / End, Outcome; the free text of "Results / Analysis" (headings, tables, code blocks and
 * checklist items stay, ticks are cleared); "Notes for next time". A `Cloned from` link to the old note is added. Sample codes of the old note are renumbered to the new prefix.
 */
export function cloneLabNote(text: string, o: CloneOptions): CloneResult {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;

  if (lines[0] === "---") {
    const end = lines.indexOf("---", 1);
    if (end > 0) {
      out.push("---");
      for (i = 1; i < end; i++) {
        if (/^Cloned from:/.test(lines[i])) { while (i + 1 < end && /^(\s+|-\s)/.test(lines[i + 1])) i++; continue; }   // a clone of a clone points at its own source
        const reset = RESET.find(([rx]) => rx.test(lines[i]));
        if (!reset) { out.push(lines[i]); continue; }
        out.push(reset[1](o));
        while (i + 1 < end && /^(\s+|-\s)/.test(lines[i + 1])) i++;   // a list under the key goes with it
      }
      if (o.clonedFrom) out.push(`Cloned from: "[[${o.clonedFrom.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}]]"`);
      out.push("---");
      i = end + 1;
    } else i = 0;
  }

  let section: "none" | "results" | "notes" = "none";
  let fenced = false;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; out.push(line); continue; }
    if (fenced) { out.push(line); continue; }
    if (/^#\s/.test(line)) {
      section = isResults(line) ? "results" : isNotes(line) ? "notes" : "none";
      out.push(line);
      if (section === "notes") out.push("- ");
      continue;
    }
    if (section === "notes") continue;
    if (section === "results") {
      if (/^\s*$/.test(line) || /^#{2,}\s/.test(line) || /^\s*\|/.test(line)) out.push(line);
      else if (/^\s*- \[[ xX]\]/.test(line)) out.push(line.replace(/\[[xX]\]/, "[ ]"));
      continue;
    }
    out.push(line);
  }

  let recoded = 0;
  const rx = new RegExp(`(^|[^A-Za-z0-9])${escapeRx(o.oldPrefix)}(?=[A-Z])`, "gm");
  const result = out.join(eol).replace(rx, (_all, before: string) => { recoded++; return before + o.newPrefix; });
  return { text: result, recoded };
}
