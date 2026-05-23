import { useEffectEvent, useRef, useState } from "react";
import type { PendingAction } from "../lib/pending-action";
import { deriveAppViewState } from "./useAppViewState";
import { useNativeWindowState } from "./useNativeWindowState";
import { usePendingDocumentAction } from "./usePendingDocumentAction";
import { useWindowCloseRequest } from "./useWindowCloseRequest";

type UseAppShellLifecycleOptions = {
  filePath: string | null;
  filename: string | null;
  isDirty: boolean;
  isWelcomeVisible: boolean;
  saveDocument: (options: {
    activeFilename: string;
    saveAs?: boolean;
  }) => Promise<boolean>;
};

export function useAppShellLifecycle({
  filePath,
  filename,
  isDirty,
  isWelcomeVisible,
  saveDocument,
}: UseAppShellLifecycleOptions) {
  const [isWindowVisible, setIsWindowVisible] = useState(true);
  const closeWindowRef = useRef<() => Promise<void>>(async () => {});
  const queuePendingActionRef = useRef<(action: PendingAction) => void>(() => undefined);
  const shellViewState = deriveAppViewState({
    filePath,
    filename,
    isDirty,
    isWelcomeVisible,
  });

  const closeCurrentWindowSession = useEffectEvent(async () => {
    await closeWindowRef.current();
  });

  const handleCloseRequested = useWindowCloseRequest({
    activeFilename: shellViewState.activeFilename,
    closeWindowSession: closeCurrentWindowSession,
    isDirty,
    queuePendingAction: (action) => queuePendingActionRef.current(action),
    saveDocument,
  });

  const {
    closeWindow,
    handleEditorFocusChange,
    isFocused,
  } = useNativeWindowState({
    filePath,
    isDirty,
    onRequestClose: handleCloseRequested,
    onVisibilityChange: setIsWindowVisible,
    windowTitle: shellViewState.windowTitle,
  });

  closeWindowRef.current = closeWindow;

  const pendingDocumentAction = usePendingDocumentAction({
    activeFilename: shellViewState.activeFilename,
    hideWindowAndResetDocument: closeCurrentWindowSession,
    saveDocument,
  });

  queuePendingActionRef.current = pendingDocumentAction.queuePendingAction;

  return {
    handleEditorFocusChange,
    isWindowFocused: isFocused,
    isWindowVisible,
    pendingAction: pendingDocumentAction.pendingAction,
    resolvePendingActionWithDiscard: pendingDocumentAction.resolvePendingActionWithDiscard,
    resolvePendingActionWithSave: pendingDocumentAction.resolvePendingActionWithSave,
  };
}
