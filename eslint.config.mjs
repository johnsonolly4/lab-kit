import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
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
  {
    // Desktop-only code: Node/Electron APIs, loaded lazily behind Platform.isDesktopApp
    files: ["src/kit/**"],
    languageOptions: {
      globals: { require: "readonly", process: "readonly", Buffer: "readonly" },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "obsidianmd/no-nodejs-modules": "off",
    },
  },
]);
