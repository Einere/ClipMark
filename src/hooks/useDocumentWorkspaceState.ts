import { useState } from "react";
import type { DocumentStore } from "../lib/document-store";
import type { OpenedDocument, SavedDocument } from "../lib/file-system";

const UNTITLED_FILENAME = "Untitled.md";

type WorkspaceDocument = OpenedDocument | {
  filename: string;
  markdown: string;
  path: string | null;
};

export function useDocumentWorkspaceState(documentStore: DocumentStore) {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [savedRevision, setSavedRevision] = useState(0);
  const [editorDocumentKey, setEditorDocumentKey] = useState(0);
  const [isWelcomeVisible, setIsWelcomeVisible] = useState(true);

  function bumpDocumentKey() {
    setEditorDocumentKey((value) => value + 1);
  }

  return {
    applyOpenedDocument(document: WorkspaceDocument) {
      setIsWelcomeVisible(false);
      setFilePath(document.path);
      setFilename(document.filename);
      documentStore.replaceMarkdown(document.markdown);
      setSavedRevision(documentStore.getRevision());
      bumpDocumentKey();
    },
    applySavedDocument(saved: SavedDocument) {
      setFilePath(saved.path);
      setFilename(saved.filename);
      setSavedRevision(documentStore.getRevision());
    },
    closeCurrentDocument() {
      setIsWelcomeVisible(true);
      setFilePath(null);
      setFilename(null);
      documentStore.replaceMarkdown("");
      setSavedRevision(documentStore.getRevision());
      bumpDocumentKey();
    },
    createNewDocument() {
      setIsWelcomeVisible(false);
      setFilePath(null);
      setFilename(UNTITLED_FILENAME);
      documentStore.replaceMarkdown("");
      setSavedRevision(documentStore.getRevision());
      bumpDocumentKey();
    },
    editorDocumentKey,
    filePath,
    filename,
    isWelcomeVisible,
    savedRevision,
  };
}
