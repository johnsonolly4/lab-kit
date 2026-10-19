# Plan: a simpler Alt+S snippet menu (roadmap I23)

_Written 2026-10-19 (plan step I23-PLAN, Opus, from the code; nothing built). AGREED 2026-10-19 by the owner (BACKLOG "Questions for the owner", I23): the menu and its search states as in `my_work/reference_visual/alts-menu-grouped.png`; (a) 1 groups as listed; (b) icons move into each snippet's `icon:` header line by a Tidy rule, changed later with **Change icon…** (right-click a snippet in the menu → the existing icon picker; a kit snippet is copied first with Make my own copy); (c) 1 group toggles hide in the menu only; (d) staged: Alt+S becomes a Lab Kit command now, Templater still runs the code snippets until Phase 6, full Templater removal decided from `docs/plans/templater-spike.md`; (e) 1 phone path without Templater, last; (f) open (Solution prep is redesigned as a live block, BACKLOG "Live solution block"); (g) 1 Recent = last 3; (h) the wording in "New strings" is kept; the old NMR / GPC / DLS files go to the trash only through a Tidy rule the owner runs. Each phase = one session, Sonnet._

## Phase 1 as built (re-cut 2026-10-19, N1, after the answers)
- **Command** `lab-kit:insert-snippet` ("Insert snippet", no default hotkey). It needs Templater for now (the code snippets and the form are Templater user scripts): the command runs the kit's `Insert snippet.md` through Templater (`templaterInsert` in `src/kit/obsidian-private.ts`, the one private call), so every snippet runs exactly as before. Without Templater: notice `Insert snippet needs Templater until snippets run in Lab Kit (Check setup says how to install it).`
- **The menu**: `Insert snippet.md` asks the plugin for the menu (`plugin.snippets.menu(items)`) and falls back to `labPick.js` (old plugin or none). So the old Templater hotkey and the new command open the same menu.
- **Recent**: the last 3 picks (`kit.snippetRecent`, keyed by the snippet's name), newest first, shown only while the search box is empty, pruned when a snippet is gone.
- **Icons**: until Phase 5 the Snippet icons settings page still wins over the header (`kit.snippetIcons`, as `labPick.js` does). Change icon… comes with Phase 5.
- **Check hotkeys / Hotkeys note**: Alt+S is suggested for `Lab Kit: Insert snippet`; a vault whose Alt+S is still on the Templater template counts as set ("Set on Templater: …, which opens the same menu."), never a clash to fix.
- Built 2026-10-19 (N1): `src/kit/snippet-menu.ts` (pure), `snippet-menu-ui.ts`, `SnippetTemplates.menu`, `templaterInsert`, `cursorAnchor` (`entry-window.ts`), `.lk-snip-*` in `styles.css`; tests `tests/snippet-menu.test.ts`, `hotkey-check.test.ts`. Checked in a throwaway Obsidian with Templater (obsidian-check): menu under the cursor, groups, search `gp`, Sample list inserted, Recent on reopen, light and dark; no console errors. Not seen by the owner.
- Not in Phase 1 (unchanged): what any snippet inserts, the forms (`labForm.js`), the stub files `07`–`09`, the group toggles, the Snippet icons page.

## Goal
Alt+S opens one Lab Kit menu in the entry-window look, grouped and recently-used first, whose forms look the same; every snippet is either a **method** or a **calculator**, and nothing needs Templater user scripts unless the owner wants to keep that path.

## What is there today (read 2026-10-19)
- Menu: `kits/lab/Templates/Insert snippet.md` (Templater template, Alt+S hotkey) lists the `Snippets` folder in file-name order, then Methods-folder notes (`labMethods.js:158` `menuEntries`, built-ins left out because stub files exist), and shows them with `labPick.js` (a flat `SuggestModal`, search on name + desc).
- Three kinds: 7 code snippets (`labSnippets.js` keys `solution`, `recipe`, `raft`, `nmr`, `gpc`, `dls`, `results`, each called from a `<%* … %>` stub file `01`–`03`, `07`–`10`), 7 token templates (`04`–`06`, `11`–`14`, header + `{{tokens}}`, filled by `src/kit/snippet-run.ts`), and Methods-folder notes (`method:<key>`).
- NMR, GPC, DLS twice: stub files `07`–`09` and the built-ins in `labMethods.js:100` (`builtins`).
- Forms: `labForm.js` (Obsidian `Modal` + `Setting` rows, the theme's corners; BACKLOG "Shape pass Phase 4 AUDIT" item 1 left open).
- Four Templater scripts: `labForm.js`, `labPick.js`, `labSnippets.js`, `labMethods.js`.
- Settings in four places: Settings → Lab Kit → **Snippet icons** page (`src/kit/ui.ts:309`, `kit.snippetIcons`, read by `labPick.js:12`), **Methods folder** (`ui.ts:278`), **Only suggest chemicals of the asked class** (`ui.ts:305`), and one **Use** toggle per snippet in Manage files (`optional` in `kits/lab/kit-manifest.json`).
- Alt+S is a Templater hotkey (`src/kit/hotkey-check.ts:18`, "Templater: Insert snippet"). On a phone that has not synced Templater's user-script folder every code snippet fails ("Lab snippets need Templater → User script functions folder…", `labSnippets.js:373`).

## Decision proposed (owner to confirm, questions I23 a–h)
1. The plugin owns the menu and the form, in the entry-window look (`src/planning/entry-window.ts`, `.vt-entry` in `styles.css:438`; approved look `entry-window-under-selection.webp`). The scripts stay as the snippet code.
2. Two kinds only. A **calculator** is a note in `Snippets` with a header; a header with `fields` is filled from tokens as today, a header with `run: <key>` runs that key of `labSnippets.js`. A **method** is a Methods-folder note or a built-in (NMR, GPC, DLS); the menu lists the built-ins itself, so stubs `07`–`09` go.
3. Every header may carry `group:`; one toggle per group in settings hides that group in the menu.
4. A snippet's icon comes from its header only; the Snippet icons page goes.
- Rejected: rewriting Solution prep / Recipe / RAFT / Combined results as token templates (BACKLOG "Could every snippet be a plain-text token template?": the token language lacks row arithmetic and per-item lookups); keeping `labPick.js` and only adding headings (the flat `SuggestModal` cannot do the look).

## Out of scope
- New snippets or changes to what any snippet inserts (the inserted text stays byte for byte; tests guard it).
- The calc engine (no engine change: the known answers 0005 RAFT Mn = 19990.14 and 0011 reactor volume = 1.7591 mL are re-run as a guard only).
- Combined results auto-refresh and the cross-note rollup (separate BACKLOG items).
- Deleting any user file. Retired kit files stay in the vault (`manifest.removed`, `planRetired` in `src/kit/managed.ts:444`).

## New strings (exact; all wait for the owner, question I23 h)
| Where | Text |
|---|---|
| Command (palette) | `Insert snippet` (id `lab-kit:insert-snippet`) |
| Menu heading | `Insert snippet` |
| Search box placeholder | `Search snippets…` |
| Section headings | `Recent`, `Make up`, `Samples`, `Characterise`, `Flow`, `Tables`, `My snippets` |
| Menu hint line | `↑↓ to move · Enter inserts · Esc closes` |
| Nothing found | `No snippet matches “{query}”.` |
| Search result tag (muted, right) | the group name, e.g. `Characterise` |
| Form hint line | `Enter inserts · Ctrl+Enter in a text box · Esc cancels` |
| Form buttons | `Cancel`, `Insert` (as today) |
| Mandatory field | `Needs an answer` (as today) |
| Settings group | `Snippets` (holds Methods folder, Only suggest chemicals of the asked class, and the group toggles) |
| Group toggle (one per group) | name `Make up` …, desc `Show these snippets in the Alt+S menu.` |
| Unknown run key | `“{title}”: Lab Kit has no calculator called “{key}”.` |
| Tidy group (stubs) | title `Snippets: old NMR, GPC and DLS files`, detail `The menu now lists NMR, GPC and DLS itself. These files show them a second time. Moved to Obsidian's trash (you can get them back).` |
| Tidy group (icons) | title `Snippets: icons from settings into the notes`, detail `Icons picked under Settings → Snippet icons are written into each snippet's header (icon:). The settings page goes.` |
| Check setup row | `Snippets without Templater` (only if I23 d = yes): on `Alt+S runs in Lab Kit; Templater is not needed for snippets.` |
| Command notice, no Templater (Phase 1, added 2026-10-19; new text, owner to confirm) | `Insert snippet needs Templater until snippets run in Lab Kit (Check setup says how to install it).` |
| Right-click menu item (Phase 5) | `Change icon…` |

## Phases

### Phase 1 — The menu window (plugin)
- Files: new `src/kit/snippet-menu.ts` (pure: build entries from files + methods, group, order, search, recent list), new `src/kit/snippet-menu-ui.ts` (the window, on the `.vt-entry` look: heading, search box, sections, hint line), `src/kit/snippet-run.ts` (expose `menu(tp)`), `src/kit/paths.ts` (`kit.snippetRecent: string[]`, default `[]`), `styles.css` (`.lk-snip-*`, radii from `docs/design-standard.md`: window card, rows row, search box control), `kits/lab/Templates/Insert snippet.md` (calls `kitSnippets.menu(tp)` when the plugin is there, keeps today's code as the fallback), tests `tests/snippet-menu.test.ts`.
- Behaviour: Recent (last 3 picked, newest first, only ones that still exist) then the groups in a fixed order; inside a group the file-name number order of today. Typing: one flat list, best match first (name starts with > word starts with > desc contains), group name as a muted tag. Group of an entry: the header's `group:`; until Phase 3 ships headers, a built-in map by kit file id (table below). A snippet with no group → `My snippets` (shown last, only when not empty).
- Window place: the window rule (`docs/design-standard.md`): under the cursor line when the editor has one, else centred and dimmed.
- Done when: unit tests for grouping, order, recent (cap 3, pruned when a file is gone), search ranking and the fallback group; `Insert snippet.md` still works with the plugin off (old picker); `npm test`, `npm run lint` 0 errors; obsidian-check: Alt+S shows the sections and inserts Sample list (report seen / not seen).

| Group | Kit snippets |
|---|---|
| Make up | Solution prep, Recipe by equivalents, RAFT recipe generator |
| Samples | Sample list, Sampling timetable, Variant naming matrix |
| Characterise | NMR, GPC, DLS, every Methods-folder method, Combined results |
| Flow | Rig, Flow column prep, Residence times |
| Tables | Blank calc table |

### Phase 2 — Forms in the new look
- Depends on: Phase 1.
- Files: new `src/kit/snippet-form.ts` (window with the same field contract as `labForm.js`: text, number, textarea, toggle, select, heading, `required`, `hint`, `suggest`; `matchNames` / `currentItem` / `replaceItem` ported with their tests), `src/kit/snippet-run.ts` (hands the plugin form to token templates and to `labSnippets.js` as `tp.user.labForm`), `styles.css`, tests.
- Look: entry-window card; each field a label over a box (control radius); a select with 2–3 options as pills, more as a dropdown; toggles as pills; hint line at the bottom. Fields that only matter for one choice (Solution prep: Total concentration, its unit, Ratio between solutes, Ratio numbers only when Targets = ratio split) are hidden until chosen **only if the owner says so** (I23 f); the scripts would mark them with `when: { mode: "total" }`, ignored by `labForm.js`.
- `labForm.js` stays for old copies and the Templater-only path; it is not changed.
- Done when: same answers object as `labForm.js` for every field type (tests on a table of fields); Esc = null; Enter / Ctrl+Enter as today; obsidian-check of Solution prep and Rig forms, light and dark; the 0005 / 0011 known answers still pass.

### Phase 3 — Two kinds (calculators with `run:`, methods)
- Depends on: Phase 1.
- Files: `kits/lab/Templates/Snippets/01`, `02`, `03`, `10` (body becomes a header only: `title`, `icon`, `desc`, `group`, `run: solution` / `recipe` / `raft` / `results`), `07`–`09` move to `removed` in `kits/lab/kit-manifest.json` (then `npm run kit:manifest`), `src/kit/snippet-template.ts` (`run` and `group` header keys; a header with `run` needs no `fields`), `src/kit/snippet-run.ts` (`run:` dispatch to `labSnippets.js`), `src/kit/snippet-menu.ts` (built-in NMR / GPC / DLS listed from `labMethods.js` `builtins`; a Methods note of the same name still replaces one), `labMethods.js:158` (`menuEntries` stops leaving the built-ins out, behind a flag the menu passes), `src/kit/tidy.ts` (stub rule), `docs/snippet-syntax.md` ("Which one do I use?" table: two rows), tests.
- What keeps working:
  - **An edited stub** (`07 NMR samples.md` with a changed icon line): kit updates leave edited files alone; the file is retired, not deleted. The menu recognises the old stub form (`tp.user.labSnippets(tp, "<key>")` as the only code) and treats it as `run: <key>` with its `// icon` / `// desc`; when a built-in has the same key, the menu shows the built-in once and hides the stub. The Tidy group "Snippets: old NMR, GPC and DLS files" offers to move them to the trash (asked, never automatic).
  - **An edited `01`–`03` / `10`**: Review update… shows the merge as for any kit file; the old `<%*` body keeps working through the same stub recognition (and through Templater when it is there).
  - **Make my own copy**: a copy of a code snippet is a plain note (frozen output, `snippet-copy.ts`) and inserts as written, group `My snippets`; a copy of a token template keeps its header and so its `group:` (copies made before Phase 4 have none → `My snippets`). Make my own copy on a `run:` calculator does what it does today for code snippets.
  - **Your own token templates and plain snippets**: listed as today, under their `group:` or `My snippets`.
- Done when: every snippet inserts byte for byte what it did before (extend the existing scenario tests to the `run:` path), the stub-recognition tests (edited icon, extra comment line, unknown key → notice), NMR shows once with and without the old stub file, Tidy rule tests; `npm run kit:manifest`; obsidian-check.

### Phase 4 — Groups in headers and one Snippets settings group
- Depends on: Phase 3.
- Files: every kit snippet header gets `group:` (`kits/lab/Templates/Snippets/*.md`, then `npm run kit:manifest`), `src/kit/ui.ts` (one `Snippets` group: Methods folder, the chemical-class toggle, one toggle per group), `src/kit/paths.ts` (`kit.snippetGroupsOff: string[]`), `src/kit/snippet-menu.ts` (built-in map removed, header wins), tests.
- Group toggle = hide in the menu only (no file is removed; your own snippets in that group hide too) unless the owner picks "uninstall the files" (I23 c). The per-file **Use** toggles in Manage files stay as they are.
- Done when: tests for hidden groups (menu, search and Recent all skip them); settings tab test; `docs/` settings pages updated.

### Phase 5 — Icons from headers only
- Depends on: Phase 4. Only if the owner says the Snippet icons page goes (I23 b).
- Files: `src/kit/ui.ts:309` (page removed), `src/kit/icon-picker-ui.ts` / `icon-list.ts` (kept only if another page uses them; search first), `kits/lab/Extras/scripts/templater/labPick.js` (stops reading `snippetIcons`; still used by the Templater-only fallback), `src/kit/tidy.ts` (icons rule: writes each saved icon into the header of the user's own copy; for an unedited kit file it writes nothing and reports it, so kit updates stay clean), `src/kit/paths.ts` (`snippetIcons` kept in data, unread, for one release), tests, docs.
- **Change icon…** (owner, 2026-10-19): right-click a snippet in the Alt+S menu → the existing icon picker (search box + grid of Obsidian's own icons) → writes `icon:` into that snippet's header. A kit snippet is first copied with Make my own copy (the copy gets the icon, the kit file stays clean). A "Browse icons" command that copies the picked name was offered, not decided.
- Done when: Tidy icons rule tests (own copy, kit file, missing file, icon already set); Change icon… tests (own file, kit file → copy, header with no `icon:` line); no code reads `snippetIcons` except the Tidy rule.

### Phase 6 — Alt+S without Templater (only if I23 d / e = yes)
- Depends on: Phases 1–3.
- Files: `src/kit/snippet-run.ts` (the command builds its own `tp`: `obsidian`, `config.target_file`, `file.title`, `date.now`, `user.labForm` = the plugin form, `user.labMethods`; loads `labSnippets.js` / `labMethods.js` from the vault the way Make my own copy does, `src/kit/snippet-copy.ts`), `src/main.ts` (command `lab-kit:insert-snippet`, inserts at the cursor with `editor.replaceSelection`), `src/kit/hotkey-check.ts:18` (Alt+S → the plugin command), `src/kit/setup-check.ts` (row), `kits/lab/Templates/Insert snippet.md` (one line that runs the plugin command, so an old Templater hotkey still works), tests.
- Note: the scripts still live in the vault and must sync; only Templater's user-script folder setting stops mattering. Plain snippets that hold `<% %>` Templater code are inserted through Templater when it is there, else with a notice naming the snippet.
- Done when: the command works with Templater off (test with a fake app; obsidian-check desktop with Templater disabled; obsidian-check --mobile); both hotkeys insert the same text; `hasNode()` false path covered.

## Verification
- Byte-for-byte: every kit snippet's output before and after (existing scenario tests plus new ones for the `run:` path).
- Known answers re-run as a guard: 0005 RAFT Mn = 19990.14; 0011 reactor volume = 1.7591 mL.
- obsidian-check after Phases 1, 2, 3, 6 (desktop; Phase 6 also `--mobile`). Results go in checklist 6i rows; "not seen by the owner" until the owner tries it.
- The feedback page decides the look before Phase 1 starts.
