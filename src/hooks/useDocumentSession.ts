import type { ChangeEvent } from "react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  createDocumentStore,
  type DocumentStore,
} from "../lib/document-store";
import type { OpenedDocument, SavedDocument } from "../lib/file-system";
import {
  openMarkdownDocument,
  openMarkdownDocumentWithoutShowingWindow,
  saveMarkdownDocument,
} from "../lib/file-system";
import {
  addRecentFile,
  clearRecentFiles,
  loadRecentFiles,
  openRecentFile,
  removeRecentFile,
  type RecentFile,
} from "../lib/recent-files";

const UNTITLED_FILENAME = "Untitled.md";

type UseDocumentSessionOptions = {
  initialDocument?: OpenedDocument | null;
  onInfo: (message: string) => void;
  onError: (message: string) => void;
};

export function useDocumentSession({
  initialDocument,
  onInfo,
  onError,
}: UseDocumentSessionOptions) {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>(() => loadRecentFiles());
  const [filePath, setFilePath] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [savedRevision, setSavedRevision] = useState(0);
  const [editorDocumentKey, setEditorDocumentKey] = useState(0);
  const [isWelcomeVisible, setIsWelcomeVisible] = useState(true);
  const [documentStore] = useState<DocumentStore>(() => createDocumentStore(""));
  const fileInputRef = useRef<HTMLInputElement>(null);

  function bumpDocumentKey() {
    setEditorDocumentKey((value) => value + 1);
  }

  useEffect(() => {
    if (initialDocument) {
      applyOpenedDocument(initialDocument);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 마운트 시 한 번만 실행, applyOpenedDocument는 useEffectEvent라 안전

  const applyOpenedDocument = useEffectEvent((document: OpenedDocument | {
    filename: string;
    markdown: string;
    path: string | null;
  }) => {
    setIsWelcomeVisible(false);
    setFilePath(document.path);
    setFilename(document.filename);
    documentStore.replaceMarkdown(document.markdown);
    setSavedRevision(documentStore.getRevision());
    bumpDocumentKey();

    if (document.path) {
      setRecentFiles((files) => addRecentFile(files, document.path));
    }
  });

  const createNewDocument = useEffectEvent(() => {
    setIsWelcomeVisible(false);
    setFilePath(null);
    setFilename(UNTITLED_FILENAME);
    documentStore.replaceMarkdown("");
    setSavedRevision(documentStore.getRevision());
    bumpDocumentKey();
  });

  const closeCurrentDocument = useEffectEvent(() => {
    setIsWelcomeVisible(true);
    setFilePath(null);
    setFilename(null);
    documentStore.replaceMarkdown("");
    setSavedRevision(documentStore.getRevision());
    bumpDocumentKey();
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
      setRecentFiles((files) => removeRecentFile(files, path));
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
      return false;
    }

    applySavedDocument(saved);
    return true;
  });

  const applySavedDocument = useEffectEvent((saved: SavedDocument) => {
    setFilePath(saved.path);
    setFilename(saved.filename);
    setSavedRevision(documentStore.getRevision());
    setRecentFiles((files) => addRecentFile(files, saved.path));
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

  const clearRecentFilesList = useEffectEvent(() => {
    setRecentFiles(clearRecentFiles());
  });

  return {
    applyOpenedDocument,
    clearRecentFilesList,
    closeCurrentDocument,
    createNewDocument,
    documentStore,
    editorDocumentKey,
    fileInputRef,
    filePath,
    filename,
    handleOpenFile,
    isWelcomeVisible,
    loadRecentDocument,
    openWithPicker,
    openWithPickerWithoutShowingWindow,
    recentFiles,
    savedRevision,
    saveDocument,
  };
}
