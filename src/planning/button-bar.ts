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
  /** `command`: run a command by id; `open`: open the note named in `target`; `own`: an edit the plugin must do itself (not built yet). */
  kind: "command" | "open" | "own";
  /** The command id, or the note name of an `open` link (the text inside `[[ ]]`). */
  target: string;
}

interface RawButton { id: string; label?: string; icon?: string; tooltip?: string; class?: string; style?: string; actions?: { type?: string; command?: string; link?: string }[] }

function toButton(b: RawButton): BarButton {
  const a = b.actions?.[0];
  const base = { id: b.id, label: b.label ?? b.id, icon: b.icon || undefined, tooltip: b.tooltip || undefined, cls: b.class || undefined, plain: b.style === "plain" };
  if (b.actions?.length === 1 && a?.type === "command" && a.command) return { ...base, kind: "command", target: a.command };
  if (b.actions?.length === 1 && a?.type === "open" && a.link) return { ...base, kind: "open", target: openName(a.link) };
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

/** The buttons to draw, and the ids that name no button (or one whose edit is not built yet) for a plain line under the bar. */
export function resolveBar(ids: string[]): { buttons: BarButton[]; problems: string[] } {
  const buttons: BarButton[] = [], problems: string[] = [];
  for (const id of ids) {
    const b = BAR_BUTTONS.get(id);
    if (!b) problems.push(`"${id}" is not a button`);
    else if (b.kind === "own") problems.push(`"${id}" is not available in a button bar yet`);
    else buttons.push(b);
  }
  return { buttons, problems };
}
