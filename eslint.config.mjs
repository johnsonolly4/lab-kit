import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  // Templater-era scripts bundled into main.js until Templater Phase 12 ports them (no longer kit files, 2026-10-21): not linted, as when they sat in kits/
  { ignores: ["src/kit/bundled/"] },
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.*"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
]);
