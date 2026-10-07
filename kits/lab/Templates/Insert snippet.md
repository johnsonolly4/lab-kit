<%*
// =========================================================
// SNIPPET MENU: give this template a hotkey (e.g. Alt+S)
// Lists every note in the "Snippets" folder next to this
// template with its icon and description, and inserts the
// one you pick at the cursor.
//
// Snippet files start with two comment lines:
//   // icon: flask-round        (Lucide name, see lucide.dev)
//   // desc: one-line description
// The number at the start of the file name sets the order.
// Notes in the Methods folder (Settings → Lab Kit) are added
// after them, one entry per method.
// =========================================================
const here = tp.config.template_file?.parent?.path ?? "Templates";
const snippetFolder = `${here}/Snippets`;
const files = app.vault.getMarkdownFiles()
  .filter(f => f.parent?.path === snippetFolder)
  .sort((a, b) => a.basename.localeCompare(b.basename, undefined, { numeric: true }));

const methods = (await tp.user?.labMethods?.().menuEntries(app)) ?? [];

if (!files.length && !methods.length) {
  new Notice(`No snippets found in ${snippetFolder}`);
} else {
  const items = [];
  for (const f of files) {
    const text = await app.vault.cachedRead(f);
    items.push({
      name: f.basename.replace(/^\d+\s*[-.]?\s*/, ""),
      icon: text.match(/^\/\/\s*icon:\s*(.+)$/m)?.[1]?.trim(),
      desc: text.match(/^\/\/\s*desc:\s*(.+)$/m)?.[1]?.trim(),
      value: f
    });
  }
  for (const m of methods) items.push({ name: m.name, icon: m.icon, desc: m.desc, value: { method: m.key } });
  const pick = tp.user?.labPick
    ? await tp.user.labPick(tp, items, "Insert snippet…")
    : await tp.system.suggester(items.map(i => i.name), files, false, "Insert snippet…");
  if (pick?.method) tR += await tp.user.labSnippets(tp, `method:${pick.method}`);
  else if (pick) tR += await tp.file.include(pick);
}
%>
