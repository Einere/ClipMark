import { useEffect, useEffectEvent, useState } from "react";
import {
  createDocumentStore,
  type DocumentStore,
} from "../lib/document-store";
import type { OpenedDocument } from "../lib/file-system";
import { useDocumentFileActions } from "./useDocumentFileActions";
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

  const applyOpenedDocument = useEffectEvent((document: OpenedDocument | {
    filename: string;
    markdown: string;
    path: string | null;
  }) => {
    workspaceState.applyOpenedDocument(document);
    rememberRecentFile(document.path);
  });

  const createNewDocument = useEffectEvent(() => {
    workspaceState.createNewDocument();
  });

  const closeCurrentDocument = useEffectEvent(() => {
    workspaceState.closeCurrentDocument();
  });

  const applySavedDocument = useEffectEvent((saved) => {
    workspaceState.applySavedDocument(saved);
    rememberRecentFile(saved.path);
  });
  const {
    fileInputRef,
    handleOpenFile,
    loadRecentDocument,
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
    onMissingRecentFile: (path) => {
      forgetRecentFile(path);
      onError("This recent file could not be found and was removed from the list.");
    },
    onRecentFileUnavailable: () => {
      onInfo("Recent files are only available in the desktop app.");
    },
  });

  return {
    applyOpenedDocument,
    clearRecentFilesList,
    closeCurrentDocument,
    createNewDocument,
    documentStore,
    editorDocumentKey: workspaceState.editorDocumentKey,
    fileInputRef,
    filePath: workspaceState.filePath,
    filename: workspaceState.filename,
    handleOpenFile,
    isWelcomeVisible: workspaceState.isWelcomeVisible,
    loadRecentDocument,
    openWithPicker,
    openWithPickerWithoutShowingWindow,
    recentFiles,
    savedRevision: workspaceState.savedRevision,
    saveDocument,
  };
}
