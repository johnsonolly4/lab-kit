// Rig figure Phase 4: the numbers and names behind the figure window (pixel size, cap, file names). Pure (no Obsidian runtime).
// Plan: docs/plans/rig-figure.md, Phase 4 result (the cap was measured in desktop Obsidian).

/** The most a PNG is allowed: pixels a side and in all. Desktop Obsidian made 268 million pixels and failed at 328 million (Phase 4 result); the cap sits well under that and still holds A0 at 300 dpi (139.5 million). */
export const PNG_MAX_SIDE = 16000;
export const PNG_MAX_PIXELS = 150_000_000;
const MM_PER_INCH = 25.4;

export interface PngSize {
  /** The size the PNG is made at (the asked size, lowered to the cap when needed; same shape). */
  width: number; height: number;
  /** The size asked for: the width in mm and the dpi. */
  asked: { width: number; height: number };
  /** True when the asked size was above the cap. */
  capped: boolean;
}

/** The pixel size of a figure printed `widthMm` wide at `dpi`, with the figure's own shape. null when a number is not positive. */
export function pngSize(o: { widthMm: number; dpi: number; figWidth: number; figHeight: number }): PngSize | null {
  const { widthMm, dpi, figWidth, figHeight } = o;
  if (![widthMm, dpi, figWidth, figHeight].every(n => Number.isFinite(n) && n > 0)) return null;
  const w = Math.round(widthMm / MM_PER_INCH * dpi), h = Math.round(w * figHeight / figWidth);
  if (w < 1 || h < 1) return null;
  const scale = Math.min(1, PNG_MAX_SIDE / Math.max(w, h), Math.sqrt(PNG_MAX_PIXELS / (w * h)));
  if (scale >= 1) return { width: w, height: h, asked: { width: w, height: h }, capped: false };
  let width = Math.max(1, Math.round(w * scale)), height = Math.max(1, Math.round(h * scale));
  while (width * height > PNG_MAX_PIXELS || Math.max(width, height) > PNG_MAX_SIDE) { if (width >= height) width--; else height--; }   // rounding must never go over the cap
  return { width, height, asked: { width: w, height: h }, capped: true };
}

/** The height in mm of a figure `widthMm` wide. */
export const heightMm = (widthMm: number, figWidth: number, figHeight: number): number => widthMm * figHeight / figWidth;

const px = (n: number): string => n.toLocaleString("en-US");

/** The line under the size boxes: what the PNG will be, and when it is lowered, why. */
export function sizeLine(s: PngSize | null): string {
  if (!s) return "Enter a width in mm and a dpi above zero.";
  if (!s.capped) return `${px(s.width)} × ${px(s.height)} px`;
  return `${px(s.asked.width)} × ${px(s.asked.height)} px is more than this window makes (${px(PNG_MAX_SIDE)} px a side, ${px(PNG_MAX_PIXELS / 1e6)} million pixels): the PNG will be ${px(s.width)} × ${px(s.height)} px. The SVG has no size limit.`;
}

/** The notice after a PNG is saved: the size it really is, and when it is below what was asked. */
export function savedNote(name: string, got: { width: number; height: number }, asked: { width: number; height: number }): string {
  const base = `Saved ${name}: ${px(got.width)} × ${px(got.height)} px.`;
  return got.width === asked.width && got.height === asked.height ? base : `${base} ${px(asked.width)} × ${px(asked.height)} px was asked: that is more than this window makes, so it is smaller.`;
}

/** A file name for a figure: "<note> figure.svg", then "<note> figure 2.svg", "… 3" while the name is taken. */
export function figureFileName(note: string, ext: "svg" | "png", taken: (name: string) => boolean): string {
  const base = `${note} figure`;
  let name = `${base}.${ext}`;
  for (let n = 2; taken(name); n++) name = `${base} ${n}.${ext}`;
  return name;
}
