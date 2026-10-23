# Plan: the in-silico study note (Run record, run table, record helper)

> [!warning] PARKED 2026-10-20 (owner: looks OK; come back with the optimisation project)
> Written 2026-10-20 (plan and mock-up only, no plugin code changed). Built on the research in `docs/plans/in-silico-record-requirements.md` and the owner's answers in chat on 2026-10-20 (below). Open questions are at the end and in BACKLOG "In-silico experiments in the lab notebook". Looks are never decided here: the feedback page is `my_work/mockups/in-silico-note-mockup.html` (private, made-up content; feedback copy in `my_work/mockups/in-silico-note-mockup-feedback/`). Each phase = one Sonnet session.

## Goal
"I need to be able to, practically, fill out the experiment record. We need to make it as easy as possible to do it right." (owner, chat 2026-10-20)

One lab note per in-silico **study**. Its body holds a plain-text **Run record** (study-level `label: value` lines and small tables) and a **Run table** with one row per run attempt. The rows come from a tiny **record helper** that the experiment's own run code calls; the owner (or the agent driving the experiment) types only what no script can know. Anything the helper could not read is written as `not recorded`, never left out, so the gap shows later. Close experiment lists the gaps and still lets you close. Every statement in the record carries its **basis** (reported, derived, interpretation, decision), so the record stays verifiable whether a person or an LLM ran the experiment.

## What the owner has decided (not re-asked)
- **The flow is accepted** (chat 2026-10-20): the run script writes the record; an Alt+S snippet pastes it and asks only what a script cannot know; Close checks and lists missing fields; one note per study with one table row per run.
- **Body, not front matter** (chat 2026-10-20): the Run record is in the note's plain-text body. Front matter keeps only what finding needs: `Exp. Class: in silico`, `Status`, `Project`, `Result`, `closed_on` (the other kit properties of the lab template stay as the template has them; which wet-lab ones an in-silico note drops is the BACKLOG item's question 3). This replaces the research note's front-matter list and its YAML `run-record` block.
- **One note per study, not per run** (chat 2026-10-20).
- **With and without LLMs, verifiable** (chat 2026-10-20): works for a human-run script and for an LLM or agent driving the experiment; each recorded statement is tagged by basis as in the owner's verifiable-claims practice; who or what proposed a parameter versus who chose it; the agent or model id and version and the prompt or instruction file's hash when an LLM took part; earlier unrepeatable results labelled `needs repeat`; a re-run command that checks the recorded outputs without writing.
- **Runs on both a laptop and a cluster; the cluster is not known** (chat 2026-10-20): the helper is one stand-alone file, standard library only, no network, no Obsidian, tolerant of missing tools, scheduler-aware only through optional environment variables. Nothing about the cluster is assumed (what to find out: section 2(e)).
- **Off by default** (chat 2026-10-20): nothing in the plugin changes for anyone unless the setting **In-silico notes** is on. The helper is for the owner only for now, not a shipped product.
- Live-block rules (`docs/decisions.md` 2026-10-20): plain text, flat, recoverable without the plugin, a format version in every block, older versions always readable, a format change ships with a reader and a test on a saved old note.
- Close experiment has no freeze; it hashes the note (`docs/plans/close-experiment.md`).

## What the helper is (in plain words)
- **One small file** (`labrecord.py`) that you copy into the folder of your experiment code (its repository) once, and commit with it.
- Your run code **calls it in one line at the end** of a run.
- It **writes down the facts the computer already knows** at that moment: which version of the code ran (the commit) and whether it had unsaved changes (it saves those changes as a file), the exact command, the seeds you passed, the language and package versions, the operating system, the maths library (BLAS) and thread settings, the start and end time in UTC, and a fingerprint (sha256) of every input and output file.
- It writes them as **a short text block in a file next to the outputs** (`run-record.md`) and prints the same block on screen. You paste it into the study note with Alt+S, or the helper adds the row itself when the note is on the same computer.
- It **never changes the experiment**: it only reads, and writes its own small files next to the outputs. No internet, nothing to install, no Obsidian needed. If it cannot find something (no git on the cluster, say), it writes `not recorded` and carries on; it never stops your run.

The one line (made-up values), at the end of a Python run script:
```python
labrecord.record(study="ABC0021", run="d3.b4.r1", out="results/study21/d3.b4.r1", seeds={"master": 1234, "run": 2004}, config="configs/study21.json", inputs=["data/d3.csv"])
```
or from a shell script: `python3 labrecord.py record --study ABC0021 --run d3.b4.r1 --out results/study21/d3.b4.r1 --seed master=1234 --seed run=2004 --command "$0 $*" --exit $?`

What it prints (made-up values, hashes shortened here for width):
```text
## Run record
- Record format: 1
- Kind: run · Study ID: ABC0021 · Run ID: d3.b4.r1 · Try: 1
- Machine: laptop · Scheduler job: none
- Command: python run_cell.py --cell 4 --replicate 1
- Commit: 7c41e0b2a9f1… · Clean tree: no · Patch: run.patch (sha256 0d93c1aa7e65…)
- Seeds: master 1234 · run 2004
- Language: Python 3.12.4 · Lock file: uv.lock (sha256 9c1d22aa04f3…)
- OS: macOS 15.1 · Arch: arm64 · BLAS: Accelerate · Threads: OMP_NUM_THREADS=2
- Start (UTC): 2026-09-29T08:14:03Z · End (UTC): 2026-09-29T08:41:55Z · Status: ok (exit 0)
- Outputs: outputs.sha256 (sha256 5be1f0a9c3d2…), 14 files
- Agent: not recorded
- Verify: python3 labrecord.py verify results/study21/d3.b4.r1
Record written: results/study21/d3.b4.r1/run-record.md (sha256 a07c3e91f4b8…)
```
(The printed form groups some lines with `·` to fit a terminal; the file holds one label per line, section 1b.)

## 1. The body format (format 1)

### 1a. The study note
The section starts at a heading whose text is `Run record` (any level) and ends at the next heading of the same or a higher level. Its first line is the format line. Sub-sections are headings one level down: `Inputs`, `Parameters`, `Environments`, `Run table`, `Results`. A made-up example (as on the mock-up page):

```markdown
---
Exp. Class: in silico
Status: Started
Project: "[[Optimisation methods]]"
Result:
closed_on:
---

## Run record
- Record format: 1
- Study ID: ABC0021
- Plan ref: [[Batch size plan]] · decision D-012 (2026-09-28) [decision · Lab member A]
- Objective: Does the batch size change the hypervolume reached after 40 evaluations? [decision · Lab member A]
- Pass criterion: median hypervolume gap below 2 % between batch 1 and batch 4 at 40 evaluations [decision · Lab member A, before the first run]
- Repository: github.com/example-lab/bo-bench
- Config: configs/study21.json · sha256 3f9a0c4e1b7d…
- Seeds: master 1234 · run seed = master + 1000 × cell + replicate
- Outputs: results/study21 (group drive) · one outputs.sha256 per run
- Run by: Lab member A
- Agent: assistant tool / model-x 2026-08 · instructions AGENTS.md sha256 b41f09d2c7e3 · prompt sha256 2e7a90c1f5d4
- Deviations: 5 replicates per cell, the plan said 10 [decision · Lab member A, 2026-09-29]
- Verdict: not recorded

### Parameters
| Parameter | Value | Proposed by | Chosen by | Basis |
|---|---|---|---|---|
| batch sizes | 1, 4 | plan D-012 | Lab member A | decision |
| start design size | 8 | agent (model-x) | Lab member A | decision |
| threads | 2 | helper default | Lab member A | decision |

### Inputs
| Input | Path or store | sha256 | Origin | Licence |
|---|---|---|---|---|
| d3 benchmark | data/d3.csv | 41ab9e07c2d1 | example benchmark set v2 | CC-BY 4.0 |

### Environments
| Env | Language | Lock file | OS | Arch | BLAS | Threads | Container |
|---|---|---|---|---|---|---|---|
| e1 | Python 3.12.4 | uv.lock 9c1d22aa04f3 | macOS 15.1 | arm64 | Accelerate | 2 | none |
| e2 | Python 3.12.4 | uv.lock 9c1d22aa04f3 | Linux 6.8 | x86_64 | OpenBLAS 0.3.27 | 2 | not recorded |

### Run table
| Run ID | Try | Machine | Commit | Clean | Patch | Env | Seed | Start (UTC) | End (UTC) | Status | Outputs | Record |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| d3.b1.r1 | 1 | laptop | 7c41e0b2a9f1 | yes | none | e1 | 2001 | 2026-09-29T08:14:03Z | 2026-09-29T08:41:55Z | ok | 5be1f0a9c3d2 | a07c3e91f4b8 |
| d3.b4.r1 | 1 | cluster | 7c41e0b2a9f1 | no | 0d93c1aa7e65 | e2 | 2004 | 2026-09-29T09:02:11Z | not recorded | killed (no end record) | not recorded | 11f0e2c9ab47 |
| d3.b4.r1 | 2 | laptop | 7c41e0b2a9f1 | yes | none | e1 | 2004 | 2026-09-29T10:20:40Z | 2026-09-29T10:58:02Z | ok, resumed from try 1 | 9e44b1c07a3f | 6c2d81f0be19 |

### Results
| Claim | Statement | Basis | Source | Status |
|---|---|---|---|---|
| R1 | median hypervolume gap 1.3 % at 40 evaluations | derived | D-031 (scripts/gap.py on runs d3.*) | open |
| R2 | batch 4 is not worse than batch 1 on d3 | interpretation · Lab member A | R1 | open |
| R3 | pilot gap 0.9 % (pilot study, script not kept) | derived | none | needs repeat |
```

Rules (all plain text; Lab Kit reads them, a person reads them without Lab Kit):
- **Label lines** are `- Label: value` list items (Q7 asks list items vs bare `Label: value` lines: bare lines join into one paragraph in Markdown viewers with strict line breaks, for example GitHub, and possibly in the closed PDF; not measured, Phase 0 item 2). Labels ignore case and extra spaces; unknown labels and columns are kept and ignored; Lab Kit never rewrites a line it did not write.
- **Format line** `Record format: 1` first. A note with no format line is read as format 1 (as the solution block's `acid-ph4-no-format.md` fixture); a newer number than Lab Kit knows is shown as it is and Close says "made by a newer Lab Kit: not checked".
- **Missing values**: every field is always written. `not recorded` = could not be read or nobody typed it; `none` = checked, nothing there (clean tree → Patch `none`, no container); `n/a` = does not apply (Q8 asks three words vs only `not recorded`). Never an empty value, never a dropped line or column.
- **Basis tags** (verifiable-claims practice): a statement a person or an agent wrote ends in `[decision · who]`, `[interpretation · who]` or, for a fact from a paper or a file, `[reported · source, page]`. Lines and rows the helper wrote need no tag: their basis is **reported by the helper**, and the `Record` column (sha256 of the run's record file) is the source. A number worked out from outputs goes in Results with basis `derived` and a derivation id (`D-nnn`: saved script, inputs, command; re-runnable). An earlier number whose script, inputs or environment were not kept gets Status `needs repeat` and is quoted only with that label. `who` is a person or `agent (model id)`, so an LLM-made statement is never read as the algorithm's or the owner's. Results Status follows the verifiable-claims statuses (`open`, `accepted`, `needs repeat`, `contradicted`, `superseded`); the review itself stays in the owner's claims tooling, not in Lab Kit.
- **Proposed by / Chosen by**: every parameter that was not fixed by the plan names who or what proposed it (plan, person, `agent (model id)`, helper default, library default) and who chose it. Q11 asks whether only agent-proposed parameters need a row.
- **Agent line**: tool, model id and version, the instruction file and its sha256, and the prompt's sha256 when an LLM or agent took part; `none` when nobody but people did; `not recorded` when nobody said (listed by Close).
- **Hashes**: sha256, lowercase hex. In tables the first 12 characters; the full 64 are in the per-run record file and the helper's run-table file (Q6). The `Record` column is the sha256 of that run's `run-record.md`, which holds every full hash, so the note pins every file through it.
- **Times**: ISO 8601 UTC with `Z`, whole seconds. Never local time (history H7).
- **One row per run attempt**: `Run ID` + `Try` is the key. A resumed run is a new row (`Try` 2, Status `ok, resumed from try 1`); a moved run is a resumed run on another `Machine` (history H6); each try has its own commit, clean flag and environment. A row is never deleted; a row that says `running` may be replaced by the final row of the same Run ID + Try.
- **Status words**: `running`, `ok`, `failed (exit N)`, `failed (ExceptionName)`, `killed (no end record)`, `ok, resumed from try N`, `skipped (reason)` (skipped is not failed).
- **Environments** are listed once each and referenced by id (`e1`, `e2`); the helper matches an environment by the sha256 of its environment lines (`Env fingerprint` in the per-run file).
- **Machine** is a label set once per machine (`LABRECORD_MACHINE=laptop`), never a host name (public repo rule; history H2 needs the machine, not its name).

### 1b. The per-run record file (`run-record.md`, written by the helper next to the run's outputs)
The same format with `Kind: run`, one run only, one label per line, every hash in full, the inputs table, and the full environment. Labels: Record format, Kind, Study ID, Run ID, Try, Resumed from, Machine, Scheduler job, Command, Working folder (relative), Repository, Commit, Clean tree, Patch, Untracked files, Seeds, Config, Language, Lock file, Package list, OS, Arch, BLAS, Threads, Workers, CPU cores, Container, Env fingerprint, Start (UTC), End (UTC), Status, Outputs, Log, Agent, Instructions, Prompt, Run by, Code state read (`at start` / `at end of run`), Verify, Helper (version and its own sha256). `outputs.sha256` is in `sha256sum` format, so `sha256sum -c outputs.sha256` re-checks the outputs with no Lab Kit and no helper.

### 1c. How Close fingerprints it
Nothing new is needed for the fingerprint: `closed_hash` is the SHA-256 of the whole note without `Status` and the `closed_*` lines (`src/close/mark.ts`), so it covers the Run record, every table row and therefore (through the `Record` and `Outputs` columns) every run's record file and output manifest. The PDF prints the section and the tables as text. A row added after closing makes the note show in "Closed lab notes edited after closing", which is correct: a run added after the close is an edit. The Alt+S merge warns before it adds rows to a closed note.

## 2. The effort-minimising flow

### (a) The record helper (owner only for now; language-neutral design, reference version in Python)
**Constraints:** one file; Python standard library only (an optional library such as `threadpoolctl` is used only if the experiment already has it loaded, never required); no network; no Obsidian; every probe wrapped so a missing tool gives `not recorded` and the run is never stopped or changed. The format is the contract; a port (R, Julia, shell) is correct when it writes the same fixture outputs.

**Calls:**
| Call | When | Writes |
|---|---|---|
| `record` (one line, the minimum) | last thing in the run | everything at once; `Code state read: at end of run` |
| `start` + `finish` (optional, two lines) | first and last thing; `finish` also in a `finally` / `trap` | code state read at start; a run killed before `finish` stays `running` and is found later |
| `table FOLDER` | after a batch, any machine | `run-table.md`: every `run-record.md` under the folder as rows (full hashes), sorted by Run ID + Try, plus the Environments table; `--stale HOURS` turns old `running` rows into `killed (no end record)` |
| `verify FOLDER` | any time, any machine | **writes nothing**: re-hashes the outputs against `outputs.sha256` and the record file against the hash in the note's row (given with `--record-sha256`); prints PASS / FAIL per file |
| Python API `labrecord.record(...)` or `with labrecord.run(...)` | inside a Python script | the same; reads `sys.argv` and `sys.executable`; an exception gives `failed (ExceptionName)` |
| `rerun FOLDER` (Q12, later) | to check a result again | runs the recorded command in a new temporary folder (never the original outputs) and compares hashes; bit-identical results across OS / BLAS are not expected (history H2), so it reports per file |

**What it reads** (each one `not recorded` when it cannot):
- Code: `git rev-parse HEAD`, `git status --porcelain`, `git diff HEAD --binary` → `run.patch` + its sha256 when dirty, untracked files with their sha256; the repo URL from `git remote get-url origin` with any user name or token stripped. No git or no repo → `not recorded` (Q2 (c): then it hashes the files named with `--code`).
- Command: `--command "$0 $*"` from a shell; the Python API reads `sys.argv`.
- Seeds: only what is passed in (`--seed name=value`, `--seed-rule "…"`); never guessed.
- Packages: the first lock file in the repo (`uv.lock`, `poetry.lock`, `requirements*.txt`, `environment.yml`, `renv.lock`, `Manifest.toml`, `package-lock.json`) with its sha256; the Python API also writes `packages.txt` from `importlib.metadata` (no pip call).
- OS / arch / language: `platform`; BLAS: `threadpoolctl` if already importable, else numpy's build config if numpy is loaded, else `not recorded`; threads: `OMP_NUM_THREADS`, `MKL_NUM_THREADS`, `OPENBLAS_NUM_THREADS`, `--threads`, `--workers`; cores: `os.cpu_count()`; container: `--container` or the usual container env vars, else `not recorded` (it cannot always tell "no container").
- Machine: `--machine` or `LABRECORD_MACHINE`. Scheduler job: read only if present, from optional env vars (`SLURM_JOB_ID`, `SLURM_ARRAY_TASK_ID`, `PBS_JOBID`, `LSB_JOBID`, `JOB_ID`), else `none`. Nothing else about a scheduler.
- Run by: `--by` or `LABRECORD_BY`. Agent: `--agent`, `--instructions FILE` (hashed), `--prompt-file FILE` (hashed) or `LABRECORD_AGENT`; an agent driving the run passes them, a person sets `LABRECORD_AGENT=none` once. Never the OS user name or host name.
- Inputs and outputs: sha256 of each `--input`; every file under `--out` into `outputs.sha256` (the log too).
- Times: UTC from the system clock.

**Where it lives (Q3):** (a, rec) in this repo outside every kit, `tools/labrecord/labrecord.py` (public-safe code, its own tests in `check.py`, never in `main.js` or a kit, so no user gets it; needs a `!/tools/` line in `.gitignore` after a check), and **copied into each experiment repo and committed**, so the commit pins the helper version and a cluster needs nothing installed. (b) the private `my_work/` folder (not public, but its tests are outside `check.py`). (c) its own small repo, later, if others want it. The run record names the helper's version and its own sha256 in every case.

**How a row reaches the note (Q4):**
- (a, rec) **Laptop with the vault on it:** `--note "<path to the study note>"` (or `LABRECORD_NOTE`) adds the row to the note's Run table and a new environment to Environments: it finds the `Run table` heading, adds the row after the last row (or replaces this Run ID + Try's `running` row), writes a temp file and renames it; nothing outside that section is touched; no section → it writes nothing to the note and says so. **Cluster or any machine without the vault:** each run writes only its own folder (no shared file, so parallel jobs never collide on a network disk); `table` builds `run-table.md`; the owner copies it into the vault and uses the Alt+S merge.
- (b) The helper never writes into the vault; rows always come in through `run-table.md` or a pasted block.
- (c) Always direct writes.
- Risk with (a): Obsidian has the note open while a script writes it. Phase 0 item 1 measures; if typed text can be lost, the recommendation becomes (b).

### (b) Alt+S snippet "In-silico record" (only when the setting is on)
A plugin snippet (`run: in-silico`, TypeScript, entry-window look; no Templater), listed in Alt+S only while **In-silico notes** is on. Two modes, chosen by the note:
- **No Run record yet → "Start the record"**. Asks only: **Plan ref** (optional; a picker over planning notes, or text), **Objective**, **Pass criterion** (who decided is filled from Run by), plus filled boxes for **Repository** (remembered from the last in-silico note) and **Study ID** (default: the note's number). Optional: **Who took part** (pills: people only / an agent too; with an agent: model id and the instruction file). Optional box: **Paste the helper's block or run table**: a helper block fills what it covers. Inserts the Run record with every field written (`not recorded` where empty), empty Parameters / Inputs / Environments / Run table / Results, and offers "Copy helper line" (the one line with this study's ID filled in).
- **Run record found → "Add runs"**. One box: paste a helper block or a `run-table.md`, or pick a `run-table.md` inside the vault. Shows what it will do ("4 new runs, 1 updated (running → ok), 1 new environment (e3), 0 conflicts"), then merges: new Run ID + Try rows appended, a `running` row replaced by its final row, new environments appended, nothing else changed. A row that differs from the one in the note (same Run ID + Try, both final) is listed as a conflict, not merged. Closed note → it says the note will show as edited after closing.
- **Remembers:** the last Repository and agent line in plugin data (empty defaults); Project comes from the note's `Project` property, not asked again.
- **Agents:** an agent driving the experiment does not need the window: it runs the helper with `--note` (laptop) or writes `run-table.md`; its own statements go into Results / Parameters with `[interpretation · agent (model id)]` or `Proposed by: agent (model id)`.

### (c) Close experiment: the record check (non-blocking; only when the setting is on)
For a note whose `Exp. Class` is `in silico` (either spelling) with a Run record section, the Close window adds a fold **Record check** with a count and one line per gap; the buttons stay `Close experiment` / `Cancel`. Listed (each with the field or row named):
- Study fields empty or `not recorded`: Objective, Pass criterion, Repository, Config, Seeds, Agent, Verdict (Plan ref, Run by, Deviations only when empty, since `none` is a valid answer).
- No Run table rows; a row with Status `running`; `not recorded` in a row's Commit, Clean, Env, Start, End, Outputs or Record.
- A row with Clean `no` and Patch `not recorded` (history H1); a row whose Env is not in Environments; an Inputs row with `not recorded` sha256.
- A Parameters row without Proposed by or Chosen by; a person- or agent-written line without a basis tag; a Results row with basis `derived` and no derivation id; a `needs repeat` row (listed as a reminder, not an error).
- `Record format` newer than this Lab Kit: one line "not checked".
On a phone the check is the same (pure text). Wording on the mock-up page; nothing ships until the owner approves it.

### (d) What Lab Kit can and cannot fill
| Field | Lab Kit (desktop and phone) | Helper (on the run machine) | Typed by the owner or the agent |
|---|---|---|---|
| Study ID, Repository (remembered), Project, format line, `not recorded` fill-ins | yes | Study ID passed in | no |
| Commit, clean tree, patch, untracked files | **no** (no `git`: the plugin rules forbid `child_process`, and a phone has no Node) | yes | no |
| Command, seeds, config hash | no | yes (seeds and command passed in) | the seed rule once |
| Language, packages, lock file, OS, arch, BLAS, threads, cores, container | no (Lab Kit's own machine is not the run's) | yes | no |
| Start / end UTC, status, exit code, scheduler job id | no | yes | no |
| Input / output sha256 | only for files inside the vault | yes | origin and licence of inputs (once per input) |
| Agent, instruction and prompt hashes | remembered agent line | yes, when passed in | which agent took part |
| Plan ref, Objective, Pass criterion, Deviations, Proposed / Chosen by, Verdict, Results, Result | picker for Plan ref | no | yes |
So the owner types three short answers per study at the start (plan ref, objective, criterion), the verdict and results at the end, and nothing per run.

### (e) Laptop, cluster, failed, resumed and moved runs
- **No Obsidian on the run machine:** the helper writes `run-record.md` next to the outputs and prints the same block; nothing depends on the vault.
- **Failed:** `finish` (or `record`) from a `finally` / `trap` writes `failed (exit N)` or `failed (ExceptionName)`; the outputs so far are hashed.
- **Killed** (time limit, power cut): with `start` + `finish`, the record still says `running`; `table --stale` marks it `killed (no end record)`; Close lists it. With `record` only, a killed run leaves no record at all: Close cannot see it (one reason to use `start` too; Q13).
- **Resumed / moved:** `--resume-from 1` makes Try 2 with `Resumed from: try 1 (machine, status)`; on another machine it is a moved run; each try records its own commit and environment (history H6).
- **Time:** UTC everywhere.
- **To find out about the cluster** (nothing assumed; the owner or IT answers): which Python versions exist (the helper needs 3.8 or newer: an assumption to check); is `git` on the compute nodes; is there a scheduler and which one (job id variable); are home and scratch disks shared between nodes and kept after a job; is there internet on compute nodes (the helper needs none); containers (Apptainer / Singularity) and how to read the image digest; how threads are set by default (`OMP_NUM_THREADS` from the scheduler?); time limits (for `--stale`); how files come back to the laptop (copy, sync, a group drive).

### (f) Migration
None. `in silico` is a new class; no note has a Run record; nothing is rewritten. With the setting off, nothing changes for anyone. The class value and the hazard header (`hideForClasses`) stay the BACKLOG item's questions 1-2.

## 3. Optimisation campaigns (draft; mirrors ideas from the owner's optimisation project, which has no built campaign format)
A campaign (fully automated, sequential human-in-the-loop, or batch human-in-the-loop optimisation) is a study note with more sections. Same rules: plain text, `Campaign format: 1` line, `not recorded` for gaps, basis tags, off by default. Links: BACKLOG "Optimisation campaign snippet" (kit snippet taken off the branch 2026-10-12) and "Wet-lab optimisation workflow" (a wet-lab campaign shares these sections). Not planned in phases yet: it needs its own owner answers (Q14).
| Section | Holds | Written by |
|---|---|---|
| `## Campaign` (frozen at start; `Definition sha256` of the definition file) | mode; search space (each input: type, range, step, fixed inputs); constraints; objectives with direction and how each is scored; thresholds and reference point **frozen at start, never recomputed from data**; budget and stopping rules; initial design size and rule; method (surrogate, kernel, acquisition, optimiser settings, library versions); seed rule (one run seed, a sub-seed per iteration / stream) | the campaign's own code (helper hashes the definition file); the person or agent chooses, tagged `[decision · who]` |
| `### Trials` (one row per trial) | Trial ID, Iteration / Batch, Source (`initial` / `suggested` / `manual`), Status (`proposed` / `running` / `complete` / `failed` / `abandoned` / `skipped (reason)`; a failed trial is never filled with a value), Requested inputs, Actual inputs (the model fits on actual), Proposed by, Chosen by, Edited (yes / no + reason), per-outcome status and values (results may arrive at different times), Start / End (UTC), Resumed (yes / no) | the campaign code via the helper's rows; proposed vs chosen vs edited and the reason by the person or agent |
| `### Model updates` (one row per refit) | Update ID, trial IDs that went in, trials pending at that moment, seed, model state hash, candidates requested vs returned | the campaign code (the helper hashes its checkpoint) |
| `### Events` (log) | every fallback, warning, rejected candidate (for example infeasible against a device limit), retry, abort: UTC time, trial or update ID, what happened; no silent fallbacks | the campaign code; a person adds notes tagged `[interpretation · who]` |
| `### Batches` (batch human-in-the-loop) | Batch ID, the full proposed batch, the subset run, why others were skipped (skipped is not failed), the order results came back, who approved and when | person or agent |
| `### Safety and instruments` (fully automated, wet lab) | safety limits and who set them, abort / retry rules, instrument ids, calibration state, a heartbeat / timestamp log joinable to sample codes | the platform code; limits as `[decision · who]` |
| LLM involvement (any section) | model id, prompt / instruction hash and text file, what it decided or edited, tagged `agent (model id)` so it is not read as the algorithm's | the agent, via the helper's `--agent` options |
Known failures in practice this must make visible: pending trials across batches not passed to the model; a first batch with fewer candidates than requested; incomplete rows silently dropped; identical start designs repeated across arms with the same seed; two harnesses disagreeing; reference points moving as data were added. Resume and audit: restart from a seed, or an atomic checkpoint after every round (data, round index, RNG states), each trial recording resumed yes / no. File exchange (candidates out and results back keyed by trial ID; JSON for machines, CSV for people) is a suggestion, not decided.

## 4. Phases (one Sonnet session each; helper first, owner only; plugin parts behind the setting)
### Phase 1 — The record helper (owner only, no plugin change)
- Depends on: Q2, Q3 (rec. assumed until answered).
- Files: `docs/in-silico-record-format.md` (the contract: sections, labels, columns, words, basis tags, hashes, times, version rule), `tools/labrecord/labrecord.py` (stdlib only; every probe behind one injectable `Probe`), `tools/labrecord/test_labrecord.py` (unittest), `scripts/check.py` runs it, `.gitignore` `!/tools/`, fixtures `tests/fixtures/in-silico/`.
- Tests: **fake repo state and environment** fixtures (`probe-*.json`: commit, porcelain lines, diff text, a remote URL with a token in it, env vars with and without a scheduler, platform strings, BLAS info, missing git, missing lock file, an agent with instruction file) → expected `run-record.md` byte for byte; one real temp git repo (clean, dirty, untracked, no git); a temp output folder (`verify` passes, then fails after one byte changes, and writes nothing: folder listing and mtimes equal before and after); privacy (no host name, user name or token in any output); a probe that raises gives `not recorded`, never a failed run.
- Done when: those tests; `record` / `start` / `finish` / `table` / `verify` / the Python API give the fixture outputs; `--note` changes only the Run table section of a fixture note; check PASS. The owner can use it from here on, with paste by hand.

### Phase 0 — Measure (no user-facing change; can run next to Phase 1)
- Files: this plan ("Phase 0 result"); a throwaway vault through `node scripts/obsidian-check.mjs`.
- Measures: (1) a process adding a row to an **open** note: does Obsidian reload, keep the cursor, lose typed text (editing and reading view; desktop; Sync not measurable here: say so); (2) `- Label: value` vs bare lines in reading view and in the closed-note PDF, strict line breaks on and off; (3) a 3,200-row run table: render time in reading view and live preview, Close hash time, PDF pages.
- Done when: written as measured / not measured; Q4, Q5, Q7 recommendations confirmed or changed.

### Phase 2 — The setting and the parser (pure)
- Depends on: Phases 0-1, Q6-Q8.
- Files: setting **In-silico notes** (off by default; `src/kit/paths.ts` data + the settings tab row; wording asked first), `src/insilico/record.ts` (`parseRecord(text)` → study fields with basis tags, parameters, inputs, environments, rows, results, unknown lines kept; `formatRow`, `formatEnv`, `mergeRows(existing, incoming)` → { added, updated, conflicts }), `tests/insilico-record.test.ts` on the Phase 1 fixtures (the helper's expected outputs are the parser's inputs).
- Done when: round trip byte for byte; merge cases (new row, running → ok, conflict, the same row twice = no change, unknown column kept); with the setting off no command, snippet or Close change is reachable (test); check PASS.

### Phase 3 — Alt+S "In-silico record"
- Depends on: Phase 2; the owner's look answers on the feedback page.
- Files: `src/insilico/snippet.ts` (two modes; pure edit plan + thin UI on the entry-window form), the snippet entry hidden unless the setting is on (`src/kit/snippet-menu.ts` / `snippet-run.ts`; a built-in entry like the methods, so no kit file reaches users with the setting off), plugin data `kit.inSilico.lastRepo` / `lastAgent`, tests (start on an empty note, merge from a pasted block, merge from a vault `run-table.md`, conflict, closed-note warning, `hasNode()` false).
- Done when: tests; obsidian-check desktop and `--mobile`; check PASS.

### Phase 4 — Close: the record check
- Depends on: Phase 2; wording approved.
- Files: `src/insilico/check.ts` (pure `recordGaps(parsed)`), `src/close/ui.ts` (the fold, only for in-silico notes with the setting on), tests (each gap on a fixture; a complete record gives no fold; the close still goes through; setting off = today's window byte for byte).
- Done when: tests; obsidian-check of the Close window on a fixture note with three gaps; check PASS.

### Phase 5 — Docs
- `docs/in-silico-record-format.md` final, a tutorial page "Recording an in-silico study" (the one line, laptop and cluster paths, `verify`, `sha256sum -c`), `docs/snippet-syntax.md`, `docs/changelog.md`, `docs/obsidian-test-checklist.md` rows, `docs/decisions.md` line, `docs/architecture.md` (`src/insilico/`, `tools/labrecord/`).

### Later — Optimisation campaign sections (section 3; after Q14)

## 5. Tests (across phases)
- Shared fixtures are the contract between the Python helper and the TypeScript parser; expected outputs are written by hand once and never regenerated from new code.
- Fake repo state and environment for every probe; saved old-format notes kept forever (`format 1`, no format line).
- Setting off = no change anywhere (tests in Phases 2-4).
- `hasNode()` false for every plugin path; known answers 0005 / 0011 untouched (no engine change).

## 6. Risks
- **A script writing an open note** (Q4 (a)): Obsidian may reload under the cursor or Sync may conflict. Phase 0 measures; fallback (b).
- **Big tables:** 3,200 rows may be slow in live preview and long in the PDF (Q5; Phase 0 item 3).
- **The record is only as good as the one line:** a run killed before `record` leaves nothing; `start` + `finish` closes that gap (Q13).
- **Unknown cluster:** an old Python, no git or a read-only home disk; every probe degrades to `not recorded`, and the list in 2(e) is what to find out first.
- **Basis tags typed by hand can be skipped:** Close lists untagged person- or agent-written lines; the snippet writes tags for what it asks.
- **Hash shortening** (12 characters in tables) is enough to spot a mix-up, not to prove integrity; the full hashes are in the per-run files the `Record` column pins.
- **Privacy:** remote URLs can hold a token, outputs can hold host names. The helper strips user info and never writes host or user names; a test checks it.
- **Parallel sessions** edit BACKLOG / decisions: Edit tool only, re-read first.

## 7. Out of scope
The class value, the hazard header and which wet-lab properties to drop (the BACKLOG item's questions 1-3); a datasets register; the claims register and its review (stay in the owner's verifiable-claims tooling; the note only carries ids and tags); Bases views for in-silico notes; shipping the helper to other users; any look (feedback page first).

## 8. Open questions (BACKLOG "In-silico experiments in the lab notebook"; rec. first)
- **Q1 Where do your runs happen?** ANSWERED (chat 2026-10-20): both a laptop and a cluster; the cluster is not known (list in 2(e)).
- **Q2 Do your run scripts live in a repo you control?** (asked in chat 2026-10-20, waiting) (a, rec) yes: the helper file is copied into each repo and committed / (b) some are someone else's code: a small wrapper in your repo calls theirs and the helper records their repo with `--repo PATH` / (c) some have no repo: Commit is `not recorded` and the helper hashes the script files instead.
- **Q3 Where the helper's master copy lives:** (a, rec) `tools/labrecord/` in this repo, outside every kit (tested, never shipped) / (b) private `my_work/` / (c) its own repo later.
- **Q4 How rows reach the note:** (a, rec) laptop: the helper adds the row to the note; cluster: `run-table.md` merged with Alt+S / (b) always through `run-table.md` or paste / (c) always direct.
- **Q5 Large studies (thousands of runs):** (a, rec) one row per run try in the note, if Phase 0 shows 3,200 rows stay usable / (b) one row per batch or cell in the note, every run in `run-table.md` linked from it.
- **Q6 Hashes in the note's tables:** (a, rec) the first 12 characters, full ones in the per-run files / (b) the full 64 everywhere (very wide tables).
- **Q7 Label lines (a look; see the page):** (a, rec) list items `- Commit: …` (one per line in every viewer and the PDF) / (b) bare `Commit: …` lines (can run together outside Obsidian).
- **Q8 Words for a gap:** (a, rec) `not recorded` (could not be read), `none` (checked, nothing there), `n/a` (does not apply) / (b) only `not recorded`.
- **Q9 Close's record check lists:** (a, rec) the list in 2(c) / (b) every `not recorded` / (c) only Commit, Clean tree, Agent and Verdict.
- **Q10 The looks on the page** (study note, Alt+S window in both modes, the Record check fold, the helper's printed block): (a) as drawn / (b) comment with pins on the feedback page.
- **Q11 Parameters table:** (a, rec) a row for every parameter not fixed by the plan / (b) only parameters an agent proposed.
- **Q12 Re-run check:** (a, rec) `verify` (re-hash, writes nothing) now; `rerun` into a temporary folder later / (b) both now / (c) `verify` only.
- **Q13 The minimum in the run code:** (a, rec) one line at the end (`record`), with `start` + `finish` recommended for cluster jobs that can be killed / (b) always two lines.
- **Q14 Optimisation campaigns (section 3):** (a, rec) after the study note is in use, as its own plan with the Wet-lab optimisation workflow / (b) now, in the same phases.
Still open from the research note (`in-silico-record-requirements.md` Q6; recommendation unchanged): large data outside the vault (path, sha256, origin only). Its Q3 (OS / BLAS: in Environments), Q7 (`needs repeat`) and Q8 (agent fields) are taken into this plan as recommended.
