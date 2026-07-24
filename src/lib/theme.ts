export const THEME_STORAGE_KEY = "fst-theme";

export type Theme = "light" | "dark";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
}

/** Applies the theme to the document and persists it. Single source of
 *  truth for both the no-FOUC inline script (see layout.tsx) and the
 *  toggle button, so they can never disagree on how a theme is applied. */
export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}
