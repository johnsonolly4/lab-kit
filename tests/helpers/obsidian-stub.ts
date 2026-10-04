// Runtime stand-in for the "obsidian" package (which ships types only). vitest aliases "obsidian" to this file.
// Tests reach into these exports to set up the situation they need (e.g. Platform.isDesktopApp).
// Popout-window code calls window.setTimeout; under node the global object stands in for the window.
(globalThis as any).window ??= globalThis;
(globalThis as any).requestAnimationFrame ??= (f: () => void) => setTimeout(f, 0);
export class Component { load(): void { /* nothing */ } unload(): void { /* nothing */ } }
export class MarkdownRenderChild extends Component { constructor(public containerEl: unknown) { super(); } }
export class Plugin extends Component {
  app: any;
  manifest: any = { id: "lab-kit" };
  registerEvent(_e: unknown): void { /* nothing to clean up in tests */ }
  registerMarkdownCodeBlockProcessor(): void { /* tests call the renderer directly */ }
  addCommand(): void { /* ignored */ }
  addSettingTab(): void { /* ignored */ }
  async loadData(): Promise<any> { return null; }
  async saveData(_d: unknown): Promise<void> { /* ignored */ }
}
export class Notice {
  static messages: string[] = [];
  constructor(m: unknown) { Notice.messages.push(String(m)); }
  hide(): void { /* ignored */ }
}
export class Menu { addItem(): this { return this; } showAtMouseEvent(): void { /* ignored */ } }
export class Modal { constructor(public app: any) {} open(): void { /* ignored */ } close(): void { /* ignored */ } }
export class Setting { constructor(_el: unknown) {} }
export class PluginSettingTab { constructor(public app: any, public plugin: any) {} }
export class TFile {
  path = ""; basename = ""; extension = "md";
  constructor(init?: { path?: string; basename?: string; extension?: string }) { Object.assign(this, init); }
}
export class TFolder {
  path = ""; children: unknown[] = [];
  constructor(init?: { path?: string; children?: unknown[] }) { Object.assign(this, init); }
}
export const normalizePath = (p: string): string => p.replace(/[\/]+/g, "/").replace(/^\/|\/$/g, "");
/** Records every popup made, so tests can drive getSuggestions / selectSuggestion directly. */
export class AbstractInputSuggest {
  static instances: any[] = [];
  constructor(public app: any, public inputEl: any) { AbstractInputSuggest.instances.push(this); }
  open(): void { /* ignored */ }
  close(): void { /* ignored */ }
}
export const Platform = { isDesktop: true, isDesktopApp: true, isMobile: false, isWin: false };
export const getIcon = (_name: string): SVGElement | null => null;
export const MarkdownRenderer = {
  render: async (_app: unknown, md: string, el: any): Promise<void> => { el.innerHTML = "<p>" + md + "</p>"; },
};
