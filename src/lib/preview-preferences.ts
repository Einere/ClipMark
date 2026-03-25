import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./file-system";

export type ThemeMode = "system" | "light" | "dark";

export type AppPreferences = {
  autoLoadExternalMedia: boolean;
  isPreviewVisible: boolean;
  isTocVisible: boolean;
  themeMode: ThemeMode;
};

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  autoLoadExternalMedia: true,
  isPreviewVisible: true,
  isTocVisible: true,
  themeMode: "system",
};

export async function loadAppPreferences(): Promise<AppPreferences> {
  if (!isTauriRuntime()) {
    return DEFAULT_APP_PREFERENCES;
  }

  return invoke<AppPreferences>("load_app_preferences");
}

export async function saveAppPreferences(
  preferences: AppPreferences,
): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("save_app_preferences", { preferences });
}
