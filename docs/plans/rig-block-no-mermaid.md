# Plan: rig block without Mermaid

**PLAN WAITING FOR OWNER** (written 2026-10-20 by `/phase-plan`, Opus, as a side session; nothing built). The owner said yes to "plan a Mermaid-free in-note rig diagram" (owner board, 2026-10-20; `docs/decisions.md` 2026-10-20). The look is the owner's call: every look below is a proposal, asked in BACKLOG "Questions for the owner" (item "Rig block without Mermaid") with a before / after page in Phase 1. Each phase = one Sonnet session.

## Goal
The ```` ```rig ```` block in a rig note draws its diagram with Lab Kit's own figure engine (the one behind **Figure…**, branch `feat/rig-figure`) instead of Mermaid, so Obsidian 1.14.4 no longer asks "Display Mermaid diagrams in this vault?" on the first rig note, and the note shows the same drawing the user saves for a poster. It should look the same or better; the owner decides which.

## What we know (read 2026-10-20)
- Today: `src/rig/render.ts:57` hands `"```mermaid\n" + rig.mermaid + "\n```"` to `MarkdownRenderer.render`; the text comes from `toMermaid` (`src/rig/parts.ts:63-76`): one box per part (ID, then its detail on a second line), `-->` arrows, a dotted line for attached parts (heater, stirrer), left to right. Redraw on edit after 250 ms, skipped when `[mermaid, problems]` is unchanged (`render.ts:53`).
- Mermaid is also used by the Rig snippet: `{{rig-diagram:rig}}` (`kits/lab/Templates/Snippets/14 Rig.md`, `src/kit/snippet-template.ts:276`, `src/kit/snippet-env.ts:70`) writes a **fixed** Mermaid block into the lab note (decision 2026-10-12: the lab note keeps a copy that does not follow later rig edits). That block still triggers the Mermaid question in a lab note.
- The figure engine on `feat/rig-figure` (local, not pushed, tip `4b723a5`): `src/rig/figure.ts` `buildFigure(parts, links, {computer})` (layout, pure), `src/rig/symbols.ts` (generic symbols drawn from scratch), `src/rig/figure-svg.ts` `figureSvg(fig)` → one SVG **string** (black on white, fills as attributes, one `<g data-part>` per part, labels cut to 20 characters with "…"), `src/rig/figure-ui.ts` `makeFigure(text)` (readRig → buildFigure → figureSvg) and the window, which previews the SVG as an `<img>` from a blob URL (`figure-ui.ts`, class `.lab-kit-figure-preview`, white background in every theme). Same pattern as `src/planning/plan-slide-ui.ts:23,80`.
- `git merge-tree overnight/2026-10-19 feat/rig-figure` (run 2026-10-20): conflicts in 7 files, none under `src/rig/`: `README.md`, `STATUS.md`, `docs/architecture.md`, `docs/changelog.md`, `docs/obsidian-test-checklist.md`, `src/kit/paths.ts`, `src/main.ts`.
- Phone pass 2026-10-19 (BACKLOG "Phone pass" item 6, emulation): the Mermaid rig diagram is 720 px wide on a 366 px page and slides sideways (`styles.css:293` `overflow-x: auto`).
- Plugin rules: no `innerHTML`; SVG built with `createSvg` (as `src/planning/plan-map-render.ts:462`) or shown as an image.

## One engine: yes
The in-note diagram can be drawn by the same engine as the publication figure: `makeFigure(text)` already gives the SVG from the note's text without Obsidian. The block shows that SVG as an `<img>` (as the Figure… preview and the slide picture do). Why an image rather than live SVG elements:
- no `innerHTML`, no parser: the SVG string stays the one output, so the saved file and the note can never drift apart;
- scripts in an image never run, which also covers module-pack SVGs later (rig-figure Phase 6);
- works without Node, so on a phone too (to be seen in Phase 2).
Cost: the picture is black on white in a dark theme (like the slide picture), its text cannot be selected, and a part cannot be clicked. Following the theme would need `figure-svg.ts` to build elements (`createSvg`) and the symbols to be data, not SVG text: a larger change kept for later and asked as Q2.
Later rig-figure phases flow in for free: hand layout (`rig-layout` block, rig-figure Phase 5) and module packs (Phase 6) change what `makeFigure` returns, so the note shows them too.

## What changes for users (proposal; Q1-Q4 decide)
- Rig note: no Mermaid question; the diagram becomes the figure (pump circles, tee dot, coil, bowtie valve, flask, vial, dashed coloured control lines when the Control / Data columns are filled) instead of a box per part. Long details are cut at 20 characters (Mermaid showed them whole). The **Figure…** button and the problems list stay as they are.
- Lab note (Rig snippet): per Q4.
- Nothing changes for the user's own Mermaid diagrams: `scrolling-mermaid.css` and the `scrolling_mermaid` cssclass stay (they style `.block-language-mermaid`, which the rig block is not).

## Decision taken
Owner, 2026-10-20 (owner board): plan it. Everything else is open (Q1-Q5). Rejected for now: keeping Mermaid and only adding a line to the README about the prompt (BACKLOG "Mermaid asks once per vault", option a): it answers the prompt but keeps two different drawings of one rig. This plan changes the rig-figure plan's "Out of scope: any change to the existing rig block, its Mermaid diagram" once the owner answers.

## Open questions (one BACKLOG item; answer with the letter; rec = recommended)
- **Q1 What the rig note shows.** (a, rec) the figure itself, the same picture as Figure… and the saved SVG: one look everywhere; (b) today's look (a box per part with ID and detail, arrows) drawn by the figure engine with every part as a box; (c) (a), with a setting to switch to (b).
- **Q2 Dark theme.** (a, rec) a white card with black line art, as the Figure… preview and the slide picture; (b) follows the theme (light lines on dark), which needs live SVG elements (larger change, a phase of its own).
- **Q3 Narrow page and phone.** (a, rec) shrink to the page width down to a smallest size (labels not under about 9 px), then slide sideways; (b) always fit the width, however small; (c) full size and slide sideways, as today. This also answers BACKLOG "Phone pass questions" (c) and Phone pass item 6.
- **Q4 The fixed diagram the Rig snippet writes into a lab note** (a Mermaid block today, so a lab note still asks the Mermaid question). (a, rec) the snippet writes an empty ```` ```rig ```` block, which draws from the parts tables the snippet already copies under `Flow platform setup` in that lab note: no Mermaid, and it stays the lab note's own copy (it follows edits to those copied tables, not to the rig note); (b) save the figure as an SVG file (Figures folder) and embed it with `![[…svg]]`: fixed, but one extra file per lab note; (c) keep the Mermaid block (out of this plan). In every case lab notes already written keep their Mermaid block (no Tidy rule in this plan).
- **Q5 Order with `feat/rig-figure`.** (a, rec) merge `feat/rig-figure` into `overnight/2026-10-19` first (your go; 7 files conflict, none in `src/rig/`), then build here on the integration branch; (b) build Phase 2 on `feat/rig-figure` and merge both later (the conflicts stay the same, the rig-figure branch grows).

## Depends on merging `feat/rig-figure` first
Phases 2-5 need `buildFigure`, `figureSvg`, `symbols.ts`, `makeFigure` and the `control` / `data` fields of `RigPart` (parts.ts on the branch), which exist only on `feat/rig-figure`. Phase 0 is that merge (Q5). Phase 1 (the before / after page) does not need it: it can render the branch's SVG from a worktree.

## Out of scope
- Old lab notes' Mermaid blocks (stay; a Tidy rule could come later: BACKLOG if asked).
- The user's own Mermaid diagrams and `scrolling-mermaid.css`.
- Hand layout and module packs (rig-figure Phases 5-6); this plan only makes the note use whatever the engine draws.
- The group's module symbols and the example figures: never committed, never on the feedback page (only the made-up rigs in `tests/fixtures/rigs/`).

## Phases

### Phase 0 — merge `feat/rig-figure` (owner's go first)
- Files: the 7 conflicting files above (keep both sides; `src/main.ts` keeps both the overnight changes and `new RigRenderer(this, () => settings.figuresFolder)`), `kits/lab/kit-manifest.json` (`npm run kit:manifest`).
- Done when: `python3 scripts/check.py` PASS on the merged branch; `git diff feat/rig-figure -- src/rig` empty; the rig-figure tests run on the integration branch.
- New dependencies: none

### Phase 1 — before / after page (no plugin code)
- Depends on: nothing (reads the SVG from `feat/rig-figure` or the merged branch)
- Files (private, not committed here): `my_work/mockups/rig-block-no-mermaid.html` made with `my_work/agent_kit/render_check.py feedback`: for each of the 7 made-up rigs in `tests/fixtures/rigs/`: today's Mermaid diagram (screenshot from a throwaway Obsidian, `scripts/obsidian-check.mjs`, light and dark) beside the proposals for Q1 (a) / (b), Q2 (a) / (b) and Q3 at 390 px. Commit in `my_work/`; BACKLOG item gets the page path.
- Done when: the page opens with all 7 rigs and both themes; the owner has answered Q1-Q4 (answers ticked in BACKLOG and a line in `docs/decisions.md`).

### Phase 2 — the rig block draws the figure
- Depends on: Phase 0, Q1-Q3 answered
- Files: `src/rig/figure-ui.ts` → move `makeFigure` to a pure place (`src/rig/figure-export.ts` or a new `src/rig/figure-make.ts`) so the window and the block share it; `src/rig/render.ts` (no `MarkdownRenderer`; an `<img class="lab-kit-rig-diagram">` from the SVG as a `data:image/svg+xml` URL, or a blob URL revoked on redraw and unload; the redraw key becomes the SVG text plus the problems; the "drawn as a plain box" line as in the window); `styles.css` (replace `.lab-kit-rig-diagram, .lab-kit-rig-diagram .mermaid` with the Q2 / Q3 rule; corners from `docs/design-standard.md`, `--lk-radius-control` like `.lab-kit-figure-preview`); `tests/rig-render.test.ts` (rewritten); `scripts/smoke.mjs` (rig step: `.lab-kit-rig-diagram` image, no Mermaid allow); Q1 (b) only: a box-only option in `figure-svg.ts` + tests.
- Tests against fixtures: for each of the 7 rigs in `tests/fixtures/rigs/`, the block's image SVG equals `figureSvg(buildFigure(...))` of the same note and has one `data-part` per part; no call to `MarkdownRenderer.render`; problems listed as today (same two messages as the current test); no table → message, no image; redraw once on a change, not for an equal SVG, not after unload (the current test's four cases).
- Done when: `python3 scripts/check.py` PASS; in a throwaway Obsidian (`obsidian-check`) a rig note shows the image, no `.mermaid-guard-actions`, no console error, in reading view and live preview, light and dark, and with `--mobile` at 390 px (Q3 behaviour); `smoke.mjs` rig step PASS. Not seen on a real phone: say so.
- New dependencies: none

### Phase 3 — the lab-note copy (only if Q4 is a or b)
- Depends on: Phase 2, Q4
- Files: Q4 (a): `kits/lab/Templates/Snippets/14 Rig.md` (`{{rig-diagram:rig}}` → an empty ```` ```rig ```` fence), `src/kit/snippet-template.ts` / `src/kit/snippet-env.ts` (token kept for old copies of the snippet, or made to write the fence), `npm run kit:manifest`, `tests/snippet-rig.test.ts`, `tests/snippet-notes.test.ts`. Q4 (b): the token saves the SVG through the Figures folder path code (`figuresTarget`, `figureFileName`) and writes `![[name.svg]]`; tests for the file name and the embed line.
- Tests against fixtures: Alt+S → Rig on the fixture rig gives a lab note whose ```` ```rig ```` block draws the same parts as the rig note (the copied tables read by `readRig` equal the rig note's parts and links), and no ```` ```mermaid ```` text.
- Done when: check PASS; obsidian-check: a lab note made with the Rig snippet shows the diagram and no Mermaid question. Risk to test: a lab note with two Rig snippets (two rigs) would draw both rigs' tables in each block; decide in the session (one block per `Flow platform setup` heading, or one diagram) and ask if it changes a look.
- New dependencies: none

### Phase 4 — clean-up and docs
- Depends on: Phases 2-3
- Files: `src/rig/parts.ts` (drop `toMermaid`, `mermaidText`, `RESERVED` and the `mermaid` field only if nothing uses them after Q4; `tests/rig-parts.test.ts` Mermaid cases replaced by figure-model cases on the same fixtures); `README.md` (Rig notes line: no Mermaid); `docs/tutorial.md` (the one-time Mermaid prompt line for rigs goes); `docs/architecture.md` (`src/rig/` line); `docs/snippet-syntax.md` (`{{rig-diagram:key}}` row); `docs/maintenance.md` (smoke row for the rig note); `docs/obsidian-test-checklist.md` (row "Rig block" rewritten for symbols; a new 6i row); `docs/changelog.md`; `docs/plans/rig-figure.md` (Out of scope line points here); BACKLOG ticks: "Mermaid asks once per vault", Phone pass item 6, "Phone pass questions" (c); `docs/decisions.md`.
- Done when: check PASS; `grep -rn -i mermaid src/rig` empty (if Q4 a or b); docs match the code.

## Order check
0 before 2-4 (the engine lives on the branch). 1 can run before 0 and must end with answers before 2. 3 needs 2 (the block it writes must draw). 4 last. If Q4 is (c), Phase 3 is skipped and `toMermaid` stays for the snippet.

## Risks
- **Phone:** an image scaled to 366 px makes 16 px labels about 5 px for a figure 1080 px wide (the made-up rig of the rig-figure Phase 4 spike; 16 × 366 / 1080 ≈ 5.4); Q3 sets the floor. Blob or data URLs in an `<img>` on Obsidian mobile: not verified; Phase 2 checks it in emulation only, a real phone stays on the owner's list.
- **PDF export of a rig or lab note:** Mermaid prints today; whether an `<img>` with a blob URL prints is not known. Phase 2 checks it (a data URL is the fallback, it needs no revoke).
- **Mermaid-using vault snippets:** `scrolling-mermaid.css` targets `.block-language-mermaid` and the `scrolling_mermaid` cssclass; the rig block is `.block-language-rig`, so nothing should change for it (not checked whether the nested Mermaid output carried that class). A user's own CSS on `.lab-kit-rig-diagram .mermaid` stops applying.
- **Old notes:** lab notes made before Phase 3 keep their Mermaid block and still ask the question once (Q4 says so).
- **README / tutorial:** the README Rig line and the tutorial's one-time Mermaid prompt line (added 2026-10-20, commit `6ad1ec9`) become wrong in Phase 2; Phase 4 fixes them, so ship 2 and 4 in one release.
- **Look:** the figure cuts long details at 20 characters and puts labels under or beside symbols; Mermaid boxes held the full text. Shown on the Phase 1 page.
- **Live-block format rule (decision 2026-10-20):** the ```` ```rig ```` block stores no text today; if Phase 3 or later adds options inside it, it gets a format version line from the start.
- **Private symbols:** the feedback page and tests use only `tests/fixtures/rigs/` (made up); no module pack or example figure is read or committed.

## Verification
Tests compare the block's SVG with the engine's on all 7 fixture rigs (same parts, same `data-part` groups). A throwaway Obsidian run shows no Mermaid question in a rig note (and in a lab note after Phase 3), in light, dark and 390 px. The look is the owner's: the Phase 1 page, then the checklist row after Phase 2.
