# Front-matter property survey (2026-10-21)

Research only, no code changed. Asked by the owner on 2026-10-21: snippet questions sit in a `---` header (Q27 a), so they are note properties. Could that disturb search and filters across the vault? Do all Lab Kit properties follow one naming logic? Do any overlap, or clash with Obsidian or other plugins? Answers custom-live-blocks plan CQ20 (branch `claude/plan-custom-blocks-0a801d`).

**How each finding is backed** (one tag per line):
- **measured**: checked in a throwaway Obsidian 1.14.4 (`node scripts/obsidian-check.mjs`, 2026-10-21) with the kit's 11 snippet files plus test notes. The probe scripts are in the appendix, so the check can be re-run.
- **code**: read in this repo, with a `file:line` pointer.
- **docs**: read on the plugin's or Obsidian's own page or source, with a link.
- **(interpretation)**: my reading, built on the findings it names.

## Short answer

1. **Obsidian treats property names case-insensitively** (measured). `metadataTypeManager` keys every name in lower case, and `types.json` stores lower-case keys. The All properties view lists `Title`/`title` as one entry (13 notes) and `Result`/`result` as one. The search `[result]` finds the lab note, the to-do and the NMR method note (`Results`). So two names that differ only in capital letters are **one property**, with one type for the whole vault.
2. **Snippet headers do show up across the vault** (measured):
   - In All properties: `Title` 13, `Icon` 12, `desc` 11, `group` 11, `fields` 7, `required` 5, `run` 4.
   - In property search: `[group:Tables]` finds `13 Blank calc table`, and `[icon]` finds all 11 snippets plus the NMR method note.
   - In any Base without a folder filter: a probe base with the filter `group` listed all 11 snippet files with their group and title.
   - The kit's own three `.base` files filter by folder first (`file.inFolder(...)`), so they do not pick snippets up (code: `kits/lab/03 Lab Book/Lab book base.base:3`, `kits/lab/05 Chemicals/Chemical database.base:3`, `kits/planning/00 Planning/To-do board.base:6`).
   - Their effect is cosmetic: extra names in the property list and in suggestions, and hits only when you search for those names (interpretation, from the four findings above).
3. **`set:` and `fields:` are nested** (measured). Obsidian gives them the type *Unknown* and draws them as raw JSON in the Properties pane. Obsidian's help says nested properties are not supported and recommends source mode ([docs](https://obsidian.md/help/properties)).
4. **Type clashes exist today**, independent of snippets: `Type`, `project`, `meeting` and `closed_pdf` each hold values of two types (table below). Obsidian keeps one type per name for the whole vault ([docs](https://obsidian.md/help/properties)).
   - No warning shows until a type is assigned in `types.json` (measured: with no `types.json`, each note draws its own value's type).
   - Once a type is assigned, a list under a Text property shows the "Type mismatch" icon, and so does `false` under Text (measured: daily note `Type`, to-do `meeting`).
   - A plain text value under a List property shows as a one-item list with no warning (measured: to-do `project`, `closed_pdf: pending`).
   - Obsidian assigns a type when the user changes one in the Properties pane. Lab Kit also assigns `Chemical class` → list and `deadline` → date (code: `src/kit/ui.ts:598`, `kits/planning/Extras/Templates/Project hub.md`, through `vtEnsureType`, `src/kit/ui.ts:391`).
5. **Clashes with other plugins**: none that break anything today. The two to know about:
   - `title` is the default key of Front Matter Title, which would show snippet files by their `title:` (docs).
   - `icon` is the default icon field of Notebook Navigator and Iconize, but both have it off by default (docs: their source defaults).

## 1. Every property Lab Kit reads or writes

"Written by" means the kit writes it: a template, a command, the plugin or Tidy up notes. *Read by* gives code pointers. Types are what Obsidian inferred in the probe vault (measured) or, where marked, what the kit writes (code).

### Lab notes (`03 Lab Book/Notes`) and chemicals
| Property | Written by | Read by | Value type | Notes |
|---|---|---|---|---|
| `Type` | Lab Book template (empty), Tidy adds (`kits/lab/kit-manifest.json`) | nothing in `src/` | text (empty) | also on chemicals, daily and literature notes, see clashes |
| `Status` | template; lab board drag `src/lab/lab-board-view.ts:181`; New lab entry `src/kit/ui.ts:570`; Close `src/close/commands.ts:94` | `src/lab/lab-board.ts:48`, `src/close/scan.ts:26`, lab base, `src/planning/lists.ts` | text | Tidy `list-to-text` exists because old notes had a list |
| `Exp. Class` | template; clone `src/kit/ui.ts:582` | `src/header/hazards.ts:49` (setting `classProperty`), lab board, base (`note["Exp. Class"]`) | text | the dot needs `note["…"]` in Bases expressions |
| `Plan date` | template; clone `src/kit/clone.ts:57` | nothing | date | |
| `Exp. Start` | template (empty) | `src/lab/lab-board.ts:48` | date (empty = text) | `Exp. End` is retired (Tidy → `closed_on`, `src/kit/tidy.ts:344`) |
| `Chemicals` | template (empty) | hazard header (setting `chemicalsProperty`), lab board | list of links | |
| `CoSHH`, `RA`, `Objective` | template (empty) | nothing | text | owner vocabulary |
| `Outcome` | template (empty) | lab board `:50`, base | text or list | |
| `Result` | nothing (by hand) | lab board `src/lab/lab-board.ts:50`, lab base `order` | text | merges with to-do `result` (case) |
| `Rig`, `Rig snapshot` | Rig snippet `set:` (`kits/lab/Templates/Snippets/14 Rig.md`) | nothing as a property | text (link) | |
| `Cloned from` | Clone experiment `src/kit/clone.ts:87` | nothing | text (link) | |
| `progress` | plugin, setting Checklist progress `src/planning/progress.ts:41` | lab base (kanban card) | text `3/7` | also on the Shopping list |
| `closed_on`, `closed_hash`, `closed_pdf`, `closed_pdf_old`, `closed_data` | Close experiment `src/close/commands.ts:91-96,133` | `src/close/mark.ts:40-45`, `scan.ts:29-30`, lab board, base | date / text / **list or text** / list / text | `closed_pdf` is a list of PDF names or the text `pending` |
| `cssclasses` | templates | Obsidian | list | core |
| `Names` | Chemical template (empty) | snippet chemical suggestions as aliases `src/kit/snippet-run.ts:87` (read as `names`) | text or list | overlaps core `aliases` |
| `Chemical class` | template; New chemical `src/kit/ui.ts:607` (sets type list) | suggestions `snippet-run.ts:88`, chemical base kanban | list | |
| `H_Phrase` | template (list) | hazard header `src/header/hazards.ts:63` | list | |
| `CAS-No.`, `State at RTP`, `Boiling point`, `Melting point` | template (empty) | nothing | text | |
| `Molecular weight` (and `MW`, `Mr`, `molecular_weight`, `molar mass`, `molar_mass`, `m_w`, or the setting `mwProperty`) | template; ask-once `src/solution/ask-reagent.ts:9` | `MW()` `src/calc/engine.ts:298`, `src/calc/render.ts:93-97`, `src/solution/reagent.ts:50` | number | names matched without regard to case |
| `Purity`, `Concentration`, `Density`, `pKa`, `Acid / base` (`Acid/base`) | template; ask-once | `src/solution/reagent.ts:55-78` | number / text | |
| Rig notes: `Tubing`, `Control`, `Setup heading` | Rig template (empty) | Rig snippet tokens `rig.Setup heading`, `note-line:rig.Tubing` | text | `Control` is also a rig-table column name (not a property) |
| Method notes: `Title`, `Icon`, `Tag`, `Columns`, `Sample column`, `Results`, `Checklist`, `Dataset folder`, `Machines`, `Default machine` | by hand | `kits/lab/Extras/scripts/templater/labMethods.js:81-94` | text / list / bool | merge with snippet `title`/`icon` (case) |

### Planning notes
| Property | Notes carrying it | Written by | Read by | Value type |
|---|---|---|---|---|
| `kind` | every system note: `todo`, `project`, `meeting`, `meeting-series`, `concept`, `hub`, `review`, `list`, `daily`, `guide`, `literature` | templates, Tidy, Sort inbox | 51 places, e.g. `src/planning/commands.ts:106`, `To-do board.base` | text |
| `scheduled`, `due`, `done_on`, `raised_on` | to-do | board, entry window, engine `src/planning/todo.ts:110`, freeze `src/planning/freeze-note.ts:53` | board, plan, lists | date text |
| `done` | to-do | template, board tick | everywhere | checkbox |
| `project` | to-do (**text link**), meeting and project notes (**list of links**) | To-do template line 112, `setProject` `src/planning/todo-bar.ts:50`; Meeting / New project note templates write a list | `board-card.ts:33` (takes first of a list) | **text or list** |
| `meeting` | to-do | template (link); `setMeeting` writes **`false`** when cleared `src/planning/todo-bar.ts:51`; `blocks.ts:250` writes `null` | `todo-bar.ts:36` | **text link or checkbox** |
| `priority` | to-do | template, chip bar | board sort, lists | number |
| `after`, `sub`, `experiment`, `order`, `result`, `waiting` | to-do | plan map, Add result `src/planning/result.ts:17`, chip bar | plan, plan map, lab board `src/lab/lab-board.ts:59` | link (or list) / number / text |
| `day`, `planned`, `rolled`, `countdown` | old to-dos | old template only (retired) | `todo.ts:70-78`, base filter `day != "Done"` | text / bool |
| `Status` | project hub (`Active`/`Paused`/`Done`) | template, hub bar | `board-card.ts:104`, `commands.ts:492` | text (same name as the lab `Status`, other values) |
| `deadline` | project hub | template (sets type date), hub bar | `board-card.ts:112`, `project-bar.ts` | date |
| `interval`, `day`, `start`, `deck_windows`, `deck_mac`, `template` | meeting series hub | Meeting series template | `src/planning/meetings.ts:45-53`, `actions.ts:37` | text / date |
| `series`, `date`, `since`, `frozen` | meeting note | Meeting templates; freeze `src/planning/freeze.ts:14` | `freeze.ts:139-150`, `lists.ts:115` | link / date / date / text |
| `summary`, `sources`, `checked` | concept | New concept template, Tidy | nothing in `src/` | text / list / checkbox |
| `Type`, `Experiments` | daily note | Daily note template (`Type` as a **list**) | nothing in `src/` | list / text |
| `r1`…`r6` | Weekly review | file | Meta Bind toggles | checkbox |
| `obsidianUIMode` | `00 Home`, Projects overview | file | Check setup `src/kit/setup-check-ui.ts:53`; Force note view mode plugin | text |
| `updated` | Vault spec | file | nothing | date |
| Literature (ZotLit settings, Vault spec rows 201-213): `kind`, `Type`, `Title`, `aliases`, `Year`, `Authors`, `Zotero Tags`, `Collections`, `citekey`, `URL`, `DOI`, `imported`, `cssclasses` | literature notes | ZotLit | `src/planning/lists.ts:102-147,276` (`Title`, `imported`, `Collections`; `takeaway` is an inline field) | text / list / date |

### Snippet file headers (`Templates/Snippets/*.md`; parser `src/kit/snippet-template.ts:21-44`)
`title`, `icon`, `desc`, `group`, `run`, `required`, `set` (map), `fields` (list of maps), plus `make`, `name`, `folder` (used by `make: note` templates, none in the kit yet). The custom-blocks plan adds `block: definition` and new keys *inside* `fields` (`type`, `weights`, `wide`, `unit`, `options`); those inner keys are not properties. Its `lk-definition` keys (`format`, `name`, `layout`, `status`, `title`, `summary`, `rows`…) sit in a code block in the body, so they are not properties either (code: plan CQ1).

## 2. Snippet headers as properties: what was measured

| Question | Answer | Basis |
|---|---|---|
| Do they show in All properties? | Yes. Names and counts, with one entry per lower-case name: `Title` 13 (11 snippets + literature + method note), `Icon` 12, `desc` 11, `group` 11, `fields` 7, `required` 5, `run` 4 | measured |
| Do they show in property search? | Yes: `[group:Tables]` → `13 Blank calc table`; `[title:Rig]` → `14 Rig`; `[icon]` → 11 snippets + the NMR method note. A plain word search (`Tables`) also matches front matter text, as for any note | measured |
| Can a Base pick them up? | Yes, if the base has no folder filter (probe base listed all 11). The kit's 3 bases filter by folder first, so no | measured / code |
| Type per name | `title`, `icon`, `desc`, `group`, `required`, `run`: text. `set`, `fields`: **Unknown** (nested), drawn as JSON in the Properties pane | measured |
| Name whose type differs between notes (snippets vs the rest) | `title`/`Title` (snippets, literature, method notes): text everywhere, no clash. `icon`/`Icon`: text everywhere. **No type clash caused by snippet headers today** | measured |
| Plan keys that would clash | CQ13's example `Kind: stock` on a chemical note would **be** `kind` (case-insensitive): the same property that marks system notes, so a chemical with `kind: stock` lands in every `kind` list and filter value list | measured (case merge) + code (`kind` users) |
| Not measured | Whether clicking a nested `set:`/`fields:` in the Properties pane rewrites the YAML (the plan's Phase 0 flags it); the mobile app; Obsidian versions other than 1.14.4 | — |

## 3. Clashes with Obsidian and other plugins

| Name | Who reserves it | Kit use | Effect | Basis |
|---|---|---|---|---|
| `tags`, `aliases`, `cssclasses` | Obsidian core | `cssclasses` (as meant), `aliases` (ZotLit) | none | docs ([Properties](https://obsidian.md/help/properties)) |
| `tag`, `alias`, `cssclass` | deprecated since 1.4, dropped as defaults in 1.9 | method note `Tag` | none in 1.14.4: `Tag: NMR` gave no tags in the metadata cache | docs + measured |
| `publish`, `permalink`, `description`, `image`, `cover` | Obsidian Publish | none (`desc`, `summary` are different names) | none | docs ([Publish SEO](https://obsidian.md/help/publish/seo)) |
| `title` | Front Matter Title (default key `title`) | snippet `title`, literature `Title`, method `Title` | if installed, snippet, literature and method notes show their `title` instead of the file name in explorer, tabs, search, graph | docs ([README](https://github.com/snezhig/obsidian-front-matter-title)) |
| `icon` | Notebook Navigator (`frontmatterIconField: 'icon'`, `useFrontmatterMetadata: false`); Iconize (`iconInFrontmatterFieldName: 'icon'`, `iconInFrontmatterEnabled: false`) | snippet `icon`, method `Icon` | none by default. With the option on, snippet and method files get those icons; `grid-3x3, layout-grid` (two names) is not their format | docs (source defaults: [NN](https://github.com/johansan/notebook-navigator/blob/main/src/settings/defaultSettings.ts), [Iconize](https://github.com/FlorianWoelki/obsidian-iconize/blob/main/src/settings/data.ts)) |
| `color`, `background` | Notebook Navigator (same option) | none | none | docs |
| `date` | Dataview: `file.day` comes from a date in the file name or a `Date` field | meeting notes `date` | same day as the file name (`YYYY-MM-DD <series>`), so harmless | docs ([Dataview metadata](https://blacksmithgu.github.io/obsidian-dataview/annotation/metadata-pages/)) |
| names with spaces / capitals | Dataview sanitises keys: lower case, dashes for spaces; keys with spaces cannot be used as they are | `Exp. Class`, `Plan date`, `Chemical class`… | queries must use `exp.-class`-style names or `row["Exp. Class"]`; the kit's Dataview queries use only lower-case planning keys (interpretation) | docs ([Dataview add metadata](https://blacksmithgu.github.io/obsidian-dataview/annotation/add-metadata/)) |
| names with dots | Bases needs `note["Exp. Class"]` in expressions | `Exp. Class`, `Exp. Start`, `CAS-No.` | the kit already writes `note["Exp. Class"]` (`Lab book base.base`) | code |
| `kanban-plugin` | Kanban plugin | none | none | docs (source `src/parsers/common.ts:9`) |
| `obsidianUIMode` | Force note view mode | homepage | intended | code (`src/kit/setup-check.ts:31`) |
| Templater, Meta Bind, ZotLit | no reserved names; they read or write the names you give them | — | none | (interpretation; Templater's `tp.frontmatter` and Meta Bind bindings take any name, ZotLit writes the keys set in its settings) |
| Banners-style plugins (`banner`) | — | none | none | not checked (guess) |

## 4. Consistency

**Two naming styles, roughly by owner** (interpretation, from §1):
- Lab and chemical notes use **Title Case words the owner chose** (`Status`, `Exp. Class`, `Plan date`, `Chemical class`, `Molecular weight`, `Rig`, `Cloned from`).
- Planning notes and everything Lab Kit **stamps itself** use **lower case**, with snake_case for two-word names (`kind`, `done`, `done_on`, `raised_on`, `closed_on`, `deck_mac`, `progress`).

Exceptions to that split:
- `H_Phrase`: an underscore and Title Case, and singular for a list.
- `CAS-No.`: a hyphen and a dot.
- `Exp. Start` vs `Plan date`: two patterns for the two dates of one note.
- Method notes are Title Case (`Title`, `Icon`), while snippet headers are lower case (`title`, `icon`) for the same meaning. Obsidian shows one spelling for both (measured).
- `Status` means two things: the lab stage on lab notes, and Active/Paused/Done on project hubs. Same type, different values (code).

**Overlaps (same or near-same meaning):**
- `Type` vs `kind`: both say what a note is. Daily and literature notes carry both. Lab notes have an empty `Type` that nothing reads (code).
- `Names` vs core `aliases`: alternative names of a chemical. `aliases` would also make `[[dimethylacrylamide` find DMAm; `Names` does not (interpretation from Obsidian's alias feature).
- `Outcome` vs `Result` on lab notes: the template writes `Outcome`; the lab board and the lab base also read `Result`, which nothing writes (code).
- `Result` (lab) and `result` (to-do, one line): one property (measured). Both are text, so there is no warning.
- `Results` (method note: which columns are results) is a different name from `Result`, but `[result]` search finds it too (measured).
- `day`: the weekday of a meeting series, and the retired to-do weekday. Same type; the to-do one is being removed (code).

**Dates:** all `YYYY-MM-DD` (code: templates and `ymd()`). Obsidian infers the date type when the value is filled (measured: `closed_on`, `date`, `since`, `imported`, `Plan date`). `Exp. Start` empty was inferred as text in the probe.

**Links vs text:**
- Links are written quoted (`"[[X]]"`): `project`, `series`, `meeting`, `after`, `sub`, `experiment`, `Rig`, `Cloned from`, `Chemicals` items.
- `Exp. Class` is text, but the hazard header strips `[[ ]]`, so a link works too (code `src/header/hazards.ts:49`).

**Types that differ between notes (one name, two types):**
| Name | Type A | Type B | Shown as a mismatch once typed? | Basis |
|---|---|---|---|---|
| `Type` | text (chemical, literature, lab) | list (Daily note template) | yes, on daily notes when `Type` is Text | measured |
| `project` | text link (to-do) | list of links (meeting, project notes) | no warning if typed List; warning on meeting notes if typed Text | measured |
| `meeting` | text link | `false` (cleared via chip bar) | yes, on the `false` notes when typed Text | measured |
| `closed_pdf` | list of PDF names | text `pending` | no warning if typed List | measured |
| `Outcome` | text | list (read with `toList`) | depends on what the user types | code |

## 5. Questions for the owner (ready for BACKLOG "Questions for the owner")

No store users have notes yet (owner, 2026-10-21), so renames are cheap now: a Tidy up notes rule plus reading both names for one release. Each question is independent.

- **FM1 Snippet headers as properties (answers CQ20):** measured effects are an extra 7-8 names in All properties and property search, hits in a Base with no folder filter, and `set`/`fields` drawn as JSON. The kit's own bases are not affected, and no type clash comes from them.
  - (a, rec) keep the header as it is (Q27 a) and add a line to the snippet docs: "the header keys are properties of the snippet file; give your own Bases a folder filter".
  - (b) put everything under one key (`lab-kit:` with the keys nested), so only one name shows vault-wide; harder to write by hand.
  - (c) move the header into a body code block like `lk-definition`; reverses Q27 a.
- **FM2 One property name per meaning, whatever the capitals:** Obsidian merges `Kind`/`kind`, `Result`/`result`, `Title`/`title` (measured).
  - (a, rec) a rule in `docs/` and the plan: no new property may equal an existing one apart from capitals. Applied first to the plan's CQ13 example `Kind: stock` on chemical notes, which becomes e.g. `Form: stock solution`, so it is not the `kind` that marks system notes.
  - (b) no rule.
- **FM3 `Type` and `kind`:** both say what a note is. The Daily note template writes `Type` as a list, the others as text (measured mismatch).
  - (a, rec) keep both, and write the Daily note's `Type: Daily Note` as plain text (template + Tidy `list-to-text`).
  - (b) retire `Type` on kit notes in favour of `kind` (`kind: lab`, `chemical`, `daily`), with a Tidy rule.
  - (c) leave as is.
- **FM4 `project` text on to-dos vs list on meeting and project notes:**
  - (a, rec) a list everywhere (To-do template and `setProject` write `- "[[X]]"`). The code already takes the first item of a list. Text values stay readable: measured, no warning under List.
  - (b) text everywhere (meeting notes lose several projects).
  - (c) leave as is.
- **FM5 `meeting: false`:** clearing the meeting chip writes `false` (`src/planning/todo-bar.ts:51`), so the property's inferred type can become Checkbox and links then show a mismatch.
  - (a, rec) clear it by removing the property (or `null`, as `blocks.ts:250` already does).
  - (b) leave as is.
- **FM6 `closed_pdf` list or `pending`:**
  - (a, rec) keep the values and have Close experiment set the type to List once (like `Chemical class`), where `pending` shows as one item with no warning.
  - (b) write `pending` as a separate checkbox `closed_pdf_pending`.
  - (c) leave as is.
- **FM7 `Outcome` and `Result` on lab notes:** the template writes `Outcome`; the lab board and base also show `Result`, which nothing writes; `Result` is also the to-do `result` (same property).
  - (a, rec) ask which one the lab board should show, then drop the other from the board and base.
  - (b) keep both, and document `Result` in the Vault spec.
- **FM8 Chemical `Names` vs `aliases`:**
  - (a, rec) keep `Names` (owner vocabulary) and also read `aliases` for chemical suggestions.
  - (b) rename `Names` → `aliases` (Tidy rule), so links and the quick switcher find a chemical by its other names.
  - (c) leave as is.
- **FM9 Naming logic:** today the split is Title Case for lab and chemical notes, lower case snake_case for planning notes and kit stamps.
  - (a, rec) keep that split and write it in the Vault spec "Property naming" box; rename nothing else.
  - (b) as (a), plus tidy the odd ones: `H_Phrase` → `H phrases`, `Exp. Start` → `Start date` (both read for one release).
  - (c) one style for every name.
- **FM10 `title`/`icon` and other plugins:** Front Matter Title (default key `title`) would show snippet, literature and method notes by their title. Notebook Navigator and Iconize read `icon` only when their front-matter option is on (off by default).
  - (a, rec) nothing now; one line in the snippet docs.
  - (b) rename the snippet keys to `menu-title` / `menu-icon` (also unlike the method notes' `Title`/`Icon`).

Not covered: the owner's own vault (never read), the mobile app, Obsidian versions other than 1.14.4, other plugins than those listed, and whether Front Matter Title / Notebook Navigator are installed in the owner's vault.

## Appendix: probe (re-runnable)
Notes in a scratch folder: the 11 files of `kits/lab/Templates/Snippets/`, plus small notes copying the template front matter (a lab note with `Result` and `closed_pdf: pending`, a closed lab note with `closed_pdf` as a list, a chemical, a daily note with `Type` as a list, a to-do with `project` text, `meeting: false` and `result`, a meeting note with `project` as a list, a literature note with `Title`, and a method note with `Title`, `Icon`, `Tag`, `Columns`, `Results`). Then `node scripts/obsidian-check.mjs start --notes <folder>` and `eval --file`:
- `app.metadataTypeManager.getAllProperties()` → names, lower-case keys, widget per name.
- `app.metadataTypeManager.setType(...)` for `type`=text, `project`=list, `meeting`=text, `closed_pdf`=list, then open each note in live preview and read `.metadata-property-warning-icon` (computed `display: flex` = warning shown).
- `openGlobalSearch('[group:Tables]')` etc. and the search view's `dom.resultDomLookup`.
- `properties:open` and the `all-properties` leaf's text.
- A probe `.base` with `filters: and: [group]` and its rendered text.
