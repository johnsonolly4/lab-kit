import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { firstIcon, headerIcon, lucideNames, matchIcons } from "../src/kit/icon-list";

describe("headerIcon", () => {
  it("reads a // icon: line and a token template's icon: header", () => {
    expect(headerIcon("<%*\n// icon: test-tube\n// desc: x\n%>")).toBe("test-tube");
    expect(headerIcon("---\ntitle: Sample list\nicon: list\ndesc: y\n---\n")).toBe("list");
    expect(headerIcon("---\nicon: \"flask-round\"\n---")).toBe("flask-round");
    expect(headerIcon("no icon here")).toBe("");
  });
  it("finds an icon in every snippet the kit ships (the settings boxes are never blank)", () => {
    const dir = "kits/lab/Templates/Snippets";
    const files = readdirSync(dir).filter(f => f.endsWith(".md"));
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) expect(headerIcon(readFileSync(`${dir}/${f}`, "utf8")), f).not.toBe("");
  });
});

describe("icon picker list", () => {
  const ids = ["lucide-flask-round", "lucide-flask-conical", "lucide-test-tube", "search", "lucide-beaker"];
  it("keeps Lucide icons only, without the prefix, sorted", () => {
    expect(lucideNames(ids)).toEqual(["beaker", "flask-conical", "flask-round", "test-tube"]);
  });
  it("matches every word typed, names starting with the first word first", () => {
    const names = lucideNames(ids);
    expect(matchIcons(names, "flask")).toEqual(["flask-conical", "flask-round"]);
    expect(matchIcons(names, "round flask")).toEqual(["flask-round"]);
    expect(matchIcons(names, "tube")).toEqual(["test-tube"]);
    expect(matchIcons(names, "zzz")).toEqual([]);
    expect(matchIcons(names, "").length).toBe(4);
    expect(matchIcons(names, "", 2).length).toBe(2);
  });
});

describe("firstIcon: a header's fallback list shows one name", () => {
  it("the first name Obsidian knows, else the first name, else empty", () => {
    expect(firstIcon("grid-3x3, layout-grid", n => n === "layout-grid")).toBe("layout-grid");
    expect(firstIcon("cylinder, database", () => false)).toBe("cylinder");
    expect(firstIcon("magnet", () => true)).toBe("magnet");
    expect(firstIcon("", () => true)).toBe("");
  });
});
