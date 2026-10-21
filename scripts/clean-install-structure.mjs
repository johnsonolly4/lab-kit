// Measures what a clean install of Lab Kit makes, in a throwaway Obsidian (scripts/obsidian-check.mjs; never a real vault).
// Re-runnable. Prints one JSON report per scenario to <out>/<scenario>.json and a short summary.
//
//   node scripts/clean-install-structure.mjs [empty|starter|templater|starter-templater|all] [--out DIR] [--no-build]
//
//   empty              an empty vault, Lab Kit only (a store install): Check setup, kit install, planning kit, every Fix
//   templater          the same, with Templater installed first (its own default settings)
//   starter            dist/starter/ (npm run starter) copied into the vault, Lab Kit only (the plugin list is not installed)
//   starter-templater  the starter plus Templater with the starter's data.json
// Per step the report holds the vault tree (files and folders, .obsidian included, no plugin code / backups), Lab Kit's
// and Templater's data.json, and the Check setup rows. Templater is the copy in ../test-vault (plugin files only, no data).
import { execFileSync } from "child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = join(ROOT, "scripts", "obsidian-check.mjs");
const args = process.argv.slice(2);
const opt = (name, d) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : d; };
const scenarios = (args[0] && !args[0].startsWith("--") ? args[0] : "all") === "all" ? ["empty", "templater", "starter", "starter-templater"] : [args[0]];
const out = resolve(opt("--out", join(tmpdir(), "lk-clean-install")));
const work = join(out, "work");
mkdirSync(work, { recursive: true });

const run = (...a) => execFileSync("node", [CHECK, ...a], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: process.env });
const evalJs = (code) => {
  const f = join(work, `e${Math.random().toString(36).slice(2)}.js`);
  writeFileSync(f, code);
  const text = run("eval", "--file", f);
  rmSync(f, { force: true });
  try { return JSON.parse(text); } catch { return text; }
};

const SLEEP = "const sleep = ms => new Promise(r => setTimeout(r, ms));";
const TREE = `
  const walk = async (dir) => { const l = await app.vault.adapter.list(dir); let r = [...l.files]; for (const d of l.folders) { r.push(d + "/"); r = r.concat(await walk(d)); } return r; };
  const tree = (await walk("/")).filter(p => !/^\\.obsidian\\/plugins\\/[^/]+\\/(main\\.js|manifest\\.json|styles\\.css)$/.test(p) && !p.includes("/backups/") && p !== ".obsidian/workspace.json").sort();
  const read = async (p) => (await app.vault.adapter.exists(p)) ? JSON.parse(await app.vault.adapter.read(p)) : null;
  const rows = [...document.querySelectorAll(".lab-kit-win-row")].map(r => ({
    state: r.classList.contains("is-missing") ? "missing" : r.classList.contains("is-todo") ? "todo" : r.classList.contains("is-info") ? "info" : "ok",
    title: r.querySelector(".lab-kit-win-title")?.innerText, detail: r.querySelector(".setting-item-description")?.innerText, button: r.querySelector("button")?.innerText || "" }));
  return { tree, labKit: await read(".obsidian/plugins/lab-kit/data.json"), templater: await read(".obsidian/plugins/templater-obsidian/data.json"),
    app: await read(".obsidian/app.json"), plugins: await read(".obsidian/community-plugins.json"), rows };`;

const snapshot = (label) => {
  run("modals", "--close");
  run("command", "lab-kit:check-setup");
  const s = evalJs(`${SLEEP} await sleep(2000); ${TREE}`);
  return { label, ...s };
};

/** Clicks the row's button (Fix / Open / Find) and, for a Fix, confirms the window it opens; returns the window's text. */
const fixRow = (labels, planning) => evalJs(`${SLEEP}
  const log = [];
  for (const label of ${JSON.stringify(labels)}) {
    const row = [...document.querySelectorAll(".lab-kit-win-row")].find(r => r.querySelector(".lab-kit-win-title")?.innerText.trim() === label);
    const btn = row?.querySelector("button");
    if (!btn || btn.innerText.trim() !== "Fix") { log.push({ label, error: "no Fix button" }); continue; }
    btn.click(); await sleep(1500);
    let ms = [...document.querySelectorAll(".modal")]; let m = ms[ms.length - 1];
    const text = m.innerText.slice(0, 1800);
    const conf = [...m.querySelectorAll("button")].reverse().find(b => /^(Fix|Update|Apply|Make|Create|Set up)/.test(b.innerText.trim()));
    conf?.click(); await sleep(3000);
    // a kit install asks twice: the file list, then the first-install window listing folders and settings
    const second = [];
    for (let k = 0; k < 3; k++) {
      ms = [...document.querySelectorAll(".modal")]; m = ms[ms.length - 1];
      const title = m?.querySelector(".modal-title")?.innerText ?? m?.innerText.split("\\n")[0] ?? "";
      if (!/^(Install the kit\\?|Update these files\\?)/.test(title)) break;
      const c2 = [...m.querySelectorAll("button")].reverse().find(b => /^Update/.test(b.innerText.trim()));
      second.push(m.innerText.slice(0, 1500)); c2?.click(); await sleep(3500);
    }
    log.push({ label, window: text, confirmed: conf?.innerText ?? null, second });
  }
  return log;`);

function installTemplater(vault, data) {
  // the plugin files from test-vault (this checkout, else the main checkout of the repo when this is a worktree), or TEMPLATER_DIR
  const main = resolve(ROOT, execFileSync("git", ["rev-parse", "--git-common-dir"], { cwd: ROOT, encoding: "utf8" }).trim(), "..");
  const src = [process.env.TEMPLATER_DIR, join(ROOT, "test-vault", ".obsidian", "plugins", "templater-obsidian"), join(main, "test-vault", ".obsidian", "plugins", "templater-obsidian")]
    .find((d) => d && existsSync(join(d, "main.js")));
  if (!src) throw new Error("Templater plugin files not found: set TEMPLATER_DIR to a folder holding its main.js, manifest.json, styles.css");
  const dest = join(vault, ".obsidian", "plugins", "templater-obsidian");
  mkdirSync(dest, { recursive: true });
  for (const f of ["main.js", "manifest.json", "styles.css"]) cpSync(join(src, f), join(dest, f));
  if (data) writeFileSync(join(dest, "data.json"), data);
  evalJs(`${SLEEP} await app.plugins.loadManifests(); await app.plugins.enablePluginAndSave("templater-obsidian"); await sleep(2500); return !!app.plugins.plugins["templater-obsidian"];`);
}

function scenario(name, build) {
  const dir = join(work, name), vault = join(dir, "vault");
  const withTemplater = name.endsWith("templater");
  const starter = name.startsWith("starter");
  const report = { scenario: name, steps: [], fixes: [] };
  const startArgs = ["start", "--dir", dir, "--no-build"];
  if (starter) startArgs.push("--notes", join(ROOT, "dist", "starter"));
  run(...startArgs);
  try {
    // clean Lab Kit data: the check script seeds a data.json that a new user does not have
    evalJs(`${SLEEP} await app.plugins.disablePluginAndSave("lab-kit"); await app.vault.adapter.remove(".obsidian/plugins/lab-kit/data.json"); await app.plugins.enablePluginAndSave("lab-kit"); await sleep(2000); return true;`);
    if (withTemplater) installTemplater(vault, starter ? readFileSync(join(ROOT, "dist", "starter", ".obsidian", "plugins", "templater-obsidian", "data.json"), "utf8") : null);
    report.steps.push(snapshot("1 plugin on, nothing run yet"));
    // the first install of the lab kit, as Check setup's Fix does it
    report.fixes.push(...fixRow(["Lab kit installed"]));
    report.steps.push(snapshot("2 lab kit installed"));
    // switch the planning kit on, install it
    evalJs(`const p = app.plugins.plugins["lab-kit"]; p.kit.planning.slot.enabled = true; await p.kit.save(); return true;`);
    run("modals", "--close"); run("command", "lab-kit:check-setup");
    report.fixes.push(...fixRow(["Planning kit installed"]));
    report.steps.push(snapshot("3 planning kit installed"));
    // every remaining Fix in Check setup, one at a time (up to 40 rounds)
    const done = new Set(["Lab kit installed", "Planning kit installed"]);
    for (let i = 0; i < 40; i++) {
      const next = report.steps[report.steps.length - 1].rows.find((r) => r.button === "Fix" && !done.has(r.title));
      if (!next) break;
      done.add(next.title);
      report.fixes.push(...fixRow([next.title]));
      report.steps.push(snapshot(`4.${i + 1} Fix: ${next.title}`));
    }
  } finally {
    run("modals", "--close");
    run("stop", "--dir", dir);
  }
  writeFileSync(join(out, `${name}.json`), JSON.stringify(report, null, 1));
  const last = report.steps[report.steps.length - 1];
  console.log(`${name}: ${report.steps.length} steps, ${last.tree.filter((p) => !p.startsWith(".obsidian")).length} paths in the vault at the end, rows left not ok: ${last.rows.filter((r) => r.state !== "ok").length} -> ${join(out, name + ".json")}`);
}

if (!args.includes("--no-build")) { execFileSync("npm", ["run", "build"], { cwd: ROOT, stdio: "ignore" }); execFileSync("npm", ["run", "starter"], { cwd: ROOT, stdio: "ignore" }); }
for (const s of scenarios) scenario(s);
