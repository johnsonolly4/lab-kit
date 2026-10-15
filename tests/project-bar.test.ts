// The project hub's Status and Deadline chips: fields, shown values and the writes (src/planning/project-bar.ts).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { applyProjectValue, projectBarFields, projectBarValues } from "../src/planning/project-bar";
import { chipView } from "../src/planning/entry-fields";

describe("projectBarFields", () => {
  it("Status lists Active, Paused, Done; Deadline is a date chip", () => {
    const [status, deadline] = projectBarFields("Active");
    expect(status.options?.map(o => o.value)).toEqual(["Active", "Paused", "Done"]);
    expect(status).toMatchObject({ key: "Status", kind: "pick", required: true });
    expect(deadline).toMatchObject({ key: "deadline", kind: "date" });
  });
  it("a Status typed by hand stays pickable, so the bar never loses it", () => {
    expect(projectBarFields("On hold")[0].options?.map(o => o.value)).toEqual(["Active", "Paused", "Done", "On hold"]);
    expect(projectBarFields("")[0].options).toHaveLength(3);
  });
});

describe("projectBarValues and the chips' text", () => {
  it("reads Status and deadline; a hub with no Status shows the first one", () => {
    expect(projectBarValues({ Status: "Paused", deadline: "2026-11-15" })).toEqual({ Status: "Paused", deadline: "2026-11-15" });
    expect(projectBarValues({})).toEqual({ Status: "Active", deadline: "" });
    expect(projectBarValues({ deadline: "2026-11-15T00:00" }).deadline).toBe("2026-11-15");
  });
  it("an empty deadline reads \"+ Deadline\", a set one DD-MM-YYYY, Status its name", () => {
    const [status, deadline] = projectBarFields("Active");
    expect(chipView(deadline, "").text).toBe("+ Deadline");
    expect(chipView(deadline, "2026-11-15").text).toBe("15-11-2026");
    expect(chipView(status, "Paused")).toEqual({ text: "Paused", set: true });
  });
});

describe("the writes", () => {
  it("set Status and deadline; an emptied deadline stays an empty property", () => {
    const fm: Record<string, unknown> = { Status: "Active", deadline: "" };
    applyProjectValue(fm, "Status", "Done"); applyProjectValue(fm, "deadline", "2026-12-01");
    expect(fm).toEqual({ Status: "Done", deadline: "2026-12-01" });
    applyProjectValue(fm, "deadline", "");
    expect(fm.deadline).toBe("");
  });
  it("ignores a key it does not own", () => {
    const fm: Record<string, unknown> = {};
    applyProjectValue(fm, "priority", 2);
    expect(fm).toEqual({});
  });
});

describe("the hub bar's code", () => {
  it("draws chips, not a native select or date input", () => {
    const src = readFileSync("src/planning/blocks.ts", "utf8");
    expect(src).toContain("this.projectChips(bar, file)");
    expect(src).not.toMatch(/createEl\("select"|type: "date"/);
  });
});
