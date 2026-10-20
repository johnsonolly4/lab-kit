// `node scripts/make-stress-vault.mjs [dir] [--lab N] [--todos N] [--chem N] [--meetings N]`: writes a big synthetic vault for the
// N7 stress test (docs/plans/stress-test-result.md). Defaults: 2000 lab notes (2 calc blocks each), 3000 to-dos, 300 chemicals,
// 200 meetings in 4 series. All names are made up; nothing is read from any real vault. Never writes to test-vault/ or the repo folders.
// Same folder layout as the kits (03 Lab Book/Notes, 00 Planning/To-dos, 05 Chemicals/Chemicals, 08 Meetings/<series>, 02 Projects/<p>/<p>.md).
// Open the result with obsidian-check: `node scripts/obsidian-check.mjs start --notes <dir>`.
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join, resolve, sep } from "path";

const args = process.argv.slice(2);
const num = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? Number(args[i + 1]) : dflt; };
const flagVals = new Set(["--lab", "--todos", "--chem", "--meetings"].flatMap(f => { const i = args.indexOf(f); return i >= 0 ? [i, i + 1] : []; }));
const dirArg = args.find((a, i) => !a.startsWith("--") && !flagVals.has(i));
const out = resolve(dirArg ?? "test-vault-stress");
const guarded = [resolve("test-vault"), resolve("src"), resolve("kits"), resolve("tests")];
if (guarded.some(g => out === g || out.startsWith(g + sep))) { console.error(`Refusing to write into ${out}`); process.exit(1); }
const N = { lab: num("--lab", 2000), todos: num("--todos", 3000), chem: num("--chem", 300), meetings: num("--meetings", 200) };

// small deterministic random numbers, so two runs give the same vault
let seed = 12345;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];
const pad = (n, w) => String(n).padStart(w, "0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const today = new Date();

if (existsSync(out)) rmSync(out, { recursive: true, force: true });
const put = (rel, text) => { const p = join(out, rel); mkdirSync(join(p, ".."), { recursive: true }); writeFileSync(p, text); };

const projects = Array.from({ length: 12 }, (_, i) => `Project ${String.fromCharCode(65 + i)}`);
const series = ["Group meeting", "Subgroup", "Project sync", "Reading club"];
const classes = ["Flow RAFT", "Batch RAFT", "Kinetics", "Screening"];
const statuses = ["Planned", "Running", "Finished", "Analysed"];
const chems = Array.from({ length: N.chem }, (_, i) => `Chem ${pad(i + 1, 4)}`);

for (const p of projects) {
  put(`02 Projects/${p}/${p}.md`, `---\nkind: project\ncssclasses:\n  - vt\n---\n\n# ${p}\n\n\`\`\`vault-card\nshow: hub-bar\n\`\`\`\n`);
}

for (let i = 1; i <= N.lab; i++) {
  const id = pad(i, 4), d = addDays(today, -(N.lab - i)), a = pick(chems), b = pick(chems);
  const flow = (0.1 + rnd() * 0.9).toFixed(2);
  put(`03 Lab Book/Notes/${id}.md`, `---
Type: Experiment
Status: ${pick(statuses)}
Exp. Class: ${pick(classes)}
Plan date: ${iso(d)}
Exp. Start: ${iso(d)}
Chemicals:
  - "[[${a}]]"
  - "[[${b}]]"
CoSHH: C-${i % 40}
RA: RA-${i % 25}
Objective: Synthetic test experiment ${id}
Outcome:
project: "[[${pick(projects)}]]"
cssclasses:
  - vt
---

\`\`\`lab-header
\`\`\`

# Objectives
Synthetic note ${id} for the stress test.

# Results / Analysis
## Reactor
\`\`\`calc
name: rt_in
title: Reactor
| Setting | Value |
|---|---|
| Reactor volume (mL) | ${(1 + rnd() * 3).toFixed(4)} |
\`\`\`

## Residence times
\`\`\`calc
name: rt
title: Flow rate for each residence time
| Residence time (min) | Flow rate (mL/min) | Time to steady state, 3 RTs (min) |
|---|---|---|
| 2 | =rt_in!$B$2/A2 | =A2*3 |
| 10 | =rt_in!$B$2/A3 | =A3*3 |
| 20 | =rt_in!$B$2/A4 | =A4*3 |
| 30 | =rt_in!$B$2/A5 | =A5*3 |
\`\`\`

Pump set to ${flow} mL/min. Samples ABC${pad(i, 4)}-A and ABC${pad(i, 4)}-B.

- [ ] Process ABC${pad(i, 4)}-A
- [x] Collect ABC${pad(i, 4)}-B
`);
}

for (let i = 0; i < N.todos; i++) {
  const sched = rnd() < 0.5 ? `scheduled: ${iso(addDays(today, Math.floor(rnd() * 28) - 7))}\n` : "";
  const done = rnd() < 0.35;
  const due = rnd() < 0.2 ? `due: ${iso(addDays(today, Math.floor(rnd() * 40) - 10))}\n` : "";
  const pri = rnd() < 0.2 ? `priority: ${1 + Math.floor(rnd() * 3)}\n` : "";
  const proj = rnd() < 0.7 ? `project: "[[${pick(projects)}]]"\n` : "";
  const meet = rnd() < 0.1 ? `meeting: "[[${pick(series)}]]"\n` : "";
  put(`00 Planning/To-dos/Stress to-do ${pad(i + 1, 4)}.md`, `---\nkind: todo\n${sched}done: ${done}\n${proj}${due}${pri}${meet}cssclasses:\n  - vt\n---\n\n\`\`\`vault-card\nshow: todo-bar\n\`\`\`\n`);
}

for (const c of chems) {
  put(`05 Chemicals/Chemicals/${c}.md`, `---\nChemical class: ${pick(["Monomer", "Initiator", "Solvent", "CTA", "Catalyst"])}\nDensity: "${(0.7 + rnd()).toFixed(2)}"\n---\n`);
}

for (const s of series) {
  put(`08 Meetings/${s}/${s}.md`, `---\nkind: meeting-series\ninterval: weekly\nday: Fri\nstart: ${iso(addDays(today, -400))}\ncssclasses:\n  - vt\n---\n\n\`\`\`vault-card\nshow: hub-bar\n\`\`\`\n`);
}
for (let i = 0; i < N.meetings; i++) {
  const s = series[i % series.length], d = addDays(today, -7 * Math.floor(i / series.length));
  put(`08 Meetings/${s}/${iso(d)} ${s}.md`, `---\nkind: meeting\nseries: "[[${s}]]"\ndate: ${iso(d)}\nsince: ${iso(addDays(d, -7))}\ncssclasses:\n  - vt\n---\n\n## Notes from the meeting\n- Synthetic meeting ${i + 1}\n`);
}
put("00 Home.md", "---\ncssclasses:\n  - vt\n---\n\n# Home\n");
console.log(`Stress vault written to ${out}: ${N.lab} lab notes, ${N.todos} to-dos, ${N.chem} chemicals, ${N.meetings} meetings, ${projects.length} projects.`);
