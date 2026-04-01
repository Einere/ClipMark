import { useState } from "react";
import type { DocumentStore } from "../lib/document-store";
import type { SavedDocument } from "../lib/file-system";
import {
  getClosedDocumentWorkspaceState,
  getNewDocumentWorkspaceState,
  getOpenedDocumentWorkspaceState,
  getSavedDocumentWorkspaceState,
  INITIAL_DOCUMENT_WORKSPACE_STATE,
  type WorkspaceDocument,
} from "../lib/document-workspace-state";

export function useDocumentWorkspaceState(documentStore: DocumentStore) {
  const [workspaceState, setWorkspaceState] = useState(INITIAL_DOCUMENT_WORKSPACE_STATE);

  function replaceMarkdownAndReadRevision(nextMarkdown: string) {
    documentStore.replaceMarkdown(nextMarkdown);
    return documentStore.getRevision();
  }

  return {
    applyOpenedDocument(document: WorkspaceDocument) {
      const savedRevision = replaceMarkdownAndReadRevision(document.markdown);
      setWorkspaceState((previousState) => getOpenedDocumentWorkspaceState(
        previousState,
        document,
        savedRevision,
      ));
    },
    applySavedDocument(saved: SavedDocument) {
      const savedRevision = documentStore.getRevision();
      setWorkspaceState((previousState) => getSavedDocumentWorkspaceState(
        previousState,
        saved,
        savedRevision,
      ));
    },
    closeCurrentDocument() {
      const savedRevision = replaceMarkdownAndReadRevision("");
      setWorkspaceState((previousState) => getClosedDocumentWorkspaceState(
        previousState,
        savedRevision,
      ));
    },
    createNewDocument() {
      const savedRevision = replaceMarkdownAndReadRevision("");
      setWorkspaceState((previousState) => getNewDocumentWorkspaceState(
        previousState,
        savedRevision,
      ));
    },
    ...workspaceState,
  };
}
