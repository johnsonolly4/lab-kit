// Pure helpers for the Snippet icons settings: the icon a snippet note declares, and the list the icon picker shows.

/** The icon a snippet note declares: a `// icon: name` line (plain snippets) or an `icon: name` header line (token templates). Empty when none. */
export function headerIcon(text: string): string {
  const m = /^(?:\/\/\s*)?icon:[ \t]*(.+)$/m.exec(text);
  return m ? m[1].trim().replace(/^["']|["']$/g, "").trim() : "";
}

/** A header's icon may be a fallback list ("grid-3x3, layout-grid", for the different Lucide names across Obsidian versions): the first name `known` accepts, else the first name. */
export function firstIcon(list: string, known: (name: string) => boolean): string {
  const names = list.split(",").map(n => n.trim()).filter(Boolean);
  return names.find(known) ?? names[0] ?? "";
}

/** Lucide ids as Obsidian lists them ("lucide-flask-round") to the name a snippet stores ("flask-round"); other icon sets are left out. */
export function lucideNames(ids: string[]): string[] {
  return ids.filter(id => id.startsWith("lucide-")).map(id => id.slice("lucide-".length)).sort((a, b) => a.localeCompare(b));
}

/** The names that contain every word typed, best (starting with the first word) first, at most `max`. */
export function matchIcons(names: string[], query: string, max = 120): string[] {
  const words = query.toLowerCase().split(/[\s-]+/).filter(Boolean);
  const hits = names.filter(n => words.every(w => n.includes(w)));
  const first = words[0] ?? "";
  return [...hits.filter(n => n.startsWith(first)), ...hits.filter(n => !n.startsWith(first))].slice(0, max);
}
