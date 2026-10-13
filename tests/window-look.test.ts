// The shared look of Lab Kit's list windows (docs/plans/windows-look.md).
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { hotkeyRowState, hotkeySummary, type HotkeyRow } from "../src/kit/hotkey-check";
import { SETUP_MARK } from "../src/kit/setup-check";
import { WIN_MARK } from "../src/kit/window-look";

const row = (status: HotkeyRow["status"], recommended = "Alt+S"): HotkeyRow => ({ does: "x", command: "y", recommended, current: [], status, detail: "" });

describe("window look", () => {
  it("the old lab-kit-setup-* class names are gone from src and styles.css", () => {
    const files = ["styles.css", ...readdirSync("src/kit").map(f => `src/kit/${f}`)];
    for (const f of files) expect(readFileSync(f, "utf8"), f).not.toMatch(/lab-kit-setup-/);
  });

  it("styles.css has a rule for every lab-kit-win class the shared builders use", () => {
    const css = readFileSync("styles.css", "utf8");
    for (const c of ["intro", "summary", "row", "mark", "text", "title", "group", "foot"]) expect(css, c).toMatch(new RegExp(`\\.lab-kit-win-${c}\\b`));
  });

  it("Check setup still uses the same marks", () => {
    expect(SETUP_MARK).toBe(WIN_MARK);
    expect(WIN_MARK).toEqual({ missing: "✗", todo: "!", info: "i", ok: "✓" });
  });

  it("a hotkey row reads: set = ok, no key and none recommended = info, another key or unreadable = todo, the rest missing", () => {
    expect(hotkeyRowState(row("set"))).toBe("ok");
    expect(hotkeyRowState(row("none", ""))).toBe("info");
    expect(hotkeyRowState(row("none"))).toBe("missing");
    expect(hotkeyRowState(row("other"))).toBe("todo");
    expect(hotkeyRowState(row("unreadable"))).toBe("todo");
    expect(hotkeyRowState(row("clash"))).toBe("missing");
    expect(hotkeyRowState(row("missing"))).toBe("missing");
  });

  it("the hotkey summary counts the rows that need a look: none, one, many", () => {
    expect(hotkeySummary([row("set"), row("none", "")])).toBe("Every recommended key is in place.");
    expect(hotkeySummary([row("set"), row("other")])).toBe("1 key to look at.");
    expect(hotkeySummary([row("none"), row("clash"), row("set")])).toBe("2 keys to look at.");
  });
});
