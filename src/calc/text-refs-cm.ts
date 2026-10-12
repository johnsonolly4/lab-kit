// The CodeMirror side of text-refs.ts: marks the hits in the editor (Live Preview and Source mode).
import { RangeSetBuilder, type Extension } from "@codemirror/state";
import { Decoration, ViewPlugin, type DecorationSet, type EditorView, type ViewUpdate } from "@codemirror/view";
import { textRefHits } from "./text-refs";

const MARKS = {
  ref: Array.from({ length: 6 }, (_, i) => Decoration.mark({ class: `cm-lab-kit-ref-${i}` })),
  cell: Array.from({ length: 6 }, (_, i) => Decoration.mark({ class: `cm-lab-kit-cell-${i}` })),
};

function build(view: EditorView): DecorationSet {
  const b = new RangeSetBuilder<Decoration>();
  const { state } = view, head = state.selection.main.head;
  // Only a table line can hold a formula cell: skip reading the whole note for any other line
  if (!state.doc.lineAt(head).text.trimStart().replace(/^(?:>\s*)+/, "").startsWith("|")) return b.finish();
  for (const h of textRefHits(state.doc.toString(), head)) b.add(h.from, h.to, MARKS[h.kind][h.colour]);
  return b.finish();
}

/** Register with `plugin.registerEditorExtension`. */
export const calcTextRefs = (): Extension => ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  constructor(view: EditorView) { this.decorations = build(view); }
  update(u: ViewUpdate): void { if (u.docChanged || u.selectionSet) this.decorations = build(u.view); }
}, { decorations: v => v.decorations });
