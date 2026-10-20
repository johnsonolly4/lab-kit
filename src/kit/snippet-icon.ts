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
