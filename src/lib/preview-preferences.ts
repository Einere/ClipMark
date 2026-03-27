import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./file-system";

export type ThemeMode = "system" | "light" | "dark";

export type AppPreferences = {
  autoLoadExternalMedia: boolean;
  isPreviewVisible: boolean;
  isTocVisible: boolean;
  previewPanelWidth: number | null;
  tocPanelWidth: number | null;
  themeMode: ThemeMode;
};

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  autoLoadExternalMedia: true,
  isPreviewVisible: true,
  isTocVisible: true,
  previewPanelWidth: null,
  tocPanelWidth: null,
  themeMode: "system",
};

function normalizePanelWidth(width: number | null) {
  if (width === null) {
    return null;
  }

  return Number.isFinite(width) ? Math.round(width) : null;
}

function normalizeAppPreferences(preferences: AppPreferences): AppPreferences {
  return {
    ...preferences,
    previewPanelWidth: normalizePanelWidth(preferences.previewPanelWidth),
    tocPanelWidth: normalizePanelWidth(preferences.tocPanelWidth),
  };
}

export async function loadAppPreferences(): Promise<AppPreferences> {
  if (!isTauriRuntime()) {
    return DEFAULT_APP_PREFERENCES;
  }

  const preferences = await invoke<AppPreferences>("load_app_preferences");
  return normalizeAppPreferences(preferences);
}

export async function saveAppPreferences(
  preferences: AppPreferences,
): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("save_app_preferences", {
    preferences: normalizeAppPreferences(preferences),
  });
}
