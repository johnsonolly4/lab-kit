// Test helper: the kit's snippet scripts as the tests call them (`labSnippets(tp, key)`, `labMethods()`).
// Now the bundled Templater scripts; Phase 12 points this at src/snippets/ instead.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
export const labSnippets = require("../../src/kit/bundled/labSnippets.js");
export const labMethods = require("../../src/kit/bundled/labMethods.js");
