// The Alt+S menu's contents (pure): which group a snippet is in, the sections in order, Recent, and the search. The window is snippet-menu-ui.ts.
// Plan: docs/plans/snippet-menu.md Phases 1 and 4. The group of a snippet is its header's `group:`.

/** One menu entry, as Insert snippet.md lists it: a Snippets-folder note or a Methods-folder method (`value.method`). */
export interface MenuItem { name: string; icon?: string; desc?: string; /** The header's `group:`. */ group?: string; /** An old-form stub file: the calculator key it runs. */ oldStub?: string; value: unknown }
export interface MenuSection { heading: string; items: MenuItem[] }

/** The groups in the order the menu shows them; your own snippets come last. */
export const GROUPS = ["Make up", "Samples", "Characterise", "Flow", "Tables"] as const;
export const OWN_GROUP = "My snippets";
export const RECENT_HEADING = "Recent";
export const RECENT_MAX = 3;

const isMethod = (it: MenuItem): boolean => !!it.value && typeof it.value === "object" && "method" in it.value;
/** NMR, GPC and DLS (labMethods.js `builtins`): listed ahead of the other entries of their group, where their stub files 07-09 used to stand. */
const BUILTIN_METHODS = ["nmr", "gpc", "dls"];
const isBuiltin = (it: MenuItem): boolean => isMethod(it) && BUILTIN_METHODS.includes(String((it.value as { method: unknown }).method));

/** An old stub file (`07 NMR samples.md` kept in the vault) whose calculator is also a built-in method is listed once: the built-in stays, the file is hidden. */
export const hideShadowedStubs = (items: MenuItem[]): MenuItem[] =>
  items.filter(it => !it.oldStub || !items.some(m => isMethod(m) && (m.value as { method: unknown }).method === it.oldStub));

/** The group an entry is shown under: a Methods-folder method is Characterise, otherwise the header's `group:` when it names one of the groups; no group, or any other text, is My snippets. */
export function groupOf(it: MenuItem): string {
  if (isMethod(it)) return "Characterise";
  return GROUPS.find(g => g.toLowerCase() === (it.group ?? "").trim().toLowerCase()) ?? OWN_GROUP;
}

/** The entries left after the groups switched off under Settings → Snippets are dropped (menu, search and Recent all read this list). `off` holds group names as the settings show them. */
export function visibleItems(items: MenuItem[], off: readonly string[]): MenuItem[] {
  if (!off.length) return items;
  const hidden = new Set(off.map(g => g.trim().toLowerCase()));
  return items.filter(it => !hidden.has(groupOf(it).toLowerCase()));
}

/** The sections with an empty search box: Recent (newest first, only names still listed), then each group that has entries, in the order of `items`. */
export function menuSections(items: MenuItem[], recent: string[]): MenuSection[] {
  const byName = new Map(items.map(it => [it.name, it]));
  const rec = recent.map(n => byName.get(n)).filter((it): it is MenuItem => !!it).slice(0, RECENT_MAX);
  const out: MenuSection[] = rec.length ? [{ heading: RECENT_HEADING, items: rec }] : [];
  for (const g of [...GROUPS, OWN_GROUP]) {
    const inGroup = items.filter(it => groupOf(it) === g);
    inGroup.sort((a, b) => Number(isBuiltin(b)) - Number(isBuiltin(a)));   // stable: the rest keep their order
    if (inGroup.length) out.push({ heading: g, items: inGroup });
  }
  return out;
}

/** 3 = the name starts with the search, 2 = a word of the name starts with it, 1 = the name or description contains it, 0 = no match. */
function score(it: MenuItem, q: string): number {
  const name = it.name.toLowerCase();
  if (name.startsWith(q)) return 3;
  if (name.split(/[\s\-/()]+/).some(w => w.startsWith(q))) return 2;
  return name.includes(q) || (it.desc ?? "").toLowerCase().includes(q) ? 1 : 0;
}

/** Typing: one flat list, best match first, ties in menu order (no Recent section). */
export function searchItems(items: MenuItem[], query: string): MenuItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const order = menuSections(items, []).flatMap(s => s.items);
  return order.map((it, i) => ({ it, i, s: score(it, q) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s || a.i - b.i).map(x => x.it);
}

/** The Recent list after picking `name`: it goes first, no repeats, at most RECENT_MAX. */
export const pushRecent = (recent: string[], name: string): string[] => [name, ...recent.filter(n => n !== name)].slice(0, RECENT_MAX);

/** The icon names to try for an entry: the one picked under Settings → Snippet icons first (until Phase 5), then the snippet's own, comma lists allowed. */
export function iconNames(it: MenuItem, custom: Record<string, string>): string[] {
  return [custom[it.name] ?? "", it.icon ?? ""].join(",").split(",").map(s => s.trim()).filter(Boolean);
}
