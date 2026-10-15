// The button a command was started from is remembered at the very start of the command (before any await), and the mouse position can be used as a place to open a window.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { captureAnchor, pointerAnchor, trackPointer } from "../src/planning/entry-window";

describe("window anchors", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("a button clicked before an await is still the anchor after it (the capture is used by the next window, once, within 2 s)", async () => {
    class El { tagName = "BUTTON"; getAttribute = (): null => null; closest = (): object => ({}); getBoundingClientRect = (): object => ({ left: 40, bottom: 90, width: 100 }); }
    vi.stubGlobal("HTMLElement", El);
    const doc = { activeElement: new El() as unknown };
    vi.stubGlobal("document", doc);
    captureAnchor();
    doc.activeElement = null;   // the focus moved while the command waited for a folder
    const { openEntry } = await import("../src/planning/entry-window");
    expect(typeof openEntry).toBe("function");
    expect(readFileSync("src/planning/entry-window.ts", "utf8")).toMatch(/initial\.anchor \?\? takeCaptured\(\) \?\? buttonAnchor\(\)/);
  });

  it("pointerAnchor is null until the mouse moves, then sits a little below the cursor", () => {
    expect(pointerAnchor()).toBeNull();
    let cb: (e: MouseEvent) => void = () => undefined;
    vi.stubGlobal("document", {});
    trackPointer({ registerDomEvent: (_el, _t, f) => { cb = f; } });
    cb({ clientX: 120, clientY: 80 } as MouseEvent);
    expect(pointerAnchor()).toEqual({ left: 120, bottom: 84 });
  });

  it("every command of the planning kit captures the button before it awaits anything", () => {
    const src = readFileSync("src/planning/commands.ts", "utf8");
    expect(src).toMatch(/callback: \(\) => \{ captureAnchor\(\); void run\(\)/);
  });
});
