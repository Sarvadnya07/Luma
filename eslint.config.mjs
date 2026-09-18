import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/target/**",
      "**/target-*/**",
      "**/.system_generated/**",
      "**/src-tauri/**",
      "**/coverage/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "no-undef": "off", // TypeScript itself checks for undefined variables
    },
  },
  {
    // Standalone Node scripts (bridge smoke/production-reader harnesses) run
    // outside the bundler and TypeScript, so they need real Node globals.
    files: ["**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        URL: "readonly",
        fetch: "readonly",
      },
    },
  },
  {
    // Architecture boundary (ARCH-01/ARCH-02): the desktop app may consume
    // workspace packages only through their public entry points, never their
    // internals.
    files: ["apps/**/*.ts", "apps/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [],
          patterns: [
            {
              group: ["@luma/*/src/**", "@luma/*/src", "@luma/*/dist/**"],
              message:
                "Import workspace packages through their public entry point (@luma/<pkg>), not their internals.",
            },
          ],
        },
      ],
    },
  },
  {
    // Data boundary (DYNAMIC-DATA-01 fitness function): production code must not
    // import test fixtures or the in-memory test backend. Test files keep full
    // access — this rule only covers the modules that ship.
    files: ["apps/desktop/src/**/*.{ts,tsx}"],
    ignores: [
      "apps/desktop/src/testing/**",
      "apps/desktop/src/**/__tests__/**",
      "apps/desktop/src/**/*.test.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [],
          patterns: [
            {
              group: ["**/testing/**", "**/__tests__/**", "**/fixtures/**"],
              message:
                "Production modules must read real data through a transport; test fixtures and the in-memory backend belong to tests only.",
            },
          ],
        },
      ],
    },
  },
  {
    // Feature boundary (ARCH-02 fitness function): features consume reader
    // state through the injected store exposed by `state/readerContext`, never
    // the module-level store singleton. Without this rule the DI seam that makes
    // the reader testable without Tauri erodes one convenient import at a time.
    // Kept deliberately narrow: it currently has zero violations and one clear
    // intent, so it cannot become noise. NOTE: this block must repeat the
    // workspace-package rule above, because the later config replaces the rule
    // rather than merging with it.
    files: ["apps/desktop/src/features/**/*.{ts,tsx}"],
    ignores: [
      "apps/desktop/src/features/**/__tests__/**",
      "apps/desktop/src/features/**/*.test.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [],
          patterns: [
            {
              group: [
                "@luma/*/src/**",
                "@luma/*/src",
                "@luma/*/dist/**",
                "**/state/readerState",
                "../../state/readerState",
                "**/testing/**",
                "**/__tests__/**",
                "**/fixtures/**",
              ],
              message:
                "Use useReaderStore from state/readerContext (the injected store), not state/readerState directly, import workspace packages through @luma/<pkg>, and never import test fixtures or the in-memory backend from production code.",
            },
          ],
        },
      ],
    },
  }
);
