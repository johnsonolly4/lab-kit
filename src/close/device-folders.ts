// Close experiment: PDF folders are per device (a Windows path is no use on a Mac), so they live in Obsidian's local storage, not in the synced data.json.
// The existing convention for per-device state is `app.loadLocalStorage` / `saveLocalStorage` (the board's tray fold, `board-view.ts`); Obsidian keys it by vault on this device.
// The first time this device runs, the list in data.json is copied here once. data.json keeps its value (never deleted), so a second device starts from the same list.

export const PDF_FOLDERS_KEY = "lab-kit-close-pdf-folders";

/** The slice of `App` this uses. */
export interface LocalStore { loadLocalStorage(key: string): unknown; saveLocalStorage(key: string, data: unknown): void }

const clean = (v: unknown): string[] | null => Array.isArray(v) ? v.filter((f): f is string => typeof f === "string" && !!f.trim()).map(f => f.trim()) : null;

/** This device's folders. Nothing stored here yet: copy `synced` (data.json's list) into this device once and use it. Local storage unavailable: use `synced`. */
export function loadDeviceFolders(store: LocalStore, synced: string[]): string[] {
  try {
    const own = clean(store.loadLocalStorage(PDF_FOLDERS_KEY));
    if (own) return own;
    store.saveLocalStorage(PDF_FOLDERS_KEY, synced);
  } catch { /* no local storage: the synced list is used and not kept per device */ }
  return [...synced];
}

/** Keeps this device's folders (empty entries too, so a half-typed row survives a redraw). */
export function saveDeviceFolders(store: LocalStore, folders: string[]): void {
  try { store.saveLocalStorage(PDF_FOLDERS_KEY, folders); } catch { /* no local storage: the list is only kept until Obsidian closes */ }
}
