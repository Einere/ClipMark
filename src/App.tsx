import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
} from "react";
import { AppContent } from "./components/app/AppContent";
import type { MarkdownEditorHandle } from "./components/editor/MarkdownEditor";
import { useAppShellActions } from "./hooks/useAppShellActions";
import { useAppShellLifecycle } from "./hooks/useAppShellLifecycle";
import { useAppMenuController } from "./hooks/useAppMenuController";
import { useAppPreferences } from "./hooks/useAppPreferences";
import { useDocumentSession } from "./hooks/useDocumentSession";
import { useAppMenuBindings } from "./hooks/useAppMenuBindings";
import { useNativeOpenDocumentListener } from "./hooks/useNativeOpenDocumentListener";
import { useToastState } from "./hooks/useToastState";
import { useWindowShortcuts } from "./hooks/useWindowShortcuts";
import { useDocumentDirty } from "./lib/document-store";
import { clearDebugLog } from "./lib/debug-log";
import { getUnsavedDialogState } from "./lib/unsaved-dialog-state";
import {
  buildWindowTitle,
  getDocumentStatus,
  getVisibleDocumentStatus,
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
  const canSaveDocument = lifecycle.isWindowVisible && !session.isWelcomeVisible;
  const canTogglePanels = lifecycle.isWindowVisible && !session.isWelcomeVisible;
  const canCopyFilePath = lifecycle.isWindowVisible && session.filePath !== null;
  const actions = useAppShellActions({
    activeFilename,
    canSaveDocument,
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
    canCopyFilePath,
    canSave: canSaveDocument,
    canTogglePanels,
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
  const dialogState = useMemo(
    () => getUnsavedDialogState(activeFilename, lifecycle.pendingAction),
    [activeFilename, lifecycle.pendingAction],
  );

  return (
    <AppContent
      dialog={{
        confirmLabel: dialogState.confirmLabel,
        description: dialogState.description,
        filename: activeFilename,
        onDiscard: () => void lifecycle.resolvePendingActionWithDiscard(),
        onSave: () => void lifecycle.resolvePendingActionWithSave(),
        open: lifecycle.pendingAction !== null,
        title: dialogState.title,
      }}
      editor={{
        documentKey: session.editorDocumentKey,
        documentStatus: visibleDocumentStatus,
        documentStore: session.documentStore,
        editorRef,
        filePath: session.filePath,
        initialPreviewPanelWidth: previewPanelWidth,
        initialTocPanelWidth: tocPanelWidth,
        isExternalMediaAutoLoadEnabled,
        isPreviewVisible,
        isTocVisible,
        onEditorFocusChange: lifecycle.handleEditorFocusChange,
        onPanelWidthsChange: ({ previewPanelWidth, tocPanelWidth }) => {
          setPreviewPanelWidth(previewPanelWidth);
          setTocPanelWidth(tocPanelWidth);
        },
        onPathCopy: () => showToast("Copied the file path to the clipboard.", "success"),
        onPathCopyError: () => showToast("Could not copy the file path.", "error"),
      }}
      fileInput={{
        onChange: session.handleOpenFile,
        ref: session.fileInputRef,
      }}
      toast={toast ? {
        ...toast,
        onExitComplete: () => handleExitComplete(toast.id),
      } : null}
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
