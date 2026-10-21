// The figure of a rig note's text, shared by the Figure… window (figure-ui.ts) and the ```rig block (render.ts). Pure (no Obsidian runtime).
// Plan: docs/plans/rig-block-no-mermaid.md, Phases 2 and 6 (hand layout from the ```rig-layout block).
import { buildFigure } from "./figure";
import { figureSvg, type PartBox } from "./figure-svg";
import { findLayout, readLayout, type Places } from "./layout";
import { controlLabel, readRig } from "./parts";

export interface Made {
  svg: string; width: number; height: number; missing: string[];
  /** What the ```rig-layout block says that could not be used (shown with the rig's problems). */
  problems: string[];
  /** Where every part in the flow is drawn now (what Save layout writes), and the boxes the window drags, both in figure units. */
  places: Places; boxes: PartBox[];
  /** The block's lines as they are in the note (null: no block), and whether Lab Kit may write it (not when it is a newer format). */
  layout: { body: string | null; writable: boolean };
}

/** The figure of a rig note's text, or null when it has no parts to draw. `places` (the Figure… window's) wins over the note's block; an empty map = automatic. */
export function makeFigure(text: string, places?: Places): Made | null {
  const rig = readRig(text);
  if (!rig.parts.length) return null;
  const block = findLayout(text);
  const read = block ? readLayout(block.body, rig.parts.map(p => p.id)) : null;
  const fixed = places ?? read?.fixed ?? new Map();
  const fig = buildFigure(rig.parts, rig.links, { computer: controlLabel(text) || undefined, fixed });
  const problems = [...(read?.problems ?? [])];
  for (const n of fig.nodes) if (n.host && read?.fixed.has(n.id)) problems.push(`${n.id} sits with ${n.host}: its layout line is not used (move ${n.host}).`);
  const { svg, missing, width, height, boxes } = figureSvg(fig);
  const now: Places = new Map(fig.nodes.filter(n => !n.host).map(n => [n.id, { x: n.x, y: n.y }]));
  return { svg, width, height, missing, problems, places: now, boxes, layout: { body: block?.body ?? null, writable: read?.status !== "newer" } };
}
