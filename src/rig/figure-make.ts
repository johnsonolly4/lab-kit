// The figure of a rig note's text, shared by the Figure… window (figure-ui.ts) and the ```rig block (render.ts). Pure (no Obsidian runtime).
// Plan: docs/plans/rig-block-no-mermaid.md, Phase 2.
import { buildFigure } from "./figure";
import { figureSvg } from "./figure-svg";
import { controlLabel, readRig } from "./parts";

export interface Made { svg: string; width: number; height: number; missing: string[] }

/** The figure of a rig note's text, or null when it has no parts to draw. */
export function makeFigure(text: string): Made | null {
  const rig = readRig(text);
  if (!rig.parts.length) return null;
  const fig = buildFigure(rig.parts, rig.links, { computer: controlLabel(text) || undefined });
  const { svg, missing } = figureSvg(fig);
  return { svg, width: fig.width, height: fig.height, missing };
}
