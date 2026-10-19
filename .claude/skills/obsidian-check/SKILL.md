---
name: obsidian-check
description: See a Lab Kit change working in real Obsidian (desktop) without the user: a throwaway vault with the built plugin, opened in a separate hidden Obsidian, driven from the shell (open a note, run a command, read the rendered text, console errors, a cropped screenshot). Use after a change that shows on screen, before writing "not seen in Obsidian".
---
# Obsidian check

One script does it: `scripts/obsidian-check.mjs`. Do not start Obsidian or build a vault by hand.

## Rules
- Never point it at the user's vault or `test-vault/`. It makes its own vault in the temp folder (`--dir` to choose another, e.g. the scratchpad).
- It starts a **separate** Obsidian (own settings folder, debugging port 9333), hidden and without focus. The user's own Obsidian keeps running; `stop` quits only the instance this script started (pid file).
- Notes passed with `--notes` must be test notes (fixtures, scratchpad); `data.json` and `.obsidian/plugins` are not copied.
- Always `stop` at the end of a check.

## Steps
```bash
node scripts/obsidian-check.mjs start --notes "<scratchpad>/notes"
```
```bash
node scripts/obsidian-check.mjs open "0011 test.md" --read
```
```bash
node scripts/obsidian-check.mjs text
```
```bash
node scripts/obsidian-check.mjs command lab-kit:check-setup
```
```bash
node scripts/obsidian-check.mjs shot "<scratchpad>/setup.png" ".modal-container .modal" --scale 0.5
```
```bash
node scripts/obsidian-check.mjs errors
```
```bash
node scripts/obsidian-check.mjs stop
```
- `start` runs `npm run build` (skip with `--no-build`), copies `main.js`, `manifest.json`, `styles.css` into the vault, turns community plugins on, enables Lab Kit, marks the newest changelog section as seen (no What's new window) and closes the trust prompt. Prints JSON: `plugin: true`, version, errors.
- `command <id>`: an unknown id prints the list of `lab-kit:` command ids.
- `modals [--close]`: titles of open windows; `--close` presses Escape until none is left.
- `eval "<js>"` or `eval --file F.js`: run JS in the window (`app` is there; `return` a value). Long code goes in a file.
- `text [selector]`: rendered text of the open note (reading view or live preview) or of a selector; it waits until the text stops changing.
- `--show` on `start`: keep the window on screen (to watch it).

## Avoid
- Clicking with coordinates: use `command`, `eval` with `app` calls or `document.querySelector(...).click()`; check the element exists first.
- Whole-window screenshots: crop to the changed area with a selector and `--scale 0.5`; read `text` first, take a picture only for looks.
- A calc block as the first line of a note in live preview: the cursor sits inside it and Obsidian shows the source. Put a heading first, or use `--read`.
- Starting twice: `start` refuses while port 9333 is in use; run `stop` first.

## Known limits
- Desktop only, tested on macOS (Obsidian 1.14.4, Node 20). The Windows and Linux paths (Obsidian binary, no hide) are not tested.
- Phone layout, real mouse drags, Templater and other community plugins (not installed in the throwaway vault), and how a look *feels* still need the user. Looks must still match `docs/design-standard.md` and the approved screenshots.
- `app.plugins` and `@electron/remote` are Obsidian internals; if an Obsidian update breaks `start`, say so and fall back to the user.

## Pass/fail
- Pass: `start` prints `"plugin": true` and `"errors": []`; the check's own `text` / `eval` result shows the expected value; `errors` prints `[]`; `stop` prints `stopped <pid>`. Each command exits 0.
- Fail: any command exits 1 with the error; report it, and say "not seen in Obsidian" for what was not checked.
- Write what was checked this way in STATUS / BACKLOG as "checked in a throwaway Obsidian (obsidian-check)", not as the user having seen it.
- Tested end to end 2026-10-19 (macOS, Obsidian 1.14.4): start 7.6 s with the build; the 0011 calc note shows Reactor volume 1.7591 in reading view and live preview; Check setup opened by command, screenshot of the window saved; no console errors; the user's own Obsidian kept running.
