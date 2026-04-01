import { useEffectEvent } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { PendingAction } from "../lib/pending-action";
import type { ThemeMode } from "../lib/preview-preferences";

type ShowToast = (
  message: string,
  variant?: "error" | "info" | "success" | "warning",
  title?: string,
) => void;

type UseAppShellActionsOptions = {
  activeFilename: string;
  canSaveDocument: boolean;
  filePath: string | null;
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
  filePath,
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
    requestVisibleAction({ type: "new" });
  });

  const handleMenuOpen = useEffectEvent(() => {
    requestVisibleAction({ type: "open" });
  });

  const handleMenuOpenRecent = useEffectEvent((path: string) => {
    requestVisibleAction({ path, type: "openRecent" });
  });

  const handleMenuSave = useEffectEvent((saveAs = false) => {
    if (!canSaveDocument) {
      return;
    }

    void saveDocument({ activeFilename, saveAs });
  });

  const handleMenuCopyFilePath = useEffectEvent(async () => {
    if (!filePath) {
      return;
    }

    try {
      await navigator.clipboard.writeText(filePath);
      showToast("Copied the file path to the clipboard.");
    } catch {
      showToast("Could not copy the file path.", "error");
    }
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
    requestAction({ type: "new" });
  });

  const handleWelcomeOpen = useEffectEvent(() => {
    requestAction({ type: "open" });
  });

  const handleWelcomeOpenRecent = useEffectEvent((path: string) => {
    requestAction({ path, type: "openRecent" });
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
