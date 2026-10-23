# Stored text of live blocks (format 1)

What lands in the note is set by the plugin, not by a snippet file: a definition chooses the names (its question keys and row names), never the shape of the text. Plan: `docs/plans/custom-live-blocks.md` (Target design §4 and "One stored text standard"). Writer: `src/blocks/def/block.ts`; line reader and one-line writer: `src/blocks/core.ts`. Test: `tests/live-block-format.test.ts`, `tests/def-raft-proof.test.ts`.

## The rules
1. A fence with an `lk-` tag (`lk-block` for a block made from a definition).
2. `format: N` is the first line. A missing line reads as 1; a newer one is refused ("made with a newer Lab Kit") and the text is left alone.
3. `use: <definition>` is the second line of an `lk-block`.
4. One `key: value` line per answer, in the order of the snippet's questions, by question key; units after the number (`monomer-mass: 2.5 g`, `solids: 20 %`); a chemical as a link (`cta: "[[PDMA 76]]"`); a list as a section with one two-space line per item (`  "[[DAAm]]": 0.7`). An empty answer is not written. A question with `when: other` is written only while `other` is filled.
5. `used:` with one two-space line per row name for the typed actuals (empty until weighed), in row order; or `step N:` sections (Solution prep).
6. The `#` worked-out lines: the head line `# worked out by Lab Kit (<definition>, <6-character hash>), rewritten when the set-up changes`, then `# MW from the chemical notes: …` (every row with a `lookup: mw`, in row order), then one line per `worked:` entry, every amount with its unit (`14.773 mmol`, `2220.99 g/mol`, `0.3125 g`; owner board 9). The first column is padded to the longest reagent name + 2, a longer label is followed by one space. Rewritten only on insert and Edit set-up, never when an actual is typed. Nothing is written when a MW is missing or a number cannot be worked out.
7. Any other `#` line is the user's and is kept.
8. Every number the block shows can be recomputed by a person from the text alone: each target has a `#` line with its sum written out in numbers (the live values, such as "Mn from what you've weighed", come with the view, Phase C5).

## Where the built-in blocks differ (listed, not changed)
| Block | Difference |
|---|---|
| `raft` (built in) | tag `raft` not `lk-…`; no `use:` line; head line without the definition name and hash (the `# Monomersmean MW` gap for reagent names of 6 characters or fewer is FIXED 2026-10-22, owner: small fix in the built-in block) |
| `solution` (built in) | tag `solution`; `use: 50 %` already means the share of acid used, so it cannot be the definition line (its tag differs, so there is no clash); `step N:` sections instead of `used:` (rule 5 allows them); no `#` worked-out lines |

## Reading the text
The stored lines are read with `parseBlock` (`core.ts`); in a formula a question key is its name with `-` read as `_` (`monomer-mass` → `monomer_mass`) and not case-sensitive.
