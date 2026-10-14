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
    expect(css).toContain(".lab-kit-fold.is-open > .lab-kit-fold-head .lab-kit-fold-chev");
  });
});
