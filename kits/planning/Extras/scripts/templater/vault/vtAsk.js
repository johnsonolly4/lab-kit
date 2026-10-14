// vtAsk - the vault's one text box (see Vault spec > Rules for changes).
// Looks exactly like Obsidian's pickers (same component), but with no list underneath.
// Every template that asks for text uses this instead of tp.system.prompt.
//
//   const name = await tp.user.vtAsk(tp, "To-do? (Esc to cancel)");
//   const name = await tp.user.vtAsk(tp, "Name (Enter keeps it)", file.basename);
//
// Returns the trimmed text, or null if Esc was pressed.
module.exports = function vtAsk(tp, placeholder, value) {
  return new Promise(resolve => {
    let settled = false;
    const finish = v => { if (!settled) { settled = true; resolve(v); } };

    class AskModal extends tp.obsidian.SuggestModal {
      getSuggestions() { return []; }
      renderSuggestion() {}
      onChooseSuggestion() {}
      submit() { finish(this.inputEl.value.trim()); this.close(); }
      // The picker's own Enter picks the highlighted (absent) suggestion: make it save instead
      selectActiveSuggestion() { this.submit(); }
      onOpen() {
        super.onOpen();
        this.modalEl.addClass("vt-ask"); // vault-theme.css hides the empty list
        if (value) { this.inputEl.value = value; this.inputEl.select(); }
        this.inputEl.addEventListener("keydown", e => {
          if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); e.stopPropagation(); this.submit(); }
        }, true);
      }
      onClose() { super.onClose(); setTimeout(() => finish(null), 0); }
    }

    const m = new AskModal(window.app);
    // The picker registered its own Enter first, and the first match wins: drop it so ours runs
    for (const k of [...(m.scope.keys || [])]) if (k.key === "Enter" && !k.modifiers) m.scope.unregister(k);
    m.scope.register([], "Enter", () => { m.submit(); return false; });
    m.setPlaceholder(placeholder || "");
    m.emptyStateText = "";
    m.setInstructions([{ command: "Enter", purpose: "to save" }, { command: "Esc", purpose: "to cancel" }]);
    m.open();
  });
};

// parseDue - a due date typed as words to YYYY-MM-DD, or null when it is not one.
//   YYYY-MM-DD (kept if it is a real date), today, tomorrow, a weekday (mon, tues, friday ...), "next <weekday>",
//   "in 3 days" / "3 days" / "3d" / "2w", "next week" (that Monday), "next month" (the 1st),
//   a day and month: "15 nov", "15th november", "nov 15"; numbers, day first: "15/11", "15/11/2026", "15/11/26".
//   A day and month with no year is the next one that is today or later.
//   Weeks start on Monday: "fri" is that day this week (today counts) or next week's once it has passed;
//   "next fri" is that day in the week after this one.
//   The same rules are in src/planning/due-words.ts (the plugin's copy): change both, tests/due-words.test.ts checks them together.
//   const due = tp.user.vtAsk.parseDue("next fri", new Date());
module.exports.parseDue = function parseDue(text, now) {
  const t = String(text || "").trim().toLowerCase().replace(/\s+/g, " ");
  const at = (y, m, d) => new Date(y, m, d);
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = at(now.getFullYear(), now.getMonth(), now.getDate());
  const shift = n => at(today.getFullYear(), today.getMonth(), today.getDate() + n);
  const real = (y, m, d) => { const x = at(y, m, d); return x.getFullYear() === y && x.getMonth() === m && x.getDate() === d ? x : null; };
  const dayMonth = (d, m, y) => {   // no year: this year's date if it is today or later, else next year's
    if (y !== null) return real(y, m, d) ? fmt(real(y, m, d)) : null;
    for (let k = 0; k <= 4; k++) { const x = real(today.getFullYear() + k, m, d); if (x && x >= today) return fmt(x); }   // up to 4 years ahead: 29 feb
    return null;
  };
  const longYear = y => (y.length === 2 ? 2000 + +y : +y);
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) { const x = real(+m[1], +m[2] - 1, +m[3]); return x ? fmt(x) : null; }
  if (t === "today") return fmt(today);
  if (t === "tomorrow") return fmt(shift(1));
  const sinceMonday = (today.getDay() + 6) % 7;
  if (t === "next week") return fmt(shift(7 - sinceMonday));
  if (t === "next month") return fmt(at(today.getFullYear(), today.getMonth() + 1, 1));
  m = /^(?:in )?(\d{1,3}) ?(d|day|days|w|week|weeks)$/.exec(t);   // "in 3 days", "3 days", "3d", "2w"
  if (m) return fmt(shift(+m[1] * (m[2][0] === "w" ? 7 : 1)));
  m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?$/.exec(t);
  if (m) return dayMonth(+m[1], +m[2] - 1, m[3] ? longYear(m[3]) : null);
  const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const monthOf = w => (w.length >= 3 && (w === "sept" ? 8 : months.findIndex(n => n.startsWith(w) && (w.length === 3 || w === n || n.startsWith(w)))));
  m = /^(\d{1,2})(?:st|nd|rd|th)? ([a-z]+)(?: (\d{4}))?$/.exec(t) || /^([a-z]+) (\d{1,2})(?:st|nd|rd|th)?(?: (\d{4}))?$/.exec(t);
  if (m) {
    const [d, w] = /^\d/.test(m[1]) ? [+m[1], m[2]] : [+m[2], m[1]];
    const mi = monthOf(w);
    if (mi !== false && mi >= 0) return dayMonth(d, mi, m[3] ? +m[3] : null);
  }
  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const full = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const extra = { tues: 1, thur: 3, thurs: 3 };
  m = /^(next )?([a-z]+)$/.exec(t);
  if (!m) return null;
  let target = days.indexOf(m[2]);
  if (target < 0) target = full.indexOf(m[2]);
  if (target < 0 && m[2] in extra) target = extra[m[2]];
  if (target < 0) return null;
  let n = target - sinceMonday + (m[1] ? 7 : 0);
  if (!m[1] && n < 0) n += 7;
  return fmt(shift(n));
};
