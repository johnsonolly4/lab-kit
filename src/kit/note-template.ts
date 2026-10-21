// Note templates without Templater (docs/plans/templater-replacement-and-live-snippets.md, Phase 1): a token template whose header says `make: note`
// is a whole note. Pure: the YAML parser, the clock and the vault lookups are passed in. Nothing creates a file here; the caller does.
import { TemplateError, defaultAnswers, fillParts, isCancelled, parseTemplate, type TemplateEnv } from "./snippet-template";
import { emptyEnv } from "./snippet-env";

export interface NoteEnv {
  parseYaml: (yaml: string) => unknown;
  /** The moment `{{today}}` and `{{date:today…}}` use; the real clock when it is left out. */
  now?: Date;
  /** The folder of a template whose header names none (where the empty note sits). */
  folder?: string;
  /** What the tokens read from the vault (other notes' properties, rigs); a template that reads nothing leaves it out. */
  vault?: Partial<TemplateEnv>;
}

/** The note a template makes: its name (no folder, no `.md`; empty when the header names none), its folder and its whole text. */
export interface MadeNote { name: string; folder: string; text: string }

/**
 * The note a `make: note` template makes from the answers (a field left out has its default). The header's `name` and `folder` are filled first,
 * then the body, which can use `{{note-name}}` and `{{folder}}`. Throws a TemplateError for a template that is not `make: note`, a required field
 * that is empty, an unknown token or an `{{#append}}` part (a note has no cursor to leave it out of). The caller makes the file and checks the name.
 */
export function noteFromTemplate(text: string, answers: Record<string, string>, env: NoteEnv): MadeNote {
  const parsed = parseTemplate(text, env.parseYaml);
  if (!parsed || parsed.header.make !== "note") throw new TemplateError("This is not a note template: its header needs make: note.");
  const { header, body } = parsed;
  const tokens = emptyEnv({ ...env.vault, ...(env.now ? { now: env.now } : {}) });
  const all = { ...defaultAnswers(header, tokens), ...Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, String(v ?? "")])) };
  if (isCancelled(header, all)) throw new TemplateError(`Nothing to make: "${header.required}" is empty.`);
  const name = fillParts(header.name ?? "", all, tokens).text.trim();
  const folder = fillParts(header.folder ?? "", all, tokens).text.trim() || env.folder || "";
  const made = fillParts(body, all, { ...tokens, noteName: name, folder });
  if (made.appends.length) throw new TemplateError("{{#append}} does not work in a note template.");
  return { name, folder, text: made.text };
}
