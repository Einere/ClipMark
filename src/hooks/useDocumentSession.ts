import { useEffect, useEffectEvent, useState } from "react";
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
    clearRegisteredWindowDocumentPath,
    handleMissingRecentFile,
    handleUnavailableRecentFile,
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
    clearRegisteredWindowDocumentPath();
  });

  const closeCurrentDocument = useEffectEvent(() => {
    workspaceState.closeCurrentDocument();
    clearRegisteredWindowDocumentPath();
  });
  const {
    fileInputRef,
    createNewDocumentWindow,
    handleOpenFile,
    loadRecentDocument,
    openRecentDocumentWindow,
    openWithPicker,
    openWithPickerWithoutShowingWindow,
    saveDocument,
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
    openWithPickerWithoutShowingWindow,
    recentFiles,
    savedRevision: workspaceState.savedRevision,
    saveDocument,
  };
}
