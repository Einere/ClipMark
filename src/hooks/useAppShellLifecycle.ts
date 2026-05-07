import { startTransition, useEffectEvent, useRef, useState } from "react";
import type { PendingAction } from "../lib/pending-action";
import { deriveAppViewState } from "./useAppViewState";
import { useNativeWindowState } from "./useNativeWindowState";
import { usePendingDocumentAction } from "./usePendingDocumentAction";
import { useWindowCloseRequest } from "./useWindowCloseRequest";

type OpenedDocumentLike = {
  filename: string;
  markdown: string;
  path: string | null;
};

type UseAppShellLifecycleOptions = {
  applyOpenedDocument: (document: OpenedDocumentLike) => void;
  closeCurrentDocument: () => void;
  createNewDocument: () => void;
  filePath: string | null;
  filename: string | null;
  isDirty: boolean;
  isWelcomeVisible: boolean;
  loadRecentDocument: (path: string) => Promise<OpenedDocumentLike | null>;
  openWithPicker: () => Promise<OpenedDocumentLike | null>;
  openWithPickerWithoutShowingWindow: () => Promise<OpenedDocumentLike | null>;
  saveDocument: (options: {
    activeFilename: string;
    saveAs?: boolean;
  }) => Promise<boolean>;
};

export function useAppShellLifecycle({
  applyOpenedDocument,
  closeCurrentDocument,
  createNewDocument,
  filePath,
  filename,
  isDirty,
  isWelcomeVisible,
  loadRecentDocument,
  openWithPicker,
  openWithPickerWithoutShowingWindow,
  saveDocument,
}: UseAppShellLifecycleOptions) {
  const [isWindowVisible, setIsWindowVisible] = useState(true);
  const hideWindowRef = useRef<() => Promise<void>>(async () => {});
  const queuePendingActionRef = useRef<(action: PendingAction) => void>(() => undefined);
  const shellViewState = deriveAppViewState({
    filePath,
    filename,
    isDirty,
    isWelcomeVisible,
  });

  const resetDocumentAfterHide = useEffectEvent(() => {
    startTransition(() => {
      closeCurrentDocument();
    });
  });

  const closeCurrentWindowSession = useEffectEvent(async () => {
    await hideWindowRef.current();
    resetDocumentAfterHide();
  });

  const handleCloseRequested = useWindowCloseRequest({
    activeFilename: shellViewState.activeFilename,
    closeWindowSession: closeCurrentWindowSession,
    isDirty,
    queuePendingAction: (action) => queuePendingActionRef.current(action),
    saveDocument,
  });

  const {
    ensureWindowVisible,
    handleEditorFocusChange,
    hideWindow,
  } = useNativeWindowState({
    filePath,
    isDirty,
    onRequestClose: handleCloseRequested,
    onVisibilityChange: setIsWindowVisible,
    windowTitle: shellViewState.windowTitle,
  });

  hideWindowRef.current = hideWindow;

  const pendingDocumentAction = usePendingDocumentAction({
    activeFilename: shellViewState.activeFilename,
    applyOpenedDocument,
    createNewDocument,
    ensureWindowVisible,
    hideWindowAndResetDocument: closeCurrentWindowSession,
    isDirty,
    isWindowVisible,
    loadRecentDocument,
    onWindowVisibleChange: setIsWindowVisible,
    openWithPicker,
    openWithPickerWithoutShowingWindow,
    saveDocument,
  });

  queuePendingActionRef.current = pendingDocumentAction.queuePendingAction;

  return {
    handleEditorFocusChange,
    isWindowVisible,
    pendingAction: pendingDocumentAction.pendingAction,
    requestAction: pendingDocumentAction.requestAction,
    requestVisibleAction: pendingDocumentAction.requestVisibleAction,
    resolvePendingActionWithDiscard: pendingDocumentAction.resolvePendingActionWithDiscard,
    resolvePendingActionWithSave: pendingDocumentAction.resolvePendingActionWithSave,
  };
}
