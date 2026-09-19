/**
 * Application chrome theme — single owner.
 *
 * ARCH-02 / FE-HIGH-2: theme used to be written by four places (App state, the
 * reader store, direct DOM class toggles, and direct localStorage writes). This
 * module is now the only place that reads, applies, or persists the chrome
 * theme. Callers own the *value*; this module owns the *effects*.
 *
 * Scope note: this is the application chrome theme only ("dark" | "light").
 * The reader's paper theme (see `@luma/reader-ui` READER_THEME_STYLES, which
 * also covers sepia/paper/eink) is a separate presentation concern owned by
 * reader settings and is intentionally not merged here.
 */

export type AppTheme = "dark" | "light";

export const THEME_STORAGE_KEY = "luma_theme";

export const DEFAULT_THEME: AppTheme = "light";

/** Narrow an arbitrary stored string to a known theme. */
export function parseTheme(value: string | null | undefined): AppTheme | null {
  return value === "dark" || value === "light" ? value : null;
}

/** Read the persisted chrome theme. Returns null when unavailable/unknown. */
export function readStoredTheme(): AppTheme | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return parseTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    // Storage can throw in restricted contexts; a theme preference is never
    // worth failing a render over.
    return null;
  }
}

/** Initial chrome theme, preferring the persisted preference. */
export function resolveInitialTheme(): AppTheme {
  return readStoredTheme() ?? DEFAULT_THEME;
}

/**
 * Apply the theme to the document: the `.dark` class drives the CSS custom
 * property overrides in `styles/index.css`, and `color-scheme` keeps native
 * controls (scrollbars, form widgets) in the matching scheme.
 */
export function applyTheme(theme: AppTheme, root?: HTMLElement | null): void {
  const target = root ?? (typeof document !== "undefined" ? document.documentElement : null);
  if (!target) return;
  target.classList.toggle("dark", theme === "dark");
  target.style.colorScheme = theme;
}

/** Persist the theme. Best-effort: a failure must not break the UI. */
export function persistTheme(theme: AppTheme): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore: persistence is a convenience, not a correctness requirement.
  }
}

export function toggleTheme(theme: AppTheme): AppTheme {
  return theme === "dark" ? "light" : "dark";
}
