# Kit files 2026-10-07 - what changed from the vault copies

Kit-ready copies of the planning suite and the lab kit additions, laid out by the folder contract in `docs/plans/planning-suite-kit.md`. Source: the owner's vault files (uploaded 2026-10-07), the 2026-10-06 "vault-all-latest" copies, and the 2026-10-07 colour, font and roll-over work. Nothing here is a personal note.

For Claude Code: Phase 3 copies `planning/` into `kits/planning/` and `lab/` into `kits/lab/` (keeping the folder paths), then regenerates the manifests. The `settings/` folders are data for Phases 1, 4 and 6, not files to install.

## Personal details removed (the repo is public)
| File | Change |
|---|---|
| `00 Planning/Shopping list.md` | Owner's shopping items removed; empty list with the two buttons |
| `08 Meetings/Weekly meetings/Weekly meetings.md` | Deck path with the owner's username removed (`deck_windows: ""`, `deck_mac: ""`) |
| `00 Home.md` | PhD plan button (personal canvas) removed from Go to |
| `06 Knowledge/Knowledge index.md` | Link to a personal canvas removed |
| `07 How-tos/Obsidian/Vault spec.md` | A personal health detail in the Principles callout reworded ("Designed for focus"); the personal top-level folder row replaced by `08 Meetings/`; PhD plan removed from the homepage list; personal changelog replaced by one line |
| `settings/meta-bind-buttons.json` | PhD plan button left out |

## Folder layout (agreed in the design doc)
| Change | Files |
|---|---|
| Personal top-level folder → `08 Meetings/Weekly meetings/` | Weekly meetings hub (query), Weekly meeting template (`folder`), Sort inbox ("Meetings..." choice), Vault spec, buttons |
| `Extras/Templates/Scripts/` → `Extras/Templates/Actions/` | All Actions scripts, Vault spec, Setting up a computer, buttons, Templater startup template |
| Chemical database template → `Extras/Templates/Lab Kit/` (lab kit's folder) | lab `settings/templater.json` folder template |

## Other changes
| File | Change |
|---|---|
| `lab/05 Chemicals/Chemical database.base` | Its second view used Bases Board (no longer installed); now Obsidian's built-in kanban "By class", grouped by `Chemical class` |
| `Vault spec.md` | Theme: Obsidian default (not Iridium); font via `vault-fonts.css` (not Custom Font Loader); Snippets row and board-colour paragraph match the 2026-10-07 CSS |
| `settings/meta-bind-buttons.json` | "Key papers" (`go-papers`) left out: same target as Literature, unused |

## Not changed (on purpose)
- "Thursday" wording in the meeting hub, template, guide and spec: Phase 5 replaces it with meeting series.
- Lab property names (`Type`, `H_Phrase`, `Names`, ...): lab vocabulary stays.
- The lab kit's `Lab Book Template.md` is not included: the repo's `kit/Templates/` copy is the master. One change from the vault copy still needs to go into it (text box via `vtAsk`, falling back to Templater's box):
  ```
  - const title = (await tp.system.prompt("Experiment title")) || "Untitled";
  + // Text box: same look as the vault's pickers (vtAsk.js); falls back to Templater's box if it is missing
  + const title = (await (tp.user.vtAsk ? tp.user.vtAsk(tp, "Experiment title") : tp.system.prompt("Experiment title"))) || "Untitled";
  ```

## Checked
- Searched every file for the owner's name, username, university and project names, file paths, the personal folder name and health details: none left (the embedded font data in `vault-fonts.css` excluded from the text search).
- Not checked in Obsidian: the Chemical database kanban view, and the files at their new paths.
