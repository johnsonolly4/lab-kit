// The small dropdown under a chip (entry window and the to-do chip bar): a list to pick from (with a search box when it is long), or a date box that shows how it read the words.
// Esc closes only this box (it takes its own keymap scope, so the window behind it stays); a click anywhere else closes it too.
import { Scope, type App } from "obsidian";
import type { EntryField, EntryValue } from "./entry-fields";
import { readDueText } from "./todo-bar";

const SEARCH_FROM = 7;   // a list longer than this gets a search box
let lastClosed: { anchor: HTMLElement; at: number } | null = null;

const nice = (ymd: string): string => new Date(`${ymd}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });

/** Opens the dropdown under `anchor` for a pick or date field; the value, or null when it was closed without a choice. A click on the chip that is already open just closes it. */
export function openFieldPopover(app: App, anchor: HTMLElement, field: EntryField, current: EntryValue | undefined, initialSearch?: string): Promise<EntryValue | null> {
  if (lastClosed && lastClosed.anchor === anchor && Date.now() - lastClosed.at < 300) return Promise.resolve(null);   // the click that closed it
  return new Promise(resolve => {
    const pop = document.body.createDiv({ cls: "vt-pop", attr: { role: "listbox", "aria-label": field.name } });
    const scope = new Scope(app.scope);
    let done = false;
    const close = (v: EntryValue | null): void => {
      if (done) return;
      done = true;
      document.removeEventListener("mousedown", outside, true);
      app.keymap.popScope(scope);
      pop.remove();
      lastClosed = { anchor, at: Date.now() };
      resolve(v);
    };
    const outside = (e: MouseEvent): void => { if (!pop.contains(e.target as Node)) close(null); };
    scope.register([], "Escape", () => { close(null); return false; });
    app.keymap.pushScope(scope);
    document.addEventListener("mousedown", outside, true);

    if (field.kind === "pick") {
      const options = field.options ?? [];
      const search = options.length >= SEARCH_FROM || field.allowNew || initialSearch ? pop.createEl("input", { type: "text", cls: "vt-pop-search", attr: { placeholder: field.prompt } }) : null;
      const list = pop.createDiv({ cls: "vt-pop-list" });
      let shown = options, active = Math.max(0, options.findIndex(o => o.value === current));
      const draw = (): void => {
        list.empty();
        shown.forEach((o, i) => {
          const row = list.createDiv({ cls: `vt-pop-row${i === active ? " is-active" : ""}${o.value === current ? " is-current" : ""}`, text: o.label, attr: { role: "option" } });
          row.addEventListener("mouseenter", () => { active = i; list.querySelectorAll(".vt-pop-row").forEach((r, k) => r.toggleClass("is-active", k === i)); });
          row.addEventListener("click", () => close(o.value));
        });
        if (!shown.length) list.createDiv({ cls: "vt-pop-empty", text: "No match" });
      };
      draw();
      const key = (e: KeyboardEvent): void => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (shown.length) { active = (active + (e.key === "ArrowDown" ? 1 : shown.length - 1)) % shown.length; draw(); list.querySelector(".is-active")?.scrollIntoView({ block: "nearest" }); } }
        else if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); if (shown[active]) close(shown[active].value); }
      };
      if (search) {
        const filter = (): void => {
          const typed = search.value.trim(), q = typed.toLowerCase();
          shown = options.filter(o => o.label.toLowerCase().includes(q));
          if (field.allowNew && typed && !options.some(o => o.label.toLowerCase() === q)) shown = [...shown, { label: `+ New: ${typed}`, value: typed }];   // typed text that is not in the list
          active = 0; draw();
        };
        search.addEventListener("input", filter);
        if (initialSearch) { search.value = initialSearch; filter(); }   // quick capture: the `+name` that matched no project
        search.addEventListener("keydown", key);
        window.setTimeout(() => search.focus(), 0);
      } else {
        pop.tabIndex = -1;
        pop.addEventListener("keydown", key);
        window.setTimeout(() => pop.focus(), 0);
      }
    } else if (field.kind === "text") {
      const input = pop.createEl("input", { type: "text", cls: "vt-pop-search", attr: { placeholder: field.prompt } });
      pop.createDiv({ cls: "vt-pop-hint", text: "Enter saves. Empty clears." });
      if (typeof current === "string") input.value = current;
      input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); close(input.value.trim()); } });
      window.setTimeout(() => { input.focus(); input.select(); }, 0);
    } else {
      const input = pop.createEl("input", { type: "text", cls: "vt-pop-search", attr: { placeholder: "A date, or words like next friday" } });
      const hint = pop.createDiv({ cls: "vt-pop-hint", text: typeof current === "string" && current ? `Now ${nice(current)}. Empty clears.` : "Type words or pick a date." });
      const picker = pop.createEl("input", { type: "date", cls: "vt-pop-date", attr: { "aria-label": "Pick a date" } });
      if (typeof current === "string") picker.value = current;
      input.addEventListener("input", () => {
        const r = readDueText(input.value, new Date());
        hint.setText(!input.value.trim() ? "Empty clears the date." : r?.date ? `Reads as ${nice(r.date)}` : "Not a date yet");
        hint.toggleClass("is-bad", !!input.value.trim() && !r);
      });
      input.addEventListener("keydown", e => {
        if (e.key !== "Enter" || e.isComposing) return;
        e.preventDefault();
        const r = readDueText(input.value, new Date());
        if (r) close(r.date ?? ""); else { hint.setText("Not a date. Try 15 nov, 15/11 or 2026-11-15."); hint.addClass("is-bad"); }
      });
      picker.addEventListener("change", () => { if (picker.value) close(picker.value); });
      window.setTimeout(() => input.focus(), 0);
    }

    const r = anchor.getBoundingClientRect(), h = pop.offsetHeight;
    pop.setCssProps({ "--vt-pop-left": `${Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8))}px`, "--vt-pop-top": `${r.bottom + 4 + h > window.innerHeight ? Math.max(8, r.top - 4 - h) : r.bottom + 4}px` });
  });
}
