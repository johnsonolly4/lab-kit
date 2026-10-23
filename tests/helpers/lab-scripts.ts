// Test helper: the kit's snippet code as the tests call it, in the shape of the old Templater scripts:
// `labSnippets(tp, key)` (reads the saved settings and the form from `tp`, the vault from the global `app`) and `labMethods()`.
import type { TFile } from "obsidian";
import { runCalculator } from "../../src/snippets/run";
import { builtins, buildRows, columnDefault, loadMethods, menuEntries, norm, parseMethod, planColumns } from "../../src/snippets/methods";
import { letter } from "../../src/snippets/util";

interface Tp {
  config: { target_file: { basename?: string; path?: string } | null };
  date: { now: (format?: string) => string };
  user: { labForm: (tp: unknown, title: string, fields: never[], opts?: never) => Promise<Record<string, unknown> | null> };
}

const appGlobal = (): never => (globalThis as unknown as { app: never }).app;

async function savedKit(): Promise<Record<string, unknown>> {
  const app = appGlobal() as { vault: { configDir?: string; adapter: { read: (p: string) => Promise<string> } } };
  try { return JSON.parse(await app.vault.adapter.read(`${app.vault.configDir ?? ".obsidian"}/plugins/lab-kit/data.json`))?.kit ?? {}; } catch { return {}; }
}

export async function labSnippets(tp: Tp, key: string): Promise<string> {
  const kit = await savedKit();
  return runCalculator({
    app: appGlobal(),
    kit: { chemicalFolder: "", chemClassOnly: false, methodsFolder: "", ...kit },
    form: (title, fields, opts) => tp.user.labForm(tp, title, fields as never[], opts as never),
    file: tp.config.target_file as TFile | null,
    today: () => tp.date.now("YYYY-MM-DD"),
  }, key);
}

/** The methods module with the old `menuEntries(app, opts)` shape (the methods folder is read from the saved settings). */
export const labMethods = Object.assign(() => ({}), {
  loadMethods, parseMethod, planColumns, buildRows, columnDefault, builtins, letter, norm,
  menuEntries: async (app: never, opts: { builtins?: boolean } = {}) => {
    const kit = await savedKit();
    return menuEntries(app, String(kit.methodsFolder ?? ""), opts);
  },
});
