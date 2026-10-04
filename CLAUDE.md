# Lab Kit

Obsidian plugin + vault kit for a chemistry PhD lab notebook.
Features: live ```` ```calc ```` tables, Alt+S snippet forms (Templater), hazard/data-folder header, built-in kit (templates + scripts, updated with the plugin).
Listed in the Obsidian community plugin store (since 2026-10-04); every release goes through the store review.

**Start every session by reading `STATUS.md`. Every task ends with the End-of-task routine below. No exceptions.**

## Map
- `src/main.ts`: plugin entry, registers features
- `src/calc/`: formula engine (parse, evaluate, rewrite refs) + table renderer
- `src/chem/`: chemical database (notes in the user's folder, matching, `[[` suggest popup for calc cells; `src/frontmatter.ts` = shared property readers)
- `src/header/`: hazard table + data-folder button (replaces the Dataview scripts)
- `src/kit/`: built-in kit (managed files, merge, merge window, settings tab; `paths.ts` = folders + saved state)
- `src/node.ts`: the only `require()` (Node/Electron modules, null on mobile) · `src/platform.ts`: `hasNode()` · `src/whatsnew.ts`: What's new popup
- `kit/`: vault files the built-in kit installs (`Templates/`, `Extras/scripts/`), embedded in `main.js` at build
- `docs/`: `tutorial.md`, `changelog.md`, `obsidian-test-checklist.md`, `reference/` (saved Obsidian docs: read these, don't fetch)
- `tests/`: vitest; `tests/fixtures/` holds real experiment tables
- `scripts/`: `kit-manifest.mjs` regenerates `kit/kit-manifest.json` · `embed-kit.mjs` embeds the kit in `main.js`
- `.github/workflows/release.yml`: builds, attests and publishes a release on a pushed tag
- `test-vault/`: dev vault (only `Welcome.md` tracked; notes, kit copies and plugin build are gitignored)
- `dist/`, `legacy/`: gitignored (old kit package output, no longer built; old v0.3 `main.js`, never committed)
- `README.md`, `GETTING-STARTED.md` (user setup guide), `LICENSE` (MIT)
- `STATUS.md`: now / next / blockers · `BACKLOG.md`: feedback by version

## Commands
- `npm run dev`: watch build into `test-vault/.obsidian/plugins/lab-kit/`
- `npm test`: vitest (failures only) · `npm run lint` · `npm run build`

## Hard rules
- Never read or write the user's real vault. Only `test-vault/`.
- Plugin code follows `.claude/rules/obsidian-plugin.md` (loads automatically for `src/`).
- Engine changes need a test against fixtures. Known answers: 0005 RAFT Mn = 19990.14; 0011 reactor volume = 1.7591 mL.
- Don't change user-facing text, layout or defaults beyond the task. Ask first.
- Lab vocabulary is the user's: keep their names (Exp. Class, CoSHH, RA, sample codes like ABC0014-A).
- **The version only moves at release.** Commits do not bump it (the number is not a commit counter). `/release` is the only thing that changes `package.json` (+ lock), `manifest.json`, `kit/kit-manifest.json` `version` and `versions.json`, and it uses the current version unless the user wants another (e.g. a minor bump like 0.5.0: only the user decides). Never edit those version fields by hand in a commit. `npm test` fails if the three versions differ (`tests/versions.test.ts`).
- Public repo: no real names, initials or real paths in any file. The GitHub username is fine (repo URL, commit author). Paths and personal values belong in plugin settings (empty defaults). The user's vault path goes in `.claude/settings.local.json` (not committed).

## End-of-task routine (MANDATORY)
One task per session. You cannot run `/clear` yourself; only the user can. So when a task is done:
1. Update `STATUS.md` (Now / Next / Last session; the Version line only changes at release).
1b. Anything left unchanged or unfinished (skipped on purpose, out of scope, not verified) goes into `BACKLOG.md` as an unticked item with file:line pointers. In `STATUS.md`, just point to it.
2. **STOP.** Do not start the next task on your own, even if it is obvious or small.
3. End your reply with exactly this callout:
   > [!done] Task finished
   > Type `/clear`, then say **Read STATUS.md and continue**.

If the user asks for another task without clearing, remind them to `/clear` first, once, then do what they decide.

## Workflow
- Plan mode for anything touching more than 2 files; work in phases.
- Searching the code: use the `explorer` subagent. Long test or log output: run it in a subagent.
- Releases: `/release` skill. User feedback: `/feedback` skill → `BACKLOG.md`.
- Default model Sonnet; Opus only for design decisions.

## Talking to the user
- They have ADHD: short, scannable answers, a summary first, bullets over paragraphs.
- Ask decisions as multiple-choice questions with a recommended option.
- Notes and docs for their vault use Obsidian Markdown: callouts, `$…$` LaTeX, Mermaid, [[wikilinks]].