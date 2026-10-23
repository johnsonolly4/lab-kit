// The Alt+S calculators that are not live blocks, by the key a snippet's `run:` header (or an old stub) names.
// Each asks its questions through ctx.form and returns the text to insert ("" when cancelled or on a Notice).
import { SnippetRun, type SnippetCtx } from "./common";
import { runMethod } from "./methods";
import { raftTable } from "./raft-table";
import { recipe } from "./recipe";
import { results } from "./results";
import { solutionVolume } from "./solution-volume";

/** The keys of this module (the live `solution` and `raft` blocks are built by SnippetTemplates). `solution-volume` and `raft-table` are the old table forms. */
export const SCRIPT_KEYS = ["solution-volume", "recipe", "raft-table", "results", "nmr", "gpc", "dls"];

/** `key` as the stub files wrote it too: `solution` / `raft` mean the old volume and table forms here, `method:<key>` a method by its key. Unknown key: a Notice and "". */
export async function runCalculator(ctx: SnippetCtx, snippet: string): Promise<string> {
  const [key, arg] = String(snippet).split(":");
  const r = new SnippetRun(ctx);
  const method = (k: string | undefined) => k ? r.methods.find(m => m.key === k) : undefined;
  let md: string;
  switch (key) {
    case "solution": case "solution-volume": md = await solutionVolume(r); break;
    case "recipe": md = await recipe(r); break;
    case "raft": case "raft-table": md = await raftTable(r); break;
    case "results": md = await results(r); break;
    case "nmr": case "gpc": case "dls": md = await runMethod(r, method(key)!); break;
    case "method": {
      const m = method(arg);
      if (!m) { r.notice(`Unknown method "${arg ?? ""}"`); return ""; }
      md = await runMethod(r, m);
      break;
    }
    default: r.notice(`Unknown snippet "${key}"`); return "";
  }
  return md ? md + "\n" : "";
}
