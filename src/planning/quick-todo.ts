import { parseDue } from "./due-words";
import { ymd } from "./todo";

/** What a line of highlighted text means as a to-do: the title, and the fields its marks set. */
export interface QuickTodo {
  title: string;
  /** A project's name (one of the known names, as written there). */
  project?: string;
  /** A `+name` that matched no project: it stays in the title, and the window opens the Project search with it. */
  projectGuess?: string;
  /** YYYY-MM-DD. */
  due?: string;
  /** 1 (highest) to 3. */
  priority?: number;
  /** The planned day (`>next tue`), YYYY-MM-DD, today or later. `>backlog` sets nothing. */
  scheduled?: string;
  /** A `>` date that is already past: not set, the caller says so (the Q1 notice). */
  pastDay?: string;
}

const WORDS_AFTER_PERCENT = 3;   // "%next mon" and "%in 3 days" take up to three words
const PRIORITY_WORDS: Record<string, number> = { "1": 1, "2": 2, "3": 3, high: 1, medium: 2, med: 2, low: 3 };

/** Reads `+project`, `%date`, `>day` and `!priority` marks out of `text`; everything else is the title. (Not `@`: ZotLit uses it for citations.)
 *  - `+Name` or `+"Name with spaces"`: matches a known project name (case-insensitive, the longest name first), else the longest run of words that starts exactly one name (`+plan map` for "Plan map example"); an unknown name stays in the title and is returned as `projectGuess`. One space after the mark is fine.
 *  - `%fri`, `%15 nov`, `%in 3 days`, `%"next mon"`: the longest run of words that reads as a date (see `parseDue`); a run that is not a date stays in the title.
 *  - `>tue`, `>next tue`, `>27 oct`: the planned day, read like `%` (words up to the next mark); `>backlog` clears it. A day already past is returned as `pastDay`, not set. A leading `> ` (a quote the text was selected from) is dropped.
 *  - `!1`, `!2`, `!3`, `!high`, `!medium`, `!low`: the priority.
 *  Each mark counts once (the first); a mark that does not read is left as typed. A list marker the text was selected with (`- `, `1. `, `- [ ] `) is dropped. */
export function parseQuickTodo(text: string, projects: string[], now: Date): QuickTodo {
  let rest = text.replace(/\s+/g, " ").trim().replace(/^(?:[-*]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+|>+\s+)/, "");
  const out: QuickTodo = { title: "" };
  const names = [...projects].sort((a, b) => b.length - a.length);
  const cut = (from: number, to: number): void => { rest = (rest.slice(0, from) + " " + rest.slice(to)).replace(/\s+/g, " ").trim(); };
  const at = (re: RegExp): RegExpExecArray | null => { for (const m of rest.matchAll(re)) { if (m.index === 0 || rest[m.index - 1] === " ") return m; } return null; };

  const pj = at(/\+/g);
  if (pj) {
    const skip = rest[pj.index + 1] === " " ? 1 : 0, from = pj.index + 1 + skip, after = rest.slice(from);
    const quoted = /^"([^"]+)"/.exec(after);
    let hit = quoted ? names.find(n => n.toLowerCase() === quoted[1].toLowerCase()) : names.find(n => after.toLowerCase().startsWith(n.toLowerCase()) && (after.length === n.length || /[\s.,;:]/.test(after[n.length])));
    let used = quoted ? quoted[0].length : hit?.length ?? 0;
    if (!hit) {   // near match: the longest run of words that starts exactly one name's words ("plan map" for "Plan map example")
      const typed = quoted ? quoted[1].split(" ") : after.split(" "), most = Math.max(0, ...names.map(n => n.split(" ").length));
      for (let n = Math.min(most, typed.length); n >= 1 && !hit; n--) {
        const run = typed.slice(0, n).join(" ").replace(/[.,;:]$/, "").toLowerCase();
        const found = projects.filter(p => (p.toLowerCase() + " ").startsWith(run + " "));
        if (run && found.length === 1) { hit = found[0]; used = quoted ? quoted[0].length : typed.slice(0, n).join(" ").length; }
      }
    }
    if (hit) { out.project = hit; cut(pj.index, from + used); }
    else if (after) out.projectGuess = quoted ? quoted[1] : after.split(" ")[0].replace(/[.,;:]$/, "") || undefined;
  }

  /** The words after the first `mark` that read as a date (a quoted run, else up to three words), cut out of the text; `backlog` (when `word`) reads as no date. null when there is no mark or nothing after it reads. */
  const dateAfter = (mark: RegExp, word?: string): { date: string | null } | null => {
    const pm = at(mark);
    if (!pm) return null;
    const skip = rest[pm.index + 1] === " " ? 1 : 0, from = pm.index + 1 + skip, after = rest.slice(from);
    const read = (run: string): { date: string | null } | null => { if (word && run.toLowerCase() === word) return { date: null }; const d = parseDue(run, now); return d ? { date: d } : null; };
    const quoted = /^"([^"]+)"/.exec(after);
    if (quoted) { const r = read(quoted[1]); if (r) cut(pm.index, from + quoted[0].length); return r; }
    const words = after.split(" ");
    for (let n = Math.min(WORDS_AFTER_PERCENT, words.length); n >= 1; n--) {
      const r = read(words.slice(0, n).join(" ").replace(/[.,;:]$/, ""));
      if (r) { cut(pm.index, from + words.slice(0, n).join(" ").length); return r; }
    }
    return null;
  };

  const due = dateAfter(/%/g);
  if (due?.date) out.due = due.date;

  const day = dateAfter(/>/g, "backlog");
  if (day?.date) { if (day.date < ymd(now)) out.pastDay = day.date; else out.scheduled = day.date; }

  const bm = at(/!\s?(1|2|3|high|medium|med|low)(?=$|[\s.,;:])[.,;:]?/gi);
  if (bm) { out.priority = PRIORITY_WORDS[bm[1].toLowerCase()]; cut(bm.index, bm.index + bm[0].length); }

  out.title = rest;
  return out;
}

/** The file name (no folder, no ".md") the To-do template gives a to-do titled `text`: forbidden characters become "-", 80 characters at most, " 2", " 3"... when `taken` says the name is used. The template makes the same name, so a note created under it is not renamed. */
export function todoFileName(text: string, taken: (name: string) => boolean): string {
  const base = (text.trim() || "Untitled to-do").replace(/[\\/:*?"<>|#^[\]]/g, "-").slice(0, 80);
  let name = base, n = 2;
  while (taken(name)) name = `${base} ${n++}`;
  return name;
}
