import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/target/**",
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
    // Architecture boundary (ARCH-02): the desktop app may consume workspace
    // packages only through their public entry points, never their internals.
    files: ["apps/**/*.ts", "apps/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
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
  }
);
