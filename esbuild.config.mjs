// Based on obsidianmd/obsidian-sample-plugin.
// `npm run dev`   → watch, writes straight into test-vault/.obsidian/plugins/lab-kit/
// `npm run build` → production main.js in the repo root (for releases)
import esbuild from "esbuild";
import process from "process";
import { builtinModules } from "node:module";
import { copyFileSync, mkdirSync, watchFile } from "fs";
import { resolve } from "path";
import { embeddedKit } from "./scripts/embed-kit.mjs";

const prod = process.argv[2] === "production";
const devDir = "test-vault/.obsidian/plugins/lab-kit";
if (!prod) {
  mkdirSync(devDir, { recursive: true });
  // Copy now and again whenever the file changes (reload the plugin in Obsidian to pick up new CSS)
  for (const f of ["manifest.json", "styles.css"]) {
    copyFileSync(f, `${devDir}/${f}`);
    watchFile(f, { interval: 300 }, () => copyFileSync(f, `${devDir}/${f}`));
  }
}

// "lab-kit-embedded": every kit file (see kit/kit-manifest.json) inlined into main.js, so the plugin carries the kit
const embedKit = {
  name: "embed-kit",
  setup(build) {
    build.onResolve({ filter: /^lab-kit-embedded$/ }, (a) => ({ path: a.path, namespace: "embed-kit" }));
    build.onLoad({ filter: /.*/, namespace: "embed-kit" }, () => {
      const { paths, ...kit } = embeddedKit();
      return { contents: `export default ${JSON.stringify(kit)};`, loader: "js", watchFiles: paths.map((p) => resolve(p)) };
    });
  },
};

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/autocomplete", "@codemirror/collab", "@codemirror/commands",
    "@codemirror/language", "@codemirror/lint", "@codemirror/search", "@codemirror/state", "@codemirror/view",
    "@lezer/common", "@lezer/highlight", "@lezer/lr", ...builtinModules],
  loader: { ".md": "text" },
  plugins: [embedKit],
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
