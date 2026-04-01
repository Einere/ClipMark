import { useMemo } from "react";
import type { MenuHandlers, MenuState } from "../lib/menu";
import type { ThemeMode } from "../lib/preview-preferences";
import type { RecentFile } from "../lib/recent-files";

type UseAppMenuBindingsOptions = {
  canCopyFilePath: boolean;
  canSave: boolean;
  canTogglePanels: boolean;
  canUseEditMenu: boolean;
  canUseViewMenu: boolean;
  isExternalMediaAutoLoadEnabled: boolean;
  isPreviewVisible: boolean;
  isTocVisible: boolean;
  onClearRecentFiles: () => void;
  onCopyFilePath: () => Promise<void> | void;
  onNew: () => void;
  onOpen: () => void;
  onOpenRecent: (path: string) => void;
  onSave: (saveAs?: boolean) => Promise<void> | void;
  onSetThemeMode: (themeMode: ThemeMode) => void;
  onToggleExternalMedia: () => void;
  onTogglePreview: () => void;
  onToggleToc: () => void;
  recentFiles: RecentFile[];
  themeMode: ThemeMode;
};

export function useAppMenuBindings({
  canCopyFilePath,
  canSave,
  canTogglePanels,
  canUseEditMenu,
  canUseViewMenu,
  isExternalMediaAutoLoadEnabled,
  isPreviewVisible,
  isTocVisible,
  onClearRecentFiles,
  onCopyFilePath,
  onNew,
  onOpen,
  onOpenRecent,
  onSave,
  onSetThemeMode,
  onToggleExternalMedia,
  onTogglePreview,
  onToggleToc,
  recentFiles,
  themeMode,
}: UseAppMenuBindingsOptions) {
  const menuHandlers = useMemo<MenuHandlers>(() => ({
    onClearRecentFiles,
    onCopyFilePath: () => {
      void onCopyFilePath();
    },
    onNew,
    onOpen,
    onOpenRecent,
    onSave: () => {
      void onSave(false);
    },
    onSaveAs: () => {
      void onSave(true);
    },
    onSetThemeMode,
    onToggleExternalMedia,
    onTogglePreview,
    onToggleToc,
  }), [
    onClearRecentFiles,
    onCopyFilePath,
    onNew,
    onOpen,
    onOpenRecent,
    onSave,
    onSetThemeMode,
    onToggleExternalMedia,
    onTogglePreview,
    onToggleToc,
  ]);

  const menuState = useMemo<MenuState>(() => ({
    canUseEditMenu,
    canUseViewMenu,
    canCopyFilePath,
    canSave,
    canTogglePanels,
    isExternalMediaAutoLoadEnabled,
    isPreviewVisible,
    isTocVisible,
    themeMode,
    recentFiles,
  }), [
    canCopyFilePath,
    canSave,
    canTogglePanels,
    canUseEditMenu,
    canUseViewMenu,
    isExternalMediaAutoLoadEnabled,
    isPreviewVisible,
    isTocVisible,
    recentFiles,
    themeMode,
  ]);

  return {
    menuHandlers,
    menuState,
  };
}
