import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * Shared setup for every test file.
 *
 * `jest-dom` matchers are registered globally so component tests can assert with
 * `toBeInTheDocument`, `toHaveFocus`, `toBeDisabled` and friends. Cleanup runs
 * explicitly rather than relying on Testing Library's auto-registration, so it
 * also covers tests that render in a non-DOM environment by mistake.
 */
afterEach(() => {
  cleanup();
});

// jsdom implements neither of these, and the library surface uses both.
if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => {};
  }
}
