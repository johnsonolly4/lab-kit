// "Make my own copy" for kit snippets: runs a snippet once with no user input and saves the result as a plain note.
// Pure: the script, the vault and the clock are passed in (see docs/plans/make-my-own-copy.md).
import { parseTemplate } from "./snippet-template";

/** One form field as labSnippets.js declares it (only what the stub needs). */
export interface FormField { key?: string; type?: string; value?: unknown; placeholder?: string }

/** The `tp` object a snippet script gets; only what labSnippets.js reads. */
export interface HeadlessTp {
  config: { target_file: { basename: string; path: string } };
  file: { title: string };
  date: { now: (format?: string) => string };
  user: Record<string, unknown>;
}

/** The note name the copy is made under: no digits, so sample codes come out as `<initials>XXXX-A`. */
export const NEUTRAL_NOTE = "Untitled";

/** Snippets that build sample codes from the note name and the Initials setting; their copy holds fixed codes. */
export const CODE_SNIPPETS = ["nmr", "gpc", "dls", "results"];

/** True when the copy of this snippet holds fixed sample codes (the Notice should say so). */
export function hasFixedCodes(key: string): boolean { return CODE_SNIPPETS.includes(key); }

/** Answers a form without showing it: each field's default, or (placeholders = true) the example text of an empty text field. */
export function headlessForm(placeholders: boolean): (tp: unknown, title: string, fields: FormField[]) => Promise<Record<string, unknown>> {
  return async (_tp, _title, fields) => {
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      if (!f.key || f.type === "heading") continue;
      if (f.type === "toggle") out[f.key] = !!f.value;
      else {
        const v = typeof f.value === "string" ? f.value : "";
        const text = !f.type || f.type === "textarea";
        out[f.key] = v === "" && placeholders && text ? String(f.placeholder ?? "").replace(/^e\.g\.\s*/i, "") : v;
      }
    }
    return out;
  };
}

/** A `tp` for a headless run. `user` holds the kit's Templater user scripts (labMethods…); labForm is added here. */
export function headlessTp(user: Record<string, unknown>, placeholders: boolean, today: Date = new Date()): HeadlessTp {
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    config: { target_file: { basename: NEUTRAL_NOTE, path: `${NEUTRAL_NOTE}.md` } },
    file: { title: NEUTRAL_NOTE },
    date: { now: () => `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}` },
    user: { ...user, labForm: headlessForm(placeholders) },
  };
}

/**
 * The text of a snippet run with no input: the defaults first; when that gives nothing (the chemical lists start empty),
 * once more with the example text of the empty text fields. "" when neither run produced anything.
 */
export async function renderCopy(run: (tp: HeadlessTp) => Promise<string>, user: Record<string, unknown>, today?: Date): Promise<string> {
  for (const placeholders of [false, true]) {
    const text = (await run(headlessTp(user, placeholders, today))).trim();
    if (text) return text + "\n";
  }
  return "";
}

/** The snippet a stub note runs: `tp.user.labSnippets(tp, "solution")` → "solution". */
export const snippetKey = (stub: string): string | null => stub.match(/labSnippets\(\s*tp\s*,\s*"([^":]+)"/)?.[1] ?? null;

/** True for a snippet note that is only a stub calling labSnippets.js; a token template is a real note (opening it is useful). */
export const isStubSnippet = (text: string): boolean => snippetKey(text) !== null;

/** True for a token template (a header with `fields`). A header that cannot be read counts as not copyable. */
export function isTokenTemplate(text: string, parseYaml: (yaml: string) => unknown): boolean {
  try { return parseTemplate(text, parseYaml) !== null; } catch { return false; }
}

/** Row 14 (key `method`) is left out: run without answers it only gives the NMR table (user, 2026-10-09). */
export const canCopy = (key: string | null): key is string => !!key && key !== "method";

/** The name offered in the box: `<name> (mine)`. */
export const defaultCopyName = (name: string): string => `${name} (mine)`;

/** `<folder>/<name>.md`, or `<name> 2.md`, `<name> 3.md`… when that path is taken. */
export function copyPath(folder: string, name: string, exists: (path: string) => boolean): string {
  const dir = folder.replace(/^\/+|\/+$/g, "");
  const at = (n: string) => (dir ? `${dir}/` : "") + `${n}.md`;
  let path = at(name);
  for (let n = 2; exists(path); n++) path = at(`${name} ${n}`);
  return path;
}

export interface CopyResult { path: string; fixedCodes: boolean }

/**
 * Saves the copy. Never overwrites: a taken path gets the next free name. Throws when the snippet gives no text,
 * so no empty note is made. Nothing here records the copy as a managed kit file, so Review update… ignores it.
 */
export async function makeSnippetCopy(opts: {
  key: string; /** Name of the snippet, for the error message. */ name: string; /** Name of the copy, without .md. */ copyName: string; folder: string; user: Record<string, unknown>;
  run: (tp: HeadlessTp) => Promise<string>;
  exists: (path: string) => boolean; write: (path: string, text: string) => Promise<void>; today?: Date;
}): Promise<CopyResult> {
  const text = await renderCopy(opts.run, opts.user, opts.today);
  if (!text) throw new Error(`The snippet "${opts.name}" gives no text without answers, so there is nothing to copy.`);
  const path = copyPath(opts.folder, opts.copyName, opts.exists);
  await opts.write(path, text);
  return { path, fixedCodes: hasFixedCodes(opts.key) };
}

/** Copy of a token template: the file itself (header and tokens kept), so the copy still asks its questions. Never overwrites. */
export async function copyTokenTemplate(opts: {
  text: string; /** Name of the snippet, for the error message. */ name: string; copyName: string; folder: string;
  exists: (path: string) => boolean; write: (path: string, text: string) => Promise<void>;
}): Promise<CopyResult> {
  if (!opts.text.trim()) throw new Error(`The snippet "${opts.name}" is empty, so there is nothing to copy.`);
  const path = copyPath(opts.folder, opts.copyName, opts.exists);
  await opts.write(path, opts.text);
  return { path, fixedCodes: false };
}
