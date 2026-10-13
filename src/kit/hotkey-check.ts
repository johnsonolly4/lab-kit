// Check hotkeys: reports, for each kit function, the key the Hotkeys note recommends and what Obsidian has now. Reads only; Lab Kit never sets a key.
// Pure: the caller reads Obsidian's hotkeys and command list into a HotkeyState. Commands are found by the name Obsidian shows (third-party command ids are not known).
import type { KitHotkey } from "./obsidian-private";
import { hotkeyText, sameKey } from "./setup-check";

/** The Hotkeys note's table (`07 How-tos/Obsidian/Hotkeys.md`), one entry per function; `key` is empty for the "no key suggested" commands. tests/hotkeys-note.test.ts keeps both in step. */
export const RECOMMENDED_HOTKEYS: { key?: KitHotkey; does: string; command: string; kit: "lab" | "planning" }[] = [
  { key: { modifiers: ["Alt"], key: "H" }, does: "Homepage", command: "Notebook Navigator: open the homepage", kit: "planning" },
  { key: { modifiers: ["Alt"], key: "D" }, does: "Today's note", command: "Daily notes: Open today's daily note", kit: "planning" },
  { key: { modifiers: ["Alt"], key: "F" }, does: "Search", command: "Omnisearch: Vault search", kit: "planning" },
  { key: { modifiers: ["Alt"], key: "Z" }, does: "Open a paper's note", command: "ZotLit: open the literature note", kit: "planning" },
  { key: { modifiers: ["Alt"], key: "N" }, does: "Quick note into the inbox", command: "Lab Kit: Quick capture", kit: "planning" },
  { key: { modifiers: ["Alt"], key: "T" }, does: "New to-do", command: "Lab Kit: New to-do", kit: "planning" },
  { key: { modifiers: ["Alt"], key: "L" }, does: "New lab entry", command: "Lab Kit: New lab entry", kit: "lab" },
  { key: { modifiers: ["Alt"], key: "U" }, does: "Update this paper's highlights", command: "ZotLit: Update literature note", kit: "planning" },
  { key: { modifiers: ["Alt"], key: "C" }, does: "Insert a citation", command: "ZotLit: insert citation", kit: "planning" },
  { key: { modifiers: ["Alt"], key: "S" }, does: "Insert a lab snippet", command: "Templater: Insert snippet.md", kit: "lab" },
  { key: { modifiers: ["Alt"], key: "M" }, does: "New meeting note", command: "Lab Kit: New meeting", kit: "planning" },
  { key: { modifiers: ["Alt"], key: "P" }, does: "New note in a project", command: "Lab Kit: New project note", kit: "planning" },
  { key: { modifiers: ["Alt"], key: "K" }, does: "New knowledge note", command: "Lab Kit: New concept", kit: "planning" },
  { key: { modifiers: ["Alt"], key: "B" }, does: "To-do board", command: "Lab Kit: Open to-do board", kit: "planning" },
  ...["Add to shopping list", "Sort inbox", "New extra meeting now", "New one-off meeting", "New meeting series", "Open meeting deck", "New project",
    "New topic hub", "Roll over to-dos now", "Archive old to-dos"]
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
export interface HotkeyRow { does: string; command: string; recommended: string; current: string[]; status: HotkeyStatus; detail: string }

/** The command id whose name is `name`; else one with the same plugin prefix whose name contains the part after the colon (Templater names a template command after its path). */
function findCommand(commands: Record<string, string>, name: string): string | undefined {
  const want = name.toLowerCase(), entries = Object.entries(commands);
  const exact = entries.find(([, n]) => n.toLowerCase() === want);
  if (exact) return exact[0];
  const i = want.indexOf(": ");
  if (i < 0) return undefined;
  const prefix = want.slice(0, i + 2), tail = want.slice(i + 2);
  return entries.find(([, n]) => { const l = n.toLowerCase(); return l.startsWith(prefix) && l.includes(tail); })?.[0];
}

/** One row per kit function for the kits that are on, in the Hotkeys note's order. */
export function checkHotkeys(s: HotkeyState): HotkeyRow[] {
  return RECOMMENDED_HOTKEYS.filter(r => r.kit === "lab" || s.planning).map(r => {
    const recommended = r.key ? hotkeyText(r.key) : "";
    const row = (status: HotkeyStatus, detail: string, current: string[] = []): HotkeyRow => ({ does: r.does, command: r.command, recommended, current, status, detail });
    const id = findCommand(s.commands, r.command);
    if (!id) return row("missing", "No command with this name: its plugin is off or not installed, or the name differs in this version.");
    if (!s.hotkeys) return row("unreadable", "Can't read hotkeys in this Obsidian version: look in Settings → Hotkeys.");
    const own = s.hotkeys[id] ?? [], current = own.map(hotkeyText);
    if (!r.key) return row(own.length ? "set" : "none", own.length ? "No key suggested; yours is set." : "No key suggested.", current);
    if (own.some(k => sameKey(k, r.key!))) return row("set", "Set.", current);
    if (own.length) return row("other", `Set to ${current.join(", ")} (yours, left as it is).`, current);
    const clash = Object.entries(s.hotkeys).find(([cmd, keys]) => cmd !== id && keys.some(k => sameKey(k, r.key!)))?.[0];
    return row(clash ? "clash" : "none", clash ? `Not set. ${recommended} is already used by ${s.commands[clash] ?? clash}.` : "Not set.", current);
  });
}

/** The report as a Markdown table, for pasting into a note or a message. */
export function hotkeyReportMarkdown(rows: HotkeyRow[]): string {
  const cell = (t: string): string => t.replace(/\|/g, "\\|");
  return ["| Function | Command | Recommended | Now | Status |", "|---|---|---|---|---|",
    ...rows.map(r => `| ${cell(r.does)} | ${cell(r.command)} | ${r.recommended ? `\`${r.recommended}\`` : ""} | ${r.current.map(c => `\`${c}\``).join(", ")} | ${cell(r.detail)} |`)].join("\n");
}
