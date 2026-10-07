<%*
// Opens the Thursday deck in PowerPoint (or whatever opens .pptx on this computer).
// The paths live in the "Weekly meetings" note: deck_windows and deck_mac.
const hub = app.metadataCache.getFirstLinkpathDest("Weekly meetings", "");
const fm = (hub && app.metadataCache.getFileCache(hub)?.frontmatter) || {};
const isMac = (window.process && window.process.platform === "darwin") || /mac/i.test(navigator.platform);
const deck = String((isMac ? fm.deck_mac : fm.deck_windows) || "").trim().replace(/^["']|["']$/g, "");
if (!deck) {
  new Notice(`No Thursday deck set for ${isMac ? "Mac" : "Windows"} yet - add the path in Weekly meetings.`);
  if (hub) { await app.workspace.getLeaf(false).openFile(hub); }
} else {
  const error = await window.require("electron").shell.openPath(deck);
  if (error) { new Notice(`Couldn't open the deck: ${error}`); }
}
-%>
