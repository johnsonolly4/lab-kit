<%*
// =========================================================
// SNIPPET MENU: Lab Kit opens it (command "Lab Kit: Insert snippet").
// Give that command a hotkey (e.g. Alt+S) in Obsidian → Hotkeys.
// This template only calls the command, so a Templater hotkey on
// it (older setups) still opens the same menu.
//
// The menu lists the notes in the "Snippets" folder next to this
// template, plus the notes of the Methods folder (Settings → Lab Kit).
// Snippet files start with a header between --- lines (title, icon,
// desc, group, fields, run) and use {{tokens}} in their text; a snippet
// without a header is inserted as it is.
// =========================================================
app.commands.executeCommandById("lab-kit:insert-snippet");
%>
