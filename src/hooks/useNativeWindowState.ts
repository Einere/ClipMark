import { useEffect, useEffectEvent, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { logDebug } from "../lib/debug-log";
import { isTauriRuntime } from "../lib/file-system";

type WindowSyncState = {
  edited: boolean;
  path: string | null;
  title: string;
};

type UseNativeWindowStateOptions = {
  filePath: string | null;
  isDirty: boolean;
  isWelcomeVisible: boolean;
  onRequestClose: () => void;
  windowTitle: string;
};

export function useNativeWindowState({
  filePath,
  isDirty,
  isWelcomeVisible,
  onRequestClose,
  windowTitle,
}: UseNativeWindowStateOptions) {
  const dirtyRef = useRef(isDirty);

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

  const requestWindowClose = useEffectEvent(async (force = false) => {
    if (!isTauriRuntime()) {
      return;
    }

    if (force) {
      logDebug("window:close force destroy");
      await getCurrentWindow().destroy();
      return;
    }

    logDebug("window:close request");
    await getCurrentWindow().close();
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
  }, [filePath, isDirty, isWelcomeVisible, syncNativeWindowState, windowTitle]);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let unlisten: (() => void) | undefined;
    let disposed = false;

    void getCurrentWindow()
      .onCloseRequested((event) => {
        logDebug(`window:closeRequested dirty=${dirtyRef.current}`);
        if (!dirtyRef.current) {
          logDebug("window:closeRequested allow default destroy");
          return;
        }

        event.preventDefault();
        logDebug("window:closeRequested prevented");
        onRequestClose();
      })
      .then((dispose) => {
        if (disposed) {
          dispose();
          return;
        }
        unlisten = dispose;
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [onRequestClose]);

  return {
    handleEditorFocusChange,
    requestWindowClose,
  };
}
