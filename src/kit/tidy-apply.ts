// Tidy up notes, Phase 7b: carries out the changes the user ticked and confirmed. Properties are replaced exactly as the window showed them (only when the
// note still has the "before" block), moves use Obsidian's rename so links update. Every file that is rewritten, or whose links a move rewrites, is
// backed up first. All file access goes through TidyIO, so the rules are tested without Obsidian.
import { replaceBody } from "./tidy-hubs";
import { replaceProperties, type TidyChange, type TidySetting, type TidySettingTarget } from "./tidy";

export interface TidyIO {
  /** Text of a note; null when it is gone. */
  read(path: string): Promise<string | null>;
  write(path: string, text: string): Promise<void>;
  /** Copies `text` to the backups folder as the file at `path` and returns where it went. */
  backup(path: string, text: string): Promise<string>;
  exists(path: string): boolean;
  /** Files at or inside `path` (a file gives itself, a folder its files). */
  filesIn(path: string): string[];
  /** Notes (other than the given ones) whose links point at one of the files: a move rewrites them. */
  linkedFrom(paths: string[]): string[];
  rename(from: string, to: string): Promise<void>;
  /** Sends a file to Obsidian's trash. Missing = the vault cannot trash (the change is skipped). */
  trash?(path: string): Promise<void>;
  /** Makes a new note (folders as needed). Only called when `exists(path)` is false. */
  create(path: string, text: string): Promise<void>;
  /** The saved value of a settings target as text (JSON), for the backup. */
  settingSnapshot(target: TidySettingTarget): string;
  /** Changes the setting while it still equals `from`; null when done, else why not. */
  setSetting(s: TidySetting): Promise<string | null>;
}

export interface TidyOutcome {
  changed: string[];
  moved: { from: string; to: string }[];
  trashed: string[];
  created: string[];
  settings: string[];
  skipped: { path: string; why: string }[];
  /** Backup copy per original path. */
  backups: Record<string, string>;
}

/** Applies the changes: properties first, then moves, then files to the trash, then new notes, then plugin settings (backed up as JSON under settings/). A change that no longer fits (note edited, place taken) is skipped and named, never forced. */
export async function applyTidy(io: TidyIO, changes: TidyChange[]): Promise<TidyOutcome> {
  const out: TidyOutcome = { changed: [], moved: [], trashed: [], created: [], settings: [], skipped: [], backups: {} };
  const backUp = async (path: string, text: string): Promise<void> => { if (!(path in out.backups)) out.backups[path] = await io.backup(path, text); };

  for (const c of changes.filter(x => x.to === undefined && !x.create && !x.setting && !x.body && !x.trash)) {
    try {
      const text = await io.read(c.path);
      if (text === null) { out.skipped.push({ path: c.path, why: "the note is gone" }); continue; }
      const next = replaceProperties(text, c.before, c.after);
      if (next === null) { out.skipped.push({ path: c.path, why: "the note changed since the scan" }); continue; }
      await backUp(c.path, text);
      await io.write(c.path, next);
      out.changed.push(c.path);
    } catch (e) { out.skipped.push({ path: c.path, why: (e as Error).message }); }
  }

  for (const c of changes.filter(x => x.body)) {   // a hub's page: only while it is still what the window showed
    try {
      const text = await io.read(c.path);
      if (text === null) { out.skipped.push({ path: c.path, why: "the note is gone" }); continue; }
      const next = replaceBody(text, c.before, c.after);
      if (next === null) { out.skipped.push({ path: c.path, why: "the note changed since the scan" }); continue; }
      await backUp(c.path, text);
      await io.write(c.path, next);
      if (!out.changed.includes(c.path)) out.changed.push(c.path);
    } catch (e) { out.skipped.push({ path: c.path, why: (e as Error).message }); }
  }

  for (const c of changes) {
    const to = c.to;
    if (to === undefined) continue;
    try {
      const files = io.filesIn(c.path);
      if (!files.length) { out.skipped.push({ path: c.path, why: "nothing there any more" }); continue; }
      if (io.exists(to)) { out.skipped.push({ path: c.path, why: `${to} already exists` }); continue; }
      for (const p of io.linkedFrom(files)) {
        const text = await io.read(p);
        if (text !== null) await backUp(p, text);
      }
      await io.rename(c.path, to);
      out.moved.push({ from: c.path, to });
    } catch (e) { out.skipped.push({ path: c.path, why: (e as Error).message }); }
  }

  for (const c of changes.filter(x => x.trash)) {   // a copy to the backups folder, then the trash
    try {
      const text = await io.read(c.path);
      if (text === null) { out.skipped.push({ path: c.path, why: "the file is gone" }); continue; }
      if (!io.trash) { out.skipped.push({ path: c.path, why: "this vault cannot move files to the trash" }); continue; }
      await backUp(c.path, text);
      await io.trash(c.path);
      out.trashed.push(c.path);
    } catch (e) { out.skipped.push({ path: c.path, why: (e as Error).message }); }
  }

  for (const c of changes.filter(x => x.create)) {
    try {
      if (io.exists(c.path)) { out.skipped.push({ path: c.path, why: "a file with this name already exists" }); continue; }
      await io.create(c.path, c.text ?? `---\n${c.after}\n---\n`);
      out.created.push(c.path);
    } catch (e) { out.skipped.push({ path: c.path, why: (e as Error).message }); }
  }

  for (const c of changes.filter(x => x.setting)) {
    const st = c.setting as TidySetting;
    try {
      if (st.target !== "metabind-button" && st.target !== "templater-folder-remove" && !io.exists(st.to as string)) { out.skipped.push({ path: c.path, why: `${String(st.to)} is not there` }); continue; }
      await backUp(`settings/${st.target}.json`, io.settingSnapshot(st.target));
      const why = await io.setSetting(st);
      if (why !== null) { out.skipped.push({ path: c.path, why }); continue; }
      out.settings.push(c.path);
    } catch (e) { out.skipped.push({ path: c.path, why: (e as Error).message }); }
  }
  return out;
}
