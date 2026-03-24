import type { ThemeMode } from "./preview-preferences";

export type ResolvedTheme = "light" | "dark";

const DARK_MODE_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export function resolveTheme(
  themeMode: ThemeMode,
  prefersDark: boolean,
): ResolvedTheme {
  if (themeMode === "system") {
    return prefersDark ? "dark" : "light";
  }

  return themeMode;
}

export function getSystemTheme(): ResolvedTheme {
  if (
    typeof window === "undefined"
    || typeof window.matchMedia !== "function"
  ) {
    return "light";
  }

  return window.matchMedia(DARK_MODE_MEDIA_QUERY).matches ? "dark" : "light";
}

export function applyTheme(
  themeMode: ThemeMode,
  root: HTMLElement = document.documentElement,
): ResolvedTheme {
  const resolvedTheme = resolveTheme(themeMode, getSystemTheme() === "dark");

  root.dataset.themeMode = themeMode;
  root.dataset.theme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;

  return resolvedTheme;
}

export function subscribeToSystemTheme(
  onChange: (theme: ResolvedTheme) => void,
): () => void {
  if (
    typeof window === "undefined"
    || typeof window.matchMedia !== "function"
  ) {
    return () => undefined;
  }

  const mediaQueryList = window.matchMedia(DARK_MODE_MEDIA_QUERY);
  const handleChange = (event: MediaQueryListEvent) => {
    onChange(event.matches ? "dark" : "light");
  };

  if (typeof mediaQueryList.addEventListener === "function") {
    mediaQueryList.addEventListener("change", handleChange);

    return () => {
      mediaQueryList.removeEventListener("change", handleChange);
    };
  }

  mediaQueryList.addListener(handleChange);

  return () => {
    mediaQueryList.removeListener(handleChange);
  };
}
