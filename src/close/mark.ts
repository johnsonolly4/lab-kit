// Close experiment, pure part: the closed mark, the note hash and the PDF footer text. No I/O, no UI; works on mobile.
// The note is never rewritten by closing; the hash only lets a later edit be detected.
import { prop } from "../frontmatter";
import { text } from "../calc/engine";

const MARK_LINE = /^(closed_on|closed_hash|closed_pdf|closed_pdf_old|status)\s*:/i;
const FOOTER_HASH_LENGTH = 12;

/** The note as the hash sees it: `\n` line ends, no `closed_*` lines and no `Status` line in the front matter (a board drag is not an edit). */
export function withoutClosedLines(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  if (lines[0] !== "---") return lines.join("\n");
  const end = lines.indexOf("---", 1);
  if (end < 0) return lines.join("\n");
  // A list value (`closed_pdf:` followed by `  - x` lines) belongs to its key: drop those lines with it.
  const out: string[] = [];
  let skipping = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i > 0 && i < end) {
      if (MARK_LINE.test(line)) { skipping = true; continue; }
      if (skipping && /^\s+\S|^\s*-\s/.test(line)) continue;
      skipping = false;
    }
    out.push(line);
  }
  return out.join("\n");
}

/** SHA-256 (64 lowercase hex) of the note text without the closed mark and Status. */
export async function closedHash(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(withoutClosedLines(text)));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("");
}

const filled = (v: unknown): boolean => v != null && text(v).trim() !== "";

/** `closed_on` holds a value: the experiment has ended. Alone this is not a formal close (an old note's `Exp. End` moved by Tidy lands here). */
export function hasEnded(fm: Record<string, unknown> | undefined): boolean {
  return filled(prop(fm, "closed_on"));
}

/** A note is formally closed when `closed_on` is set AND Close left its trace: `closed_hash` or `closed_pdf` (`pending` counts). Status `Closed` alone does not close, and neither does a bare `closed_on`. */
export function isClosed(fm: Record<string, unknown> | undefined): boolean {
  return hasEnded(fm) && (filled(prop(fm, "closed_hash")) || filled(prop(fm, "closed_pdf")));
}

/** The line printed at the foot of every PDF page. */
export function closedFooter(date: string, noteName: string, hash: string): string {
  return `Closed ${date} · ${noteName} · SHA-256 ${hash.slice(0, FOOTER_HASH_LENGTH)}`;
}
