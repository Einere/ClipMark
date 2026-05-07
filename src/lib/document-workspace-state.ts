import type { OpenedDocument, SavedDocument } from "./file-system";

export const UNTITLED_FILENAME = "Untitled.md";

export type WorkspaceDocument = OpenedDocument | {
  filename: string;
  markdown: string;
  path: string | null;
};

export type DocumentWorkspaceState = {
  editorDocumentKey: number;
  filePath: string | null;
  filename: string | null;
  isWelcomeVisible: boolean;
  savedRevision: number;
};

export const INITIAL_DOCUMENT_WORKSPACE_STATE: DocumentWorkspaceState = {
  editorDocumentKey: 0,
  filePath: null,
  filename: null,
  isWelcomeVisible: true,
  savedRevision: 0,
};

export function getOpenedDocumentWorkspaceState(
  previousState: DocumentWorkspaceState,
  document: WorkspaceDocument,
  savedRevision: number,
): DocumentWorkspaceState {
  return {
    editorDocumentKey: previousState.editorDocumentKey + 1,
    filePath: document.path,
    filename: document.filename,
    isWelcomeVisible: false,
    savedRevision,
  };
}

export function getSavedDocumentWorkspaceState(
  previousState: DocumentWorkspaceState,
  saved: SavedDocument,
  savedRevision: number,
): DocumentWorkspaceState {
  return {
    ...previousState,
    filePath: saved.path,
    filename: saved.filename,
    savedRevision,
  };
}

export function getClosedDocumentWorkspaceState(
  previousState: DocumentWorkspaceState,
  savedRevision: number,
): DocumentWorkspaceState {
  return {
    editorDocumentKey: previousState.editorDocumentKey + 1,
    filePath: null,
    filename: null,
    isWelcomeVisible: true,
    savedRevision,
  };
}

export function getNewDocumentWorkspaceState(
  previousState: DocumentWorkspaceState,
  savedRevision: number,
): DocumentWorkspaceState {
  return {
    editorDocumentKey: previousState.editorDocumentKey + 1,
    filePath: null,
    filename: UNTITLED_FILENAME,
    isWelcomeVisible: false,
    savedRevision,
  };
}
