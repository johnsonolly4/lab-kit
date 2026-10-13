# Plan: plan-map styles in the plugin's styles.css

_Agreed: 2026-10-13. Written by `/phase-plan`. Each phase = one session._

## Goal
The plan map's look arrives with the plugin update, not only after Review update… for the theme snippet.

## Decision taken
Move the `.vt-map*` rules (and `.vt-plan-title:has(> .vt-map-dir)`) from `kits/planning/.obsidian/snippets/vault-theme.css` (about lines 470-585) to the repo-root `styles.css`, which today holds only calc tables.
- Colour variables from the snippet (`--vt-card-bg`, `--vt-card-border`, `--vt-divider`, `--vt-card-title`) get inline fallbacks to Obsidian variables, e.g. `var(--vt-card-border, var(--background-modifier-border))`: the snippet still wins when enabled. (user, survey)
- Restyling: a vault snippet overrides the defaults (same selectors; snippets load after plugin CSS). Said once in the docs. (user, survey)
- The old rules are removed from the snippet; vaults that have not run Review update… give the same result from their old copy plus the new `styles.css`. (user, survey)
- Rejected: defining the variables again in `styles.css` (drift); Obsidian colours only (map stops matching the cards).

## Where CSS goes: the rule (written down in Phase 2, so later work can follow it)
1. **Plugin `styles.css`**: rules for DOM the plugin code creates or tags (a class or `data-vt-*` attribute set in `src/`), and the behaviour-bound parts of it (layout, hit areas, hover/drag states, hidden toggles). It must work with no theme snippet, so colours use Obsidian variables, with `var(--vt-…, <Obsidian variable>)` where the snippet may refine them.
2. **Vault snippet** (`vault-theme.css`, `vault-colours.css`): the vault's look: headings, links, callout types, colours, and Obsidian's own DOM (Bases / kanban, Live Preview). The user restyles here; it also overrides `styles.css`.
3. **Both** for a look the plugin needs and the user may change: structure in `styles.css`, colours as variables the snippet defines.
4. Note content made by kit templates (callouts, `cssclasses`) is rule 2 even though the kit ships it.
A new rule goes where this table says; a rule that fits neither is a question for the user. Lab Kit's `.vt-*` prefix stays.

## Survey of other candidates (2026-10-13; classes found in the snippet and in `src/`; each is a separate later decision, NOT part of Phases 1-2)
| In `vault-theme.css` | Plugin code sets it? | Suggested |
|---|---|---|
| `.vt-map*` (about 115 lines) | yes (`plan-map-render.ts`, `blocks.ts`, `plan-slide-ui.ts`) | move: Phase 1 |
| `.vt-plan`, `.vt-plan-title` (lines 263-269), the Show-all button corner (260-262, 271) | yes (`blocks.ts`) | move later: Phase 3 candidate, same variables |
| `.vt-hub-bar`, `.vt-back` (285-287, 468) | yes (`blocks.ts`) | Phase 3 candidate |
| `.vt-card*`, `.vt-cards` (project cards, section 10) | yes (`src/planning`) | Phase 3 candidate; carries most of the `--vt-card-*` look, so it needs a fallback decision |
| `.vt-badge`, `.vt-muted`, `.vt-tile-toggle`, `.vt-help` | yes | Phase 3 candidate; the badge colours come from `--vt-*` triples in `vault-colours.css`, so rule 3 |
| Kanban data attributes: `data-vt-due`, `data-vt-tag`, `data-vt-prio`, column tint (section 11) | attributes set by the plugin, but they style Obsidian's own Bases DOM | stay in snippet (rule 2); the DOM is not ours and BACKLOG says the DOM was never seen |
| Callout types, columns, headings, links, sticky tabs, homepage | no (note content / Obsidian) | stay (rule 2) |
| `kits/lab/.obsidian/snippets/scrolling-mermaid.css` | no | stay |

## Out of scope
- Moving anything in the survey table except the map. Phase 3 is the user's call after Phase 2.
- Any change to how the map looks. A pure move: same rules, same order, same values.
- Elements whose CSS variables are set by plugin code (`--vt-map-x`, `--vt-map-zoom`, `--vt-pop-x` …): untouched.

## Phases

### Phase 1: move the rules
- Files: `styles.css`, `kits/planning/.obsidian/snippets/vault-theme.css`, `kits/planning/kit-manifest.json` (via `npm run kit:manifest`), new `tests/plan-map-styles.test.ts`.
- Steps: copy every rule whose selector contains `vt-map` (list: `grep -n "vt-map" vault-theme.css`) in the same order to a "Plan map" section at the end of `styles.css`; add fallbacks to the four `--vt-card-*` / `--vt-divider` variables; delete them from the snippet; run `npm run kit:manifest`. Check by diff that nothing else in the snippet changed, and that rules after the move (e.g. `.vt-map-unlinked` `border-top`, `.vt-map-title` colour) do not rely on being later than a snippet rule of equal specificity (list any, fix with the same order or a doubled selector).
- Done when: `npm test` and `npm run lint` pass; the new test fails before the move and passes after: (a) no `vt-map` in `vault-theme.css`, (b) `styles.css` has every `.vt-map*` class that `src/planning/plan-map-render.ts` / `blocks.ts` / `plan-slide-ui.ts` add (grep the source for `vt-map-[a-z-]*`), (c) every `var(--vt-card-*)` and `var(--vt-divider)` in the map section has a fallback; a diff of the rule bodies before / after is identical apart from the fallbacks. Not seen in Obsidian (the user's check is Phase 2's row).
- New dependencies: none

### Phase 2: docs and the user's check
- Depends on: Phase 1
- Files: the rule above into `docs/architecture.md` (a "Where CSS goes" section) and one line in `.claude/rules/obsidian-plugin.md` pointing to it; `docs/changelog.md` (Unreleased), `docs/architecture.md` (where the map styles live; the comments at `src/planning/plan-map-render.ts:2`, `src/planning/blocks.ts:315` say "vault-theme.css"), `docs/obsidian-test-checklist.md` (6i last row: Plan map looks the same with the theme snippet on and off; a note on a vault with an old snippet copy), `BACKLOG.md` (tick the item when the user has seen it; "Not yet tested"), `docs/decisions.md`.
- Done when: docs match the code; the checklist row exists; `npm test` and `npm run lint` pass.

### Phase 3 (optional, user decides after Phase 2): next candidates
- Depends on: Phase 2 and the user's check. One candidate group per session, same method as Phase 1 (move unchanged, fallbacks, test that the snippet no longer has them), following the written rule. Not planned in detail.

## Verification
Beyond tests: the user opens a project hub's Plan map in `test-vault` (1) with the snippet enabled and Review update… not run, (2) after Review update…, (3) with the vault-theme snippet switched off (map keeps its layout, plain Obsidian colours), and says it looks identical to before in (1) and (2). Not claimed until seen.
