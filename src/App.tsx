import {
  lazy,
  Suspense,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { AppShellFallback } from "./components/app/AppShellFallback";
import { UnsavedChangesDialog } from "./components/dialog/UnsavedChangesDialog";
import { WelcomeScreen } from "./components/welcome/WelcomeScreen";
import { useToast } from "./components/toast/ToastProvider";
import type { MarkdownEditorHandle } from "./components/editor/MarkdownEditor";
import { useAppShellActions } from "./hooks/useAppShellActions";
import { useAppShellLifecycle } from "./hooks/useAppShellLifecycle";
import { useAppViewState } from "./hooks/useAppViewState";
import { useAppMenuController } from "./hooks/useAppMenuController";
import { useAppPreferences } from "./hooks/useAppPreferences";
import { useDocumentSession } from "./hooks/useDocumentSession";
import { useInitialDocumentPath } from "./hooks/useInitialDocumentPath";
import { useAppMenuBindings } from "./hooks/useAppMenuBindings";
import { useWindowShortcuts } from "./hooks/useWindowShortcuts";
import { useDocumentDirty } from "./lib/document-store";
import { clearDebugLog } from "./lib/debug-log";
import { syncNativeControls, listenNativeControlAction } from "./lib/native-controls";
import { isTauriRuntime } from "./lib/file-system";
import { usePreviewWindow } from "./hooks/usePreviewWindow";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  DEFAULT_APP_PREFERENCES,
  type AppPreferences,
} from "./lib/preview-preferences";

const EditorWorkspace = lazy(() =>
  import("./components/workspace/EditorWorkspace").then((module) => ({
    default: module.EditorWorkspace,
  })),
);

type AppProps = {
  initialPreferences?: AppPreferences;
};

export default function App({ initialPreferences }: AppProps) {
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const [hasNativeControls, setHasNativeControls] = useState(false);
  const { showToast } = useToast();

  const handlePreferencesSaveError = useEffectEvent(() => {
    showToast("Could not save app preferences.", "error");
  });
  const handlePanelWidthsChange = useEffectEvent(({
    previewPanelWidth,
    tocPanelWidth,
  }: {
    previewPanelWidth: number | null;
    tocPanelWidth: number | null;
  }) => {
    setPreviewPanelWidth(previewPanelWidth);
    setTocPanelWidth(tocPanelWidth);
  });
  const {
    autoLoadExternalMedia: isExternalMediaAutoLoadEnabled,
    isPreviewVisible: legacyPreviewVisible,
    isTocVisible,
    previewPanelWidth,
    setIsExternalMediaAutoLoadEnabled,
    setIsPreviewVisible: setLegacyPreviewVisible,
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

  useInitialDocumentPath({
    applyOpenedDocument: session.applyOpenedDocument,
    createNewDocument: session.createNewDocument,
    loadRecentDocument: session.loadRecentDocument,
  });

  const isDirty = useDocumentDirty(
    session.documentStore,
    session.savedRevision,
    !session.isWelcomeVisible,
  );

  useEffect(() => {
    void clearDebugLog();
  }, []);

  const lifecycle = useAppShellLifecycle({
    filePath: session.filePath,
    filename: session.filename,
    isDirty,
    isWelcomeVisible: session.isWelcomeVisible,
    saveDocument: session.saveDocument,
  });
  const viewState = useAppViewState({
    filePath: session.filePath,
    filename: session.filename,
    isDirty,
    isWelcomeVisible: session.isWelcomeVisible,
    isWindowVisible: lifecycle.isWindowVisible,
    pendingAction: lifecycle.pendingAction,
  });
  const preview = usePreviewWindow({
    documentStore: session.documentStore, filePath: session.filePath,
    filename: session.filename ?? "Untitled.md", themeMode,
    autoLoadExternalMedia: isExternalMediaAutoLoadEnabled,
    isTocVisible, recentFiles: session.recentFiles, canSave: viewState.canSaveDocument,
    onError: (message) => showToast(message, "error"),
  });
  const isPreviewVisible = isTauriRuntime() ? preview.isOpen : legacyPreviewVisible;
  const actions = useAppShellActions({
    activeFilename: viewState.activeFilename,
    canSaveDocument: viewState.canSaveDocument,
    createNewDocumentWindow: session.createNewDocumentWindow,
    filePath: session.filePath,
    openRecentDocumentWindow: session.openRecentDocumentWindow,
    openWithPicker: session.openWithPicker,
    saveDocument: session.saveDocument,
    setIsExternalMediaAutoLoadEnabled,
    setIsPreviewVisible: setLegacyPreviewVisible,
    onTogglePreview: isTauriRuntime() ? preview.toggle : undefined,
    setIsTocVisible,
    setThemeMode,
    showToast,
  });
  const handlePreviewAction = useEffectEvent(({ action, value }: { action: string; value?: string }) => {
    switch (action) {
      case "save": actions.handleMenuSave(); break;
      case "save-as": actions.handleMenuSave(true); break;
      case "new": actions.handleMenuNew(); break;
      case "open": actions.handleMenuOpen(); break;
      case "open-recent": if (value) actions.handleMenuOpenRecent(value); break;
      case "clear-recent": session.clearRecentFilesList(); break;
      case "toggle-external-media": actions.handleMenuToggleExternalMedia(); break;
      case "set-theme-mode": if (value === "light" || value === "dark" || value === "system") actions.handleMenuSetThemeMode(value); break;
      case "copy-path": actions.handleMenuCopyFilePath(); break;
      case "toggle-preview": actions.handleMenuTogglePreview(); break;
      case "toggle-toc": actions.handleMenuToggleToc(); break;
      case "focus-editor": editorRef.current?.focus(); break;
    }
  });
  useEffect(() => {
    if (!isTauriRuntime()) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void getCurrentWindow().listen<{ action: string; value?: string }>("preview-document-action", ({ payload }) => handlePreviewAction(payload))
      .then((unlisten) => { if (disposed) unlisten(); else cleanup = unlisten; })
      .catch(() => { if (!disposed) showToast("Could not connect preview actions.", "error"); });
    return () => { disposed = true; cleanup?.(); };
  }, []);

  const handleNativeAction = useEffectEvent((action: "copy-path" | "toggle-preview") => {
    if (action === "copy-path") actions.handleMenuCopyFilePath();
    else actions.handleMenuTogglePreview();
    editorRef.current?.focus();
  });

  useEffect(() => {
    if (session.isWelcomeVisible) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listenNativeControlAction(handleNativeAction).then((cleanup) => {
      if (disposed) cleanup(); else unlisten = cleanup;
    }).catch(() => showToast("Could not connect document controls.", "error"));
    return () => { disposed = true; unlisten?.(); };
  }, [session.isWelcomeVisible]);

  useEffect(() => {
    if (!session.isWelcomeVisible) {
      void syncNativeControls({ path: session.filePath, previewOpen: isPreviewVisible, pathCopied: actions.isPathCopied })
        .then(setHasNativeControls)
        .catch(() => showToast("Could not update document controls.", "error"));
    }
  }, [session.filePath, session.isWelcomeVisible, isPreviewVisible, actions.isPathCopied]);

  useWindowShortcuts({
    onNew: actions.handleWelcomeNew,
    onOpen: actions.handleWelcomeOpen,
    onSave: actions.handleMenuSave,
  });

  const { menuHandlers, menuState } = useAppMenuBindings({
    canCopyFilePath: viewState.canCopyFilePath,
    canSave: viewState.canSaveDocument,
    canTogglePanels: viewState.canTogglePanels,
    canUseEditMenu: lifecycle.isWindowVisible,
    canUseViewMenu: lifecycle.isWindowVisible,
    isExternalMediaAutoLoadEnabled,
    isPreviewVisible,
    isTocVisible,
    onClearRecentFiles: session.clearRecentFilesList,
    onCopyFilePath: actions.handleMenuCopyFilePath,
    onNew: actions.handleMenuNew,
    onOpen: actions.handleMenuOpen,
    onOpenRecent: actions.handleMenuOpenRecent,
    onSave: actions.handleMenuSave,
    onSetThemeMode: actions.handleMenuSetThemeMode,
    onToggleExternalMedia: actions.handleMenuToggleExternalMedia,
    onTogglePreview: actions.handleMenuTogglePreview,
    onToggleToc: actions.handleMenuToggleToc,
    recentFiles: session.recentFiles,
    themeMode,
  });

  useAppMenuController(menuHandlers, menuState, lifecycle.isWindowFocused);

  return (
    <div className={`app-shell${hasNativeControls ? " app-shell--native" : ""}`}>
      {session.isWelcomeVisible ? (
        <WelcomeScreen
          onNew={actions.handleWelcomeNew}
          onOpen={actions.handleWelcomeOpen}
          onOpenRecent={actions.handleWelcomeOpenRecent}
          recentFiles={session.recentFiles}
        />
      ) : (
        <Suspense fallback={<AppShellFallback />}>
          <EditorWorkspace
            onEditorActivity={preview.onEditorActivity}
            documentKey={session.editorDocumentKey}
            documentStatus={viewState.visibleDocumentStatus}
            documentStore={session.documentStore}
            editorRef={editorRef}
            filePath={session.filePath}
            isPathCopied={actions.isPathCopied}
            onPathCopy={actions.handleMenuCopyFilePath}
            initialPreviewPanelWidth={previewPanelWidth}
            initialTocPanelWidth={tocPanelWidth}
            isExternalMediaAutoLoadEnabled={isExternalMediaAutoLoadEnabled}
            isPreviewVisible={isTauriRuntime() ? false : isPreviewVisible}
            isTocVisible={isTocVisible}
            onEditorFocusChange={lifecycle.handleEditorFocusChange}
            onPanelWidthsChange={handlePanelWidthsChange}
          />
        </Suspense>
      )}

      <UnsavedChangesDialog
        confirmLabel={viewState.dialogState.confirmLabel}
        description={viewState.dialogState.description}
        filename={viewState.activeFilename}
        onDiscard={() => void lifecycle.resolvePendingActionWithDiscard()}
        onSave={() => void lifecycle.resolvePendingActionWithSave()}
        open={lifecycle.pendingAction !== null}
        title={viewState.dialogState.title}
      />

      <input
        accept=".md,text/markdown,text/plain"
        hidden
        onChange={session.handleOpenFile}
        ref={session.fileInputRef}
        type="file"
      />
    </div>
  );
}
