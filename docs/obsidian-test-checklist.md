# Obsidian test checklist (before 0.4.0)

> [!info] How to use
> Test in `test-vault/` only. Tick as you go. Write what broke under the item, then paste it to Claude with `/feedback`.
> About 45 min. Order matters: later steps use files from earlier ones.

## 0. Setup (5 min)
- [ ] Obsidian is 1.13 or newer (Settings → About)
- [ ] Terminal: `npm run dev`, open `test-vault/`, Lab Kit is on
- [ ] Templater is on and set to **Templates** folder and **Extras/scripts/templater** scripts folder
- [ ] The old hand copies in `test-vault/Templates/` and `test-vault/Extras/` are stale. Delete both folders first so step 2 starts clean

## 1. Settings page
- [ ] Settings → Lab Kit opens, rows in a sensible order
- [ ] Type a value (Initials), close Obsidian settings, reload the plugin: value is still there
- [ ] Settings search finds "legend"
- [ ] "Per-note options" is its own row; "Install locations" has a "Show" link. Happy with both?

## 2. Built-in kit install
- [ ] Built-in kit group shows version row and three folder boxes
- [ ] Scripts folder refuses a dot folder (notice on blur)
- [ ] Review update… asks before first install, then Apply creates the files
- [ ] Report window lists them; nothing broken in the file tree
- [ ] Edit an installed template, Review again: it says "changed by you"
- [ ] Delete one file, Review again: it says "missing" and offers to recreate

## 3. Manage kit files
- [ ] Opens from Settings and from the command palette
- [ ] Badges readable (colours OK)
- [ ] Install / Update / Recreate works on one file
- [ ] Edit a template → **Restore kit original** (confirm, backup lands in the Backup folder, by default `.obsidian/plugins/lab-kit/backups/<date>/…`, not visible in the file list)
- [ ] Detach, then Re-attach
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
- [ ] Sample list form: toggle heading reads "Also add (appended below)"
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

## 7. Lab header
- [ ] ```` ```lab-header ```` draws hazards (chips and table layouts)
- [ ] Change a chemical's `H_Phrase`: header redraws, no stutter
- [ ] Data folder button works (needs a root in settings)

## 8. What's new and docs
- [ ] Command "Show what's new" and the Settings button open the popup; GitHub link works
- [ ] Open `docs/tutorial.md` in a vault **with Dataview on**: no inline `=` errors

## 9. Mobile (or phone emulation: `app.emulateMobile(true)` in the dev console)
- [ ] Plugin loads without errors
- [ ] Calc tables render and edit
- [ ] Header says "Data folder: desktop only"
- [ ] Built-in kit install works; merge cards fit at phone width
- [ ] Settings page is usable
