# Snippet syntax reference

Everything you can write in a Lab Kit snippet, a calc block or a method note. One home for the syntax: the tutorial points here. Where a feature is planned but not built it says so.

## Which one do I use?

| I want… | Use | Where it lives |
|---|---|---|
| A table or text with a few questions asked first | a **token template** | a note in the `Snippets` folder with a header and `{{tokens}}` |
| A sample table for an analysis (columns, defaults, machines) that also feeds Combined results | a **method note** | a note in the Methods folder (Settings → Lab Kit) |
| Anything the first two cannot do (reads many notes, calls other code) | a **code snippet** | a section of `labSnippets.js` (only NMR, GPC, DLS, Combined results, solution, recipe, RAFT use it) |

A token template can build a table but Combined results does not know about it (see "Sample codes" below for what it can still share).

## 1. Token templates

A note in the `Snippets` folder whose first lines are a header between `---` lines (valid YAML) with a `fields` key. A note without `fields` is a plain snippet and is inserted as written. Esc in the form inserts nothing.

### Header keys

| Key | Meaning |
|---|---|
| `title` | form title and the name in the Alt+S menu |
| `icon`, `desc` | menu icon (a Lucide name) and the one-line description |
| `required` | key of a field that must hold at least one list item, else nothing is inserted |
| `set` | properties written on the note you are in when the snippet is inserted, one `Name: value` line each; the value may hold tokens (`Rig: "[[{{rig}}]]"`). An existing property is replaced; an empty value is not written |
| `fields` | the questions (below); an empty list is allowed |

A field has `key` (letters, digits, `-`, `_`; not `prefix` or `code`), `label`, optional `hint`, `placeholder`, `type` (`text` default, `number`, `textarea`), `value` (the default answer; it may hold computed tokens) and for chemical names `suggest: chemicals` with `class: <name or list>` (a Chemical class; Settings → Lab Kit decides whether other chemicals are still offered). A field with `suggest: notes` and `folder: <setting>` lists the notes of one of your Lab Kit folders (`rigsFolder`, `methodsFolder`, `chemicalFolder`, `labFolder`); the answer must be one of those notes, and the snippet stops with a message while the folder setting is empty or has no notes.

### Tokens (`{{…}}` in the body and in a field's `value`)

A block tag alone on a line removes its line. Write `\{{` for a literal `{{`. An unknown token, unknown field or unclosed block shows a message naming the snippet and inserts nothing.

| Token                            | Gives                                                                                                                                                                                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{{key}}`                        | the answer to field `key`                                                                                                                                                                                                                                      |
| `{{a\|b\|"text"}}`               | the first non-empty of the alternatives; a literal fallback goes in quotes                                                                                                                                                                                     |
| `{{#each key}}…{{/each}}`        | repeat for each item of a comma or line separated answer; inside: `{{.}}` the item. `{{#each key as x}}` names it `{{x}}`; `{{#each key \| " \| "}}` joins the repeats with a separator; `{{#each key as x or ""}}` runs once with `""` when the list is empty |
| `{{@i}}` `{{@n}}` `{{@seq}}`     | index from 0, from 1, and a running count over all repeats of the block; `{{@i+2}}` adds a number (spreadsheet rows)                                                                                                                                           |
| `{{#repeat key\|3}}…{{/repeat}}` | repeat a number of times; without a usable number the fallback is used (1 when none is given)                                                                                                                                                                  |
| `{{#if key}}…{{else}}…{{/if}}`   | true when the answer has at least one item; `{{#if key ^= "h"}}` = starts with (ignoring case; false for an empty answer)                                                                                                                                      |
| `{{prefix}}`                     | your initials + the note's number + `-` (`ABC0016-`)                                                                                                                                                                                                           |
| `{{code}}`                       | `prefix` + the next free sample letter; continues from earlier codes in the note and advances on each use                                                                                                                                                      |
| `{{table:base}}`                 | a table id that is unique in the note (`base`, `base2`…); the same `base` gives the same id again within one insert. `{{table:$key\|"base"}}` takes the base from a field; `{{table:sampling>_start}}` = the id of `sampling` plus `_start`                    |
| `{{linked:column!B10}}`          | the formula for `column!B10` (an equals sign in front of it) when the note has a `column` table with rows, else empty                                                                                                                                          |
| `{{next-letter:sampling}}`       | the first sample letter not used in the note's `sampling` tables (use as a field's default)                                                                                                                                                                    |
| `{{note-number:key.Density}}`    | a number from a property of the chemical note named by field `key`, else empty                                                                                                                                                                                 |
| `{{live-prop:key.Density@B5}}`   | a live formula for the same property: the cell stays up to date with the chemical note. `B5` is the cell that holds the note's name; empty when the note has no such number                                                                                    |
| `{{note-prop:key.Tubing}}`       | a property of the note picked in field `key` (a `suggest: notes` field) as text; a list is joined with `, `; empty when the note has no such property |
| `{{rig-diagram:key}}`            | the flow diagram of the rig note picked in field `key`, as a fixed Mermaid block (it does not change when the rig note changes later) |
| `{{rig-tables:key}}`             | the parts tables of that rig note as they are now, each under its heading (`## Pumps`); `{{rig-tables:key ###}}` sets the heading level. A note without a parts table shows a message and inserts nothing |
| `{{note-line:key.Tubing}}`        | `Tubing: value` for that property of the picked note, or nothing (and no empty line) when it has none |
| `{{#append "# Heading"}}…{{/append}}` | this part does not go at the cursor: it is added at the end of the note under that heading. A heading with the same text that is already in the note (any level) gets the part below its content; otherwise the heading is added, at the level of the `#` signs (two when none are written). Not inside another block . `{{#append "# Heading" from key.Property}}` takes the heading text from that property of the picked note when it is filled in (the written heading is the default) |

A field with `suggest: codes` asks for sample codes the way the method snippets do (see "Sample codes" below): its box is filled with the codes of the note's tables and, with more than one table, a **Codes from** choice follows it. Give it `type: textarea`; the answer reaches the template as the codes joined with `, `, so `{{#each codes}}…{{/each}}` works. The key `<key>_from` is reserved for the choice. `class` belongs to `suggest: chemicals` only.

```yaml
fields:
  - key: codes
    label: Sample codes
    type: textarea
    suggest: codes
    value: ""   # used when the note has no table with codes
```

## 2. Calc block options

Lines above the table inside a ```` ```calc ```` block, one `key: value` per line. A calc block is any such block in any note: hand-written, copied from another note, or inserted by a snippet. Unknown keys are kept and ignored by the table.

| Option | Example | Does |
|---|---|---|
| `name` | `name: sol1` | lets other tables refer to this one (`sol1!B2`) |
| `title` | `title: Solution 1` | caption; also the name shown in "Codes from" |
| `icon` | `icon: flask-round` | caption icon, any Lucide name |
| `decimals` | `decimals: 3` | fixed decimals |
| `sig` | `sig: 4` | significant figures for small numbers |
| `grid` | `grid: true` | start with the A1 labels shown |
| `copy` | `copy: list` / `copy: column A` | what **Copy** puts on the clipboard |
| `codes` | `codes: column A` / `codes: cells` | **the table holds sample codes**: `column A` = that column below the header, `cells` = every cell except the header row and the first column |

### Sample codes: how the method snippets find them

NMR, GPC, DLS, every Methods-folder method and Combined results (and any token template field with `suggest: codes`) ask for **Sample codes** and, when the note has more than one table with a `codes` option, a **Codes from** choice. **All of them** is the default: the box is filled with the codes of every such table (duplicates removed). Pick one table to narrow it. Edit the box and your text is used as it is.

- Any calc block with a `codes` option counts, whoever made it. Add `codes: column A` to a table of your own and it becomes a source.
- The kit's Sample list and Sampling timetable (`codes: column A`) and Variant naming matrix (`codes: cells`) carry it, and so do the sample tables the NMR, GPC, DLS and method snippets insert (the column is the method's sample column), so a copy of one of those is a source too.
- Older tables without the option are still found when they are named like `samples`, `sample`, `sampling` (numbered copies included).
- Combined results also falls back to the codes in the method tables when nothing else holds any.

## 3. Method notes (Methods folder)

One note per analysis method, properties in the header (names ignore case and spacing). NMR, GPC and DLS are built in; a note with the same name replaces one.

| Property | Meaning |
|---|---|
| `Columns` | list: `"Name"`, `"Name: default"`, `"Name: =formula"`, `"Name: {n}"`. `{Other column}` inside a formula is that column's cell in the same row; `{n}` is the row number. The first column holds the sample code unless `Sample column` says otherwise |
| `Sample column` | name of the column that holds the code |
| `Results` | the columns that go into Combined results |
| `Machines` | list of links to machine notes; `Default machine` picks one |
| `Title`, `Icon`, `Tag` | menu name, icon and the tag added to the note |
| `Checklist` | list of check boxes added under the table (default: Submitted, Results processed, Results saved) |
| `Dataset folder` | `true` adds a "Dataset:" line |

A machine note's property with the same name as a column sets that column's default (Eluent, Solvent, Temp, Calibrant…).

Why methods are separate from token templates: a method is a description several snippets read. It gives machines (defaults taken from the chosen instrument's note), the Combined results columns, the tag, checklist and dataset line, and it appears in Alt+S without a file in `Snippets`. A token template only asks questions and fills text.

## 4. Examples: four snippets that ship with the kit

Each one shows what the form asks, example answers, and what is inserted. The note already has its number, so your initials and that number make the prefix (`ABC0016-` here). The files are in the `Snippets` folder; open one next to this page to see its header and body. Press **Make my own copy** on a snippet to edit a copy of it.

### Sample list (`05 Sample list.md`)

| Question | Type | Default |
|---|---|---|
| Sample codes (one per line or comma separated, blank = generate) | text box | empty |
| …or generate this many | number | 6 |

Answers: **Sample codes** = `X1, X2` and `X3` on the next line. Inserted:

````markdown
## Samples
```calc
name: samples
title: Samples
icon: list
copy: column A
codes: column A
| Code | Description | Notes |
|---|---|---|
| X1 |  |  |
| X2 |  |  |
| X3 |  |  |
```
````

Leave the box empty and keep 6, and you get `ABC0016-A` to `ABC0016-F` with the same table.

### Sampling timetable (`06 Sampling timetable.md`)

| Question | Type | Default |
|---|---|---|
| Time points (required, comma separated) | text | `0, 30, 60, 120` |
| Time unit (min or h) | text | `min` |
| Sample letters (comma separated, blank = one sample) | text | the next free letter |
| Start time (hh:mm, blank = fill in on the day) | text | empty |

Answers: **Time points** `0, 1, 2`, **Time unit** `h`, **Sample letters** `A, B`, **Start time** `09:30`. Inserted:

````markdown
## Sampling timetable
```calc
name: sampling_start
title: Start
icon: timer
| Setting | Value |
|---|---|
| Start time (hh:mm) | 09:30 |
```

```calc
name: sampling
title: Sampling timetable
icon: timer
copy: column A
codes: column A
| Code | Time (h) | Target time | Taken at | Notes |
|---|---|---|---|---|
| ABC0016-A0 | 0 | =CLOCK(sampling_start!$B$2, B2*60) |  |  |
| ABC0016-A1 | 1 | =CLOCK(sampling_start!$B$2, B3*60) |  |  |
| ABC0016-A2 | 2 | =CLOCK(sampling_start!$B$2, B4*60) |  |  |
| ABC0016-B0 | 0 | =CLOCK(sampling_start!$B$2, B5*60) |  |  |
| ABC0016-B1 | 1 | =CLOCK(sampling_start!$B$2, B6*60) |  |  |
| ABC0016-B2 | 2 | =CLOCK(sampling_start!$B$2, B7*60) |  |  |
```
````

The Target time column is a formula that counts from the start time in the first table.

### Flow column prep (`11 Flow column prep.md`)

| Question | Type | Default |
|---|---|---|
| Table id | text | `column` |
| Solvent (suggests chemical notes of the class *solvent*) | text | empty |
| Solvent density (g/mL; blank = follows the solvent note's Density) | text | empty |
| End-fitting dead volume (mL) | text | empty |
| Packing material | text | empty |

Answers: **Solvent** `toluene`, everything else left empty. The density cell follows the toluene note, so it changes when that note does. Inserted:

````markdown
## Column prep
```calc
name: column
title: Column weighing
icon: cylinder
| State | Value |
|---|---|
| Empty column (blanking plugs, glass wool) (g) |  |
| Packed column (beads, plugs, glass wool) (g) |  |
| Packed + full of solvent (g) |  |
| Solvent | toluene |
| Solvent density (g/mL) | =PROP(B5,"Density") |
| End-fitting dead volume (mL) |  |
| Mass of beads (g) | =B3-B2 |
| Mass of solvent (g) | =B4-B3 |
| Solvent volume (mL) | =B9/B6 |
| Reactor volume (mL) | =B10-B7 |
| Packing material |  |
```
````

Type a density (for example `0.9`) and that number is written instead.

### Variant naming matrix (`04 Variant naming matrix.md`)

| Question | Type | Default |
|---|---|---|
| Row items (required, comma separated) | text | empty |
| Column items (comma separated) | text | empty |

Answers: **Row items** `acid 1, acid 2`, **Column items** `alc 1, alc 2, alc 3`. Inserted:

````markdown
## Variant naming matrix
```calc
name: variants
title: Variant naming matrix
icon: grid-3x3
copy: list
codes: cells
|  | alc 1 | alc 2 | alc 3 |
|---|---|---|---|
| **acid 1** | ABC0016-A | ABC0016-B | ABC0016-C |
| **acid 2** | ABC0016-D | ABC0016-E | ABC0016-F |
```
````

With no column items you get one **Code** column instead.

### More body tokens

| Body | Answers | Inserted |
|---|---|---|
| `{{#each codes \| " \| "}}{{.}}{{/each}}` | `codes` = `A, B, C` | `A \| B \| C` |
| `{{#if note}}Note: {{note}}{{else}}no note{{/if}}` | `note` empty | `no note` |
| `{{#repeat n\|3}}x{{/repeat}}` | `n` = `2` | `xx` (with no usable number: `xxx`) |
| `{{code}} {{code}}` | none | `ABC0016-B ABC0016-C` (the next two free letters, `ABC0016-A` already used) |
| `{{table:samples}}` | none | `samples2` (`samples` is taken) |

A field that asks for sample codes (header):

```yaml
fields:
  - key: codes
    label: Sample codes
    type: textarea
    suggest: codes
```

With a Sample list (`ABC0016-A`, `ABC0016-B`) and a Sampling timetable (`ABC0016-C0`, `ABC0016-C30`) in the note, the box opens holding all four codes and **Codes from** offers *All of them*, *Sample list* and *Sampling timetable*. Pick *Sampling timetable* without touching the box: `{{#each codes}}…{{/each}}` runs for `ABC0016-C0` and `ABC0016-C30` only.

A table of your own becomes a source with one line:

```calc
name: mine
title: My samples
codes: column A
| Code | Note |
|---|---|
| ABC0016-X | first |
| ABC0016-Y | second |
```

It shows in **Codes from** as *My samples*, with the codes `ABC0016-X` and `ABC0016-Y`.
