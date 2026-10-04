// Chemical database: entries from notes (messy Names), matching, the link a pick inserts, and the matching the Alt+S forms use.
import { describe, it } from "vitest";
import assert from "node:assert";
import { createRequire } from "node:module";
import { TFile, TFolder } from "obsidian";
import { chemicalEntries, chemicalLink, insertLink, listChemicals, matchChemicals, openLink } from "../src/chem";

const labForm = createRequire(import.meta.url)("../kit/Extras/scripts/templater/labForm.js");

// Shaped like the notes in a real chemical folder: Names as a list, as one value, empty or missing
const FM: Record<string, Record<string, unknown>> = {
  "C/Toluene.md": { Names: null },
  "C/DTT.md": { Names: ["DTT", "Dithiothreitol"] },
  "C/Acetonitrile.md": { Names: "MeCN" },
  "C/PABTC.md": { names: ["2-[[(Butylthio)carbonothioyl]thio]propanoic Acid"] },
  "C/DCM.md": {},
};
const files = Object.keys(FM).map(path => ({ path, basename: path.slice(2, -3) }));
const entries = chemicalEntries(files, p => FM[p]);

describe("chemicalEntries", () => {
  it("reads Names whether it is a list, one value, empty or missing, and drops the note's own name", () => {
    const by = Object.fromEntries(entries.map(e => [e.name, e.aliases]));
    assert.deepStrictEqual(by.DTT, ["Dithiothreitol"]);
    assert.deepStrictEqual(by.Acetonitrile, ["MeCN"]);
    assert.deepStrictEqual(by.Toluene, []);
    assert.deepStrictEqual(by.DCM, []);
    assert.strictEqual(by.PABTC.length, 1);
  });
  it("sorts by note name", () => {
    assert.deepStrictEqual(entries.map(e => e.name), ["Acetonitrile", "DCM", "DTT", "PABTC", "Toluene"]);
  });
});

describe("matchChemicals", () => {
  const names = (q: string) => matchChemicals(entries, q).map(s => s.chemical.name + (s.alias ? `(${s.alias})` : ""));
  it("finds by note name, ignoring capitals; a name that starts with the query comes before an alias that only contains it", () => assert.deepStrictEqual(names("TOL"), ["Toluene", "DTT(Dithiothreitol)"]));
  it("finds by alias and says which alias matched", () => assert.deepStrictEqual(names("mecn"), ["Acetonitrile(MeCN)"]));
  it("ranks name-starts, alias-starts, name-contains, alias-contains", () => {
    const names: Record<string, string> = { Yttrium: "", "Methyl yellow": "", Xylene: "", Zinc: "Yellow zinc", Nickel: "Gray" };
    const e = chemicalEntries(Object.keys(names).map(n => ({ path: n, basename: n })), p => names[p] ? { Names: [names[p]] } : {});
    assert.deepStrictEqual(matchChemicals(e, "y").map(s => s.chemical.name), ["Yttrium", "Zinc", "Methyl yellow", "Xylene", "Nickel"]);
  });
  it("offers everything for an empty query, and nothing for a miss", () => {
    assert.strictEqual(matchChemicals(entries, "").length, entries.length);
    assert.deepStrictEqual(names("zzz"), []);
  });
  it("gives the same answer as the matching inside the Alt+S forms", () => {
    const plain = entries.map(e => ({ name: e.name, aliases: e.aliases }));
    for (const q of ["", "d", "tol", "mecn", "thio", "zzz"]) {
      assert.deepStrictEqual(
        labForm.matchNames(plain, q).map((m: any) => [m.name, m.alias]),
        matchChemicals(entries, q).map(s => [s.chemical.name, s.alias]), q);
    }
  });
});

describe("links", () => {
  it("a pick by name is [[Note]], by alias [[Note|alias]], and an alias that would break a link falls back to [[Note]]", () => {
    const pick = (q: string) => chemicalLink(matchChemicals(entries, q)[0]);
    assert.strictEqual(pick("tol"), "[[Toluene]]");
    assert.strictEqual(pick("mecn"), "[[Acetonitrile|MeCN]]");
    assert.strictEqual(pick("butylthio"), "[[PABTC]]");
  });
  it("openLink finds an unfinished [[ before the cursor only", () => {
    assert.deepStrictEqual(openLink("=MW([[tol", 9), { start: 4, query: "tol" });
    assert.strictEqual(openLink("=MW([[tol]]", 11), null);
    assert.strictEqual(openLink("plain", 5), null);
    assert.strictEqual(openLink("[[Toluene|tol", 13), null);
  });
  it("insertLink replaces the unfinished link and a closing ]] that is already there", () => {
    assert.deepStrictEqual(insertLink("=MW([[tol", 9, 4, "[[Toluene]]"), { value: "=MW([[Toluene]]", cursor: 15 });
    assert.deepStrictEqual(insertLink("a [[to]] b", 6, 2, "[[Toluene]]"), { value: "a [[Toluene]] b", cursor: 13 });
  });
});

describe("listChemicals", () => {
  const file = (path: string, extension = "md") => Object.assign(new TFile({ path, basename: path.split("/").pop()!.replace(/\.[^.]+$/, ""), extension }));
  const folder = new TFolder({ path: "Chem", children: [file("Chem/Toluene.md"), file("Chem/safety.pdf", "pdf"), new TFolder({ path: "Chem/Solvents", children: [file("Chem/Solvents/DCM.md")] })] });
  const app: any = {
    vault: { getFolderByPath: (p: string) => p === "Chem" ? folder : null, getFileByPath: (p: string) => new TFile({ path: p }) },
    metadataCache: { getFileCache: (f: TFile) => ({ frontmatter: f.path.endsWith("DCM.md") ? { Names: ["Dichloromethane"] } : {} }) },
  };
  it("lists the notes in the folder and its subfolders, markdown only; a path typed with stray slashes still works", () => {
    assert.deepStrictEqual(listChemicals(app, "/Chem/").map(c => c.name), ["DCM", "Toluene"]);
    assert.deepStrictEqual(listChemicals(app, "Chem")[0].aliases, ["Dichloromethane"]);
  });
  it("is empty when no folder is set or it does not exist", () => {
    assert.deepStrictEqual(listChemicals(app, ""), []);
    assert.deepStrictEqual(listChemicals(app, "Nope"), []);
  });
});

describe("form items", () => {
  it("the item being typed is what follows the last comma or line break; a pick replaces only that item", () => {
    assert.deepStrictEqual(labForm.currentItem("DCM, tol", 8), { start: 5, query: "tol" });
    assert.deepStrictEqual(labForm.currentItem("a\n  b", 5), { start: 4, query: "b" });
    assert.deepStrictEqual(labForm.replaceItem("DCM, tol, THF", 8, "Toluene"), { value: "DCM, Toluene, THF", cursor: 12 });
  });
});
