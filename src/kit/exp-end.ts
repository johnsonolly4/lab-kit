// Tidy rule `exp-end`: the retired `Exp. End` property is read as a date. Pure; no I/O.

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const monthOf = (w: string): number => MONTHS.indexOf(w.slice(0, 3).toLowerCase()) + 1;
const MONTH_WORD = /^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)$/i;

function ymd(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (y < 1900 || y > 2200 || dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** A hand-typed date as YYYY-MM-DD, or null when it cannot be read with certainty. Day first for numbers (`03/09/2026` = 3 September); two-digit years are not guessed. */
export function normaliseDate(raw: string): string | null {
  const t = raw.trim().replace(/^["']|["']$/g, "").trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ][\d:.]+Z?)?$/.exec(t);
  if (m) return ymd(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t);
  if (m) return ymd(+m[3], +m[2], +m[1]);
  const words = t.replace(/,/g, " ").replace(/(\d)(st|nd|rd|th)\b/gi, "$1").replace(/\bof\b/gi, " ").split(/\s+/).filter(Boolean);
  if (words.length === 3) {
    const [a, b, c] = words;
    if (/^\d{1,2}$/.test(a) && MONTH_WORD.test(b) && /^\d{4}$/.test(c)) return ymd(+c, monthOf(b), +a);
    if (MONTH_WORD.test(a) && /^\d{1,2}$/.test(b) && /^\d{4}$/.test(c)) return ymd(+c, monthOf(a), +b);
  }
  return null;
}
