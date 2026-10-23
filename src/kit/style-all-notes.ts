// "Style all notes" (TC4, owner board 5, 2026-10-20): the planning kit's vault-theme.css styles only kit notes (`cssclasses: vt`) unless
// this body class is present. The plugin adds / removes the class; the snippet does the drawing. Pure apart from the body argument.

/** The body class the kit snippet reads (`.lab-kit-style-all-notes`). */
export const STYLE_ALL_CLASS = "lab-kit-style-all-notes";

/** The Settings row (the wording is new, recorded in BACKLOG "Questions for the owner" for the owner's OK). */
export const STYLE_ALL_NOTES = { name: "Style all notes", desc: "Apply the Lab Kit table, heading and callout styles to every note, not only kit notes." };

/** Add or remove the body class. */
export function applyStyleAllNotes(body: { classList: { toggle(name: string, force?: boolean): boolean } }, on: boolean): void {
  body.classList.toggle(STYLE_ALL_CLASS, on);
}
