import { useEffect, useEffectEvent, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { logDebug } from "../lib/debug-log";
import { closeCurrentDocumentWindow } from "../lib/document-window";
import { isTauriRuntime } from "../lib/file-system";
import { showNativeWindow } from "../lib/native-window";

type WindowSyncState = {
  edited: boolean;
  path: string | null;
  title: string;
};

type UseNativeWindowStateOptions = {
  filePath: string | null;
  isDirty: boolean;
  onRequestClose: () => void | Promise<void>;
  onVisibilityChange: (visible: boolean) => void;
  windowTitle: string;
};

export function useNativeWindowState({
  filePath,
  isDirty,
  onRequestClose,
  onVisibilityChange,
  windowTitle,
}: UseNativeWindowStateOptions) {
  const [isFocused, setIsFocused] = useState(true);
  const dirtyRef = useRef(isDirty);
  const closeRequestInFlightRef = useRef(false);
  const isProgrammaticCloseRef = useRef(false);

  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);

  const syncNativeWindowState = useEffectEvent(
    async (state: WindowSyncState) => {
      logDebug(
        `window:sync title=${state.title} edited=${state.edited} path=${state.path ?? "null"}`,
      );
      await invoke("sync_window_document_state", state);
    },
  );

  const handleEditorFocusChange = useEffectEvent((focused: boolean) => {
    logDebug(`editor:focusChange focused=${focused}`);
  });

  const closeWindow = useEffectEvent(async () => {
    if (!isTauriRuntime()) {
      return;
    }

    isProgrammaticCloseRef.current = true;
    try {
      await closeCurrentDocumentWindow();
    } catch (error) {
      isProgrammaticCloseRef.current = false;
      throw error;
    }
  });

  const ensureWindowVisible = useEffectEvent(async () => {
    if (!isTauriRuntime()) {
      return;
    }

    const currentWindow = getCurrentWindow();
    const isVisible = await currentWindow.isVisible();
    if (!isVisible) {
      await showNativeWindow();
    }

    await currentWindow.setFocus();
    onVisibilityChange(true);
  });

  useEffect(() => {
    document.title = windowTitle;

    if (!isTauriRuntime()) {
      return;
    }

    const nextState = {
      edited: isDirty,
      path: filePath,
      title: windowTitle,
    };

    void syncNativeWindowState(nextState);
  }, [filePath, isDirty, syncNativeWindowState, windowTitle]);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    const currentWindow = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    let unlistenFocus: (() => void) | undefined;
    let disposed = false;

    void Promise.all([
      currentWindow.isVisible(),
      currentWindow.isFocused(),
      currentWindow.onCloseRequested((event) => {
        logDebug(`window:closeRequested dirty=${dirtyRef.current}`);
        if (isProgrammaticCloseRef.current) {
          isProgrammaticCloseRef.current = false;
          logDebug("window:closeRequested programmatic");
          return;
        }

        event.preventDefault();
        if (closeRequestInFlightRef.current) {
          logDebug("window:closeRequested ignored in-flight");
          return;
        }

        logDebug("window:closeRequested prevented");
        closeRequestInFlightRef.current = true;
        void Promise.resolve(onRequestClose())
          .catch((error) => {
            logDebug(`window:closeRequested failed ${String(error)}`);
          })
          .finally(() => {
            closeRequestInFlightRef.current = false;
          });
      }),
      currentWindow.onFocusChanged(({ payload: focused }) => {
        setIsFocused(focused);
        if (focused) {
          onVisibilityChange(true);
        }
      }),
    ]).then(([isVisible, initialFocused, closeDispose, focusDispose]) => {
      if (disposed) {
        closeDispose();
        focusDispose();
        return;
      }
      setIsFocused(initialFocused);
      onVisibilityChange(isVisible);
      unlisten = closeDispose;
      unlistenFocus = focusDispose;
    });

    return () => {
      disposed = true;
      unlisten?.();
      unlistenFocus?.();
    };
  }, [onRequestClose, onVisibilityChange]);

  return {
    closeWindow,
    ensureWindowVisible,
    handleEditorFocusChange,
    isFocused,
  };
}
