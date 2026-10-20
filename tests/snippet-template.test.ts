// Snippet token templates (engine): each of the six shipped templates, filled with the form's answers, equals what labSnippets.js wrote before they moved out of it.
import { describe, it } from "vitest";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import {
  TemplateError, parseTemplate, defaultAnswers, fillTemplate, isCancelled, letter, listOf, oldStub, type TemplateEnv,
} from "../src/kit/snippet-template";
import { makeEnv } from "../src/kit/snippet-env";
import { miniYaml, runToken } from "./token-snippets";

const PREFIX = "ABC0016-";
const EXPECTED_FILE = "tests/fixtures/snippet-templates/expected.json";
const F = "```";

/* ---------- a note and its vault, for the engine (src/kit/snippet-env.ts mirrors the helpers inside labSnippets.js) ---------- */

type Props = Record<string, string>;

const envFor = (note: string, props: Props): TemplateEnv => makeEnv(note, PREFIX, (n, p) => props[`${n}.${p}`] ?? "");

function viaTemplate(key: string, note: string, answers: Record<string, string>, props: Props): string {
  return runToken(key, { note, prefix: PREFIX, answers, props });
}

const COLUMN_NOTE = `${F}calc\nname: column\n| State | Value |\n|---|---|\n| a | 1 |\n${F}\n`;
const SAMPLING_NOTE = `${F}calc\nname: sampling\n| Code | Time (min) |\n|---|---|\n| ABC0016-A0 | 0 |\n| ABC0016-B30 | 30 |\n${F}\n`;
const TOLUENE: Props = { "toluene.Density": "0.867" };

interface Scenario { name: string; key: string; note?: string; answers?: Record<string, string>; props?: Props; empty?: boolean }

const SCENARIOS: Scenario[] = [
  { name: "matrix: defaults (no rows = cancel)", key: "matrix", empty: true },
  { name: "matrix: rows and columns", key: "matrix", answers: { rows: "acid 1, acid 2", cols: "alc 1, alc 2, alc 3" } },
  { name: "matrix: rows only", key: "matrix", answers: { rows: "a, b, c" } },
  { name: "matrix: codes continue, id taken", key: "matrix", note: `ABC0016-A ABC0016-C\n${F}calc\nname: variants\n| x |\n${F}\n`, answers: { rows: "a, b", cols: "x, y" } },
  { name: "samples: defaults (6 generated)", key: "samples", file: "05-samples.md" },
  { name: "samples: typed codes, one per line", key: "samples", answers: { codes: "X1, X2\nX3" } },
  { name: "samples: count 0 gives one", key: "samples", answers: { count: "0" } },
  { name: "samples: letters continue", key: "samples", note: "ABC0016-D was made", answers: { count: "3" } },
  { name: "samples: id taken", key: "samples", note: `${F}calc\nname: samples\n| x |\n${F}\n`, answers: { count: "2" } },
  { name: "timetable: defaults", key: "timetable", file: "06-timetable.md" },
  { name: "timetable: hours, two letters, start", key: "timetable", answers: { unit: "h", letters: "A, B", start: "09:30", times: "0, 1, 2" } },
  { name: "timetable: no letters = one sample", key: "timetable", answers: { letters: "" } },
  { name: "timetable: next letter from an earlier table", key: "timetable", note: SAMPLING_NOTE },
  { name: "timetable: no times = cancel", key: "timetable", answers: { times: "" }, empty: true },
  { name: "timetable: capital H", key: "timetable", answers: { unit: "H", times: "1, 2" } },
  { name: "timetable: ids taken", key: "timetable", note: `${F}calc\nname: sampling\n| x |\n${F}\n${F}calc\nname: sampling_start\n| x |\n${F}\n` },
  { name: "column: defaults", key: "column", file: "11-column.md" },
  { name: "column: density from the solvent's note", key: "column", answers: { solvent: "toluene" }, props: TOLUENE },
  { name: "column: typed density wins", key: "column", answers: { solvent: "toluene", density: "0.9" }, props: TOLUENE },
  { name: "column: own id, packing, id taken", key: "column", note: COLUMN_NOTE, answers: { packing: "glass beads" } },
  { name: "rt: defaults, no column table", key: "rt", file: "12-rt.md" },
  { name: "rt: volume linked to the column table", key: "rt", note: COLUMN_NOTE },
  { name: "rt: flow rates add a table", key: "rt", answers: { flows: "1, 2.5" }, note: COLUMN_NOTE },
  { name: "rt: no residence times = cancel", key: "rt", answers: { rts: "" }, empty: true },
  { name: "blank: defaults", key: "blank", file: "13-blank.md" },
  { name: "blank: own columns, rows and id", key: "blank", answers: { cols: "A, B", rows: "2", id: "t" } },
  { name: "blank: rows 0 gives 3", key: "blank", answers: { rows: "0" } },
  { name: "blank: no columns = cancel", key: "blank", answers: { cols: "" }, empty: true },
];

/** What labSnippets.js wrote for each scenario before the six moved out of it (recorded 2026-10-09, byte for byte). */
const EXPECTED: Record<string, string> = JSON.parse(readFileSync(EXPECTED_FILE, "utf8"));

describe("token templates equal what the script wrote", () => {
  for (const s of SCENARIOS) {
    it(s.name, () => {
      const fromTemplate = viaTemplate(s.key, s.note ?? "", s.answers ?? {}, s.props ?? {});
      if (s.empty) assert.strictEqual(fromTemplate, "");
      else assert.ok(fromTemplate.length > 20, "has text");
      assert.strictEqual(fromTemplate, EXPECTED[s.name]);
    });
  }
  it("has a recorded output for every scenario", () => {
    assert.deepStrictEqual(Object.keys(EXPECTED).sort(), SCENARIOS.map(s => s.name).sort());
  });
});

describe("intended differences from the script", () => {
  it("a negative number of rows gives the fallback 3 (the script made an empty table)", () => {
    const out = viaTemplate("blank", "", { rows: "-2" }, {});
    assert.strictEqual(out.split("\n").filter(l => /^\|\s+\|/.test(l)).length, 3);
  });
  it("answers are trimmed", () => {
    const out = viaTemplate("blank", "", { cols: "  A ,B  ", id: "  t  " }, {});
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
  it("reads a mandatory field, only when true", () => {
    const p = parseTemplate("---\nx: 1\n---\n", () => ({ fields: [{ key: "a", label: "A", mandatory: true }, { key: "b", label: "B", mandatory: false }, { key: "c", label: "C" }] }));
    assert.strictEqual(p?.header.fields[0].mandatory, true);
    assert.ok(!("mandatory" in p!.header.fields[1]));
    assert.ok(!("mandatory" in p!.header.fields[2]));
  });
  it("reads group, and a header with run: needs no fields", () => {
    const p = parseTemplate("---\nx: 1\n---\n", () => ({ title: "T", group: " Make up ", run: " solution ", icon: "i", desc: "d" }));
    assert.deepStrictEqual(p?.header, { title: "T", icon: "i", desc: "d", group: "Make up", run: "solution", fields: [] });
    const f = parseTemplate("---\nx: 1\n---\n", () => ({ fields: [], group: "Samples" }));
    assert.strictEqual(f?.header.group, "Samples");
    assert.strictEqual(f?.header.run, undefined);
    assert.strictEqual(parseTemplate("---\nx: 1\n---\n", () => ({ group: "Samples" })), null);
  });
  it("rejects run: with fields or without a name", () => {
    assert.throws(() => parseTemplate("---\nx: 1\n---\n", () => ({ run: "raft", fields: [] })), /has no fields/);
    assert.throws(() => parseTemplate("---\nx: 1\n---\n", () => ({ run: "" })), /needs the name/);
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
    assert.throws(() => parse({ fields: [{ key: "a", mandatory: "yes" }] }), /mandatory must be true or false/);
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
    // live-prop: a formula that follows the note; empty without a note or without that number
    assert.strictEqual(fillTemplate("{{live-prop:s.Density@b5}}", { s: "toluene" }, e), '=PROP(B5,"Density")');
    assert.strictEqual(fillTemplate("{{live-prop:s.Density@B5}}", { s: "" }, e), "");
    assert.strictEqual(fillTemplate("{{live-prop:s.Boiling@B5}}", { s: "nothing" }, e), "");
    assert.strictEqual(fillTemplate("{{density|live-prop:s.Density@B5}}", { density: "0.9", s: "toluene" }, e), "0.9");   // a typed value wins
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

describe("oldStub", () => {
  const stub = (body: string) => `<%*\n${body}\n%>`;
  it("reads the key, icon and description of the old calculator file", () => {
    assert.deepStrictEqual(oldStub(stub('// icon: magnet\n// desc: Sample table\ntR += await tp.user.labSnippets(tp, "nmr");')), { run: "nmr", icon: "magnet", desc: "Sample table" });
    assert.deepStrictEqual(oldStub(stub('tR += await tp.user.labSnippets(tp, "raft")')), { run: "raft" });
  });
  it("takes Windows line endings and other comment lines", () => {
    assert.deepStrictEqual(oldStub(stub('// icon: x\n// note to self\ntR += await tp.user.labSnippets(tp, "dls");').replace(/\n/g, "\r\n")), { run: "dls", icon: "x" });
  });
  it("is null for anything else: other code, two calls, no call, plain text", () => {
    assert.strictEqual(oldStub(stub('const a = 1;\ntR += await tp.user.labSnippets(tp, "nmr");')), null);
    assert.strictEqual(oldStub(stub('tR += await tp.user.labSnippets(tp, "nmr");\ntR += await tp.user.labSnippets(tp, "gpc");')), null);
    assert.strictEqual(oldStub(stub("// icon: x")), null);
    assert.strictEqual(oldStub("plain text\n"), null);
  });
});
