// Close experiment (I24 Phase 3): the Close and Reopen steps, in the order the owner decided. The note's text is never rewritten:
// Close saves a PDF, then sets `closed_on`, `closed_hash`, `closed_pdf` and Status; Reopen clears the mark and keeps the PDFs.
// Everything that touches Obsidian or the disk comes in through `CloseHost`, so the steps are tested without either.
import { closedFooter, closedHash, isClosed } from "./mark";
import { prop } from "../frontmatter";
import { text } from "../calc/engine";

type Fm = Record<string, unknown>;

export const CLOSED_STATUS = "Closed";
/** What Reopen puts back in Status: the Lab book base has Planned, Started, Processing results, Closed (there is no "Running"). */
export const REOPEN_STATUS = "Started";
export const PENDING = "pending";

export const MSG = {
  notLab: "This is not a lab note.",
  noFolder: "Set a folder for closed-experiment PDFs first.",
  noPdfHere: "Experiment closed. No PDF on this device: make it on a computer (Check setup).",
  reopened: "Experiment reopened.",
  alreadyClosed: (date: string) => `This note is already closed (on ${date}).`,
  saved: (file: string) => `Experiment closed. PDF saved: ${file}.`,
  failed: (folder: string) => `Could not save the PDF in ${folder}. See the developer console.`,
};

export interface CloseHost {
  /** The note's name without `.md`. */
  name: string;
  /** Today as YYYY-MM-DD. */
  today: string;
  /** Is this a lab note (a numbered note in the lab notes folder)? */
  isLabNote: boolean;
  /** Can this device make a PDF (desktop with Node)? */
  canPdf: boolean;
  /** The destination folders (absolute) set on this device. */
  folders: string[];
  readText(): Promise<string>;
  frontmatter(): Fm | undefined;
  /** Edits the front matter in place (Obsidian: `processFrontMatter`). */
  editFrontmatter(fn: (fm: Fm) => void): Promise<void>;
  /** The note as a PDF with `footer` on every page; null when this Obsidian cannot print. */
  makePdf(footer: string): Promise<ArrayBuffer | null>;
  fileExists(folder: string, name: string): boolean;
  /** Throws when the folder cannot be written. */
  saveFile(folder: string, name: string, bytes: ArrayBuffer): void;
  /** Asks the user; false = cancelled. `folders` is empty where no PDF is made. */
  confirm(kind: "close" | "reopen", date: string, folders: string[]): Promise<boolean>;
  notice(message: string): void;
  logError(error: unknown): void;
}

/** `<note name> (closed YYYY-MM-DD).pdf`; a second close the same day is `(closed YYYY-MM-DD, 2).pdf`, then 3 … Characters a file name cannot hold become `-`. `taken` says whether a name is in use. */
export function pdfFileName(noteName: string, date: string, taken: (name: string) => boolean): string {
  const base = noteName.replace(/[\\/:*?"<>|]/g, "-");
  for (let n = 1; ; n++) {
    const name = `${base} (closed ${date}${n > 1 ? `, ${n}` : ""}).pdf`;
    if (!taken(name)) return name;
  }
}

const closedOn = (fm: Fm | undefined): string => text(prop(fm, "closed_on")).trim();

export async function closeExperiment(h: CloseHost): Promise<void> {
  if (!h.isLabNote) { h.notice(MSG.notLab); return; }
  const fm = h.frontmatter();
  if (isClosed(fm)) { h.notice(MSG.alreadyClosed(closedOn(fm))); return; }
  if (h.canPdf && !h.folders.length) { h.notice(MSG.noFolder); return; }
  // The PDF is made today: its name, footer and the confirm window carry today's date. A note that has only `closed_on` (ended, never formally closed) keeps that end date in `closed_on`.
  const date = h.today;
  if (!(await h.confirm("close", date, h.canPdf ? h.folders : []))) return;

  const hash = await closedHash(await h.readText());
  const files: string[] = [];
  let pdfMissing = false;
  if (h.canPdf) {
    const footer = closedFooter(date, h.name, hash);
    const bytes = await h.makePdf(footer);
    if (!bytes) pdfMissing = true;
    else {
      const name = pdfFileName(h.name, date, n => h.folders.some(f => h.fileExists(f, n)));
      for (const folder of h.folders) {
        try { h.saveFile(folder, name, bytes); if (!files.includes(name)) files.push(name); }
        catch (e) { h.logError(e); h.notice(MSG.failed(folder)); }
      }
    }
  }
  await h.editFrontmatter(f => {
    f.closed_on = closedOn(fm) || date;   // the experiment's end date stays when the note already had one
    f.closed_hash = hash;
    f.closed_pdf = files.length ? files : PENDING;
    f.Status = CLOSED_STATUS;
  });
  if (files.length) h.notice(MSG.saved(files[0]));
  else if (pdfMissing) h.notice("Experiment closed. This Obsidian cannot make the PDF here: Check setup lists it as pending.");
  else if (!h.canPdf) h.notice(MSG.noPdfHere);
}

/** Check setup's Make PDF: the PDF of a note closed without one (`closed_pdf: pending`). The footer carries the note's own `closed_date` and `closed_hash`, so it matches the mark; `closed_pdf` becomes the file names. Returns whether a PDF was saved. */
export async function makeClosedPdf(h: CloseHost): Promise<boolean> {
  const fm = h.frontmatter(), date = closedOn(fm), hash = text(prop(fm, "closed_hash")).trim();
  if (!h.isLabNote || !date || !hash) { h.notice("This note is not closed."); return false; }
  if (!h.canPdf || !h.folders.length) { h.notice(h.canPdf ? MSG.noFolder : "This device cannot make the PDF: do it on a computer."); return false; }
  const bytes = await h.makePdf(closedFooter(date, h.name, hash));
  if (!bytes) { h.notice("This Obsidian cannot make the PDF here."); return false; }
  const name = pdfFileName(h.name, date, n => h.folders.some(f => h.fileExists(f, n)));
  const files: string[] = [];
  for (const folder of h.folders) {
    try { h.saveFile(folder, name, bytes); if (!files.includes(name)) files.push(name); }
    catch (e) { h.logError(e); h.notice(MSG.failed(folder)); }
  }
  if (!files.length) return false;
  await h.editFrontmatter(f => { f.closed_pdf = files; });
  h.notice(MSG.saved(files[0]));
  return true;
}

export async function reopenExperiment(h: CloseHost): Promise<void> {
  if (!h.isLabNote) { h.notice(MSG.notLab); return; }
  const fm = h.frontmatter(), date = closedOn(fm);
  if (!isClosed(fm)) { h.notice("This note is not closed."); return; }
  if (!(await h.confirm("reopen", date, []))) return;
  await h.editFrontmatter(f => {
    delete f.closed_on;
    delete f.closed_hash;
    const pdf = f.closed_pdf;
    delete f.closed_pdf;
    if (pdf !== undefined && pdf !== PENDING) f.closed_pdf_old = pdf;   // the PDFs stay: their names stay in the note
    f.Status = REOPEN_STATUS;
  });
  h.notice(MSG.reopened);
}
