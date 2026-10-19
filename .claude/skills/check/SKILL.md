---
name: check
description: The one test-and-lint run for Lab Kit. Use after every change and before every commit instead of running npm test, npm run lint, npm run build or npm run kit:manifest by hand; prints only what failed and one CHECK PASS / CHECK FAIL line.
---
# Check

One script does it: `scripts/check.py`. Do not run the npm commands one by one, and do not re-run them to `tail` or `grep` the output.

## Rules
- Never commit on `CHECK FAIL` (CLAUDE.md, Session routine).
- If it says the kit manifest was rebuilt with uncommitted changes, add `kits/*/kit-manifest.json` to the same commit.
- `npm test` rewrites some `test-vault/` notes; that is expected and they are not tracked.

## Steps
```bash
python3 scripts/check.py
```
- `--build`: also `npm run build` (type check + production `main.js`). Use before a commit that changed types or imports, and before `/release`.
- `--tests tests/a.test.ts tests/b.test.ts`: only those test files while working on one area; run the full check before committing.

What it does: `npm run kit:manifest` if anything in `kits/` differs from HEAD, then `npm test`, then `npm run lint`. It prints the failing tests (vitest's own failure block) and lint errors as `file:line:col error message rule`, at most 80 lines each, then the summary line.

## Avoid
- `npm test | tail`, `npm test 2>&1 | grep`, then a second run to see the error: the script already prints the failure block.
- Forgetting `npm run kit:manifest` after editing `kits/`: the script does it.
- Reading the full lint output for the known warnings: only errors are printed; warnings are counted.

## Known limits
- It proves tests, lint and the build. It says nothing about how a feature looks or behaves in Obsidian: still "not seen in Obsidian" unless someone ran it there.

## Pass/fail
- Pass: exit code 0 and a last line like `CHECK PASS · kit manifest: kits/ unchanged · tests 1188 passed (1188) · lint 0 errors, 4 warnings`.
- Fail: exit code 1, `CHECK FAIL · ...`, with the failing tests or lint errors printed above it.
- Quote the summary line in STATUS / the commit report (test count, lint errors and warnings).
- Tested end to end 2026-10-19: green run 16 s (with `--build`); a failing test, a `debugger` lint error and an edited kit file were each reported, exit 1.
