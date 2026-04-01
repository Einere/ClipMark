import { act } from "react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppPreferences } from "./useAppPreferences";
import { DEFAULT_APP_PREFERENCES, type AppPreferences } from "../lib/preview-preferences";

const saveAppPreferences = vi.fn().mockResolvedValue(undefined);
const applyTheme = vi.fn();
const subscribeToSystemTheme = vi.fn();

vi.mock("../lib/preview-preferences", async () => {
  const actual = await vi.importActual<typeof import("../lib/preview-preferences")>("../lib/preview-preferences");
  return {
    ...actual,
    saveAppPreferences: (preferences: AppPreferences) => saveAppPreferences(preferences),
  };
});

vi.mock("../lib/theme", () => ({
  applyTheme: (themeMode: string) => applyTheme(themeMode),
  subscribeToSystemTheme: (listener: () => void) => subscribeToSystemTheme(listener),
}));

type HarnessProps = {
  initialPreferences?: AppPreferences;
  onReady: (controls: ReturnType<typeof useAppPreferences>) => void;
  onSaveError: () => void;
};

function Harness({ initialPreferences, onReady, onSaveError }: HarnessProps) {
  const controls = useAppPreferences({
    initialPreferences,
    onSaveError,
  });

  onReady(controls);
  return null;
}

describe("useAppPreferences", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let controls: ReturnType<typeof useAppPreferences>;
  let unsubscribeSystemTheme: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    saveAppPreferences.mockClear();
    applyTheme.mockClear();
    unsubscribeSystemTheme = vi.fn();
    subscribeToSystemTheme.mockReset();
    subscribeToSystemTheme.mockReturnValue(unsubscribeSystemTheme);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("persists preference updates and applies theme changes", async () => {
    const onSaveError = vi.fn();

    await act(async () => {
      root.render(createElement(Harness, {
        initialPreferences: DEFAULT_APP_PREFERENCES,
        onReady: (nextControls) => {
          controls = nextControls;
        },
        onSaveError,
      }));
    });

    expect(saveAppPreferences).toHaveBeenCalledWith(DEFAULT_APP_PREFERENCES);
    expect(applyTheme).toHaveBeenCalledWith("system");
    expect(subscribeToSystemTheme).toHaveBeenCalledTimes(1);

    await act(async () => {
      controls.setThemeMode("dark");
      controls.setIsPreviewVisible(false);
      controls.setPreviewPanelWidth(520);
    });

    expect(applyTheme).toHaveBeenLastCalledWith("dark");
    expect(unsubscribeSystemTheme).toHaveBeenCalledTimes(1);
    expect(saveAppPreferences).toHaveBeenLastCalledWith({
      ...DEFAULT_APP_PREFERENCES,
      isPreviewVisible: false,
      previewPanelWidth: 520,
      themeMode: "dark",
    });
    expect(onSaveError).not.toHaveBeenCalled();
  });

  it("reports save failures through the provided callback", async () => {
    const onSaveError = vi.fn();
    saveAppPreferences.mockRejectedValueOnce(new Error("save failed"));

    await act(async () => {
      root.render(createElement(Harness, {
        initialPreferences: DEFAULT_APP_PREFERENCES,
        onReady: (nextControls) => {
          controls = nextControls;
        },
        onSaveError,
      }));
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(onSaveError).toHaveBeenCalledTimes(1);
  });
});
