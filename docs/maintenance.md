# Doc-sync table: after a change, update these

Claude: check this table at the end of every session (routine step 2).

| If you changed… | Also update |
|---|---|
| Any file in `kits/` | Run `npm run kit:manifest` (`tests/managed.test.ts` fails on a stale sha256) |
| The formula engine (`src/calc/`) | A test against `tests/fixtures/` (known answers in `CLAUDE.md`) |
| Anything user-visible (feature, setting, snippet, wording) | `docs/changelog.md` under "Unreleased" |
| Settings (`src/kit/ui.ts`, `src/kit/paths.ts`) | `README.md` → Settings, `docs/tutorial.md` |
| A snippet or form (`kits/lab/Extras/scripts/templater/`) | `docs/tutorial.md` snippet table, `docs/obsidian-test-checklist.md` |
| A feature that needs a look inside Obsidian | `docs/obsidian-test-checklist.md`, and `BACKLOG.md` → Not yet tested |
| A folder or entry file added, moved or removed | `docs/architecture.md` |
| A command in `package.json` | `CLAUDE.md` → Commands, `README.md` → Development |
| A kit manifest's `templater` / `enableCss`, or the plugin list in `src/kit/setup-check.ts` | Nothing by hand: `npm run starter` regenerates the new-vault starter; `tests/starter.test.ts` fails on drift |
| A folder default in `src/kit/paths.ts` | `README.md` → Folder contract |
| A new use of an Obsidian class (`.bases-*`, `.modal*`, `.prompt*`, `.setting-item*`), an `app.<member>` its typings lack, or a cast of `app` / `vault` / `metadataCache` | An entry in `scripts/obsidian-internals.json` (`tests/obsidian-internals.test.ts` fails until it is there) |
| The version | Nothing by hand: only `/release` moves it |
| A user test result (chat, screenshot, feedback note) | `BACKLOG.md`: tick what it confirms (date + source), add what is broken; STATUS → Now alone is not enough |
| A decision (method, scope, rule) | One line in `docs/decisions.md` |

Never copy code into docs. Link to the file instead: copies drift.

## When Obsidian releases a new version (S6 of `docs/plans/obsidian-update-robustness.md`)
Owner's choice (2026-10-19, R1/R2): public releases only, on each Obsidian release and before each Lab Kit release.

- [ ] Read the new release's changelog sections Plugins, API, Bases and mobile (Obsidian's release notes; the `obsidian-api` CHANGELOG). Add each finding to `BACKLOG.md` with its version.
- [ ] Update Obsidian, then `python3 scripts/check.py --build`, and look at what `scripts/obsidian-internals.json` lists for that release (every class and private member we use; the test keeps the list true).
- [ ] Run the smoke run on the new version: `node scripts/smoke.mjs` (or `node scripts/obsidian-check.mjs smoke`; `--no-mobile`, `--no-build`). It builds, opens a small seeded synthetic vault in a throwaway Obsidian, installs both kits through the plugin and prints PASS / FAIL / NOTE per step, desktop then phone emulation; it exits 1 on any FAIL. Say before it starts (a window flashes for a second). See "The smoke run" below for what it checks and does not. A FAIL is a finding: BACKLOG with the Obsidian version. A NOTE is a known gap or a finding that needs the owner.
- [ ] Note in the changelog (and the README once S5 adds its "tested up to Obsidian x.y" line) which Obsidian version it was tested on (only measured versions). `minAppVersion` moves only at `/release`.
- [ ] Update `docs/plans/obsidian-update-robustness.md` if the release changes a row (a renamed class, a removed private member).

## The smoke run (S1)
`scripts/smoke.mjs` (also `node scripts/obsidian-check.mjs smoke`), built on `scripts/obsidian-check.mjs`. The seeded vault is written by the script itself (22 synthetic files: 8 lab notes in the Lab book board's statuses with 0011 among them, 4 chemicals, a project hub with 5 to-dos in a chain, a meeting, a rig note, a callout note); the kits bring Home, the three `.base` files and the templates. `tests/smoke.test.ts` tests the seed and the report format; the run itself needs Obsidian.

| Step (desktop, then again with phone emulation) | PASS means |
|---|---|
| start | built, plugin loaded, no console errors at start (phone: emulation on) |
| install both kits | both kits applied through the plugin (as a first install, the empty folders too); Home and the three `.base` files exist |
| each shipped `.base` | a `.bases-view` draws and shows the seed's rows (board 5 cards on desktop, at least 1 on a phone; Lab book board 4 or more cards and 3 or more columns, since Bases draws only the columns in view; Chemical database 4 or more rows) |
| Home | 5 or more Lab Kit blocks, no "planning kit is off", no "folder not found" |
| plan map | `.vt-plan` with its cards and ticks |
| calc note 0011 | rendered text has `Reactor volume 1.7591` |
| rig note | the rig diagram draws an SVG with no problem list (Obsidian 1.14 asks once per vault "Display Mermaid diagrams in this vault?"; the run allows it in the throwaway vault and says so) |
| kit callouts | each of the 8 kit callout types looks different from Obsidian's default callout (background or icon colour), in a note with `cssclasses: vt` |
| windows | Check setup, Review, Manage, Alt+S, What's new open, are at least 100 x 50, sit inside the screen, and close on Escape. New lab entry and New chemical need Templater (not in the throwaway vault): the run reports NOTE with the notice text |
| Alt+S picker has no close X | NOTE while it shows one (see BACKLOG) |
| command palette | `.prompt`, input and results draw |
| S2 classes | every class in `scripts/obsidian-internals.json` was seen in the DOM at some point of the run; FAIL only for the names in `MUST_SEE` (`bases-view`, `bases-kanban-column`, `bases-kanban-card`), the rest are listed as "not drawn in this run" |
| console errors | `[]` over the whole run |

Not covered: Windows and Linux (macOS only; the script's other paths are untested), a real phone (emulation only: no touch, keyboard or Sync), Templater-driven flows (New to-do, New lab entry, New chemical, snippet token fill), the Lab book board's Closed column and other columns off screen, board drag and drop, Print / PDF of Close experiment, Obsidian early-access builds (R1: public releases only), light theme (the throwaway vault is dark), every `.setting-item` look (Settings tab not opened), and how anything looks (it measures sizes and classes, not pictures). One run takes about 35 s per mode (measured 2026-10-20 on an 8 GB Mac); run it alone, not next to another throwaway Obsidian.
