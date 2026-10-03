import { defineConfig } from "vitest/config";

// tests/legacy/ are plain-Node scripts (npm run test:legacy), not vitest suites
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/legacy/**", "node_modules/**"],
    passWithNoTests: true,
  },
});
