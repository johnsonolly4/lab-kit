// The stored text of live blocks (docs/live-block-format.md, rules 1-7) checked over every writer's output. Phase C4.
// A definition block follows every rule; the built-in RAFT and Solution prep blocks keep their own tags and differ in the listed ways (listed, not changed).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { parseTemplate } from "../src/kit/snippet-template";
import { readDefinition } from "../src/blocks/def/definition";
import { BlockModel, blockSource, blockText, readAnswers, shortHash } from "../src/blocks/def/block";
import { raftBlock, workedFor, raftLines, DEFAULT_RAFT } from "../src/blocks/raft/text";
import { DEFAULT_SETUP, setupLines, solutionBlock } from "../src/solution/setup-text";

const parseYaml = (s: string): unknown => load(s);
const snippet = readFileSync("tests/fixtures/defs/raft.md", "utf8");
const fields = parseTemplate(snippet, parseYaml)!.header.fields;
const defText = /```lk-definition\n([\s\S]*?)\n```/.exec(snippet)![1];
const read = readDefinition(defText, parseYaml, fields);
if (!("def" in read)) throw new Error("definition");
const lookup = (n: string, p: string): number | null => p === "MW" ? ({ DAAm: 169.23, "PDMA 76": 2220.99, "VA-044": 323.33 } as Record<string, number>)[n] ?? null : null;

const definitionBlock = (): string => {
  const a = readAnswers(fields, { monomers: "DAAm", cta: "PDMA 76", initiator: "VA-044", solvent: "Water", "monomer-mass": "2.5", DP: "105", "CTA-to-initiator": "20", solids: "20" });
  if (!("answers" in a)) throw new Error(a.problem);
  const m = new BlockModel(read.def, fields, a.answers, {}, lookup);
  return blockText(blockSource(m, m.worked(shortHash(defText))));
};
const raftText = (): string => {
  const r = raftLines({ ...DEFAULT_RAFT, monomers: "DAAm", cta: "PDMA 76", initiator: "VA-044", solvent: "Water", mass: "2.5", dp: "105" });
  if (!("lines" in r)) throw new Error(r.problem);
  return raftBlock(r.lines, workedFor(r.lines, n => lookup(n, "MW")));
};
const solutionText = (): string => {
  const r = setupLines({ ...DEFAULT_SETUP, reagent: "Acetic acid" });
  if (!("lines" in r)) throw new Error(r.problem);
  return solutionBlock(r.lines);
};

/** Which of the rules a block text breaks (rule numbers of docs/live-block-format.md). */
function broken(text: string): number[] {
  const m = /^```(\S+)\n([\s\S]*)\n```\n$/.exec(text)!;
  const lines = m[2].split("\n"), out = new Set<number>();
  if (!m[1].startsWith("lk-")) out.add(1);
  if (lines[0] !== "format: 1") out.add(2);
  if (m[1] === "lk-block" ? !/^use: [a-z][a-z0-9-]*$/m.test(lines[1] ?? "") : !lines.some(l => /^use: [a-z][a-z0-9-]*$/.test(l))) out.add(3);
  const plain = lines.filter(l => l.trim() && !l.startsWith("#"));
  if (!plain.every(l => /^( {2})?[^\s#:][^:]*:( .*)?$/.test(l) || /^ {2}"?\[\[.*\]\]"?: ?\S*$/.test(l))) out.add(4);
  if (!(lines.includes("used:") || lines.some(l => /^step \d+:$/.test(l)))) out.add(5);
  const hashAt = lines.findIndex(l => l.startsWith("#"));
  if (hashAt < 0 || !lines[hashAt].startsWith("# worked out by Lab Kit")) out.add(6);
  else {
    const body = lines.slice(hashAt + 2).filter(l => l.startsWith("# "));
    const starts = body.map(l => /^# (\S.*?)\s{2,}/.exec(l)?.[0].length ?? 0);
    if (body.length === 0 || new Set(starts.filter(x => x > 0)).size > 1) out.add(6);
  }
  return [...out].sort();
};

describe("the stored text standard", () => {
  it("a definition block follows every rule", () => expect(broken(definitionBlock())).toEqual([]));
  it("the built-in RAFT block differs in its tag and in having no use: line (known, not changed)", () => expect(broken(raftText())).toEqual([1, 3]));
  it("Solution prep differs in its tag, no use: line and no worked-out # lines (known, not changed); its step N: sections are rule 5", () => expect(broken(solutionText())).toEqual([1, 3, 6]));
});
