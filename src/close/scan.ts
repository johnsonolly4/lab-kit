// Close experiment (I24 Phase 4): which lab notes Check setup lists. The notes come in as plain data, so the rules are tested without Obsidian.
import { closedHash, isClosed } from "./mark";
import { PENDING } from "./commands";
import { prop } from "../frontmatter";
import { text } from "../calc/engine";

type Fm = Record<string, unknown> | undefined;

export interface ClosedNote { path: string; name: string; fm: Fm; read(): Promise<string> }
export interface ClosedRef { path: string; name: string }
export interface ClosedScan {
  /** Closed, and the note now hashes differently from `closed_hash`. */
  edited: ClosedRef[];
  /** Status Closed set by hand: no `closed_on`. */
  unclosed: ClosedRef[];
  /** Closed with `closed_pdf: pending`. */
  noPdf: ClosedRef[];
}

/** Sorts the lab notes into the three cases Check setup reports. A note with no `closed_hash` is not called edited (nothing to compare with). */
export async function scanClosed(notes: ClosedNote[]): Promise<ClosedScan> {
  const out: ClosedScan = { edited: [], unclosed: [], noPdf: [] };
  for (const n of notes) {
    const ref = { path: n.path, name: n.name };
    if (!isClosed(n.fm)) {
      if (text(prop(n.fm, "Status")).trim().toLowerCase() === "closed") out.unclosed.push(ref);
      continue;
    }
    if (text(prop(n.fm, "closed_pdf")).trim().toLowerCase() === PENDING) out.noPdf.push(ref);
    const stored = text(prop(n.fm, "closed_hash")).trim();
    if (stored && stored !== await closedHash(await n.read())) out.edited.push(ref);
  }
  return out;
}
