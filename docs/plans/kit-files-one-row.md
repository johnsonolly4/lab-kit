# Plan: One "Kit files" row when both kits are on

_Written 2026-10-13 by `/phase-plan` (Sonnet). Waits for the user's approval. Each phase = one session, on Sonnet._

## Goal
With the lab kit and the planning kit both on, Settings → Lab Kit → Updates shows one **Kit files** row with **Manage files…**, **Review update…** and **Update all safe files** that cover both kits: one window, one confirmation, one report.

## Decision taken
Decided with the user 2026-10-13 (chat + two surveys):
- One row, the same three buttons, acting on both kits; a short status line per kit under it (bundled / installed version, files tracked, what is waiting). With only the lab kit on, nothing changes (the row stays "Lab kit").
- **Review update…** and **Manage files…** open one window, **stacked**: a section per kit, each with a heading and a fold arrow. **Updates always go to the top** (user): the kit that has something waiting (an update, a missing or conflicting file, a new file) is the first section and open; a kit with nothing waiting comes after it and is folded closed; inside a kit the files that need attention stay first, as today (`sortByAttention`).
- **Update all safe files** runs both kits' safe actions with **one** confirmation (the folders to create and the settings changes of both kits in one preview, a setting both kits would change shown once) and **one** report.
- The same combined window opens **everywhere** both kits are on (user): the commands **Review kit files** / **Manage kit files**, the update notice at start-up, and Check setup's "Fix opens Review update…". With the planning kit off, nothing changes.
- Rejected: tabs (a tick on the other tab is easy to forget), side-by-side columns (too narrow), only combining the settings row (two ways to do one thing).
- Claude's choices, the user can overrule: the planning kit's on / off toggle stays its own row above (it is not a file button); a kit that is enabled but not installed yet is a section like any other (its files are all "new", it comes first); Apply in Review writes each kit with its own backup folder stamp as today (one global backups root); a kit whose apply fails does not stop the other, and the report says which failed.

## Out of scope
- Any change to what a file action does (merge, restore, keep, detach, make my own copy): the per-file buttons in Manage files… stay as they are.
- Backups, Kit folders and Snippet icons rows.
- A third kit (the structure is "a list of kits", so one could be added, but nothing is built for it).

## Phases

### Phase 1 — The pure core (no windows) — DONE 2026-10-13
- Depends on: nothing.
- Spike first (by reading): the types behind `previewInstall` (`src/kit/managed-ui.ts` `confirmThen` 112-130, `SettingChange`, `kitFolders`, `firstInstallSettings`, `hotkeySetting`) and `ManagedItem` (`src/kit/managed.ts` 47-178): what a merged preview has to hold.
- Files: new `src/kit/kit-set.ts` (pure: `orderKits(sections)` → attention first, then by name; `attention(items)` count; `kitStatusLine`; `mergePreviews(previews)` → one list of folders to create (deduplicated by path), one list of settings changes (deduplicated by id; asked if any kit's first install asks), and which kit each came from), `tests/kit-set.test.ts`.
- Result 2026-10-13: spike answer: a merged confirmation holds, per kit, an `InstallPreview` (create / update / leftAlone / folders / about), the `SettingChange[]` (name, desc, apply), the `PreviewNote[]`, and whether it `ask`s; two kits can both offer "Turn on the CSS snippet" with different text, so only a change with the same name AND text is merged, the rest stays separate. `src/kit/kit-set.ts` (`waitingCount`, `orderKits`, `kitStatusLine`, `mergeParts`), `PreviewNote` now exported, `tests/kit-set.test.ts`. Tests 972.
- Done when: tests cover the ordering (updates first, a fully up-to-date kit last and folded, a kit not installed yet first), the merge (two kits that both want the CSS snippet or the Templater scripts folder give one setting; folders deduplicated; nothing to ask returns "no confirmation"), and the status lines; `npm test` and `npm run lint` clean. Nothing visible changes.
- New dependencies: none

### Phase 2 — Update all safe files, both kits, one confirmation — DONE 2026-10-13 (engine only; nothing calls it from a button yet)
- Depends on: Phase 1.
- Files: `src/kit/managed-ui.ts` (a small `KitSet` over the `KitManaged` instances: `updateSafe()` plans each kit, builds the merged preview, asks once (`KitInstallModal` shows the merged list, a heading per kit), then applies each kit in turn and shows one `KitReportModal` with results per kit; a failed kit is reported and the other still runs), `src/kit/ui.ts` (`KitController` builds the `KitSet` from `managed` and `planning`), tests for the order of operations with fake `KitManaged`-like objects (they are an interface in the test: `plan`, `preview`, `apply`).
- Result 2026-10-13: `runSafeUpdate`, `combinePreviews` and the `SafeKit` / `SafeKitPlan` interfaces in `kit-set.ts`; `KitManaged.safeSpec()` (shared by the old `updateSafe()`, whose behaviour is unchanged) and `asSafeKit()`; `KitSet.updateSafe()` in `kit-set-ui.ts` (uses the existing `KitInstallModal` with the combined list, one `KitReportModal`; both are exported now); `KitController.kitSet()` gives the kits that are on. No button or command calls `kitSet().updateSafe()` yet: that is Phase 4 (so the user cannot press it before then, by design). Tests 979 (fake kits: order, one confirmation, Cancel writes nothing, a failing kit or setting named and the other still runs, a switched-off setting not made).
- Done when: tests cover: both kits' safe items applied after one confirmation; cancelling writes nothing in either kit; one kit failing does not stop the other; with the planning kit off only the lab kit runs; NOT seen in Obsidian until the user has pressed it on a vault with both kits (checklist row).
- New dependencies: none

### Phase 3 — The two combined windows — BUILT 2026-10-13, not seen in Obsidian
- Depends on: Phase 1 (ordering); Phase 2 for the shared confirmation.
- Files: `src/kit/managed-ui.ts`: `KitManagedModal` (Review) and `KitFilesModal` (Manage) take a list of kits and draw a section per kit (heading with the status line, fold arrow, the existing per-kit body unchanged); Review's Apply collects the ticks of every section, asks once through the Phase 2 merged confirmation, applies each kit. `src/kit/ui.ts`: the commands, the start-up notice buttons and `KitController` entry methods `review()` / `manage()` open the combined window when the planning kit is enabled.
- Result 2026-10-13: `KitReviewSection` and `KitFilesSection` (one kit's body, drawn into a container, extracted from the old windows with no change to what a kit shows), `KitManagedModal(app, kits, applyMany)` and `KitFilesModal(app, kits)` (one kit: as before; two: a `<details>` section per kit ordered by `orderKits`), `KitSet.review()` / `manage()` / `applyReviewed()` (one confirmation through `runSafeUpdate`), `asSafeKit(picked)` for the review's ticks, `KitController.review()` / `manage()`; the two commands and the start-up notice use them. The windows have no automated test (the Setting stand-in in the tests has no methods): only the tick-free parts are tested (order, merge, run). Check setup still opens `lab.manage()` / the kit's own review (Phase 4). Tests 979.
- Done when: the existing per-kit behaviour is unchanged for one kit (tests in `tests/managed.test.ts` untouched and green); a test for the section list and its order (a kit with updates first and open, an up-to-date kit last and folded); the per-file actions in Manage files… still refresh the window; NOT seen in Obsidian until the user has opened both windows with both kits on.
- New dependencies: none

### Phase 4 — The settings row, Check setup, docs
- Depends on: Phases 2 and 3.
- Files: `src/kit/ui.ts` (`builtInGroups` 93-149: one "Kit files" row with the three buttons and a status line per kit when the planning kit is enabled; the "Update available" row names the kit(s); the lab-kit-only row stays when the planning kit is off; the planning toggle row stays), `src/kit/setup-check-ui.ts:182-203` (the `manage` and `install` fixes open the combined window when both kits are on), `src/kit/setup-check.ts:224,251` and the notices at `ui.ts:135,435-436` (wording: "Review update… in Settings → Lab Kit" still true), tests for the Check setup fixes, docs per `docs/maintenance.md` (README Settings, tutorial, changelog, `docs/obsidian-test-checklist.md` row, `docs/architecture.md`).
- Done when: tests, lint and build clean; the checklist row says what to press (Settings → Lab Kit → Updates with both kits on: one row, the three buttons, the window with both kits, updates first); nothing left unticked in BACKLOG "One set of file buttons" except what is not seen.
- New dependencies: none

## Order check
1 → 2 → 3 → 4. Phase 2 needs the merged preview (1). Phase 3 reuses the merged confirmation (2) and the ordering (1). Phase 4 only changes where the entry points lead, so it is last and the old rows keep working until then.

## Verification
- The pure parts by tests (Phase 1) and the order of operations with fake kits (Phase 2).
- Nothing in `src/kit/managed-ui.ts` is covered by tests today (explorer, 2026-10-13), so every window and button is "not seen" until the user has pressed it; the plan keeps the per-kit bodies untouched so the risk sits in the new section wrapper and the merged confirmation.
- A vault copy with both kits installed and a file changed in each (one kept, one conflicting) is the test case for the user.
