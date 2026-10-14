// The boxed, folding groups of the Review update and Manage kit files windows (winFold in src/kit/window-look.ts), and where they put what needs an update.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const ui = readFileSync("src/kit/managed-ui.ts", "utf8");
const css = readFileSync("styles.css", "utf8");

describe("Review update and Manage kit files folds", () => {
  it("use winFold, not the browser's <details> triangles, in both windows", () => {
    const review = ui.slice(ui.indexOf("class KitReviewSection"), ui.indexOf("export class KitManagedModal"));
    const manage = ui.slice(ui.indexOf("class KitFilesSection"), ui.indexOf("/** What a run did"));
    for (const part of [review, manage]) { expect(part).toContain("winFold("); expect(part).not.toContain('createEl("details"'); }
  });
  it("the review lists what needs an update first: Updated, New files, to merge, conflicts, deleted; then changed by you, up to date, kept", () => {
    const order = [...ui.slice(ui.indexOf("const GROUPS"), ui.indexOf("/** One kit's part")).matchAll(/action: "([a-z-]+)"/g)].map(m => m[1]);
    expect(order.slice(0, 5)).toEqual(["fast-forward", "create", "merge", "needs-merge", "missing"]);
    expect(order.indexOf("user-modified")).toBeGreaterThan(4);
    expect(order.indexOf("up-to-date")).toBeGreaterThan(order.indexOf("user-modified"));
  });
  it("the Manage window folds 'Needs an update' open first and the rest behind it", () => {
    expect(ui).toContain('title: "Needs an update"');
    expect(ui).toContain('nNeeds ? "Up to date, kept and yours" : "All files"');
  });
  it("both windows keep their buttons on screen (sticky wrapper) and a kit with something waiting is shown first", () => {
    expect(ui).toContain('this.foot.addClass("lab-kit-sticky-foot")');
    expect(ui).toContain('foot.addClass("lab-kit-sticky-foot")');
    expect(css).toMatch(/\.lab-kit-modal \.lab-kit-sticky-foot \{ position: sticky; bottom: 0;/);
  });
  it("the fold box uses the standard corners and a chevron drawn in CSS", () => {
    expect(css).toMatch(/\.lab-kit-fold \{[^}]*border-radius: var\(--lk-radius-control\)/);
    expect(css).toMatch(/\.lab-kit-fold-head:focus-visible \{ box-shadow: inset/);   // no focus ring sticking out under the header
    expect(css).toContain(".lab-kit-fold.is-open > .lab-kit-fold-head .lab-kit-fold-chev");
  });
  it("the review window has one 'To update' box across kits, with the kit named on each row; the kit folds keep the rest", () => {
    const review = ui.slice(ui.indexOf("class KitReviewSection"), ui.indexOf("export class KitManagedModal"));
    expect(ui).toContain('const TOP_ACTIONS: ManagedAction[] = ["fast-forward", "create", "merge", "needs-merge", "missing"]');
    expect(review).toContain("if (TOP_ACTIONS.includes(g.action)) continue;");   // not listed twice
    expect(ui).toContain('title: "To update"');
    expect(ui).toContain('many ? kitName(sec.managed) : ""');   // the tag only with several kits
    expect(ui).not.toMatch(/KitReviewSection[\s\S]*?Tick or untick all[\s\S]*?export class KitManagedModal/);   // the buttons moved to the top box
  });
  it("the boxes of the review rows are round and centred on the row", () => {
    expect(css).toMatch(/\.lab-kit-win-tick \{[^}]*align-self: center/);
    expect(css).toMatch(/\.lab-kit-win-tick input\[type=checkbox\] \{[^}]*--lk-radius-pill/);
  });
  it("the Kit update report uses boxed folds like the Kit files window, and keeps its Close button on screen", () => {
    const report = ui.slice(ui.indexOf("export class KitReportModal"), ui.indexOf("/** A change to Obsidian's"));
    expect(report).toContain("winFold(");
    expect(report).not.toContain("details");
    expect(report).toContain('foot.addClass("lab-kit-sticky-foot")');
  });
  it("the kit windows take their block gap from one variable, and a Setting row (CSS snippet) has no gap of its own at the top", () => {
    expect(css).toMatch(/\.lab-kit-modal \{ --lk-block-gap: var\(--size-4-3\);/);
    for (const sel of [".lab-kit-fold", ".lab-kit-win-bar", ".lab-kit-modal .lab-kit-sticky-foot"]) expect(css, sel).toMatch(new RegExp(`${sel.replace(/\./g, "\\.")} \\{[^}]*var\\(--lk-block-gap\\)`));
    expect(css).toMatch(/\.lab-kit-modal \.setting-item:first-child \{ padding-top: 0;/);
    expect(css).toMatch(/\.lab-kit-modal \.setting-item \+ \.lab-kit-win-summary \{ margin-top: 0;/);
  });
});

describe("no browser folds left in src/kit", () => {
  it("no createEl(\"details\" in any window of src/kit", async () => {
    const { readdirSync, readFileSync } = await import("fs");
    const bad = readdirSync("src/kit").filter(f => f.endsWith(".ts") && /createEl\("details"/.test(readFileSync(`src/kit/${f}`, "utf8")));
    expect(bad).toEqual([]);
  });
});
