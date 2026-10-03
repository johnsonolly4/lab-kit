/* =====================================================================
   labForm: one pop-up form with several fields (Templater user script)
   ---------------------------------------------------------------------
   Setup: Settings → Templater → "User script functions" folder
          = Extras/scripts/templater

     const v = await tp.user.labForm(tp, "Solution prep", [
       { key: "name", label: "Solution name", value: "Solution 1" },
       { key: "nmr",  label: "Add NMR list", type: "toggle", value: true },
     ], { intro: "Optional line of help text" });
     if (v) { ... }            // null if cancelled

   Field types: "text" (default) | "number" | "textarea" | "toggle"
   Keys: Enter = insert (Ctrl+Enter inside a textarea), Esc = cancel
   ===================================================================== */

module.exports = function labForm(tp, title, fields, opts = {}) {
  const { Modal, Setting } = tp.obsidian;

  return new Promise((resolve) => {
    class FormModal extends Modal {
      onOpen() {
        const { contentEl, titleEl } = this;
        titleEl.setText(title);
        if (opts.intro) contentEl.createEl("p", { text: opts.intro, cls: "setting-item-description" });
        this.values = {};
        const inputs = [];

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
};
