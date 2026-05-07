import { useEffect, useEffectEvent, useState } from "react";
import {
  DEFAULT_APP_PREFERENCES,
  saveAppPreferences,
  type AppPreferences,
  type ThemeMode,
} from "../lib/preview-preferences";
import { applyTheme, subscribeToSystemTheme } from "../lib/theme";

type UseAppPreferencesOptions = {
  initialPreferences?: AppPreferences;
  onSaveError: () => void;
};

export function useAppPreferences({
  initialPreferences,
  onSaveError,
}: UseAppPreferencesOptions) {
  const defaultPreferences = initialPreferences ?? DEFAULT_APP_PREFERENCES;
  const [preferences, setPreferences] = useState<AppPreferences>(defaultPreferences);
  const reportSaveError = useEffectEvent(() => {
    onSaveError();
  });

  useEffect(() => {
    void saveAppPreferences(preferences).catch(() => {
      reportSaveError();
    });
  }, [preferences, reportSaveError]);

  useEffect(() => {
    applyTheme(preferences.themeMode);

    if (preferences.themeMode !== "system") {
      return;
    }

    return subscribeToSystemTheme(() => {
      applyTheme("system");
    });
  }, [preferences.themeMode]);

  return {
    ...preferences,
    setIsExternalMediaAutoLoadEnabled(
      nextValue: boolean | ((currentValue: boolean) => boolean),
    ) {
      setPreferences((current) => ({
        ...current,
        autoLoadExternalMedia:
          typeof nextValue === "function"
            ? nextValue(current.autoLoadExternalMedia)
            : nextValue,
      }));
    },
    setIsPreviewVisible(nextValue: boolean | ((currentValue: boolean) => boolean)) {
      setPreferences((current) => ({
        ...current,
        isPreviewVisible:
          typeof nextValue === "function"
            ? nextValue(current.isPreviewVisible)
            : nextValue,
      }));
    },
    setIsTocVisible(nextValue: boolean | ((currentValue: boolean) => boolean)) {
      setPreferences((current) => ({
        ...current,
        isTocVisible:
          typeof nextValue === "function"
            ? nextValue(current.isTocVisible)
            : nextValue,
      }));
    },
    setPreviewPanelWidth(nextValue: number | null) {
      setPreferences((current) => ({
        ...current,
        previewPanelWidth: nextValue,
      }));
    },
    setThemeMode(nextThemeMode: ThemeMode) {
      setPreferences((current) => ({
        ...current,
        themeMode: nextThemeMode,
      }));
    },
    setTocPanelWidth(nextValue: number | null) {
      setPreferences((current) => ({
        ...current,
        tocPanelWidth: nextValue,
      }));
    },
  };
}
