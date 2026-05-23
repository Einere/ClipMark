import { useEffectEvent } from "react";
import type { OpenedDocument, SavedDocument } from "../lib/file-system";
import { registerWindowDocumentPath } from "../lib/document-window";

type WorkspaceDocument = OpenedDocument | {
  filename: string;
  markdown: string;
  path: string | null;
};

type UseDocumentSessionFileEffectsOptions = {
  applySavedDocumentToWorkspace: (document: SavedDocument) => void;
  applyWorkspaceDocument: (document: WorkspaceDocument) => void;
  forgetRecentFile: (path: string) => void;
  onError: (message: string) => void;
  onInfo: (message: string) => void;
  rememberRecentFile: (path: string | null) => void;
};

export function useDocumentSessionFileEffects({
  applySavedDocumentToWorkspace,
  applyWorkspaceDocument,
  forgetRecentFile,
  onError,
  onInfo,
  rememberRecentFile,
}: UseDocumentSessionFileEffectsOptions) {
  const applyOpenedDocument = useEffectEvent((document: WorkspaceDocument) => {
    applyWorkspaceDocument(document);
    rememberRecentFile(document.path);
    void registerWindowDocumentPath(document.path);
  });

  const applySavedDocument = useEffectEvent((saved: SavedDocument) => {
    applySavedDocumentToWorkspace(saved);
    rememberRecentFile(saved.path);
    void registerWindowDocumentPath(saved.path);
  });

  const clearRegisteredWindowDocumentPath = useEffectEvent(() => {
    void registerWindowDocumentPath(null);
  });

  const handleMissingRecentFile = useEffectEvent((path: string) => {
    forgetRecentFile(path);
    onError("This recent file could not be found and was removed from the list.");
  });

  const handleUnavailableRecentFile = useEffectEvent(() => {
    onInfo("Recent files are only available in the desktop app.");
  });

  return {
    applyOpenedDocument,
    applySavedDocument,
    clearRegisteredWindowDocumentPath,
    handleMissingRecentFile,
    handleUnavailableRecentFile,
  };
}
