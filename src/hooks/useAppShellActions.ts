import { useEffectEvent } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ThemeMode } from "../lib/preview-preferences";
import {
  createDocumentWindow,
  openDocumentWindow,
} from "../lib/document-window";
import { useCopyFilePath, type ShowToast } from "./useCopyFilePath";

type UseAppShellActionsOptions = {
  activeFilename: string;
  canSaveDocument: boolean;
  createNewDocumentWindow?: () => Promise<void>;
  filePath: string | null;
  openWithPicker: () => Promise<unknown>;
  openRecentDocumentWindow?: (path: string) => Promise<void>;
  saveDocument: (options: {
    activeFilename: string;
    saveAs?: boolean;
  }) => Promise<boolean>;
  setIsExternalMediaAutoLoadEnabled: Dispatch<SetStateAction<boolean>>;
  setIsPreviewVisible: Dispatch<SetStateAction<boolean>>;
  setIsTocVisible: Dispatch<SetStateAction<boolean>>;
  setThemeMode: (themeMode: ThemeMode) => void;
  showToast: ShowToast;
};

export function useAppShellActions({
  activeFilename,
  canSaveDocument,
  createNewDocumentWindow = createDocumentWindow,
  filePath,
  openWithPicker,
  openRecentDocumentWindow = openDocumentWindow,
  saveDocument,
  setIsExternalMediaAutoLoadEnabled,
  setIsPreviewVisible,
  setIsTocVisible,
  setThemeMode,
  showToast,
}: UseAppShellActionsOptions) {
  const handleMenuNew = useEffectEvent(() => {
    void createNewDocumentWindow();
  });

  const handleMenuOpen = useEffectEvent(() => {
    void openWithPicker();
  });

  const handleMenuOpenRecent = useEffectEvent((path: string) => {
    void openRecentDocumentWindow(path);
  });

  const handleMenuSave = useEffectEvent((saveAs = false) => {
    if (!canSaveDocument) {
      return;
    }

    void saveDocument({ activeFilename, saveAs });
  });
  const { copyFilePath: handleMenuCopyFilePath } = useCopyFilePath({
    filePath,
    showToast,
  });

  const handleMenuTogglePreview = useEffectEvent(() => {
    setIsPreviewVisible((value) => !value);
  });

  const handleMenuToggleToc = useEffectEvent(() => {
    setIsTocVisible((value) => !value);
  });

  const handleMenuToggleExternalMedia = useEffectEvent(() => {
    setIsExternalMediaAutoLoadEnabled((value) => !value);
  });

  const handleMenuSetThemeMode = useEffectEvent((nextThemeMode: ThemeMode) => {
    setThemeMode(nextThemeMode);
  });

  const handleWelcomeNew = useEffectEvent(() => {
    void createNewDocumentWindow();
  });

  const handleWelcomeOpen = useEffectEvent(() => {
    void openWithPicker();
  });

  const handleWelcomeOpenRecent = useEffectEvent((path: string) => {
    void openRecentDocumentWindow(path);
  });

  return {
    handleMenuCopyFilePath,
    handleMenuNew,
    handleMenuOpen,
    handleMenuOpenRecent,
    handleMenuSave,
    handleMenuSetThemeMode,
    handleMenuToggleExternalMedia,
    handleMenuTogglePreview,
    handleMenuToggleToc,
    handleWelcomeNew,
    handleWelcomeOpen,
    handleWelcomeOpenRecent,
  };
}
