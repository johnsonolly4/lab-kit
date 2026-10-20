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
// A snippet can also start with a header between --- lines
// (title, icon, desc, group, fields) and use {{tokens}} in its
// text: the Lab Kit plugin then asks the fields and fills it in.
// A header with run: instead of fields (run: solution) runs
// that calculator of Lab Kit.
// The number at the start of the file name sets the order.
// Notes in the Methods folder (Settings → Lab Kit) are added
// after them, one entry per method.
// =========================================================
const here = tp.config.template_file?.parent?.path ?? "Templates";
const snippetFolder = `${here}/Snippets`;
const files = app.vault.getMarkdownFiles()
  .filter(f => f.parent?.path === snippetFolder)
  .sort((a, b) => a.basename.localeCompare(b.basename, undefined, { numeric: true }));

// Token templates are read and filled by the Lab Kit plugin (a snippet without a header is inserted as it is)
const kitSnippets = app.plugins?.plugins?.["lab-kit"]?.snippets;

// With the plugin's menu, NMR, GPC and DLS are listed here (the old stub files 07-09 are gone); a snippet header may say `run:` and `group:`
const methods = (await tp.user?.labMethods?.().menuEntries(app, { builtins: !!kitSnippets?.menu })) ?? [];

if (!files.length && !methods.length) {
  new Notice(`No snippets found in ${snippetFolder}`);
} else {
  const items = [];
  for (const f of files) {
    const text = await app.vault.cachedRead(f);
    const meta = await kitSnippets?.meta(f);
    items.push({
      name: meta?.title || f.basename.replace(/^\d+\s*[-.]?\s*/, ""),
      icon: meta ? meta.icon?.trim() : text.match(/^\/\/\s*icon:\s*(.+)$/m)?.[1]?.trim(),
      desc: meta ? meta.desc?.trim() : text.match(/^\/\/\s*desc:\s*(.+)$/m)?.[1]?.trim(),
      group: meta?.group,
      value: f,
      token: !!meta
    });
  }
  for (const m of methods) items.push({ name: m.name, icon: m.icon, desc: m.desc, value: { method: m.key } });
  // The plugin's grouped menu (Recent, groups, search); labPick.js with an older plugin or none
  const pick = kitSnippets?.menu
    ? await kitSnippets.menu(items)
    : tp.user?.labPick
    ? await tp.user.labPick(tp, items, "Insert snippet…")
    : await tp.system.suggester(items.map(i => i.name), files, false, "Insert snippet…");
  if (pick?.method) tR += await tp.user.labSnippets(tp, `method:${pick.method}`);
  else if (pick) {
    const token = items.find(i => i.value === pick)?.token;
    tR += token ? await kitSnippets.run(tp, pick) : await tp.file.include(pick);
  }
}
%>
