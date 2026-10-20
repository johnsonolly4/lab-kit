// Right-click a snippet in the Alt+S menu → Change icon… (I23 Phase 5): the vault side of snippet-icon.ts.
import { TFile, parseYaml, type App } from "obsidian";
import { IconPickerModal } from "./icon-picker-ui";
import { changeIcon, canChangeIcon, type IconDeps } from "./snippet-icon";
import { isTokenTemplate, snippetKey } from "./snippet-copy";
import { makeMyCopy } from "./snippet-copy-ui";
import type { MenuIcons } from "./snippet-menu-ui";
import type { MenuItem } from "./snippet-menu";
import type { KitManaged } from "./managed-ui";

/** What a note is, for deciding where an icon can go (see IconDeps.kind). */
export function snippetKind(text: string): "token" | "calculator" | "stub" | "plain" {
  if (isTokenTemplate(text, parseYaml)) return "token";
  if (snippetKey(text) !== null) return text.startsWith("---") ? "calculator" : "stub";
  return text.trimStart().startsWith("<%*") ? "stub" : "plain";
}

function iconDeps(app: App, managed: KitManaged): IconDeps {
  const file = (p: string): TFile | null => app.vault.getFileByPath(p);
  return {
    read: async p => { const f = file(p); return f ? await app.vault.read(f) : null; },
    write: async (p, text) => { const f = file(p); if (f) await app.vault.process(f, () => text); },
    // an unedited kit file: what the kit wrote, or an older kit text (an update may replace it)
    isKit: async p => (await managed.plan()).some(i => i.dest === p && (i.action === "up-to-date" || i.action === "fast-forward")),
    kind: snippetKind,
    pick: current => new Promise(resolve => { new IconPickerModal(app, current, name => resolve(name), () => window.setTimeout(() => resolve(null), 0)).open(); }),
    copy: p => makeMyCopy(app, p),
  };
}

/** The menu's right-click: only entries that are notes in the Snippets folder (not the built-in methods). */
export function menuIcons(app: App, managed: KitManaged): MenuIcons {
  const path = (it: MenuItem): string | null => (it.value instanceof TFile ? it.value.path : null);
  return {
    can: async it => { const p = path(it); return !!p && await canChangeIcon(iconDeps(app, managed), p); },
    change: async it => {
      const p = path(it);
      const res = p ? await changeIcon(iconDeps(app, managed), p, it.icon?.split(",")[0].trim() ?? "") : null;
      return res ? { icon: res.icon, copied: res.copied } : null;
    },
  };
}
