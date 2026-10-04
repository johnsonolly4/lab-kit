// "Open data folder" button: creates <data root>/<note name> when pressed, then opens it. Desktop only (Node/Electron).
import { Notice, Platform } from "obsidian";
import { nodeModule } from "../node";
import type { HeaderSettings } from "../header/settings";

export function openDataFolder(noteName: string, s: HeaderSettings): void {
  const fs = nodeModule("fs"), path = nodeModule("path");
  if (!fs || !path) { new Notice("The data folder button works in the desktop app only."); return; }
  const win = Platform.isWin;
  const root = win ? s.dataRootWindows : s.dataRootMac;
  if (!root) { new Notice("Set your data folder first: Settings → Lab Kit → Data folder root.", 8000); return; }
  try {
    const dir = path.join(root, noteName);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (win) {
      // Starting Explorer ourselves lets Windows bring the window to the front
      const cp = nodeModule("child_process");
      if (!cp) return;
      cp.spawn("explorer.exe", [dir.replace(/\//g, "\\")], { detached: true, stdio: "ignore" }).unref();
    } else {
      const electron = nodeModule("electron");
      if (!electron) return;
      void electron.shell.openPath(dir).then(err => { if (err) new Notice(err); });
    }
  } catch (e) {
    new Notice("Couldn't open the data folder. Is the drive available?\n" + (e as Error).message);
  }
}
