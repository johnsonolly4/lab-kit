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
//   today, tomorrow, a weekday (mon, tues, friday ...) and "next <weekday>"; YYYY-MM-DD is kept if it is a real date.
//   Weeks start on Monday: "fri" is that day this week (today counts) or next week's once it has passed;
//   "next fri" is that day in the week after this one.
//   const due = tp.user.vtAsk.parseDue("next fri", new Date());
module.exports.parseDue = function parseDue(text, now) {
  const t = String(text || "").trim().toLowerCase().replace(/\s+/g, " ");
  const at = (y, m, d) => new Date(y, m, d);
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = at(now.getFullYear(), now.getMonth(), now.getDate());
  const shift = n => at(today.getFullYear(), today.getMonth(), today.getDate() + n);
  const iso = m => { const d = at(+m[1], +m[2] - 1, +m[3]); return d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? fmt(d) : null; };
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return iso(m);
  if (t === "today") return fmt(today);
  if (t === "tomorrow") return fmt(shift(1));
  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const full = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const extra = { tues: 1, thur: 3, thurs: 3 };
  m = /^(next )?([a-z]+)$/.exec(t);
  if (!m) return null;
  let target = days.indexOf(m[2]);
  if (target < 0) target = full.indexOf(m[2]);
  if (target < 0 && m[2] in extra) target = extra[m[2]];
  if (target < 0) return null;
  const sinceMonday = (today.getDay() + 6) % 7;
  let n = target - sinceMonday + (m[1] ? 7 : 0);
  if (!m[1] && n < 0) n += 7;
  return fmt(shift(n));
};
