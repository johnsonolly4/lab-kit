# Phase 3: planning kit files (session plan)

_Written 2026-10-07 by Claude while the user was away ("don't stop for an hour"). The `reviewer` agent checked it, not the user. The decisions below are also in `docs/decisions.md`; change any of them._

## Goal
`kits/planning/` holds the planning suite, and `npm run kit:manifest` builds its manifest. The kit installs into an empty vault, and into a vault that already has the old suite files, without overwriting any of them (tests). This phase adds no UI: the plugin embeds the planning kit but does not offer to install it yet. Phase 6 adds the setup check and Phase 8 the starter.

## Files: `docs/plans/kit-files/planning/` → `kits/planning/` (same paths)
| Shipped | Policy |
|---|---|
| `00 Home.md`, `00 Planning/` (To-do board.base, Weekly review, Shopping list), `02 Projects/Projects overview.md`, `06 Knowledge/Knowledge index.md`, `07 How-tos/How-tos index.md`, `07 How-tos/Obsidian/` (3 notes), `08 Meetings/Weekly meetings/Weekly meetings.md` | `keep`: installed once, then the user's |
| `04 Literature/Literature.md`, `Extras/Templates/ZotLit/*.liquid.md` | `keep` / normal, and `needs: "plugin:zotlit"`: off unless ZotLit is installed |
| `Extras/Templates/` (To-do, Daily note, Project hub, New project note, Weekly meeting), `Extras/Templates/Actions/` (Sort inbox, Add to shopping list, Archive old to-dos) | normal (updated, three-way merge) |
| `Extras/scripts/templater/vault/vtAsk.js` | normal; role `userScripts` = `<Templater user scripts folder>/vault` (Phase 0 rule: a set folder is never changed) |
| `.obsidian/snippets/vault-colours.css`, `vault-theme.css` | normal |

**Not shipped in Phase 3**
- `Actions/To-do roll-over.md`: Phase 4 moves it into plugin code. Shipping it now and retiring it later would leave a "Retired" file in every vault.
- `Actions/Open Thursday deck.md`: Phase 5 replaces it with meeting series.
- `settings/*.json`: data for Phases 4–6.
- `vault-fonts.css`: needs a licence check first.
- **New concept template and knowledge rules**: the plan names them, but no source exists and the rules (concept / comparison / topic hub, `summary`, `sources`, `checked`) are not written down anywhere. Waiting on the user (BACKLOG "Decisions needed").

## Code
- `scripts/kit-manifest.mjs`: CONFIG for `planning` with:
  - Role prefixes: `.obsidian/snippets/` → cssSnippets; `Extras/scripts/templater/vault/` → userScripts; `Extras/Templates/` → templates; any other top-level folder or `00 Home.md` → a role named after its folder (`home` = vault root, `planning`, `projects`, `literature`, `knowledge`, `howtos`, `meetings`). Kind `note` for those.
  - DESC lines, keepFiles, and `needs` for the ZotLit files.
- `kits/planning/kit-manifest.json`: id `planning`, version 0.5.2 (the kit version follows the plugin's, and only `/release` moves it). `tests/versions.test.ts` already compares `kits/lab`; extend it to every kit.
- `src/kit/paths.ts`: add `planningRoles(app, tracked)`.
  - Defaults are the folder contract: `Extras/Templates`; `<Templater user scripts folder or Extras/scripts/templater>/vault`; snippets; backups in the plugin folder; fixed note folders.
  - Tracked roles win.
  - No rewrite yet. The folder settings come in Phase 5, and today every literal equals its default.
- `src/kit/managed.ts` `offIds`: `needs: "plugin:<id>"` is satisfied when that plugin id is in a set passed in (`installedPlugins`). It stays pure.
- `KitController` and the settings tab stay unchanged; the lab kit is still the only one managed in the UI.

## Tests (`tests/kit-planning.test.ts`, new)
- Every planning file has a role, a desc and a kind. No file is under `settings/`, and no personal path appears in the kit (`/Users/`, `C:\Users`).
- Empty vault: every file is `create` (ZotLit files `off` without ZotLit, `create` with it). After apply, a second plan is all `up-to-date`.
- A vault with the old suite files at the same paths (different text): every existing file's hash is unchanged after apply, and the `keep` files are listed as left alone.
- Templater user scripts folder set to `My scripts` → vtAsk.js goes to `My scripts/vault/vtAsk.js`, and the folder setting is not touched.
- Lab and planning kits together: no two files share a destination path.

## Done when
`npm test` and lint pass, `npm run build` passes, and main.js grows only by the planning files' size.
