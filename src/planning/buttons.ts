// Meta Bind button templates the planning notes use (Check setup adds the missing ones to Meta Bind's settings).
import file from "../../docs/plans/kit-files/planning/settings/meta-bind-buttons.json";

/** True when an installed button's actions do something else than the kit's. Only what the kit's actions set is compared, so a field Meta Bind adds on its own is not a difference. */
export function actionsDiffer(kit: unknown, have: unknown): boolean {
  if (!Array.isArray(kit) || !Array.isArray(have)) return JSON.stringify(kit) !== JSON.stringify(have);
  if (kit.length !== have.length) return true;
  return kit.some((k: Record<string, unknown>, i) => Object.entries(k).some(([key, v]) => JSON.stringify((have[i] as Record<string, unknown> | null)?.[key]) !== JSON.stringify(v)));
}

export const PLANNING_BUTTONS: { id: string; actions?: unknown }[] = (file as { buttonTemplates: { id: string; actions?: unknown }[] }).buttonTemplates;
