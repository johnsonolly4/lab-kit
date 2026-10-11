// Pickers that take typed text: the extra "+ New …" entry (src/planning/ask.ts typedChoice).
import { describe, it, expect } from "vitest";
import { typedChoice } from "../src/planning/ask";

const choices = [{ label: "Solvent", value: "Solvent" }, { label: "No class", value: "" }];
const typed = { prefix: "+ New class: ", make: (t: string) => t.toUpperCase() };

describe("typedChoice", () => {
  it("offers text that is not in the list as a new entry, made by `make`", () => {
    expect(typedChoice(choices, "  monomer ", typed)).toEqual({ label: "+ New class: monomer", value: "MONOMER" });
  });

  it("offers nothing for an empty box, an existing entry (any case) or a picker without `typed`", () => {
    expect(typedChoice(choices, "   ", typed)).toBeNull();
    expect(typedChoice(choices, "solvent", typed)).toBeNull();
    expect(typedChoice(choices, "monomer")).toBeNull();
  });
});
