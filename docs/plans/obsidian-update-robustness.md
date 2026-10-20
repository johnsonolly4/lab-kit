# Plan: robust to Obsidian updates (plugin-wide)

_Written 2026-10-19 by the orchestrator session. The owner asked for it: "make sure we're robust to Obsidian updates, plugin-wide". Audit and plan only: no code changed. The owner's example: when the core Bases kanban arrived (1.14.0), the community Bases board plugin broke, because it could not write the group filter that core now controls. Sources: Obsidian's changelog pages (1.0 to 1.14.4) and the obsidian-api CHANGELOG (to 1.7.2); the release notes of the plugins we depend on or mirror; a grep of `src/`, `styles.css`, `kits/` on `overnight/2026-10-19`._

## What we rely on, by risk

### High: breaks silently for the user, no error

| What we rely on | Where | Kind | What breaks if it changes | How we would notice today | Fix |
|---|---|---|---|---|---|
| **Callout colours set from an RGB triplet** (CORRECTED: low; kit notes with `cssclasses: vt` colour the icon with `rgb(var(--callout-color))` and work; only a kit callout type in a note without `vt` shows grey): `--callout-color: var(--vt-*-text)` where `--vt-*-text` is "29, 78, 216" | `kits/planning/.obsidian/snippets/vault-theme.css:55-62` | CSS contract | Obsidian 1.13.0 requires `--callout-color` to be a valid CSS colour, not an RGB triplet. The kit callouts (focus, projects, planning, lab, goto, overdue, summary, question) may already show without their colour on 1.13+ | Nobody has reported it; **check first** (obsidian-check, look at a callout's computed colour) | `--callout-color: rgb(var(--vt-*-text))`; a test that every `--callout-color` value is a colour |
| **Bases kanban markup**: `.bases-kanban-column`, `-card`, `-card-line`, `.bases-group-value`, `[data-property="note.done"]`, `data-view-name="Board"` | `src/planning/engine.ts` (tag, cardFile, onCardClick, MutationObserver, capture click), `src/kit/board-colours.ts:38-68`, `vault-theme.css` (about 37 rules, :281-443) | undocumented DOM | Column colours, carried-over amber, countdown and tag badges, the done circle on the built-in board; Status colours on the Lab book board. A renamed class turns them off; a changed click target can make the done circle tick twice or not at all | Nothing: no error, the board just looks plain | Board B (own Bases view) retires this for the To-do board. The Lab book board (Status columns) still uses it: give it the same own view, or accept plain columns as the fallback |
| **The `.base` files we ship**: `groupBy`, `groupOrder`, filters, the `kanban` view type | `kits/planning/00 Planning/To-do board.base`, `kits/lab/03 Lab Book/Lab book base.base`, `kits/lab/05 Chemicals/Chemical database.base` | file format core owns | Core changed this format several times: filter operators removed (1.9.4 `checkbox()`, 1.9.5 `String#icon()`, 1.9.8 `exists`), groupOrder must be a list (1.14.4), core took over grouping (1.14.0). A shipped base that no longer loads leaves an empty board | Only a user report | Never write `groupBy` / `groupOrder` from code (we don't today). A smoke test loads every shipped `.base` in the current Obsidian and counts rows. Keep Review update as the only path that rewrites them (as TaskNotes' "Update default base files") |
| **Templater internals**: `templaterCreateNote`, settings writes (templates folder, user scripts, folder templates, hotkeys) | `src/kit/obsidian-private.ts:54-140` | another plugin's private API | New to-do / lab entry / meeting stop making notes. Seen 2026-10-19: without Templater, New to-do closes on Enter and makes nothing, with no message. Templater's release notes carry no change notes, so we get no warning | User report | Feature-detect each function (most already do: `hasTemplater`, `templaterCreateNote` returns false); turn every false into a visible notice "Templater is needed for this"; Check setup row |

### Medium: visible breakage, or an error in the console

| What we rely on | Where | Kind | What breaks | Fix |
|---|---|---|---|---|
| Bases view API: `registerBasesView`, view options | `src/planning/board-view.ts:174` | public since 1.10.0, changed in 1.10.2 / 1.12.0 (`BaseOption.shouldHide` lost its config argument) | Board B fails to register or its options misbehave | Typings: `obsidian` npm package is pinned at 1.13.1 while minAppVersion is 1.14.0. Bump the types with each Obsidian release and read its CHANGELOG; `tsc` fails on removed signatures. The fallback kanban view stays in the `.base` |
| Obsidian's modal / prompt / setting classes: `.modal`, `.prompt`, `.modal-content`, `.setting-item` | `styles.css` (27 rules), `src/kit/window-look.ts`, `managed-ui.ts`, `tidy-ui.ts` | undocumented DOM | Corners, padding and sticky footers. Already bitten: pickers carry `.prompt`, not `.modal`; the phone rule zeroed `.vt-entry` padding (both fixed). The 1.9.13 and 1.11 mobile redesigns changed modal layout | Add our own class on every window we open (`cardWindow`, done for nine) and style only our classes; the smoke test measures one window per kind |
| Mermaid through MarkdownRenderer | `src/rig/render.ts` | bundled library | Mermaid moved 1.8.0, 1.13.0; a syntax change breaks the rig diagram | Rig fixture notes in the smoke test; the SVG rig figure does not depend on Mermaid |
| Electron APIs: `shell.openPath`, `webContents.printToPDF` (planned for Close experiment) | `src/kit/datafolder.ts`, I24 spike | Electron, through `nodeModule()` | Electron went 32 to 43 in two years; a changed print API breaks the PDF | Feature-check before use; a smoke step that prints the 0011 fixture after each Obsidian update |
| `app.metadataTypeManager` (sets `due`, `priority`, `deadline` types) | `kits/planning/Extras/Templates/To-do.md:74, 88`, `Project hub.md:8`, `src/kit/ui.ts:588` | private | Properties typed wrong (text instead of date or number) and sorting breaks; already wrapped in try / optional chaining | Move into one helper in obsidian-private.ts, called by the templates through the plugin |
| `app.plugins` read by a kit script | `kits/lab/Templates/Insert snippet.md:25` | private | Alt+S falls back to plain insertion (token templates unfilled) | The I23 plan (plugin-owned menu) removes it |
| CSS snippet manager and hotkey manager | `obsidian-private.ts:109-160` | private | Check setup's snippet and hotkey rows; Set suggested keys | Already feature-detected (`cssSnippetsSupported`, `hotkeysSupported`, `hotkeysWritable`) |

### Low

| What | Where | Note |
|---|---|---|
| `metadataCache.resolved` | `obsidian-private.ts:43` | 15 s fallback timer already covers it |
| `app.loadLocalStorage` / `saveLocalStorage` | `engine.ts:50`, `board-view.ts:50-51` | wrapped in try; 1.14.2 moved font size there, no change for us |
| CodeMirror `cm.coordsAtPos`, CSS Custom Highlight API, `scope.keys` | `entry-window.ts:17, 126`, `ask.ts:14` | optional chaining; worst case the window opens in the middle or the underline is missing |
| Capture-phase mousedown on the map pop-up | `plan-map-render.ts:418` | our own DOM |
| Frontmatter shapes: `tags`, `aliases`, `cssclasses` must be lists (1.9.10) | kit templates | ours already write lists; add a test |
| Deferred views (1.7.2) | none found (`getLeavesOfType` / casts not used) | keep it that way: `instanceof` before using `leaf.view` |

Counts: high 3, medium 7, low 7 (the callout row moved to low after the owner's check).

## What went wrong elsewhere (patterns)

1. **Core takes over a feature** (core kanban 1.14.0 and groupOrder; Bases 1.9.10; the Settings API). Never write configuration core now owns; keep our own view type name; follow the early-access (Insider) changelog.
2. **Undocumented class or variable renamed** (`--blur-translucency-*` to `--blur-opacity-*` 1.11.5; `--callout-color` format 1.13.0; Bases toolbar classes 1.10.4, 1.14.3). Smoke-test our selectors; give CSS variables fallbacks.
3. **API signature change** (setIcon 1.1.0, editorCallback 1.1.0, generateMarkdownLink 1.10.0, shouldHide 1.12.0). Keep the `obsidian` types current; `tsc` catches it.
4. **Lifecycle change** (deferred views 1.7.2). `instanceof` checks.
5. **Data format tightening** (frontmatter 1.4, list properties 1.9.10, Bases filter operators 1.9.x, groupOrder 1.14.4). Write through processFrontMatter; validate shipped `.base` files on each version.
6. **Bundled library upgrades** (Mermaid, MathJax / Temml, Electron 32 to 43). Fixture notes for each.
7. **Mobile redesigns** (1.7, 1.9.13, 1.11, 1.14.3). `obsidian-check --mobile` on each .0 release.
8. **Core disables known-broken plugin versions** (1.9.12). Watch store review notices.

How other plugins stay robust (from their release notes): raise minAppVersion when adopting a new API (TaskNotes, Meta Bind); accept both old and new config shapes (TaskNotes reads kanban options under `options:` or `config:`); an explicit "update default base files" command instead of silent rewrites (TaskNotes); escape generated `.base` content (TaskNotes); hide UI when a core plugin is off (Notebook Navigator); beta or canary builds before the store (TaskNotes, Meta Bind, ZotLit). No plugin's notes showed runtime version gates; not checked in their source.

## Safety nets (proposed; nothing built)

| # | Net | Files | Check | Size |
|---|---|---|---|---|
| S1 (BUILT 2026-10-20) | **Smoke run**: `node scripts/obsidian-check.mjs smoke` builds, opens a seeded vault, loads every shipped `.base` (row counts), the Home tiles, a plan map, a calc fixture (0011 = 1.7591), a rig note, one window of each kind, checks every selector in S2 exists and that callouts have a colour, then repeats with `--mobile`; prints PASS / FAIL per step and console errors | `scripts/obsidian-check.mjs`, `tests/fixtures/smoke-vault/` | runs green on 1.14.4 today | M |
| S2 (BUILT 2026-10-20) | **Inventory of Obsidian internals** as data: `scripts/obsidian-internals.json` (selector or member, file, risk); a test fails when `src/` or the kits use a `.bases-*` / `.modal*` / `app.<private>` not listed | `scripts/`, `tests/obsidian-internals.test.ts` | the test lists today's set and passes | S |
| S3 | **One isolation layer**: every private member read through `obsidian-private.ts` (move `metadataTypeManager`, the remaining casts), each with a feature check and a soft-fail notice | `src/kit/obsidian-private.ts`, callers | S2's test shows no private use outside it | M |
| S4 | **Fix the callout colours** (high row 1) if the check confirms it | `vault-theme.css` | computed `--callout-color` is a colour; screenshot | S |
| S5 | **Typings and versions**: bump `obsidian` types to the newest release, read its CHANGELOG at each bump; README / changelog line "tested up to Obsidian x.y"; minAppVersion moves only at `/release` | `package.json`, `README.md` | `tsc` passes | S |
| S6 (BUILT 2026-10-20, by hand until S1 exists) | **Update routine**: when Obsidian releases (or an Insider build is out), run S1 on it, read the changelog sections Plugins / API / Bases / mobile, and add any finding to BACKLOG | `docs/maintenance.md` | a checklist row | S |
| S7 | **Beta track** (optional): pre-release builds through BRAT before the store | `.github/workflows/release.yml` | a pre-release tag builds | M |

Order: S4 check first (a likely live bug), then S2, S1, S3, S5, S6; S7 only if you want it.

## Questions for the owner

- R1 Run the smoke test on Obsidian's early-access (Insider / Catalyst) builds too? (a, rec) yes, in a separate throwaway install, when one is out; (b) only on public releases.
- R2 How often? (a, rec) on each Obsidian release and before each Lab Kit release; (b) weekly; (c) only before Lab Kit releases.
- R3 The Lab book board (Status columns) still uses the built-in kanban plus our colouring by DOM. (a, rec) give it the same own view as the To-do board later; (b) drop our colouring there (plain columns, nothing to break); (c) leave as is.
- R4 Retire the built-in kanban fallback view in the To-do board once Board B is proven? (a, rec) keep it as the second view, unstyled; (b) remove it.
- R5 A beta track (BRAT pre-releases before the store)? (a) yes; (b, rec) not now, few users.

R1-R5 are answered (`docs/decisions.md`, 2026-10-19: smoke test on public releases only, own Lab book view later, built-in kanban kept as an unstyled fallback, no beta track).

## Status of the safety nets (2026-10-20, overnight side session)
| Net | Status | What is needed |
|---|---|---|
| S1 smoke run | **BUILT 2026-10-20** (owner chat decision: order S5, S3, S1): `scripts/smoke.mjs` (seed writer, steps, report; `obsidian-check.mjs smoke` calls it) and `tests/smoke.test.ts`. The seed is written by the script (no `tests/fixtures/smoke-vault/`). What it checks, the result and what it does not cover: `docs/maintenance.md` "The smoke run (S1)". Real run, macOS, Obsidian 1.14.4, Lab Kit 1.4.1: desktop 18 PASS, 0 FAIL, 3 NOTE; phone emulation 18 PASS, 0 FAIL, 3 NOTE; no console errors; about 35 s per mode. The NOTEs: New lab entry and New chemical need Templater (not in the throwaway vault); the Alt+S picker still shows a close X because `.lk-snip .modal-close-button` (`styles.css:454`) targets a class 1.14.4 no longer draws (BACKLOG). Old plan text: | Steps: build, start a seeded vault, install both kits, load each shipped `.base` and count rows, open Home / plan map / the 0011 calc note (1.7591) / a rig note, open one window of each kind, check each class in `scripts/obsidian-internals.json` exists in the DOM, check every `--callout-color` is a colour, repeat `--mobile`, print PASS / FAIL per step plus console errors. `scripts/make-stress-vault.mjs` and the eval helpers used for `docs/plans/stress-test-result.md` are a starting point. |
| S2 inventory | **BUILT** (`scripts/obsidian-internals.json`, `tests/obsidian-internals.test.ts`) | Listed: 22 classes, 6 private `app` members, 2 files with casts. Not covered: members read through a cast with another variable name than `app`, and `.vt-*` own classes. |
| S3 one isolation layer | **BUILT 2026-10-20** (`src/kit/obsidian-private.ts`, `src/kit/ui.ts`, `kits/planning/Extras/Templates/To-do.md`, `Project hub.md`, `scripts/obsidian-internals.json`, `tests/property-types.test.ts`) | `metadataTypeManager` is now read only in `obsidian-private.ts` (`assignedType`, `ensurePropertyType`, `setPropertyType`). The plugin sets `window.vtEnsureType(name, type)` at start (same pattern as `window.vtEntryLab`); the To-do and Project hub templates call it instead of `app.metadataTypeManager`, and New chemical (`makeClassAList` in `ui.ts`) uses `ensurePropertyType`. Behaviour kept: sets the type unless the manager reports it already right (in 1.14.4 there is no `getAssignedType`, so it is set each time, as before); an older Lab Kit without the function leaves the property as text. The S2 inventory lost the `src/kit/ui.ts` cast entry and the template files from `metadataTypeManager`. Seen in a throwaway Obsidian 1.14.4: `window.vtEnsureType` exists, `due` became `date` and `priority` `number` in `types.json`; the templates themselves were not run (Templater is not in the throwaway vault). Not done: a visible notice on each soft fail (would be new user-facing text, so it stays as it was: silent); the remaining private reads (`app.commands`, `app.setting`, `app.vault.getConfig`, `metadataCache.resolved`) were already inside `obsidian-private.ts`; `kits/lab/Templates/Insert snippet.md` still reads `app.commands` (the Alt+S template, to go with the full Templater removal). |
| S4 callout colours | **plan waiting for owner** (a look change: BACKLOG "Callout colours outside kit notes" says ask first) | `--callout-color: rgb(var(--vt-*-text))` in `kits/planning/.obsidian/snippets/vault-theme.css:55-63` and `color: var(--callout-color)` at line 151; before / after feedback page; a test that every `--callout-color` value is a colour. |
| S5 typings and versions | **BUILT 2026-10-20** (`package.json`, `package-lock.json`) | `obsidian` types 1.13.1 to 1.14.4 (newest on npm; matches minAppVersion 1.14.0 line and the version obsidian-check ran on). The new typings pin peers, so `@codemirror/state` 6.5.0 to 6.7.6 and `@codemirror/view` 6.38.6 to 6.43.13 moved with them (both are esbuild externals, dev-only). `tsc` reported 0 type errors; `python3 scripts/check.py --build` passes. README "tested up to" line is not added: it belongs to the release changelog step in `docs/maintenance.md`. |
| S6 update routine | **BUILT** (`docs/maintenance.md`, "When Obsidian releases") | Uses the S1 smoke run since 2026-10-20. |
| S7 beta track | not wanted now (R5 b) | |
