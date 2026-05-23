import { useEffectEvent } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { PendingAction } from "../lib/pending-action";
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
  openRecentDocumentWindow?: (path: string) => Promise<void>;
  requestAction: (action: PendingAction) => void;
  requestVisibleAction: (action: PendingAction) => void;
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
  openRecentDocumentWindow = openDocumentWindow,
  requestAction,
  requestVisibleAction,
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
    requestVisibleAction({ type: "open" });
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
    requestAction({ type: "open" });
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
