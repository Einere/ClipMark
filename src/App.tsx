import {
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { UnsavedChangesDialog } from "./components/dialog/UnsavedChangesDialog";
import type { MarkdownEditorHandle } from "./components/editor/MarkdownEditor";
import { Toast } from "./components/ui";
import { WelcomeScreen } from "./components/welcome/WelcomeScreen";
import { EditorWorkspace } from "./components/workspace/EditorWorkspace";
import { useAppMenuController } from "./hooks/useAppMenuController";
import { useDocumentSession } from "./hooks/useDocumentSession";
import { useNativeWindowState } from "./hooks/useNativeWindowState";
import { useDocumentDirty } from "./lib/document-store";
import { clearDebugLog } from "./lib/debug-log";
import { showNativeCloseSheet } from "./lib/native-close-sheet";
import { setupNativeOpenDocumentListener } from "./lib/native-open-document";
import {
  getPostDiscardResolution,
  getPostSaveResolution,
  type PendingAction,
} from "./lib/pending-action";
import {
  buildWindowTitle,
  getDocumentStatus,
  getVisibleDocumentStatus,
} from "./lib/window-state";
import {
  DEFAULT_APP_PREFERENCES,
  saveAppPreferences,
  type ThemeMode,
  type AppPreferences,
} from "./lib/preview-preferences";
import { applyTheme, subscribeToSystemTheme } from "./lib/theme";

const APP_NAME = "ClipMark";
const TOAST_DURATION_MS = 3200;

type AppProps = {
  initialPreferences?: AppPreferences;
};

/* TODO: App 이 너무 많은 책임을 수행하고 있다. 적당히 나누자. */
export default function App({ initialPreferences }: AppProps) {
  const preferences = initialPreferences ?? DEFAULT_APP_PREFERENCES;
  const [isExternalMediaAutoLoadEnabled, setIsExternalMediaAutoLoadEnabled] = useState(
    preferences.autoLoadExternalMedia,
  );
  const [isPreviewVisible, setIsPreviewVisible] = useState(preferences.isPreviewVisible);
  const [isTocVisible, setIsTocVisible] = useState(preferences.isTocVisible);
  const [themeMode, setThemeMode] = useState(preferences.themeMode);
  const [isWindowVisible, setIsWindowVisible] = useState(true);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    tone: "error" | "info";
  } | null>(null);
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const showToast = useEffectEvent((
    message: string,
    tone: "error" | "info" = "info",
  ) => {
    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
    }

    setToast({ message, tone });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, TOAST_DURATION_MS);
  });

  const session = useDocumentSession({
    onError: (message) => showToast(message, "error"),
    onInfo: (message) => showToast(message, "info"),
  });

  const isDirty = useDocumentDirty(
    session.documentStore,
    session.savedMarkdown,
    !session.isWelcomeVisible,
  );
  const activeFilename = session.isWelcomeVisible
    ? APP_NAME
    : (session.filename ?? "Untitled.md");
  const documentStatus = getDocumentStatus(
    session.filePath,
    isDirty,
    session.isWelcomeVisible,
  );
  const visibleDocumentStatus = getVisibleDocumentStatus(documentStatus);
  const windowTitle = buildWindowTitle(activeFilename, documentStatus);
  const canSaveDocument = isWindowVisible && !session.isWelcomeVisible;
  const canTogglePanels = isWindowVisible && !session.isWelcomeVisible;
  const canCopyFilePath = isWindowVisible && session.filePath !== null;

  useEffect(() => {
    void clearDebugLog();
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    void saveAppPreferences({
      autoLoadExternalMedia: isExternalMediaAutoLoadEnabled,
      isPreviewVisible,
      isTocVisible,
      themeMode,
    });
  }, [
    isExternalMediaAutoLoadEnabled,
    isPreviewVisible,
    isTocVisible,
    themeMode,
  ]);

  useEffect(() => {
    applyTheme(themeMode);

    if (themeMode !== "system") {
      return;
    }

    return subscribeToSystemTheme(() => {
      applyTheme("system");
    });
  }, [themeMode]);

  const resetDocumentAfterHide = useEffectEvent(() => {
    startTransition(() => {
      session.closeCurrentDocument();
    });
  });

  async function closeCurrentWindowSession() {
    await hideWindowRef.current();
    resetDocumentAfterHide();
  }

  async function performAction(action: PendingAction) {
    if (action.type === "closeWindow") {
      await closeCurrentWindowSession();
      return;
    }

    if (action.type === "new") {
      session.createNewDocument();
      return;
    }

    if (action.type === "open") {
      await session.openWithPicker();
      return;
    }

    const document = await session.loadRecentDocument(action.path);
    if (!document) {
      return;
    }

    session.applyOpenedDocument(document);
  }

  function requestAction(action: PendingAction) {
    if (isDirty) {
      setPendingAction(action);
      return;
    }

    void performAction(action);
  }

  async function resolvePendingActionWithSave() {
    const action = pendingAction;
    if (!action) {
      return;
    }

    const saved = await session.saveDocument({ activeFilename });
    if (!saved) {
      return;
    }

    setPendingAction(null);
    if (getPostSaveResolution(action) === "hide-window") {
      await hideWindowRef.current();
      resetDocumentAfterHide();
      return;
    }

    await performAction(action);
  }

  async function resolvePendingActionWithDiscard() {
    const action = pendingAction;
    setPendingAction(null);

    if (!action || getPostDiscardResolution(action) === "cancel") {
      return;
    }

    await performAction(action);
  }

  const handleWindowShortcuts = useEffectEvent((event: KeyboardEvent) => {
    const hasModifier = event.metaKey || event.ctrlKey;
    if (!hasModifier) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === "n") {
      event.preventDefault();
      requestAction({ type: "new" });
      return;
    }

    if (key === "o") {
      event.preventDefault();
      requestAction({ type: "open" });
      return;
    }

    if (key === "s") {
      event.preventDefault();
      void session.saveDocument({
        activeFilename,
        saveAs: event.shiftKey,
      });
    }
  });

  const showHiddenWindowWithDocument = useEffectEvent((
    loadDocument: () => Promise<{
      filename: string;
      markdown: string;
      path: string | null;
    } | null>,
  ) => {
    void loadDocument().then((document) => {
      if (!document) {
        return;
      }

      flushSync(() => {
        session.applyOpenedDocument(document);
        setIsWindowVisible(true);
      });
      void ensureWindowVisible();
    });
  });

  const requestVisibleAction = useEffectEvent((action: PendingAction) => {
    if (isWindowVisible) {
      requestAction(action);
      return;
    }

    if (action.type === "new") {
      flushSync(() => {
        session.createNewDocument();
        setIsWindowVisible(true);
      });
      void ensureWindowVisible();
      return;
    }

    if (action.type === "open") {
      showHiddenWindowWithDocument(() =>
        session.openWithPickerWithoutShowingWindow(),
      );
      return;
    }

    if (action.type === "openRecent") {
      showHiddenWindowWithDocument(() => session.loadRecentDocument(action.path));
      return;
    }

    void ensureWindowVisible().then(() => {
      setIsWindowVisible(true);
    });
  });

  const handleMenuNew = useEffectEvent(() => {
    requestVisibleAction({ type: "new" });
  });

  const handleMenuOpen = useEffectEvent(() => {
    requestVisibleAction({ type: "open" });
  });

  const handleMenuOpenRecent = useEffectEvent((path: string) => {
    requestVisibleAction({ path, type: "openRecent" });
  });

  const handleNativeOpenDocument = useEffectEvent((path: string) => {
    handleMenuOpenRecent(path);
  });

  const handleMenuSave = useEffectEvent((saveAs = false) => {
    if (!canSaveDocument) {
      return;
    }

    void session.saveDocument({ activeFilename, saveAs });
  });

  const handleMenuCopyFilePath = useEffectEvent(async () => {
    if (!session.filePath) {
      return;
    }

    try {
      await navigator.clipboard.writeText(session.filePath);
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

  const hideWindowRef = useRef<() => Promise<void>>(async () => {});

  const handleCloseRequested = useEffectEvent(async () => {
    if (!isDirty) {
      await hideWindowRef.current();
      resetDocumentAfterHide();
      return;
    }

    const result = await showNativeCloseSheet(activeFilename);
    if (result === "save") {
      const saved = await session.saveDocument({ activeFilename });
      if (saved) {
        await closeCurrentWindowSession();
      }
      return;
    }

    if (result === "discard") {
      await closeCurrentWindowSession();
      return;
    }

    if (result === "unsupported") {
      setPendingAction({ type: "closeWindow" });
    }
  });

  const {
    ensureWindowVisible,
    handleEditorFocusChange,
    hideWindow,
  } = useNativeWindowState({
    filePath: session.filePath,
    isDirty,
    onRequestClose: handleCloseRequested,
    onVisibilityChange: setIsWindowVisible,
    windowTitle,
  });

  hideWindowRef.current = hideWindow;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      handleWindowShortcuts(event);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleWindowShortcuts]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let disposed = false;

    void setupNativeOpenDocumentListener(handleNativeOpenDocument).then((dispose) => {
      if (disposed) {
        dispose?.();
        return;
      }

      cleanup = dispose;
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [handleNativeOpenDocument]);

  const menuHandlers = useMemo(() => ({
    onClearRecentFiles: session.clearRecentFilesList,
    onCopyFilePath: () => {
      void handleMenuCopyFilePath();
    },
    onNew: handleMenuNew,
    onOpen: handleMenuOpen,
    onOpenRecent: handleMenuOpenRecent,
    onSave: () => {
      void handleMenuSave(false);
    },
    onSaveAs: () => {
      void handleMenuSave(true);
    },
    onSetThemeMode: handleMenuSetThemeMode,
    onToggleExternalMedia: handleMenuToggleExternalMedia,
    onTogglePreview: handleMenuTogglePreview,
    onToggleToc: handleMenuToggleToc,
  }), [
    handleMenuCopyFilePath,
    handleMenuNew,
    handleMenuOpen,
    handleMenuOpenRecent,
    handleMenuSave,
    handleMenuSetThemeMode,
    handleMenuToggleExternalMedia,
    handleMenuTogglePreview,
    handleMenuToggleToc,
    session.clearRecentFilesList,
  ]);

  const menuState = useMemo(() => ({
    canUseEditMenu: isWindowVisible,
    canUseViewMenu: isWindowVisible,
    canCopyFilePath,
    canSave: canSaveDocument,
    canTogglePanels,
    isExternalMediaAutoLoadEnabled,
    isPreviewVisible,
    isTocVisible,
    themeMode,
    recentFiles: session.recentFiles,
  }), [
    isWindowVisible,
    canCopyFilePath,
    canSaveDocument,
    canTogglePanels,
    isExternalMediaAutoLoadEnabled,
    isPreviewVisible,
    isTocVisible,
    themeMode,
    session.recentFiles,
  ]);

  useAppMenuController(menuHandlers, menuState);

  const dialogState = pendingAction?.type === "closeWindow"
    ? {
        confirmLabel: "Close Without Saving",
        description: `${activeFilename} has unsaved changes. Save first or close this window without keeping the latest edits.`,
        title: "Save changes before closing?",
      }
    : {
        confirmLabel: "Continue Editing",
        description: `${activeFilename} has unsaved changes. Save first, or keep editing without changing the current document.`,
        title: "Save changes before continuing?",
      };

  return (
    <div className="app-shell">
      {session.isWelcomeVisible ? (
        <WelcomeScreen
          onNew={() => requestAction({ type: "new" })}
          onOpen={() => requestAction({ type: "open" })}
          onOpenRecent={(path) => requestAction({ path, type: "openRecent" })}
          recentFiles={session.recentFiles}
        />
      ) : (
        <EditorWorkspace
          documentKey={session.editorDocumentKey}
          documentStore={session.documentStore}
          documentStatus={visibleDocumentStatus}
          editorRef={editorRef}
          filePath={session.filePath}
          isExternalMediaAutoLoadEnabled={isExternalMediaAutoLoadEnabled}
          isPreviewVisible={isPreviewVisible}
          isTocVisible={isTocVisible}
          onEditorFocusChange={handleEditorFocusChange}
          onPathCopy={() => showToast("Copied the file path to the clipboard.")}
          onPathCopyError={() => showToast("Could not copy the file path.", "error")}
        />
      )}

      <UnsavedChangesDialog
        confirmLabel={dialogState.confirmLabel}
        description={dialogState.description}
        filename={activeFilename}
        onDiscard={() => void resolvePendingActionWithDiscard()}
        onSave={() => void resolvePendingActionWithSave()}
        open={pendingAction !== null}
        title={dialogState.title}
      />

      <input
        accept=".md,text/markdown,text/plain"
        hidden
        onChange={session.handleOpenFile}
        ref={session.fileInputRef}
        type="file"
      />

      {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}
    </div>
  );
}
