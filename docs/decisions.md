# Decisions

One line each, newest first. Answers "when did we decide that, and why?"
Format: `date — decision — why — (who / source)`

Backfilled lines cite where the repo records them. Never invent a past decision or its reason.

- 2026-10-07 — Adopted the Claude starter kit (STATUS sections, docs/INDEX, maintenance, decisions, reviewer agent, handoff and phase-plan skills, PR test workflow) — keeps sessions short; the repo is the memory — (adoption session)
- 2026-10-05 — Leave out Init eq, NMR standard row and the lab-book reagent table from the RAFT snippet — user's choice; ask again if wanted — (user; BACKLOG "v0.4 quick changes")
- 2026-10-04 — Keep Solution prep and Recipe separate: Solution prep = stock solutions, Recipe = experiments — (user; BACKLOG "Decisions needed")
- 2026-10-04 — Density is used only for the per-row "added in mL" conversion; blank density is an error, never 1.0 — (user; BACKLOG "Decisions needed")
- 2026-10-04 — Alt+S lists the Methods folder's notes by itself instead of a refresh button that writes files — (user; STATUS 2026-10-04, commit 61249ee)
- 2026-10-04 — Analysis methods: columns as a property list, machines prefill defaults, Combined results falls through over tables of one method — (user; STATUS 2026-10-04)
- 2026-10-04 — Chemical database is a folder-path setting, not a Type property — (user; STATUS 2026-10-04)
- 2026-10-04 — Remove the Dataview-era kit files; copies in a vault show as Retired and are never deleted — nothing uses them — (user; PR 25)
- 2026-10-04 — SDS PDFs → chemical notes is a separate Python project, not part of Lab Kit — (user; BACKLOG "Decided")
- 2026-10-04 — Build order after store submission: Kit picker → Chemical database → Analysis methods; each its own version — (decisions round; BACKLOG "Decided")
- 2026-10-04 — Preview pane beside the forms: later, after the store submission — (decisions round; BACKLOG "Decided")
- 2026-10-04 — Leave the two `ui/sentence-case` lint warnings — the rule misreads proper nouns — (user; BACKLOG "Repo / release")
- 2026-10-04 — The version moves only at release, never per commit — the number is not a commit counter — (commit 0284285)
- 2026-10-04 — Releases are built, attested and published by GitHub Actions on a pushed tag, not locally — (commit f07ee31)
