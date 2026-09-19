import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    // Logic and store tests keep the fast node environment. Component tests are
    // named `*.dom.test.tsx` and get jsdom + Testing Library matchers.
    environment: "node",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["./src/testing/setupTests.ts"],
    environmentMatchGlobs: [["src/**/*.dom.test.tsx", "jsdom"]],
  },
});
