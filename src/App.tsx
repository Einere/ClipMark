import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { UnsavedChangesDialog } from "./components/dialog/UnsavedChangesDialog";
import type { MarkdownEditorHandle } from "./components/editor/MarkdownEditor";
import { Toast } from "./components/toast/Toast";
import { WelcomeScreen } from "./components/welcome/WelcomeScreen";
import { EditorWorkspace } from "./components/workspace/EditorWorkspace";
import { useNativeWindowState } from "./hooks/useNativeWindowState";
import {
  createDocumentStore,
  useDocumentDirty,
} from "./lib/document-store";
import {
  isTauriRuntime,
  openMarkdownDocument,
  saveMarkdownDocument,
} from "./lib/file-system";
import { setupAppMenu } from "./lib/menu";
import {
  addRecentFile,
  loadRecentFiles,
  openRecentFile,
  removeRecentFile,
} from "./lib/recent-files";
import { clearDebugLog, logDebug } from "./lib/debug-log";
import { showNativeCloseSheet } from "./lib/native-close-sheet";
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

const UNTITLED_FILENAME = "Untitled.md";
const TOAST_DURATION_MS = 3200;

export default function App() {
  const [recentFiles, setRecentFiles] = useState(() => loadRecentFiles());
  const [filePath, setFilePath] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [savedMarkdown, setSavedMarkdown] = useState("");
  const [editorDocumentKey, setEditorDocumentKey] = useState(0);
  const [isPreviewVisible, setIsPreviewVisible] = useState(true);
  const [isTocVisible, setIsTocVisible] = useState(true);
  const [isWelcomeVisible, setIsWelcomeVisible] = useState(true);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    tone: "error" | "info";
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const [documentStore] = useState(() => createDocumentStore(""));

  const isDirty = useDocumentDirty(documentStore, savedMarkdown, !isWelcomeVisible);
  const activeFilename = filename ?? UNTITLED_FILENAME;
  const documentStatus = getDocumentStatus(filePath, isDirty, isWelcomeVisible);
  const visibleDocumentStatus = getVisibleDocumentStatus(documentStatus);
  const windowTitle = buildWindowTitle(activeFilename, documentStatus);

  useEffect(() => {
    void clearDebugLog().then(() => {
      logDebug("app:start");
    });
  }, []);

  useEffect(() => {
    logDebug(`app:dirty=${isDirty}`);
  }, [isDirty]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

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

  function bumpDocumentKey() {
    setEditorDocumentKey((value) => value + 1);
  }

  function applyOpenedDocument(document: {
    filename: string;
    markdown: string;
    path: string | null;
  }) {
    logDebug(
      `document:apply filename=${document.filename} path=${document.path ?? "null"}`,
    );
    setIsWelcomeVisible(false);
    setFilePath(document.path);
    setFilename(document.filename);
    documentStore.replaceMarkdown(document.markdown);
    setSavedMarkdown(document.markdown);
    bumpDocumentKey();

    if (document.path) {
      setRecentFiles((files) => addRecentFile(files, document.path));
    }
  }

  function createNewDocument() {
    logDebug("document:new");
    setIsWelcomeVisible(false);
    setFilePath(null);
    setFilename(UNTITLED_FILENAME);
    documentStore.replaceMarkdown("");
    setSavedMarkdown("");
    bumpDocumentKey();
  }

  async function openWithPicker() {
    logDebug("document:openPicker:start");
    const document = await openMarkdownDocument();
    if (!document) {
      logDebug("document:openPicker:cancelled");
      fileInputRef.current?.click();
      return;
    }

    logDebug(`document:openPicker:success filename=${document.filename}`);
    applyOpenedDocument(document);
  }

  async function performAction(action: PendingAction) {
    if (action.type === "new") {
      logDebug("action:perform:new");
      createNewDocument();
      return;
    }

    if (action.type === "open") {
      logDebug("action:perform:open");
      await openWithPicker();
      return;
    }

    if (action.type === "openRecent") {
      logDebug(`action:perform:openRecent path=${action.path}`);
      try {
        const document = await openRecentFile(action.path);
        if (!document) {
          showToast("최근 파일은 데스크톱 앱에서만 열 수 있습니다.", "info");
          return;
        }

        applyOpenedDocument(document);
      } catch {
        setRecentFiles((files) => removeRecentFile(files, action.path));
        showToast("최근 파일을 찾을 수 없어 목록에서 제거했습니다.", "error");
      }
      return;
    }

    if (action.type === "close") {
      logDebug("action:perform:close");
      await requestWindowClose(false);
    }
  }

  function requestAction(action: PendingAction) {
    logDebug(`action:request type=${action.type}`);
    if (isDirty) {
      logDebug(`action:deferred type=${action.type}`);
      setPendingAction(action);
      return;
    }

    void performAction(action);
  }

  async function handleOpenFile(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    logDebug(`document:openFallback filename=${file.name}`);
    applyOpenedDocument({
      filename: file.name,
      markdown: text,
      path: null,
    });

    event.target.value = "";
  }

  async function handleSave(saveAs = false) {
    logDebug(`document:save:start saveAs=${saveAs}`);
    if (isWelcomeVisible) {
      createNewDocument();
    }

    const saved = await saveMarkdownDocument({
      filename: activeFilename,
      markdown: documentStore.getMarkdown(),
      path: filePath,
      saveAs,
    });

    if (!saved) {
      logDebug("document:save:cancelled");
      return false;
    }

    logDebug(`document:save:success filename=${saved.filename} path=${saved.path ?? "null"}`);
    setFilePath(saved.path);
    setFilename(saved.filename);
    setSavedMarkdown(documentStore.getMarkdown());
    setRecentFiles((files) => addRecentFile(files, saved.path));
    return true;
  }

  async function resolvePendingActionWithSave() {
    const action = pendingAction;
    if (!action) {
      return;
    }

    logDebug(`dialog:saveThenContinue type=${action.type}`);
    const saved = await handleSave();
    if (!saved) {
      return;
    }

    setPendingAction(null);
    if (getPostSaveResolution(action) === "force-close") {
      await requestWindowClose(true);
      return;
    }

    await performAction(action);
  }

  async function resolvePendingActionWithDiscard() {
    const action = pendingAction;
    logDebug(`dialog:discard type=${action?.type ?? "null"}`);
    setPendingAction(null);

    if (!action) {
      return;
    }

    if (getPostDiscardResolution(action) === "cancel") {
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
      void handleSave(event.shiftKey);
    }
  });

  const handleMenuNew = useEffectEvent(() => {
    requestAction({ type: "new" });
  });

  const handleMenuOpen = useEffectEvent(() => {
    requestAction({ type: "open" });
  });

  const handleMenuOpenRecent = useEffectEvent((path: string) => {
    requestAction({ path, type: "openRecent" });
  });

  const handleMenuSave = useEffectEvent((saveAs = false) => {
    void handleSave(saveAs);
  });

  const handleMenuTogglePreview = useEffectEvent(() => {
    setIsPreviewVisible((value) => !value);
  });

  const handleMenuToggleToc = useEffectEvent(() => {
    setIsTocVisible((value) => !value);
  });

  const handleCloseRequested = useEffectEvent(async () => {
    logDebug(`window:closeFlow:start filename=${activeFilename}`);

    const result = await showNativeCloseSheet(activeFilename);
    logDebug(`window:closeFlow:result value=${result}`);

    if (result === "save") {
      const saved = await handleSave();
      if (saved) {
        await requestWindowClose(true);
      }
      return;
    }

    if (result === "discard") {
      await requestWindowClose(true);
      return;
    }

    if (result === "unsupported") {
      setPendingAction({ type: "close" });
    }
  });

  const { handleEditorFocusChange, requestWindowClose } = useNativeWindowState({
    filePath,
    isDirty,
    isWelcomeVisible,
    onRequestClose: handleCloseRequested,
    windowTitle,
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      handleWindowShortcuts(event);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleWindowShortcuts]);

  useEffect(() => {
    let cleanup: (() => Promise<void>) | undefined;
    let disposed = false;

    void setupAppMenu({
      onNew: handleMenuNew,
      onOpen: handleMenuOpen,
      onOpenRecent: handleMenuOpenRecent,
      onSave: () => handleMenuSave(false),
      onSaveAs: () => handleMenuSave(true),
      onTogglePreview: handleMenuTogglePreview,
      onToggleToc: handleMenuToggleToc,
      recentFiles,
    }).then((dispose) => {
      if (disposed) {
        void dispose?.();
        return;
      }
      cleanup = dispose;
    });

    return () => {
      disposed = true;
      void cleanup?.();
    };
  }, [
    handleMenuNew,
    handleMenuOpen,
    handleMenuOpenRecent,
    handleMenuSave,
    handleMenuTogglePreview,
    handleMenuToggleToc,
    recentFiles,
  ]);

  return (
    <div className="app-shell">
      {isWelcomeVisible ? (
        <WelcomeScreen
          onNew={() => requestAction({ type: "new" })}
          onOpen={() => requestAction({ type: "open" })}
          onOpenRecent={(path) => requestAction({ path, type: "openRecent" })}
          recentFiles={recentFiles}
        />
      ) : (
        <EditorWorkspace
          documentKey={editorDocumentKey}
          documentStore={documentStore}
          editorRef={editorRef}
          filePath={filePath}
          documentStatus={visibleDocumentStatus}
          isPreviewVisible={isPreviewVisible}
          isTocVisible={isTocVisible}
          onPathCopy={() => showToast("파일 경로를 클립보드에 복사했습니다.")}
          onPathCopyError={() => showToast("파일 경로를 복사하지 못했습니다.", "error")}
          onEditorFocusChange={handleEditorFocusChange}
        />
      )}

      <UnsavedChangesDialog
        filename={activeFilename}
        onDiscard={() => void resolvePendingActionWithDiscard()}
        onSave={() => void resolvePendingActionWithSave()}
        open={pendingAction !== null}
      />

      <input
        accept=".md,text/markdown,text/plain"
        className="file-input"
        onChange={handleOpenFile}
        ref={fileInputRef}
        type="file"
      />

      {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}
    </div>
  );
}
