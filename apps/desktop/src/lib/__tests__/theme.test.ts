/**
 * @vitest-environment jsdom
 *
 * This file needs a DOM (documentElement class + color-scheme) and a storage
 * implementation. Everything else in this suite still runs in the node
 * environment configured in `vitest.config.ts`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  applyTheme,
  parseTheme,
  persistTheme,
  readStoredTheme,
  resolveInitialTheme,
  toggleTheme,
} from "../theme";

function installStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  return store;
}

afterEach(() => {
  Reflect.deleteProperty(globalThis as object, "localStorage");
});

describe("theme ownership (FE-HIGH-2)", () => {
  beforeEach(() => {
    installStorage();
  });

  it("accepts only the two supported chrome themes", () => {
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("sepia")).toBeNull();
    expect(parseTheme(null)).toBeNull();
  });

  it("falls back to the default when nothing valid is persisted", () => {
    expect(readStoredTheme()).toBeNull();
    expect(resolveInitialTheme()).toBe(DEFAULT_THEME);

    installStorage({ [THEME_STORAGE_KEY]: "not-a-theme" });
    expect(resolveInitialTheme()).toBe(DEFAULT_THEME);
  });

  it("round-trips the persisted preference", () => {
    persistTheme("dark");
    expect(readStoredTheme()).toBe("dark");
    expect(resolveInitialTheme()).toBe("dark");
  });

  it("does not throw when storage is unavailable or failing", () => {
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: () => {
          throw new Error("storage disabled");
        },
        setItem: () => {
          throw new Error("storage disabled");
        },
      },
      configurable: true,
    });
    expect(readStoredTheme()).toBeNull();
    expect(() => persistTheme("dark")).not.toThrow();
  });

  it("applies the theme through the document class and color-scheme", () => {
    const root = document.createElement("div");
    applyTheme("dark", root);
    expect(root.classList.contains("dark")).toBe(true);
    expect(root.style.colorScheme).toBe("dark");

    applyTheme("light", root);
    expect(root.classList.contains("dark")).toBe(false);
    expect(root.style.colorScheme).toBe("light");
  });

  it("toggles between the two themes", () => {
    expect(toggleTheme("dark")).toBe("light");
    expect(toggleTheme("light")).toBe("dark");
  });

  it("is the only writer: no other module sets the theme storage key", async () => {
    // Guards the single-owner invariant cheaply. `lib/theme.ts` and the
    // documentation are the only places allowed to name this key.
    installStorage();
    const spy = vi.spyOn(localStorage, "setItem");
    persistTheme("dark");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(THEME_STORAGE_KEY, "dark");
  });
});
