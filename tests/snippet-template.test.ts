// Snippet token templates (engine): each of the six templates, filled with the form's answers, equals what labSnippets.js writes.
import { describe, it } from "vitest";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  TemplateError, parseTemplate, defaultAnswers, fillTemplate, isCancelled, letter, listOf, type TemplateEnv,
} from "../src/kit/snippet-template";

const require = createRequire(import.meta.url);
const labSnippets = require("../kits/lab/Extras/scripts/templater/labSnippets.js");
const labMethods = require("../kits/lab/Extras/scripts/templater/labMethods.js");

const DATA = ".obsidian/plugins/lab-kit/data.json";
const PREFIX = "ABC0016-";
const FIXTURES = "tests/fixtures/snippet-templates/";
const F = "```";

/** Test-only YAML: the header shapes of the six fixtures (top-level keys, one list of `- key:` mappings, plain or "quoted" strings). */
function miniYaml(src: string): unknown {
  const out: Record<string, unknown> = {};
  let list: Record<string, string>[] = [];
  let cur: Record<string, string> = {};
  const val = (s: string) => { const t = s.trim(); const q = /^"(.*)"$/.exec(t); return q ? q[1] : t; };
  for (const line of src.split("\n")) {
    let m: RegExpExecArray | null;
    if (!line.trim()) continue;
    if ((m = /^(\w+):\s*(.*)$/.exec(line))) { if (m[2] === "") { list = []; out[m[1]] = list; } else out[m[1]] = val(m[2]); }
    else if ((m = /^\s+-\s+(\w+):\s*(.*)$/.exec(line))) { cur = {}; list.push(cur); cur[m[1]] = val(m[2]); }
    else if ((m = /^\s+(\w+):\s*(.*)$/.exec(line))) cur[m[1]] = val(m[2]);
    else throw new Error("mini yaml: " + line);
  }
  return out;
}

/* ---------- a note and its vault, for the engine (mirrors the helpers inside labSnippets.js) ---------- */

type Props = Record<string, string>;

function calcTables(note: string): { name: string; rows: string[][] }[] {
  const rx = new RegExp("^[ \\t>]*" + F + "calc[ \\t]*\\n([\\s\\S]*?)\\n[ \\t>]*" + F + "[ \\t]*$", "gim");
  const out: { name: string; rows: string[][] }[] = [];
  let m: RegExpExecArray | null;
  while ((m = rx.exec(note))) {
    const lines = m[1].split("\n").map(l => l.replace(/^[ \t>]*/, ""));
    const name = lines.map(l => /^name:\s*(.+?)\s*$/i.exec(l)).find(Boolean)?.[1].toLowerCase() ?? "";
    const rows = lines.filter(l => l.startsWith("|") && !/^[\s|:-]+$/.test(l)).map(l => l.split("|").slice(1, -1).map(c => c.trim()));
    out.push({ name, rows });
  }
  return out;
}

function envFor(note: string, props: Props): TemplateEnv {
  const taken = new Set<string>();
  const letterIndex = (s: string) => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  return {
    prefix: PREFIX,
    uniqueTable(base) {
      const exists = (n: string) => taken.has(n) || new RegExp(`^\\s*(?:>\\s*)*name:\\s*${n}\\s*$`, "mi").test(note);
      let n = base, k = 2;
      while (exists(n)) n = `${base}${k++}`;
      taken.add(n);
      return n;
    },
    tableRows(name) {
      const t = calcTables(note).find(x => x.name === name.toLowerCase());
      return t ? Math.max(0, t.rows.length - 1) : 0;
    },
    nextFreeIndex(table) {
      const text = table
        ? calcTables(note).filter(t => new RegExp(`^${table.replace(/s$/, "s?")}\\d*$`, "i").test(t.name)).flatMap(t => t.rows.flat()).join("\n")
        : note;
      const rx = new RegExp(PREFIX + "([A-Z]+)", "g");
      let next = 0, m: RegExpExecArray | null;
      while ((m = rx.exec(text))) next = Math.max(next, letterIndex(m[1]) + 1);
      return next;
    },
    noteProperty: (n, p) => props[`${n}.${p}`] ?? "",
  };
}

/* ---------- the script side: labSnippets.js on a stub tp and app ---------- */

function stubApp(note: string, props: Props): void {
  const g = globalThis as any;
  g.Notice = class { constructor(_m: string) { /* not under test */ } };
  g.app = {
    vault: {
      configDir: ".obsidian",
      adapter: { read: async (p: string) => { if (p === DATA) return JSON.stringify({ kit: { initials: "ABC" } }); throw new Error("ENOENT " + p); } },
      getFolderByPath: () => null,
    },
    workspace: { activeEditor: { editor: { getValue: () => note } } },
    metadataCache: {
      getFileCache: (f: { basename: string }) => ({ frontmatter: { Density: props[`${f.basename}.Density`] } }),
      getFirstLinkpathDest: (name: string) => (props[`${name}.Density`] !== undefined ? { basename: name } : null),
    },
    fileManager: { processFrontMatter: async () => { /* tags not under test */ } },
  };
}

/** The form answers its defaults, then the scenario's answers on top; null = the form was cancelled. */
function labForm(answers: Record<string, string> | null) {
  return async (_tp: unknown, _title: string, fields: { key?: string; type?: string; value?: unknown }[]) => {
    if (!answers) return null;
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      if (!f.key || f.type === "heading") continue;
      out[f.key] = f.type === "toggle" ? false : f.value ?? "";
    }
    return { ...out, ...answers };
  };
}

async function viaScript(key: string, note: string, answers: Record<string, string>, props: Props): Promise<string> {
  stubApp(note, props);
  const tp = {
    config: { target_file: { basename: "ABC0016 - test", path: "ABC0016 - test.md" } },
    file: { title: "ABC0016 - test" },
    date: { now: () => "2026-10-09" },
    user: { labMethods, labForm: labForm(answers) },
  };
  return labSnippets(tp, key) as Promise<string>;
}

function viaTemplate(file: string, note: string, answers: Record<string, string>, props: Props): string {
  const parsed = parseTemplate(readFileSync(FIXTURES + file, "utf8"), miniYaml);
  assert.ok(parsed, file + " has a header");
  const env = envFor(note, props);
  const all = { ...defaultAnswers(parsed.header, env), ...answers };
  if (isCancelled(parsed.header, all)) return "";
  return fillTemplate(parsed.body, all, env);
}

const COLUMN_NOTE = `${F}calc\nname: column\n| State | Value |\n|---|---|\n| a | 1 |\n${F}\n`;
const SAMPLING_NOTE = `${F}calc\nname: sampling\n| Code | Time (min) |\n|---|---|\n| ABC0016-A0 | 0 |\n| ABC0016-B30 | 30 |\n${F}\n`;
const TOLUENE: Props = { "toluene.Density": "0.867" };

interface Scenario { name: string; key: string; file: string; note?: string; answers?: Record<string, string>; props?: Props; empty?: boolean }

const SCENARIOS: Scenario[] = [
  { name: "matrix: defaults (no rows = cancel)", key: "matrix", file: "04-matrix.md", empty: true },
  { name: "matrix: rows and columns", key: "matrix", file: "04-matrix.md", answers: { rows: "acid 1, acid 2", cols: "alc 1, alc 2, alc 3" } },
  { name: "matrix: rows only", key: "matrix", file: "04-matrix.md", answers: { rows: "a, b, c" } },
  { name: "matrix: codes continue, id taken", key: "matrix", file: "04-matrix.md", note: `ABC0016-A ABC0016-C\n${F}calc\nname: variants\n| x |\n${F}\n`, answers: { rows: "a, b", cols: "x, y" } },
  { name: "samples: defaults (6 generated)", key: "samples", file: "05-samples.md" },
  { name: "samples: typed codes, one per line", key: "samples", file: "05-samples.md", answers: { codes: "X1, X2\nX3" } },
  { name: "samples: count 0 gives one", key: "samples", file: "05-samples.md", answers: { count: "0" } },
  { name: "samples: letters continue", key: "samples", file: "05-samples.md", note: "ABC0016-D was made", answers: { count: "3" } },
  { name: "samples: id taken", key: "samples", file: "05-samples.md", note: `${F}calc\nname: samples\n| x |\n${F}\n`, answers: { count: "2" } },
  { name: "timetable: defaults", key: "timetable", file: "06-timetable.md" },
  { name: "timetable: hours, two letters, start", key: "timetable", file: "06-timetable.md", answers: { unit: "h", letters: "A, B", start: "09:30", times: "0, 1, 2" } },
  { name: "timetable: no letters = one sample", key: "timetable", file: "06-timetable.md", answers: { letters: "" } },
  { name: "timetable: next letter from an earlier table", key: "timetable", file: "06-timetable.md", note: SAMPLING_NOTE },
  { name: "timetable: no times = cancel", key: "timetable", file: "06-timetable.md", answers: { times: "" }, empty: true },
  { name: "timetable: capital H", key: "timetable", file: "06-timetable.md", answers: { unit: "H", times: "1, 2" } },
  { name: "timetable: ids taken", key: "timetable", file: "06-timetable.md", note: `${F}calc\nname: sampling\n| x |\n${F}\n${F}calc\nname: sampling_start\n| x |\n${F}\n` },
  { name: "column: defaults", key: "column", file: "11-column.md" },
  { name: "column: density from the solvent's note", key: "column", file: "11-column.md", answers: { solvent: "toluene" }, props: TOLUENE },
  { name: "column: typed density wins", key: "column", file: "11-column.md", answers: { solvent: "toluene", density: "0.9" }, props: TOLUENE },
  { name: "column: own id, packing, id taken", key: "column", file: "11-column.md", note: COLUMN_NOTE, answers: { packing: "glass beads" } },
  { name: "rt: defaults, no column table", key: "rt", file: "12-rt.md" },
  { name: "rt: volume linked to the column table", key: "rt", file: "12-rt.md", note: COLUMN_NOTE },
  { name: "rt: flow rates add a table", key: "rt", file: "12-rt.md", answers: { flows: "1, 2.5" }, note: COLUMN_NOTE },
  { name: "rt: no residence times = cancel", key: "rt", file: "12-rt.md", answers: { rts: "" }, empty: true },
  { name: "blank: defaults", key: "blank", file: "13-blank.md" },
  { name: "blank: own columns, rows and id", key: "blank", file: "13-blank.md", answers: { cols: "A, B", rows: "2", id: "t" } },
  { name: "blank: rows 0 gives 3", key: "blank", file: "13-blank.md", answers: { rows: "0" } },
  { name: "blank: no columns = cancel", key: "blank", file: "13-blank.md", answers: { cols: "" }, empty: true },
];

describe("token templates equal the script", () => {
  for (const s of SCENARIOS) {
    it(s.name, async () => {
      const note = s.note ?? "";
      const props = s.props ?? {};
      const answers = s.answers ?? {};
      const fromScript = await viaScript(s.key, note, answers, props);
      const fromTemplate = viaTemplate(s.file, note, answers, props);
      if (s.empty) assert.strictEqual(fromTemplate, "");
      else assert.ok(fromTemplate.length > 20, "has text");
      assert.strictEqual(fromTemplate, fromScript);
    });
  }
});

describe("intended differences from the script", () => {
  it("a negative number of rows gives the fallback 3 (the script made an empty table)", () => {
    const out = viaTemplate("13-blank.md", "", { rows: "-2" }, {});
    assert.strictEqual(out.split("\n").filter(l => /^\|\s+\|/.test(l)).length, 3);
  });
  it("answers are trimmed", () => {
    const out = viaTemplate("13-blank.md", "", { cols: "  A ,B  ", id: "  t  " }, {});
    assert.ok(out.includes("name: t\n"));
    assert.ok(out.includes("| A | B |"));
  });
});

/* ---------- engine details ---------- */

const env = (): TemplateEnv => envFor("", {});
const fill = (body: string, answers: Record<string, string> = {}) => fillTemplate(body, answers, env());
const fails = (body: string, answers: Record<string, string> = {}) => assert.throws(() => fill(body, answers), TemplateError);

describe("parseTemplate", () => {
  it("returns null for a plain snippet", () => {
    assert.strictEqual(parseTemplate("just text\n", miniYaml), null);
    assert.strictEqual(parseTemplate("---\ntags: x\n---\nbody\n", miniYaml), null);
  });
  it("splits the header and the body verbatim", () => {
    const p = parseTemplate("---\ntitle: T\nfields:\n  - key: a\n    label: A\n---\n\nbody {{a}}\n", miniYaml);
    assert.strictEqual(p?.body, "\nbody {{a}}\n");
    assert.strictEqual(p?.header.title, "T");
    assert.deepStrictEqual(p?.header.fields[0], { key: "a", label: "A", hint: undefined, placeholder: undefined, type: "text", value: "" });
  });
  it("turns YAML numbers into text", () => {
    const p = parseTemplate("---\nx: 1\n---\n", () => ({ fields: [{ key: "n", label: "N", type: "number", value: 6 }] }));
    assert.strictEqual(p?.header.fields[0].value, "6");
  });
  it("rejects a bad header with a clear error", () => {
    const parse = (obj: unknown) => parseTemplate("---\nx: 1\n---\nb", () => obj);
    assert.throws(() => parseTemplate("---\nx\n---\nb", () => { throw new Error("bad indent"); }), /not valid YAML: bad indent/);
    assert.throws(() => parse({ fields: "no" }), TemplateError);
    assert.throws(() => parse({ fields: [{ label: "no key" }] }), /needs a key/);
    assert.throws(() => parse({ fields: [{ key: "a" }, { key: "a" }] }), /used twice/);
    assert.throws(() => parse({ fields: [{ key: "code" }] }), /reserved/);
    assert.throws(() => parse({ fields: [{ key: "a", type: "color" }] }), /unknown type/);
    assert.throws(() => parse({ fields: [{ key: "a" }], required: "b" }), /not one of the fields/);
  });
});

describe("fillTemplate", () => {
  it("fills fields, alternatives and literals", () => {
    assert.strictEqual(fill("{{a}}|{{b|a}}|{{b|\"x\"}}|{{b}}", { a: " 1 ", b: "" }), "1|1|x|");
  });
  it("loops: item, name, index, separator, fallback item", () => {
    assert.strictEqual(fill("{{#each l}}[{{.}}{{@i}}{{@n}}]{{/each}}", { l: "a, b" }), "[a01][b12]");
    assert.strictEqual(fill("{{#each l as x | \"-\"}}{{x}}{{/each}}", { l: "a\nb" }), "a-b");
    assert.strictEqual(fill("{{#each l as x or \"\"}}<{{x}}>{{/each}}", { l: "" }), "<>");
    assert.strictEqual(fill("{{#each l}}x{{/each}}", { l: "" }), "");
    assert.strictEqual(fill("{{#each l}}{{@i+2}}{{/each}}", { l: "a, b" }), "23");
  });
  it("@seq counts over all passes of the inner block", () => {
    assert.strictEqual(fill("{{#each o}}{{#each i}}{{@seq}}{{/each}}{{/each}}", { o: "a, b", i: "x, y" }), "0123");
  });
  it("repeat uses the fallback for a missing, zero or negative count", () => {
    assert.strictEqual(fill("{{#repeat n|2}}x{{/repeat}}", { n: "3" }), "xxx");
    for (const n of ["", "0", "-1", "abc"]) assert.strictEqual(fill("{{#repeat n|2}}x{{/repeat}}", { n }), "xx");
  });
  it("if: has items, starts with, else", () => {
    assert.strictEqual(fill("{{#if a}}Y{{else}}N{{/if}}", { a: "x" }), "Y");
    assert.strictEqual(fill("{{#if a}}Y{{else}}N{{/if}}", { a: " , " }), "N");
    assert.strictEqual(fill("{{#if a ^= \"h\"}}H{{/if}}", { a: "Hours" }), "H");
    assert.strictEqual(fill("{{#if a ^= \"h\"}}H{{/if}}", { a: "" }), "");
  });
  it("a block tag alone on a line takes the line with it; inline tags keep the text", () => {
    assert.strictEqual(fill("a\n{{#if x}}\nb\n{{/if}}\nc\n", { x: "1" }), "a\nb\nc\n");
    assert.strictEqual(fill("a\n  {{#if x}}  \nb\n{{else}}\nB\n{{/if}}\nc", { x: "" }), "a\nB\nc");
    assert.strictEqual(fill("a {{#if x}}b{{/if}} c", { x: "1" }), "a b c");
  });
  it("\\{{ is a literal {{", () => {
    assert.strictEqual(fill("\\{{a}} {{a}}", { a: "1" }), "{{a}} 1");
  });
  it("keeps LaTeX braces", () => {
    assert.strictEqual(fill("$$\\tau = \\frac{V_{\\text{reactor}}}{Q}$$"), "$$\\tau = \\frac{V_{\\text{reactor}}}{Q}$$");
  });
  it("table ids: same base gives the same id; a suffix follows its base", () => {
    const e = envFor(`${F}calc\nname: s\n| x |\n${F}\n`, {});
    assert.strictEqual(fillTemplate("{{table:s}} {{table:s}} {{table:s>_a}} {{table:s>_a}} {{table:$id|\"z\"}}", { id: "" }, e), "s2 s2 s2_a s2_a z");
  });
  it("code continues the letters and advances on each use", () => {
    const e = envFor("ABC0016-B here", {});
    assert.strictEqual(fillTemplate("{{code}} {{code}}", {}, e), `${PREFIX}C ${PREFIX}D`);
    assert.strictEqual(letter(26), "AA");
    assert.deepStrictEqual(listOf("a, b\n,c"), ["a", "b", "c"]);
  });
  it("linked, next-letter and note-number", () => {
    const e = envFor(COLUMN_NOTE + SAMPLING_NOTE, TOLUENE);
    assert.strictEqual(fillTemplate("{{linked:column!B10}}|{{linked:nope!B1}}|{{next-letter:sampling}}|{{note-number:s.Density}}", { s: "toluene" }, e), "=column!B10||C|0.867");
    assert.strictEqual(fillTemplate("{{note-number:s.Density}}", { s: "" }, e), "");
  });
  it("defaultAnswers fills computed tokens in a default", () => {
    const p = parseTemplate("---\nx: 1\n---\n", () => ({ fields: [{ key: "l", label: "L", value: "{{next-letter:sampling}}" }] }));
    assert.deepStrictEqual(defaultAnswers(p!.header, envFor(SAMPLING_NOTE, {})), { l: "C" });
  });
  it("errors: unknown token, unknown field, unclosed or stray blocks, never half a note", () => {
    fails("{{nope:x}}");
    fails("{{b}}", { a: "1" });
    fails("{{#each b}}x{{/each}}", { a: "1" });
    fails("{{#if a}}x");
    fails("{{#each a}}x{{/if}}", { a: "1" });
    fails("x {{/each}}");
    fails("{{else}}");
    fails("{{#each a}}{{else}}{{/each}}", { a: "1" });
    fails("{{#loop a}}{{/loop}}", { a: "1" });
    fails("{{.}}", { a: "1" });
    fails("{{@i}}", { a: "1" });
    fails("text {{ never closed");
    fails("{{#if a ^= h}}x{{/if}}", { a: "1" });
  });
});
