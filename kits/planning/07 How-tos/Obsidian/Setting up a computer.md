---
cssclasses:
  - vt
---

```vault-card
show: back-to-hub
```

> [!focus] When to use this
> - Setting up the vault on a **new** computer (Windows or Mac).
> - Something works on one computer but not the other - check the list below.
>
> Everything *inside* the vault (notes, templates, `.obsidian` settings) arrives with the vault. This note lists what **doesn't**: apps, add-ons and settings that live on each computer.

## 1. Install the apps

| App | Why | Check |
|---|---|---|
| **Obsidian** - full installer, not just the in-app update | ZotLit needs installer 1.13.4 or newer | Settings > About > *Installer version* |
| **Zotero** 7 or newer | Reading and highlighting | Help > About Zotero |
| **Google Drive for desktop** | Meeting deck button opens the deck through it | The deck path in your meeting series note opens |

## 2. Zotero add-ons and settings

These live in Zotero on each computer - Zotero sync does **not** copy them.

1. **ZotLit Companion** - Tools > Plugins > install from file. Needed for live updates.
2. **Better BibTeX** - same way. Then set the **same citation key formula** as the other computer (Settings > Better BibTeX > Citation keys).
3. **Zotero sync** - signed in (Settings > Sync), so highlights, tags and `Projects/` collections reach both computers.
4. **Check**: pick one paper and compare its citation key on both computers. They must match exactly - the key is the note's filename, and a mismatch makes a duplicate note.

> [!warning] Citation keys must match
> If the two computers give a paper different citekeys, ZotLit makes a second note for it and every `[[link]]` points at the wrong one. Fix the formula before making any notes on the new computer.

## 3. Obsidian - once, after the vault arrives

1. **Enable community plugins** if Obsidian asks (Settings > Community plugins > Turn on).
2. **ZotLit** - open Settings > ZotLit and check it found Zotero (it detects the Zotero folders itself, separately on each computer). If not, set the Zotero data directory by hand. When it asks to import highlight images, allow it.
3. **Lab Kit** - run **Check setup…** (Settings > Lab Kit). It lists what this computer is missing (plugins, Templater's folders, Meta Bind buttons, the homepage, the deck path) with a **Fix** for each.
4. **Omnisearch** - let it build its index (first search is slow); if results look wrong, clear its cache in its settings.
5. **Hotkeys** - they carry over, with `Ctrl` becoming `Cmd` on the Mac. Test `Alt+H` (Option+H on the Mac) - if a key types a symbol instead, tell Claude which.

| Windows | Mac |
|---|---|
| `Ctrl+E`, `Ctrl+P` | `Cmd+E`, `Cmd+P` |
| `Alt+` + letter (see [[Hotkeys]]) | `Option+` + letter |
| `Alt+Shift+...` | `Option+Shift+...` |

## 4. When the deck moves

- Update **both** deck paths, `deck_windows` and `deck_mac`, in your meeting series note.

## 5. Quick test on the new computer

1. `Alt+H` opens the homepage.
2. `Alt+D` makes today's note with the template filled in.
3. Make a ZotLit note for a paper you've already highlighted - colours land in the right sections and its filename matches the other computer.
4. **Meeting deck** opens the deck (or the folder of decks).
5. **Projects** on the homepage shows a card per project, and a card's **New note** button makes a note in that project's folder.
6. **To-do board**: today's column is **blue** and clicking a card's circle turns it green. If not, check the planning kit is on and its files are installed (Settings > Lab Kit > Built-in kit), then restart Obsidian. Lab Kit does the roll-over itself; no Templater startup template is needed.

> [!note] Keeping this list right
> Anything new that has to be set up per computer goes here - see the rule in [[Vault spec#Rules for changes|Vault spec]].
