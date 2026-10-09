# Obsidian test checklist (before 0.4.0)

> [!info] How to use
> Test in `test-vault/` only. Tick as you go. Write what broke under the item, then paste it to Claude with `/feedback`.
> About 45 min. Order matters: later steps use files from earlier ones.

## 0. Setup (5 min)
- [ ] Obsidian is 1.13 or newer (Settings → About)
- [ ] Terminal: `npm run dev`, open `test-vault/`, Lab Kit is on
- [ ] Templater is on with a **Templates** folder and a **User script functions** folder set (e.g. `Templates` and `Extras/scripts/templater`)
- [ ] The old hand copies in `test-vault/Templates/` and `test-vault/Extras/` are stale. Delete both folders first so step 2 starts clean

## 1. Settings page
- [ ] Settings → Lab Kit opens, rows in a sensible order
- [ ] Type a value (Initials), close Obsidian settings, reload the plugin: value is still there
- [ ] Settings search finds "legend"
- [ ] "Per-note options" is its own row. Happy with it?
- [ ] **Built-in kit** group = update rows only (Update available, Kit version, What's new, Tell me, Backup folder); **Kit folders and setup** group below it = Check setup, Check hotkeys, Templates / Scripts / Snippets folders, console log (no Templater Set up row any more)
- [ ] Manage files…: Conflict / Merges cleanly / Missing / Update available / New / Changed by you come first, then Up to date, Kept, Detached, Off; Retired last. Review update…: "Changed by you" is below "Updated"
- [ ] Alt+S **Recipe**: first reagent 0.5 g gives mmol = g ÷ MW in the Set mmol cell; 0.1 M with 10 mL gives 1 mmol; M without a volume leaves the cell empty and shows a notice
- [ ] Alt+S **RAFT** with a co-solvent: an extra row, mass = % of the solvent's mass; blank co-solvent: no extra row
- [ ] **Live highlight**: click a formula cell, type `=B2*sol1!B3`: B2 and the cell in the other table get a ring while typing; header cells too; the ring goes on Enter / Esc / click away (also in dark theme and on mobile)
- [ ] No "Kit updates" group and no **Check for updates** command (the folder updater is gone); **What's new** and **Tell me when a kit update is ready** are in the Built-in kit group

## 2. Built-in kit install
- [ ] Built-in kit group shows the version row and the Backup folder; the Templates and Scripts folder boxes are in Kit folders and setup
- [ ] Scripts folder refuses a dot folder (notice on blur)
- [ ] **New vault layout**: with Templater's folders set, the first install puts templates in `<Templates>/Lab Kit/` (menu + `Snippets/`) and the user scripts in `<user scripts folder>/lab-kit/`; with none set, in `Extras/Templates/Lab Kit/`, `Extras/scripts/templater/lab-kit/` and `Extras/scripts/lab-kit/` (Excel converter). Give `Insert snippet.md` an Alt+S hotkey: the menu opens, and a snippet runs (so Templater finds `tp.user.labSnippets` in the subfolder; if not, tell me)
- [ ] **Existing vault** (flat layout): nothing moves; a kit file added later lands beside `Insert snippet.md`
- [ ] Review update… asks before first install, then Apply creates the files
- [ ] **Confirmation list** (Phase 1b): first install shows groups with counts (files to create, left alone, folders, settings); a vault with a file of the same name lists it under "left alone" and it is unchanged afterwards; Cancel: nothing new in the file tree, no setting changed (Templater hotkeys, folders, Appearance → CSS snippets). Set up shows the same list for its changes; an update that needs no new folder runs without asking
- [ ] **First install switches**: with Templater's user scripts folder empty, the question shows **Turn on the CSS snippet** and **Set Templater's user scripts folder**; afterwards the snippet is on (Settings → Appearance) and Templater's folder is set. With a folder already set in Templater: only the CSS switch, and Templater's folder is unchanged
- [ ] **Your scripts folder is kept** (issue #34): set Templater's user scripts folder to a folder with one script of your own, first install: Templater's folder is unchanged, `labForm.js` is in `<folder>/lab-kit/`, your script still runs, a snippet opens its form. Then point Templater at another folder and press **Set up**: it asks to install copies into `<new folder>/lab-kit/`, lists the old copies, Cancel writes nothing (no hotkey or template folder change either), Set up creates them and the form still opens
- [ ] **Update notice**: in `.obsidian/plugins/lab-kit/data.json` lower `kit.managed.installedKitVersion` (e.g. to 0.4.0), reload: a notice says **Lab kit vX is ready**, and **Review** opens the review window. Switch off **Tell me when a kit update is ready**, reload: no notice
- [ ] Report window lists them; nothing broken in the file tree
- [ ] Edit an installed template, Review again: it says "changed by you"
- [ ] Delete one file, Review again: it says "missing" and offers to recreate

## 3. Manage kit files
- [ ] Opens from Settings and from the command palette
- [ ] Badges readable (colours OK)
- [ ] Install / Update / Recreate works on one file
- [ ] Edit a template → **Restore kit original** (confirm, backup lands in the Backup folder, by default `.obsidian/plugins/lab-kit/backups/<date>/…`, not visible in the file list)
- [ ] Detach, then Re-attach
- [ ] Snippet rows have a one-line description and a **Use** toggle; core files (menu, scripts, Lab Book Template) have none
- [ ] Toggle a snippet **off** (not installed yet): row shows **Off**, **Update all safe files** does not install it
- [ ] Toggle an **installed** snippet off: asks first, backup lands in `.obsidian/plugins/lab-kit/backups`, the file is in Obsidian's trash, it is gone from Alt+S and from Settings → Snippet menu. Cancel leaves the toggle on
- [ ] Toggle it on again: reinstalled, back in Alt+S
- [ ] CSS snippet switch really turns `scrolling-mermaid` on and off

## 4. Merge (needs a kit bump)
- [ ] Edit the **top** of an installed template; edit the **bottom** of the kit copy in `kit/`, run `npm run kit:manifest`, `npm run dev`, reload
- [ ] Review shows "merges cleanly" with a tick; Apply keeps both edits; report says "Merged"
- [ ] Edit the **same line** in both: row says "Conflict", nothing written
- [ ] **Resolve…** opens hunk cards; Keep mine / Take kit / Keep both / Edit work; Apply is disabled until all decided
- [ ] Keep all mine: row then shows "Changed by you"
- [ ] Edit Lab Book Template **properties** only, bump kit: "merges cleanly"
- [ ] Remove a file from `kit/` (copy to temp first), regenerate: shows **Retired** with a Forget button

## 5. Alt+S snippets
- [ ] Menu opens; Settings → Snippet menu has one row per snippet with icon placeholders
- [ ] Type a Lucide icon name: menu icon changes after next open; a wrong name falls back
- [ ] Initials set: Sample list codes use them. Clear initials: notice appears and codes use `XX`
- [ ] Forms start empty with placeholders; submitting an untouched form inserts nothing
- [ ] RAFT with **3 monomers**: mol column sums right, Mn looks sane
- [ ] Sample list and Sampling timetable forms have no "Also add" toggles; NMR samples afterwards takes the codes from the list
- [ ] Second **Sample list** in the same note starts at the next letter (A–F, then G…); second **Sampling timetable** defaults to the next letter; a timetable after a sample list still starts at A
- [ ] Column snippet has "Packing material"; residence time is in an info callout
- [ ] Two tables `samples` and `samples2`: codes from both are found
- [ ] Two tables both named `samples`: note what the snippet does (just report it)

## 6. Calc tables
- [ ] Click a cell: width stays fixed while editing
- [ ] Click another cell while editing: opens in one click (also across two tables)
- [ ] Enter, Tab, Escape behave; typing is not wiped
- [ ] Cell with a `[[link]]` renders and the link works
- [ ] Empty body cells are taller
- [ ] Two tables with the same `name:` show the red "used twice" warning; refs give `#REF!`
- [ ] Copy still works

## 6b. Chemical database (needs `npm run dev`, then Review update… for the new forms)
- [ ] Settings → Lab Kit → Lab notebook: in a vault that used Lab Kit before, **Chemical folder** and **Molecular weight property** are empty (a new vault: Chemical folder `05 Chemicals/Chemicals`); with it empty, typing `[[` in a calc cell suggests nothing
- [ ] Set Chemical folder to `Chemical database/Chemicals`: typing `[[tol` in a cell shows Toluene; click one, then Enter on another: the cell is filled, not saved half-typed
- [ ] With the popup open, **Enter** picks the highlighted suggestion (does not save the cell); **Esc** closes the popup; with it closed they save / discard as before
- [ ] A chemical found by its **Names** entry (e.g. DTT → Dithiothreitol) inserts `[[Note|name]]` and `=MW(...)` still works
- [ ] Set Molecular weight property to a property that exists on one note only: MW() uses it; clear it: MW() works as before
- [ ] Alt+S **Solution prep** / **Recipe** / **RAFT**: reagent, solvent, monomer, CTA, initiator fields suggest; after a comma only the new item is replaced; Enter picks, second Enter inserts
- [ ] Alt+S **Solution prep**: a solute with its own target in M / mg/mL / g gives the right Target (g); a row added in mL with a Density gives Added (g), without a Density shows an error; "Total concentration split by a ratio" splits the mass as expected; two solvents share the final volume
- [ ] **Column** snippet: type DCM as Solvent: the density row is DCM's Density; a density typed in the form wins; no solvent leaves it blank
- [ ] Folder empty or wrong: forms and cells behave as before

## 6d. Phase 2: chemical database files, Lab book base, New lab entry
- [ ] Vault that used Lab Kit before: Manage kit files lists Chemical database template, Chemical database.base and Lab book base.base as **Off**; switching one on says to set the folder first
- [ ] Set Lab notes folder `03 Lab Book/Notes` and Chemical folder `05 Chemicals/Chemicals`, then Review update…: the confirmation lists the three files and the folders `03 Lab Book`, `05 Chemicals`
- [ ] Open `Chemical database.base`: Table and **By class** (kanban grouped by Chemical class) views show the notes in `05 Chemicals/Chemicals`
- [ ] Open `Lab book base.base`: the board groups experiments by Status (Planned, Started, Processing results, Closed)
- [ ] Command **New lab entry**: asks for a title, makes `ABC0001 - Title` (ABC = Initials; refused with a notice when Initials is empty) in the Lab notes folder (folder made if missing), `Status: Planned` shows as text
- [ ] Without Templater / with the Lab notes folder empty: New lab entry shows a notice, nothing is made

## 6c. Analysis methods (needs `npm run dev`, then Review update… for the new scripts)
- [ ] Methods folder empty: Alt+S **NMR / GPC / DLS samples** and **Combined results** look and behave as before
- [ ] Type a new folder name (e.g. `Analysis/Methods`) in **Methods folder** and click out of the box: the folder (and `Analysis`) appears in the file list with a notice; an existing folder is left alone; a name starting with `.` creates nothing
- [ ] Settings → Lab Kit → Lab notebook: **Methods folder** is wide and suggests folders; picking one saves (also at phone width)
- [ ] The **Analysis table** snippet is gone from Alt+S (Manage files… lists its note as no longer in the kit); the methods are picked from the Alt+S menu
- [ ] In `test-vault/Methods/`: a method note (Columns, Results, Machines) and two machine notes. Alt+S lists your method; its form shows a **Machine** dropdown (looks right, default selected) and a field for each column with a default
- [ ] Alt+S menu (after Review update… for the new Insert snippet.md): your method is listed at the end as *Name samples* with its icon and the machines in the description; picking it opens its form directly; add a second method note and it shows next time with no refresh
- [ ] Pick the other machine without touching the fields: they take its values; type a value first: it stays
- [ ] The formula column calculates; the Machine cell links to the machine note
- [ ] **Combined results** has a toggle for your method and the right columns, filled from the table (with two tables of the method: the second is used for codes missing from the first)
- [ ] A note with no Columns in the Methods folder is ignored; a note called GPC replaces the built-in GPC

## 6e. Phase 6: planning kit switch and Check setup
- [ ] Settings → Built-in kit → **Planning kit (preview)**: off at first. Switch on: a notice, and a **Planning kit files** row appears (not installed yet). Review update… lists the planning files and folders; Apply installs them; reload Lab Kit: New to-do, Quick capture etc. are in the command palette
- [ ] Planning first install with Templater's user scripts folder empty: no "Set Templater's user scripts folder" switch (only the lab kit sets it)
- [ ] ZotLit on: the literature files are offered; ZotLit off: they show as Off
- [ ] Command **Check setup** and the **Check setup…** button open the same list; a set-up vault is all ✓
- [ ] Each Fix asks first (Cancel changes nothing), then the row turns ✓: CSS snippet, missing folder, Templater folder template (planning on; a folder that already has one is left as it is), Alt+S
- [ ] Alt+S when another command already uses it: no Fix, the row names that command
- [ ] Open on a missing plugin opens its page in Community plugins
- [ ] Phone width: the list fits
- [ ] Check setup → Notebook Navigator → Homepage: with no homepage set, Fix sets `00 Home.md` (Notebook Navigator settings show it; it opens at startup); a homepage you chose is left alone
- [ ] Check setup → Obsidian → Properties hidden in notes: Fix sets Settings → Editor → Properties in document to Hidden
- [ ] Phase 6e: Check setup → Methods folder Fix creates `Extras/methods` and fills the setting; the ZotLit row shows "!" and names the checklist note
- [ ] Phase 6d: Enter saves in the New to-do / New lab entry / Quick capture boxes; Check setup shows Lab Kit settings (Open → settings tab), Templater matching mode and startup templates, Meta Bind buttons (Fix adds 26 or the missing ones), ZotLit (Open → Set up ZotLit note); ZotLit's plugin Open goes to ZotLit
- [ ] Phase 6c: planning first install in a vault without its folders: the confirmation lists 00 Inbox, 01 Daily Notes, … each with what it is for; Apply makes them, Cancel makes none. Every file row shows its name, a line on what it is, and its path

## 6f. Phase 5a: planning folders, Find moved folders, homepage blocks (needs `npm run dev`)
- [ ] Before updating: copy `00 Home.md` to `Home (Dataview).md` (old lists, to compare). Then Manage files → **Restore kit original** on 00 Home and Projects overview
- [ ] 00 Home: Go to shows one button per folder with a hub (Planning → To-do board, Projects, Lab Book, Literature, Chemicals, Knowledge, How-tos) plus Meetings, Meeting deck, Weekly review, Shopping list; each opens the right note / runs the deck command
- [ ] This week, Inbox (+ Sort inbox), Experiments on the go, Projects, Recently read show the same notes in the same order as in `Home (Dataview).md`; tick a to-do or change a Status: the list redraws within a second
- [ ] Projects overview: one card per project with goal, top 3 to-dos, counts; New note / New to-do / Open work
- [ ] Settings → **Planning folders** (only with the planning kit on): empty boxes show the defaults as grey text
- [ ] Rename `00 Planning` to `10 Plan` and `02 Projects` to `20 Work` **in Obsidian**: the two settings follow; homepage lists still fill; New to-do lands in `10 Plan/To-dos`; Check setup shows no ✗ for them
- [ ] After that rename (settings tab left open): the Planning and Projects boxes show `10 Plan` / `20 Work` at once (no stale empty or red box); a notice says kit files were updated; the To-do and Project hub templates now say `10 Plan/To-dos` / `20 Work`; New project makes its folder under `20 Work`, not a new `02 Projects`. Edit the To-do template by hand first, rename again: a notice says your edit was kept
- [ ] Rename `20 Work` in **Finder / File Explorer**: New project shows "Folder "20 Work" not found…" with Find moved folders / Open settings / Create it, and no new `20 Work` appears; the Projects block shows the same line; the settings box is outlined red; Check setup lists it with **Find**
- [ ] **Find moved folders** proposes the moved folder (with why); Apply sets it; Manage files shows no Missing for kit files that were in it
- [ ] With Obsidian open, change a planning folder in `test-vault/.obsidian/plugins/lab-kit/data.json` from outside: the setting shows the new value without a reload; change another setting in Obsidian, then check data.json still has the outside value
- [ ] Planning kit switched off: the homepage blocks say the planning kit is off (no raw code)

## 6g. Phase 5b: meeting series (needs `npm run dev`; Restore kit original on 00 Home, To-do and Weekly meeting; an older vault keeps its Weekly meetings note)
- [ ] 00 Home shows a **Next meetings** card with the series, the next date (Thu, d MMM) and how often; today's meeting says "today"
- [ ] Add two more series (make them with **New meeting series**, or copy a series hub into `08 Meetings/Group meeting/` with `interval: fortnightly`, and `08 Meetings/Review/` with `interval: monthly`, `day: Thu`, `start` = a 2nd Thursday): the card lists all three with the right dates
- [ ] **New meeting** (command, and the New meeting note button) asks "Which meeting?" with three series, none with one; the note is named `YYYY-MM-DD <Series>`, sits in the series' folder, has `series` and `since`, and its lists cover the time since the last meeting of that series
- [ ] **New to-do** asks "Raise at which meeting?" with several series (none with one); pick one: the to-do has `meeting: "[[Series]]"`. That series' meeting note lists it under Flagged for this meeting, the others don't; an old `meeting: true` to-do shows under the first series by name
- [ ] **Open meeting deck** asks which series; the deck path comes from that series' note
- [ ] Check setup → Meetings: one row per series; break `interval` on one: red, names the field, Open goes to the note; a series without a deck path for this computer shows "!"

---

## 6h. Phase 7a/7b/7c: Tidy up notes (needs `npm run dev`; use a copy of your notes in test-vault, never your real vault)
- [ ] Command **Tidy up notes** opens a wide window with the backup banner; **Change notes…** is greyed out until the backup box is ticked
- [ ] Put in test-vault: a lab note with `Status:` as a list, a note in the Knowledge folder with `Type: Wiki`, an `index` note without `kind`: each shows left (before) and right (after) with red / green / amber lines, readable in light and dark themes
- [ ] Untick a rule, press **Copy report**, paste somewhere: the rule says "(not ticked)", only paths and counts, no note text
- [ ] Only reported lists an untitled note, a canvas in the inbox, a note outside the folders; nothing in the vault changed (check the files' modified times)
- [ ] Phone width (`app.emulateMobile(true)`): the two columns stay readable, the buttons wrap
- [ ] Change notes… → the second window says "Change N items (M rules)?"; Cancel changes nothing; Confirm: the notes change as the right side showed, the window scans again and lists nothing for those rules, a banner names the backups folder, and the backup copies equal the old notes
- [ ] A lab note with no properties gets the template's block; a note with `vt` / `Calculations` keeps them
- [ ] A `fonts` folder (and `Extras/Templates/Scripts`) moves: links in notes still resolve (Obsidian's unresolved-links count is unchanged), kit files still show as tracked in Manage kit files
- [ ] Edit a listed note after the scan, then confirm: that note is skipped and named in the banner
- [ ] 7c-1, planning kit on: an old hub in `08 Meetings/<Series>/` (`kind: hub`, no interval) shows under **Meetings** with Held / on pickers; changing them updates the After column (interval, day) and start is today; meeting notes in that folder get `series`; a to-do with `meeting: true` gets `meeting: "[[Series]]"`
- [ ] 7c-1: a Projects / Literature / Knowledge / How-tos folder with no hub note shows **Add a hub note…** (new note); after Confirm the file exists with `kind: hub`, Go to on 00 Home lists the folder, and a file of that name made in the meantime is skipped, not replaced
- [ ] 7c-2: with a Templater startup / folder template / template hotkey pointing into `Extras/Templates/Scripts/`, tick the folder move and the **Templater: paths** rule: Templater's settings show the `Actions` paths afterwards and the template hotkey still fires
- [ ] 7c-2: a Meta Bind button template that runs `Sort inbox.md` (runTemplaterFile) shows under **Meta Bind: buttons**; after Confirm the button runs the command (restart not needed?); a button of your own that runs another template stays and is listed under Only reported
- [ ] 7c-2: the backups folder has `settings/*.json` with the old values

## 6i. Test-vault feedback round (2026-10-08; needs `npm run dev`)
- [ ] Review update… and Manage kit files: each row starts with a chip (symbol + words, coloured); readable in light, dark and phone width; "Kept…" group title explains itself
- [ ] 00 Home: the Go to bar shows an icon on each button; the top row's third button is **New lab entry** (flask) and works (Restore kit original on 00 Home, then Check setup → Meta Bind → Fix if the button is missing)
- [ ] Fresh install: no meeting series; `08 Meetings/Meetings.md` shows the three buttons (Check setup → Meta Bind → Fix first) and "No meeting series yet."; Go to → Meetings opens it; Go to has no Meeting deck; New meeting series then makes a series that the card lists
- [ ] Tidy up notes on a copy of your notes: "Notes outside the folder layout" lists only notes really outside the kit's folders
- [ ] `07 How-tos/Obsidian/Hotkeys.md` is installed (Review update…); try two of its keys in Settings → Hotkeys
- [ ] Esc cancels (release-test fix c; Restore kit original on To-do and Lab Book Template first): New to-do: Esc in the text box, the project picker and the meeting picker (needs two series) each make no note and leave no empty note behind; Enter on an empty box gives "Untitled to-do"; "(no project)" skips
- [ ] New lab entry: the Lab Kit box opens (not Templater's), Esc makes nothing, Enter on empty gives `0001 - Untitled`, a title gives one note named from it
- [ ] Check setup → Templater: "Folder template for <Lab notes folder>" appears with only the lab kit on; Fix adds it; then a note made by hand in that folder starts the Lab Book Template (asks its title once, no second note)
- [ ] Sort inbox (planning kit on, a few inbox notes): the picker sits small at the right edge, no dark backdrop; the note behind can be read and scrolled; Esc still stops; the follow-up pickers (project, folder, delete) sit there too; at phone width the picker is centred as before. The name box (Enter keeps it) is still centred
- [ ] Check setup → Templater: a `Script …` row per Templater user script (all there = green); delete `labForm.js` from the scripts folder → red, Fix-less, "Review update…" puts it back. With Force note view mode on: "Homepage opens read-only" is green; remove `obsidianUIMode` from 00 Home → red with Open
- [ ] Settings → Lab Kit → **Check hotkeys…**: the list shows each Hotkeys-note key with ✓ set / ✗ not set / ! your own key, and the command name Obsidian really has; check the third-party ones (Navigator, Daily notes, Omnisearch, ZotLit ×3) say "No command with this name" only when the plugin is off (if not, tell me the real name); set Alt+S in Obsidian → reopen → ✓; Copy as Markdown pastes a table. Check setup shows no Hotkeys group
- [ ] New concept template (planning kit; Review update… first): in test-vault run Templater → *New concept*: title box, topic picker (existing folders + "(new topic...)"), the note lands in `06 Knowledge/<Topic>/`, properties show `kind` / `summary` / `sources` / `checked`, cursor on the empty line; Esc at each box makes nothing; an existing title is refused. Read the wording of the rules note on the Knowledge index and of the Knowledge notes section in Vault spec: change anything you don't like
- [ ] Token templates (Alt+S) and Chemical class: put a note with a header in test-vault's Snippets folder (for example `{"title":"Try","icon":"list","desc":"x","fields":[{"key":"codes","label":"Codes"},{"key":"s","label":"Solvent","suggest":"chemicals","class":"solvent"}]}` written as YAML, body `{{#each codes}}{{prefix}}{{.}}` ) → it is listed under its title with its icon, the form asks both fields, the inserted text has your initials and the note number; a broken header shows a message and inserts nothing; the kit's own snippets still insert. Give two chemicals `Chemical class: solvent` and `monomer`: Raft's Solvent lists the solvent first, Monomer(s) the monomer first; Settings → **Only suggest chemicals of the asked class** on: only those are listed (Review update… first for the new script)
- [ ] Due-date countdown (planning kit; Review update… then Restore kit original on the To-do template): Settings → Planning folders → Due-date countdown. Give to-dos a `due` of today, tomorrow, +5 days and 2 days ago. Off: no badge. Every to-do: badges `Today`, `Tomorrow`, `5d`, `2d late` at the card's bottom right, amber for soon, red for late, none on a done card (tick one) or a card with no due; the title and tick circle are not covered (try a 3-line title, light and dark). Only to-dos with countdown: true: only a to-do with `countdown` ticked shows one. Change `due`: the badge updates at once. Phone width

- [ ] Board folder after a rename (planning kit installed): open the To-do board, then rename `00 Planning` to `00 Planning moved` in the file explorer. Expect a notice "These boards still look in the old folder…" with **Patch folder only**; click it: the board lists the to-dos again, only the `file.inFolder` line changed (compare with the copy in the backup folder). Repeat for Lab book (rename the lab Notes folder) and Chemical database. Rename back: the board follows without a notice if you did not edit it
- [ ] Pre-release fixes (2026-10-09): Manage files… at desktop width: the path shows in full with the buttons below it; a kept note (00 Home) has one chip. Review update… (change a kit file first): New and Updated rows have a tick box, Untick all leaves them as they are. 00 Home: Go to shows Meetings once (also with the old `extra: Meetings` line still in your Home). Make my own copy of Sample list: Alt+S lists it under the name you gave. A bare note in the to-dos folder: Tidy up notes offers "To-dos: add the properties the board needs"

## 7. Lab header
- [ ] ```` ```lab-header ```` draws hazards (chips and table layouts)
- [ ] Change a chemical's `H_Phrase`: header redraws, no stutter
- [ ] Data folder button works (needs a root in settings)

## 8. What's new and docs
- [ ] Command "Show what's new" and the Settings button open the popup; GitHub link works
- [ ] Open `docs/tutorial.md` in a vault **with Dataview on**: no inline `=` errors

- [ ] Manage files… → a snippet row (not Analysis table): **Make my own copy** asks a name (prefilled `… (mine)`; Esc makes nothing); the copy appears in Snippets and in Alt+S; a second copy with the same name becomes `… 2`; Review update… does not list it; a sample snippet's Notice says the codes are fixed. On a phone too
- [ ] **Make my own copy on a token template** (Sample list, Sampling timetable, Flow column prep…): Manage files… → the row has the button; the copy is the same text with the header (open it, check Properties show); Alt+S lists it (same title as the original) and asks the same questions; Notice has no "codes are fixed" sentence
- [ ] Token templates, Phase 4 (after Review update…): Alt+S → each of Variant naming matrix, Sample list, Sampling timetable, Flow column prep, Residence times, Blank calc table opens its form and inserts tables like before (compare with an older note); open one of the six files in the Snippets folder: header and `{{tokens}}` readable; Manage files… shows an **Open** button on those six and none on Solution prep; the Solvent field of Flow column prep suggests solvents; then NMR samples after a Sample list takes its codes

## 9. Mobile (or phone emulation: `app.emulateMobile(true)` in the dev console)
- [ ] Plugin loads without errors
- [ ] Calc tables render and edit
- [ ] Header says "Data folder: desktop only"
- [ ] Built-in kit install works; merge cards fit at phone width
- [ ] Settings page is usable: at phone width the Kit version row's buttons (Manage files / Review update / Update all safe files) and Set up stay on screen
- [ ] New to-do due date (Restore kit original on the To-do template first): New to-do asks title, project, (meeting), then **Due date?**. Enter on empty: `due` empty, no countdown question. A wrong text (`tomorrow`) asks again; Esc cancels the whole to-do. A date `2026-10-14`: asks Countdown, and `due` shows in Properties as a date (calendar icon), `countdown` as a tick box matching your answer. With the setting Only to-dos with countdown: true, the badge shows only after answering yes
- [ ] Command palette: **Lab Kit: New concept** asks title and topic and files the note under the Knowledge folder; **Lab Kit: New chemical** makes an Untitled note from the Chemical database template in the Chemical folder (made if missing) and opens it; with the Chemical folder setting empty it says so
- [ ] **Lab Kit: New topic hub** (Review update… first for the new template): lists the topic folders under Knowledge with no hub, plus "+ New topic…"; the note lands as `<Topic>/<Topic>.md` with `kind: hub`, a text line to write over, and a list of the topic's notes (Dataview on); Esc at the picker or name box makes nothing; a topic that has a hub is not listed
- [ ] Home tiles (Restore kit original on 00 Home first): each tile heading is a link (To-do board, Lab book, Projects overview, Literature, Meetings); a tile with more than 8 rows stops at 8 unless its block has `limit:`
- [ ] Alt+S no longer lists **Analysis table**; your Methods-folder methods and NMR / GPC / DLS are still there; **Combined results** still builds the results table
- [ ] Project deadline (Review update… for the Project hub template; Settings → Lab Kit → Due-date countdown on): New project has a **Deadline** date picker and a deadline line; a date shows a badge (`deadline 5d`, `Tomorrow`, `2d late`) on the hub, the Projects overview card and the Home Projects tile; `Status: Done` hides it; countdown Off shows "Deadline countdown is off"
- [ ] Checklist progress (Settings → Lab Kit → Checklist progress on; Restore kit original on the Lab book base for the new card property): ticking a box in a lab note or the Shopping list writes `progress: 3/7` about two seconds later; the kanban card shows it; removing every box removes the property; Off writes nothing
- [ ] Manage kit files: **00 Home** and the Lab book base (kept files) show **Newer kit version available** and **Replace with new version…**; the prompt says your copy is deleted and a backup is saved first; after Replace the row is Up to date and the backup exists
- [ ] Lab book base has the **Experiments** kanban and an **All experiments** list including Closed notes older than 30 days
- [ ] Settings → Lab Kit → Built-in kit → **Clear old backups…**: lists how many backups there are, the dropdown (older than 30 days / 7 days / all) changes the count, **Move to trash** moves only the dated folders to the trash, anything else in the backup folder stays
- [ ] The Templater row (Set up) is gone from Kit folders and setup; Check setup's Templater rows (template folder, user scripts folder, Insert snippet hotkey) each have a working Fix
- [ ] Meetings hub (Replace with new version… first): one card per series with next date, interval, note count; **New meeting note** on a card makes the note for that series without asking which; **Open** opens the series hub; phone width stacks the cards
