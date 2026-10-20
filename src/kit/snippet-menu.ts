// The Alt+S menu's contents (pure): which group a snippet is in, the sections in order, Recent, and the search. The window is snippet-menu-ui.ts.
// Plan: docs/plans/snippet-menu.md Phase 1. Until snippet headers carry `group:` (Phase 4) the kit snippets are grouped by name here.

/** One menu entry, as Insert snippet.md lists it: a Snippets-folder note or a Methods-folder method (`value.method`). */
export interface MenuItem { name: string; icon?: string; desc?: string; /** The header's `group:`. */ group?: string; value: unknown }
export interface MenuSection { heading: string; items: MenuItem[] }

/** The groups in the order the menu shows them; your own snippets come last. */
export const GROUPS = ["Make up", "Samples", "Characterise", "Flow", "Tables"] as const;
export const OWN_GROUP = "My snippets";
export const RECENT_HEADING = "Recent";
export const RECENT_MAX = 3;

/** The kit snippets by the name the menu shows (file name without its number, or the header's title). */
const KIT_GROUPS: Record<string, (typeof GROUPS)[number]> = {
  "solution prep": "Make up", "recipe by equivalents": "Make up", "raft recipe generator": "Make up",
  "sample list": "Samples", "sampling timetable": "Samples", "variant naming matrix": "Samples",
  "nmr samples": "Characterise", "gpc samples": "Characterise", "dls samples": "Characterise", "combined results": "Characterise",
  "rig": "Flow", "flow column prep": "Flow", "residence times": "Flow",
  "blank calc table": "Tables",
};

const isMethod = (it: MenuItem): boolean => !!it.value && typeof it.value === "object" && "method" in it.value;

/** The group an entry is shown under: a Methods-folder method is Characterise, a header's `group:` when it names one of the groups, a kit snippet its group, anything else My snippets. */
export function groupOf(it: MenuItem): string {
  if (isMethod(it)) return "Characterise";
  const named = GROUPS.find(g => g.toLowerCase() === (it.group ?? "").trim().toLowerCase());
  if (named) return named;
  return KIT_GROUPS[it.name.trim().toLowerCase()] ?? OWN_GROUP;
}

/** The sections with an empty search box: Recent (newest first, only names still listed), then each group that has entries, in the order of `items`. */
export function menuSections(items: MenuItem[], recent: string[]): MenuSection[] {
  const byName = new Map(items.map(it => [it.name, it]));
  const rec = recent.map(n => byName.get(n)).filter((it): it is MenuItem => !!it).slice(0, RECENT_MAX);
  const out: MenuSection[] = rec.length ? [{ heading: RECENT_HEADING, items: rec }] : [];
  for (const g of [...GROUPS, OWN_GROUP]) {
    const inGroup = items.filter(it => groupOf(it) === g);
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
