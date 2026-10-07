// vtAsk - the vault's one text box (see Vault spec > Rules for changes).
// Looks exactly like Obsidian's pickers (same component), but with no list underneath.
// Every template that asks for text uses this instead of tp.system.prompt.
//
//   const name = await tp.user.vtAsk(tp, "To-do? (Esc = Untitled)");
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
    m.scope.register([], "Enter", () => { m.submit(); return false; });
    m.setPlaceholder(placeholder || "");
    m.emptyStateText = "";
    m.setInstructions([{ command: "Enter", purpose: "to save" }, { command: "Esc", purpose: "to cancel" }]);
    m.open();
  });
};
