import { parseDue } from "./due-words";

/** What a line of highlighted text means as a to-do: the title, and the fields its marks set. */
export interface QuickTodo {
  title: string;
  /** A project's name (one of the known names, as written there). */
  project?: string;
  /** YYYY-MM-DD. */
  due?: string;
  /** 1 (highest) to 3. */
  priority?: number;
}

const WORDS_AFTER_PERCENT = 3;   // "%next mon" and "%in 3 days" take up to three words

/** Reads `@project`, `%date` and `!n` marks out of `text`; everything else is the title.
 *  - `@Name` or `@"Name with spaces"`: matches a known project name (case-insensitive, the longest name first); unknown names stay in the title.
 *  - `%fri`, `%15 nov`, `%in 3 days`, `%"next mon"`: the longest run of words that reads as a date (see `parseDue`); a run that is not a date stays in the title.
 *  - `!1`, `!2`, `!3`: the priority. Each mark counts once (the first); a mark that does not read is left as typed. */
export function parseQuickTodo(text: string, projects: string[], now: Date): QuickTodo {
  let rest = text.replace(/\s+/g, " ").trim();
  const out: QuickTodo = { title: "" };
  const names = [...projects].sort((a, b) => b.length - a.length);
  const cut = (from: number, to: number): void => { rest = (rest.slice(0, from) + " " + rest.slice(to)).replace(/\s+/g, " ").trim(); };
  const at = (re: RegExp): RegExpExecArray | null => { for (const m of rest.matchAll(re)) { if (m.index === 0 || rest[m.index - 1] === " ") return m; } return null; };

  for (let m = at(/@/g); m && !out.project; m = null) {
    const after = rest.slice(m.index + 1);
    const quoted = /^"([^"]+)"/.exec(after);
    const hit = quoted ? names.find(n => n.toLowerCase() === quoted[1].toLowerCase()) : names.find(n => after.toLowerCase().startsWith(n.toLowerCase()) && (after.length === n.length || /[\s.,;:]/.test(after[n.length])));
    if (hit) { out.project = hit; cut(m.index, m.index + 1 + (quoted ? quoted[0].length : hit.length)); }
  }

  const pm = at(/%/g);
  if (pm) {
    const after = rest.slice(pm.index + 1);
    const quoted = /^"([^"]+)"/.exec(after);
    if (quoted) {
      const d = parseDue(quoted[1], now);
      if (d) { out.due = d; cut(pm.index, pm.index + 1 + quoted[0].length); }
    } else {
      const words = after.split(" ");
      for (let n = Math.min(WORDS_AFTER_PERCENT, words.length); n >= 1 && !out.due; n--) {
        const run = words.slice(0, n).join(" ").replace(/[.,;:]$/, "");
        const d = parseDue(run, now);
        if (d) { out.due = d; cut(pm.index, pm.index + 1 + words.slice(0, n).join(" ").length); }
      }
    }
  }

  const bm = at(/!([123])(?=$|[\s.,;:])/g);
  if (bm) { out.priority = +bm[1]; cut(bm.index, bm.index + 2); }

  out.title = rest;
  return out;
}
