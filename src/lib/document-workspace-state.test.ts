import { describe, expect, it } from "vitest";
import {
  getClosedDocumentWorkspaceState,
  getNewDocumentWorkspaceState,
  getOpenedDocumentWorkspaceState,
  getSavedDocumentWorkspaceState,
  INITIAL_DOCUMENT_WORKSPACE_STATE,
  UNTITLED_FILENAME,
} from "./document-workspace-state";

describe("document-workspace-state", () => {
  it("builds the opened document state with a new document boundary", () => {
    const nextState = getOpenedDocumentWorkspaceState(
      INITIAL_DOCUMENT_WORKSPACE_STATE,
      {
        filename: "draft.md",
        markdown: "# Heading",
        path: "/tmp/draft.md",
      },
      3,
    );

    expect(nextState).toEqual({
      editorDocumentKey: 1,
      filePath: "/tmp/draft.md",
      filename: "draft.md",
      isWelcomeVisible: false,
      savedRevision: 3,
    });
  });

  it("updates only saved document metadata without resetting the document boundary", () => {
    const nextState = getSavedDocumentWorkspaceState(
      {
        editorDocumentKey: 2,
        filePath: null,
        filename: UNTITLED_FILENAME,
        isWelcomeVisible: false,
        savedRevision: 0,
      },
      {
        filename: "saved.md",
        path: "/tmp/saved.md",
      },
      4,
    );

    expect(nextState).toEqual({
      editorDocumentKey: 2,
      filePath: "/tmp/saved.md",
      filename: "saved.md",
      isWelcomeVisible: false,
      savedRevision: 4,
    });
  });

  it("clears metadata and hides the document on close", () => {
    const nextState = getClosedDocumentWorkspaceState(
      {
        editorDocumentKey: 5,
        filePath: "/tmp/draft.md",
        filename: "draft.md",
        isWelcomeVisible: false,
        savedRevision: 2,
      },
      6,
    );

    expect(nextState).toEqual({
      editorDocumentKey: 6,
      filePath: null,
      filename: null,
      isWelcomeVisible: true,
      savedRevision: 6,
    });
  });

  it("creates a new untitled document state with a fresh boundary", () => {
    const nextState = getNewDocumentWorkspaceState(
      INITIAL_DOCUMENT_WORKSPACE_STATE,
      1,
    );

    expect(nextState).toEqual({
      editorDocumentKey: 1,
      filePath: null,
      filename: UNTITLED_FILENAME,
      isWelcomeVisible: false,
      savedRevision: 1,
    });
  });
});
