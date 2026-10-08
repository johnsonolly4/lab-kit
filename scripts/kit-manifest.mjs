// Regenerates the "files" list in kits/<id>/kit-manifest.json from what's in that kit's folder, for every kit under kits/.
// Per file: id (kept once assigned), kind, version (kit version where the content last changed), sha256, renamedFrom.
// Keeps id, version, rewrite, templater, enableCss / disableCss and removed as they are.
// Usage: npm run kit:manifest
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, relative, sep } from "path";
import { KITS, sha256 } from "./embed-kit.mjs";

const KIND_BY_ROLE = { cssSnippets: "snippet", templates: "template", scripts: "script", userScripts: "script", labBase: "note", chemicalBase: "note" };
const PREFIX = { snippet: "snip", template: "tpl", script: "script", note: "note" };

/* ---- Per kit: which source folder holds which role, and the one-line descriptions ---- */
const LAB_ROLE_BY_PREFIX = [
  [".obsidian/snippets/", "cssSnippets"],
  ["Extras/scripts/templater/", "userScripts"],
  ["Extras/scripts/", "scripts"],
  ["Templates/", "templates"],
  ["03 Lab Book/", "labBase"],
  ["05 Chemicals/", "chemicalBase"],
];
// One line per kit file, shown in Manage kit files. Snippets (Templates/Snippets/) use their own "// desc:" line.
const LAB_DESC = {
  ".obsidian/snippets/scrolling-mermaid.css": "Lets wide Mermaid diagrams scroll sideways inside a note",
  "Extras/scripts/excel_to_calc.py": "Command-line tool that turns an Excel file into calc tables",
  "Extras/scripts/templater/labForm.js": "The pop-up form every snippet uses",
  "Extras/scripts/templater/labMethods.js": "Analysis methods and machines (NMR, GPC, DLS and the notes in your Methods folder)",
  "Extras/scripts/templater/labPick.js": "The searchable snippet menu with icons",
  "Extras/scripts/templater/labSnippets.js": "The code behind every snippet",
  "Templates/Insert snippet.md": "The Alt+S menu: lists the snippets and inserts the one you pick",
  "Templates/Lab Book Template.md": "New experiment note: number, hazards, data folder button and sections",
  "Templates/Chemical database template.md": "New chemical note: names, class, hazards, CAS number, MW and physical data",
  "03 Lab Book/Lab book base.base": "Board of your experiments by Status, next to your Lab notes folder",
  "05 Chemicals/Chemical database.base": "Table and by-class board of your chemical notes, next to your Chemical folder",
};
const CONFIG = {
  lab: {
    roleByPrefix: LAB_ROLE_BY_PREFIX, desc: LAB_DESC,
    // Snippets carry their own "// desc:" line and can be switched off; so can the Excel converter (not part of the plugin itself)
    optionalPrefix: "Templates/Snippets/", optionalFiles: new Set(["Extras/scripts/excel_to_calc.py", "Templates/Chemical database template.md", "03 Lab Book/Lab book base.base", "05 Chemicals/Chemical database.base"]),
    // policy "keep": installed once, never updated (notes that become the user's own)
    keepFiles: new Set(["03 Lab Book/Lab book base.base", "05 Chemicals/Chemical database.base"]),
    // "needs": the setting (kit data key) that must be set for the file to be installed; empty = treated as switched off
    needs: { "Templates/Chemical database template.md": "chemicalFolder", "03 Lab Book/Lab book base.base": "labFolder", "05 Chemicals/Chemical database.base": "chemicalFolder" },
  },
};
// Planning kit: the planning suite (homepage, to-do board, planning notes, templates, Actions, vtAsk.js, theme). Source:
// docs/plans/kit-files/planning (see docs/plans/phase-3-planning-files.md for what is shipped and what waits for later phases).
// A prefix without a trailing "/" is one file at the vault root (its role's folder is the root).
const PLANNING_ROLE_BY_PREFIX = [
  [".obsidian/snippets/", "cssSnippets"],
  ["Extras/scripts/templater/vault/", "userScripts"],
  ["Extras/Templates/", "templates"],
  ["00 Home.md", "home"],
  ["00 Planning/", "planning"],
  ["02 Projects/", "projects"],
  ["04 Literature/", "literature"],
  ["06 Knowledge/", "knowledge"],
  ["07 How-tos/", "howtos"],
  ["08 Meetings/", "meetings"],
];
const PLANNING_DESC = {
  ".obsidian/snippets/vault-colours.css": "Colours of the planning notes, badges and board columns",
  ".obsidian/snippets/vault-theme.css": "Planning theme: homepage layout, callouts, to-do board cards",
  "Extras/scripts/templater/vault/vtAsk.js": "The text box every planning template asks with",
  "Extras/Templates/To-do.md": "New to-do note (folder template for 00 Planning/To-dos)",
  "Extras/Templates/Daily note.md": "Daily note (folder template for 01 Daily Notes)",
  "Extras/Templates/Project hub.md": "New project: its folder and hub note",
  "Extras/Templates/New project note.md": "New note inside a project",
  "Extras/Templates/Weekly meeting.md": "New meeting note",
  "Extras/Templates/Meeting series.md": "New meeting series: its hub note",
  "Extras/Templates/New concept.md": "New concept: a knowledge note in a topic folder",
  "Extras/Templates/ZotLit/zotlit-note.liquid.md": "ZotLit literature note template",
  "Extras/Templates/ZotLit/zotlit-lititem.liquid.md": "ZotLit template: one literature item",
  "Extras/Templates/ZotLit/zotlit-content.liquid.md": "ZotLit template: annotations",
  "00 Home.md": "Homepage: today, focus, this week, experiments, projects, recently read",
  "00 Planning/To-do board.base": "To-do board: one column per day",
  "00 Planning/Weekly review.md": "Weekly review note",
  "00 Planning/Shopping list.md": "Lab shopping list",
  "02 Projects/Projects overview.md": "All projects with their status",
  "04 Literature/Literature.md": "Literature hub (ZotLit imports)",
  "06 Knowledge/Knowledge index.md": "Knowledge notes by topic",
  "07 How-tos/How-tos index.md": "How-to notes by topic",
  "07 How-tos/Obsidian/How my vault works.md": "Guide to the vault layout and daily routine",
  "07 How-tos/Obsidian/Setting up a computer.md": "Steps to set up Obsidian on a new computer",
  "07 How-tos/Obsidian/Hotkeys.md": "Recommended hotkeys (Alt + first letter); never set for you",
  "07 How-tos/Obsidian/Set up ZotLit.md": "Checklist: ZotLit's note folder and template folder",
  "07 How-tos/Obsidian/Vault spec.md": "Full specification of the vault",
  "08 Meetings/Meetings.md": "Meetings hub: next meeting of each series",
};
const ZOTLIT = ["04 Literature/Literature.md", "07 How-tos/Obsidian/Set up ZotLit.md", "Extras/Templates/ZotLit/zotlit-note.liquid.md", "Extras/Templates/ZotLit/zotlit-lititem.liquid.md", "Extras/Templates/ZotLit/zotlit-content.liquid.md"];
CONFIG.planning = {
  roleByPrefix: PLANNING_ROLE_BY_PREFIX, desc: PLANNING_DESC,
  // Only the ZotLit files can be off (and are, without the ZotLit plugin)
  optionalPrefix: null, optionalFiles: new Set(ZOTLIT),
  // Notes become the user's own: installed once, never updated. Templates, Actions, scripts and CSS are updated.
  keepFiles: new Set(Object.keys(PLANNING_DESC).filter((rel) => !rel.startsWith("Extras/") && !rel.startsWith(".obsidian/"))),
  needs: Object.fromEntries(ZOTLIT.map((rel) => [rel, "plugin:zotlit"])),
};
const SKIP = new Set(["kit-manifest.json"]);

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** Regenerates one kit's manifest. `KIT` = its folder (kits/<id>). */
function regenerate(KIT) {
  const manifestPath = join(KIT, "kit-manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const cfg = CONFIG[manifest.id];
  if (!cfg) throw new Error(`${manifestPath}: no CONFIG entry for kit id "${manifest.id}" in scripts/kit-manifest.mjs`);
  const ROLE_BY_PREFIX = cfg.roleByPrefix, DESC = cfg.desc, OPTIONAL_PREFIX = cfg.optionalPrefix, OPTIONAL_FILES = cfg.optionalFiles;
  const descOf = (rel, text) => OPTIONAL_PREFIX && rel.startsWith(OPTIONAL_PREFIX)
    ? (text.match(/^\/\/\s*desc:\s*(.+)$/m)?.[1]?.trim() ?? (() => { throw new Error(`${rel}: no "// desc:" line`); })())
    : (DESC[rel] ?? (() => { throw new Error(`${rel}: add a line to DESC in scripts/kit-manifest.mjs`); })());

  const previous = new Map((manifest.files ?? []).map((f) => [f.src, f]));
  const taken = new Set();

  // id: stable forever (the update system tracks files by id, not path). Kept from the previous manifest by src;
  // a new file gets kind prefix + slug of its path.
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  function idFor(entry, prev) {
    const id = prev?.id ?? `${PREFIX[entry.kind]}-${slug(entry.path)}`;
    if (taken.has(id)) throw new Error(`duplicate kit file id ${id} (${entry.src})`);
    taken.add(id);
    return id;
  }

  // Moving a kit file: add `"renames": { "<old src>": "<new src>" }` to kit-manifest.json before running this.
  // The moved file keeps its id (so installed copies keep updating in place) and remembers its old place in renamedFrom.
  const renames = manifest.renames ?? {};
  const oldSrcOf = new Map(Object.entries(renames).map(([from, to]) => [to, from]));
  const roleOf = (rel) => ROLE_BY_PREFIX.find(([pre]) => rel.startsWith(pre));

  const files = walk(KIT)
    .map((p) => relative(KIT, p).split(sep).join("/"))
    .filter((rel) => !SKIP.has(rel))
    .map((rel) => {
      const hit = roleOf(rel);
      if (!hit) throw new Error(`${KIT}/${rel}: not under a known kit folder (see ROLE_BY_PREFIX)`);
      const role = hit[1];
      const path = hit[0].endsWith("/") ? rel.slice(hit[0].length) : rel;
      const kind = KIND_BY_ROLE[role] ?? "note";   // note folders (planning kit roles) are notes
      const oldSrc = oldSrcOf.get(rel);
      const prev = previous.get(rel) ?? (oldSrc ? previous.get(oldSrc) : undefined);
      if (oldSrc && !prev) throw new Error(`renames: "${oldSrc}" is not in the previous manifest`);
      const renamedFrom = [...(prev?.renamedFrom ?? [])];
      if (oldSrc) {
        const oldHit = roleOf(oldSrc);
        const oldPath = oldHit ? oldSrc.slice(oldHit[0].length) : oldSrc;
        if (!renamedFrom.includes(oldPath)) renamedFrom.push(oldPath);
      }
      const text = readFileSync(join(KIT, rel), "utf8");
      const hash = sha256(text);
      // "version" = the kit version in which this file's content last changed
      const entry = { id: idFor({ kind, path, src: rel }, prev), kind, src: rel, role, path,
        version: prev?.sha256 === hash && prev.version ? prev.version : manifest.version, sha256: hash,
        renamedFrom, desc: descOf(rel, text) };
      if ((OPTIONAL_PREFIX && rel.startsWith(OPTIONAL_PREFIX)) || OPTIONAL_FILES.has(rel)) entry.optional = true;
    const policy = cfg.keepFiles?.has(rel) ? "keep" : prev?.policy;   // a policy set by hand in the manifest is kept too
    if (policy) entry.policy = policy;
    if (cfg.needs?.[rel]) entry.needs = cfg.needs[rel];
      return entry;
    })
    .sort((a, b) => (a.role + a.path).localeCompare(b.role + b.path));

  // The plugin's own files (main.js, manifest.json, styles.css) are deliberately NOT listed: the plugin never
  // updates itself (Obsidian developer policies).

  // A file that was in the previous manifest and is gone from kit/ (and wasn't moved) is retired: its id goes into
  // `removed`, so installed copies are marked "Retired" and left alone. Printed, so a deleted file is never silent.
  const removed = [...(manifest.removed ?? [])];
  for (const prev of previous.values()) {
    if (taken.has(prev.id) || removed.includes(prev.id)) continue;
    removed.push(prev.id);
    console.log(`retired: ${prev.src} (id ${prev.id})`);
  }
  const clash = removed.filter((id) => taken.has(id));
  if (clash.length) throw new Error(`id in both files and removed: ${clash.join(", ")}`);

  const { renames: _done, ...rest } = manifest;
  const out = { ...rest, schema: 2, files, removed };
  writeFileSync(manifestPath, JSON.stringify(out, null, 2) + "\n");
  console.log(`${manifestPath}: ${files.length} files`);
}

for (const name of readdirSync(KITS).sort()) {
  if (existsSync(join(KITS, name, "kit-manifest.json"))) regenerate(join(KITS, name));
}
