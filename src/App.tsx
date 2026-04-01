import {
  useEffect,
  useEffectEvent,
  useRef,
} from "react";
import { AppContent } from "./components/app/AppContent";
import { useToast } from "./components/toast/ToastProvider";
import type { MarkdownEditorHandle } from "./components/editor/MarkdownEditor";
import { useAppShellActions } from "./hooks/useAppShellActions";
import { useAppShellLifecycle } from "./hooks/useAppShellLifecycle";
import { useAppViewState } from "./hooks/useAppViewState";
import { useAppMenuController } from "./hooks/useAppMenuController";
import { useAppPreferences } from "./hooks/useAppPreferences";
import { useDocumentSession } from "./hooks/useDocumentSession";
import { useAppMenuBindings } from "./hooks/useAppMenuBindings";
import { useNativeOpenDocumentListener } from "./hooks/useNativeOpenDocumentListener";
import { useWindowShortcuts } from "./hooks/useWindowShortcuts";
import { useDocumentDirty } from "./lib/document-store";
import { clearDebugLog } from "./lib/debug-log";
import {
  buildWindowTitle,
  getDocumentStatus,
} from "./lib/window-state";
import {
  DEFAULT_APP_PREFERENCES,
  type AppPreferences,
} from "./lib/preview-preferences";

const APP_NAME = "ClipMark";

type AppProps = {
  initialPreferences?: AppPreferences;
};

export default function App({ initialPreferences }: AppProps) {
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const { showToast } = useToast();

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
  const windowTitle = buildWindowTitle(
    activeFilename,
    getDocumentStatus(session.filePath, isDirty, session.isWelcomeVisible),
  );

  useEffect(() => {
    void clearDebugLog();
  }, []);

  const lifecycle = useAppShellLifecycle({
    activeFilename,
    applyOpenedDocument: session.applyOpenedDocument,
    closeCurrentDocument: session.closeCurrentDocument,
    createNewDocument: session.createNewDocument,
    filePath: session.filePath,
    isDirty,
    loadRecentDocument: session.loadRecentDocument,
    openWithPicker: session.openWithPicker,
    openWithPickerWithoutShowingWindow: session.openWithPickerWithoutShowingWindow,
    saveDocument: session.saveDocument,
    windowTitle,
  });
  const viewState = useAppViewState({
    filePath: session.filePath,
    filename: session.filename,
    isDirty,
    isWelcomeVisible: session.isWelcomeVisible,
    isWindowVisible: lifecycle.isWindowVisible,
    pendingAction: lifecycle.pendingAction,
  });
  const actions = useAppShellActions({
    activeFilename: viewState.activeFilename,
    canSaveDocument: viewState.canSaveDocument,
    filePath: session.filePath,
    requestAction: lifecycle.requestAction,
    requestVisibleAction: lifecycle.requestVisibleAction,
    saveDocument: session.saveDocument,
    setIsExternalMediaAutoLoadEnabled,
    setIsPreviewVisible,
    setIsTocVisible,
    setThemeMode,
    showToast,
  });

  useWindowShortcuts({
    onNew: actions.handleWelcomeNew,
    onOpen: actions.handleWelcomeOpen,
    onSave: actions.handleMenuSave,
  });
  useNativeOpenDocumentListener({
    onOpenDocument: actions.handleMenuOpenRecent,
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

  useAppMenuController(menuHandlers, menuState);

  return (
    <AppContent
      dialog={{
        confirmLabel: viewState.dialogState.confirmLabel,
        description: viewState.dialogState.description,
        filename: viewState.activeFilename,
        onDiscard: () => void lifecycle.resolvePendingActionWithDiscard(),
        onSave: () => void lifecycle.resolvePendingActionWithSave(),
        open: lifecycle.pendingAction !== null,
        title: viewState.dialogState.title,
      }}
      editor={{
        documentKey: session.editorDocumentKey,
        documentStatus: viewState.visibleDocumentStatus,
        documentStore: session.documentStore,
        editorRef,
        filePath: session.filePath,
        initialPreviewPanelWidth: previewPanelWidth,
        initialTocPanelWidth: tocPanelWidth,
        isExternalMediaAutoLoadEnabled,
        isPreviewVisible,
        isTocVisible,
        onEditorFocusChange: lifecycle.handleEditorFocusChange,
        setPreviewPanelWidth,
        setTocPanelWidth,
      }}
      fileInput={{
        onChange: session.handleOpenFile,
        ref: session.fileInputRef,
      }}
      welcome={{
        isVisible: session.isWelcomeVisible,
        onNew: actions.handleWelcomeNew,
        onOpen: actions.handleWelcomeOpen,
        onOpenRecent: actions.handleWelcomeOpenRecent,
        recentFiles: session.recentFiles,
      }}
    />
  );
}
