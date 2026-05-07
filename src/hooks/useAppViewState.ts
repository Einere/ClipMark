import { useMemo } from "react";
import type { PendingAction } from "../lib/pending-action";
import { getUnsavedDialogState } from "../lib/unsaved-dialog-state";
import {
  buildWindowTitle,
  getDocumentStatus,
  getVisibleDocumentStatus,
} from "../lib/window-state";

const APP_NAME = "ClipMark";

type AppViewStateInput = {
  filePath: string | null;
  filename: string | null;
  isDirty: boolean;
  isWelcomeVisible: boolean;
};

type UseAppViewStateOptions = {
  isWindowVisible: boolean;
  pendingAction: PendingAction | null;
} & AppViewStateInput;

export function deriveAppViewState({
  filePath,
  filename,
  isDirty,
  isWelcomeVisible,
}: AppViewStateInput) {
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
    documentStatus,
    visibleDocumentStatus: getVisibleDocumentStatus(documentStatus),
    windowTitle: buildWindowTitle(activeFilename, documentStatus),
  };
}

export function useAppViewState({
  filePath,
  filename,
  isDirty,
  isWelcomeVisible,
  isWindowVisible,
  pendingAction,
}: UseAppViewStateOptions) {
  return useMemo(() => {
    const baseViewState = deriveAppViewState({
      filePath,
      filename,
      isDirty,
      isWelcomeVisible,
    });

    return {
      activeFilename: baseViewState.activeFilename,
      canCopyFilePath: isWindowVisible && filePath !== null,
      canSaveDocument: isWindowVisible && !isWelcomeVisible,
      canTogglePanels: isWindowVisible && !isWelcomeVisible,
      dialogState: getUnsavedDialogState(
        baseViewState.activeFilename,
        pendingAction,
      ),
      documentStatus: baseViewState.documentStatus,
      visibleDocumentStatus: baseViewState.visibleDocumentStatus,
      windowTitle: baseViewState.windowTitle,
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
