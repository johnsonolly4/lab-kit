// Placeholder. First task in Claude Code: port legacy/main.js into src/ (see STATUS.md).
// Suggested split:
//   src/main.ts            plugin class, onload: registers calc, header, kit
//   src/calc/engine.ts     parseBlock, tokenize, parseFormula, Workbook, FUNCS, formatValue
//   src/calc/rewrite.ts    rewriteRefs, shiftForInsert/Delete, shiftRelative, editRows
//   src/calc/render.ts     code-block processor, toolbar, click-to-edit, row menu
//   src/kit/updater.ts     kitScan/Plan/Apply, KitUpdateModal, KitSettingTab (desktop only)
import { Plugin } from "obsidian";

export default class LabKitPlugin extends Plugin {
  async onload() {}
}
