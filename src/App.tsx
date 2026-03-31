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
import { UnsavedChangesDialog } from "./components/dialog/UnsavedChangesDialog";
import type { MarkdownEditorHandle } from "./components/editor/MarkdownEditor";
import { Toast } from "./components/ui/Toast";
import { WelcomeScreen } from "./components/welcome/WelcomeScreen";
import { useAppMenuController } from "./hooks/useAppMenuController";
import { useAppPreferences } from "./hooks/useAppPreferences";
import { useDocumentSession } from "./hooks/useDocumentSession";
import { useNativeWindowState } from "./hooks/useNativeWindowState";
import { useAppMenuBindings } from "./hooks/useAppMenuBindings";
import { usePendingDocumentAction } from "./hooks/usePendingDocumentAction";
import { useToastState } from "./hooks/useToastState";
import { useDocumentDirty } from "./lib/document-store";
import { clearDebugLog } from "./lib/debug-log";
import { showNativeCloseSheet } from "./lib/native-close-sheet";
import { setupNativeOpenDocumentListener } from "./lib/native-open-document";
import type { PendingAction } from "./lib/pending-action";
import { getUnsavedDialogState } from "./lib/unsaved-dialog-state";
import {
  buildWindowTitle,
  getDocumentStatus,
  getVisibleDocumentStatus,
} from "./lib/window-state";
import {
  DEFAULT_APP_PREFERENCES,
  type ThemeMode,
  type AppPreferences,
} from "./lib/preview-preferences";

const APP_NAME = "ClipMark";
const EditorWorkspace = lazy(() => import("./components/workspace/EditorWorkspace")
  .then((module) => ({ default: module.EditorWorkspace })));

type AppProps = {
  initialPreferences?: AppPreferences;
};

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
export default function App({ initialPreferences }: AppProps) {
  const [isWindowVisible, setIsWindowVisible] = useState(true);
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const { handleExitComplete, showToast, toast } = useToastState();

  const handlePreferencesSaveError = useEffectEvent(() => {
    showToast("Could not save app preferences.", "error");
  });
  const {
    autoLoadExternalMedia: isExternalMediaAutoLoadEnabled,
    isPreviewVisible,
    isTocVisible,
    previewPanelWidth,
    setIsExternalMediaAutoLoadEnabled,
    setIsPreviewVisible,
    setIsTocVisible,
    setPreviewPanelWidth,
    setThemeMode,
    setTocPanelWidth,
    themeMode,
    tocPanelWidth,
  } = useAppPreferences({
    initialPreferences: initialPreferences ?? DEFAULT_APP_PREFERENCES,
    onSaveError: handlePreferencesSaveError,
  });

  const session = useDocumentSession({
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

  const resetDocumentAfterHide = useEffectEvent(() => {
    startTransition(() => {
      session.closeCurrentDocument();
    });
  });

  async function closeCurrentWindowSession() {
    await hideWindowRef.current();
    resetDocumentAfterHide();
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
  const queuePendingActionRef = useRef<(action: PendingAction) => void>(() => undefined);

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
      queuePendingActionRef.current({ type: "closeWindow" });
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

  const {
    pendingAction,
    queuePendingAction,
    requestAction,
    requestVisibleAction,
    resolvePendingActionWithDiscard,
    resolvePendingActionWithSave,
  } = usePendingDocumentAction({
    activeFilename,
    applyOpenedDocument: session.applyOpenedDocument,
    createNewDocument: session.createNewDocument,
    ensureWindowVisible,
    hideWindowAndResetDocument: closeCurrentWindowSession,
    isDirty,
    isWindowVisible,
    loadRecentDocument: session.loadRecentDocument,
    onWindowVisibleChange: setIsWindowVisible,
    openWithPicker: session.openWithPicker,
    openWithPickerWithoutShowingWindow: session.openWithPickerWithoutShowingWindow,
    saveDocument: session.saveDocument,
  });

  queuePendingActionRef.current = queuePendingAction;

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

  const { menuHandlers, menuState } = useAppMenuBindings({
    canCopyFilePath,
    canSave: canSaveDocument,
    canTogglePanels,
    canUseEditMenu: isWindowVisible,
    canUseViewMenu: isWindowVisible,
    isExternalMediaAutoLoadEnabled,
    isPreviewVisible,
    isTocVisible,
    onClearRecentFiles: session.clearRecentFilesList,
    onCopyFilePath: handleMenuCopyFilePath,
    onNew: handleMenuNew,
    onOpen: handleMenuOpen,
    onOpenRecent: handleMenuOpenRecent,
    onSave: handleMenuSave,
    onSetThemeMode: handleMenuSetThemeMode,
    onToggleExternalMedia: handleMenuToggleExternalMedia,
    onTogglePreview: handleMenuTogglePreview,
    onToggleToc: handleMenuToggleToc,
    recentFiles: session.recentFiles,
    themeMode,
  });

  useAppMenuController(menuHandlers, menuState);
  const dialogState = useMemo(
    () => getUnsavedDialogState(activeFilename, pendingAction),
    [activeFilename, pendingAction],
  );

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
          onExitComplete={() => handleExitComplete(toast.id)}
          phase={toast.phase}
          title={toast.title}
          variant={toast.variant}
        />
      ) : null}
    </div>
  );
}
