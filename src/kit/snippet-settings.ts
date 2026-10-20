// Settings → Lab Kit → Snippets: one toggle per Alt+S menu group (docs/plans/snippet-menu.md Phase 4). A switched-off group is skipped by the menu, its search and Recent (visibleItems in snippet-menu.ts); no file is removed.
import type { SettingGroupItem } from "obsidian";
import { GROUPS } from "./snippet-menu";
import type { KitData } from "./paths";

export const GROUP_TOGGLE_DESC = "Show these snippets in the Alt+S menu.";

/** Switching a group on removes it from `kit.snippetGroupsOff`, off adds it (no repeats). */
export function setGroupShown(kit: Pick<KitData, "snippetGroupsOff">, group: string, shown: boolean): void {
  const rest = kit.snippetGroupsOff.filter(n => n !== group);
  kit.snippetGroupsOff = shown ? rest : [...rest, group];
}

/** Wording from the plan (N4 Q12). */
export const FORMS_AT_CURSOR = { name: "Open snippet forms at the cursor", desc: "Off: forms open in the middle of the window." };

/** The switch for where the Alt+S question windows open (desktop; a phone always has them in the middle). */
export const formsAtCursorRow = (kit: KitData, save: () => Promise<void>): SettingGroupItem => ({
  ...FORMS_AT_CURSOR,
  render: b => { b.addToggle(t => t.setValue(kit.snippetFormsAtCursor).onChange(async v => { kit.snippetFormsAtCursor = v; await save(); })); }
});

export const groupToggleRows = (kit: KitData, save: () => Promise<void>): SettingGroupItem[] => GROUPS.map((g): SettingGroupItem => ({
  name: g, desc: GROUP_TOGGLE_DESC,
  render: b => { b.addToggle(t => t.setValue(!kit.snippetGroupsOff.includes(g)).onChange(async v => { setGroupShown(kit, g, v); await save(); })); }
}));
