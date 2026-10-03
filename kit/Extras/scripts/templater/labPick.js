/* =====================================================================
   labPick: searchable picker with icons (Templater user script)
   ---------------------------------------------------------------------
     const choice = await tp.user.labPick(tp, [
       { name: "Solution prep", desc: "…", icon: "test-tube", value: anything },
     ], "Insert snippet…");
   Returns the chosen item's value, or null.
   Icons are Lucide names (lucide.dev). A comma-separated list tries each in turn.
   ===================================================================== */

module.exports = function labPick(tp, items, placeholder = "Search…") {
  const { SuggestModal, getIcon } = tp.obsidian;

  const iconFor = (names) => {
    for (const n of String(names ?? "").split(",").map(s => s.trim()).filter(Boolean)) {
      const svg = getIcon?.(n);
      if (svg) return svg;
    }
    return getIcon?.("file-text") ?? null;
  };

  return new Promise((resolve) => {
    let chosen = false;
    class Picker extends SuggestModal {
      getSuggestions(q) {
        const s = q.toLowerCase().trim();
        return items.filter(it => !s || it.name.toLowerCase().includes(s) || (it.desc ?? "").toLowerCase().includes(s));
      }
      renderSuggestion(it, el) {
        el.style.display = "flex"; el.style.gap = "10px"; el.style.alignItems = "flex-start";
        const ic = el.createDiv(); ic.style.color = "var(--text-accent)"; ic.style.paddingTop = "2px";
        const svg = iconFor(it.icon); if (svg) ic.appendChild(svg);
        const text = el.createDiv();
        text.createDiv({ text: it.name });
        if (it.desc) text.createEl("small", { text: it.desc, cls: "mod-muted" }).style.color = "var(--text-muted)";
      }
      onChooseSuggestion(it) { chosen = true; resolve(it.value); }
      onClose() { setTimeout(() => { if (!chosen) resolve(null); }, 100); }
    }
    const m = new Picker(app);
    m.setPlaceholder(placeholder);
    m.open();
  });
};
