# Research: what an in-silico lab note must record to be reproducible

_Research only, 2026-10-20. Nothing built, no code changed. Asked by the owner (chat, 2026-10-20) for the `in silico` Exp. Class: BACKLOG "In-silico experiments in the lab notebook"._

## Sources

Every finding below comes from the owner's own history, read on 2026-10-20 (read-only):

- **[OPT]** The owner's optimisation project (a Bayesian-optimisation platform with a multi-machine benchmarking study of 3,200 simulated runs on three computers). Its public docs, the study spec, the study script, and the owner's private maths review of that study. The review has a "recipe to recreate the study", an environment table, a determinism table and a 21-run rerun check.
- **[S]** The archived Claude sessions in that project: 8 sessions, all on 2026-10-19. Two were read: the methods review and the repo-split advice. The other six are about agent tooling (searched, not relevant).
- **[P]** The owner's follow-up project (the clean rebuild). Its session gave a field list and the formats already in use there, relayed by the coordinating session.

Tags: **reported** = read in that file or section today; **(interpretation)** = this document's reading. The numbers are from private files. No claims register exists in this repo, so the rows are not registered (see "Not verified").

## What went wrong in the owner's history

| # | What happened | Basis |
|---|---|---|
| H1 | One machine ran 461 of the 3,200 runs with an **uncommitted local edit**. It let that machine's PyTorch build pass the version check. Every result still records the study's commit, because the commit is written once into the plan, not read per run. The exact diff was never saved, and is only recoverable if that machine's clone still exists. | reported [OPT] review Part 3 item 6; recipe §7; study script `run_cell` record, `git_state()` |
| H2 | A rerun of 21 stored runs on the study Mac was bit-identical for that Mac's own 7 runs and for **0 of 14** runs from the other two operating systems. 6 of the 14 diverged by 0.2–1.4 % in hypervolume, and 2 stopped at a different point (19 → 28, 22 → 34 experiments). Cause: a different BLAS library per OS. Threads were the only control (`torch.set_num_threads(2)`). | reported [OPT] recipe §8 table; review risks |
| H3 | **Python version and BLAS were not recorded per run.** Linux: unknown. macOS: inferred afterwards from the installed Python. Windows: from a file collected later. | reported [OPT] recipe §7 |
| H4 | The macOS study environment (venv), its coordinator state and its log were **deleted** after the study. The Linux log was never collected, so its resumes cannot be counted. | reported [OPT] recipe §7, §8 |
| H5 | The version check compared only 3 packages (ax-platform, botorch, torch). Package versions were written once, at set-up. The torch build string on one machine changed after the study ("2.14.0" recorded, "2.14.0+cpu" found later), and nobody knows when. | reported [OPT] recipe §7 |
| H6 | 25 runs were **started on one machine and finished on another** (released mid-run with their checkpoint). 6 more began under the pilot commit and finished under the study commit. A run record holds one machine and one commit. | reported [OPT] recipe §8, §9 notes |
| H7 | Start times were stored in **machine-local time with no time zone**. | reported [OPT] recipe §7 "Run window" |
| H8 | The pilot's exact command line was **not in the shell history**. It had to be inferred from the pilot's config matching the defaults. | reported [OPT] recipe §9 note 1 |
| H9 | The spec said 10 seeds per cell; the study ran 5. That was disclosed in the report text but not in the plan record. | reported [OPT] review Part 3 item 4 |
| H10 | The rerun script and its report were first left in a session scratchpad, "not committed". They were saved into the project only later the same day. | reported [OPT] recipe §8 last line; evidence-scripts README |
| H11 | The four earlier studies keep their raw results in a git-ignored folder on one PC. Only the report says where. | reported [OPT] benchmarking report, last line |
| H12 | Found missing in the follow-up project: the repo commit (nothing had been committed yet); a lockfile; hashes of large untracked inputs; which language version produced a number; library seed streams; results from an earlier session with no saved script (labelled "needs repeat"); config files edited after the run; who proposed a parameter versus who chose it. | reported [P], relayed 2026-10-20 |

What worked and should be kept:
- A fixed-commit worktree per study.
- One settings file (`config.json`) per study with the code commit and package versions.
- A refusal to start on a dirty checkout at set-up time (`--init`).
- Every random draw keyed by the run's identity, with exact seed formulas, so run order and worker count do not matter.
- Checkpoints that round-trip exactly.
- A results file per run id.

Basis: reported [OPT] spec, recipe §2.4, §8, §9.

**How runs were identified** (reported [OPT] recipe §2.4, §10): a run id built from its factors, `<dataset>.k<objectives>.<algorithm>.s<start size>.b<batch>.seed<s>`. Each run's result is `results/<run id>.json` on a results branch. The study is identified by the plan file and the results-branch commit the report was built from. One lab note per run is impossible at this scale (interpretation). The note has to identify the **study**, and point to a manifest that lists the runs.

## What must be recorded

| What must be recorded | Why: the failure it prevents | Where it can come from automatically |
|---|---|---|
| Code repository and **exact commit**, read at run time per run | H1, H6; [P] "nothing had been committed" | `git rev-parse HEAD`, written by the run script into its manifest |
| **Clean tree or not**, and if not the diff (saved as a file, with its sha256) | H1: the edit was never recorded | `git status --porcelain`; `git diff > run.patch`. The runner refuses a dirty tree for production runs |
| **Full config as a file** (not described in prose), with its sha256; edits after the run are not allowed | H8, H9; [P] "config edited after the run" | the run config file the script reads; `sha256sum` |
| The **command line** exactly as typed | H8 | the script records `sys.argv` |
| **Every seed** and how sub-seeds are derived (formula or library call) | Without it the paired design cannot be rebuilt; [P] seed streams | the config file, plus the seed table in the method doc; the manifest records the master seed |
| Each **input file**: path, sha256, origin, licence, version | H11; [P] untracked large inputs | `sha256sum`; a datasets register (id, name, source, location, sha256, licence, origin, status, date) |
| **Environment**: language version, the lockfile and its sha256, all package versions (not only three), OS, CPU architecture, **BLAS library**, container image digest if any | H2, H3, H5 | `python --version`; `pip freeze` / `uv pip freeze`; `numpy.show_config()`; `torch.__config__.show()`; `platform.platform()`, `platform.machine()`; the image digest |
| **Hardware and parallelism**: machine label (not a hostname), cores, memory, threads per worker, worker count | H2, H6: results depend on OS and BLAS, and timings on the load | `os.cpu_count()`; the script's own thread and worker settings |
| **Start and end time in UTC** (or with the zone), and wall time | H7 | the script writes ISO 8601 UTC times |
| **Where outputs live**: folder plus a manifest of output files with sha256 | H4, H11: deleted or local-only results | output folder listing, `sha256sum` per file, and one sha256 of the manifest |
| **Logs** kept with the outputs, not in a home folder | H4 | the script writes its log into the output folder |
| **Failed, aborted, resumed and moved runs**, each with its reason | H6, H4: resumes could not be counted | the coordinator or job scheduler: exit codes, job ids, resume events |
| **The plan or decision it implements** (id and date), the pre-declared pass criterion, and any **deviations** from the plan | H9 | typed by the owner; the plan id from the planning kit |
| **Who ran it**: the person, and the agent or model if one ran it; who proposed each parameter versus who chose it | [P] | typed, or from the agent's own record |
| **Analysis scripts saved in the project**, with their sha256, the command and the result each produced | H10; [P] "earlier session, no saved script → needs repeat" | a derivation record: id, claim, script, input sha256, command, environment, commit, agent, method sha256, output, output sha256, start/end UTC (format already used in the follow-up project) |
| **Result summary**, pass or fail against the criterion | Says what the run showed without rerunning it | typed by the owner; numbers linked to the derivation ids |

Reading (interpretation): almost everything in the table can be written by the **experiment's own run script**, at run time, into one manifest file next to the outputs. Lab Kit should **link to and copy** that record, not try to work it out afterwards. On mobile Lab Kit cannot run `git` or `pip` (no Node). A note written days later cannot know the tree was clean at run time.

## Minimal field list for an in-silico lab note

### Front matter (short, filterable in Bases)

| Property | Example / note |
|---|---|
| `Exp. Class` | `in silico` (both spellings accepted, see BACKLOG Q2) |
| `Status`, `Plan date`, `Exp. Start`, `closed_on` | as in wet-lab notes (`closed_on` replaces `Exp. End`, owner 2026-10-20) |
| `Objective`, `Outcome`, `Result` | as in wet-lab notes (`Result` per the lab-notes-board plan Q2) |
| `Project` | link to the hub (lab-notes-board plan Q1) |
| `Plan ref` | the plan or decision id this run implements |
| `Repo` | repository name or URL (no local path) |
| `Commit` | full commit hash |
| `Clean tree` | `yes` / `no` (if `no`, the record names the patch file) |
| `Run ID` | the study's or run's id |
| `Record` | link to the manifest file (`run.json`) |

### One recoverable plain-text block

A fenced code block (for example ```` ```run-record ````) holding YAML. It reads as plain text even without the plugin, survives copy-paste and export, and can be hashed by Close experiment. Proposed content:

```yaml
run_id: <study or run id>
command: <exact command line>
config: { path: <relative path>, sha256: <hash> }
seeds: { master: <n>, derivation: "<formula or 'see method doc §'>" }
inputs:
  - { id: <dataset id>, path: <path or store>, sha256: <hash>, origin: <source>, licence: <licence> }
environment:
  language: <Python 3.x.y>
  lockfile: { path: <file>, sha256: <hash> }
  packages: <file with the full freeze, or the key ones>
  os: <OS and version>
  arch: <arm64 / x86_64>
  blas: <Accelerate / OpenBLAS x.y / MKL>
  container: <image digest or none>
hardware: { machine: <label, not hostname>, cores: <n>, threads: <n>, workers: <n> }
time: { start_utc: <ISO 8601>, end_utc: <ISO 8601>, wall: <h:mm> }
outputs: { folder: <path or store>, manifest: <file>, manifest_sha256: <hash> }
runs: { planned: <n>, finished: <n>, failed: <n>, resumed: <n>, moved: <n> }
dirty_patch: <file + sha256, or none>
run_by: <person>; agent: <agent and model, or none>
criterion: <pre-declared pass criterion>; verdict: <pass / fail / partly>
deviations: <what differed from the plan, or none>
```

### Mapping the follow-up project's list (a–k) to these fields

| [P] item | Field | Lab Kit could fill it automatically? |
|---|---|---|
| (a) repo, commit, clean tree | `Repo`, `Commit`, `Clean tree`, `dirty_patch` | Copy from the manifest (any platform). Desktop only: run `git` itself (needs Node; not on mobile). |
| (b) config as a file | `config` | Hash it, if the file is inside the vault (Web Crypto, any platform). Outside the vault: copy the hash from the manifest. |
| (c) seeds and sub-seeds | `seeds` | Copy from the manifest; the formula is typed once |
| (d) inputs: path, sha256, licence, origin | `inputs` | Copy from the manifest or a datasets register; hash vault files itself |
| (e) environment, lockfile, OS/arch, container | `environment` | Copy from the manifest only (Lab Kit's own environment is not the run's) |
| (f) hardware, threads, wall time | `hardware`, `time` | Copy from the manifest |
| (g) command line | `command` | Copy from the manifest |
| (h) outputs: path and sha256 | `outputs` | Copy the manifest hash; re-hash at Close if the files are in the vault |
| (i) date, who or which agent | `time`, `run_by`, `agent` | Date: yes. Person: from settings (empty default). Agent: typed |
| (j) plan or decision id | `Plan ref` | A picker over planning-kit notes (later) |
| (k) result and pass/fail | `Result`, `verdict` | Typed; Close experiment could refuse an empty verdict |
| Derivation record CSV, datasets register, claims register | linked from the note, not copied | Linking: yes. A per-task manifest for many-task cluster runs is not built in [P] yet |

## What a wet-lab note records that this one does not need

- Hazards and the hazard header. They are already hidden for `in-silico` through `hideForClasses`.
- `Chemicals`, `CoSHH`, `RA`.
- Reactor volume, `Rig`, apparatus.
- Sample codes in the lab sense, unless the run models or is linked to a real sample. Then add a link, not a sample code.
- The template's "Apparatus" heading becomes "Environment" (the block above). "Procedure" becomes "Method and command".

The owner confirms each of these in BACKLOG Q3.

## Open questions (recommended option first)

1. **Where does the record come from?**
   - (a, rec) The experiment's run script writes `run.json` next to its outputs. An Alt+S snippet "Insert run record" reads that file and writes the front matter and the block.
   - (b) The owner fills a form by hand.
   - (c) Lab Kit runs `git` and `pip` itself. This is desktop only, and it records Lab Kit's environment, not the run's.
2. **One note per what?**
   - (a, rec) One note per study or campaign, with one manifest per run listed in the record. 3,200 run notes are not practical.
   - (b) One note per run.
3. **Machine and OS:** the owner said on 2026-10-12 that a "machine / cluster row" was not needed. The history (H2) shows results changed with OS and BLAS.
   - (a, rec) OS, arch, BLAS and threads go in the block, filled from the manifest, but not as front matter.
   - (b) Leave them out.
4. **Output hashes:**
   - (a, rec) One sha256 of the output manifest, which lists every file with its own hash.
   - (b) Every file's hash in the note.
   - (c) None.
5. **Close experiment for `in silico`:**
   - (a, rec) Close warns when `Commit`, `Clean tree`, the config hash or the verdict is empty, or when `Clean tree: no` has no patch. It still lets you close.
   - (b) Close refuses.
   - (c) No checks.
6. **Large data outside the vault:**
   - (a, rec) Record the path or store, sha256 and origin; never copy the data into the vault.
   - (b) Copy small inputs into the note's data folder.
7. **Earlier results without a saved script:**
   - (a, rec) A `needs repeat` value for `Result`, quoted only with that label (as in the owner's verifiable-claims practice).
   - (b) No special value.
8. **Agent runs:**
   - (a, rec) `agent` names the tool and model. A "proposed by / chosen by" line is written for each parameter that an agent suggested.
   - (b) `run_by` only.

## Not verified / left out

- None of the numbers above is registered in a claims register. This repo has no `provenance/` folder, and setting one up is out of scope for a research note. They are quoted from the owner's private review files, read on 2026-10-20.
- Six archived sessions in the optimisation project were found by search but not read in full. Their titles and snippets are about agent tooling, not experiments. Sessions before 2026-10-19 (when the study ran, late September) are not in the session list, so the study's own run-time sessions could not be read.
- The follow-up project's list (H12, items a–k) was relayed by the coordinating session; its files were not read here.
- Deliberately left out as private: project and repository names, machine names and host labels, home-folder paths, the private dataset ids, commit hashes of the private study, the university and cluster name, and the cloud-folder paths named in the sessions.
