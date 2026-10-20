// S1 of docs/plans/obsidian-update-robustness.md: the smoke run. Opens a small seeded synthetic vault in a throwaway Obsidian
// (scripts/obsidian-check.mjs: separate hidden instance, never the owner's vault), installs both kits through the plugin, and
// prints PASS / FAIL (or NOTE) per surface plus the console errors. Run it on each public Obsidian release and before each Lab Kit release.
//
//   node scripts/smoke.mjs [--no-mobile] [--no-build] [--dir D]     run (desktop, then phone emulation); exit 1 on any FAIL
//   node scripts/smoke.mjs --seed DIR                               only write the seeded vault to DIR (no Obsidian)
//   (also: node scripts/obsidian-check.mjs smoke ...)
// Synthetic data only: every name below is made up. Asks nothing, writes only under --dir (default: the temp folder).
import { execFileSync } from "child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = join(ROOT, "scripts", "obsidian-check.mjs");

// ---------------------------------------------------------------- the seeded vault (pure, unit-tested)

const COLUMN_CALC = "```calc\nname: column\n| State | Weight(g) |\n|---|---|\n| Empty no plugs |  |\n| Empty with plugs | 111.076 |\n| Packed | 111.967 |\n| Mass of beads | =b4-b3 |\n| Packed and full | 114.576 |\n| Mass DCM | =b6-b4 |\n| Volume DCM | =b7/1.325 |\n| Reactor volume | =b8-0.21 |\n```";   // known answer 0011: 1.7591 mL

/** Files of the seed vault as { path: text }. Deterministic. The kits bring Home, the bases and the templates themselves. */
export function seedFiles(rigText) {
  const f = {};
  const statuses = ["Planned", "Started", "Processing results", "Closed"]   // the Lab book board's columns;
  for (let i = 1; i <= 8; i++) {
    const id = String(i + 8).padStart(4, "0");   // 0009 .. 0016, so 0011 is among them
    f[`03 Lab Book/Notes/${id} Smoke experiment.md`] = `---
Type: Experiment
Status: ${statuses[i % 4]}
Exp. Class: ${i % 2 ? "Flow RAFT" : "Batch RAFT"}
Plan date: 2026-01-${String(i + 10)}
Exp. Start: 2026-01-${String(i + 10)}
Exp. End: 2026-01-${String(i + 11)}
Chemicals:
  - "[[Smoke chemical 000${(i % 4) + 1}]]"
CoSHH: C-${i}
RA: RA-${i}
Objective: Synthetic smoke experiment ${id}
Outcome:
project: "[[Smoke project A]]"
cssclasses:
  - vt
---

\`\`\`lab-header
\`\`\`

# Objectives
Synthetic note ${id}.

# Results / Analysis
${id === "0011" ? COLUMN_CALC : "```calc\nname: t\n| Setting | Value |\n|---|---|\n| Volume (mL) | 2 |\n| Doubled | =b2*2 |\n```"}

- [ ] Process ABC${id}-A
`;
  }
  for (let i = 1; i <= 4; i++) {
    f[`05 Chemicals/Chemicals/Smoke chemical 000${i}.md`] = `---\nChemical class: ${["Monomer", "Initiator", "Solvent", "CTA"][i - 1]}\nDensity: "${(0.7 + i / 10).toFixed(2)}"\n---\n`;
  }
  f["02 Projects/Smoke project A/Smoke project A.md"] = "---\nkind: project\nStatus: Active\ncssclasses:\n  - vt\n  - project\n---\n\n```vault-card\nshow: hub-bar\n```\n\n```vault-card\nshow: project-plan\n```\n\n```vault-card\nshow: project-map\n```\n\n```vault-card\nshow: project-todos\n```\n";
  const todo = (name, extra) => { f[`00 Planning/To-dos/${name}.md`] = `---\nkind: todo\ndone: false\nproject: "[[Smoke project A]]"\n${extra}cssclasses:\n  - vt\n---\n`; };
  todo("Smoke step 1", "scheduled: 2026-01-12\n");
  todo("Smoke step 2", 'after: "[[Smoke step 1]]"\nscheduled: 2026-01-13\n');
  todo("Smoke step 3", 'after: "[[Smoke step 2]]"\n');
  todo("Smoke step 4", 'after: "[[Smoke step 2]]"\npriority: 2\n');
  todo("Smoke loose to-do", "");
  f["08 Meetings/Smoke meeting/Smoke meeting.md"] = "---\nkind: meeting-series\ninterval: weekly\nday: Fri\nstart: 2026-01-02\ncssclasses:\n  - vt\n---\n\n```vault-card\nshow: hub-bar\n```\n";
  f["08 Meetings/Smoke meeting/2026-01-09 Smoke meeting.md"] = "---\nkind: meeting\nseries: \"[[Smoke meeting]]\"\ndate: 2026-01-09\nsince: 2026-01-02\ncssclasses:\n  - vt\n---\n\n## Notes from the meeting\n- Synthetic meeting\n";
  f["03 Lab Book/Rigs/Smoke rig.md"] = rigText.replace(/^Test rig:.*$/m, "Synthetic rig for the smoke run.").replace(/^## Pumps/m, "```rig\n```\n\n## Pumps");
  f["00 Smoke/Callouts.md"] = "---\ncssclasses:\n  - vt\n---\n\n" + CALLOUT_TYPES.map(t => `> [!${t}] ${t}\n> body\n`).join("\n");
  return f;
}

/** Callout types the kit colours (vault-theme.css), plus the ones the home page uses. */
export const CALLOUT_TYPES = ["focus", "projects", "planning", "lab", "goto", "overdue", "summary", "question"];

export function writeSeed(dir) {
  const rig = readFileSync(join(ROOT, "tests", "fixtures", "rigs", "two-pumps-mixer.md"), "utf8");
  rmSync(dir, { recursive: true, force: true });
  const files = seedFiles(rig);
  for (const [rel, text] of Object.entries(files)) { const p = join(dir, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); }
  return Object.keys(files).length;
}

/** The class names the S2 inventory lists as selectors (`.bases-kanban-card` -> `bases-kanban-card`). */
export function internalClasses(inventory) {
  return inventory.entries.filter(e => e.kind === "selector").map(e => ({ name: e.name, risk: e.risk }));
}

/** Rows of a report from step results [{ name, status: PASS|FAIL|NOTE, detail, ms }]. */
export function formatReport(title, steps) {
  const lines = [`== ${title} ==`];
  for (const s of steps) lines.push(`${s.status.padEnd(4)} ${s.name}${s.detail ? ` : ${s.detail}` : ""}${s.ms != null ? `  (${s.ms} ms)` : ""}`);
  const n = st => steps.filter(s => s.status === st).length;
  lines.push(`-- ${n("PASS")} PASS, ${n("FAIL")} FAIL, ${n("NOTE")} NOTE`);
  return lines.join("\n");
}

// ---------------------------------------------------------------- the browser-side steps

// Helpers every step starts with. Steps run in separate eval calls (each is its own async function), so the helpers are repeated.
const HELPERS = `
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  // read() until two reads 400 ms apart agree (at most 10 s)
  const settle = async (read) => { let last = read(); for (let i = 0; i < 25; i++) { await sleep(400); const now = read(); if (now === last) return now; last = now; } return last; };
  const view = (leaf) => leaf.view;
  const open = async (path, mode) => {
    const f = app.vault.getAbstractFileByPath(path); if (!f) throw new Error("no such file: " + path);
    const leaf = app.workspace.getLeaf(false);
    await leaf.openFile(f, mode ? { state: { mode } } : undefined); await sleep(600); return leaf;
  };
  const noteEl = (leaf) => leaf.view.getMode?.() === "preview" ? leaf.view.previewMode.containerEl : leaf.view.containerEl;
`;

const STEPS = {
  /** Both kits through the plugin (as a user's first install would, minus the confirmation window). */
  install: `
    const p = app.plugins.plugins["lab-kit"]; const out = {};
    p.kit.planning.slot.enabled = true;
    for (const [id, km] of [["lab", p.kit.managed], ["planning", p.kit.planning]]) {
      for (const fo of km.kitFolders()) if (!app.vault.getFolderByPath(fo.path)) await app.vault.createFolder(fo.path);   // the empty folders a first install makes
      const items = await km.plan(); const res = await km.apply(items, () => true);
      out[id] = { items: items.length, results: res.length, failed: res.filter(r => r.error || r.status === "error" || r.result === "error").length };
    }
    await p.kit.save(); await sleep(2500);
    const need = ["00 Home.md", "00 Planning/To-do board.base", "03 Lab Book/Lab book base.base", "05 Chemicals/Chemical database.base"];
    return { ...out, missing: need.filter(n => !app.vault.getAbstractFileByPath(n)) };`,

  /** One shipped .base: open it, wait until its view has drawn, count what it shows. */
  base: (path, expectViews) => `${HELPERS}
    const leaf = await open(${JSON.stringify(path)});
    const count = () => JSON.stringify({ view: document.querySelectorAll(".workspace-leaf.mod-active .bases-view").length,
      cards: document.querySelectorAll(".workspace-leaf.mod-active [class*='bases-kanban-card']:not([class*='bases-kanban-card-'])").length,
      rows: document.querySelectorAll(".workspace-leaf.mod-active .bases-tr, .workspace-leaf.mod-active .bases-table-row, .workspace-leaf.mod-active .bases-list-entry, .workspace-leaf.mod-active .bases-list-item").length,
      columns: document.querySelectorAll(".workspace-leaf.mod-active .bases-kanban-column").length,
      named: [...document.querySelectorAll(".workspace-leaf.mod-active .bases-kanban-card")].filter(c => /Smoke/.test(c.innerText)).length,
      boardCards: document.querySelectorAll(".workspace-leaf.mod-active .lk-board-card").length });
    const c = JSON.parse(await settle(count));
    return { ...c, text: document.querySelector(".workspace-leaf.mod-active .bases-view")?.innerText?.slice(0, 300) };`,

  /** A note in reading view: settle, return the selector counts and (optionally) text. */
  note: (path, selectors, mode = "preview", allowMermaid = false) => `${HELPERS}
    const leaf = await open(${JSON.stringify(path)}, ${JSON.stringify(mode)});
    // Obsidian 1.14 asks once per vault before it draws Mermaid ("Display Mermaid diagrams in this vault?"): allow it, as a user would
    const guard = ${JSON.stringify(allowMermaid)} ? await settle(() => { const b = noteEl(leaf).querySelector(".mermaid-guard-actions button"); return b ? "guard" : "none"; }) : "none";
    let guardShown = false;
    if (guard === "guard") { guardShown = true; noteEl(leaf).querySelector(".mermaid-guard-actions button").click(); await sleep(1500); }
    const sel = ${JSON.stringify(selectors)};
    const read = () => JSON.stringify(Object.fromEntries(Object.entries(sel).map(([k, s]) => [k, noteEl(leaf).querySelectorAll(s).length])));
    const counts = JSON.parse(await settle(read));
    return { counts, guardShown, text: noteEl(leaf).innerText.slice(0, 4000) };`,

  /** Callouts: the colour of each kit callout inside a vt note against an unknown callout type (which only has Obsidian's default look). */
  callouts: (path, types) => `${HELPERS}
    const leaf = await open(${JSON.stringify(path)}, "preview"); await settle(() => noteEl(leaf).querySelectorAll(".callout").length);
    const el = noteEl(leaf); const fresh = (t) => { const d = el.querySelector('.callout[data-callout="' + t + '"]'); return d; };
    const probe = el.createDiv({ cls: "callout", attr: { "data-callout": "zz-smoke-unknown" } }); probe.createDiv({ cls: "callout-title" }); await sleep(100);
    const look = (d) => { const s = getComputedStyle(d); const i = d.querySelector(".callout-icon"); return { bg: s.backgroundColor, raw: s.getPropertyValue("--callout-color").trim(), icon: i ? getComputedStyle(i).color : "" }; };
    const base = look(probe); probe.remove();
    const out = {}; for (const t of ${JSON.stringify(types)}) { const d = fresh(t); out[t] = d ? look(d) : null; }
    return { base, out, valid: Object.fromEntries(Object.entries(out).map(([t, o]) => [t, o ? CSS.supports("color", o.raw) : null])) };`,

  /** Obsidian's own picker (command palette): the .prompt classes our pickers sit on. */
  prompt: `${HELPERS}
    app.commands.executeCommandById("command-palette:open"); await sleep(1200);
    const out = { prompt: document.querySelectorAll(".prompt").length, input: document.querySelectorAll(".prompt-input").length, results: document.querySelectorAll(".prompt-results").length };
    for (let i = 0; i < 4 && document.querySelector(".prompt"); i++) { (document.activeElement || document.body).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true })); await sleep(300); }
    out.closed = !document.querySelector(".prompt"); return out;`,

  /** A command that opens a window: title, our class on the window, size inside the screen. Closes it. */
  window: (id, opts = {}) => `${HELPERS}
    ${opts.note ? `await open(${JSON.stringify(opts.note)}, "source"); await sleep(500);` : ""}
    document.querySelectorAll(".notice").forEach(n => n.remove());
    const before = document.querySelectorAll(".modal-container").length;
    if (!app.commands.commands[${JSON.stringify(id)}]) return { ran: false, why: "no such command" };
    app.commands.executeCommandById(${JSON.stringify(id)}); await sleep(1500);
    const all = [...document.querySelectorAll(".modal-container")]; const m = all[all.length - 1];
    if (!m || all.length <= before) return { ran: true, opened: false, notices: [...document.querySelectorAll(".notice")].map(n => n.innerText) };
    const box = m.querySelector(".modal"); const r = box.getBoundingClientRect(); const cs = getComputedStyle(box);
    const out = { ran: true, opened: true, title: m.querySelector(".modal-title")?.innerText || "(no title)", cls: box.className, w: Math.round(r.width), h: Math.round(r.height), left: Math.round(r.left), right: Math.round(r.right), innerWidth, innerHeight,
      closeX: [...box.querySelectorAll(".modal-close-button, .modal-header-button")].filter(e => getComputedStyle(e).display !== "none").length, radius: cs.borderTopLeftRadius, text: box.innerText.slice(0, 200) };
    for (let i = 0; i < 4; i++) { if (!document.querySelectorAll(".modal-container").length) break; document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); app.workspace.containerEl.ownerDocument.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await sleep(300); }
    out.closed = document.querySelectorAll(".modal-container").length === before;
    return out;`,
};

// ---------------------------------------------------------------- the runner

const wait = ms => new Promise(r => setTimeout(r, ms));
function oc(args, { quiet = false } = {}) {
  return execFileSync(process.execPath, [CHECK, ...args], { encoding: "utf8", cwd: ROOT, stdio: ["ignore", "pipe", quiet ? "ignore" : "pipe"], maxBuffer: 1 << 24 });
}
function ev(code) {
  const out = oc(["eval", code]).trim();
  try { return JSON.parse(out); } catch { return out; }
}

/** Run one step; a thrown error is a FAIL with the message. */
async function step(steps, name, fn) {
  const t0 = Date.now();
  try {
    const r = await fn();
    const ms = Date.now() - t0;
    if (r === true || r == null) steps.push({ name, status: "PASS", ms });
    else steps.push({ name, status: r.status, detail: r.detail, ms });
  } catch (e) { steps.push({ name, status: "FAIL", detail: String(e.message || e).split("\n")[0].slice(0, 300), ms: Date.now() - t0 }); }
}
const ok = (cond, detail, notFail = false) => ({ status: cond ? "PASS" : notFail ? "NOTE" : "FAIL", detail });

async function runMode({ mobile, dir, seed, build, inventory }) {
  const steps = [];
  const label = mobile ? "phone emulation (390 x 844)" : "desktop";
  let started = false;
  try {
    await step(steps, "start: build, open vault, plugin loads, no errors at start", async () => {
      const t0 = Date.now();
      const out = oc(["start", "--dir", dir, "--notes", seed, ...(build ? [] : ["--no-build"]), ...(mobile ? ["--mobile"] : [])]);
      started = true;
      const j = JSON.parse(out.slice(out.indexOf("{")));
      const bad = [];
      if (!j.plugin) bad.push("plugin not loaded");
      if (j.errors?.length) bad.push(`errors: ${j.errors.join(" | ").slice(0, 200)}`);
      if (mobile && !(j.isMobile && j.bodyClasses?.includes("is-phone"))) bad.push("phone emulation not on");
      return ok(!bad.length, bad.length ? bad.join("; ") : `Lab Kit ${j.version}${mobile ? `, ${j.window.join("x")}` : ""}, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    });
    if (!started) return steps;
    // remember every class name that appears in the document, for the S2 selector check at the end
    ev(`if (!window.__smokeSeen) { window.__smokeSeen = new Set(); const grab = (n) => { if (n.nodeType === 1) { n.classList.forEach(c => window.__smokeSeen.add(c)); n.querySelectorAll("[class]").forEach(e => e.classList.forEach(c => window.__smokeSeen.add(c))); } };
      grab(document.body); new MutationObserver(ms => { for (const m of ms) { if (m.type === "attributes") grab(m.target); m.addedNodes.forEach(grab); } }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] }); } return 1;`);

    await step(steps, "install both kits through the plugin", async () => {
      const r = ev(STEPS.install);
      const bad = [];
      if (r.missing?.length) bad.push(`missing: ${r.missing.join(", ")}`);
      if (r.lab?.failed || r.planning?.failed) bad.push("some files failed");
      return ok(!bad.length, bad.length ? bad.join("; ") : `lab ${r.lab.results} files, planning ${r.planning.results} files`);
    });

    // every shipped .base: loads and shows what the seed has (the seed has 5 to-dos, 8 lab notes, 4 chemicals)
    // expected counts from the seed: 5 to-dos (the board shows all five on desktop, one day on a phone), 8 experiments (at least the first two columns' cards), 4 chemicals (+ a header row)
    for (const [path, what, enough] of [
      ["00 Planning/To-do board.base", "to-dos", (r) => (mobile ? r.boardCards >= 1 : r.boardCards === 5)],
      ["03 Lab Book/Lab book base.base", "experiments", (r) => r.named >= 4 && r.columns >= 3],   // Bases draws only the columns in view (the Closed column is off to the right), and one empty probe column of its own
      ["05 Chemicals/Chemical database.base", "chemicals", (r) => r.rows >= 4]]) {
      await step(steps, `base loads and shows rows: ${path}`, async () => {
        const r = ev(STEPS.base(path));
        return ok(r.view > 0 && enough(r), `${what}: view ${r.view}, kanban cards ${r.named}, rows ${r.rows}, columns ${r.columns}, board cards ${r.boardCards}${r.view ? "" : " (no .bases-view)"}`);
      });
    }

    await step(steps, "Home tiles draw (no 'planning kit is off', no missing folder)", async () => {
      const r = ev(STEPS.note("00 Home.md", { blocks: ".lab-kit-block", missing: ".lab-kit-block-missing", muted: ".lab-kit-block .vt-muted" }));
      const off = /planning kit is off/i.test(r.text);
      return ok(r.counts.blocks >= 5 && !off && r.counts.missing === 0, `${r.counts.blocks} blocks, ${r.counts.missing} missing-folder notes${off ? ", 'planning kit is off' shown" : ""}`);
    });

    await step(steps, "plan map draws on the project hub", async () => {
      const r = ev(STEPS.note("02 Projects/Smoke project A/Smoke project A.md", { map: ".vt-plan", cards: ".vt-map-card, .vt-plan [class*='vt-map-card']", ticks: ".vt-map-tick" }));
      return ok(r.counts.map > 0 && r.counts.ticks >= 4, `plan boxes ${r.counts.map}, cards ${r.counts.cards}, ticks ${r.counts.ticks} (seed has 5 to-dos, 4 in the chain)`);
    });

    await step(steps, "calc note 0011: Reactor volume = 1.7591", async () => {
      const r = ev(STEPS.note("03 Lab Book/Notes/0011 Smoke experiment.md", { tables: ".lab-kit-caption", header: ".lab-kit-header, [class*='lab-kit-hdr']" }));
      return ok(/Reactor volume\s+1\.7591/.test(r.text), /Reactor volume\s+(\S+)/.exec(r.text)?.[0] ?? "no Reactor volume row in the rendered text");
    });

    await step(steps, "rig note draws its figure, no Mermaid", async () => {
      // the figure is an <img> of the SVG; Obsidian's Mermaid prompt or a Mermaid diagram must not appear (plan rig-block-no-mermaid, Phase 2)
      const r = ev(STEPS.note("03 Lab Book/Rigs/Smoke rig.md", { rig: ".lab-kit-rig", img: ".lab-kit-rig-diagram img.lab-kit-rig-img", mermaid: ".mermaid, .mermaid-guard-actions", problems: ".lab-kit-rig-problems" }, "preview"));
      return ok(r.counts.rig > 0 && r.counts.img > 0 && r.counts.mermaid === 0 && r.counts.problems === 0, `rig ${r.counts.rig}, image ${r.counts.img}, mermaid ${r.counts.mermaid}, problems ${r.counts.problems}`);
    });

    await step(steps, "kit callouts have a colour in a kit note", async () => {
      const r = ev(STEPS.callouts("00 Smoke/Callouts.md", CALLOUT_TYPES));
      const flat = Object.entries(r.out).filter(([, o]) => !o || (o.bg === r.base.bg && o.icon === r.base.icon)).map(([t]) => t);
      const triplet = Object.entries(r.valid).filter(([, v]) => v === false).map(([t]) => t);
      if (flat.length) return { status: "FAIL", detail: `same look as the default callout: ${flat.join(", ")}` };
      return ok(true, `${CALLOUT_TYPES.length} types differ from the default${triplet.length ? `; --callout-color is not a CSS colour (RGB triplet) for ${triplet.length} (BACKLOG: Callout colours outside kit notes)` : ""}`);
    });

    const windows = [
      ["Check setup", "lab-kit:check-setup", {}],
      ["Review kit files", "lab-kit:kit-review", {}],
      ["Manage kit files", "lab-kit:kit-manage", {}],
      ["New lab entry", "lab-kit:new-lab-entry", {}],
      ["New chemical", "lab-kit:new-chemical", {}],
      ["Insert snippet (Alt+S)", "lab-kit:insert-snippet", { note: "03 Lab Book/Notes/0010 Smoke experiment.md" }],
      ["Show what's new", "lab-kit:whats-new", {}],
    ];
    let alts = null;
    for (const [name, id, opts] of windows) {
      await step(steps, `window opens, fits the screen, closes: ${name}`, async () => {
        const r = ev(STEPS.window(id, opts));
        if (!r.ran) return { status: "FAIL", detail: r.why };
        if (!r.opened) {
          const t = (r.notices || []).find(n => /Templater/.test(n));
          return t ? { status: "NOTE", detail: `needs Templater, which the throwaway vault does not have (notice: "${t}")` } : { status: "FAIL", detail: `opened no window and no Templater notice (notices: ${(r.notices || []).join(" | ") || "none"})` };
        }
        const bad = [];
        if (r.w < 100 || r.h < 50) bad.push(`size ${r.w}x${r.h}`);
        if (r.left < -1 || r.right > r.innerWidth + 1) bad.push(`outside the screen (${r.left}..${r.right} of ${r.innerWidth})`);
        if (!r.closed) bad.push("did not close on Escape");
        if (id === "lab-kit:insert-snippet") alts = r;
        return ok(!bad.length, `"${r.title}" ${r.w}x${r.h}${bad.length ? "; " + bad.join("; ") : ""}`);
      });
    }

    if (alts) steps.push({ name: "Alt+S picker draws no close X (the approved picture has none)", status: alts.closeX ? "NOTE" : "PASS", detail: alts.closeX ? `${alts.closeX} close button shown: the rule in styles.css targets .modal-close-button, which this Obsidian no longer draws (BACKLOG)` : "" });

    await step(steps, "Obsidian's own picker (command palette) draws .prompt, input and results", async () => {
      const r = ev(STEPS.prompt);
      return ok(r.prompt > 0 && r.input > 0 && r.results > 0 && r.closed, `prompt ${r.prompt}, input ${r.input}, results ${r.results}, closed ${r.closed}`);
    });

    // S2's selectors: seen somewhere during this run. Windows and boards above draw most; the rest are reported, not failed.
    await step(steps, "Obsidian classes from the S2 inventory seen in the DOM", async () => {
      const seen = new Set(ev(`return [...window.__smokeSeen];`));
      const list = internalClasses(inventory).filter(c => !PREFIX_ONLY.has(c.name));
      const missing = list.filter(c => !seen.has(c.name));
      const high = missing.filter(c => c.risk === "high");
      const detail = `${list.length - missing.length}/${list.length} seen${missing.length ? `; not drawn in this run: ${missing.map(c => `${c.name} [${c.risk}]`).join(", ")}` : ""}`;
      return ok(high.filter(c => MUST_SEE.has(c.name)).length === 0, detail, false);
    });

    await step(steps, "no console errors in the whole run", async () => {
      const errs = ev(`return window.__ocheckErrors || ["(error hook missing)"];`);
      return ok(Array.isArray(errs) && errs.length === 0, Array.isArray(errs) && errs.length ? errs.map(e => e.slice(0, 160)).join(" | ") : "");
    });
  } finally {
    if (started) { try { oc(["stop", "--dir", dir]); } catch (e) { steps.push({ name: "stop", status: "FAIL", detail: String(e.message).slice(0, 200) }); } }
  }
  return steps;
}

/** Inventory entries that are a name prefix (a comment or string in the code), not a class Obsidian draws. */
export const PREFIX_ONLY = new Set(["bases-kanban"]);

/** High-risk classes the run must actually see on a healthy build (set after the first real run: see docs/maintenance.md). */
export const MUST_SEE = new Set(["bases-view", "bases-kanban-column", "bases-kanban-card"]);

async function main() {
  const a = process.argv.slice(2);
  const flag = n => { const i = a.indexOf(n); if (i < 0) return false; a.splice(i, 1); return true; };
  const opt = n => { const i = a.indexOf(n); if (i < 0) return ""; const v = a[i + 1]; a.splice(i, 2); return v; };
  const seedOnly = opt("--seed");
  if (seedOnly) { console.log(`${writeSeed(resolve(seedOnly))} files written to ${resolve(seedOnly)}`); return; }
  const noMobile = flag("--no-mobile"), noBuild = flag("--no-build");
  const base = resolve(opt("--dir") || join(tmpdir(), "lab-kit-smoke"));
  const seed = join(base, "seed");
  mkdirSync(base, { recursive: true });
  const n = writeSeed(seed);
  const inventory = JSON.parse(readFileSync(join(ROOT, "scripts", "obsidian-internals.json"), "utf8"));
  console.log(`Seed vault: ${n} synthetic files (${seed}). Starting the test Obsidian: a window flashes for a second.`);
  let fails = 0;
  for (const mobile of noMobile ? [false] : [false, true]) {
    const steps = await runMode({ mobile, dir: join(base, mobile ? "run-phone" : "run-desktop"), seed, build: !noBuild && !mobile, inventory });
    console.log(formatReport(mobile ? "phone emulation (390 x 844)" : "desktop", steps));
    fails += steps.filter(s => s.status === "FAIL").length;
    await wait(1000);
  }
  console.log(fails ? `SMOKE FAIL (${fails})` : "SMOKE PASS");
  process.exit(fails ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(String(e?.stack || e)); process.exit(1); });
