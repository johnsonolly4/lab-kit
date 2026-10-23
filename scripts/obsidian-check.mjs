// Drive a throwaway Obsidian with the built plugin, from the shell (Chrome DevTools Protocol). Never the user's vault.
// A separate Obsidian instance (own settings folder, own debugging port) opens a scratch vault; the user's running
// Obsidian and its vaults are not touched. Desktop only (macOS, Windows, Linux).
//
//   node scripts/obsidian-check.mjs start [--dir D] [--notes FOLDER] [--no-build] [--show] [--mobile]
//                                       build, make the vault, open Obsidian hidden, without taking focus (--show: on screen)
//                                       --mobile: phone emulation (app.emulateMobile(true), window 390 x 844), before the plugin loads
//   node scripts/obsidian-check.mjs eval "<js>" | --file F.js                          run JS in the window, print the result
//   node scripts/obsidian-check.mjs open "Note.md" [--read]                            open a note (path in the vault), --read = reading view
//   node scripts/obsidian-check.mjs modals [--close]                                   titles of open windows; --close presses Escape
//   node scripts/obsidian-check.mjs command "lab-kit:some-id"                          run a command by id
//   node scripts/obsidian-check.mjs type "text"                                        type into the focused field (real input events; Input.insertText)
//   node scripts/obsidian-check.mjs text [css selector]                                visible text of the note (or selector)
//   node scripts/obsidian-check.mjs shot out.png [css selector] [--scale 0.5]          screenshot, cropped to the selector
//   node scripts/obsidian-check.mjs errors                                             console errors since start
//   node scripts/obsidian-check.mjs smoke [--no-mobile] [--no-build]                  the smoke run (scripts/smoke.mjs): seeded vault, both kits, key surfaces, PASS / FAIL per step
//   node scripts/obsidian-check.mjs stop                                               quit this Obsidian (only the one started here)
// Every command prints JSON or plain text and exits 0 on success, 1 on failure (a thrown error is printed).
import { spawn, execFileSync } from "child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir, platform } from "os";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.OBSIDIAN_CHECK_PORT || 9333); // another check already on 9333? set OBSIDIAN_CHECK_PORT=9334 (with its own --dir)
const PLUGIN = "lab-kit";

function args() {
  const a = process.argv.slice(2);
  const opt = (name, dflt) => { const i = a.indexOf(name); if (i < 0) return dflt; const v = a[i + 1]; a.splice(i, 2); return v; };
  const flag = (name) => { const i = a.indexOf(name); if (i < 0) return false; a.splice(i, 1); return true; };
  const dir = resolve(opt("--dir", join(tmpdir(), "lab-kit-obsidian-check")));
  return { a, opt, flag, dir };
}

function obsidianBinary() {
  if (platform() === "darwin") return "/Applications/Obsidian.app/Contents/MacOS/Obsidian";
  if (platform() === "win32") return join(process.env.LOCALAPPDATA || "", "Programs", "Obsidian", "Obsidian.exe");
  return "obsidian";
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function pageTarget(tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const page = list.find((t) => t.type === "page" && t.url.startsWith("app://obsidian.md"));
      if (page) return page;
    } catch { /* not up yet */ }
    await wait(500);
  }
  throw new Error(`No Obsidian window on port ${PORT}. Run: node scripts/obsidian-check.mjs start`);
}

/** One CDP session: send(method, params) → result; collects console errors and exceptions while open. */
async function connect() {
  const ws = new WebSocket((await pageTarget()).webSocketDebuggerUrl);
  await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = () => bad(new Error("WebSocket failed")); });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.bad(new Error(m.error.message)) : p.ok(m.result); }
  };
  const send = (method, params = {}) => new Promise((ok, bad) => { const i = ++id; pending.set(i, { ok, bad }); ws.send(JSON.stringify({ id: i, method, params })); });
  return { send, close: () => ws.close() };
}

async function evaluate(expression) {
  const s = await connect();
  try {
    const r = await s.send("Runtime.evaluate", { expression: `(async () => { ${expression} })()`, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  } finally { s.close(); }
}

// Console errors are caught by a hook installed at start, so any later command can read them.
const ERROR_HOOK = `
  if (!window.__ocheckErrors) {
    window.__ocheckErrors = [];
    const push = (kind, x) => window.__ocheckErrors.push(kind + ": " + (x?.stack || x?.message || String(x)).slice(0, 600));
    const orig = console.error.bind(console);
    console.error = (...xs) => { push("console.error", xs.map(String).join(" ")); orig(...xs); };
    window.addEventListener("error", (e) => push("error", e.error || e.message));
    window.addEventListener("unhandledrejection", (e) => push("unhandledrejection", e.reason));
  }`;

// Phone emulation. emulateMobile is an Obsidian internal (the dev-console switch), so it lives only here, never in src/.
// It reloads the window, so it runs before the plugin is enabled; the window is resized through @electron/remote
// (a CDP device-metrics override would end with the CDP session).
async function emulatePhone() {
  await evaluate(`for (let i = 0; i < 60 && !(window.app && app.workspace?.layoutReady); i++) await new Promise(r => setTimeout(r, 250));
    try { const w = require("@electron/remote").getCurrentWindow(); w.setMinimumSize(1, 1); w.setContentSize(390, 844); } catch {}
    setTimeout(() => app.emulateMobile(true), 50);`);
  await wait(3000); // the window reloads
  await pageTarget(60);
}

async function start({ a, flag, opt, dir }) {
  const notes = opt("--notes", "");
  const show = flag("--show");
  const mobile = flag("--mobile");
  if (!flag("--no-build")) execFileSync(platform() === "win32" ? "npm.cmd" : "npm", ["run", "build"], { cwd: ROOT, stdio: "ignore" });
  for (const f of ["main.js", "manifest.json", "styles.css"]) if (!existsSync(join(ROOT, f))) throw new Error(`${f} missing: run npm run build`);
  try { await fetch(`http://127.0.0.1:${PORT}/json`); throw new Error(`Port ${PORT} is in use: run stop first`); } catch (e) { if (String(e.message).startsWith("Port")) throw e; }
  const vault = join(dir, "vault"), user = join(dir, "userdata"), plug = join(vault, ".obsidian", "plugins", PLUGIN);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(plug, { recursive: true }); mkdirSync(user, { recursive: true });
  for (const f of ["main.js", "manifest.json", "styles.css"]) cpSync(join(ROOT, f), join(plug, f));
  if (notes) cpSync(resolve(notes), vault, { recursive: true, filter: (src) => !src.includes(`${join(".obsidian", "plugins")}`) && !src.endsWith("data.json") });
  writeFileSync(join(vault, ".obsidian", "community-plugins.json"), JSON.stringify([PLUGIN]));
  // no "What's new" window: mark the newest changelog heading as seen (src/whatsnew.ts sectionHeading; labFolder is
  // given because kitLoad treats saved data without it as an old vault and leaves the folder empty)
  const heading = (readFileSync(join(ROOT, "docs", "changelog.md"), "utf8").split(/\r?\n/).find((l) => l.startsWith("## ")) || "").replace(/^## /, "").trim();
  if (!existsSync(join(plug, "data.json"))) writeFileSync(join(plug, "data.json"), JSON.stringify({ kit: { seenChangelog: heading, labFolder: "03 Lab Book/Notes" } }));
  writeFileSync(join(user, "obsidian.json"), JSON.stringify({ vaults: { ocheck0000000000: { path: vault, ts: Date.now(), open: true } } }));
  const flags = [`--user-data-dir=${user}`, `--remote-debugging-port=${PORT}`,
    // keep drawing while the window is hidden or behind others (the reading view draws lazily and would stay empty)
    "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--disable-background-timer-throttling"];
  let pid;
  if (platform() === "darwin") {
    // open -g: do not take focus; -j: start hidden; -n: a new instance next to the user's Obsidian
    execFileSync("open", ["-g", "-j", "-n", "-a", "Obsidian", "--args", ...flags]);
    for (let i = 0; i < 40 && !pid; i++) {
      try { pid = Number(execFileSync("pgrep", ["-f", `MacOS/Obsidian --user-data-dir=${user}`], { encoding: "utf8" }).split("\n")[0]); } catch { await wait(250); }
    }
    if (!pid) throw new Error("Obsidian did not start");
  } else {
    const child = spawn(obsidianBinary(), flags, { detached: true, stdio: "ignore" });
    child.unref();
    pid = child.pid;
  }
  writeFileSync(join(dir, "pid"), String(pid));
  await pageTarget(60);
  if (!show) await hideWindow();
  if (mobile) await emulatePhone();
  // wait for the workspace, then turn community plugins on (restricted mode off) and enable ours
  const state = await evaluate(`
    for (let i = 0; i < 60 && !(window.app && app.workspace?.layoutReady); i++) await new Promise(r => setTimeout(r, 250));
    ${ERROR_HOOK}
    if (!app.plugins.isEnabled()) await app.plugins.setEnable(true);
    if (!app.plugins.enabledPlugins.has("${PLUGIN}")) await app.plugins.enablePluginAndSave("${PLUGIN}");
    await new Promise(r => setTimeout(r, 1000));
    const p = app.plugins.plugins["${PLUGIN}"];
    const phone = ${mobile} ? { isMobile: app.isMobile, bodyClasses: ["emulate-mobile", "is-phone", "is-mobile"].filter(c => document.body.classList.contains(c)), window: [innerWidth, innerHeight] } : {};
    return { vault: app.vault.getName(), plugin: !!p, version: p?.manifest.version, ...phone, errors: window.__ocheckErrors };`);
  // the trust prompt and What's new open late; close them so they do not cover notes and screenshots
  await wait(2500);
  const { closed = [] } = await modals(true);
  console.log(JSON.stringify({ dir, pid, ...state, closedWindows: closed }, null, 1));
  if (!state.plugin) process.exit(1);
}

async function shot(scale, out, selector) {
  const s = await connect();
  try {
    let clip;
    if (selector) {
      const r = await s.send("Runtime.evaluate", { returnByValue: true, expression:
        `(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; })()` });
      if (!r.result.value) throw new Error(`No element for selector ${selector}`);
      clip = { ...r.result.value, scale };
    } else if (scale !== 1) {
      const r = await s.send("Runtime.evaluate", { returnByValue: true, expression: "({ x: 0, y: 0, width: innerWidth, height: innerHeight })" });
      clip = { ...r.result.value, scale };
    }
    const { data } = await s.send("Page.captureScreenshot", { format: "png", ...(clip ? { clip } : {}) });
    writeFileSync(out, Buffer.from(data, "base64"));
    console.log(resolve(out));
    const { open } = await modals(false);
    if (open.length && !selector?.includes("modal")) console.log(`note: a window is open and may cover the shot: ${open.join(", ")}`);
  } finally { s.close(); }
}

/** Hides this Obsidian (as Cmd+H does), so it gives focus back and stays off the user's screen. */
async function hideWindow() {
  // Electron has no window calls over CDP; Obsidian's renderer reaches its own app through @electron/remote
  for (let i = 0; i < 20; i++) {
    try { await evaluate(`require("@electron/remote").app.hide();`); return; } catch { await wait(250); }
  }
}

/** Titles of the open windows (modals); with close, press Escape until none is left (at most 5 times). */
async function modals(close) {
  const titles = () => evaluate(`return [...document.querySelectorAll(".modal-container")].map(m => m.querySelector(".modal-title")?.innerText || "(no title)");`);
  const open = await titles();
  if (!close || !open.length) return { open };
  const s = await connect();
  try {
    for (let i = 0; i < 5; i++) {
      for (const type of ["keyDown", "keyUp"]) await s.send("Input.dispatchKeyEvent", { type, key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
      await wait(300);
      if (!(await titles()).length) break;
    }
  } finally { s.close(); }
  return { closed: open, left: await titles() };
}

async function stop({ dir }) {
  const pidFile = join(dir, "pid");
  if (!existsSync(pidFile)) { console.log("nothing started here"); return; }
  const pid = Number(readFileSync(pidFile, "utf8"));
  rmSync(pidFile);
  try { process.kill(pid); } catch { console.log(`${pid} was not running`); return; }
  // wait until it has quit and freed the debugging port, so a start right after works
  for (let i = 0; i < 40; i++) {
    let alive = true;
    try { process.kill(pid, 0); } catch { alive = false; }
    let port = true;
    try { await fetch(`http://127.0.0.1:${PORT}/json`); } catch { port = false; }
    if (!alive && !port) { console.log(`stopped ${pid}`); return; }
    await wait(250);
  }
  throw new Error(`${pid} did not quit within 10 s`);
}

async function main() {
  const o = args();
  const scale = Number(o.opt("--scale", "1")), read = o.flag("--read"), close = o.flag("--close"), file = o.opt("--file", "");
  const [cmd, x, y] = o.a;
  const print = (v) => console.log(typeof v === "string" ? v : JSON.stringify(v, null, 1));
  switch (cmd) {
    case "smoke": { const r = spawn(process.execPath, [join(ROOT, "scripts", "smoke.mjs"), ...process.argv.slice(3)], { stdio: "inherit" }); return new Promise(() => r.on("exit", (code) => process.exit(code ?? 1))); }
    case "start": return start(o);
    case "stop": return stop(o);
    case "eval": {
      return print(await evaluate(file ? readFileSync(file, "utf8") : x));
    }
    case "open": {
      const mode = read ? "preview" : "source";
      return print(await evaluate(`
      const f = app.vault.getAbstractFileByPath(${JSON.stringify(x)}); if (!f) throw new Error("no such note: " + ${JSON.stringify(x)});
      const leaf = app.workspace.getLeaf(false);
      await leaf.openFile(f, { state: { mode: "${mode}" } }); await new Promise(r => setTimeout(r, 800));
      return "opened " + f.path + " (" + leaf.view.getMode?.() + ")";`));
    }
    case "modals": return print(await modals(close));
    case "command": return print(await evaluate(`
      if (!app.commands.commands[${JSON.stringify(x)}]) return { ran: false, matching: Object.keys(app.commands.commands).filter(k => k.startsWith("${PLUGIN}:")) };
      const ran = app.commands.executeCommandById(${JSON.stringify(x)}); await new Promise(r => setTimeout(r, 800)); return { ran };`));
    // blocks draw in steps after a note opens: read until two reads 400 ms apart agree (at most 4 s)
    case "text": return print(await evaluate(`
      const read = () => { ${x
        ? `const e = document.querySelector(${JSON.stringify(x)}); return e ? e.innerText : "(no element for ${x.replace(/[`$\\"]/g, "")})";`
        : `const v = app.workspace.getMostRecentLeaf()?.view; if (!v) return "(no open note)";
           return (v.getMode?.() === "preview" ? v.previewMode.containerEl : v.contentEl).innerText;`} };
      let last = read();
      for (let i = 0; i < 10; i++) { await new Promise(r => setTimeout(r, 400)); const now = read(); if (now === last) break; last = now; }
      return last;`));
    case "type": {
      const s = await connect();
      try { await s.send("Input.insertText", { text: x }); } finally { s.close(); }
      return print(await evaluate(`await new Promise(r => setTimeout(r, 400)); const a = document.activeElement; return { typedInto: a ? a.tagName + (a.className ? "." + String(a.className).split(" ")[0] : "") : null, value: a?.value ?? a?.innerText?.slice(0, 80) };`));
    }
    case "shot": return shot(scale, x || "obsidian.png", y);
    case "errors": return print(await evaluate("return window.__ocheckErrors || ['(error hook not installed: start was not run)'];"));
    default: console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//")).join("\n"));
  }
}

if (typeof WebSocket === "undefined") {
  // Node 20 has WebSocket behind a flag; re-run with it
  const r = spawn(process.execPath, ["--experimental-websocket", "--no-warnings", ...process.argv.slice(1)], { stdio: "inherit" });
  r.on("exit", (code) => process.exit(code ?? 1));
} else {
  main().catch((e) => { console.error(String(e?.stack || e)); process.exit(1); });
}
