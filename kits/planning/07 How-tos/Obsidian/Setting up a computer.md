---
kind: guide
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
| **Obsidian** - full installer, not just the in-app update | The vault runs in it | Settings > About > *Installer version* |
| **Google Drive for desktop** | Meeting deck button opens the deck through it | The deck path in your meeting series note opens |

## 2. Obsidian - once, after the vault arrives

1. **Enable community plugins** if Obsidian asks (Settings > Community plugins > Turn on).
2. **Lab Kit** - run **Check setup…** (Settings > Lab Kit). It lists what this computer is missing (plugins and Obsidian's own Bases and Daily notes, kit files that are missing or have an update waiting, Templater's folders, Meta Bind buttons, the homepage, the Daily notes folder and date format, the deck path) with a **Fix** where Lab Kit can make the change. The window stays open while you work through it; **Check again** redraws it.
3. **Omnisearch** - let it build its index (first search is slow); if results look wrong, clear its cache in its settings.
4. **Hotkeys** - they carry over, with `Ctrl` becoming `Cmd` on the Mac. Test `Alt+H` (Option+H on the Mac) - if a key types a symbol instead, tell Claude which.

| Windows | Mac |
|---|---|
| `Ctrl+E`, `Ctrl+P` | `Cmd+E`, `Cmd+P` |
| `Alt+` + letter (see [[Hotkeys]]) | `Option+` + letter |
| `Alt+Shift+...` | `Option+Shift+...` |

## 3. When the deck moves

- Update **both** deck paths, `deck_windows` and `deck_mac`, in your meeting series note.

## 4. Quick test on the new computer

1. `Alt+H` opens the homepage.
2. `Alt+D` makes today's note with the template filled in.
3. **Meeting deck** opens the deck (or the folder of decks).
4. **Projects** on the homepage shows a card per project, and a card's **New note** button makes a note in that project's folder.
5. **To-do board**: today's column is **blue** and clicking a card's circle turns it green. If not, check the planning kit is on and its files are installed (Settings > Lab Kit > Updates), then restart Obsidian. Lab Kit does the roll-over itself; no Templater startup template is needed.

> [!note] Keeping this list right
> Anything new that has to be set up per computer goes here - see the rule in [[Vault spec#Rules for changes|Vault spec]].
