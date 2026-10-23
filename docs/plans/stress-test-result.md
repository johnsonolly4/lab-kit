# Stress test on a big synthetic vault (N7, Part 1)

_Run 2026-10-20 on `overnight/2026-10-19`, by a side session while the owner slept. Measured numbers are from one run each unless a count is given; no repeats beyond those. Nothing in `src/` was changed._

## Setup
- Vault: `node scripts/make-stress-vault.mjs <dir>` (new; made-up names, deterministic): 2000 lab notes (2 `calc` blocks each, `lab-header`, Chemicals links), 3000 to-dos (half dated, 35 % done, 70 % in one of 12 projects, some with due / priority / meeting), 300 chemical notes, 200 meetings in 4 series, 12 project hubs = 5519 notes (22 MB). Plus the kit's Home, To-do board, Lab book base, Chemical database base and Meetings / Projects overview copied in, and both kits installed through the plugin (`KitManaged.plan` / `apply`).
- Project A got an `after` chain over its 175 to-dos (chains of 8) and a hub page with `project-plan`, `project-map`, `project-todos`.
- Driver: `obsidian-check` (separate hidden Obsidian 1.14.4, macOS, 8 GB Mac, the owner's own Obsidian also running), timings taken inside the window with `performance.now()` through `eval`. "Settled" = rendered text and element count unchanged for 400 ms, measured from the open call.

## Measured (one line each)
| What | Result |
|---|---|
| Obsidian + vault + plugin start (`obsidian-check start --no-build`, wall clock, vault already built, metadata cache cold) | 7 s, plugin loaded, 0 console errors; 5519 files all cached |
| Reload of the window (cache warm), until Lab Kit and the planning engine are up | about 1.4 s after navigation start (reading `performance.now()` at the first reply; 5551 resolved-link entries) |
| Plugin `enablePlugin` (onload) with both kits on, 3 runs | 31 ms, 7 ms, 6 ms |
| Kit `plan()` / `apply()` on first install, lab / planning | 10 / 119 ms, 9 / 107 ms |
| Home page (`00 Home.md`, 5 tiles, 2000 experiments, 460 open to-dos this week) | opened 80 ms, settled 250 ms (cold); 54 ms (warm) |
| Home refresh after one to-do's `done` changed | 577 ms until the page text changed |
| Lab note with 2 calc blocks (1000.md), reading view / source view | settled 81 ms / 66 ms; values correct (rt table 1.2412, 0.2482, 0.1241, 0.08275) |
| Project hub with plan, plan map (175 to-dos, 350 cards, 385 SVG elements) and to-do list | settled 151 ms cold |
| To-do board (`To-do board.base`, 3000 to-dos, 11 901 elements) | settled 324 ms; 296 ms second time; board refresh after one `done` change 256 ms |
| Lab book base (2000 notes, grouped by Status) / Chemical database base (300) | settled 132 ms / 113 ms |
| Projects overview | settled 80 ms |
| Check setup window | 55 ms to open |
| Tidy up notes (scan of all 5519 notes, planning kit on, window opens when the scan is done) | 828 ms and 775 ms (two runs); the window text is 11 511 characters long |
| Kit files window (Review update…) | 36 ms |
| Alt+S menu (`lab-kit:insert-snippet` from a lab note in source view) | 35, 25, 24 ms to open and settle |
| Memory | JS heap 59-69 MB; the test Obsidian process 173 MB resident (at the end) |

Nothing is over 2 s, so no performance item went to BACKLOG. The slowest are the board (0.3 s), Tidy up notes (0.8 s) and the Home refresh after a tick (0.6 s).

## Not measured
- Phone (`--mobile`), and any real touch.
- A first start with no metadata cache and with the vault on a synced / network drive; Windows and Linux.
- A single note with many calc blocks (50+) or a very large calc table; only 2 small blocks per note were timed.
- A dense plan (several hundred cards in one project, deep `after` chains) beyond 175; a plan map after a drag.
- Typing in a large note, and scrolling the board with thousands of cards (only the render time).
- Console errors after the window reload (the error hook of obsidian-check is lost on reload); before the reload: none.
- Dataview-based kit notes (Dataview not installed in the throwaway vault), Templater and other community plugins.
- Plan-map build and Tidy scan as separate unit timings; only the whole feature was timed in Obsidian.
- Repeats: single runs, so numbers can vary by tens of percent.

## Findings
- The Home page prints `Folder "00 Inbox" not found` because the throwaway vault has no inbox folder (the generator does not make one). Not a bug.
- Tidy up notes still reads every note when the planning kit is on (`src/kit/tidy.ts` `wantsText`, `todoQueries`; BACKLOG notes it): measured 0.8 s for 5.5k notes, so fine at this size; worth re-measuring if a vault passes about 20 000 notes.
