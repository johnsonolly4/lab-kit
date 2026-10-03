// Based on obsidianmd/obsidian-sample-plugin.
// `npm run dev`   → watch, writes straight into test-vault/.obsidian/plugins/lab-kit/
// `npm run build` → production main.js in the repo root (for releases)
import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import { copyFileSync, mkdirSync } from "fs";

const prod = process.argv[2] === "production";
const devDir = "test-vault/.obsidian/plugins/lab-kit";
if (!prod) {
  mkdirSync(devDir, { recursive: true });
  for (const f of ["manifest.json", "styles.css"]) copyFileSync(f, `${devDir}/${f}`);
}

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/autocomplete", "@codemirror/collab", "@codemirror/commands",
    "@codemirror/language", "@codemirror/lint", "@codemirror/search", "@codemirror/state", "@codemirror/view",
    "@lezer/common", "@lezer/highlight", "@lezer/lr", ...builtins],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: prod ? "main.js" : `${devDir}/main.js`,
  minify: prod,
});

if (prod) { await context.rebuild(); process.exit(0); }
else { await context.watch(); }
