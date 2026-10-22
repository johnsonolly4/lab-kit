// Option (a) (owner, 2026-10-21): the kit's ```refpane``` paper boxes stay empty while the Refpane plugin is not enabled, instead of showing a raw code block.
// A plain post-processor, not a code block processor: Obsidian allows one processor per language and refuses to load the second plugin that registers it,
// so a Lab Kit one would stop Refpane from loading. Once Refpane is enabled this does nothing and Refpane draws the box.
import type { Plugin } from "obsidian";
import { loadedPlugins } from "../kit/obsidian-private";

export const REFPANE_ID = "refpane";

/** Whether Lab Kit should draw the empty box: Refpane is not enabled. */
export const refpaneAbsent = (enabled: ReadonlySet<string>): boolean => !enabled.has(REFPANE_ID);

export function registerRefpaneStub(plugin: Plugin): void {
  plugin.registerMarkdownPostProcessor(el => {
    if (!refpaneAbsent(loadedPlugins(plugin.app))) return;
    for (const code of Array.from(el.querySelectorAll("pre > code.language-refpane"))) code.parentElement?.replaceWith(createDiv({ cls: "block-language-refpane vt-refpane-empty" }));
  });
}
