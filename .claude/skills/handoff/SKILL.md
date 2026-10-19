---
name: handoff
description: End-of-session routine. Updates STATUS.md and BACKLOG.md, commits, and writes a self-contained starter prompt for the next session. Use when a task is done or the session is getting long.
---

# Handoff

1. Run `npm test` and `npm run lint`. If either fails, say so in `STATUS.md` → Known issues; do not hide it.
2. Check `docs/maintenance.md` and update any docs this session's change requires.
3. Rewrite `STATUS.md` (≤ 40 lines; leave the Version line alone, only `/release` changes it):
   - **Now:** one line, or "nothing in progress".
   - **Next:** remove the finished item; top item is the next session.
   - **Running:** any background job, its log path, how to resume.
   - **Waiting on owner:** anything only a human can do (check in Obsidian, phone test, push, deleting branches), with a suggested date.
4. Tick every `BACKLOG.md` item this session fixed or the user confirmed (date + source; check STATUS → Now for retest results). Then: anything left unchanged or unfinished (skipped on purpose, out of scope, not verified) → `BACKLOG.md` as an unticked item with file:line pointers.
5. New rule or decision made this session → one line in `CLAUDE.md` (rule) or `docs/decisions.md` (decision).
6. Commit on the current branch. Do not push unless asked. Add the session's entry to `my_work/notes/LOG.md` (pieces with PASS/PARTIAL/FAIL, commits, wrong turns, next) and commit in `my_work/`.
7. Write the next prompt in the agent-kit form (`my_work/agent_kit/CLAUDE_TEMPLATE.md` → Next-prompt template, with this repo's files: `STATUS.md`, `docs/decisions.md`; there is no NEXT_SESSION file). Put the same prompt in `STATUS.md` → Next under the top item, and print it in a code block **before** any closing box, with the model to pick on the line under it (CLAUDE.md → Models). Fill the `<...>` parts, keep the rest; never shorten it to a summary block:

```text
Read CLAUDE.md, then STATUS.md, docs/decisions.md (only the <id> lines; search for "<id>"), the LOG.md entry starting "<heading of the entry this step needs>", and from BACKLOG.md only <the items, by search word; never read BACKLOG whole>. <Other files to read, or "Search X with scripts/codemap.py first; do not read big files whole">. Keep token use low: one check run per piece (python3 scripts/check.py), not after every edit. Use the <skill> skill for <what>.

Do plan step <id> only (<what is already done>; work from <branch>; ask before any visual or behaviour change not already decided):
1. <piece>: <what to build or decide>; check: <the test or numbers that show it passes>.
2. ...
N. Report the result of every check as numbers or PASS/PARTIAL/FAIL.
One commit per piece in the main repo; fixtures and docs in my_work. At the end: add an entry to my_work/notes/LOG.md, tick the answered BACKLOG questions, add any new decision to docs/decisions.md, update STATUS.md with the next prompt in the same form (template in my_work/agent_kit/CLAUDE_TEMPLATE.md), commit in my_work. Stop.
```
Model: <Haiku / Sonnet / Opus / Fable> (<why, from the CLAUDE.md Models line>).

8. Report what you verified and what you did not (e.g. "not seen in Obsidian"). Then STOP and end the reply with exactly:

> [!done] Task finished
> Type `/clear`, then say **Read STATUS.md and continue**.
