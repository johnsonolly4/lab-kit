// The planning kit's buttons as one table (id → label, icon, action), read from the same file the Meta Bind templates come from, so a `show: button-bar` block names ids and holds no action of its own.
import file from "./meta-bind-buttons.json";

export interface BarButton {
  id: string;
  label: string;
  icon?: string;
  tooltip?: string;
  /** Meta Bind's own class on the button, kept for the one styled differently (`vt-help`). */
  cls?: string;
  /** Meta Bind's "plain" style: no border. */
  plain: boolean;
  /** `command`: run a command by id; `open`: open the note named in `target`; `edit`: change the note the block is in (`edit`); `own`: an action the plugin does not know. */
  kind: "command" | "open" | "edit" | "own";
  /** The command id, or the note name of an `open` link (the text inside `[[ ]]`). */
  target: string;
  edit?: BarEdit;
}

/** An edit of the note the button is in: remove text that matches, or set properties. Read from Meta Bind's `regexpReplaceInNote` and `updateMetadata` actions. */
export type BarEdit =
  | { type: "replace"; regexp: string; flags: string; replacement: string }
  | { type: "properties"; values: Record<string, unknown> };

interface RawAction { type?: string; command?: string; link?: string; regexp?: string; regexpFlags?: string; replacement?: string; bindTarget?: string; evaluate?: boolean; value?: string }
interface RawButton { id: string; label?: string; icon?: string; tooltip?: string; class?: string; style?: string; actions?: RawAction[] }

/** `updateMetadata` values are written as text and evaluated (`"false"` → false, `"3"` → 3, other text stays text). */
function evaluated(v: string | undefined, evaluate: boolean | undefined): unknown {
  if (!evaluate) return v ?? "";
  try { return JSON.parse(v ?? ""); } catch { return v ?? ""; }
}

function toEdit(actions: RawAction[]): BarEdit | null {
  const first = actions[0];
  if (actions.length === 1 && first.type === "regexpReplaceInNote" && first.regexp !== undefined) return { type: "replace", regexp: first.regexp, flags: first.regexpFlags ?? "", replacement: first.replacement ?? "" };
  if (actions.every(a => a.type === "updateMetadata" && a.bindTarget)) return { type: "properties", values: Object.fromEntries(actions.map(a => [a.bindTarget as string, evaluated(a.value, a.evaluate)])) };
  return null;
}

function toButton(b: RawButton): BarButton {
  const a = b.actions?.[0];
  const base = { id: b.id, label: b.label ?? b.id, icon: b.icon || undefined, tooltip: b.tooltip || undefined, cls: b.class || undefined, plain: b.style === "plain" };
  if (b.actions?.length === 1 && a?.type === "command" && a.command) return { ...base, kind: "command", target: a.command };
  if (b.actions?.length === 1 && a?.type === "open" && a.link) return { ...base, kind: "open", target: openName(a.link) };
  const edit = b.actions?.length ? toEdit(b.actions) : null;
  if (edit) return { ...base, kind: "edit", target: "", edit };
  return { ...base, kind: "own", target: "" };
}

/** The name inside `[[ ]]` (a link written `[[Note|shown]]` or `[[Note#Heading]]` keeps only the note). */
export function openName(link: string): string {
  const m = /^\[\[([^\]|#]*)/.exec(link.trim());
  return (m ? m[1] : link).trim();
}

export const BAR_BUTTONS: ReadonlyMap<string, BarButton> = new Map(
  (file as { buttonTemplates: RawButton[] }).buttonTemplates.map(b => [b.id, toButton(b)] as const),
);

/** The ids a block lists: `ids: a, b` lines (the key may repeat), split on commas and spaces, in the order written, without repeats. */
export function parseIds(source: string): string[] {
  const out: string[] = [];
  for (const line of source.split("\n")) {
    const m = /^\s*ids\s*:\s*(.*?)\s*$/i.exec(line);
    if (!m) continue;
    for (const id of m[1].split(/[,\s]+/).filter(Boolean)) if (!out.includes(id)) out.push(id);
  }
  return out;
}

/** `align: end` puts the row at the right-hand end of the line (Home's help button). */
export function parseAlignEnd(source: string): boolean {
  return /^\s*align\s*:\s*end\s*$/im.test(source);
}

/** The prefix of an id that runs any Obsidian command: `cmd:refpane:toggle-queue` runs the command `refpane:toggle-queue` (everything after the first `cmd:`). */
const CMD_PREFIX = "cmd:";
/** The icon of a `cmd:` button whose command has none (already used by the table's Quick capture). */
const CMD_ICON = "zap";

/** The command id inside a `cmd:` id, or null when `id` is not one. */
export function cmdId(id: string): string | null {
  return id.startsWith(CMD_PREFIX) && id.length > CMD_PREFIX.length ? id.slice(CMD_PREFIX.length) : null;
}

/** What Obsidian knows of a command (`name`, `icon`); undefined when it is not registered. */
export type CommandLookup = (commandId: string) => { name: string; icon?: string } | undefined;

/** The buttons to draw, and the ids that name no button (or one whose edit is not built yet) for a plain line under the bar. A `cmd:<command id>` id is a button for that Obsidian command, named and drawn from `lookup`; no `lookup` or no such command is a wrong id. */
export function resolveBar(ids: string[], lookup?: CommandLookup): { buttons: BarButton[]; problems: string[] } {
  const buttons: BarButton[] = [], problems: string[] = [];
  for (const id of ids) {
    const cmd = cmdId(id);
    if (cmd) {
      const c = lookup?.(cmd);
      if (c) buttons.push({ id, label: c.name, icon: c.icon || CMD_ICON, plain: false, kind: "command", target: cmd });
      else problems.push(`"${id}" is not a button`);
      continue;
    }
    const b = BAR_BUTTONS.get(id);
    if (!b) problems.push(`"${id}" is not a button`);
    else if (b.kind === "own") problems.push(`"${id}" is not available in a button bar yet`);
    else buttons.push(b);
  }
  return { buttons, problems };
}

/** The note text with a `replace` edit applied (the text unchanged when nothing matches). */
export function applyReplace(text: string, e: Extract<BarEdit, { type: "replace" }>): string {
  return text.replace(new RegExp(e.regexp, e.flags), e.replacement);
}
