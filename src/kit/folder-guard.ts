// A kit folder named in the settings is missing: most likely moved outside Obsidian (no rename event, so its setting couldn't follow).
// Say so instead of quietly making an empty folder of the old name beside the moved one.
import { Notice, type App } from "obsidian";
import { ensureFolder } from "./ensure-folder";

/** What the notice's buttons do (the plugin supplies them: settings tab, the Find moved folders window). */
export interface FolderGuardActions { openSettings(): void; findMoved(): void }

/** The line shown by the notice and by blocks that read the folder. */
export const folderMissingText = (path: string): string =>
  `Folder "${path}" not found. Moved outside Obsidian? Set it in Settings → Lab Kit → Planning → Planning folders, or use Find moved folders.`;

/** Notice with Find moved folders / Open settings / Create it. */
export function missingFolderNotice(app: App, path: string, actions: FolderGuardActions): void {
  const frag = createFragment(f => {
    f.createDiv({ text: folderMissingText(path) });
    const row = f.createDiv({ cls: "lab-kit-notice-row" });
    const button = (text: string, run: () => void): void => {
      row.createEl("button", { text, cls: "lab-kit-notice-btn" }).addEventListener("click", () => { notice.hide(); run(); });
    };
    button("Find moved folders", () => actions.findMoved());
    button("Open settings", () => actions.openSettings());
    button("Create it", () => {
      void ensureFolder(app.vault, path).then(made => new Notice(made ? `Created ${path}. Run the command again.` : `Could not create ${path}.`));
    });
  });
  const notice = new Notice(frag, 0);
}
