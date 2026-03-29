import {
  lazy,
  Suspense,
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
import { Toast } from "./components/ui/Toast";
import { WelcomeScreen } from "./components/welcome/WelcomeScreen";
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
import { listen } from "@tauri-apps/api/event";
import { isTauriRuntime, type OpenedDocument } from "./lib/file-system";
import {
  DEFAULT_APP_PREFERENCES,
  saveAppPreferences,
  type ThemeMode,
  type AppPreferences,
} from "./lib/preview-preferences";
import { applyTheme, subscribeToSystemTheme } from "./lib/theme";
import type { ToastPhase, ToastVariant } from "./components/ui/Toast";

const APP_NAME = "ClipMark";
const TOAST_DURATION_MS = 3200;
const TOAST_WARNING_DURATION_MS = 4200;
const TOAST_ERROR_DURATION_MS = 5600;
const EditorWorkspace = lazy(() => import("./components/workspace/EditorWorkspace")
  .then((module) => ({ default: module.EditorWorkspace })));

type AppProps = {
  initialDocument?: OpenedDocument | null;
  initialPreferences?: AppPreferences;
};

function getToastDuration(variant: ToastVariant) {
  switch (variant) {
    case "error":
      return TOAST_ERROR_DURATION_MS;
    case "warning":
      return TOAST_WARNING_DURATION_MS;
    default:
      return TOAST_DURATION_MS;
  }
}

function prefersReducedToastMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function AppShellFallback() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="app-shell app-shell--loading"
      role="status"
    >
      <div className="app-shell__fallback">
        <p className="app-shell__fallback-kicker">Opening editor</p>
        <p className="app-shell__fallback-message">Preparing your writing workspace.</p>
      </div>
    </div>
  );
}

/* TODO: App 이 너무 많은 책임을 수행하고 있다. 적당히 나누자. */
export default function App({ initialDocument, initialPreferences }: AppProps) {
  const preferences = initialPreferences ?? DEFAULT_APP_PREFERENCES;
  const [isExternalMediaAutoLoadEnabled, setIsExternalMediaAutoLoadEnabled] = useState(
    preferences.autoLoadExternalMedia,
  );
  const [isPreviewVisible, setIsPreviewVisible] = useState(preferences.isPreviewVisible);
  const [isTocVisible, setIsTocVisible] = useState(preferences.isTocVisible);
  const [previewPanelWidth, setPreviewPanelWidth] = useState(preferences.previewPanelWidth);
  const [tocPanelWidth, setTocPanelWidth] = useState(preferences.tocPanelWidth);
  const [themeMode, setThemeMode] = useState(preferences.themeMode);
  const [isWindowVisible, setIsWindowVisible] = useState(true);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [toast, setToast] = useState<{
    id: number;
    message: string;
    phase: ToastPhase;
    title?: string;
    variant: ToastVariant;
  } | null>(null);
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const toastIdRef = useRef(0);

  const clearToastTimers = useEffectEvent(() => {
    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
  });

  const beginToastExit = useEffectEvent(() => {
    if (prefersReducedToastMotion()) {
      setToast(null);
      return;
    }

    setToast((currentToast) => {
      if (!currentToast || currentToast.phase === "exit") {
        return currentToast;
      }

      return {
        ...currentToast,
        phase: "exit",
      };
    });
  });

  const showToast = useEffectEvent((
    message: string,
    variant: ToastVariant = "info",
    title?: string,
  ) => {
    clearToastTimers();
    toastIdRef.current += 1;

    setToast({
      id: toastIdRef.current,
      message,
      phase: "enter",
      title,
      variant,
    });
    toastTimeoutRef.current = window.setTimeout(() => {
      toastTimeoutRef.current = null;
      beginToastExit();
    }, getToastDuration(variant));
  });

  const handlePreferencesSaveError = useEffectEvent(() => {
    showToast("Could not save app preferences.", "error");
  });

  const session = useDocumentSession({
    initialDocument: initialDocument ?? null,
    onError: (message) => showToast(message, "error"),
    onInfo: (message) => showToast(message, "info"),
  });

  const isDirty = useDocumentDirty(
    session.documentStore,
    session.savedRevision,
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
      previewPanelWidth,
      tocPanelWidth,
      themeMode,
    }).catch(() => {
      handlePreferencesSaveError();
    });
  }, [
    handlePreferencesSaveError,
    isExternalMediaAutoLoadEnabled,
    isPreviewVisible,
    isTocVisible,
    previewPanelWidth,
    tocPanelWidth,
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

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let disposed = false;
    let cleanup: (() => void) | undefined;

    void listen<AppPreferences>("preferences-changed", (event) => {
      const prefs = event.payload;
      setIsExternalMediaAutoLoadEnabled(prefs.autoLoadExternalMedia);
      setIsPreviewVisible(prefs.isPreviewVisible);
      setIsTocVisible(prefs.isTocVisible);
      setPreviewPanelWidth(prefs.previewPanelWidth);
      setTocPanelWidth(prefs.tocPanelWidth);
      setThemeMode(prefs.themeMode);
    }).then((unlisten) => {
      if (disposed) {
        unlisten();
        return;
      }
      cleanup = unlisten;
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

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
        <Suspense fallback={<AppShellFallback />}>
          <EditorWorkspace
            documentKey={session.editorDocumentKey}
            documentStore={session.documentStore}
            documentStatus={visibleDocumentStatus}
            editorRef={editorRef}
            filePath={session.filePath}
            initialPreviewPanelWidth={previewPanelWidth}
            initialTocPanelWidth={tocPanelWidth}
            isExternalMediaAutoLoadEnabled={isExternalMediaAutoLoadEnabled}
            isPreviewVisible={isPreviewVisible}
            isTocVisible={isTocVisible}
            onEditorFocusChange={handleEditorFocusChange}
            onPanelWidthsChange={({ previewPanelWidth, tocPanelWidth }) => {
              setPreviewPanelWidth(previewPanelWidth);
              setTocPanelWidth(tocPanelWidth);
            }}
            onPathCopy={() => showToast("Copied the file path to the clipboard.", "success")}
            onPathCopyError={() => showToast("Could not copy the file path.", "error")}
          />
        </Suspense>
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

      {toast ? (
        <Toast
          key={toast.id}
          message={toast.message}
          onExitComplete={() => {
            setToast((currentToast) => (
              currentToast?.id === toast.id && currentToast.phase === "exit"
                ? null
                : currentToast
            ));
          }}
          phase={toast.phase}
          title={toast.title}
          variant={toast.variant}
        />
      ) : null}
    </div>
  );
}
