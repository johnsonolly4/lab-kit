<%*
// Adds items to the end of 00 Planning/Shopping list.md. Run from the "Add to shopping" button.
const PATH = "00 Planning/Shopping list.md";
const file = app.vault.getAbstractFileByPath(PATH);
if (!file) {
  new Notice("Shopping list not found: " + PATH);
} else {
  const input = await tp.user.vtAsk(tp, "Add to lab shopping list (commas between items)");
  if (input) {
    const items = input.split(",").map(s => s.trim()).filter(Boolean);
    await app.vault.process(file, text => text.replace(/\s*$/, "\n") + items.map(i => "- [ ] " + i).join("\n") + "\n");
    new Notice(`Added ${items.length} to the shopping list`);
  }
}
-%>
