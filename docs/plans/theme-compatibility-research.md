# Research: theme compatibility and a Lab Kit look for Obsidian's own menus

_Written 2026-10-20 by a research side session (Opus). The owner asked (owner board 2, 2026-10-20): "think about making Lab Kit theme-compatible, and maybe making our own theme so that all Obsidian menus follow the Lab Kit aesthetic instead of the default". Research and plan only: no plugin code, no look decided. Related: BACKLOG "Theme compatibility / own theme", "One look app-wide, still theme-friendly", "Callout colours outside kit notes" (S4 in `docs/plans/obsidian-update-robustness.md`)._

How the facts were got
- **Measured** in a throwaway Obsidian 1.14.4 (macOS desktop, dark mode, `node scripts/obsidian-check.mjs`, never the owner's vault), with Minimal installed into that vault for the comparison.
- **Counted** from the published CSS of nine popular themes, the plugins the kits use and Obsidian 1.14.4's own `app.css`, by saved scripts (derivations D-001 to D-006).
- **Read** on web pages (docs.obsidian.md, obsidian.md changelog and help, the themes' and plugins' GitHub pages), paraphrased. A page summary is not a full read; these are marked "web".
- Ids in square brackets are claims in the private evidence folder `my_work/analyses/theme-compat/provenance/` (claims.csv, scripts, outputs). They are **unreviewed**: the owner runs `/claims-review` when wanted. A sentence ending "(interpretation)" is a reading of the facts, not a fact.

## 1. The facts in five lines
1. Obsidian 1.14.4 gives almost every surface its own CSS variables: Settings groups (`--setting-*`, 16), menus (`--menu-*`, 11), modals (`--modal-*`, 15), the command palette and pickers (`--prompt-*`, 9), buttons (28), inputs (20), toggles (12), callouts (27), tables (39), Bases (77), tooltips (10), the status bar (7), the ribbon (4) [D-005]. Only some have a page in the official variable reference (no page for menus, prompts, tooltips, Settings or Bases) [C-004].
2. The order is fixed: Obsidian's `app.css`, then each plugin's `styles.css`, then the theme, then the CSS snippets (measured) [C-020]. So a theme beats Lab Kit's `styles.css` at equal specificity, and a kit snippet beats the theme.
3. The popular themes are mostly variables plus many selectors; none of the nine mentions Lab Kit; they style some plugins by name (Dataview, the Kanban plugin, Excalidraw, Tasks), none styles Meta Bind, only Blue Topaz mentions Notebook Navigator [D-003].
4. Three of the nine (AnuPpuccin, Primary, Sanctum), none pushed since 2024, still write callout colours as `r, g, b`, the format Obsidian 1.13 stopped accepting: the same bug as Lab Kit's S4 [D-003, D-006, C-008]. That is what an unmaintained theme costs (interpretation).
5. Lab Kit's own `styles.css` already reads Obsidian's variables (444 uses of 88 variables), so a theme recolours Lab Kit's windows; its corners are fixed (14 / 10 / 6 px) while Obsidian's change by platform (macOS modals 24 px, Windows and Linux 12 px, phone touch radii) [D-004, D-005, C-021].

## 2. Popular themes: what they restyle

Ranks and counts from Obsidian's theme download stats, 2026-10-20 (1465 themes) [D-001]; last push from GitHub [D-006]; the rest from each theme's published CSS [D-003]. "Hits" counts selectors that name that surface; it shows where a theme reaches past variables, not how it looks (nothing here was seen on screen except Minimal's corners and colours in section 5).

| Theme (rank, downloads) | Last push | Size, rules, `!important` | Settings / menus / modals / pickers hits | Callouts / tables / Bases hits | Style Settings | Plugins named in its CSS | Callout colour format |
|---|---|---|---|---|---|---|---|
| Obsidian default | (1.14.4) | 1177 variables, 4135 rules [D-005] | uses its own variables everywhere | 391 Bases selectors | no | none | a CSS colour, mixed with `color-mix` |
| Minimal (1, 2.71 M) | 2026-10-06 | 258 KB, 955, 49 | 46 / 7 / 17 / 8 | 6 / 279 / 26 | yes | Dataview, Kanban, Tasks, Excalidraw | ok |
| Things (2, 1.36 M) | 2026-10-17 | 67 KB, 173, 34 | 0 / 0 / 2 / 1 | 0 / 0 / 0 | yes | Kanban, Tasks, Templater, Outliner | ok (sets none) |
| AnuPpuccin (3, 1.23 M) | 2024-12-01, on hiatus [C-010] | 361 KB, 1096, 56 | 230 / 3 / 20 / 5 | 222 / 313 / 0 | yes, "controls most features" [C-010] | Kanban (352), Dataview, Excalidraw, Tasks, Editing Toolbar | old `r, g, b` (11) |
| Blue Topaz (4, 1.05 M) | 2026-08-15 | 1237 KB, 3352, 959 | 154 / 13 / 67 / 32 | 590 / 235 / 50 | yes | Kanban, Tasks, Dataview, Excalidraw, Notebook Navigator, Templater, Outliner, Editing Toolbar | ok |
| Atom (6, 0.57 M) | 2026-03-30 | 9 KB, 42, 29 | 0 / 0 / 0 / 0 | 0 / 0 / 0 | no | none | ok (sets none) |
| Primary (13, 0.37 M) | 2024-10-21 | 1678 KB, 1034, 2 | 69 / 23 / 41 / 43 (buttons 200) | 46 / 8 / 0 | yes | Kanban, Tasks | old `r, g, b` (27) |
| Catppuccin (15, 0.35 M) | 2026-10-16 | 2287 KB, 439, 44 | 33 / 0 / 2 / 27 | 27 / 0 / 0 | yes | Omnisearch, Dataview, Tasks | ok |
| Border (17, 0.32 M) | 2026-10-06 | 367 KB, 756, 176 | 198 / 3 / 5 / 15 (toggle variables 24) | 16 / 9 / 0 | yes, "highly recommended" [C-011] | Kanban, Tasks, Excalidraw, Editing Toolbar | ok (sets none) |
| Sanctum (20, 0.29 M) | 2024-08-04 | 410 KB, 961, 0 | 16 / 3 / 4 / 10 | 186 / 160 / 0 | yes | Kanban, Dataview, Excalidraw, Tasks | old `r, g, b` (13) |

What the table says (interpretation)
- **Two styles.** Small themes (Atom, Things) mostly set variables and leave Obsidian's layout alone. Big themes (Minimal, Blue Topaz, Border, AnuPpuccin, Primary) also restyle the Settings window, tables and callouts by selector. Minimal adds its own short palette (`--bg1`, `--ui1`, `--tx1`, `--ax1`) and maps Obsidian's variables onto it [D-003 counts; palette names read in its CSS], so one change recolours everything.
- **Robustness.** Obsidian's theme guidelines say to prefer variables, keep selectors simple because class names and nesting change between versions, avoid `!important`, and load nothing from the network [C-002]. Minimal's README says it "may break with future updates" because it changes large parts of the interface [C-009]. The callout row above shows it happening. Blue Topaz still has an opt-in loading picture from a remote site [D-003], which the guideline asks themes not to do.
- **Bases.** Only Minimal and Blue Topaz restyle Bases (12 and 28 `--bases-*` variables) [D-003]; the others leave Obsidian's own Bases look, which itself reads 77 variables [D-005].
- **Plugins.** Themes reach a plugin's UI two ways: for free, when the plugin uses Obsidian's variables, and by name, with rules for the plugin's classes. Only the most used plugins get rules by name (Kanban, Dataview, Tasks, Excalidraw).

## 3. The plugins the kits use

The list is `SETUP_PLUGINS` and `CORE_PLUGINS` in `src/kit/setup-check.ts` (what Check setup shows). Counts from each plugin's latest release `styles.css` [D-004], phone support from its `manifest.json` [D-002]. "Literal colours" counts declarations with a `#hex` / `rgb(n…)` value, fallbacks inside `var(--x, #hex)` included.

| Plugin (kit, needed?) | Downloads | Obsidian variables used (distinct) | Own variables | Literal colours | Does a theme restyle it? | What a theme would add | Phone |
|---|---|---|---|---|---|---|---|
| Templater (lab, needed) | 5.96 M | 19 (13) | 0 | 18, all fallbacks of `--code-*` | Yes: its prompts are Obsidian pickers and modals (interpretation from its 31-rule CSS); the template editor's colours follow `--code-*` | nothing | yes |
| Bases (core; lab kit, and the planning kit's to-do board) | core | 77 own variables in `app.css` [D-005] | | | Through `--bases-*`; Minimal and Blue Topaz do | `--bases-*`; Lab Kit's kanban colours are by DOM class (robustness plan, high row 2) | yes |
| Dataview (planning, needed) | 5.17 M | 15 (8) | 0 | 0 | Yes; Minimal, Blue Topaz, AnuPpuccin, Sanctum add `.dataview` rules | table and list rules only if wanted | yes |
| Meta Bind (planning, needed) | 0.58 M | 135 (36) | 12 | 4 (transparent) | Yes through variables; buttons are Obsidian buttons (interpretation); no theme of the nine names it | none; Lab Kit's snippet already restyles `.mb-button` in kit notes | yes |
| Notebook Navigator (planning, needed) | 1.07 M | 416 (96) | 292 (`--nn-theme-*`) | 56 | Partly: its defaults point at Obsidian variables, so a theme's colours carry over; a full match sets `--nn-theme-*` [C-012]; it ships a Style Settings section and phone-only variables [C-012] | `--nn-theme-*` values that resolve to colours | yes |
| Omnisearch (planning, needed) | 2.02 M | 8 (4) | 0 | 2 (fallbacks) | Yes (Obsidian modal); Catppuccin names it | `--omnisearch-highlight-color` | yes |
| Force note view mode (planning, needed) | 0.08 M | no `styles.css` in its release | | | no UI to style | nothing | yes |
| ZotLit (planning, optional) | 0.08 M | 207 (90) | 82 (Tailwind-built) | 22 | Mostly through variables | its own classes for full control | **no** (desktop only) |
| Advanced Tables (lab, optional) | 3.29 M | 12 (10) | 1 | 0 | yes | nothing | yes |
| Outliner (planning, optional) | 1.46 M | 7 (5) | 0 | 0 | yes | nothing | yes |
| Editing Toolbar (planning, optional) | 2.06 M | 326 (68) | 6 | 10 (shadows) | Yes; AnuPpuccin, Blue Topaz, Border name it | its toolbar classes | yes, has phone rules |
| CSS Editor (planning, optional) | 0.09 M | 6 (6) | 2 | 0 | yes | nothing | yes |
| Advanced Canvas (planning, optional) | 0.93 M | 48 (23) | 4 | 0 | Through canvas variables | nothing | yes |

"Does a theme restyle it" is read from the CSS, not seen on screen for any plugin.

## 4. How plugins and kits stay theme-compatible (the guidance)
- **Plugins:** use CSS classes, never inline styles, so themes and snippets can change the look; use Obsidian's CSS variables; make your own variables when none fits [C-001, C-003]. Lab Kit's rules already say this (`.claude/rules/obsidian-plugin.md`).
- **Themes and snippets:** set general variables on `body` and colours under `.theme-light` / `.theme-dark`; `:root` with caution [C-002, C-005]. Platform and screen classes on `body` (`.mod-macos`, `.is-mobile`, `.is-phone`) change Obsidian's own values: on macOS `.mod-macos` sets `--modal-radius` to 24 px and `--input-radius` to 8 px; on phones `.is-phone .modal-container` sets the modal radius on the window's own container [D-005, measured C-021]. A rule on plain `body` loses to those; a phone rule set on `.modal-container` cannot be beaten from `body` at all (interpretation of the cascade).
- **Shared tokens:** some surfaces read a general token, not their own variable: menu rows use `--radius-s`, the command palette uses `--radius-l` [D-005]. A variables-only change to those also changes every other user of the token (callouts, checkboxes); to change menu rows alone needs one selector (interpretation).
- **Store review:** a plugin release gets a CSS lint of `styles.css` (the owner's screenshot of the 1.4.0 review: warnings for `:has` and a partly supported property; BACKLOG, "USER RESULT 2026-10-15 ... CSS lint") [C-015]. A theme gets an automatic review on submission at community.obsidian.md; it needs a GitHub repo, README, LICENSE, a 512 x 288 screenshot, `manifest.json` and `theme.css` attached to a release whose tag is the version [C-006]. Not found: any rule on whether a plugin may restyle Obsidian's own UI from its `styles.css`, or ship or switch a theme. Lab Kit's store-reviewed releases already carry kit CSS snippets (tag 1.4.0 has `vault-theme.css` in the planning kit and `scrolling-mermaid.css` in the lab kit), bundled in `main.js` and written to the vault only after the user confirms; no review note about them is recorded in BACKLOG.
- **Updates:** themes do not update by themselves; the user presses Check for updates in Appearance [C-007]. Lab Kit's kit snippets update through the plugin's own Review update, with the plugin.
- **One theme at a time:** Obsidian keeps one current theme name (`customCss.theme` is a single name, measured) [C-020]; snippets add on top, any number.
- **Style Settings** (a community plugin) reads `/* @settings */` blocks from snippets, themes and plugins' CSS; a plugin must trigger `parse-style-settings` on load [C-013]. Notebook Navigator uses it [C-012].

### Lab Kit today
- **Plugin `styles.css`** (always on): Lab Kit's own windows, menus, chips, boards, calc tables. Obsidian variables throughout [D-004]; the four corner sizes from `docs/design-standard.md`; no `!important`. Fixed colours remain in two places: calc cell highlights (`styles.css:31-40`, blue / orange / red tints and `#9a5b00`, `#b3261e` text) and the hazard chips (`styles.css:153-170`, level colours with `#1e1e1e` text) [D-004]. The calc ones do not follow dark mode or a theme; the hazard ones are meanings (interpretation).
- **Kit snippets** (planning kit, `enableCss` in `kits/planning/kit-manifest.json:68-71`): `vault-colours.css` holds every colour (palette as `r, g, b`, text shades per `.theme-dark` / `.theme-light`, meanings, dials); `vault-theme.css` only reads them. Installed into `.obsidian/snippets/` and switched on after the user confirms; Check setup has a CSS snippets row; Review update brings new versions.
- **What `vault-theme.css` styles:** every note (1200 px line width, line height 1.7, heading colours by level, the cursor line tint, link colours: `vault-theme.css:27-51`), the kit callout types (`:55-63`), `[!columns]`, status badges, the `vt` card look for kit notes (callouts as cards, Meta Bind buttons as outlined boxes, `:129-195`), sticky Tabbed tabs, the homepage, project cards, the Bases kanban colours by DOM class (`:272-451`) and the text-box picker (`:456`).
- **Where it falls short** (interpretation, each from the lines named):
  1. It does not touch Obsidian's own Settings, menus, modals, pickers, tooltips or toggles at all, so "all menus follow the Lab Kit look" is not covered today.
  2. Its every-note rules (`:27-51`) override the user's theme in notes that are not kit notes: line width, heading and link colours. That is the one place Lab Kit fights a user's theme now.
  3. Callout colours are `r, g, b` triplets (`:55-63`), not colours since 1.13: grey outside `vt` notes (S4).
  4. 53 `!important` [D-004], against the theme guideline; a user's own snippet has to use `!important` too to win.
  5. The palette is fixed (blue, purple, amber, green, slate, red); it does not take the theme's accent.
  6. Only the planning kit ships it; a lab-kit-only vault gets none of it.
  7. The kanban part depends on undocumented Bases classes (robustness plan, high row 2).

## 5. Measured: Lab Kit under the default theme and under Minimal
Throwaway Obsidian 1.14.4, macOS, dark mode [C-020, C-021]:

| Surface | Default theme | Minimal |
|---|---|---|
| Lab Kit Check setup window corner | 14 px | 14 px |
| Its background | `rgb(28, 28, 28)` (the theme's) | `rgb(38, 38, 38)` (the theme's) |
| A button inside it | 8 px, `rgb(51, 51, 51)` | 8 px, translucent grey |
| Obsidian's modal corner (`--modal-radius`) | 24 px (macOS) | 24 px |
| Command palette corner | 12 px | 12 px |
| Menu corner (`--menu-radius`) | 8 px | 8 px |
| Settings group corner (`--setting-items-radius`) | 12 px | 12 px |

So Lab Kit's windows already take a theme's colours but keep their own corners, and the buttons inside them keep the theme's (8 px, not the standard's 10). Not measured: light mode, Windows, Linux, a phone, other themes.

## 6. Options

| | What | Covers | Effort | Risks |
|---|---|---|---|---|
| **A** Variables only, nothing new | Keep `styles.css` on Obsidian variables; turn the calc cell tints into theme colours (`--color-blue` etc. through `color-mix`); do S4 | Lab Kit's own pieces follow any theme | S | Obsidian's menus and Settings keep the theme's look: the owner's "all menus" wish is not met |
| **B** Improve the kit snippet | (1) Fix `vault-theme.css`: S4, fewer `!important`, every-note rules moved behind `vt` or a switch. (2) A new **opt-in** snippet (working name `lab-kit-look.css`, off by default) that sets Obsidian's own variables to the design standard: `--modal-radius`, `--menu-radius`, `--setting-items-radius`, `--button-radius`, `--input-radius`, `--tooltip-radius`, `--prompt-*`, plus a few named selectors only where a surface reads a shared token (menu rows, the command palette). Shipped by both kits, a Check setup row, updated by Review update. Optionally a Style Settings block for the dials | Obsidian's Settings groups, menus, modals, pickers, buttons, inputs and tooltips get Lab Kit's corners (and, if chosen, the accent); colours stay the theme's unless the owner picks more | M (about 1 day plus a feedback page round) | Overrides the user's theme corners when on (so off by default, and Check setup says so); several variable names are undocumented (S2 inventory and the smoke run should list them); phone radii set on `.modal-container` stay Obsidian's |
| **C** Own theme | A "Lab Kit" theme in its own public repo, listed in the store: `theme.css` built variables-first, covering Settings, menus, modals, pickers, buttons, toggles, callouts, tables, Bases, tooltips, status bar, ribbon, plus Notebook Navigator (`--nn-theme-*`), Meta Bind and Dataview | The whole app in one look, also in vaults without Lab Kit | L to start (repo, release pipeline, screenshots, store submission, light and dark, phone); then an S6 pass per Obsidian release | Replaces whatever theme the user has (one at a time): someone who likes Minimal must choose; fixes reach users only when they press Check for updates; a second public repo to keep free of personal data; the callout row in section 2 shows what an unmaintained theme becomes |
| **D** Both | B now; C later only if B is not enough | | B, then L | both sets |

What none of them may do (owner's rules): fight the user's own theme without asking (opt-in only, off by default); change a look without the owner's choice on a feedback page; break the design standard or the approved pictures (`my_work/reference_visual/README.md`; no picture there yet of Obsidian's own Settings or menus); read the owner's real vault (all checks in throwaway vaults); use private APIs to switch themes (`app.customCss.setTheme` is private; Lab Kit would only tell the user where to choose it).

Maintenance per Obsidian release (all options): the S6 routine (`docs/maintenance.md`) already reads the changelog sections for themes and runs the smoke run. Add for B: the smoke run turns the look snippet on and checks the computed corners of one modal, one menu, one picker and one Settings group (one step). For C: the same on the theme, in light and dark, plus the store release.

## 7. Recommendation (interpretation; the owner decides)
**B**, with A's colour fixes folded in, and C not now.
- It meets the wish (Obsidian's menus, modals, pickers and Settings groups in the Lab Kit corners) without taking away the user's theme: a snippet sits on top of any theme, and is off until they turn it on.
- It reuses what exists: kit snippets, Review update, Check setup's snippet row, the smoke run. Fixes arrive with the plugin, not with a separate Check for updates.
- It stays robust because it is mostly variables; the few selectors it needs are listed in the S2 inventory.
- C can follow if, after living with B, the owner wants colours and layout changed app-wide; B's variable set is the core of that theme anyway.
- Do S4 (the callout colour fix) in the same round: it is needed under every option.

Phases if B is chosen (each needs the owner's look answer first): 1) fix `vault-theme.css` (S4, `!important`, every-note rules) with before / after renders; 2) the opt-in look snippet, both kits, Check setup row, smoke step; 3) calc cell tints from theme colours; 4) optional Style Settings block. Check each with the default theme and two popular themes (e.g. Minimal, Things) in light and dark through obsidian-check, and on phone emulation.

## 8. Questions for the owner
In BACKLOG "Questions for the owner" as "Theme compatibility / own theme" (TC1-TC7), with a feedback page: `my_work/mockups/theme-options.html` (private; made-up content; the same Lab Kit screens under three looks).

## 9. What could not be confirmed
- Whether store review accepts a plugin that styles Obsidian's own UI from its `styles.css`, or ships a theme (no rule found either way).
- How any theme looks on screen with Lab Kit, except Minimal's corners and colours in dark mode on macOS (section 5). No light mode, Windows, Linux or phone measurement.
- How each plugin looks under each theme: section 3 is read from the CSS.
- That Templater's prompts and Omnisearch's window are Obsidian's own modal classes (read from their small CSS, not from their code).
- The full 1.14 list of new theme variables: the changelog names only the prefixes (`--tooltip-`, `--notice-`, `--hotkey`, `--tab-inner-`, `--tab-container-`) [C-014].
- A current, official download ranking page: the counts come from Obsidian's stats file, not a page that ranks them.
