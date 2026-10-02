import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  createDocumentStore,
  type DocumentStore,
} from "../lib/document-store";
import { useDocumentFileActions } from "./useDocumentFileActions";
import { useDocumentSessionFileEffects } from "./useDocumentSessionFileEffects";
import { useDocumentWorkspaceState } from "./useDocumentWorkspaceState";
import { useRecentFilesState } from "./useRecentFilesState";

type UseDocumentSessionOptions = {
  onInfo: (message: string) => void;
  onError: (message: string) => void;
};

export function useDocumentSession({
  onInfo,
  onError,
}: UseDocumentSessionOptions) {
  const [documentStore] = useState<DocumentStore>(() => createDocumentStore(""));
  const fileOperationInFlight = useRef(false);
  const {
    clearRecentFilesList,
    forgetRecentFile,
    recentFiles,
    rememberRecentFile,
  } = useRecentFilesState();
  const workspaceState = useDocumentWorkspaceState(documentStore);
  const {
    applyOpenedDocument,
    applySavedDocument,
    handleMissingRecentFile,
    handleUnavailableRecentFile,
    registerCurrentWindowAsUntitledDocument,
    registerCurrentWindowAsWelcome,
  } = useDocumentSessionFileEffects({
    applySavedDocumentToWorkspace: workspaceState.applySavedDocument,
    applyWorkspaceDocument: workspaceState.applyOpenedDocument,
    forgetRecentFile,
    onError,
    onInfo,
    rememberRecentFile,
  });

  const createNewDocument = useEffectEvent(() => {
    workspaceState.createNewDocument();
    registerCurrentWindowAsUntitledDocument();
  });

  const closeCurrentDocument = useEffectEvent(() => {
    workspaceState.closeCurrentDocument();
    registerCurrentWindowAsWelcome();
  });
  const {
    fileInputRef,
    createNewDocumentWindow,
    handleOpenFile,
    loadRecentDocument,
    openRecentDocumentWindow,
    openWithPicker,
    saveDocument: saveDocumentToDisk,
  } = useDocumentFileActions({
    activeFilePath: workspaceState.filePath,
    applyOpenedDocument,
    applySavedDocument,
    createNewDocument,
    getMarkdown: () => documentStore.getMarkdown(),
    isWelcomeVisible: workspaceState.isWelcomeVisible,
    onMissingRecentFile: handleMissingRecentFile,
    onRecentFileUnavailable: handleUnavailableRecentFile,
  });
  const saveDocument = useEffectEvent(async (options: { activeFilename: string; saveAs?: boolean }) => {
    if (fileOperationInFlight.current) { onInfo("Wait for the current file operation to finish."); return false; }
    fileOperationInFlight.current = true;
    try { return await saveDocumentToDisk(options); }
    finally { fileOperationInFlight.current = false; }
  });

  return {
    applyOpenedDocument,
    clearRecentFilesList,
    closeCurrentDocument,
    createNewDocument,
    createNewDocumentWindow,
    documentStore,
    editorDocumentKey: workspaceState.editorDocumentKey,
    fileInputRef,
    filePath: workspaceState.filePath,
    filename: workspaceState.filename,
    handleOpenFile,
    isWelcomeVisible: workspaceState.isWelcomeVisible,
    loadRecentDocument,
    openRecentDocumentWindow,
    openWithPicker,
    recentFiles,
    savedRevision: workspaceState.savedRevision,
    saveDocument,
  };
}
