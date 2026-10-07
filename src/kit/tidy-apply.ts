// Tidy up notes, Phase 7b: carries out the changes the user ticked and confirmed. Properties are replaced exactly as the window showed them (only when the
// note still has the "before" block), moves use Obsidian's rename so links update. Every file that is rewritten, or whose links a move rewrites, is
// backed up first. All file access goes through TidyIO, so the rules are tested without Obsidian.
import { replaceProperties, type TidyChange } from "./tidy";

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
}

export interface TidyOutcome {
  changed: string[];
  moved: { from: string; to: string }[];
  skipped: { path: string; why: string }[];
  /** Backup copy per original path. */
  backups: Record<string, string>;
}

/** Applies the changes: properties first, then moves. A change that no longer fits (note edited, place taken) is skipped and named, never forced. */
export async function applyTidy(io: TidyIO, changes: TidyChange[]): Promise<TidyOutcome> {
  const out: TidyOutcome = { changed: [], moved: [], skipped: [], backups: {} };
  const backUp = async (path: string, text: string): Promise<void> => { if (!(path in out.backups)) out.backups[path] = await io.backup(path, text); };

  for (const c of changes.filter(x => x.to === undefined)) {
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
  return out;
}
