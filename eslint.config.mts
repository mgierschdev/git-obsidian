import js from "@eslint/js";
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "eslint.config.mts",
            "manifest.json"
          ]
        },
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: [".json"]
      },
    },
  },
  js.configs.recommended,
  ...obsidianmd.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off"
    }
  },
  globalIgnores([
    "node_modules",
    "dist",
    "esbuild.config.mjs",
    "version-bump.mjs",
    "versions.json",
    "main.js",
  ]),
);
