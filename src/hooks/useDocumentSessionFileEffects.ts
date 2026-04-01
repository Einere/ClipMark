import { useEffectEvent } from "react";
import type { OpenedDocument, SavedDocument } from "../lib/file-system";

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
  });

  const applySavedDocument = useEffectEvent((saved: SavedDocument) => {
    applySavedDocumentToWorkspace(saved);
    rememberRecentFile(saved.path);
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
    handleMissingRecentFile,
    handleUnavailableRecentFile,
  };
}
