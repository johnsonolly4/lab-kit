// The old Templater lab templates (tests/fixtures/templates/old/) and the texts they give, written out by hand (tests/fixtures/lab-expected.ts).
// The `<% expr %>` tags of the Lab Book Template are run here with the values its code block works out (what Templater does after `-%>`), so the
// hand-written texts are checked against the real old files and the token templates (tests/lab-note.test.ts) against the same texts.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { expectedChemical, expectedDaily, expectedLabEntry, labName, yamlValue } from "./fixtures/lab-expected";

const old = (name: string): string => readFileSync(`tests/fixtures/templates/old/${name}.md`, "utf8");
/** Templater's output after the `<%* ... -%>` code block (its `-%>` trims one line break), up to the closing code block, with each `<% expr %>` evaluated against `scope`. */
function runOld(scope: Record<string, unknown>): string {
  const body = old("Lab Book Template").split("-%>\n")[1];
  return body.slice(0, body.indexOf("<%*")).replace(/<%\s*([\s\S]*?)\s*%>/g, (_m, expr: string) => String(new Function(...Object.keys(scope), `return (${expr});`)(...Object.values(scope))));
}
const scope = (status: string, expClass: string, today: string): Record<string, unknown> => ({ status, expClass, tp: { date: { now: () => today } } });

describe("old lab templates: the hand-written expected texts", () => {
  it("the fixtures are the Templater files", () => {
    expect(old("Lab Book Template")).toContain("<%*");
    expect(old("Lab Book Template")).toContain("tp.file.rename(name)");
  });
  it("Lab Book Template: a numbered entry (Planned, no class), with a class, a kept board column, a status that needs quotes", () => {
    for (const c of [{ today: "2026-10-21" }, { today: "2026-10-21", expClass: "RAFT" }, { today: "2026-10-21", status: "Started", expClass: 'He said "hi"' }, { today: "2026-11-02", status: "Needs: review" }]) {
      expect(runOld(scope(c.status ?? "Planned", c.expClass ?? "", c.today)), JSON.stringify(c)).toBe(expectedLabEntry(c));
    }
  });
  it("Lab Book Template: the status rule and the name rule", () => {
    expect(yamlValue("Started")).toBe("Started");
    expect(yamlValue("Needs: review")).toBe('"Needs: review"');
    expect(labName("ABC", "0015", "Flow: 50/50 mix")).toBe("ABC0015 - Flow- 50-50 mix");
    expect(labName("ABC", "0015", "")).toBe("ABC0015 - Untitled");
  });
  it("Chemical database template and Daily note have no Templater code: the old text, with the decided differences", () => {
    expect(old("Chemical database template")).not.toContain("<%");
    expect(old("Daily note")).not.toContain("<%");
    expect(expectedChemical()).toBe(old("Chemical database template"));
    expect(expectedChemical("Monomer")).toContain("Chemical class:\n  - Monomer\nH_Phrase:");
    expect(expectedDaily()).toBe(old("Daily note").replace("Type:\n  - Daily Note\n", ""));
    expect(expectedDaily().startsWith("---\nkind: daily\n")).toBe(true);
  });
});
