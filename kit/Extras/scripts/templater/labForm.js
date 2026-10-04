/* =====================================================================
   labForm: one pop-up form with several fields (Templater user script)
   ---------------------------------------------------------------------
   Setup: Settings → Templater → "User script functions" folder
          = the folder that holds this file (or a folder above it)

     const v = await tp.user.labForm(tp, "Solution prep", [
       { key: "name", label: "Solution name", value: "Solution 1" },
       { key: "nmr",  label: "Add NMR list", type: "toggle", value: true },
     ], { intro: "Optional line of help text" });
     if (v) { ... }            // null if cancelled

   Field types: "text" (default) | "number" | "textarea" | "toggle"
   A text field may have  suggest: [{ name, aliases }]  : typing suggests those
   names (note name or alias) for the item after the last comma.
   Keys: Enter = insert (Ctrl+Enter inside a textarea), Esc = cancel
   (with suggestions showing, Enter picks one)
   ===================================================================== */

/** Entries whose name or an alias contains the query, best first: name starts with it, alias starts with it, name contains it, alias contains it. */
function matchNames(entries, query, limit = 50) {
  const q = String(query).trim().toLowerCase();
  if (!q) return entries.slice(0, limit).map(e => ({ name: e.name, alias: null }));
  const found = [];
  for (const e of entries) {
    let best = null;
    for (const l of [{ text: e.name, alias: null }, ...(e.aliases ?? []).map(a => ({ text: a, alias: a }))]) {
      const at = l.text.toLowerCase().indexOf(q);
      if (at < 0) continue;
      const rank = (at === 0 ? 0 : 2) + (l.alias === null ? 0 : 1);
      if (!best || rank < best.rank) best = { rank, alias: l.alias };
    }
    if (best) found.push({ name: e.name, alias: best.alias, rank: best.rank });
  }
  return found.sort((a, b) => a.rank - b.rank).slice(0, limit).map(({ name, alias }) => ({ name, alias }));
}

/** The item being typed: what follows the last comma or line break before the cursor (leading spaces kept out of the query). */
function currentItem(value, cursor) {
  const before = value.slice(0, cursor);
  const start = Math.max(before.lastIndexOf(","), before.lastIndexOf("\n")) + 1;
  const lead = before.slice(start).match(/^\s*/)[0].length;
  return { start: start + lead, query: before.slice(start + lead) };
}

/** Value with the item being typed replaced by name. Returns the new text and cursor. */
function replaceItem(value, cursor, name) {
  const { start } = currentItem(value, cursor);
  return { value: value.slice(0, start) + name + value.slice(cursor), cursor: start + name.length };
}

function labForm(tp, title, fields, opts = {}) {
  const { Modal, Setting, AbstractInputSuggest } = tp.obsidian;

  return new Promise((resolve) => {
    class FormModal extends Modal {
      onOpen() {
        const { contentEl, titleEl } = this;
        titleEl.setText(title);
        if (opts.intro) contentEl.createEl("p", { text: opts.intro, cls: "setting-item-description" });
        this.values = {};
        const inputs = [];
        const popups = [];

        for (const f of fields) {
          if (f.type === "heading") { new Setting(contentEl).setName(f.label).setHeading(); continue; }
          const row = new Setting(contentEl).setName(f.label);
          if (f.hint) row.setDesc(f.hint);
          if (f.type === "toggle") {
            this.values[f.key] = !!f.value;
            row.addToggle((t) => t.setValue(!!f.value).onChange((v) => { this.values[f.key] = v; }));
            continue;
          }
          this.values[f.key] = String(f.value ?? "");
          const setup = (c) => {
            c.setPlaceholder(f.placeholder ?? "")
             .setValue(String(f.value ?? ""))
             .onChange((v) => { this.values[f.key] = v; });
            c.inputEl.style.width = "100%";
            if (f.type === "number") c.inputEl.type = "number";
            if (f.type === "textarea") c.inputEl.rows = f.rows ?? 4;
            if (f.suggest?.length && AbstractInputSuggest) popups.push(attachSuggest(AbstractInputSuggest, c, f.suggest, (v) => { this.values[f.key] = v; }));
            inputs.push(c.inputEl);
          };
          f.type === "textarea" ? row.addTextArea(setup) : row.addText(setup);
          row.controlEl.style.flex = "1 1 55%";
        }

        new Setting(contentEl)
          .addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()))
          .addButton((b) => b.setButtonText(opts.submitText ?? "Insert").setCta().onClick(() => this.submit()));

        contentEl.addEventListener("keydown", (e) => {
          if (e.key !== "Enter") return;
          if (popups.some(p => p.shown)) return;   // a suggestion is showing: Enter picks it
          const inTextarea = e.target.tagName === "TEXTAREA";
          if (!inTextarea || e.ctrlKey || e.metaKey) { e.preventDefault(); this.submit(); }
        });
        setTimeout(() => { inputs[0]?.focus(); inputs[0]?.select?.(); }, 30);
      }
      submit() { this.done = true; resolve({ ...this.values }); this.close(); }
      onClose() { this.contentEl.empty(); if (!this.done) resolve(null); }
    }
    new FormModal(app).open();
  });
}

/** Suggestions under a text field while its current item is typed. */
function attachSuggest(Base, component, entries, store) {
  const input = component.inputEl;
  class Suggest extends Base {
    shown = false;
    getSuggestions(value) {
      const found = matchNames(entries, currentItem(value, input.selectionStart ?? value.length).query);
      this.shown = found.length > 0;
      return found;
    }
    renderSuggestion(s, el) {
      el.setText(s.name);
      if (s.alias) el.createSpan({ cls: "lab-kit-suggest-alias", text: s.alias });
    }
    selectSuggestion(s) {
      const done = replaceItem(input.value, input.selectionStart ?? input.value.length, s.name);
      component.setValue(done.value);
      input.setSelectionRange(done.cursor, done.cursor);
      store(done.value);
      input.focus();
      this.close();
    }
    close() { this.shown = false; super.close(); }
  }
  return new Suggest(app, input);
}

module.exports = labForm;
Object.assign(module.exports, { matchNames, currentItem, replaceItem });
