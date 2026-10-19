// Check hotkeys: reports, for each kit function, the key the Hotkeys note recommends and what Obsidian has now. Reads only; Lab Kit never sets a key.
// Pure: the caller reads Obsidian's hotkeys and command list into a HotkeyState. Commands are found by the name Obsidian shows (third-party command ids are not known).
import type { KitHotkey } from "./obsidian-private";
import { hotkeyText, sameKey } from "./setup-check";
import type { WinState } from "./window-look";

/** The Hotkeys note's table (`07 How-tos/Obsidian/Hotkeys.md`), one entry per function; `key` is empty for the "no key suggested" commands. tests/hotkeys-note.test.ts keeps both in step. */
/** `also`: an older command that does the same (the key set on it counts as set). */
export const RECOMMENDED_HOTKEYS: { key?: KitHotkey; does: string; command: string; also?: string; kit: "lab" | "planning" }[] = [
  { key: { modifiers: ["Alt"], key: "H" }, does: "Homepage", command: "Notebook Navigator: Open homepage", kit: "planning" },
  { key: { modifiers: ["Alt"], key: "D" }, does: "Today's note", command: "Daily notes: Open today's daily note", kit: "planning" },
  { key: { modifiers: ["Alt"], key: "F" }, does: "Search", command: "Omnisearch: Vault search", kit: "planning" },
  { key: { modifiers: ["Alt"], key: "Z" }, does: "Open a paper's note", command: "ZotLit: Open literature note quick switcher", kit: "planning" },
  { key: { modifiers: ["Alt"], key: "N" }, does: "Quick note into the inbox", command: "Lab Kit: Quick capture", kit: "planning" },
  { key: { modifiers: ["Alt"], key: "T" }, does: "New to-do", command: "Lab Kit: New to-do", kit: "planning" },
  { key: { modifiers: ["Alt"], key: "L" }, does: "New lab entry", command: "Lab Kit: New lab entry", kit: "lab" },
  { key: { modifiers: ["Alt"], key: "U" }, does: "Update this paper's highlights", command: "ZotLit: Update literature note", kit: "planning" },
  { key: { modifiers: ["Alt"], key: "C" }, does: "Insert a citation", command: "ZotLit: Insert Markdown citation", kit: "planning" },
  { key: { modifiers: ["Alt"], key: "S" }, does: "Insert a lab snippet", command: "Lab Kit: Insert snippet", also: "Templater: Insert snippet", kit: "lab" },
  { key: { modifiers: ["Alt"], key: "M" }, does: "New meeting note", command: "Lab Kit: New meeting", kit: "planning" },
  { key: { modifiers: ["Alt"], key: "P" }, does: "New note in a project", command: "Lab Kit: New project note", kit: "planning" },
  { key: { modifiers: ["Alt"], key: "K" }, does: "New knowledge note", command: "Lab Kit: New concept", kit: "planning" },
  { key: { modifiers: ["Alt"], key: "B" }, does: "To-do board", command: "Lab Kit: Open to-do board", kit: "planning" },
  ...["Add to shopping list", "Sort inbox", "New extra meeting now", "New one-off meeting", "New meeting series", "Open meeting deck", "New project",
    "New topic hub", "Archive old to-dos", "Link to-dos in order", "Add result"]
    .map(n => ({ does: n, command: `Lab Kit: ${n}`, kit: "planning" as const })),
  { does: "New chemical", command: "Lab Kit: New chemical", kit: "lab" },
  { does: "New rig", command: "Lab Kit: New rig", kit: "lab" },
  { does: "Clone experiment", command: "Lab Kit: Clone experiment", kit: "lab" },
];

export interface HotkeyState {
  planning: boolean;
  /** Hotkeys in use, per command id; null when Obsidian's hotkey manager can't be read. */
  hotkeys: Record<string, KitHotkey[]> | null;
  /** Command names by id (`app.commands`). */
  commands: Record<string, string>;
}

/** set: has the recommended key · other: has a key of your own (left as it is) · none: no key · clash: the recommended key is used by another command · missing: no such command · unreadable: hotkeys can't be read */
export type HotkeyStatus = "set" | "other" | "none" | "clash" | "missing" | "unreadable";
export interface HotkeyRow { does: string; command: string; recommended: string; current: string[]; status: HotkeyStatus; detail: string;
  /** The command's id when it was found, and the suggested key: what Set the suggested keys writes. */
  id?: string; key?: KitHotkey }

/** The command id whose name is `name`; else one with the same plugin prefix whose name ends with the part after the colon (Templater names a template command after its path, with or without `.md`), else one that contains it. */
function findCommand(commands: Record<string, string>, name: string): string | undefined {
  const want = name.toLowerCase(), entries = Object.entries(commands);
  const exact = entries.find(([, n]) => n.toLowerCase() === want);
  if (exact) return exact[0];
  const i = want.indexOf(": ");
  if (i < 0) return undefined;
  const prefix = want.slice(0, i + 2), tail = want.slice(i + 2);
  const same = entries.filter(([, n]) => n.toLowerCase().startsWith(prefix));
  return (same.find(([, n]) => { const l = n.toLowerCase(); return l.endsWith(tail) || l.endsWith(tail + ".md"); }) ?? same.find(([, n]) => n.toLowerCase().includes(tail)))?.[0];
}

/** One row per kit function for the kits that are on, in the Hotkeys note's order. */
export function checkHotkeys(s: HotkeyState): HotkeyRow[] {
  return RECOMMENDED_HOTKEYS.filter(r => r.kit === "lab" || s.planning).map(r => {
    const recommended = r.key ? hotkeyText(r.key) : "";
    const id = findCommand(s.commands, r.command);
    const row = (status: HotkeyStatus, detail: string, current: string[] = []): HotkeyRow => ({ does: r.does, command: r.command, recommended, current, status, detail, ...(id ? { id } : {}), ...(r.key ? { key: r.key } : {}) });
    if (!id) return row("missing", "No command with this name: its plugin is off or not installed, or the name differs in this version.");
    if (!s.hotkeys) return row("unreadable", "Can't read hotkeys in this Obsidian version: look in Settings → Hotkeys.");
    const own = s.hotkeys[id] ?? [], current = own.map(hotkeyText);
    if (!r.key) return row(own.length ? "set" : "none", own.length ? "No key suggested; yours is set." : "No key suggested.", current);
    if (own.some(k => sameKey(k, r.key!))) return row("set", "Set.", current);
    if (own.length) return row("other", `Set to ${current.join(", ")} (yours, left as it is).`, current);
    const clash = Object.entries(s.hotkeys).find(([cmd, keys]) => cmd !== id && keys.some(k => sameKey(k, r.key!)))?.[0];
    if (clash && r.also && clash === findCommand(s.commands, r.also)) return row("set", `Set on ${s.commands[clash] ?? clash}, which opens the same menu.`, [recommended]);
    return row(clash ? "clash" : "none", clash ? `Not set. ${recommended} is already used by ${s.commands[clash] ?? clash}.` : "Not set.", current);
  });
}

/**
 * The rows Set the suggested keys may write: the command is there, has no key at all, and its suggested key is used by nothing else.
 * A command with a key of your own, a clash, a missing command or unreadable hotkeys is never in it.
 */
export const settableHotkeys = (rows: HotkeyRow[]): (HotkeyRow & { id: string; key: KitHotkey })[] =>
  rows.filter((r): r is HotkeyRow & { id: string; key: KitHotkey } => r.status === "none" && !!r.key && !!r.id && !r.current.length);

/** The report as a Markdown table, for pasting into a note or a message. */
export function hotkeyReportMarkdown(rows: HotkeyRow[]): string {
  const cell = (t: string): string => t.replace(/\|/g, "\\|");
  return ["| Function | Command | Recommended | Now | Status |", "|---|---|---|---|---|",
    ...rows.map(r => `| ${cell(r.does)} | ${cell(r.command)} | ${r.recommended ? `\`${r.recommended}\`` : ""} | ${r.current.map(c => `\`${c}\``).join(", ")} | ${cell(r.detail)} |`)].join("\n");
}

/** How a row reads in the window: fine, optional (nothing recommended and none set), something to look at, or missing. */
export function hotkeyRowState(r: HotkeyRow): WinState {
  return r.status === "set" ? "ok" : r.status === "none" && !r.recommended ? "info" : r.status === "other" || r.status === "unreadable" ? "todo" : "missing";
}

/** The big line at the top of Check hotkeys: how many keys need a look, or that all are in place. */
export function hotkeySummary(rows: HotkeyRow[]): string {
  const n = rows.filter(r => { const s = hotkeyRowState(r); return s === "missing" || s === "todo"; }).length;
  return n ? `${n} ${n === 1 ? "key" : "keys"} to look at.` : "Every recommended key is in place.";
}
