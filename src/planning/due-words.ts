/** A due date typed as words to YYYY-MM-DD, or null when it is not one. The same rules as `parseDue` in the planning kit's `vtAsk.js` (the To-do template runs that one): change both; `tests/due-words.test.ts` checks them against one table.
 *  YYYY-MM-DD, today, tomorrow, a weekday, "next <weekday>", "in 3 days" / "3 days" / "3d" / "2w", "next week" (that Monday), "next month" (the 1st),
 *  a day and month ("15 nov", "nov 15th"), and numbers day first ("15/11", "15/11/2026", "15/11/26").
 *  A day and month with no year is the next one that is today or later. Weeks start on Monday. */
export function parseDue(text: string, now: Date): string | null {
  const t = String(text || "").trim().toLowerCase().replace(/\s+/g, " ");
  const fmt = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const shift = (n: number): Date => new Date(today.getFullYear(), today.getMonth(), today.getDate() + n);
  const real = (y: number, m: number, d: number): Date | null => { const x = new Date(y, m, d); return x.getFullYear() === y && x.getMonth() === m && x.getDate() === d ? x : null; };
  const dayMonth = (d: number, m: number, y: number | null): string | null => {
    if (y !== null) { const x = real(y, m, d); return x ? fmt(x) : null; }
    for (let k = 0; k <= 4; k++) { const x = real(today.getFullYear() + k, m, d); if (x && x >= today) return fmt(x); }   // up to 4 years ahead: 29 feb
    return null;
  };
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) { const x = real(+m[1], +m[2] - 1, +m[3]); return x ? fmt(x) : null; }
  if (t === "today") return fmt(today);
  if (t === "tomorrow") return fmt(shift(1));
  const sinceMonday = (today.getDay() + 6) % 7;
  if (t === "next week") return fmt(shift(7 - sinceMonday));
  if (t === "next month") return fmt(new Date(today.getFullYear(), today.getMonth() + 1, 1));
  m = /^(?:in )?(\d{1,3}) ?(d|day|days|w|week|weeks)$/.exec(t);   // "in 3 days", "3 days", "3d", "2w"
  if (m) return fmt(shift(+m[1] * (m[2].startsWith("w") ? 7 : 1)));
  m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?$/.exec(t);
  if (m) return dayMonth(+m[1], +m[2] - 1, m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : null);
  const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const monthOf = (w: string): number => (w === "sept" ? 8 : w.length >= 3 ? months.findIndex(n => n.startsWith(w)) : -1);
  m = /^(\d{1,2})(?:st|nd|rd|th)? ([a-z]+)(?: (\d{4}))?$/.exec(t) ?? /^([a-z]+) (\d{1,2})(?:st|nd|rd|th)?(?: (\d{4}))?$/.exec(t);
  if (m) {
    const [d, w] = /^\d/.test(m[1]) ? [+m[1], m[2]] : [+m[2], m[1]];
    const mi = monthOf(w);
    if (mi >= 0) return dayMonth(d, mi, m[3] ? +m[3] : null);
  }
  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const full = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const extra: Record<string, number> = { tues: 1, thur: 3, thurs: 3 };
  m = /^(next )?([a-z]+)$/.exec(t);
  if (!m) return null;
  let target = days.indexOf(m[2]);
  if (target < 0) target = full.indexOf(m[2]);
  if (target < 0 && m[2] in extra) target = extra[m[2]];
  if (target < 0) return null;
  let n = target - sinceMonday + (m[1] ? 7 : 0);
  if (!m[1] && n < 0) n += 7;
  return fmt(shift(n));
}
