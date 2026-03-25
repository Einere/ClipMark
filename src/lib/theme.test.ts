import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTheme, resolveTheme, subscribeToSystemTheme } from "./theme";

type MatchMediaChangeHandler = (event: MediaQueryListEvent) => void;

function installMatchMediaMock(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<MatchMediaChangeHandler>();

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: (_eventName: string, listener: MatchMediaChangeHandler) => {
        listeners.add(listener);
      },
      addListener: (listener: MatchMediaChangeHandler) => {
        listeners.add(listener);
      },
      dispatchEvent: () => false,
      removeEventListener: (_eventName: string, listener: MatchMediaChangeHandler) => {
        listeners.delete(listener);
      },
      removeListener: (listener: MatchMediaChangeHandler) => {
        listeners.delete(listener);
      },
    })),
  });

  return {
    emit(nextMatches: boolean) {
      matches = nextMatches;
      const event = { matches: nextMatches } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
}

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-theme-mode");
  document.documentElement.style.colorScheme = "";
});

describe("theme", () => {
  it("resolves system theme using the current media query state", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("applies the resolved theme to the root element", () => {
    installMatchMediaMock(true);

    const resolvedTheme = applyTheme("system");

    expect(resolvedTheme).toBe("dark");
    expect(document.documentElement.dataset.themeMode).toBe("system");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("subscribes to system theme changes", () => {
    const matchMedia = installMatchMediaMock(false);
    const handleChange = vi.fn();

    const unsubscribe = subscribeToSystemTheme(handleChange);
    matchMedia.emit(true);
    matchMedia.emit(false);
    unsubscribe();
    matchMedia.emit(true);

    expect(handleChange).toHaveBeenCalledTimes(2);
    expect(handleChange).toHaveBeenNthCalledWith(1, "dark");
    expect(handleChange).toHaveBeenNthCalledWith(2, "light");
  });
});
