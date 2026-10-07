// Meta Bind button templates the planning notes use (Check setup adds the missing ones to Meta Bind's settings).
import file from "../../docs/plans/kit-files/planning/settings/meta-bind-buttons.json";

export const PLANNING_BUTTONS: { id: string }[] = (file as { buttonTemplates: { id: string }[] }).buttonTemplates;
