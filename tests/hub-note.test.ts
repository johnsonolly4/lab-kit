// Project hub, New project note, New concept and New topic hub without Templater (Phase 6): the token templates give the texts the old Templater
// ones gave (tests/fixtures/templates/old/), byte for byte. The old `<% expr %>` tags are run with the values the template's code block worked out.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONCEPT_TEMPLATE, NEW_TOPIC, PROJECT_HUB_TEMPLATE, PROJECT_NOTE_TEMPLATE, TOPIC_HUB_TEMPLATE, cleanNoteName, cleanProjectName, conceptFields, projectHubAnswers, projectNoteAnswers, readConcept } from "../src/planning/hub-notes";
import { madeNote } from "../src/planning/meeting-note";
import { entryResult, missingRequired, visibleFields } from "../src/planning/entry-fields";
import { projectField } from "../src/planning/todo-bar";
import { miniYaml } from "./token-snippets";

const kit = (n: string): string => readFileSync(`kits/planning/Extras/Templates/${n}.md`, "utf8");
const old = (n: string): string => readFileSync(`tests/fixtures/templates/old/${n}.md`, "utf8");
/** Templater's output after the `<%* ... -%>` code block (its `-%>` trims one line break), with each `<% expr %>` evaluated against `scope`. */
function runOld(name: string, scope: Record<string, unknown>): string {
  const body = old(name).split("-%>\n")[1];
  return body.replace(/<%\s*([\s\S]*?)\s*%>/g, (_m, expr: string) => String(new Function(...Object.keys(scope), `return (${expr});`)(...Object.values(scope))));
}
const NOW = new Date(2026, 9, 22);
const make = (tpl: string, answers: Record<string, string>) => madeNote(tpl, miniYaml, answers, NOW, "", "");
const bundled: Record<string, string> = { "Project hub": PROJECT_HUB_TEMPLATE, "New project note": PROJECT_NOTE_TEMPLATE, "New concept": CONCEPT_TEMPLATE, "New topic hub": TOPIC_HUB_TEMPLATE };

describe("the old fixtures and the bundled texts", () => {
  it("the fixtures are the Templater files", () => {
    for (const n of Object.keys(bundled)) expect(old(n), n).toContain("<%*");
  });
  it("the bundled templates are the kit files", () => {
    for (const [n, t] of Object.entries(bundled)) expect(t, n).toBe(kit(n));
  });
});

describe.each([["the kit file", kit], ["the bundled text", (n: string) => bundled[n]!]])("hub notes: %s", (_l, get) => {
  it("Project hub: <root>/<Name>/<Name>.md, page as before", () => {
    const m = make(get("Project hub"), projectHubAnswers("02 Projects", "Polymer library"));
    expect(m.text).toBe(runOld("Project hub", {}));
    expect([m.name, m.folder]).toEqual(["Polymer library", "02 Projects/Polymer library"]);
  });
  it("New project note: with the folder's hub (project link + back card) and without", () => {
    const withHub = make(get("New project note"), projectNoteAnswers("02 Projects/Alpha", "Method notes", true));
    expect(withHub.text).toBe(runOld("New project note", { hasHub: true, hubName: "Alpha" }));
    expect(withHub.text).toContain('project:\n  - "[[Alpha]]"\ncssclasses:');
    expect([withHub.name, withHub.folder]).toEqual(["Method notes", "02 Projects/Alpha"]);
    const without = make(get("New project note"), projectNoteAnswers("02 Projects/Alpha", "Loose idea", false));
    expect(without.text).toBe(runOld("New project note", { hasHub: false, hubName: "Alpha" }));
    expect(without.text).not.toContain("project:");
  });
  it("New concept: <Knowledge>/<Topic>/<Title>.md, page as before", () => {
    const m = make(get("New concept"), { title: "Chain transfer", folder: "06 Knowledge/RAFT" });
    expect(m.text).toBe(runOld("New concept", {}));
    expect([m.name, m.folder]).toEqual(["Chain transfer", "06 Knowledge/RAFT"]);
  });
  it("New topic hub: the folder in the list query, a folder with spaces", () => {
    for (const folder of ["06 Knowledge/NMR", "06 Knowledge/Light scattering"]) {
      const name = folder.split("/").pop()!;
      const m = make(get("New topic hub"), { name, folder });
      expect(m.text, folder).toBe(runOld("New topic hub", { vt: { folder, name } }));
      expect([m.name, m.folder]).toEqual([name, folder]);
    }
  });
});

describe("name rules (as the old templates)", () => {
  it("a project drops ' and & as well; a note or topic keeps them", () => {
    expect(cleanProjectName(" Tom's A&B: [v2]? ")).toBe("Toms AB v2");
    expect(cleanNoteName(" Tom's A&B: [v2]? ")).toBe("Tom's A&B v2");
  });
});

describe("New concept: the 3 questions in the entry window", () => {
  const root = "06 Knowledge";
  const none = (): boolean => false;
  it("title, Topic (existing + new topic), and the new topic's name only for a new topic", () => {
    const f = conceptFields(["NMR", "RAFT"]);
    expect(f.find(x => x.key === "topic")!.options!.map(o => o.label)).toEqual(["NMR", "RAFT", "(new topic…)"]);
    expect(visibleFields(f, {}).map(x => x.key)).toEqual(["topic"]);
    expect(visibleFields(f, { topic: NEW_TOPIC }).map(x => x.key)).toEqual(["topic", "newTopic"]);
    expect(missingRequired(f, {})!.key).toBe("topic");
    expect(missingRequired(f, { topic: NEW_TOPIC })!.key).toBe("newTopic");
    expect(entryResult(f, { topic: "NMR", newTopic: "stale" })).toEqual({ topic: "NMR" });
  });
  it("an existing topic, a new topic (name cleaned), no title", () => {
    expect(readConcept(root, "Chain transfer", { topic: "RAFT" }, undefined, none)).toEqual({ title: "Chain transfer", folder: "06 Knowledge/RAFT" });
    expect(readConcept(root, "Chain/transfer?", { topic: NEW_TOPIC, newTopic: "GPC: SEC" }, undefined, none)).toEqual({ title: "Chaintransfer", folder: "06 Knowledge/GPC SEC" });
    expect(readConcept(root, " ? ", { topic: "RAFT" }, undefined, none)).toEqual({ error: "Type a title for the concept." });
    expect(readConcept(root, "X", { topic: NEW_TOPIC, newTopic: "/" }, undefined, none)).toEqual({ error: "Type a name for the new topic." });
  });
  it("no topics yet: only the name box; a topic hub's button: no topic question", () => {
    expect(conceptFields([]).map(x => x.key)).toEqual(["newTopic"]);
    expect(readConcept(root, "First", { newTopic: "NMR" }, undefined, none)).toEqual({ title: "First", folder: "06 Knowledge/NMR" });
    expect(conceptFields(["NMR"], true)).toEqual([]);
    expect(readConcept(root, "Shifts", {}, "06 Knowledge/NMR", none)).toEqual({ title: "Shifts", folder: "06 Knowledge/NMR" });
  });
  it("a taken name is refused with the old message", () => {
    expect(readConcept(root, "Shifts", { topic: "NMR" }, undefined, p => p === "06 Knowledge/NMR/Shifts.md")).toEqual({ error: "Shifts already exists in 06 Knowledge/NMR" });
  });
});

describe("New project note: the 2 questions in the entry window", () => {
  it("Project is required (no none) and the title box is the note's title", () => {
    const f = [projectField(["Alpha", "Beta"], true)];
    expect(f[0].options!.map(o => o.label)).toEqual(["Alpha", "Beta"]);
    expect(missingRequired(f, {})!.key).toBe("project");
    expect(entryResult(f, { project: "Beta" })).toEqual({ project: "Beta" });
  });
  it("the answers: the hub link only when the folder's hub note exists; the title cleaned", () => {
    expect(projectNoteAnswers("02 Projects/Beta", cleanNoteName("Ideas: v2"), true)).toEqual({ title: "Ideas v2", folder: "02 Projects/Beta", hub: "Beta" });
    expect(projectNoteAnswers("02 Projects/Beta", "Ideas", false)).toEqual({ title: "Ideas", folder: "02 Projects/Beta", hub: "" });
  });
});
