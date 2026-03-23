import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_APP_PREFERENCES,
  loadAppPreferences,
  saveAppPreferences,
} from "./preview-preferences";

const { invoke } = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke,
}));

vi.mock("./file-system", () => ({
  isTauriRuntime: () => true,
}));

describe("preview-preferences", () => {
  it("loads preferences from Tauri", async () => {
    invoke.mockResolvedValueOnce(DEFAULT_APP_PREFERENCES);

    await expect(loadAppPreferences()).resolves.toEqual(DEFAULT_APP_PREFERENCES);
    expect(invoke).toHaveBeenCalledWith("load_app_preferences");
  });

  it("persists preferences through Tauri", async () => {
    await saveAppPreferences({
      autoLoadExternalMedia: false,
      isPreviewVisible: false,
      isTocVisible: true,
    });

    expect(invoke).toHaveBeenCalledWith("save_app_preferences", {
      preferences: {
        autoLoadExternalMedia: false,
        isPreviewVisible: false,
        isTocVisible: true,
      },
    });
  });
});
