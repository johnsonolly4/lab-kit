import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// tests/legacy/ are plain-Node scripts (npm run test:legacy), not vitest suites.
// "obsidian" ships types only, so tests get a small runtime stand-in.
export default defineConfig({
  resolve: {
    alias: { obsidian: fileURLToPath(new URL("./tests/helpers/obsidian-stub.ts", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/legacy/**", "node_modules/**"],
    passWithNoTests: true,
  },
});
