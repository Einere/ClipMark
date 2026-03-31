import type { ChangeEvent } from "react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  createDocumentStore,
  type DocumentStore,
} from "../lib/document-store";
import type { OpenedDocument } from "../lib/file-system";
import {
  openMarkdownDocument,
  openMarkdownDocumentWithoutShowingWindow,
  saveMarkdownDocument,
} from "../lib/file-system";
import { openRecentFile } from "../lib/recent-files";
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
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const openWithPicker = useEffectEvent(async (fallbackToFileInput = true) => {
    const document = await openMarkdownDocument();
    if (!document) {
      if (fallbackToFileInput) {
        fileInputRef.current?.click();
      }
      return null;
    }

    applyOpenedDocument(document);
    return document;
  });

  const openWithPickerWithoutShowingWindow = useEffectEvent(async () => {
    return openMarkdownDocumentWithoutShowingWindow();
  });

  const loadRecentDocument = useEffectEvent(async (path: string) => {
    try {
      const document = await openRecentFile(path);
      if (!document) {
        onInfo("Recent files are only available in the desktop app.");
        return null;
      }

      return document;
    } catch {
      forgetRecentFile(path);
      onError("This recent file could not be found and was removed from the list.");
      return null;
    }
  });

  const saveDocument = useEffectEvent(async ({
    activeFilename,
    saveAs = false,
  }: {
    activeFilename: string;
    saveAs?: boolean;
  }) => {
    if (workspaceState.isWelcomeVisible) {
      createNewDocument();
    }

    const saved = await saveMarkdownDocument({
      filename: activeFilename,
      markdown: documentStore.getMarkdown(),
      path: workspaceState.filePath,
      saveAs,
    });

    if (!saved) {
      return false;
    }

    applySavedDocument(saved);
    return true;
  });

  const applySavedDocument = useEffectEvent((saved) => {
    workspaceState.applySavedDocument(saved);
    rememberRecentFile(saved.path);
  });

  const handleOpenFile = useEffectEvent(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    applyOpenedDocument({
      filename: file.name,
      markdown: text,
      path: null,
    });
    event.target.value = "";
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
