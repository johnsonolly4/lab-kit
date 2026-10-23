// Icons live in each snippet's header (I23 Phase 5, docs/plans/snippet-menu.md): writing one, Change icon… in the Alt+S menu.
// Pure: the vault, the picker and Make my own copy are passed in, so the flow is tested with fakes.

/** The text with its icon set to `icon`: the header's `icon:` line replaced (or added after `title:`, else at the end of the header); an old stub's `// icon:` line replaced (or added under `<%*`). null = the text has no header to keep an icon in. */
export function withIcon(text: string, icon: string): string | null {
  const crlf = text.includes("\r\n");
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const line = `icon: ${icon.trim()}`;
  let out: string[] | null = null;
  if (lines[0] === "---") {
    const end = lines.findIndex((l, i) => i > 0 && l === "---");
    if (end > 0) {
      const at = lines.findIndex((l, i) => i > 0 && i < end && /^icon:/.test(l));
      if (at > 0) out = lines.map((l, i) => (i === at ? line : l));
      else {
        const title = lines.findIndex((l, i) => i > 0 && i < end && /^title:/.test(l));
        const after = title > 0 ? title + 1 : end;
        out = [...lines.slice(0, after), line, ...lines.slice(after)];
      }
    }
  } else if (lines[0].trim() === "<%*") {
    const at = lines.findIndex(l => /^\s*\/\/\s*icon:/.test(l));
    out = at > 0 ? lines.map((l, i) => (i === at ? `// ${line}` : l)) : [lines[0], `// ${line}`, ...lines.slice(1)];
  }
  return out ? out.join(crlf ? "\r\n" : "\n") : null;
}

/** What Change icon… needs from the plugin. */
export interface IconDeps {
  read(path: string): Promise<string | null>;
  write(path: string, text: string): Promise<void>;
  /** The file is a kit file nobody has edited (a kit update may replace it, so the icon goes into a copy). */
  isKit(path: string): Promise<boolean>;
  /** What the note is: a token template (Make my own copy keeps its header), a `run:` calculator, an old `<%*` stub, or a plain snippet (inserted as written: no header to keep an icon in). */
  kind(text: string): "token" | "calculator" | "stub" | "plain";
  /** The existing icon picker; null when closed without picking. */
  pick(current: string): Promise<string | null>;
  /** Make my own copy; the path of the new note, null when cancelled. */
  copy(path: string): Promise<string | null>;
}

/** Whether the right-click menu offers Change icon… for this file: it has a header to write into. An unedited kit token template is copied first; an unedited kit calculator (`run:` file: Solution prep, Recipe by equivalents, RAFT, Combined results) is edited in place, because its copy would be its frozen output with no header. */
export async function canChangeIcon(d: Pick<IconDeps, "read" | "isKit" | "kind">, path: string): Promise<boolean> {
  const text = await d.read(path);
  if (text === null || withIcon(text, "x") === null) return false;
  const kind = d.kind(text);
  return kind !== "plain";
}

export type IconResult = { icon: string; path: string; copied: boolean } | null;

/** Change icon…: pick, copy the file first when it is an unedited kit token template, write `icon:` into the header. null = nothing changed. */
export async function changeIcon(d: IconDeps, path: string, current: string): Promise<IconResult> {
  if (!(await canChangeIcon(d, path))) return null;
  const icon = await d.pick(current);
  if (!icon) return null;
  const text0 = await d.read(path);
  const kit = (await d.isKit(path)) && text0 !== null && d.kind(text0) === "token";   // a kit calculator is edited in place (its copy is frozen output)
  const target = kit ? await d.copy(path) : path;
  if (!target) return null;
  const text = await d.read(target);
  const next = text === null ? null : withIcon(text, icon);
  if (next === null) return null;
  await d.write(target, next);
  return { icon, path: target, copied: kit };
}

/** Where the icon line sits in a header: the index of the `icon:` line (-1 = none) and the header's last line (`---`, or the `<%*` stub's top); end < 0 = no header. Lines are split on "\n" only, so a "\r" stays part of its line. */
function iconSlot(lines: string[]): { at: number; end: number; title: number; stub: boolean } {
  if (lines[0] === "---" || lines[0] === "---\r") {
    const end = lines.findIndex((l, i) => i > 0 && l.replace(/\r$/, "") === "---");
    if (end > 0) return { at: lines.findIndex((l, i) => i > 0 && i < end && /^icon:/.test(l)), end, title: lines.findIndex((l, i) => i > 0 && i < end && /^title:/.test(l)), stub: false };
  } else if (lines[0].trim() === "<%*") return { at: lines.findIndex(l => /^\s*\/\/\s*icon:/.test(l)), end: 0, title: -1, stub: true };
  return { at: -1, end: -1, title: -1, stub: false };
}

/**
 * A kit update meets a kit file whose only edit is its `icon:` line (Change icon… in the file itself). `base` = the kit text it was installed from, `cur` = the file now,
 * `kitNew` = the new kit text. Returns `kitNew` with the user's icon line kept (added, replaced or removed to match `cur`), or null when the icon is not the only difference
 * (any other line, the body or a line ending differs: the normal "changed by you" path) or there is nothing to keep (same icon, or a file with no header).
 */
export function keepOwnIcon(base: string, cur: string, kitNew: string): string | null {
  const b = base.split("\n"), c = cur.split("\n"), k = kitNew.split("\n");
  const sb = iconSlot(b), sc = iconSlot(c), sk = iconSlot(k);
  if (sb.end < 0 || sc.end < 0 || sk.end < 0 || sb.stub !== sc.stub || sb.stub !== sk.stub) return null;
  const without = (l: string[], at: number): string[] => (at < 0 ? l : l.filter((_, i) => i !== at));
  const rb = without(b, sb.at), rc = without(c, sc.at);
  if (rb.length !== rc.length || rb.some((l, i) => l !== rc[i])) return null;
  if ((sb.at < 0 ? null : b[sb.at]) === (sc.at < 0 ? null : c[sc.at])) return null;
  const rest = without(k, sk.at);
  if (sc.at < 0) return rest.join("\n");
  const line = c[sc.at];
  if (sk.at >= 0) return k.map((l, i) => (i === sk.at ? line : l)).join("\n");
  // the new kit text has no icon line: add the user's where Change icon… adds one
  const title = sk.title;
  const after = sk.stub ? 1 : title > 0 ? title + 1 : sk.end;
  return [...rest.slice(0, after), line, ...rest.slice(after)].join("\n");
}
