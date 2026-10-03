# Settings definitions API (Obsidian 1.13+)

Source: `node_modules/obsidian/obsidian.d.ts` (1.13.1) and https://docs.obsidian.md/plugins/guides/migrate-declarative-settings

- `PluginSettingTab.getSettingDefinitions(): SettingDefinitionItem[]` replaces `display()` (skipped when it returns a non-empty array; keep `display()` only to support < 1.13). Called once at registration (search index) and on every `this.update()`: keep it cheap, no I/O. Refresh with `this.update()`; `refreshDomState()` re-evaluates `visible` / `disabled` only.
- `SettingDefinitionItem` = a row (`SettingDefinition`) | group | list | page.
  - Row: `{ name, desc?, aliases?, searchable?, visible? }` plus at most one of:
    - `control: { type: "toggle" | "dropdown" | "text" | "textarea" | "number" | "file" | "folder" | "slider" | "color", key, defaultValue?, validate?, disabled? }`: Obsidian renders and saves through `tab.getControlValue(key)` / `tab.setControlValue(key, value)` (default: `plugin.settings[key]`; override both for nested data).
    - `render: (setting: Setting, group: SettingGroup) => void | (() => void)`: imperative row, you save yourself. **Must return void or a cleanup function** (an arrow returning `setting.addText(..)` fails to compile).
    - `action: (el, index) => void`: clickable row.
    - none: a plain text row (`name` + `desc`).
  - Group: `{ type: "group" | "list", heading?, cls?, items?: SettingGroupItem[] }`. Items are rows or pages, **not** groups. A group has no `desc`; headings are group `heading`s, items have no `heading`.
  - List adds `emptyState`, `onReorder`, `onDelete`, `addItem`. Page: `{ type: "page", name, items | page }`.
- `Setting.setDestructive()` replaces `setWarning()`.
- eslint-plugin-obsidianmd: `prefer-setting-definitions` (implement it), `no-deprecated-display` (fires when `display()` stays and `minAppVersion` >= 1.13), `prefer-update-over-display` (use `this.update()`).
