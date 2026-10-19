# Lab Kit

Obsidian plugin + vault kit for a chemistry PhD lab notebook.
Features: live ```` ```calc ```` tables, Alt+S snippet forms (Templater), hazard/data-folder header, built-in kit (templates + scripts, updated with the plugin).
Listed in the Obsidian community plugin store (since 2026-10-04); every release goes through the store review.

## Session routine (MANDATORY, no exceptions)
**Start:** read `STATUS.md`. Say in one line which task you are taking. If unsure, ask one question.
**Work:** one task per session. More than 2 files will change → plan mode first, wait for approval, work in phases. After each change, once `npm test` and `npm run lint` pass (0 errors), commit it locally on the feature branch with a message naming the behaviour (docs, BACKLOG and checklist edits for that change go in the same commit). Never commit on a red run. Local only: pushing still needs the user.
**End** (you cannot run `/clear`; only the user can):
1. `npm test` and `npm run lint` (0 errors). Nothing is done until they pass.
2. Update docs per `docs/maintenance.md`.
3. Update `STATUS.md` (no size limit until the trim step; the Version line only changes at release). Anything left unchanged or unfinished (skipped on purpose, out of scope, not verified) → `BACKLOG.md` as an unticked item with file:line pointers; STATUS just points to it.
4. Commit on the feature branch (final commit; during the work, commit after each change as in **Work**).
5. Run `/handoff`: it adds the session's entry to `my_work/notes/LOG.md` (commit in `my_work/`) and shows the next prompt and the model to pick, in a code block, in a message written **before** any closing box (the box ends the turn, so text after it is never shown). Then **STOP**: don't start the next task, even if it is obvious or small. End your reply with exactly:
   > [!done] Task finished
   > Type `/clear`, then say **Read STATUS.md and continue**.

If the user asks for another task without clearing, remind them to `/clear` first, once, then do what they decide.

## Commands
- Check (kit manifest + tests + lint in one run, failures only; `--build` adds the build): `python3 scripts/check.py` (skill `check`). Use it instead of the separate commands below.
- Tests: `npm test` (vitest, failures only) · Lint: `npm run lint` · Build: `npm run build`
- Run: `npm run dev` (watch build into `test-vault/.obsidian/plugins/lab-kit/`)
- See a change in real Obsidian without the user (throwaway vault, separate hidden Obsidian): `node scripts/obsidian-check.mjs start` … `stop` (skill `obsidian-check`)
- After editing anything in `kits/`: `npm run kit:manifest`
- New-vault starter (settings + plugin list, from the kits): `npm run starter` (writes `dist/starter/`)
- Old-style notes to try Tidy up notes on: `npm run tidy-fixture` (writes `test-vault-tidy/`, gitignored; open it as its own vault)

## Hard rules
- `test-vault/` is fine to read and write; never read or write the user's real vault. Allowed read path for the built plugin: `test-vault/.obsidian/plugins/` (`npm run dev` writes there).
- Never push, merge to `main`, tag, release or delete without asking.
- Plugin code follows `.claude/rules/obsidian-plugin.md` (loads automatically for `src/`); it must work on desktop (Windows, macOS, Linux) and mobile (`hasNode()`).
- Engine changes need a test against fixtures. Known answers: 0005 RAFT Mn = 19990.14; 0011 reactor volume = 1.7591 mL.
- Do only what was asked. Don't change user-facing text, layout or defaults beyond the task: ask first. Anything else you notice → `BACKLOG.md`, and mention it.
- Follow the conventions already in the code. Don't reformat or reorganise files you aren't changing.
- Lab vocabulary is the user's: keep their names (Exp. Class, CoSHH, RA, sample codes like ABC0014-A).
- **The version only moves at release** (it is not a commit counter). Only `/release` touches the version fields (`package.json` + lock, `manifest.json`, every `kits/<id>/kit-manifest.json`, `versions.json`), and only the user picks a bump. `tests/versions.test.ts` fails if they differ.
- Public repo: no real names, initials or real paths in any file. The GitHub username is fine (repo URL, commit author). Paths and personal values belong in plugin settings (empty defaults); the user's vault path goes in `.claude/settings.local.json` (not committed).
- A result the user reports (in chat, a screenshot or `/feedback`) goes into `BACKLOG.md` in the same session: tick each item it confirms fixed (date + source), add what it finds broken. Recording it only in STATUS is not enough.
- Before you tell the user an item is still open, check `STATUS.md` → Now and `git log` since the item's date.
- Make claims (docs, UI text, reports) only from measured results. Say what was not verified (e.g. "not seen in Obsidian").
- If the user's short reply could answer more than one open question, say which one you think it answers before acting.
- Multi-line edits: use the Edit tool, not escaped shell scripts.
- Anything that changes how a window, chip, menu, tile or button looks: read `docs/design-standard.md` (corner sizes) and `docs/reference/visual/README.md` (screenshots the user approved; kept on this machine only, gitignored, so it may be missing: then say so), open the matching image, and match it. New approved looks are saved there when the user says a screen is right.

## Shell on this Mac (zsh, BSD tools)
- No `sed -i` for edits (BSD `sed` needs `-i ''`): use the Edit tool, or a short `python3 -` script.
- No `echo ====` lines (zsh treats a word starting with `=` as a path lookup): use `echo '---'`.
- Quote every path. No command in a variable (`Z="python3 x.py"; $Z` fails in zsh).
- No `sleep` to wait: run long jobs in the background.
- `git commit -a` takes no paths: `git add PATHS` first, then `git commit`.

## Terse commands
- "continue" → top item in `STATUS.md` → Next
- "push" → push the current branch and open a PR with `gh pr create`
- "merge" → merge the open PR for this branch
- "release" → `/release` · user feedback → `/feedback` (→ `BACKLOG.md`)

## Git layout
- Allow-list `.gitignore` (`/*`, then `!/src/` ...): a new top-level file or folder needs a `!/name` line, after a check that it holds nothing personal. Files inside an allowed folder are tracked as usual.
- `my_work/` is the owner's private folder with its **own git**, never pushed, ignored here: `notes/` (LOG.md, DECISIONS.md pointing to `docs/decisions.md`), `analyses/`, `private/`, `reference_visual/`, `agent_kit/`. Commit there too, after every change. Nothing in it is read unless a prompt names it.
- Decisions live in `docs/decisions.md`; the next task is `STATUS.md`. There is no NEXT_SESSION file.

## Where things are
Read only what the request needs: `docs/INDEX.md` says which file covers what; `docs/architecture.md` is the code map.
Searching the code: use the `explorer` agent. Long test or log output: run it in a subagent.
Big files (`src/kit/managed-ui.ts`, `styles.css`, `src/kit/tidy.ts`, `src/kit/ui.ts`, `src/planning/blocks.ts`, `src/planning/plan-map-render.ts`): don't read whole. Run `python3 scripts/codemap.py FILE` (functions or CSS rules with line numbers; `--grep word` to narrow), then read only those lines with the Read tool's offset and limit.
`BACKLOG.md` is long: search it (Grep for the topic or id), never read it whole.

## Models
Default Sonnet; Opus only for design decisions and root-cause hunts; Haiku for mechanical work (docs, renames, tidying, searches, running checks). Agents are pinned in `.claude/agents/`.

## Talking to the user
- Short, scannable answers: summary first, bullets over paragraphs.
- Ask decisions as multiple-choice questions with a recommended option.
- Notes and docs for their vault use Obsidian Markdown: callouts, `$…$` LaTeX, Mermaid, [[wikilinks]].
