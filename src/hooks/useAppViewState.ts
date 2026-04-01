import { useMemo } from "react";
import type { PendingAction } from "../lib/pending-action";
import { getUnsavedDialogState } from "../lib/unsaved-dialog-state";
import {
  buildWindowTitle,
  getDocumentStatus,
  getVisibleDocumentStatus,
} from "../lib/window-state";

const APP_NAME = "ClipMark";

type UseAppViewStateOptions = {
  filePath: string | null;
  filename: string | null;
  isDirty: boolean;
  isWelcomeVisible: boolean;
  isWindowVisible: boolean;
  pendingAction: PendingAction | null;
};

export function useAppViewState({
  filePath,
  filename,
  isDirty,
  isWelcomeVisible,
  isWindowVisible,
  pendingAction,
}: UseAppViewStateOptions) {
  return useMemo(() => {
    const activeFilename = isWelcomeVisible
      ? APP_NAME
      : (filename ?? "Untitled.md");
    const documentStatus = getDocumentStatus(
      filePath,
      isDirty,
      isWelcomeVisible,
    );

    return {
      activeFilename,
      canCopyFilePath: isWindowVisible && filePath !== null,
      canSaveDocument: isWindowVisible && !isWelcomeVisible,
      canTogglePanels: isWindowVisible && !isWelcomeVisible,
      dialogState: getUnsavedDialogState(activeFilename, pendingAction),
      documentStatus,
      visibleDocumentStatus: getVisibleDocumentStatus(documentStatus),
      windowTitle: buildWindowTitle(activeFilename, documentStatus),
    };
  }, [
    filePath,
    filename,
    isDirty,
    isWelcomeVisible,
    isWindowVisible,
    pendingAction,
  ]);
}
